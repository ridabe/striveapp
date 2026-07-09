import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { OPENAI_EMBEDDING_MODEL } from '../models.ts';

const EMBEDDING_MODEL   = OPENAI_EMBEDDING_MODEL;
const MATCH_THRESHOLD   = 0.72;
const MATCH_COUNT       = 5;

export interface RetrievedExercise {
  exerciseId: string;
  content:    string;
  similarity: number;
}

export interface EmbeddingUsage {
  provider: 'openai';
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface RetrievalResult {
  exercises: RetrievedExercise[];
  usage: EmbeddingUsage;
}

// ── Ponto de entrada principal ───────────────────────────────────────────────

export async function retrieveRelevantExercises(
  supabase:  SupabaseClient,
  query:     string,
  tenantId:  string,
  threshold = MATCH_THRESHOLD,
  count     = MATCH_COUNT,
): Promise<RetrievalResult> {
  const embeddingResult = await generateEmbedding(query);

  const { data, error } = await supabase.rpc('match_exercises', {
    query_embedding: embeddingResult.embedding,
    p_tenant_id:     tenantId,
    match_threshold: threshold,
    match_count:     count,
  });

  if (error) {
    console.error('[rag-retrieval] match_exercises error:', error.message);
    return {
      exercises: [],
      usage: embeddingResult.usage,
    };
  }

  return {
    exercises: (data ?? []).map((row: any) => ({
      exerciseId: row.exercise_id,
      content:    row.content,
      similarity: row.similarity,
    })),
    usage: embeddingResult.usage,
  };
}

// ── Formata os documentos recuperados para inserir no system prompt ──────────

export function formatRetrievedContext(exercises: RetrievedExercise[]): string {
  if (!exercises.length) return '';

  const lines = [
    'EXERCICIOS RELEVANTES',
    'Use apenas estas referencias quando ajudarem tecnicamente.',
  ];

  for (const ex of exercises) {
    lines.push(`\n• ${ex.content}`);
  }

  return lines.join('\n');
}

// ── OpenAI Embeddings ────────────────────────────────────────────────────────

/**
 * Gera embedding no OpenAI e devolve tambem o consumo de tokens da chamada.
 */
async function generateEmbedding(text: string): Promise<{
  embedding: number[];
  usage: EmbeddingUsage;
}> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')!}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embedding error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    embedding: data.data[0].embedding,
    usage: {
      provider: 'openai',
      model: data.model ?? EMBEDDING_MODEL,
      inputTokens: data.usage?.prompt_tokens ?? data.usage?.total_tokens ?? 0,
      outputTokens: 0,
    },
  };
}
