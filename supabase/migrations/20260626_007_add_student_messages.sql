
CREATE TABLE IF NOT EXISTS student_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES auth.users(id),
  title TEXT,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'general', -- load_suggestion, motivation, general, etc.
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_student_messages_student ON student_messages(student_id);
CREATE INDEX idx_student_messages_tenant ON student_messages(tenant_id);

ALTER TABLE student_messages ENABLE ROW LEVEL SECURITY;

-- Personal can send messages to their tenant's students
CREATE POLICY "personal_send_messages" ON student_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'personal'
  );

-- Personal can view their tenant's messages
CREATE POLICY "personal_view_messages" ON student_messages
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'personal'
  );

-- Student can see their own messages
CREATE POLICY "student_view_messages" ON student_messages
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- Allow updating read status
CREATE POLICY "student_mark_read" ON student_messages
  FOR UPDATE
  TO authenticated
  USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  )
  WITH CHECK (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- Service role has full access
CREATE POLICY "service_role_all" ON student_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE student_messages;
