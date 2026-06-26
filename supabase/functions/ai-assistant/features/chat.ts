import { SupabaseClient }  from 'https://esm.sh/@supabase/supabase-js@2';
import {
  retrieveRelevantExercises,
  formatRetrievedContext,
} from '../retrieval/rag-retrieval.ts';

const MODEL         = 'claude-sonnet-4-6';
const MAX_TOKENS    = 1024;
const HISTORY_LIMIT = 6;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Handler principal ────────────────────────────────────────────────────────

export async function handleChat(
  supabase:       SupabaseClient,
  systemPrompt:   string,
  message:        string,
  conversationId: string,
  tenantId:       string,
): Promise<Response> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

  // 1. Histórico da conversa
  const { data: historyRows } = await supabase
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: true })
    .limit(HISTORY_LIMIT * 2);

  // 2. RAG — exercícios relevantes para a pergunta
  let ragContext = '';
  let ragUsed    = false;
  try {
    const retrieved = await retrieveRelevantExercises(supabase, message, tenantId);
    if (retrieved.length > 0) {
      ragContext = formatRetrievedContext(retrieved);
      ragUsed    = true;
    }
  } catch (err) {
    console.error('[chat] RAG retrieval failed:', err);
  }

  const fullSystemPrompt = ragContext
    ? `${systemPrompt}\n\n---\n\n${ragContext}`
    : systemPrompt;

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...(historyRows ?? []).map((m: any) => ({
      role:    m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  // 3. Persiste mensagem do Personal antes de iniciar o stream
  await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role:            'user',
    content:         message,
    metadata:        { rag_used: ragUsed },
  });

  // 4. Raw fetch para streaming nativo Deno (evita EventEmitter do SDK)
  const anthropicResp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     fullSystemPrompt,
      messages,
      stream:     true,
    }),
  });

  if (!anthropicResp.ok) {
    const errText = await anthropicResp.text();
    throw new Error(`Anthropic API ${anthropicResp.status}: ${errText}`);
  }

  return buildSseResponse(anthropicResp.body!, supabase, conversationId, ragUsed);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSseResponse(
  anthropicBody:  ReadableStream<Uint8Array>,
  supabase:       SupabaseClient,
  conversationId: string,
  ragUsed:        boolean,
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
          role:            'assistant',
          content:         fullText,
          metadata:        { model: MODEL, rag_used: ragUsed },
        }).catch(console.error);
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
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'X-Conversation-Id': conversationId,
    },
  });
}
