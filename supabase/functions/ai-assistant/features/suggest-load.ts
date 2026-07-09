import { SupabaseClient }  from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchWorkoutLoadHistory, formatLoadHistoryForPrompt } from '../retrieval/workout-context.ts';
import { recordAiUsage, type AiTrackingContext } from '../usage.ts';
import { ANTHROPIC_EFFICIENT_MODEL } from '../models.ts';

const MODEL         = ANTHROPIC_EFFICIENT_MODEL;
const MAX_TOKENS    = 420;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const KEEPALIVE_MS  = 3000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function handleSuggestLoad(
  supabase: SupabaseClient,
  systemPrompt: string,
  studentId: string,
  conversationId: string,
  exerciseId?: string,
  tracking?: AiTrackingContext,
): Promise<Response> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!;
  const startedAt = Date.now();

  if (!tracking) throw new Error('Tracking context ausente');

  try {
    const loadHistory = await fetchWorkoutLoadHistory(supabase, studentId, exerciseId);

    if (!loadHistory.length) {
      return streamText(
        'Não encontrei histórico de execuções com carga registrada para este aluno. ' +
        'Peça ao aluno que registre as cargas durante os treinos para que eu possa sugerir progressões precisas.',
        supabase,
        conversationId,
        tracking,
      );
    }

    const loadText   = formatLoadHistoryForPrompt(loadHistory, {
      maxExercises: exerciseId ? 1 : 5,
      maxEntriesPerExercise: 3,
    });
    const userPrompt = buildSuggestLoadPrompt(loadText, !!exerciseId);

    await supabase.from('ai_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: userPrompt,
      metadata: {
        exercise_id: exerciseId ?? null,
        client_platform: tracking.clientPlatform,
      },
    });

    // Raw fetch para streaming nativo Deno
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
    const message = err instanceof Error ? err.message : 'Erro ao sugerir cargas';
    await recordAiUsage(supabase, tracking, {
      provider: 'anthropic',
      usageKind: 'completion',
      model: MODEL,
      status: 'error',
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
      metadata: { exercise_id: exerciseId ?? null },
    });
    throw err;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSuggestLoadPrompt(loadHistory: string, singleExercise: boolean): string {
  const scope = singleExercise
    ? 'para o exercicio solicitado'
    : 'para os exercicios do plano ativo';

  return `
Analise o historico abaixo e sugira a progressao ideal ${scope}.

${loadHistory}

- Regras de decisao:
  - aumente se houve boa execucao nas ultimas sessoes
  - mantenha ou reduza se houve queda, falha ou inconsistencia
  - use incrementos conservadores

- Formato:
  **Exercicio** - carga atual -> carga sugerida
  Motivo curto em uma linha

- Restricoes:
  - esta resposta vai direto para o aluno
  - sem introducao, sem contexto para o personal, sem repetir o historico
  - no maximo 1 ou 2 linhas por exercicio
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

      if (fullText) {
        fullText = sanitizeDirectStudentMessage(fullText);

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
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Conversation-Id': conversationId,
    },
  });
}

// Remove prefácios voltados ao personal e preserva apenas o conteúdo final enviado ao aluno.
function sanitizeDirectStudentMessage(text: string): string {
  return text
    .replace(/^(?:aqui\s+est[aá].*?|segue\s+(?:abaixo\s+)?(?:uma\s+)?(?:sugest[aã]o|mensagem).*?|prontinho.*?|mensagem\s+pronta.*?|você\s+pode\s+enviar.*?|para\s+o\s+aluno[:,-]?\s*)[\s:,-]*/i, '')
    .replace(/^(?:oi[,!.\s]+)?personal[,!.\s]*/i, '')
    .trim();
}

async function streamText(
  text: string,
  supabase: SupabaseClient,
  conversationId: string,
  tracking: AiTrackingContext,
): Promise<Response> {
  await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: text,
    metadata: {
      provider: 'anthropic',
      client_platform: tracking.clientPlatform,
    },
  });

  await recordAiUsage(supabase, tracking, {
    provider: 'anthropic',
    usageKind: 'completion',
    model: MODEL,
    status: 'success',
    inputTokens: 0,
    outputTokens: 0,
    metadata: { no_history: true },
  });

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
