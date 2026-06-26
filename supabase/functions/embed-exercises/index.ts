import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE      = 20; // OpenAI aceita até 2048 inputs por chamada; 20 é seguro com textos longos

interface RequestBody {
  exercise_ids?: string[];
  tenant_id?:    string;
  force?:        boolean;
}

function getJwtRole(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Aceita service_role JWT ou global_admin autenticado
  const authHeader = req.headers.get('Authorization') ?? '';
  const token      = authHeader.replace('Bearer ', '').trim();

  if (!token) return errorResponse('Missing authorization header', 401);

  const isServiceRole = getJwtRole(token) === 'service_role';

  if (!isServiceRole) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return errorResponse('Unauthorized', 401);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'global_admin') {
      return errorResponse('Apenas global_admin pode executar esta função', 403);
    }
  }

  // Parse body
  let body: RequestBody = {};
  try { body = await req.json(); } catch { /* body vazio ok */ }

  const { exercise_ids, tenant_id, force = false } = body;

  // 1. Busca exercícios
  let query = supabase
    .from('exercises')
    .select('id, name, muscle_group, secondary_muscles, load_type, count_type, instructions, is_global, tenant_id');

  if (exercise_ids?.length) {
    query = query.in('id', exercise_ids);
  } else if (tenant_id) {
    query = query.or(`is_global.eq.true,tenant_id.eq.${tenant_id}`);
  } else {
    query = query.or('is_global.eq.true,tenant_id.is.null');
  }

  const { data: exercises, error: fetchErr } = await query;
  if (fetchErr) return errorResponse(fetchErr.message, 500);
  if (!exercises?.length) {
    return jsonResponse({ message: 'Nenhum exercício encontrado', embedded: 0 });
  }

  // 2. Se não force, filtra os que já têm embedding
  let toEmbed = exercises as any[];
  if (!force) {
    const { data: existing } = await supabase
      .from('exercise_embeddings')
      .select('exercise_id, tenant_id')
      .in('exercise_id', exercises.map((e: any) => e.id));

    const existingSet = new Set(
      (existing ?? []).map((e: any) => `${e.exercise_id}:${e.tenant_id ?? 'null'}`),
    );

    toEmbed = exercises.filter((e: any) => {
      const eTenant = e.is_global ? null : (e.tenant_id ?? null);
      return !existingSet.has(`${e.id}:${eTenant ?? 'null'}`);
    });
  }

  if (!toEmbed.length) {
    return jsonResponse({ message: 'Todos os exercícios já possuem embeddings', embedded: 0 });
  }

  // 3. Processa em lotes
  let embedded = 0;
  let errors   = 0;

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEmbeddingText);

    try {
      const embeddings = await generateEmbeddings(texts);

      const rows = batch.map((e: any, idx: number) => ({
        exercise_id: e.id,
        tenant_id:   e.is_global ? null : (e.tenant_id ?? null),
        content:     texts[idx],
        embedding:   embeddings[idx],
        updated_at:  new Date().toISOString(),
      }));

      const { error: upsertErr } = await supabase
        .from('exercise_embeddings')
        .upsert(rows, { onConflict: 'exercise_id,tenant_id' });

      if (upsertErr) {
        console.error('[embed-exercises] upsert error:', upsertErr.message);
        errors += batch.length;
      } else {
        embedded += batch.length;
      }
    } catch (err) {
      console.error('[embed-exercises] batch error:', err);
      errors += batch.length;
    }
  }

  return jsonResponse({
    total:    toEmbed.length,
    embedded,
    errors,
    message:  errors > 0
      ? `${embedded} embeddings gerados, ${errors} erros`
      : `${embedded} embeddings gerados com sucesso`,
  });
});

// ── Texto embeddado por exercício ────────────────────────────────────────────

function buildEmbeddingText(e: any): string {
  const parts: string[] = [e.name];

  if (e.muscle_group)       parts.push(`Grupo muscular: ${e.muscle_group}`);
  if (e.secondary_muscles)  parts.push(`Músculos secundários: ${e.secondary_muscles}`);
  if (e.load_type)          parts.push(`Tipo de carga: ${e.load_type}`);
  if (e.count_type)         parts.push(`Tipo de contagem: ${e.count_type}`);
  if (e.instructions)       parts.push(`Execução: ${e.instructions}`);

  return parts.join('. ');
}

// ── OpenAI Embeddings ────────────────────────────────────────────────────────

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')!}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  // API retorna data ordenado pelo índice de input
  return data.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((item: any) => item.embedding);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}
