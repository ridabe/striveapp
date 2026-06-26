import { SupabaseClient }  from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic           from 'npm:@anthropic-ai/sdk';
import { fetchWorkoutLoadHistory, formatLoadHistoryForPrompt } from '../retrieval/workout-context.ts';

const MODEL      = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

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
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

  // Busca histórico de cargas (exercício específico ou todos do plano ativo)
  const loadHistory = await fetchWorkoutLoadHistory(supabase, studentId, exerciseId);

  if (!loadHistory.length) {
    return streamText(
      'Não encontrei histórico de execuções com carga registrada para este aluno. ' +
      'Peça ao aluno que registre as cargas durante os treinos para que eu possa sugerir progressões precisas.',
      supabase, conversationId,
    );
  }

  const loadText    = formatLoadHistoryForPrompt(loadHistory);
  const userPrompt  = buildSuggestLoadPrompt(loadText, !!exerciseId);

  await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: userPrompt,
    metadata: { exercise_id: exerciseId ?? null },
  });

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  return sseStream(stream, supabase, conversationId);
}

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
