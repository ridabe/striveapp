CREATE TABLE ai_conversations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL CHECK (feature_type IN (
    'chat', 'generate_plan', 'analyze_progress', 'suggest_load', 'motivation'
  )),
  title        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_student ON ai_conversations(student_id, created_at DESC);
CREATE INDEX idx_ai_conversations_tenant  ON ai_conversations(tenant_id, created_at DESC);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- Aluno vê apenas suas próprias conversas
CREATE POLICY "student_own_conversations" ON ai_conversations
  FOR ALL USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

-- Personal vê conversas do seu tenant
CREATE POLICY "personal_tenant_conversations" ON ai_conversations
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'personal'
  );

-- Service role tem acesso total (para edge functions)
CREATE POLICY "service_role_all" ON ai_conversations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
