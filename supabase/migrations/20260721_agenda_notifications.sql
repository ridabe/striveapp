-- ============================================================
-- Notificações de agendamento (agenda_events):
--   1) Aluno solicita horário (origin=student, status=pending_confirmation)
--      → notifica o personal via trainer_notifications (tabela já existe).
--   2) Personal confirma/recusa a solicitação do aluno
--      → notifica o aluno via student_notifications (tabela nova).
-- Segue o mesmo padrão de 20260704_trainer_notifications.sql: trigger em
-- banco cobre todos os canais (mobile e web) sem duplicar lógica no client.
-- ============================================================

-- ── Tabela de notificações do aluno ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_notifications_student ON student_notifications(student_id);

ALTER TABLE student_notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, DELETE ON TABLE student_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE student_notifications TO service_role;

DROP POLICY IF EXISTS "student_view_own_notifications" ON student_notifications;
CREATE POLICY "student_view_own_notifications" ON student_notifications
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "student_delete_own_notifications" ON student_notifications;
CREATE POLICY "student_delete_own_notifications" ON student_notifications
  FOR DELETE
  TO authenticated
  USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "service_role_all_student_notifications" ON student_notifications;
CREATE POLICY "service_role_all_student_notifications" ON student_notifications
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
      AND tablename = 'student_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE student_notifications;
  END IF;
END $$;

-- ── Trigger: aluno solicitou agendamento → notifica o personal ─────────────
CREATE OR REPLACE FUNCTION trigger_notify_trainer_agenda_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_name text;
BEGIN
  IF NEW.origin IS DISTINCT FROM 'student' OR NEW.status IS DISTINCT FROM 'pending_confirmation' THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_student_name FROM students WHERE id = NEW.student_id;

  INSERT INTO trainer_notifications (tenant_id, student_id, type, title, message)
  VALUES (
    NEW.tenant_id,
    NEW.student_id,
    'agenda_pending',
    'Nova solicitação de agendamento',
    COALESCE(v_student_name, 'Um aluno') || ' solicitou "' || NEW.title || '" para ' ||
      to_char(NEW.event_date, 'DD/MM') || COALESCE(' às ' || to_char(NEW.start_time, 'HH24:MI'), '') || '.'
  );

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify-trainer-agenda-pending] Erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_trainer_agenda_pending ON agenda_events;

CREATE TRIGGER trg_notify_trainer_agenda_pending
  AFTER INSERT ON agenda_events
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notify_trainer_agenda_pending();

COMMENT ON FUNCTION trigger_notify_trainer_agenda_pending() IS
  'Cria notificação para o personal quando o aluno solicita um novo agendamento (origin=student, status=pending_confirmation).';

REVOKE EXECUTE ON FUNCTION trigger_notify_trainer_agenda_pending() FROM PUBLIC, anon, authenticated;

-- ── Trigger: personal confirmou/recusou → notifica o aluno ─────────────────
CREATE OR REPLACE FUNCTION trigger_notify_student_agenda_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só dispara na transição de "pendente" para confirmado/recusado, e só
  -- para solicitações que o aluno mesmo criou.
  IF NEW.origin IS DISTINCT FROM 'student'
     OR OLD.status IS DISTINCT FROM 'pending_confirmation'
     OR NEW.status NOT IN ('scheduled', 'rejected')
     OR NEW.student_id IS NULL
  THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'scheduled' THEN
    INSERT INTO student_notifications (tenant_id, student_id, type, title, message)
    VALUES (
      NEW.tenant_id,
      NEW.student_id,
      'agenda_confirmed',
      'Agendamento confirmado',
      'Seu personal confirmou "' || NEW.title || '" para ' ||
        to_char(NEW.event_date, 'DD/MM') || COALESCE(' às ' || to_char(NEW.start_time, 'HH24:MI'), '') || '.'
    );
  ELSE
    INSERT INTO student_notifications (tenant_id, student_id, type, title, message)
    VALUES (
      NEW.tenant_id,
      NEW.student_id,
      'agenda_rejected',
      'Agendamento recusado',
      'Seu personal recusou "' || NEW.title || '"' ||
        COALESCE(': ' || NEW.rejection_reason, '.')
    );
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify-student-agenda-response] Erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_agenda_response ON agenda_events;

CREATE TRIGGER trg_notify_student_agenda_response
  AFTER UPDATE ON agenda_events
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notify_student_agenda_response();

COMMENT ON FUNCTION trigger_notify_student_agenda_response() IS
  'Cria notificação para o aluno quando o personal confirma ou recusa uma solicitação de agendamento feita por ele.';

REVOKE EXECUTE ON FUNCTION trigger_notify_student_agenda_response() FROM PUBLIC, anon, authenticated;
