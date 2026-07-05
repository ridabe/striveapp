-- Anamnese passa a pertencer à PESSOA (user_id), não ao vínculo com um tenant
-- específico — o que o aluno preenche pra um personal fica visível pros outros
-- que ele também tiver ativo/já teve. student_id/tenant_id continuam nas linhas
-- (preenchidos no save) só como informação de "sob qual vínculo foi salvo por
-- último" — não controlam mais acesso nem unicidade.

ALTER TABLE anamnese_responses ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

UPDATE anamnese_responses ar
SET user_id = s.user_id
FROM students s
WHERE ar.student_id = s.id AND ar.user_id IS NULL;

-- Defensivo: se alguma pessoa já tivesse mais de uma resposta (uma por tenant,
-- do modelo antigo), mantém a mais recente antes de criar a constraint única.
DELETE FROM anamnese_responses a USING anamnese_responses b
WHERE a.user_id IS NOT NULL AND a.user_id = b.user_id AND a.updated_at < b.updated_at;

ALTER TABLE anamnese_responses ADD CONSTRAINT anamnese_responses_user_id_key UNIQUE (user_id);

-- RLS: troca a policy única por tenant_id por duas policies baseadas em pessoa.
DROP POLICY IF EXISTS "anamnese_responses_all" ON anamnese_responses;

CREATE POLICY "anamnese_responses_self" ON anamnese_responses
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "anamnese_responses_personal" ON anamnese_responses
  FOR ALL
  TO authenticated
  USING (
    get_my_role() = 'personal'
    AND EXISTS (
      SELECT 1 FROM students s
      WHERE s.user_id = anamnese_responses.user_id
        AND s.tenant_id = get_my_tenant_id()
    )
  );

-- Trigger: agora que a resposta é uma só por pessoa, notifica TODOS os
-- personals onde o aluno está ativo no momento da finalização (antes só
-- notificava o tenant da própria linha, que hoje não corresponde mais a um
-- vínculo específico).
CREATE OR REPLACE FUNCTION trigger_notify_trainer_anamnese_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_rec  record;
BEGIN
  IF NEW.completed_at IS NULL OR (TG_OP = 'UPDATE' AND OLD.completed_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'student' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_rec IN
    SELECT s.tenant_id, s.id AS student_id, s.full_name
    FROM students s
    WHERE s.user_id = NEW.user_id AND s.status = 'active'
  LOOP
    INSERT INTO trainer_notifications (tenant_id, student_id, type, title, message)
    VALUES (
      v_rec.tenant_id,
      v_rec.student_id,
      'anamnese_completed',
      'Anamnese preenchida',
      COALESCE(v_rec.full_name, 'Um aluno') || ' preencheu a anamnese.'
    );
  END LOOP;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify-trainer-anamnese] Erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION trigger_notify_trainer_anamnese_completed() FROM PUBLIC, anon, authenticated;
