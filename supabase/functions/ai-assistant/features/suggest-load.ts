import { SupabaseClient }  from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchWorkoutLoadHistory, formatLoadHistoryForPrompt } from '../retrieval/workout-context.ts';

const MODEL         = 'claude-sonnet-4-6';
const MAX_TOKENS    = 1024;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

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
): Promise<Response> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

  const loadHistory = await fetchWorkoutLoadHistory(supabase, studentId, exerciseId);

  if (!loadHistory.length) {
    return streamText(
      'Não encontrei histórico de execuções com carga registrada para este aluno. ' +
      'Peça ao aluno que registre as cargas durante os treinos para que eu possa sugerir progressões precisas.',
      supabase, conversationId,
    );
  }

  const loadText   = formatLoadHistoryForPrompt(loadHistory);
  const userPrompt = buildSuggestLoadPrompt(loadText, !!exerciseId);

  await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: userPrompt,
    metadata: { exercise_id: exerciseId ?? null },
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

  return buildSseResponse(anthropicResp.body!, supabase, conversationId);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSuggestLoadPrompt(loadHistory: string, singleExercise: boolean): string {
  const scope = singleExercise
    ? 'para o exercício solicitado'
    : 'para os exercícios do plano ativo';

  return `
Com base no histórico de cargas abaixo, sugira o ajuste ideal ${scope}.

${loadHistory}

Para cada exercício, aplique os princípios de sobrecarga progressiva:
- Se o aluno completou todas as séries/reps prescritas nas últimas 2-3 sessões com boa margem → aumente a carga
- Se houve queda de rendimento ou carga inconsistente → mantenha ou reduza levemente
- Sugestão de incremento: 2,5-5kg para membros superiores, 5-10kg para membros inferiores

Formato da resposta:
**Exercício** — carga atual → carga sugerida
_(motivo em uma linha)_

Seja direto. Não repita os dados de histórico na resposta.
`.trim();
}

function buildSseResponse(
  anthropicBody: ReadableStream<Uint8Array>,
  supabase: SupabaseClient,
  conversationId: string,
): Response {
  const encoder = new TextEncoder();
  let fullText  = '';

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader  = anthropicBody.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

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
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } catch { /* ignore */ }
      }

      if (fullText) {
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: fullText,
          metadata: { model: MODEL },
        }).catch(console.error);
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

async function streamText(
  text: string,
  supabase: SupabaseClient,
  conversationId: string,
): Promise<Response> {
  await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: text,
    metadata: {},
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
