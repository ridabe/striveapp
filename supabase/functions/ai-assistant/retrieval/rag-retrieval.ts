import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EMBEDDING_MODEL   = 'text-embedding-3-small';
const MATCH_THRESHOLD   = 0.72;
const MATCH_COUNT       = 5;

export interface RetrievedExercise {
  exerciseId: string;
  content:    string;
  similarity: number;
}

// ── Ponto de entrada principal ───────────────────────────────────────────────

export async function retrieveRelevantExercises(
  supabase:  SupabaseClient,
  query:     string,
  tenantId:  string,
  threshold = MATCH_THRESHOLD,
  count     = MATCH_COUNT,
): Promise<RetrievedExercise[]> {
  const embedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc('match_exercises', {
    query_embedding: embedding,
    p_tenant_id:     tenantId,
    match_threshold: threshold,
    match_count:     count,
  });

  if (error) {
    console.error('[rag-retrieval] match_exercises error:', error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    exerciseId: row.exercise_id,
    content:    row.content,
    similarity: row.similarity,
  }));
}

// ── Formata os documentos recuperados para inserir no system prompt ──────────

export function formatRetrievedContext(exercises: RetrievedExercise[]): string {
  if (!exercises.length) return '';

  const lines = [
    'BASE DE CONHECIMENTO — EXERCÍCIOS RELEVANTES',
    '(Use estas informações para responder perguntas sobre técnica, músculos trabalhados e substituições.)',
  ];

  for (const ex of exercises) {
    lines.push(`\n• ${ex.content}`);
  }

  return lines.join('\n');
}

// ── OpenAI Embeddings ────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[]> {
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
  return data.data[0].embedding;
}
