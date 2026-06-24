-- Colunas de rastreio para importação idempotente da ExerciseDB.
-- Seguro e aditivo (não altera dados existentes).

alter table public.exercises
  add column if not exists external_id text,
  add column if not exists source text not null default 'manual';

-- Garante que cada exercício importado tenha chave única por fonte,
-- permitindo upsert (onConflict: source,external_id) e reimport sem duplicar.
create unique index if not exists exercises_source_external_id_uniq
  on public.exercises (source, external_id)
  where external_id is not null;
