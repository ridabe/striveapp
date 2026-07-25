// Configuração dos guardrails do Treino Adaptativo — lado do personal, no app.
//
// Espelha o que as server actions fazem no web (src/actions/treino-adaptativo.ts).
// Aqui é acesso direto ao Supabase, com a RLS garantindo o isolamento por tenant:
// a policy de `adaptation_rules` só deixa personal/global_admin escrever, e só
// nos alunos que ele enxerga.
//
// A decisão de risco continua toda no motor compartilhado (adaptationEngine.ts,
// cópia idêntica à do web). Este arquivo é só transporte.

import { supabase } from '@/lib/supabase'
import type { AdaptationRule } from '@/lib/adaptationEngine'

const RULE_COLUMNS = `
  id, tenant_id, student_id, workout_plan_id, enabled,
  max_load_increase_pct, max_load_decrease_pct,
  min_readiness_for_increase, max_readiness_for_decrease,
  allow_volume_adjust, max_sets_added, max_sets_removed,
  allow_exercise_swap, locked_exercise_ids, default_target_rpe
`

/** Valores iniciais quando ainda não existe regra. Iguais aos do banco. */
export const DEFAULT_RULE = {
  enabled: false,
  max_load_increase_pct: 7.5,
  max_load_decrease_pct: 7.5,
  min_readiness_for_increase: 75,
  max_readiness_for_decrease: 40,
  allow_volume_adjust: true,
  max_sets_added: 1,
  max_sets_removed: 1,
  allow_exercise_swap: true,
  locked_exercise_ids: [] as string[],
  default_target_rpe: 8,
}

export type RuleRow = AdaptationRule & {
  students?: { id: string; full_name: string } | { id: string; full_name: string }[] | null
}

export type StudentOption = { id: string; full_name: string }
export type ExerciseOption = { id: string; name: string; muscle_group: string | null }

export function studentNameOf(rule: RuleRow): string | null {
  const s = Array.isArray(rule.students) ? rule.students[0] : rule.students
  return s?.full_name ?? null
}

// ─── Leitura ──────────────────────────────────────────────────────────────────

export async function loadRules(tenantId: string): Promise<RuleRow[]> {
  const { data } = await supabase
    .from('adaptation_rules')
    .select(`${RULE_COLUMNS}, students ( id, full_name )`)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  return (data ?? []) as unknown as RuleRow[]
}

export async function loadStudents(tenantId: string): Promise<StudentOption[]> {
  const { data } = await supabase
    .from('students')
    .select('id, full_name')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('full_name')

  return (data ?? []) as StudentOption[]
}

export async function loadExercises(tenantId: string): Promise<ExerciseOption[]> {
  const { data } = await supabase
    .from('exercises')
    .select('id, name, muscle_group')
    .eq('tenant_id', tenantId)
    .order('name')
    .limit(400)

  return (data ?? []) as ExerciseOption[]
}

// ─── Escrita ──────────────────────────────────────────────────────────────────

export type RuleForm = {
  id?: string
  studentId?: string | null
  enabled: boolean
  maxLoadIncreasePct: number
  maxLoadDecreasePct: number
  minReadinessForIncrease: number
  maxReadinessForDecrease: number
  allowVolumeAdjust: boolean
  maxSetsAdded: number
  maxSetsRemoved: number
  allowExerciseSwap: boolean
  lockedExerciseIds: string[]
  defaultTargetRpe: number
}

export function toForm(rule: RuleRow | null): RuleForm {
  if (!rule) {
    return {
      enabled: DEFAULT_RULE.enabled,
      maxLoadIncreasePct: DEFAULT_RULE.max_load_increase_pct,
      maxLoadDecreasePct: DEFAULT_RULE.max_load_decrease_pct,
      minReadinessForIncrease: DEFAULT_RULE.min_readiness_for_increase,
      maxReadinessForDecrease: DEFAULT_RULE.max_readiness_for_decrease,
      allowVolumeAdjust: DEFAULT_RULE.allow_volume_adjust,
      maxSetsAdded: DEFAULT_RULE.max_sets_added,
      maxSetsRemoved: DEFAULT_RULE.max_sets_removed,
      allowExerciseSwap: DEFAULT_RULE.allow_exercise_swap,
      lockedExerciseIds: [],
      defaultTargetRpe: DEFAULT_RULE.default_target_rpe,
    }
  }
  return {
    id: rule.id,
    studentId: rule.student_id,
    enabled: rule.enabled,
    maxLoadIncreasePct: Number(rule.max_load_increase_pct),
    maxLoadDecreasePct: Number(rule.max_load_decrease_pct),
    minReadinessForIncrease: rule.min_readiness_for_increase,
    maxReadinessForDecrease: rule.max_readiness_for_decrease,
    allowVolumeAdjust: rule.allow_volume_adjust,
    maxSetsAdded: rule.max_sets_added,
    maxSetsRemoved: rule.max_sets_removed,
    allowExerciseSwap: rule.allow_exercise_swap,
    lockedExerciseIds: rule.locked_exercise_ids ?? [],
    defaultTargetRpe: Number(rule.default_target_rpe),
  }
}

export async function saveRule(
  tenantId: string,
  form: RuleForm,
): Promise<{ error?: string }> {
  // O banco também barra isso (constraint adaptation_rules_decrease_below_increase),
  // mas falhar aqui devolve mensagem legível em vez de erro cru do Postgres.
  if (form.maxReadinessForDecrease >= form.minReadinessForIncrease) {
    return {
      error:
        'O limite para aliviar precisa ser menor que o limite para avançar — ' +
        'senão existe uma faixa que dispara os dois ao mesmo tempo.',
    }
  }

  const payload = {
    tenant_id: tenantId,
    student_id: form.studentId ?? null,
    workout_plan_id: null,
    enabled: form.enabled,
    max_load_increase_pct: form.maxLoadIncreasePct,
    max_load_decrease_pct: form.maxLoadDecreasePct,
    min_readiness_for_increase: form.minReadinessForIncrease,
    max_readiness_for_decrease: form.maxReadinessForDecrease,
    allow_volume_adjust: form.allowVolumeAdjust,
    max_sets_added: form.maxSetsAdded,
    max_sets_removed: form.maxSetsRemoved,
    allow_exercise_swap: form.allowExerciseSwap,
    locked_exercise_ids: form.lockedExerciseIds,
    default_target_rpe: form.defaultTargetRpe,
  }

  // Sem upsert: os índices únicos de adaptation_rules são PARCIAIS (escopo em
  // cascata com colunas nulas), e o Postgres não infere ON CONFLICT em índice
  // parcial. Mesmo motivo documentado em workout_set_logs.
  const { error } = form.id
    ? await supabase.from('adaptation_rules').update(payload as never)
        .eq('id', form.id).eq('tenant_id', tenantId)
    : await supabase.from('adaptation_rules').insert(payload as never)

  if (error) return { error: error.message }
  return {}
}

export async function deleteRule(tenantId: string, ruleId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('adaptation_rules')
    .delete()
    .eq('id', ruleId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  return {}
}

// ─── Digest ───────────────────────────────────────────────────────────────────

export type AdaptiveAlert = {
  studentId: string
  studentName: string
  kind: 'low_readiness_streak' | 'ready_to_progress' | 'load_too_heavy'
  message: string
}

/**
 * Versão enxuta do digest do web: só a prontidão em queda.
 *
 * O sinal de progressão por RPE exige agregar centenas de séries — pesado para
 * fazer no dispositivo. Fica no web, onde roda no servidor.
 */
export async function loadReadinessAlerts(tenantId: string, daysBack = 21): Promise<AdaptiveAlert[]> {
  const since = new Date(Date.now() - daysBack * 86_400_000).toISOString()

  const { data } = await supabase
    .from('readiness_checkins')
    .select('student_id, readiness_score, checked_in_at, students ( id, full_name )')
    .eq('tenant_id', tenantId)
    .gte('checked_in_at', since)
    .order('checked_in_at', { ascending: false })

  const byStudent = new Map<string, { name: string; scores: number[] }>()

  for (const row of (data ?? []) as any[]) {
    const student = Array.isArray(row.students) ? row.students[0] : row.students
    if (!student) continue
    const entry = byStudent.get(row.student_id) ?? { name: student.full_name, scores: [] }
    if (row.readiness_score !== null) entry.scores.push(row.readiness_score)
    byStudent.set(row.student_id, entry)
  }

  const alerts: AdaptiveAlert[] = []
  for (const [studentId, { name, scores }] of byStudent) {
    const lastThree = scores.slice(0, 3)
    // Três seguidos, não um dia ruim: oscilar é normal, tendência é sinal.
    if (lastThree.length === 3 && lastThree.every((s) => s < 40)) {
      alerts.push({
        studentId,
        studentName: name,
        kind: 'low_readiness_streak',
        message: `${name} está há 3 check-ins seguidos chegando mal. Vale conversar antes de insistir na carga.`,
      })
    }
  }

  return alerts
}
