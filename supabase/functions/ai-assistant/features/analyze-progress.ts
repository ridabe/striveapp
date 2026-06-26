import { SupabaseClient }  from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic           from 'npm:@anthropic-ai/sdk';
import type { StudentContext } from '../retrieval/student-context.ts';
import { fetchWorkoutLoadHistory, formatLoadHistoryForPrompt } from '../retrieval/workout-context.ts';

const MODEL      = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function handleAnalyzeProgress(
  supabase: SupabaseClient,
  ctx: StudentContext,
  systemPrompt: string,
  studentId: string,
  conversationId: string,
  periodDays: number,
): Promise<Response> {
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

  // Busca histórico de carga dos exercícios para enriquecer a análise
  const loadHistory = await fetchWorkoutLoadHistory(supabase, studentId);
  const loadText    = formatLoadHistoryForPrompt(loadHistory);

  const userPrompt = buildAnalyzePrompt(periodDays, loadText);

  // Salva mensagem do usuário
  await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: userPrompt,
    metadata: { period_days: periodDays },
  });

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  return sseStream(stream, supabase, conversationId);
}

function buildAnalyzePrompt(periodDays: number, loadHistory: string): string {
  return `
Analise a evolução do aluno nos últimos ${periodDays} dias. Use os dados do perfil (já no contexto) e o histórico de cargas abaixo.

${loadHistory}

Sua análise deve cobrir:
1. **Frequência**: quantos treinos/semana e se está dentro do esperado para o objetivo
2. **Progressão de carga**: quais exercícios evoluíram, quais estagnaram
3. **Tendência de peso**: interpretação da variação (se houver dados)
4. **Pontos fortes**: o que merece destaque genuíno
5. **Oportunidades**: 1 ou 2 ajustes práticos que fariam diferença

Seja específico — use números reais. Não use frases genéricas como "você está indo bem".
`.trim();
}

function sseStream(
  stream: ReturnType<Anthropic['messages']['stream']>,
  supabase: SupabaseClient,
  conversationId: string,
): Response {
  const encoder = new TextEncoder();
  let fullText  = '';

  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullText += event.delta.text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();

        const finalMsg = await stream.finalMessage();
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: fullText,
          metadata: {
            tokens_input:  finalMsg.usage.input_tokens,
            tokens_output: finalMsg.usage.output_tokens,
            model: MODEL,
          },
        });
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(body, {
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
