// ─────────────────────────────────────────────────────────────────────────────
// Agregação do Relatório de Evolução.
//
// SEM IMPORTS, mesma regra do adaptation-engine: este arquivo é copiado para o
// app (strivePersonalApp/src/lib/evolutionReport.ts) para que as duas
// plataformas leiam exatamente os mesmos números do mesmo `metrics` jsonb.
// Se precisar de dado do banco, receba por parâmetro.
//
// Divisão: aqui mora a MATEMÁTICA (o que conta como PR, como se compara mês a
// mês, o que é destaque). O I/O fica nas actions. Assim dá para testar a regra
// de negócio sem banco — e a regra é o que erra.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Entradas cruas ───────────────────────────────────────────────────────────

export type SessionRow = {
  id: string
  startedAt: string
  finishedAt: string | null
  durationSeconds: number | null
}

export type SetRow = {
  exerciseId: string
  exerciseName: string
  loadKg: number | null
  repsDone: number | null
  rpe: number | null
  createdAt: string
}

/** Registro agregado por exercício (workout_session_exercises) — fallback quando não há log por série. */
export type ExerciseAggRow = {
  exerciseId: string
  exerciseName: string
  loadUsed: string | null
  setsDone: number | null
  repsDone: string | null
  createdAt: string
}

export type AssessmentRow = {
  assessedAt: string
  weight: number | null
  bodyFat: number | null
  waist: number | null
  chest: number | null
  hip: number | null
  arm: number | null
  thigh: number | null
}

export type ProgressRow = {
  recordedAt: string
  weight: number | null
  photoUrls: string[] | null
}

export type ReadinessRow = {
  checkedInAt: string
  readinessScore: number | null
}

export type ReportInput = {
  periodStart: string // YYYY-MM-DD
  periodEnd: string   // YYYY-MM-DD
  current: {
    sessions: SessionRow[]
    setLogs: SetRow[]
    exerciseAggs: ExerciseAggRow[]
    assessments: AssessmentRow[]
    progress: ProgressRow[]
    readiness: ReadinessRow[]
  }
  previous: {
    sessions: SessionRow[]
    setLogs: SetRow[]
    exerciseAggs: ExerciseAggRow[]
  }
  /** Recordes de carga anteriores ao período, por exercício. Base para detectar PR. */
  historicalBestKg: Record<string, number>
}

// ─── Saída ────────────────────────────────────────────────────────────────────

export type PersonalRecord = {
  exerciseId: string
  exerciseName: string
  loadKg: number
  previousBestKg: number | null
  achievedAt: string
}

export type ExerciseProgress = {
  exerciseId: string
  exerciseName: string
  firstLoadKg: number
  lastLoadKg: number
  deltaPct: number
}

export type ReportMetrics = {
  periodStart: string
  periodEnd: string

  workouts: {
    completed: number
    previousCompleted: number
    deltaPct: number | null
    totalMinutes: number
    avgMinutes: number
    longestStreakDays: number
    activeDays: number
  }

  volume: {
    /** Soma de carga × repetições, em kg. Null quando não há log por série no período. */
    totalKg: number | null
    previousTotalKg: number | null
    deltaPct: number | null
  }

  records: PersonalRecord[]
  topProgress: ExerciseProgress[]

  body: {
    weightStart: number | null
    weightEnd: number | null
    weightDelta: number | null
    bodyFatStart: number | null
    bodyFatEnd: number | null
    bodyFatDelta: number | null
    waistDelta: number | null
    hasPhotos: boolean
  }

  readiness: {
    avgScore: number | null
    checkins: number
  }

  /** Frases curtas e factuais. A narrativa do Max é construída a partir delas. */
  highlights: string[]
  /** O ponto fraco do mês, quando existe um claro. Null se não houver. */
  attentionPoint: string | null
  /** true quando não há dado suficiente para um relatório honesto. */
  isEmpty: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return round1(((current - previous) / previous) * 100)
}

/**
 * Parse de carga em texto livre — mesma semântica do adaptation-engine.
 * Duplicado de propósito: os dois arquivos são "sem imports" por contrato, e
 * acoplá-los faria uma mudança no motor de treino mexer no relatório.
 */
function parseLoadKg(load: string | null | undefined): number | null {
  if (!load) return null
  const normalized = load.trim().toLowerCase().replace(',', '.')
  const match = normalized.match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const value = Number(match[1])
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * Maior sequência de DIAS DE CALENDÁRIO consecutivos com treino.
 * Não é "dias desde o último treino" nem streak de semanas — é o número que o
 * aluno entende como "eu emendei X dias".
 */
function longestStreak(sessions: SessionRow[]): number {
  const days = Array.from(new Set(sessions.map((s) => dayKey(s.startedAt)))).sort()
  if (days.length === 0) return 0

  let best = 1
  let run = 1

  for (let i = 1; i < days.length; i++) {
    const prev = new Date(`${days[i - 1]}T00:00:00Z`).getTime()
    const curr = new Date(`${days[i]}T00:00:00Z`).getTime()
    const diffDays = Math.round((curr - prev) / 86400000)
    run = diffDays === 1 ? run + 1 : 1
    if (run > best) best = run
  }

  return best
}

/** Volume = Σ carga × repetições. Só séries com os dois valores entram. */
function totalVolumeKg(sets: SetRow[]): number | null {
  const usable = sets.filter((s) => s.loadKg != null && s.repsDone != null && s.repsDone > 0)
  if (usable.length === 0) return null
  return Math.round(usable.reduce((sum, s) => sum + s.loadKg! * s.repsDone!, 0))
}

/** Melhor carga por exercício no período, considerando log por série e agregado. */
function bestLoadByExercise(
  sets: SetRow[],
  aggs: ExerciseAggRow[],
): Map<string, { name: string; kg: number; at: string }> {
  const best = new Map<string, { name: string; kg: number; at: string }>()

  const consider = (exerciseId: string, name: string, kg: number | null, at: string) => {
    if (kg == null || kg <= 0) return
    const current = best.get(exerciseId)
    if (!current || kg > current.kg) best.set(exerciseId, { name, kg, at })
  }

  for (const s of sets) consider(s.exerciseId, s.exerciseName, s.loadKg, s.createdAt)
  for (const a of aggs) consider(a.exerciseId, a.exerciseName, parseLoadKg(a.loadUsed), a.createdAt)

  return best
}

/** Primeira e última carga registrada por exercício, em ordem cronológica. */
function loadTrendByExercise(
  sets: SetRow[],
  aggs: ExerciseAggRow[],
): Map<string, { name: string; first: number; last: number }> {
  const points = new Map<string, { name: string; entries: { kg: number; at: string }[] }>()

  const push = (exerciseId: string, name: string, kg: number | null, at: string) => {
    if (kg == null || kg <= 0) return
    const entry = points.get(exerciseId) ?? { name, entries: [] }
    entry.entries.push({ kg, at })
    points.set(exerciseId, entry)
  }

  for (const s of sets) push(s.exerciseId, s.exerciseName, s.loadKg, s.createdAt)
  for (const a of aggs) push(a.exerciseId, a.exerciseName, parseLoadKg(a.loadUsed), a.createdAt)

  const trend = new Map<string, { name: string; first: number; last: number }>()
  for (const [id, { name, entries }] of points) {
    if (entries.length < 2) continue
    entries.sort((a, b) => a.at.localeCompare(b.at))
    trend.set(id, { name, first: entries[0].kg, last: entries[entries.length - 1].kg })
  }
  return trend
}

// ─── Cálculo principal ────────────────────────────────────────────────────────

export function buildReportMetrics(input: ReportInput): ReportMetrics {
  const { current, previous, historicalBestKg } = input

  const completed = current.sessions.filter((s) => s.finishedAt !== null)
  const previousCompleted = previous.sessions.filter((s) => s.finishedAt !== null)

  const totalSeconds = completed.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0)
  const totalMinutes = Math.round(totalSeconds / 60)
  const activeDays = new Set(completed.map((s) => dayKey(s.startedAt))).size

  const volumeCurrent = totalVolumeKg(current.setLogs)
  const volumePrevious = totalVolumeKg(previous.setLogs)

  // ── Recordes pessoais ──────────────────────────────────────────────────────
  // PR = carga do período maior que QUALQUER coisa registrada antes dele.
  // Exercício sem histórico anterior não gera PR: o primeiro registro de um
  // exercício novo não é recorde, é linha de base. Contar isso encheria o
  // relatório de "recordes" falsos toda vez que o personal trocasse o treino.
  const bestNow = bestLoadByExercise(current.setLogs, current.exerciseAggs)
  const records: PersonalRecord[] = []

  for (const [exerciseId, { name, kg, at }] of bestNow) {
    const previousBest = historicalBestKg[exerciseId]
    if (previousBest == null) continue
    if (kg > previousBest) {
      records.push({
        exerciseId,
        exerciseName: name,
        loadKg: kg,
        previousBestKg: previousBest,
        achievedAt: at,
      })
    }
  }
  records.sort((a, b) => (b.loadKg - (b.previousBestKg ?? 0)) - (a.loadKg - (a.previousBestKg ?? 0)))

  // ── Maiores evoluções de carga no período ──────────────────────────────────
  const trend = loadTrendByExercise(current.setLogs, current.exerciseAggs)
  const topProgress: ExerciseProgress[] = []

  for (const [exerciseId, { name, first, last }] of trend) {
    if (last <= first) continue
    topProgress.push({
      exerciseId,
      exerciseName: name,
      firstLoadKg: first,
      lastLoadKg: last,
      deltaPct: round1(((last - first) / first) * 100),
    })
  }
  topProgress.sort((a, b) => b.deltaPct - a.deltaPct)

  // ── Composição corporal ────────────────────────────────────────────────────
  const assessments = [...current.assessments].sort((a, b) => a.assessedAt.localeCompare(b.assessedAt))
  const progress = [...current.progress].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))

  const firstAssessment = assessments[0] ?? null
  const lastAssessment = assessments[assessments.length - 1] ?? null

  // Peso pode vir da avaliação do personal OU do auto-registro do aluno.
  // Preferimos a avaliação quando existe (balança controlada); caindo para o
  // auto-registro quando não há, para não deixar o relatório vazio.
  const weightStart = firstAssessment?.weight ?? progress[0]?.weight ?? null
  const weightEnd =
    lastAssessment?.weight ?? progress[progress.length - 1]?.weight ?? null

  const sameWeightPoint = assessments.length < 2 && progress.length < 2
  const weightDelta =
    weightStart != null && weightEnd != null && !sameWeightPoint
      ? round1(weightEnd - weightStart)
      : null

  const bodyFatStart = firstAssessment?.bodyFat ?? null
  const bodyFatEnd = lastAssessment?.bodyFat ?? null
  const bodyFatDelta =
    bodyFatStart != null && bodyFatEnd != null && assessments.length >= 2
      ? round1(bodyFatEnd - bodyFatStart)
      : null

  const waistDelta =
    firstAssessment?.waist != null && lastAssessment?.waist != null && assessments.length >= 2
      ? round1(lastAssessment.waist - firstAssessment.waist)
      : null

  const hasPhotos = progress.some((p) => (p.photoUrls ?? []).length > 0)

  // ── Prontidão ──────────────────────────────────────────────────────────────
  const scores = current.readiness
    .map((r) => r.readinessScore)
    .filter((s): s is number => s != null)
  const avgReadiness =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

  // ── Destaques ──────────────────────────────────────────────────────────────
  const workoutsDelta = pctDelta(completed.length, previousCompleted.length)
  const volumeDelta =
    volumeCurrent != null && volumePrevious != null ? pctDelta(volumeCurrent, volumePrevious) : null

  const highlights: string[] = []

  if (completed.length > 0) {
    highlights.push(
      `${completed.length} treino${completed.length > 1 ? 's' : ''} concluído${completed.length > 1 ? 's' : ''} em ${activeDays} dia${activeDays > 1 ? 's' : ''}`,
    )
  }
  if (workoutsDelta != null && Math.abs(workoutsDelta) >= 10) {
    highlights.push(
      workoutsDelta > 0
        ? `${workoutsDelta}% mais treinos que no mês anterior`
        : `${Math.abs(workoutsDelta)}% menos treinos que no mês anterior`,
    )
  }
  if (volumeDelta != null && volumeDelta > 5) {
    highlights.push(`${volumeDelta}% mais volume levantado que no mês anterior`)
  }
  if (records.length > 0) {
    highlights.push(
      `${records.length} recorde${records.length > 1 ? 's' : ''} pessoa${records.length > 1 ? 'is' : 'l'}, incluindo ${records[0].exerciseName} a ${records[0].loadKg}kg`,
    )
  }
  if (topProgress.length > 0 && records.length === 0) {
    highlights.push(
      `${topProgress[0].exerciseName} subiu de ${topProgress[0].firstLoadKg}kg para ${topProgress[0].lastLoadKg}kg`,
    )
  }
  const streak = longestStreak(completed)
  if (streak >= 3) highlights.push(`Melhor sequência: ${streak} dias seguidos`)
  if (weightDelta != null && Math.abs(weightDelta) >= 0.5) {
    highlights.push(`Peso ${weightDelta > 0 ? '+' : ''}${weightDelta}kg no período`)
  }
  if (bodyFatDelta != null && bodyFatDelta < 0) {
    highlights.push(`Gordura corporal ${bodyFatDelta}%`)
  }

  // ── Ponto de atenção ───────────────────────────────────────────────────────
  // No máximo UM, e só quando é inequívoco. Relatório que lista cinco defeitos
  // desmotiva — e o objetivo do documento é o aluno enxergar o que conquistou.
  let attentionPoint: string | null = null

  if (completed.length === 0) {
    attentionPoint = 'Nenhum treino registrado no período.'
  } else if (workoutsDelta != null && workoutsDelta <= -30) {
    attentionPoint = `A frequência caiu ${Math.abs(workoutsDelta)}% em relação ao mês anterior — vale retomar o ritmo.`
  } else if (avgReadiness != null && avgReadiness < 45) {
    attentionPoint = `A prontidão média ficou em ${avgReadiness}/100, sinal de recuperação insuficiente entre os treinos.`
  } else if (records.length === 0 && topProgress.length === 0 && completed.length >= 4) {
    attentionPoint = 'As cargas ficaram estáveis no período — pode ser hora de progredir.'
  }

  // Sem treino e sem medida, não há relatório honesto a fazer.
  const isEmpty = completed.length === 0 && assessments.length === 0 && progress.length === 0

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    workouts: {
      completed: completed.length,
      previousCompleted: previousCompleted.length,
      deltaPct: workoutsDelta,
      totalMinutes,
      avgMinutes: completed.length > 0 ? Math.round(totalMinutes / completed.length) : 0,
      longestStreakDays: streak,
      activeDays,
    },
    volume: {
      totalKg: volumeCurrent,
      previousTotalKg: volumePrevious,
      deltaPct: volumeDelta,
    },
    records: records.slice(0, 5),
    topProgress: topProgress.slice(0, 5),
    body: {
      weightStart,
      weightEnd,
      weightDelta,
      bodyFatStart,
      bodyFatEnd,
      bodyFatDelta,
      waistDelta,
      hasPhotos,
    },
    readiness: { avgScore: avgReadiness, checkins: current.readiness.length },
    highlights,
    attentionPoint,
    isEmpty,
  }
}

// ─── Período ──────────────────────────────────────────────────────────────────

/** Primeiro e último dia do mês anterior ao de referência, em YYYY-MM-DD (UTC). */
export function previousMonthPeriod(reference: Date = new Date()): {
  periodStart: string
  periodEnd: string
  label: string
} {
  const year = reference.getUTCFullYear()
  const month = reference.getUTCMonth() // 0-11

  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0)) // dia 0 do mês atual = último do anterior

  const MONTHS = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ]

  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
    label: `${MONTHS[start.getUTCMonth()]} de ${start.getUTCFullYear()}`,
  }
}

export function periodLabel(periodStart: string): string {
  const MONTHS = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ]
  const [year, month] = periodStart.split('-').map(Number)
  return `${MONTHS[month - 1]} de ${year}`
}

/** Texto de fallback quando a IA está indisponível — nunca deixa o relatório mudo. */
export function fallbackNarrative(metrics: ReportMetrics, studentName: string): {
  headline: string
  narrative: string
} {
  if (metrics.isEmpty) {
    return {
      headline: 'Um mês sem registros',
      narrative:
        `${studentName}, não houve treinos nem medições registradas neste período. ` +
        'Vamos retomar — o próximo relatório conta outra história.',
    }
  }

  const parts = [
    `${studentName}, aqui está o resumo do seu mês.`,
    metrics.highlights.length > 0 ? metrics.highlights.join('. ') + '.' : '',
    metrics.attentionPoint ?? '',
  ].filter(Boolean)

  const headline =
    metrics.records.length > 0
      ? `${metrics.records.length} recorde${metrics.records.length > 1 ? 's' : ''} neste mês`
      : metrics.workouts.completed > 0
        ? `${metrics.workouts.completed} treinos concluídos`
        : 'Seu resumo do mês'

  return { headline, narrative: parts.join(' ') }
}
