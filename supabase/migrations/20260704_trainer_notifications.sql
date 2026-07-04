-- ============================================================
-- Notificações para o personal — aluno finalizou a anamnese
-- Dispara via trigger em anamnese_responses, cobrindo TODOS os
-- canais de finalização sem duplicar lógica em cada app:
--   • Finalização pela web (app Next.js do aluno)
--   • Finalização pelo app mobile (direto no Supabase)
-- Não dispara quando é o próprio personal quem finaliza pelo
-- dashboard (server action saveAnamneseResponse).
-- ============================================================

CREATE TABLE IF NOT EXISTS trainer_notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'anamnese_completed',
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trainer_notifications_tenant ON trainer_notifications(tenant_id);

ALTER TABLE trainer_notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, DELETE ON TABLE trainer_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE trainer_notifications TO service_role;

DROP POLICY IF EXISTS "personal_view_notifications" ON trainer_notifications;
CREATE POLICY "personal_view_notifications" ON trainer_notifications
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'personal'
  );

DROP POLICY IF EXISTS "personal_delete_notifications" ON trainer_notifications;
CREATE POLICY "personal_delete_notifications" ON trainer_notifications
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'personal'
  );

DROP POLICY IF EXISTS "service_role_all" ON trainer_notifications;
CREATE POLICY "service_role_all" ON trainer_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'trainer_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE trainer_notifications;
  END IF;
END $$;

-- ── Função do trigger ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_notify_trainer_anamnese_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role         text;
  v_student_name text;
BEGIN
  -- Só dispara na transição para "completa" (não em rascunhos nem em updates já completos)
  IF NEW.completed_at IS NULL OR (TG_OP = 'UPDATE' AND OLD.completed_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  -- Só notifica quando quem salvou é o próprio aluno (evita auto-notificar o personal)
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'student' THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_student_name FROM students WHERE id = NEW.student_id;

  INSERT INTO trainer_notifications (tenant_id, student_id, type, title, message)
  VALUES (
    NEW.tenant_id,
    NEW.student_id,
    'anamnese_completed',
    'Anamnese preenchida',
    COALESCE(v_student_name, 'Um aluno') || ' preencheu a anamnese.'
  );

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify-trainer-anamnese] Erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_trainer_anamnese_completed ON anamnese_responses;

CREATE TRIGGER trg_notify_trainer_anamnese_completed
  AFTER INSERT OR UPDATE ON anamnese_responses
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notify_trainer_anamnese_completed();

COMMENT ON FUNCTION trigger_notify_trainer_anamnese_completed() IS
  'Cria notificação para o personal quando o aluno finaliza a anamnese (completed_at preenchido pela primeira vez).';

-- Função é chamada apenas pelo trigger — não deve ser exposta como RPC público.
REVOKE EXECUTE ON FUNCTION trigger_notify_trainer_anamnese_completed() FROM PUBLIC, anon, authenticated;
