CREATE OR REPLACE FUNCTION match_exercises(
  query_embedding extensions.vector(1536),
  p_tenant_id     UUID,
  match_threshold FLOAT DEFAULT 0.75,
  match_count     INT   DEFAULT 5
)
RETURNS TABLE (
  exercise_id UUID,
  content     TEXT,
  similarity  FLOAT
)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT
    ee.exercise_id,
    ee.content,
    1 - (ee.embedding <=> query_embedding) AS similarity
  FROM exercise_embeddings ee
  WHERE
    (ee.tenant_id = p_tenant_id OR ee.tenant_id IS NULL)
    AND 1 - (ee.embedding <=> query_embedding) > match_threshold
  ORDER BY ee.embedding <=> query_embedding
  LIMIT match_count;
$$;
