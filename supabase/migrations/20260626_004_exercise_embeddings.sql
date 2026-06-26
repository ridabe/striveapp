CREATE TABLE exercise_embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  embedding   extensions.vector(1536) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exercise_id, tenant_id)
);

-- Índice HNSW para busca de similaridade eficiente
CREATE INDEX idx_exercise_embeddings_hnsw
  ON exercise_embeddings
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_exercise_embeddings_exercise ON exercise_embeddings(exercise_id);
CREATE INDEX idx_exercise_embeddings_tenant   ON exercise_embeddings(tenant_id);

ALTER TABLE exercise_embeddings ENABLE ROW LEVEL SECURITY;

-- Leitura para usuários autenticados (globais ou do próprio tenant)
CREATE POLICY "authenticated_read" ON exercise_embeddings
  FOR SELECT TO authenticated USING (
    tenant_id IS NULL
    OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "service_role_all" ON exercise_embeddings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
