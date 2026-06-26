import { SupabaseClient }  from 'https://esm.sh/@supabase/supabase-js@2';
import type { StudentContext } from '../retrieval/student-context.ts';
import { fetchWorkoutLoadHistory, formatLoadHistoryForPrompt } from '../retrieval/workout-context.ts';

const MODEL         = 'claude-sonnet-4-6';
const MAX_TOKENS    = 1024;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

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
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

  const loadHistory = await fetchWorkoutLoadHistory(supabase, studentId);
  const loadText    = formatLoadHistoryForPrompt(loadHistory);
  const userPrompt  = buildAnalyzePrompt(periodDays, loadText);

  await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: userPrompt,
    metadata: { period_days: periodDays },
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

  return buildSseResponse(anthropicResp.body!, supabase, conversationId);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

      // Persiste resposta antes de fechar o stream
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
