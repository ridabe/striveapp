// Camada de dados do módulo Treino Adaptativo no app.
//
// Equivale às server actions do web (src/actions/treino-adaptativo.ts), mas
// falando direto com o Supabase — no Expo não existe servidor no meio.
//
// DIFERENÇA ESTRUTURAL IMPORTANTE ENTRE APP E WEB:
// no web a linha de `workout_sessions` nasce quando o aluno toca em "iniciar",
// então dá para gravar cada série no instante em que ela acontece. No app a
// sessão só é criada no SALVAR, no fim do treino. Logo, os registros de série
// e as adaptações precisam ser acumulados em memória durante o treino e
// descarregados de uma vez em `flushAdaptiveSession`, depois que o
// `session_id` existe. Toda a decisão continua no motor compartilhado
// (adaptationEngine.ts, cópia idêntica à do web) — aqui é só transporte.

import { supabase } from '@/lib/supabase'
import {
  calcReadinessScore,
  planSession,
  parseLoadKg,
  resolveRule,
  type AdaptationRule,
  type PlannedAdaptation,
  type PrescribedItem,
  type SessionPlan,
} from '@/lib/adaptationEngine'

const RULE_COLUMNS = `
  id, tenant_id, student_id, workout_plan_id, enabled,
  max_load_increase_pct, max_load_decrease_pct,
  min_readiness_for_increase, max_readiness_for_decrease,
  allow_volume_adjust, max_sets_added, max_sets_removed,
  allow_exercise_swap, locked_exercise_ids, default_target_rpe
`

/** Série registrada em memória, aguardando o session_id para ser persistida. */
export type BufferedSetLog = {
  workoutItemId: string | null
  extraWorkoutItemId: string | null
  exerciseId: string
  setNumber: number
  prescribedLoad: string | null
  loadUsed: string | null
  prescribedReps: string | null
  repsDone: number | null
  rpe: number | null
  targetRpe: number | null
  wasAdapted: boolean
  restTakenSeconds: number | null
}

/**
 * Módulo ligado para o tenant E regra habilitada alcançando este aluno/plano.
 * Falhando qualquer uma das duas, retorna null e a execução do treino no app
 * segue exatamente como antes do módulo existir.
 */
export async function loadAdaptiveRule(
  tenantId: string,
  studentId: string,
  workoutPlanId: string | null,
): Promise<AdaptationRule | null> {
  const { data: tenantModule } = await supabase
    .from('tenant_modules')
    .select('enabled, system_modules!inner(slug, available, status)')
    .eq('tenant_id', tenantId)
    .eq('enabled', true)
    .eq('system_modules.slug', 'treino-adaptativo')
    .maybeSingle()

  if (!tenantModule) return null

  const { data } = await supabase
    .from('adaptation_rules')
    .select(RULE_COLUMNS)
    .eq('tenant_id', tenantId)

  if (!data || data.length === 0) return null
  return resolveRule(data as unknown as AdaptationRule[], studentId, workoutPlanId)
}

/** Exercícios prescritos da rotina, no formato que o motor consome. */
export async function loadPrescribedItems(routineId: string): Promise<PrescribedItem[]> {
  const { data } = await supabase
    .from('workout_items')
    .select('id, exercise_id, sets, reps, load, display_order, exercises ( id, name, muscle_group )')
    .eq('routine_id', routineId)
    .order('display_order', { ascending: true })

  return ((data ?? []) as any[]).map((row) => {
    const exercise = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises
    return {
      itemId: row.id,
      exerciseId: row.exercise_id,
      exerciseName: exercise?.name ?? 'Exercício',
      muscleGroup: exercise?.muscle_group ?? null,
      sets: row.sets,
      reps: row.reps,
      load: row.load,
    } as PrescribedItem
  })
}

export type ReadinessSubmission = {
  tenantId: string
  studentId: string
  workoutPlanId: string | null
  workoutRoutineId: string
  sleepQuality: number
  muscleSoreness: number
  energyLevel: number
  painAreas: string[]
}

/**
 * Grava o check-in (sem session_id ainda) e devolve o plano da sessão.
 * O vínculo com a sessão acontece depois, em flushAdaptiveSession.
 */
export async function saveReadinessCheckin(
  input: ReadinessSubmission,
  rule: AdaptationRule,
): Promise<{ checkinId: string | null; plan: SessionPlan; error?: string }> {
  const items = await loadPrescribedItems(input.workoutRoutineId)

  const plan = planSession({
    readiness: {
      sleepQuality: input.sleepQuality,
      muscleSoreness: input.muscleSoreness,
      energyLevel: input.energyLevel,
      painAreas: input.painAreas,
    },
    rule,
    items,
  })

  const { data, error } = await supabase
    .from('readiness_checkins')
    .insert({
      tenant_id: input.tenantId,
      student_id: input.studentId,
      workout_plan_id: input.workoutPlanId,
      workout_routine_id: input.workoutRoutineId,
      sleep_quality: input.sleepQuality,
      muscle_soreness: input.muscleSoreness,
      energy_level: input.energyLevel,
      pain_areas: input.painAreas,
      source: 'manual',
    } as any)
    .select('id')
    .single()

  // Falha de rede não pode impedir o treino: o plano já foi calculado
  // localmente pelo motor e o aluno segue treinando com ele. Perde-se só o
  // histórico do check-in, que é menos grave que travar alguém na academia.
  if (error) {
    return { checkinId: null, plan, error: error.message }
  }

  return { checkinId: data.id, plan }
}

/** Mesma fórmula da coluna gerada no banco — exposta para a UI mostrar na hora. */
export { calcReadinessScore }

/**
 * Descarrega tudo que foi acumulado durante o treino, agora que a sessão existe.
 * Best-effort por natureza: se falhar, o treino já está salvo e o que se perde
 * é a telemetria da autorregulação, não o registro do treino.
 */
export async function flushAdaptiveSession(params: {
  sessionId: string
  tenantId: string
  studentId: string
  checkinId: string | null
  readinessScore: number | null
  ruleId: string | null
  adaptations: PlannedAdaptation[]
  setLogs: BufferedSetLog[]
}): Promise<{ error?: string }> {
  const { sessionId, tenantId, studentId, checkinId, readinessScore, ruleId } = params

  try {
    if (checkinId) {
      await supabase
        .from('readiness_checkins')
        .update({ session_id: sessionId } as any)
        .eq('id', checkinId)
    }

    const effective = params.adaptations.filter((a) => a.adaptationType !== 'no_change')
    if (effective.length > 0) {
      const { error } = await supabase.from('session_adaptations').insert(
        effective.map((a) => ({
          tenant_id: tenantId,
          session_id: sessionId,
          student_id: studentId,
          workout_item_id: a.itemId,
          exercise_id: a.exerciseId,
          adaptation_type: a.adaptationType,
          scope: a.scope,
          value_before: a.valueBefore,
          value_after: a.valueAfter,
          delta_pct: a.deltaPct,
          trigger_source: a.triggerSource,
          readiness_score: readinessScore,
          rule_id: ruleId,
          reason: a.reason,
          applied: true,
        })) as any,
      )
      if (error) return { error: error.message }
    }

    if (params.setLogs.length > 0) {
      const { error } = await supabase.from('workout_set_logs').insert(
        params.setLogs.map((log) => ({
          tenant_id: tenantId,
          session_id: sessionId,
          workout_item_id: log.workoutItemId,
          extra_workout_item_id: log.extraWorkoutItemId,
          exercise_id: log.exerciseId,
          set_number: log.setNumber,
          prescribed_load: log.prescribedLoad,
          prescribed_load_kg: parseLoadKg(log.prescribedLoad),
          load_used: log.loadUsed,
          load_used_kg: parseLoadKg(log.loadUsed),
          prescribed_reps: log.prescribedReps,
          reps_done: log.repsDone,
          rpe: log.rpe,
          target_rpe: log.targetRpe,
          was_adapted: log.wasAdapted,
          rest_taken_seconds: log.restTakenSeconds,
        })) as any,
      )
      if (error) return { error: error.message }
    }

    return {}
  } catch (e: any) {
    return { error: e?.message ?? 'Falha ao salvar dados de autorregulação' }
  }
}
