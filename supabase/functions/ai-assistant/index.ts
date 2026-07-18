import { createClient }         from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchStudentContext }   from './retrieval/student-context.ts';
import { buildMaxSystemPrompt }  from './prompts/max-system-prompt.ts';
import { handleGeneratePlan, type PlanPreferences } from './features/generate-plan.ts';
import { handleAnalyzeProgress } from './features/analyze-progress.ts';
import { handleSuggestLoad }     from './features/suggest-load.ts';
import { handleMotivation }      from './features/motivation.ts';
import { handleChat }            from './features/chat.ts';
import {
  normalizeClientPlatform,
  type AiTrackingContext,
} from './usage.ts';

// ── Constantes ──────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODULE_SLUG = 'assistente-ia';

type Feature = 'chat' | 'generate_plan' | 'analyze_progress' | 'suggest_load' | 'motivation';

interface RequestBody {
  feature: Feature;
  student_id: string;
  message?: string;
  conversation_id?: string;
  period_days?: number;
  exercise_id?: string;
  client_platform?: string;
  plan_preferences?: {
    workout_type?: string;
    goal?: string;
    days_count?: number;
    notes?: string;
    wants_combos?: boolean;
    combo_notes?: string;
  };
}

// ── Entry point ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // 1. Autenticação JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('Missing authorization header', 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) return errorResponse('Unauthorized', 401);

    // 2. Perfil do chamador
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role, tenant_id, full_name')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile?.tenant_id) return errorResponse('Profile not found', 403);

    const ALLOWED_ROLES = ['personal', 'tenant_admin', 'global_admin'];
    if (!ALLOWED_ROLES.includes(profile.role)) {
      return errorResponse('Apenas personal trainers podem utilizar o Assistente IA.', 403);
    }

    const tenantId     = profile.tenant_id;
    const personalName = profile.full_name ?? 'Personal';

    // 3. Verifica módulo habilitado para o tenant
    const { data: moduleRow } = await supabase
      .from('system_modules')
      .select('id')
      .eq('slug', MODULE_SLUG)
      .single();

    if (moduleRow) {
      const { data: tmRow } = await supabase
        .from('tenant_modules')
        .select('enabled')
        .eq('tenant_id', tenantId)
        .eq('module_id', moduleRow.id)
        .maybeSingle();

      if (!tmRow?.enabled) {
        return errorResponse('Módulo Assistente IA não está habilitado para este studio.', 403);
      }
    }

    // 4. Parse do body
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const {
      feature,
      student_id,
      message,
      conversation_id,
      period_days,
      exercise_id,
      client_platform,
      plan_preferences,
    } = body;

    if (!feature)    return errorResponse('Campo "feature" é obrigatório', 400);
    if (!student_id) return errorResponse('Campo "student_id" é obrigatório', 400);

    // 5. Valida que o aluno pertence ao tenant do chamador
    const { data: studentRow, error: studentErr } = await supabase
      .from('students')
      .select('id')
      .eq('id', student_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (studentErr || !studentRow) return errorResponse('Aluno não encontrado', 404);

    // 6. Busca contexto completo do aluno
    const ctx = await fetchStudentContext(supabase, student_id, tenantId);

    // 7. Monta system prompt do Max Strive com contexto do aluno + nome do Personal
    const systemPrompt = buildMaxSystemPrompt(ctx, personalName);

    // 8. Garante que existe uma conversa para registrar as mensagens
    const convId = conversation_id ?? await createConversation(supabase, student_id, tenantId, feature);
    const tracking: AiTrackingContext = {
      tenantId,
      studentId: student_id,
      conversationId: convId,
      actorProfileId: user.id,
      featureType: feature,
      clientPlatform: normalizeClientPlatform(client_platform),
    };

    // 9. Rota para o handler dedicado de cada feature
    switch (feature) {
      case 'generate_plan': {
        const preferences: PlanPreferences | undefined = plan_preferences ? {
          workoutType: plan_preferences.workout_type,
          goal:        plan_preferences.goal,
          daysCount:   plan_preferences.days_count,
          notes:       plan_preferences.notes,
          wantsCombos: plan_preferences.wants_combos,
          comboNotes:  plan_preferences.combo_notes,
        } : undefined;
        return await handleGeneratePlan(supabase, ctx, systemPrompt, student_id, tenantId, convId, tracking, preferences);
      }

      case 'analyze_progress':
        return await handleAnalyzeProgress(supabase, ctx, systemPrompt, student_id, convId, period_days ?? 30, tracking);

      case 'suggest_load':
        return await handleSuggestLoad(supabase, systemPrompt, student_id, convId, exercise_id, tracking);

      case 'motivation':
        return await handleMotivation(supabase, ctx, systemPrompt, student_id, convId, tracking);

      case 'chat':
        if (!message?.trim()) return errorResponse('Campo "message" é obrigatório para o chat', 400);
        return await handleChat(supabase, systemPrompt, message, convId, tenantId, tracking);

      default:
        return errorResponse(`Feature desconhecida: ${feature}`, 400);
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[ai-assistant]', msg);
    return errorResponse(msg, 500);
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

async function createConversation(
  supabase: ReturnType<typeof createClient>,
  studentId: string,
  tenantId: string,
  feature: Feature,
): Promise<string> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ student_id: studentId, tenant_id: tenantId, feature_type: feature })
    .select('id')
    .single();

  if (error || !data) throw new Error('Falha ao criar conversa');
  return data.id;
}

function errorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  );
}
