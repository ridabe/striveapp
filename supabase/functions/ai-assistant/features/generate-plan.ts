import { SupabaseClient }  from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic           from 'npm:@anthropic-ai/sdk';
import type { StudentContext } from '../retrieval/student-context.ts';

const MODEL      = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;

interface PlanItem {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps: string;
  load?: string;
  rest_seconds?: number;
  count_type?: string;
}

interface PlanRoutine {
  name: string;
  day_of_week?: number;
  items: PlanItem[];
}

interface GeneratedPlan {
  name: string;
  goal: string;
  description?: string;
  routines: PlanRoutine[];
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
): Promise<Response> {
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

  // 1. Busca exercícios disponíveis (top 12 por grupo muscular)
  const exercises = await fetchAvailableExercises(supabase, tenantId);
  const exerciseListText = formatExerciseList(exercises);

  const userPrompt = `
Com base no perfil do aluno (objetivo: ${ctx.student.goal ?? 'não definido'}), crie um plano de treino completo.
Use SOMENTE exercícios da lista abaixo e inclua o exercise_id exato de cada um.

${exerciseListText}

Crie entre 3 e 5 rotinas (dias de treino) adequadas ao objetivo.
Para cada exercício inclua: séries, repetições, carga inicial sugerida e descanso em segundos.
`.trim();

  // 2. Chama Claude com tool use para forçar JSON estruturado
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    tools: [buildPlanTool()],
    tool_choice: { type: 'tool', name: 'create_workout_plan' },
  });

  // 3. Extrai o plano do tool use
  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    return errorSse('O modelo não retornou um plano estruturado.');
  }

  const plan = toolBlock.input as GeneratedPlan;

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
    { conversation_id: conversationId, role: 'user',      content: userPrompt,            metadata: {} },
    { conversation_id: conversationId, role: 'assistant', content: `Plano gerado: ${plan.name}`, metadata: { plan_id: planId, tokens_input: response.usage.input_tokens, tokens_output: response.usage.output_tokens } },
  ]);

  // 6. Responde via SSE com resumo legível + plan_id
  const summary = buildPlanSummary(plan, planId);
  return streamText(summary);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchAvailableExercises(supabase: SupabaseClient, tenantId: string) {
  // Top 12 por grupo muscular (globais + do tenant)
  const { data } = await supabase
    .from('exercises')
    .select('id, name, muscle_group, count_type, load_type')
    .or(`is_global.eq.true,tenant_id.eq.${tenantId}`)
    .order('name');

  // Agrupa e limita a 12 por grupo
  const grouped = new Map<string, any[]>();
  for (const ex of data ?? []) {
    const list = grouped.get(ex.muscle_group) ?? [];
    if (list.length < 12) {
      list.push(ex);
      grouped.set(ex.muscle_group, list);
    }
  }
  return [...grouped.values()].flat();
}

function formatExerciseList(exercises: any[]): string {
  const grouped = new Map<string, any[]>();
  for (const ex of exercises) {
    const list = grouped.get(ex.muscle_group) ?? [];
    list.push(ex);
    grouped.set(ex.muscle_group, list);
  }

  const lines: string[] = [];
  for (const [group, exs] of grouped) {
    lines.push(`\n${group}:`);
    for (const ex of exs) {
      lines.push(`  - [${ex.id}] ${ex.name} (${ex.count_type ?? 'reps'})`);
    }
  }
  return lines.join('\n');
}

function buildPlanTool(): Anthropic.Tool {
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
          items: {
            type: 'object' as const,
            properties: {
              name:        { type: 'string' },
              day_of_week: { type: 'number', description: '0=Dom, 1=Seg ... 6=Sab' },
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

async function insertPlan(
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

  // Insere rotinas e itens
  for (let ri = 0; ri < plan.routines.length; ri++) {
    const routine = plan.routines[ri];

    const { data: routineRow, error: routineErr } = await supabase
      .from('workout_routines')
      .insert({
        workout_plan_id: planId,
        tenant_id:       tenantId,
        name:            routine.name,
        day_of_week:     routine.day_of_week ?? null,
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
  }

  return planId;
}

function buildPlanSummary(plan: GeneratedPlan, planId: string): string {
  const lines = [
    `✅ Plano **"${plan.name}"** criado com sucesso!`,
    ``,
    `**Objetivo:** ${plan.goal}`,
    plan.description ? `${plan.description}` : '',
    ``,
    `**Estrutura gerada:**`,
  ];

  for (const r of plan.routines) {
    const day = r.day_of_week != null ? `(dia ${r.day_of_week})` : '';
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
