# Importação ExerciseDB → Supabase

Script de uso único (resumível) para popular `public.exercises` com o catálogo da ExerciseDB
como exercícios **globais** (`is_global = true`). Depois da importação, web e app consomem
somente do Supabase — a API não é mais chamada.

## 1. Migration (rodar uma vez)

Adiciona `external_id` + `source` e o índice único para upsert idempotente.
Já foi aplicada via Supabase. O SQL está em `migration.sql` (caso precise reaplicar).

## 2. Configurar

```bash
cp scripts/import-exercisedb/.env.example scripts/import-exercisedb/.env
# edite o .env: RAPIDAPI_KEY, SUPABASE_SERVICE_ROLE_KEY, etc.
```

> A `SUPABASE_SERVICE_ROLE_KEY` está em Supabase → Project Settings → API.
> Nunca commitar o `.env`.

## 3. Rodar

Teste seco (não grava nada, não baixa GIF):
```bash
DRY_RUN=1 SKIP_MEDIA=1 node --env-file=scripts/import-exercisedb/.env scripts/import-exercisedb/import.mjs
```

Importação real (500 exercícios):
```bash
node --env-file=scripts/import-exercisedb/.env scripts/import-exercisedb/import.mjs
```

## Variáveis principais

| Variável | Função |
|---|---|
| `IMPORT_LIMIT` | quantos exercícios importar (default 500) |
| `MAX_API_CALLS` | trava de chamadas metradas — **10 ao testar c/ chave grátis**, alto na chave paga |
| `DEEPL_API_KEY` / `GOOGLE_TRANSLATE_API_KEY` | tradução opcional p/ PT-BR (sem isso, salva em inglês) |
| `DRY_RUN=1` | simula sem gravar |
| `SKIP_MEDIA=1` | não baixa GIFs |

## Notas

- **Resumível:** registros já importados (mesmo `source`+`external_id`) são pulados/atualizados.
  Se a chave grátis estourar a cota, é só rodar de novo depois.
- **Mídia:** GIFs vão para o bucket `exercise-videos` em `exercises/global/<id>.gif`
  e a URL pública é gravada em `video_url` (+ `video_path`).
- **Mapeamento EN→PT** (grupo muscular, carga, músculos) está em `maps.mjs` — ajuste lá se precisar.
