// ============================================================================
// Importação ExerciseDB -> Supabase (tabela public.exercises)
//
// Fluxo:
//   1. Busca exercícios na ExerciseDB (RapidAPI), paginando até IMPORT_LIMIT.
//   2. Mapeia EN -> PT (grupo muscular, carga, contagem, músculos secundários).
//   3. (Opcional) traduz nome + instruções via DeepL ou Google Translate.
//   4. Baixa o GIF e envia para o bucket Storage `exercise-videos`.
//   5. Faz upsert em public.exercises como is_global = true,
//      usando (source, external_id) como chave única (idempotente / resumível).
//
// Rodar:
//   node --env-file=.env scripts/import-exercisedb/import.mjs
//
// Requisitos: Node 18+ (usa fetch nativo) e @supabase/supabase-js (já no projeto).
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import {
  mapMuscleGroup, mapLoadType, mapCountType, translateMuscleList, correctTerms,
} from './maps.mjs';

// ---- Configuração via variáveis de ambiente --------------------------------
const {
  RAPIDAPI_KEY,
  RAPIDAPI_HOST = 'exercisedb.p.rapidapi.com',
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  // Tradução (opcional) — escolha UM:
  DEEPL_API_KEY,
  GOOGLE_TRANSLATE_API_KEY,
} = process.env;

const BUCKET = process.env.BUCKET || 'exercise-videos';
const IMPORT_LIMIT = parseInt(process.env.IMPORT_LIMIT || '500', 10);
const PAGE_SIZE = parseInt(process.env.PAGE_SIZE || '50', 10);
// Limite de chamadas METRADAS na API. Use um valor baixo (ex.: 10) ao testar
// com a chave gratuita; deixe alto (ex.: 9999) com a chave paga.
const MAX_API_CALLS = parseInt(process.env.MAX_API_CALLS || '9999', 10);
const REQUEST_DELAY_MS = parseInt(process.env.REQUEST_DELAY_MS || '350', 10);
const DRY_RUN = process.env.DRY_RUN === '1';
const SKIP_MEDIA = process.env.SKIP_MEDIA === '1';

// ---- Validação -------------------------------------------------------------
function requireEnv(name, value) {
  if (!value) { console.error(`❌ Falta a variável de ambiente: ${name}`); process.exit(1); }
}
requireEnv('RAPIDAPI_KEY', RAPIDAPI_KEY);
requireEnv('SUPABASE_URL', SUPABASE_URL);
requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Contador de chamadas metradas + helper de fetch com retry -------------
let apiCalls = 0;

async function apiFetch(path) {
  if (apiCalls >= MAX_API_CALLS) {
    throw new Error(`LIMITE_API: atingido MAX_API_CALLS=${MAX_API_CALLS} (proteção da chave de teste).`);
  }
  const url = `https://${RAPIDAPI_HOST}${path}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    apiCalls++;
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    });
    if (res.ok) return res.json();
    if (res.status === 429) {
      const wait = 2000 * attempt;
      console.warn(`⚠️  429 (rate limit). Aguardando ${wait}ms e tentando de novo...`);
      await sleep(wait);
      continue;
    }
    // 403/401 em chave gratuita normalmente = cota diária esgotada
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status} em ${path}: ${body.slice(0, 200)}`);
  }
  throw new Error(`Falha após retries em ${path}`);
}

// ---- Tradução (opcional) ---------------------------------------------------
async function translateBatch(texts) {
  // Sem provedor configurado -> passa o texto original (inglês).
  if (!DEEPL_API_KEY && !GOOGLE_TRANSLATE_API_KEY) return texts;

  try {
    if (DEEPL_API_KEY) {
      const isFree = DEEPL_API_KEY.endsWith(':fx');
      const endpoint = isFree
        ? 'https://api-free.deepl.com/v2/translate'
        : 'https://api.deepl.com/v2/translate';
      const params = new URLSearchParams();
      params.append('target_lang', 'PT-BR');
      texts.forEach((t) => params.append('text', t));
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });
      if (!res.ok) throw new Error(`DeepL ${res.status}`);
      const json = await res.json();
      return json.translations.map((t) => t.text);
    }

    // Google Translate v2
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: texts, target: 'pt', format: 'text' }),
      },
    );
    if (!res.ok) throw new Error(`Google Translate ${res.status}`);
    const json = await res.json();
    return json.data.translations.map((t) => t.translatedText);
  } catch (e) {
    console.warn(`⚠️  Tradução falhou (${e.message}). Mantendo texto original.`);
    return texts;
  }
}

// ---- Download do GIF + upload no Storage -----------------------------------
async function uploadGif(exercise) {
  const gifUrl = exercise.gifUrl;
  if (!gifUrl || SKIP_MEDIA) return { video_url: null, video_path: null };

  // 1ª tentativa: GET direto (CDN). Se exigir credencial, tenta com headers.
  let res = await fetch(gifUrl);
  if ((res.status === 401 || res.status === 403)) {
    res = await fetch(gifUrl, {
      headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': RAPIDAPI_HOST },
    });
  }
  if (!res.ok) {
    console.warn(`   ↳ GIF indisponível (${res.status}) para ${exercise.id}`);
    return { video_url: null, video_path: null };
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const path = `exercises/global/${exercise.id}.gif`;

  if (DRY_RUN) return { video_url: `(dry-run) ${path}`, video_path: path };

  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: 'image/gif',
    upsert: true,
  });
  if (error) {
    console.warn(`   ↳ upload do GIF falhou: ${error.message}`);
    return { video_url: null, video_path: null };
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { video_url: data.publicUrl, video_path: path };
}

// ---- Busca a lista de exercícios paginando ---------------------------------
async function fetchExercises(limit) {
  const all = [];
  let offset = 0;
  while (all.length < limit) {
    const pageSize = Math.min(PAGE_SIZE, limit - all.length);
    const page = await apiFetch(`/exercises?limit=${pageSize}&offset=${offset}`);
    if (!Array.isArray(page) || page.length === 0) break;
    all.push(...page);
    offset += page.length;
    console.log(`   ↳ recebidos ${all.length}/${limit} (chamadas API: ${apiCalls})`);
    if (page.length < pageSize) break; // chegou ao fim do catálogo
    await sleep(REQUEST_DELAY_MS);
  }
  return all.slice(0, limit);
}

// ---- Transforma 1 exercício da API no registro do nosso schema -------------
function buildBaseRecord(ex, nameTranslated, instructionsTranslated) {
  return {
    external_id: String(ex.id),
    source: 'exercisedb',
    name: nameTranslated,
    muscle_group: mapMuscleGroup(ex.target, ex.bodyPart),
    secondary_muscles: translateMuscleList(ex.secondaryMuscles),
    load_type: mapLoadType(ex.equipment),
    count_type: mapCountType(ex.bodyPart),
    instructions: instructionsTranslated,
    is_global: true,
    tenant_id: null,
    default_sets: 3,
    default_reps: mapCountType(ex.bodyPart) === 'time' ? null : '10-12',
    default_duration_secs: mapCountType(ex.bodyPart) === 'time' ? 30 : null,
  };
}

// ---- Main ------------------------------------------------------------------
async function main() {
  console.log('🏋️  Importação ExerciseDB -> Supabase');
  console.log(`   limite=${IMPORT_LIMIT} | page=${PAGE_SIZE} | maxApiCalls=${MAX_API_CALLS} | dryRun=${DRY_RUN} | skipMedia=${SKIP_MEDIA}`);
  console.log(`   tradução: ${DEEPL_API_KEY ? 'DeepL' : GOOGLE_TRANSLATE_API_KEY ? 'Google' : 'NENHUMA (texto em inglês)'}`);

  // Já importados (resumível): pula external_ids existentes
  const { data: existingRows, error: existErr } = await supabase
    .from('exercises')
    .select('external_id')
    .eq('source', 'exercisedb');
  if (existErr) { console.error('❌ Erro lendo existentes:', existErr.message); process.exit(1); }
  const existing = new Set((existingRows || []).map((r) => r.external_id));
  console.log(`   já importados anteriormente: ${existing.size}`);

  // 1) Buscar lista
  let list;
  try {
    list = await fetchExercises(IMPORT_LIMIT);
  } catch (e) {
    if (String(e.message).startsWith('LIMITE_API')) {
      console.warn(`\n⏸️  ${e.message}\n   (esperado ao testar com a chave gratuita — rode de novo amanhã ou com a chave paga; o script é resumível.)`);
      return;
    }
    throw e;
  }
  console.log(`📦 ${list.length} exercícios recebidos da API.\n`);

  const pending = list.filter((ex) => !existing.has(String(ex.id)));
  console.log(`➡️  ${pending.length} novos para importar (${list.length - pending.length} já existiam).\n`);

  let ok = 0, fail = 0;
  for (let i = 0; i < pending.length; i++) {
    const ex = pending[i];
    const tag = `[${i + 1}/${pending.length}] ${ex.name}`;
    try {
      // 2/3) tradução (nome + instruções juntos para economizar chamadas)
      const instrText = Array.isArray(ex.instructions) ? ex.instructions.join('\n') : (ex.instructions || '');
      let [nameT, instrT] = await translateBatch([ex.name || '', instrText]);
      // Rede de segurança: corrige jargão de musculação após a tradução
      nameT = correctTerms(nameT);
      instrT = correctTerms(instrT);

      // 4) mídia
      const media = await uploadGif(ex);

      // 5) montar + upsert
      const record = {
        ...buildBaseRecord(ex, nameT || ex.name, instrT || instrText || null),
        ...media,
      };

      if (DRY_RUN) {
        console.log(`🧪 ${tag} -> ${record.muscle_group} | ${record.load_type} | gif:${media.video_path ? 'ok' : '—'}`);
        ok++;
        continue;
      }

      const { error } = await supabase
        .from('exercises')
        .upsert(record, { onConflict: 'source,external_id' });
      if (error) throw new Error(error.message);

      ok++;
      console.log(`✅ ${tag}`);
    } catch (e) {
      fail++;
      console.warn(`❌ ${tag} -> ${e.message}`);
    }
  }

  console.log(`\n🏁 Concluído. Sucesso: ${ok} | Falhas: ${fail} | Chamadas API metradas: ${apiCalls}`);
}

main().catch((e) => { console.error('💥 Erro fatal:', e); process.exit(1); });
