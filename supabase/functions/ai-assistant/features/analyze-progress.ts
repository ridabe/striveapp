import { SupabaseClient }  from 'https://esm.sh/@supabase/supabase-js@2';
import type { StudentContext } from '../retrieval/student-context.ts';
import { fetchWorkoutLoadHistory, formatLoadHistoryForPrompt } from '../retrieval/workout-context.ts';
import { recordAiUsage, type AiTrackingContext } from '../usage.ts';
import { ANTHROPIC_EFFICIENT_MODEL } from '../models.ts';

const MODEL         = ANTHROPIC_EFFICIENT_MODEL;
const MAX_TOKENS    = 640;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const KEEPALIVE_MS  = 3000;

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
  tracking: AiTrackingContext,
): Promise<Response> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!;
  const startedAt = Date.now();

  try {
    const loadHistory = await fetchWorkoutLoadHistory(supabase, studentId);
    const loadText    = formatLoadHistoryForPrompt(loadHistory, {
      maxExercises: 6,
      maxEntriesPerExercise: 3,
    });
    const userPrompt  = buildAnalyzePrompt(periodDays, loadText);

    await supabase.from('ai_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: userPrompt,
      metadata: {
        period_days: periodDays,
        client_platform: tracking.clientPlatform,
      },
    });

    // Raw fetch para streaming nativo Deno (anthropic.messages.stream() usa
    // EventEmitter do Node.js que trava em async iteration no Deno)
    const anthropicResp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        stream: true,
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      throw new Error(`Anthropic API ${anthropicResp.status}: ${errText}`);
    }

    return buildSseResponse(anthropicResp.body!, supabase, conversationId, tracking, startedAt);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao analisar progresso';
    await recordAiUsage(supabase, tracking, {
      provider: 'anthropic',
      usageKind: 'completion',
      model: MODEL,
      status: 'error',
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
      metadata: { period_days: periodDays },
    });
    throw err;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildAnalyzePrompt(periodDays: number, loadHistory: string): string {
  return `
Analise a evolucao do aluno nos ultimos ${periodDays} dias usando o contexto do perfil e o historico abaixo.

${loadHistory}

Entregue no maximo 5 bullets:
1. frequencia e aderencia
2. progressao de carga
3. tendencia de peso, se houver
4. ponto forte real
5. ate 2 ajustes praticos

Use numeros reais e seja especifico. Evite frases genericas.
`.trim();
}

function buildSseResponse(
  anthropicBody: ReadableStream<Uint8Array>,
  supabase: SupabaseClient,
  conversationId: string,
  tracking: AiTrackingContext,
  startedAt: number,
): Response {
  const encoder = new TextEncoder();
  let fullText  = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let modelName = MODEL;
  let streamError: string | null = null;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader  = anthropicBody.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      const keepAlive = setInterval(() => {
        try { controller.enqueue(encoder.encode(': keep-alive\n\n')); } catch { /* stream já fechado */ }
      }, KEEPALIVE_MS);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === '[DONE]') continue;

            try {
              const ev = JSON.parse(raw);
              if (ev.type === 'message_start') {
                modelName = ev.message?.model ?? modelName;
                inputTokens = ev.message?.usage?.input_tokens ?? inputTokens;
                outputTokens = ev.message?.usage?.output_tokens ?? outputTokens;
              }
              if (ev.type === 'message_delta' && typeof ev.usage?.output_tokens === 'number') {
                outputTokens = ev.usage.output_tokens;
              }
              if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
                fullText += ev.delta.text;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: ev.delta.text })}\n\n`),
                );
              }
            } catch { /* ignore parse errors */ }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        streamError = msg;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } catch { /* ignore */ }
      } finally {
        clearInterval(keepAlive);
      }

      // Persiste resposta antes de fechar o stream
      if (fullText) {
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: fullText,
          metadata: {
            provider: 'anthropic',
            model: modelName,
            client_platform: tracking.clientPlatform,
            tokens_input: inputTokens,
            tokens_output: outputTokens,
          },
        }).catch(console.error);

        await recordAiUsage(supabase, tracking, {
          provider: 'anthropic',
          usageKind: 'completion',
          model: modelName,
          status: streamError ? 'error' : 'success',
          inputTokens,
          outputTokens,
          latencyMs: Date.now() - startedAt,
          errorMessage: streamError,
          metadata: { stream_error: streamError },
        });
      } else if (streamError) {
        await recordAiUsage(supabase, tracking, {
          provider: 'anthropic',
          usageKind: 'completion',
          model: modelName,
          status: 'error',
          inputTokens,
          outputTokens,
          latencyMs: Date.now() - startedAt,
          errorMessage: streamError,
        });
      }

      try {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch { /* ignore */ }
    },
  });

  return new Response(body, {
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
