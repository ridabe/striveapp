import { SupabaseClient }  from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic           from 'npm:@anthropic-ai/sdk';
import type { StudentContext } from '../retrieval/student-context.ts';
import { recordAiUsage, type AiTrackingContext } from '../usage.ts';
import { ANTHROPIC_SMART_MODEL } from '../models.ts';

const MODEL      = ANTHROPIC_SMART_MODEL;
const MAX_TOKENS = 3072;
const EXERCISES_PER_GROUP = 8;

export interface PlanItem {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps: string;
  load?: string;
  rest_seconds?: number;
  count_type?: string;
}

export interface PlanRoutine {
  name: string;
  days_of_week?: number[];
  items: PlanItem[];
}

export interface GeneratedPlan {
  name: string;
  goal: string;
  description?: string;
  routines: PlanRoutine[];
}

interface ExerciseRow {
  id: string;
  name: string;
  muscle_group: string;
  count_type?: string | null;
  load_type?: string | null;
}

export interface PlanPreferences {
  workoutType?: string;
  goal?: string;
  daysCount?: number;
  notes?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function handleGeneratePlan(
  supabase: SupabaseClient,
  ctx: StudentContext,
  systemPrompt: string,
  studentId: string,
  tenantId: string,
  conversationId: string,
  tracking: AiTrackingContext,
  preferences?: PlanPreferences,
): Promise<Response> {
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  const startedAt = Date.now();

  try {
    // 1. Busca exercícios disponíveis (recorte por grupo para reduzir prompt)
    const exercises = await fetchAvailableExercises(supabase, tenantId);
    const exerciseListText = formatExerciseList(exercises);

    const userPrompt = buildUserPrompt(ctx, exerciseListText, preferences);

    // 2. Chama Claude com tool use para forçar JSON estruturado
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [buildPlanTool(preferences?.daysCount)],
      tool_choice: { type: 'tool', name: 'create_workout_plan' },
    });

    // 3. Extrai o plano do tool use
    const toolBlock = response.content.find((b) => b.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      return errorSse('O modelo não retornou um plano estruturado.');
    }

    const plan = toolBlock.input as GeneratedPlan;

    // O Personal definiu explicitamente o objetivo deste treino — não deixa a
    // decisão a critério do modelo, que às vezes reverte para o objetivo do
    // perfil do aluno mesmo quando instruído a seguir a preferência pontual.
    if (preferences?.goal) {
      plan.goal = preferences.goal;
    }

    // 4. Insere o plano no banco (status inactive — personal revisa antes de ativar)
    let planId: string;
    try {
      planId = await insertPlan(supabase, plan, studentId, tenantId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar plano';
      return errorSse(`Erro ao salvar plano no banco: ${msg}`);
    }

    // 5. Salva na conversa
    await supabase.from('ai_messages').insert([
      {
        conversation_id: conversationId,
        role: 'user',
        content: userPrompt,
        metadata: { client_platform: tracking.clientPlatform },
      },
      {
        conversation_id: conversationId,
        role: 'assistant',
        content: `Plano gerado: ${plan.name}`,
        metadata: {
          plan_id: planId,
          provider: 'anthropic',
          model: MODEL,
          client_platform: tracking.clientPlatform,
          tokens_input: response.usage.input_tokens,
          tokens_output: response.usage.output_tokens,
        },
      },
    ]);

    await recordAiUsage(supabase, tracking, {
      provider: 'anthropic',
      usageKind: 'completion',
      model: MODEL,
      status: 'success',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - startedAt,
      metadata: { plan_id: planId },
    });

    // 6. Responde via SSE com resumo legível + plan_id
    const summary = buildPlanSummary(plan, planId);
    return streamText(summary);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar plano';
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildUserPrompt(
  ctx: StudentContext,
  exerciseListText: string,
  preferences?: PlanPreferences,
): string {
  const hasPreferences = !!(preferences?.workoutType || preferences?.goal || preferences?.daysCount || preferences?.notes);

  if (!hasPreferences) {
    return `
Objetivo do aluno: ${ctx.student.goal ?? 'nao definido'}.
Monte um plano completo usando somente os exercicios listados.
Inclua sempre o exercise_id exato.

${exerciseListText}

Regras:
- crie entre 3 e 5 rotinas
- cada rotina deve ter exercicios coerentes com o objetivo
- para cada exercicio inclua series, repeticoes, carga inicial sugerida e descanso em segundos
- nao invente exercise_id
`.trim();
  }

  const daysCount = preferences?.daysCount && preferences.daysCount > 0 ? preferences.daysCount : null;
  const goal = preferences?.goal || preferences?.workoutType;

  return `
Objetivo geral do aluno (perfil): ${ctx.student.goal ?? 'nao definido'}.
O Personal especificou as preferencias abaixo para ESTE treino especificamente — siga-as
rigorosamente, IGNORANDO o objetivo geral do perfil quando ele conflitar com elas:

${goal ? `- Objetivo deste treino (usar exatamente este valor no campo "goal" da resposta): ${goal}` : ''}
${daysCount ? `- Quantidade de rotinas: exatamente ${daysCount} — nem mais, nem menos` : ''}
${preferences?.notes ? `- Observacoes do Personal: ${preferences.notes}` : ''}

Monte um plano completo usando somente os exercicios listados abaixo.
Inclua sempre o exercise_id exato.

${exerciseListText}

Regras:
${daysCount ? `- o array "routines" da resposta deve ter exatamente ${daysCount} itens` : '- crie entre 3 e 5 rotinas'}
- cada rotina deve ter exercicios coerentes com o objetivo e observacoes do Personal
- para cada exercicio inclua series, repeticoes, carga inicial sugerida e descanso em segundos
- nao invente exercise_id
`.trim();
}

export async function fetchAvailableExercises(supabase: SupabaseClient, tenantId: string) {
  // Limita a base enviada ao modelo para reduzir tokens sem perder variedade.
  const { data } = await supabase
    .from('exercises')
    .select('id, name, muscle_group, count_type, load_type')
    .or(`is_global.eq.true,tenant_id.eq.${tenantId}`)
    .order('name');

  // Agrupa e limita a 12 por grupo
  const grouped = new Map<string, ExerciseRow[]>();
  for (const ex of data ?? []) {
    const list = grouped.get(ex.muscle_group) ?? [];
    if (list.length < EXERCISES_PER_GROUP) {
      list.push(ex);
      grouped.set(ex.muscle_group, list);
    }
  }
  return [...grouped.values()].flat();
}

export function formatExerciseList(exercises: ExerciseRow[]): string {
  const grouped = new Map<string, ExerciseRow[]>();
  for (const ex of exercises) {
    const list = grouped.get(ex.muscle_group) ?? [];
    list.push(ex);
    grouped.set(ex.muscle_group, list);
  }

  const lines: string[] = [];
  for (const [group, exs] of grouped) {
    lines.push(`\n${group}:`);
    for (const ex of exs) {
      lines.push(`  - [${ex.id}] ${ex.name}`);
    }
  }
  return lines.join('\n');
}

export function buildPlanTool(exactRoutinesCount?: number): Anthropic.Tool {
  const routinesDescription = exactRoutinesCount
    ? `Rotinas do plano. Deve conter exatamente ${exactRoutinesCount} item(ns) — a quantidade de dias pedida pelo Personal.`
    : 'Rotinas do plano.';

  return {
    name: 'create_workout_plan',
    description: 'Cria um plano de treino estruturado com rotinas e exercícios',
    input_schema: {
      type: 'object' as const,
      properties: {
        name:        { type: 'string', description: 'Nome do plano' },
        goal:        { type: 'string', description: 'Objetivo principal' },
        description: { type: 'string', description: 'Descrição breve do plano' },
        routines: {
          type: 'array',
          description: routinesDescription,
          ...(exactRoutinesCount ? { minItems: exactRoutinesCount, maxItems: exactRoutinesCount } : {}),
          items: {
            type: 'object' as const,
            properties: {
              name:        { type: 'string' },
              days_of_week: {
                type: 'array',
                items: { type: 'number' },
                description: '0=Dom, 1=Seg ... 6=Sab. Pode ter mais de um dia. Omita ou deixe vazio para rotina de dia livre (sem dia fixo).',
              },
              items: {
                type: 'array',
                items: {
                  type: 'object' as const,
                  properties: {
                    exercise_id:   { type: 'string', description: 'UUID exato da lista fornecida' },
                    exercise_name: { type: 'string' },
                    sets:          { type: 'number' },
                    reps:          { type: 'string', description: 'Ex: "8-12", "15", "AMRAP"' },
                    load:          { type: 'string', description: 'Ex: "20kg", "40% RM"' },
                    rest_seconds:  { type: 'number' },
                    count_type:    { type: 'string', enum: ['reps', 'time'] },
                  },
                  required: ['exercise_id', 'exercise_name', 'sets', 'reps'],
                },
              },
            },
            required: ['name', 'items'],
          },
        },
      },
      required: ['name', 'goal', 'routines'],
    },
  };
}

export async function insertPlan(
  supabase: SupabaseClient,
  plan: GeneratedPlan,
  studentId: string,
  tenantId: string,
): Promise<string> {
  // Insere o plano principal (inactive — personal ativa manualmente)
  const { data: planRow, error: planErr } = await supabase
    .from('workout_plans')
    .insert({
      name:       plan.name,
      goal:       plan.goal,
      description: plan.description ?? null,
      status:     'inactive',
      student_id: studentId,
      tenant_id:  tenantId,
    })
    .select('id')
    .single();

  if (planErr || !planRow) throw new Error(planErr?.message ?? 'Falha ao inserir plano');

  const planId = planRow.id;

  // Insere rotinas (e os itens de cada uma) em paralelo — são independentes
  // entre si, então não há motivo para serializar esses round-trips e
  // prolongar o silêncio na resposta ao cliente.
  await Promise.all(plan.routines.map(async (routine, ri) => {
    const { data: routineRow, error: routineErr } = await supabase
      .from('workout_routines')
      .insert({
        workout_plan_id: planId,
        tenant_id:       tenantId,
        name:            routine.name,
        days_of_week:    routine.days_of_week?.length ? routine.days_of_week : null,
        display_order:   ri,
      })
      .select('id')
      .single();

    if (routineErr || !routineRow) throw new Error(routineErr?.message ?? 'Falha ao inserir rotina');

    const routineId = routineRow.id;

    const itemsToInsert = routine.items.map((item, idx) => ({
      routine_id:    routineId,
      tenant_id:     tenantId,
      exercise_id:   item.exercise_id,
      sets:          item.sets,
      reps:          item.reps,
      load:          item.load ?? null,
      rest_seconds:  item.rest_seconds ?? 60,
      count_type:    item.count_type ?? 'reps',
      display_order: idx,
    }));

    const { error: itemsErr } = await supabase.from('workout_items').insert(itemsToInsert);
    if (itemsErr) throw new Error(itemsErr.message);
  }));

  return planId;
}

export function buildPlanSummary(plan: GeneratedPlan, planId: string): string {
  const lines = [
    `✅ Plano **"${plan.name}"** criado com sucesso!`,
    ``,
    `**Objetivo:** ${plan.goal}`,
    plan.description ? `${plan.description}` : '',
    ``,
    `**Estrutura gerada:**`,
  ];

  for (const r of plan.routines) {
    const day = r.days_of_week?.length ? `(dias ${r.days_of_week.join(', ')})` : '(dia livre)';
    lines.push(`• ${r.name} ${day} — ${r.items.length} exercícios`);
  }

  lines.push(``, `O plano está **inativo** aguardando revisão. Ative-o no painel para liberar ao aluno.`);
  lines.push(``, `plan_id:${planId}`);

  return lines.filter((l) => l !== null).join('\n');
}

function streamText(text: string): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(body, {
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}

function errorSse(message: string): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(body, {
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
