import { SupabaseClient }  from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic           from 'npm:@anthropic-ai/sdk';
import {
  retrieveRelevantExercises,
  formatRetrievedContext,
} from '../retrieval/rag-retrieval.ts';

const MODEL         = 'claude-sonnet-4-6';
const MAX_TOKENS    = 1024;
const HISTORY_LIMIT = 6; // últimas 6 trocas (user+assistant) = 12 mensagens

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
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

  // 1. Histórico da conversa (apenas mensagens user/assistant, não system)
  const { data: historyRows } = await supabase
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: true })
    .limit(HISTORY_LIMIT * 2); // *2 porque cada "troca" tem 2 mensagens

  // 2. RAG — recupera exercícios relevantes para a pergunta
  let ragContext = '';
  let ragUsed    = false;
  try {
    const retrieved = await retrieveRelevantExercises(supabase, message, tenantId);
    if (retrieved.length > 0) {
      ragContext = formatRetrievedContext(retrieved);
      ragUsed    = true;
    }
  } catch (err) {
    // RAG falhou — continua sem contexto adicional (degradação graciosa)
    console.error('[chat] RAG retrieval failed:', err);
  }

  // 3. System prompt final: persona + contexto do aluno + base de exercícios (se RAG encontrou algo)
  const fullSystemPrompt = ragContext
    ? `${systemPrompt}\n\n---\n\n${ragContext}`
    : systemPrompt;

  // 4. Array de mensagens para o Claude
  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...(historyRows ?? []).map((m: any) => ({
      role:    m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  // 5. Persiste mensagem do Personal antes de iniciar o stream
  await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role:            'user',
    content:         message,
    metadata:        { rag_used: ragUsed },
  });

  // 6. Stream da resposta
  const stream = anthropic.messages.stream({
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    system:     fullSystemPrompt,
    messages,
  });

  const encoder = new TextEncoder();
  let fullText  = '';

  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            fullText += event.delta.text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`),
            );
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();

        // 7. Persiste resposta do Max com metadados de uso
        const finalMsg = await stream.finalMessage();
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          role:            'assistant',
          content:         fullText,
          metadata: {
            tokens_input:  finalMsg.usage.input_tokens,
            tokens_output: finalMsg.usage.output_tokens,
            model:         MODEL,
            rag_used:      ragUsed,
          },
        });
      } catch (err) {
        controller.error(err);
      }
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
