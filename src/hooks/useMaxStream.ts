import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export type MaxFeature = 'chat' | 'generate_plan' | 'analyze_progress' | 'suggest_load' | 'motivation';

export interface MaxStreamParams {
  feature: MaxFeature;
  studentId: string;
  message?: string;
  conversationId?: string;
  periodDays?: number;
  exerciseId?: string;
}

export interface UseMaxStreamResult {
  text: string;
  isStreaming: boolean;
  error: string | null;
  conversationId: string | null;
  planId: string | null;
  trigger: (params: MaxStreamParams) => Promise<void>;
  reset: () => void;
}

export function useMaxStream(): UseMaxStreamResult {
  const [text, setText]                     = useState('');
  const [isStreaming, setIsStreaming]        = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [planId, setPlanId]                 = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const reset = useCallback(() => {
    setText('');
    setError(null);
    setPlanId(null);
  }, []);

  const trigger = useCallback(async (params: MaxStreamParams) => {
    xhrRef.current?.abort();

    setText('');
    setError(null);
    setPlanId(null);
    setIsStreaming(true);

    let accumulated = '';

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessão inválida. Faça login novamente.');

      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const url     = `${baseUrl}/functions/v1/ai-assistant`;

      const body = JSON.stringify({
        feature:         params.feature,
        student_id:      params.studentId,
        message:         params.message,
        conversation_id: params.conversationId ?? conversationId,
        period_days:     params.periodDays,
        exercise_id:     params.exerciseId,
      });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.responseType = 'text';
        xhr.timeout      = 120_000; // 2 min

        let lastIndex = 0;
        let buffer    = '';

        function processChunk() {
          const chunk = xhr.responseText.slice(lastIndex);
          lastIndex   = xhr.responseText.length;
          if (!chunk) return;

          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.error) {
                reject(new Error(parsed.error));
                return;
              }
              if (parsed.text) {
                accumulated += parsed.text;
                setText(accumulated);
              }
            } catch { /* chunk de SSE incompleto — ignora */ }
          }
        }

        xhr.onprogress = processChunk;

        xhr.onload = () => {
          processChunk(); // drena qualquer resto

          if (xhr.status >= 400) {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.error ?? `HTTP ${xhr.status}`));
            } catch {
              reject(new Error(`HTTP ${xhr.status}`));
            }
            return;
          }

          const convId = xhr.getResponseHeader('X-Conversation-Id');
          if (convId) setConversationId(convId);

          resolve();
        };

        xhr.onerror   = () => reject(new Error('Erro de conexão'));
        xhr.ontimeout = () => reject(new Error('Timeout — tente novamente'));
        xhr.onabort   = () => reject(Object.assign(new Error('AbortError'), { name: 'AbortError' }));

        xhr.send(body);
      });

      // Extrai plan_id do texto final (feature generate_plan)
      const match = accumulated.match(/plan_id:([a-f0-9-]{36})/);
      if (match) setPlanId(match[1]);

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message ?? 'Erro desconhecido');
      }
    } finally {
      setIsStreaming(false);
    }
  }, [conversationId]);

  return { text, isStreaming, error, conversationId, planId, trigger, reset };
}
