import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type AiProvider = 'anthropic' | 'openai' | 'unknown';
export type AiUsageKind = 'completion' | 'embedding';
export type AiUsageStatus = 'success' | 'error';
export type AiClientPlatform = 'web' | 'android' | 'ios' | 'unknown';

export interface AiTrackingContext {
  tenantId: string;
  studentId: string;
  conversationId: string;
  actorProfileId: string;
  featureType: 'chat' | 'generate_plan' | 'analyze_progress' | 'suggest_load' | 'motivation';
  clientPlatform: AiClientPlatform;
}

interface RecordAiUsageInput {
  provider: AiProvider;
  usageKind: AiUsageKind;
  model?: string | null;
  status: AiUsageStatus;
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs?: number | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Normaliza a origem informada pelo cliente para um conjunto fixo de plataformas.
 */
export function normalizeClientPlatform(platform?: string | null): AiClientPlatform {
  switch ((platform ?? '').toLowerCase()) {
    case 'web':
      return 'web';
    case 'android':
      return 'android';
    case 'ios':
      return 'ios';
    default:
      return 'unknown';
  }
}

/**
 * Persiste um evento de uso do assistente para analytics e auditoria operacional.
 */
export async function recordAiUsage(
  supabase: SupabaseClient,
  tracking: AiTrackingContext,
  input: RecordAiUsageInput,
): Promise<void> {
  const payload = {
    tenant_id: tracking.tenantId,
    student_id: tracking.studentId,
    conversation_id: tracking.conversationId,
    actor_profile_id: tracking.actorProfileId,
    feature_type: tracking.featureType,
    client_platform: tracking.clientPlatform,
    provider: input.provider,
    usage_kind: input.usageKind,
    model: input.model ?? null,
    status: input.status,
    input_tokens: Math.max(0, input.inputTokens ?? 0),
    output_tokens: Math.max(0, input.outputTokens ?? 0),
    latency_ms: input.latencyMs ?? null,
    error_message: input.errorMessage ?? null,
    metadata: input.metadata ?? {},
  };

  const { error } = await supabase.from('ai_usage_events').insert(payload);
  if (error) {
    console.error('[ai-usage-events] insert failed:', error.message);
  }
}
