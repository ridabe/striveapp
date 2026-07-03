-- RPC para o app mobile marcar um item de desafio como concluído.
-- Espelha o comportamento já existente na web (server action markItemComplete,
-- ver docs/MODULO_DESAFIOS.md §3.6 e §13.5): grava o progresso e, se o item for
-- do tipo "exercise" com a gamificação ativa, registra o evento de pontos —
-- tudo no servidor, sem nenhuma lógica de pontuação no cliente.
-- Não existe "desmarcar" (regra 3.6, farm de pontos) e a constraint UNIQUE de
-- challenge_item_progress já impede duplicidade; aqui tratamos isso como
-- idempotente (repetir a chamada não duplica progresso nem soma pontos de novo).

CREATE OR REPLACE FUNCTION public.mark_challenge_item_complete(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_item            record;
  v_participant_id  uuid;
  v_already         boolean;
  v_settings        record;
  v_points          integer := 0;
BEGIN
  SELECT cdi.id, cdi.tenant_id, cdi.item_type, cd.challenge_id, cd.status AS day_status
  INTO v_item
  FROM challenge_day_items cdi
  JOIN challenge_days cd ON cd.id = cdi.challenge_day_id
  WHERE cdi.id = p_item_id;

  IF v_item.id IS NULL THEN
    RETURN jsonb_build_object('error', 'item_not_found');
  END IF;

  IF v_item.day_status <> 'published' THEN
    RETURN jsonb_build_object('error', 'day_not_published');
  END IF;

  SELECT cp.id INTO v_participant_id
  FROM challenge_participants cp
  JOIN students s ON s.id = cp.student_id
  WHERE cp.challenge_id = v_item.challenge_id AND s.user_id = auth.uid();

  IF v_participant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_a_participant');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM challenge_item_progress
    WHERE challenge_day_item_id = p_item_id AND participant_id = v_participant_id
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object('already_completed', true);
  END IF;

  INSERT INTO challenge_item_progress (tenant_id, challenge_day_item_id, participant_id)
  VALUES (v_item.tenant_id, p_item_id, v_participant_id)
  ON CONFLICT (challenge_day_item_id, participant_id) DO NOTHING;

  IF v_item.item_type = 'exercise' THEN
    SELECT * INTO v_settings FROM gamification_settings LIMIT 1;
    IF v_settings IS NOT NULL AND v_settings.is_active THEN
      v_points := v_settings.pts_exercise_completed;
      INSERT INTO gamification_events (student_id, event_type, points, metadata, event_month, event_year)
      SELECT s.id, 'challenge_task_completed', v_points,
             jsonb_build_object('item_id', p_item_id, 'challenge_id', v_item.challenge_id),
             EXTRACT(MONTH FROM NOW())::smallint, EXTRACT(YEAR FROM NOW())::smallint
      FROM challenge_participants cp
      JOIN students s ON s.id = cp.student_id
      WHERE cp.id = v_participant_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('completed', true, 'points_awarded', v_points);
END;
$function$;
