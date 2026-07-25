// Relatório de Evolução — lado do PERSONAL, no app.
//
// Porte do que o web faz em src/lib/evolution-report-data.ts +
// src/actions/relatorio-evolucao.ts. A agregação em si continua no motor
// compartilhado (evolutionReport.ts, cópia idêntica à do web), então os números
// batem exatamente com os do computador.
//
// ─────────────────────────────────────────────────────────────────────────────
// LIMITAÇÃO CONHECIDA: relatório gerado AQUI sai com o texto determinístico, não
// com o texto do Max. O app não pode chamar a Anthropic porque a chave iria no
// bundle — mesma razão do Radar. O texto base é específico (cita treinos,
// recordes, variação real) e o personal edita antes de publicar de qualquer
// forma. Os relatórios do dia 1º, gerados pelo cron no servidor, continuam
// vindo com o texto do Max.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '@/lib/supabase'
import {
  buildReportMetrics,
  fallbackNarrative,
  previousMonthPeriod,
  type AssessmentRow,
  type ExerciseAggRow,
  type ProgressRow,
  type ReadinessRow,
  type ReportMetrics,
  type SessionRow,
  type SetRow,
} from '@/lib/evolutionReport'

export type ReportRow = {
  id: string
  student_id: string
  period_start: string
  period_end: string
  status: 'draft' | 'published' | 'archived'
  metrics: ReportMetrics
  ai_headline: string | null
  ai_narrative: string | null
  final_headline: string | null
  final_narrative: string | null
  edited_by_personal: boolean
  published_at: string | null
  viewed_by_student_at: string | null
  students?: { id: string; full_name: string } | { id: string; full_name: string }[] | null
}

export type StudentOption = { id: string; full_name: string }

export function studentNameOf(r: ReportRow): string {
  const s = Array.isArray(r.students) ? r.students[0] : r.students
  return s?.full_name ?? 'Aluno'
}

function endOfDay(date: string): string {
  return `${date}T23:59:59.999Z`
}

function previousPeriodOf(periodStart: string): { start: string; end: string } {
  const [year, month] = periodStart.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 2, 1))
  const end = new Date(Date.UTC(year, month - 1, 0))
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

// ─── Leitura ──────────────────────────────────────────────────────────────────

export async function loadReports(tenantId: string): Promise<ReportRow[]> {
  const { data } = await supabase
    .from('evolution_reports')
    .select('id, student_id, period_start, period_end, status, metrics, ai_headline, ai_narrative, final_headline, final_narrative, edited_by_personal, published_at, viewed_by_student_at, students ( id, full_name )')
    .eq('tenant_id', tenantId)
    .order('period_start', { ascending: false })
    .limit(100)

  return (data ?? []) as unknown as ReportRow[]
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

// ─── Coleta ───────────────────────────────────────────────────────────────────
// Mesmas janelas do web: 30 dias para o presente, 30-60 para a linha de base.

async function loadSessions(studentId: string, from: string, to: string): Promise<SessionRow[]> {
  const { data } = await supabase
    .from('workout_sessions')
    .select('id, started_at, finished_at, duration_seconds')
    .eq('student_id', studentId)
    .gte('started_at', from)
    .lte('started_at', endOfDay(to))

  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    durationSeconds: r.duration_seconds,
  }))
}

async function loadSetLogs(studentId: string, from: string, to: string): Promise<SetRow[]> {
  const { data } = await supabase
    .from('workout_set_logs')
    .select('exercise_id, load_used_kg, reps_done, rpe, created_at, exercises ( name ), workout_sessions!inner ( student_id )')
    .eq('workout_sessions.student_id', studentId)
    .gte('created_at', from)
    .lte('created_at', endOfDay(to))

  return ((data ?? []) as any[]).map((r) => {
    const ex = Array.isArray(r.exercises) ? r.exercises[0] : r.exercises
    return {
      exerciseId: r.exercise_id,
      exerciseName: ex?.name ?? 'Exercício',
      loadKg: r.load_used_kg == null ? null : Number(r.load_used_kg),
      repsDone: r.reps_done,
      rpe: r.rpe == null ? null : Number(r.rpe),
      createdAt: r.created_at,
    }
  })
}

async function loadExerciseAggs(studentId: string, from: string, to: string): Promise<ExerciseAggRow[]> {
  const { data } = await supabase
    .from('workout_session_exercises')
    .select('exercise_id, load_used, sets_done, reps_done, created_at, exercises ( name ), workout_sessions!inner ( student_id )')
    .eq('workout_sessions.student_id', studentId)
    .gte('created_at', from)
    .lte('created_at', endOfDay(to))

  return ((data ?? []) as any[]).map((r) => {
    const ex = Array.isArray(r.exercises) ? r.exercises[0] : r.exercises
    return {
      exerciseId: r.exercise_id,
      exerciseName: ex?.name ?? 'Exercício',
      loadUsed: r.load_used,
      setsDone: r.sets_done,
      repsDone: r.reps_done,
      createdAt: r.created_at,
    }
  })
}

/**
 * Melhor carga por exercício ANTES do período — define o que é recorde.
 * Lê as DUAS fontes: sem o agregado, todo aluno antigo "bateria recorde" no
 * primeiro relatório, porque o log por série só existe desde o Treino Adaptativo.
 */
async function loadHistoricalBests(studentId: string, before: string): Promise<Record<string, number>> {
  const best: Record<string, number> = {}
  const consider = (id: string, kg: number | null) => {
    if (kg == null || !Number.isFinite(kg) || kg <= 0) return
    if (best[id] == null || kg > best[id]) best[id] = kg
  }

  const { data: sets } = await supabase
    .from('workout_set_logs')
    .select('exercise_id, load_used_kg, workout_sessions!inner ( student_id )')
    .eq('workout_sessions.student_id', studentId)
    .lt('created_at', before)

  for (const row of (sets ?? []) as any[]) {
    consider(row.exercise_id, row.load_used_kg == null ? null : Number(row.load_used_kg))
  }

  const { data: aggs } = await supabase
    .from('workout_session_exercises')
    .select('exercise_id, load_used, workout_sessions!inner ( student_id )')
    .eq('workout_sessions.student_id', studentId)
    .lt('created_at', before)

  for (const row of (aggs ?? []) as any[]) {
    const m = String(row.load_used ?? '').trim().toLowerCase().replace(',', '.').match(/(\d+(?:\.\d+)?)/)
    consider(row.exercise_id, m ? Number(m[1]) : null)
  }

  return best
}

export async function collectReportData(
  studentId: string,
  periodStart: string,
  periodEnd: string,
): Promise<ReportMetrics> {
  const prev = previousPeriodOf(periodStart)

  const [
    sessions, setLogs, exerciseAggs,
    prevSessions, prevSetLogs, prevAggs,
    assessmentsResult, progressResult, readinessResult, historicalBestKg,
  ] = await Promise.all([
    loadSessions(studentId, periodStart, periodEnd),
    loadSetLogs(studentId, periodStart, periodEnd),
    loadExerciseAggs(studentId, periodStart, periodEnd),
    loadSessions(studentId, prev.start, prev.end),
    loadSetLogs(studentId, prev.start, prev.end),
    loadExerciseAggs(studentId, prev.start, prev.end),
    supabase.from('physical_assessments')
      .select('assessed_at, weight, body_fat, waist, chest, hip, arm, thigh')
      .eq('student_id', studentId).gte('assessed_at', periodStart).lte('assessed_at', periodEnd),
    supabase.from('student_progress')
      .select('recorded_at, weight, photo_urls')
      .eq('student_id', studentId).gte('recorded_at', periodStart).lte('recorded_at', endOfDay(periodEnd)),
    supabase.from('readiness_checkins')
      .select('checked_in_at, readiness_score')
      .eq('student_id', studentId).gte('checked_in_at', periodStart).lte('checked_in_at', endOfDay(periodEnd)),
    loadHistoricalBests(studentId, periodStart),
  ])

  const assessments: AssessmentRow[] = ((assessmentsResult.data ?? []) as any[]).map((r) => ({
    assessedAt: r.assessed_at,
    weight: r.weight == null ? null : Number(r.weight),
    bodyFat: r.body_fat == null ? null : Number(r.body_fat),
    waist: r.waist == null ? null : Number(r.waist),
    chest: r.chest == null ? null : Number(r.chest),
    hip: r.hip == null ? null : Number(r.hip),
    arm: r.arm == null ? null : Number(r.arm),
    thigh: r.thigh == null ? null : Number(r.thigh),
  }))

  const progress: ProgressRow[] = ((progressResult.data ?? []) as any[]).map((r) => ({
    recordedAt: r.recorded_at,
    weight: r.weight == null ? null : Number(r.weight),
    photoUrls: r.photo_urls ?? null,
  }))

  const readiness: ReadinessRow[] = ((readinessResult.data ?? []) as any[]).map((r) => ({
    checkedInAt: r.checked_in_at,
    readinessScore: r.readiness_score,
  }))

  return buildReportMetrics({
    periodStart,
    periodEnd,
    current: { sessions, setLogs, exerciseAggs, assessments, progress, readiness },
    previous: { sessions: prevSessions, setLogs: prevSetLogs, exerciseAggs: prevAggs },
    historicalBestKg,
  })
}

// ─── Geração ──────────────────────────────────────────────────────────────────

export function defaultPeriod() {
  return previousMonthPeriod()
}

/** Últimos 6 meses fechados, para o seletor de período. */
export function recentPeriods(): { start: string; end: string; label: string }[] {
  const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  const now = new Date()
  const out: { start: string; end: string; label: string }[] = []
  for (let i = 1; i <= 6; i++) {
    const s = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const e = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0))
    out.push({
      start: s.toISOString().slice(0, 10),
      end: e.toISOString().slice(0, 10),
      label: `${MONTHS[s.getUTCMonth()]} de ${s.getUTCFullYear()}`,
    })
  }
  return out
}

export async function generateReport(params: {
  tenantId: string
  studentId: string
  studentName: string
  periodStart: string
  periodEnd: string
}): Promise<{ reportId?: string; error?: string; skipped?: string }> {
  // NUNCA sobrescrever relatório já publicado.
  //
  // O upsert grava `status: 'draft'`, e a RLS do aluno só deixa ler
  // 'published' — regerar um publicado fazia o aluno PERDER o acesso a algo
  // que ele já tinha recebido. Verificado no banco.
  const { data: existing } = await supabase
    .from('evolution_reports')
    .select('id, status')
    .eq('student_id', params.studentId)
    .eq('period_start', params.periodStart)
    .maybeSingle()

  if ((existing as { status: string } | null)?.status === 'published') {
    return {
      reportId: (existing as { id: string }).id,
      skipped: 'Este mês já foi publicado para o aluno. Arquive o relatório antes de gerar de novo.',
    }
  }

  let metrics: ReportMetrics
  try {
    metrics = await collectReportData(params.studentId, params.periodStart, params.periodEnd)
  } catch (e: any) {
    return { error: e?.message ?? 'Falha ao coletar os dados do período' }
  }

  const fallback = fallbackNarrative(metrics, params.studentName.split(' ')[0])

  // upsert funciona aqui: o indice unico (student_id, period_start) NAO e
  // parcial, entao o Postgres infere o ON CONFLICT normalmente. Regerar o
  // mesmo mes atualiza a mesma linha.
  const { data, error } = await supabase
    .from('evolution_reports')
    .upsert(
      {
        tenant_id: params.tenantId,
        student_id: params.studentId,
        period_start: params.periodStart,
        period_end: params.periodEnd,
        status: 'draft',
        metrics: metrics as any,
        ai_headline: fallback.headline,
        ai_narrative: fallback.narrative,
        generation_source: 'manual',
        generation_error: null,
      } as any,
      { onConflict: 'student_id,period_start' },
    )
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { reportId: (data as { id: string }).id }
}

// ─── Publicação ───────────────────────────────────────────────────────────────

export async function publishReport(params: {
  tenantId: string
  reportId: string
  trainerId: string | null
  finalHeadline: string
  finalNarrative: string
  aiHeadline: string | null
  aiNarrative: string | null
}): Promise<{ error?: string }> {
  if (!params.finalNarrative.trim()) return { error: 'O texto não pode ficar vazio.' }

  const edited =
    params.aiHeadline !== params.finalHeadline || params.aiNarrative !== params.finalNarrative

  const { error } = await supabase
    .from('evolution_reports')
    .update({
      status: 'published',
      final_headline: params.finalHeadline.trim(),
      final_narrative: params.finalNarrative.trim(),
      edited_by_personal: edited,
      published_at: new Date().toISOString(),
      published_by: params.trainerId,
    } as any)
    .eq('id', params.reportId)
    .eq('tenant_id', params.tenantId)

  if (error) return { error: error.message }
  return {}
}

export async function archiveReport(tenantId: string, reportId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('evolution_reports')
    .update({ status: 'archived' } as any)
    .eq('id', reportId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  return {}
}
