import { SupabaseClient }  from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic           from 'npm:@anthropic-ai/sdk';
import type { StudentContext } from '../retrieval/student-context.ts';
import { recordAiUsage, type AiTrackingContext } from '../usage.ts';
import { ANTHROPIC_EFFICIENT_MODEL } from '../models.ts';

const MODEL      = ANTHROPIC_EFFICIENT_MODEL;
const MAX_TOKENS = 120;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function handleMotivation(
  supabase: SupabaseClient,
  ctx: StudentContext,
  systemPrompt: string,
  studentId: string,
  conversationId: string,
  tracking: AiTrackingContext,
): Promise<Response> {
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  const startedAt = Date.now();

  try {
    // Busca dados de gamificação para enriquecer a mensagem
    const gamification = await fetchGamificationContext(supabase, studentId);

    const userPrompt = buildMotivationPrompt(gamification);

    await supabase.from('ai_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: userPrompt,
      metadata: { client_platform: tracking.clientPlatform },
    });

    // Motivação usa resposta não-streaming (é curta e enviada via push)
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text)
      .join('');

    const cleanText = sanitizeDirectStudentMessage(text);

    await supabase.from('ai_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: cleanText,
      metadata: {
        provider: 'anthropic',
        model: MODEL,
        client_platform: tracking.clientPlatform,
        tokens_input: response.usage.input_tokens,
        tokens_output: response.usage.output_tokens,
      },
    });

    await recordAiUsage(supabase, tracking, {
      provider: 'anthropic',
      usageKind: 'completion',
      model: MODEL,
      status: 'success',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - startedAt,
    });

    // Retorna via SSE igual às outras features para manter interface consistente
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: cleanText })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(body, {
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar mensagem motivacional';
    await recordAiUsage(supabase, tracking, {
      provider: 'anthropic',
      usageKind: 'completion',
      model: MODEL,
      status: 'error',
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
    });
    throw err;
  }
}

// ── Dados de gamificação ─────────────────────────────────────────────────────

interface GamificationContext {
  totalPointsThisMonth: number;
  workoutsThisMonth: number;
  loadIncreasesThisMonth: number;
  rankingPosition: number | null;
  recentBadges: string[];
  streakDays: number;
}

async function fetchGamificationContext(
  supabase: SupabaseClient,
  studentId: string,
): Promise<GamificationContext> {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const [pointsResult, badgesResult, rankingResult, streakResult] = await Promise.all([
    // Pontos do mês atual
    supabase
      .from('monthly_points')
      .select('total_points, workouts_completed, load_increases')
      .eq('student_id', studentId)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle(),

    // Últimos 3 badges conquistados
    supabase
      .from('student_badges')
      .select('badge_type, earned_at')
      .eq('student_id', studentId)
      .order('earned_at', { ascending: false })
      .limit(3),

    // Posição no ranking atual
    supabase
      .from('current_ranking')
      .select('position')
      .eq('student_id', studentId)
      .maybeSingle(),

    // Streak: dias seguidos com treino (conta sessões dos últimos 30 dias)
    supabase
      .from('workout_sessions')
      .select('started_at')
      .eq('student_id', studentId)
      .not('finished_at', 'is', null)
      .gte('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('started_at', { ascending: false }),
  ]);

  const streakDays = calcStreak((streakResult.data ?? []).map((s: any) => s.started_at.slice(0, 10)));

  return {
    totalPointsThisMonth:    pointsResult.data?.total_points      ?? 0,
    workoutsThisMonth:       pointsResult.data?.workouts_completed ?? 0,
    loadIncreasesThisMonth:  pointsResult.data?.load_increases    ?? 0,
    rankingPosition:         rankingResult.data?.position         ?? null,
    recentBadges:            (badgesResult.data ?? []).map((b: any) => b.badge_type),
    streakDays,
  };
}

function calcStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const unique = [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  let streak = 0;
  let expected = new Date();
  expected.setHours(0, 0, 0, 0);

  for (const dateStr of unique) {
    const d = new Date(dateStr);
    const diff = Math.round((expected.getTime() - d.getTime()) / 86400000);
    if (diff <= 1) {
      streak++;
      expected = d;
    } else {
      break;
    }
  }
  return streak;
}

function buildMotivationPrompt(g: GamificationContext): string {
  const parts: string[] = [
    'Escreva apenas a mensagem final que o aluno irá ler.',
    'A mensagem deve ser escrita em segunda pessoa (como se o Personal estivesse falando diretamente com o aluno).',
    'Baseie-se nos dados do perfil do aluno que já estão no contexto.',
    'Seja especifico e curto.',
    'INSTRUÇÕES IMPORTANTES:',
    '- Esta resposta será diretamente enviada ao aluno!',
    '- Sem introducao, contexto para o personal ou frases de preparo',
    '- Comece direto na mensagem final',
    '- A primeira palavra ja deve fazer parte da mensagem ao aluno',
  ];

  if (g.workoutsThisMonth > 0)
    parts.push(`Dados deste mês: ${g.workoutsThisMonth} treinos concluídos, ${g.totalPointsThisMonth} pontos acumulados.`);

  if (g.loadIncreasesThisMonth > 0)
    parts.push(`Aumentou a carga ${g.loadIncreasesThisMonth} vez(es) este mês — use isso para destacar a evolução.`);

  if (g.streakDays >= 3)
    parts.push(`Streak atual: ${g.streakDays} dias seguidos treinando — mencione a consistência.`);

  if (g.rankingPosition && g.rankingPosition <= 5)
    parts.push(`Está em ${g.rankingPosition}º lugar no ranking do studio — pode mencionar.`);

  if (g.recentBadges.length > 0)
    parts.push(`Badges recentes: ${g.recentBadges.join(', ')}.`);

  parts.push('Maximo 3 linhas. Tom genuino, humano e objetivo. Evite frases genericas.');

  return parts.join('\n');
}

// Remove prefácios voltados ao personal e preserva apenas a mensagem final do aluno.
function sanitizeDirectStudentMessage(text: string): string {
  return text
    .replace(/^(?:aqui\s+est[aá].*?|segue\s+(?:abaixo\s+)?(?:uma\s+)?mensagem.*?|prontinho.*?|mensagem\s+pronta.*?|você\s+pode\s+enviar.*?|para\s+o\s+[^\n:.-]+[:,-]?\s*)[\s:,-]*/i, '')
    .replace(/^(?:oi[,!.\s]+)?personal[,!.\s]*/i, '')
    .trim();
}
