CREATE TABLE ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id, created_at ASC);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- Acesso via conversa (herda mesma lógica)
CREATE POLICY "messages_via_student_conversation" ON ai_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM ai_conversations
      WHERE student_id IN (
        SELECT id FROM students WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "messages_via_personal_conversation" ON ai_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM ai_conversations
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "service_role_all" ON ai_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);
