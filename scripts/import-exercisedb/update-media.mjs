// Atualiza video_url nos exercícios exercisedb que estão sem GIF.
// Usa o endpoint /image?exerciseId=&resolution= que devolve o binário direto.
// Resumível: pula quem já tem video_url preenchido.
//
// Rodar:
//   node --env-file=scripts/import-exercisedb/.env scripts/import-exercisedb/update-media.mjs
//
// Variáveis extras (opcionais):
//   RESOLUTION      — largura do GIF em px (default: 180)
//   MAX_STORAGE_BYTES — limite de bytes desta sessão (default: 800MB)

import { createClient } from '@supabase/supabase-js';

const {
  RAPIDAPI_KEY,
  RAPIDAPI_HOST = 'exercisedb.p.rapidapi.com',
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

const BUCKET            = process.env.BUCKET            || 'exercise-videos';
const RESOLUTION        = process.env.RESOLUTION        || '180';
const REQUEST_DELAY_MS  = parseInt(process.env.REQUEST_DELAY_MS  || '400',  10);
const MAX_API_CALLS     = parseInt(process.env.MAX_API_CALLS     || '9999', 10);
const MAX_SESSION_BYTES = parseInt(
  process.env.MAX_STORAGE_BYTES || String(800 * 1024 * 1024), 10,
);
const MAX_GIF_BYTES = 10 * 1024 * 1024; // pula GIFs > 10 MB (arquivo anormal)

function requireEnv(name, value) {
  if (!value) { console.error(`❌ Falta: ${name}`); process.exit(1); }
}
requireEnv('RAPIDAPI_KEY',             RAPIDAPI_KEY);
requireEnv('SUPABASE_URL',             SUPABASE_URL);
requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let apiCalls    = 0;
let bytesUploaded = 0;

// Busca o binário do GIF direto via /image; retorna Buffer | null | 'STORAGE_LIMIT'
async function fetchGif(exerciseId) {
  if (apiCalls >= MAX_API_CALLS) {
    throw new Error(`LIMITE_API: atingido MAX_API_CALLS=${MAX_API_CALLS}`);
  }
  if (bytesUploaded >= MAX_SESSION_BYTES) return 'STORAGE_LIMIT';

  const url = `https://${RAPIDAPI_HOST}/image?exerciseId=${encodeURIComponent(exerciseId)}&resolution=${RESOLUTION}`;

  for (let attempt = 1; attempt <= 4; attempt++) {
    apiCalls++;
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key':  RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
        'Content-Type':    'application/json',
      },
    });

    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > MAX_GIF_BYTES) {
        console.warn(`   ↳ GIF muito grande (${(buf.byteLength / 1024 / 1024).toFixed(1)}MB), pulando.`);
        return null;
      }
      if (bytesUploaded + buf.byteLength > MAX_SESSION_BYTES) return 'STORAGE_LIMIT';
      return buf;
    }

    if (res.status === 429) {
      const wait = 2000 * attempt;
      console.warn(`⚠️  429 rate limit. Aguardando ${wait}ms...`);
      await sleep(wait);
      continue;
    }

    const body = await res.text().catch(() => '');
    console.warn(`   ↳ HTTP ${res.status}: ${body.slice(0, 120)}`);
    return null; // não tenta de novo em 4xx fora do 429
  }

  console.warn(`   ↳ Falha após retries`);
  return null;
}

async function uploadAndUpdate(id, external_id, gifBuf) {
  const path = `exercises/global/${external_id}.gif`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, gifBuf, {
    contentType: 'image/gif',
    upsert: true,
  });

  if (upErr) {
    if (/quota|storage limit|insufficient/i.test(upErr.message)) {
      console.warn(`⚠️  Quota Supabase Storage: ${upErr.message}`);
      return 'STORAGE_LIMIT';
    }
    throw new Error(`Upload falhou: ${upErr.message}`);
  }

  bytesUploaded += gifBuf.byteLength;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { error: dbErr } = await supabase
    .from('exercises')
    .update({ video_url: data.publicUrl, video_path: path })
    .eq('id', id);

  if (dbErr) throw new Error(`DB update falhou: ${dbErr.message}`);
  return data.publicUrl;
}

async function main() {
  console.log('🎬  Atualização de mídia — ExerciseDB /image endpoint');
  console.log(`   resolução: ${RESOLUTION}px | limite sessão: ${(MAX_SESSION_BYTES / 1024 / 1024).toFixed(0)}MB | delay: ${REQUEST_DELAY_MS}ms`);

  const { data: rows, error } = await supabase
    .from('exercises')
    .select('id, external_id, name')
    .eq('source', 'exercisedb')
    .is('video_url', null)
    .order('created_at', { ascending: true });

  if (error) { console.error('❌ Erro ao consultar DB:', error.message); process.exit(1); }
  if (!rows.length) { console.log('✅ Nenhum exercício sem GIF. Nada a fazer.'); return; }

  console.log(`   exercícios sem GIF: ${rows.length}\n`);

  let ok = 0, fail = 0, skipped = 0;
  let storageLimitHit = false;

  for (let i = 0; i < rows.length; i++) {
    const { id, external_id, name } = rows[i];
    const tag = `[${i + 1}/${rows.length}] ${external_id}`;

    if (storageLimitHit) { skipped++; continue; }

    try {
      const gifBuf = await fetchGif(external_id);
      await sleep(REQUEST_DELAY_MS);

      if (gifBuf === 'STORAGE_LIMIT') {
        storageLimitHit = true;
        skipped++;
        console.warn(`⏸️  ${tag} — limite de storage atingido. Restantes serão pulados.`);
        continue;
      }

      if (!gifBuf) { fail++; continue; }

      const result = await uploadAndUpdate(id, external_id, gifBuf);

      if (result === 'STORAGE_LIMIT') {
        storageLimitHit = true;
        skipped++;
        continue;
      }

      const mb = (bytesUploaded / 1024 / 1024).toFixed(1);
      console.log(`✅ ${tag}  ${(gifBuf.byteLength / 1024).toFixed(0)}KB  [~${mb}MB total]`);
      ok++;
    } catch (e) {
      if (String(e.message).startsWith('LIMITE_API')) {
        console.warn(`\n⏸️  ${e.message}`);
        console.warn('   Rode novamente amanhã ou com outra chave. O script é resumível.');
        break;
      }
      fail++;
      console.warn(`❌ ${tag} → ${e.message}`);
    }
  }

  const mb = (bytesUploaded / 1024 / 1024).toFixed(1);
  console.log(`\n🏁  GIFs: ✅ ${ok} | ❌ falhas: ${fail} | ⏸️ pulados (storage): ${skipped}`);
  console.log(`    Storage usado nesta sessão: ~${mb}MB | chamadas API: ${apiCalls}`);
  if (storageLimitHit) {
    console.warn(`\n⚠️  Limite atingido. Rode novamente para continuar (script resumível).`);
  }
}

main().catch((e) => { console.error('💥 Erro fatal:', e); process.exit(1); });
