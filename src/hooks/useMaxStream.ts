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
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setText('');
    setError(null);
    setPlanId(null);
  }, []);

  const trigger = useCallback(async (params: MaxStreamParams) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setText('');
    setError(null);
    setPlanId(null);
    setIsStreaming(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessão inválida. Faça login novamente.');

      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const response = await fetch(`${baseUrl}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feature:         params.feature,
          student_id:      params.studentId,
          message:         params.message,
          conversation_id: params.conversationId ?? conversationId,
          period_days:     params.periodDays,
          exercise_id:     params.exerciseId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errBody.error ?? `HTTP ${response.status}`);
      }

      const convId = response.headers.get('X-Conversation-Id');
      if (convId) setConversationId(convId);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Stream não suportado neste ambiente.');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break outer;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              accumulated += parsed.text;
              setText(accumulated);
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.startsWith('JSON')) {
              throw parseErr;
            }
          }
        }
      }

      // Extract plan_id if present in the final text (generate_plan feature)
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
