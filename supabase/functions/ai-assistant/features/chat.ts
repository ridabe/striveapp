import { SupabaseClient }  from 'https://esm.sh/@supabase/supabase-js@2';
import {
  retrieveRelevantExercises,
  formatRetrievedContext,
} from '../retrieval/rag-retrieval.ts';
import { recordAiUsage, type AiTrackingContext } from '../usage.ts';
import { ANTHROPIC_SMART_MODEL, OPENAI_EMBEDDING_MODEL } from '../models.ts';

const MODEL         = ANTHROPIC_SMART_MODEL;
const MAX_TOKENS    = 1024;
const HISTORY_LIMIT = 4;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const PLAN_CREATION_NOTE = `
CAPACIDADE FORA DESTE CHAT — CRIAÇÃO DE TREINO:
Você (Max) NÃO cria ou salva planos de treino durante esta conversa livre — essa capacidade
existe apenas através do botão "Criar Treino" nas ações rápidas da tela do aluno.
Se o Personal pedir para você criar, montar ou gerar um treino aqui no chat, NÃO tente fazer
isso em texto nem finja que criou. Em vez disso, explique de forma direta e curta:
1. Toque em "Criar Treino" nas ações rápidas.
2. Um formulário rápido vai perguntar o tipo de treino, o objetivo e a quantidade de dias
   (com sugestões prontas) — ou toque em "deixar o Max decidir" para gerar automaticamente.
3. O plano gerado fica inativo até você revisar, atribuir aos alunos e ativar.
Seja breve nessa explicação — 3 a 4 linhas no máximo — e não repita isso se o assunto já não for
sobre criar um treino novo.
`.trim();

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
  tracking:       AiTrackingContext,
): Promise<Response> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!;
  const startedAt = Date.now();

  try {
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
      if (retrieved.exercises.length > 0) {
        ragContext = formatRetrievedContext(retrieved.exercises);
        ragUsed    = true;
      }

      await recordAiUsage(supabase, tracking, {
        provider: 'openai',
        usageKind: 'embedding',
        model: retrieved.usage.model,
        status: 'success',
        inputTokens: retrieved.usage.inputTokens,
        outputTokens: 0,
        latencyMs: Date.now() - startedAt,
        metadata: {
          rag_results: retrieved.exercises.length,
          rag_used: ragUsed,
        },
      });
    } catch (err) {
      const ragError = err instanceof Error ? err.message : 'Falha na busca vetorial';
      await recordAiUsage(supabase, tracking, {
        provider: 'openai',
        usageKind: 'embedding',
        model: OPENAI_EMBEDDING_MODEL,
        status: 'error',
        latencyMs: Date.now() - startedAt,
        errorMessage: ragError,
      });
      console.error('[chat] RAG retrieval failed:', err);
    }

    const fullSystemPrompt = [systemPrompt, ragContext, PLAN_CREATION_NOTE]
      .filter(Boolean)
      .join('\n\n---\n\n');

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
      metadata: {
        rag_used: ragUsed,
        client_platform: tracking.clientPlatform,
      },
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

    return buildSseResponse(anthropicResp.body!, supabase, conversationId, ragUsed, tracking, startedAt);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro ao processar chat';
    await recordAiUsage(supabase, tracking, {
      provider: 'anthropic',
      usageKind: 'completion',
      model: MODEL,
      status: 'error',
      latencyMs: Date.now() - startedAt,
      errorMessage,
    });
    throw err;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSseResponse(
  anthropicBody:  ReadableStream<Uint8Array>,
  supabase:       SupabaseClient,
  conversationId: string,
  ragUsed:        boolean,
  tracking:       AiTrackingContext,
  startedAt:      number,
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
      }

      if (fullText) {
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          role:            'assistant',
          content:         fullText,
          metadata: {
            provider: 'anthropic',
            model: modelName,
            rag_used: ragUsed,
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
          metadata: { rag_used: ragUsed },
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
          metadata: { rag_used: ragUsed },
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
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'X-Conversation-Id': conversationId,
    },
  });
}
