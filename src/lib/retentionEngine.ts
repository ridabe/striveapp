// ─────────────────────────────────────────────────────────────────────────────
// Motor de risco de evasão do módulo "Radar de Retenção".
//
// DETERMINÍSTICO e SEM IMPORTS, mesma regra do adaptation-engine e do
// evolution-report. Aqui a razão de não usar LLM é ainda mais forte: um score
// que muda sozinho entre duas execuções com os mesmos dados destruiria a
// confiança do personal no radar. Ele precisa poder olhar e entender POR QUE
// aquele aluno está em vermelho.
//
// PRINCÍPIO CENTRAL: comparar o aluno com ELE MESMO, não com uma média.
// Quem treina 2x/semana há um ano não está em risco por treinar 2x/semana —
// está em risco quando cai para 1x. Um limiar absoluto ("menos de 3 treinos =
// risco") classificaria metade da base errado.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Entradas ─────────────────────────────────────────────────────────────────

export type RetentionInput = {
  /** Dias desde o último treino concluído. null = nunca treinou. */
  daysSinceLastWorkout: number | null
  /** Treinos concluídos nos últimos 30 dias. */
  workoutsLast30: number
  /** Treinos concluídos nos 30 dias anteriores a esses — a linha de base do aluno. */
  workoutsPrevious30: number
  /** Dias desde o cadastro. Aluno novo não tem baseline e é tratado à parte. */
  daysSinceJoined: number

  /** Notas de feedback (1-5) dos últimos 30 dias, mais recentes primeiro. */
  recentRatings: number[]
  /** Média de feedback dos 30 dias anteriores, para comparar. */
  previousAvgRating: number | null

  /** Scores de prontidão dos últimos 30 dias, mais recentes primeiro. */
  recentReadiness: number[]

  /** Faturas vencidas e não pagas. */
  overdueInvoices: number
  daysOverdue: number | null

  /** Último relatório publicado foi visto? null = não há relatório publicado. */
  lastReportViewed: boolean | null

  /** Já houve ação de retenção recente? Evita insistir no mesmo aluno todo dia. */
  daysSinceLastAction: number | null
  /** Data até a qual o aluno foi adiado (snooze), em YYYY-MM-DD. */
  snoozedUntil: string | null
}

// ─── Saída ────────────────────────────────────────────────────────────────────

export type SignalKey =
  | 'absence'
  | 'frequency_drop'
  | 'rating_drop'
  | 'low_readiness'
  | 'overdue_invoice'
  | 'report_ignored'
  | 'never_started'

export type Signal = {
  key: SignalKey
  /** Contribuição em pontos para o score final. */
  points: number
  /** Frase curta e factual, em PT-BR. */
  label: string
}

export type RiskBand = 'green' | 'yellow' | 'red'

export type RetentionAssessment = {
  riskScore: number
  riskBand: RiskBand
  signals: Signal[]
  /** Motivo dominante — o que o personal lê antes de abrir o caso. */
  headline: string
  /** true quando o aluno está fora da fila (snooze ativo ou ação recente). */
  suppressed: boolean
  suppressedReason: string | null
}

// ─── Pesos ────────────────────────────────────────────────────────────────────
//
// Somados, os máximos passam de 100 de propósito: o score satura em 100 e um
// aluno com três problemas graves não fica "menos vermelho" que um com dois.
// O que importa acima de 70 não é a distância entre 80 e 95, é agir.

const MAX_ABSENCE = 45

// Queda de frequência precisa conseguir acender o amarelo SOZINHA.
// A primeira calibragem usava teto 30, abaixo do limiar de 35 — e o resultado
// era absurdo: um aluno que cortou a frequência em 71% mas treinou anteontem
// aparecia verde, porque nenhum outro sinal disparava. Justamente o churn
// silencioso, que é a razão de existir do módulo, passava batido. Teto 40 faz
// uma queda de ~70% chegar a 36 e entrar na fila.
const MAX_FREQUENCY_DROP = 40
const MAX_RATING_DROP = 15
const MAX_LOW_READINESS = 15
const MAX_OVERDUE = 20
const REPORT_IGNORED = 8

const BAND_YELLOW = 35
const BAND_RED = 65

/** Aluno com menos disto não tem baseline confiável para comparar. */
const MIN_DAYS_FOR_BASELINE = 45

/** Depois de agir, o aluno sai da fila por este período. */
const ACTION_COOLDOWN_DAYS = 7

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

/**
 * Cadência típica do aluno, em dias entre treinos, derivada da linha de base
 * dele. Quem treina 12x/mês espera treinar a cada 2,5 dias; quem treina 4x/mês,
 * a cada 7,5. É isso que torna "sumiu" relativo à pessoa.
 */
function expectedGapDays(workoutsPrevious30: number): number {
  if (workoutsPrevious30 <= 0) return 7
  return clamp(30 / workoutsPrevious30, 2, 10)
}

// ─── Avaliação ────────────────────────────────────────────────────────────────

export function assessRetention(input: RetentionInput, today: string): RetentionAssessment {
  const signals: Signal[] = []

  const hasBaseline =
    input.daysSinceJoined >= MIN_DAYS_FOR_BASELINE && input.workoutsPrevious30 > 0

  // ── 1. Aluno que nunca começou ────────────────────────────────────────────
  // Caso próprio: não é "sumiu", é "nunca engajou". A conversa é outra, e
  // tratar como abandono normal produziria mensagem errada.
  if (input.daysSinceLastWorkout === null) {
    if (input.daysSinceJoined >= 10) {
      const points = clamp(30 + input.daysSinceJoined, 30, MAX_ABSENCE + 20)
      signals.push({
        key: 'never_started',
        points,
        label: `Cadastrado há ${input.daysSinceJoined} dias e ainda não registrou nenhum treino`,
      })
    }
  } else {
    // ── 2. Ausência, relativa à cadência do próprio aluno ───────────────────
    const expected = expectedGapDays(hasBaseline ? input.workoutsPrevious30 : 8)
    const ratio = input.daysSinceLastWorkout / expected

    if (ratio >= 2) {
      // 2x a cadência = começou a sumir; 5x = sumiu de vez.
      const points = clamp(((ratio - 2) / 3) * MAX_ABSENCE + 12, 12, MAX_ABSENCE)
      signals.push({
        key: 'absence',
        points: Math.round(points),
        label: `${input.daysSinceLastWorkout} dias sem treinar (costuma treinar a cada ${round1(expected)})`,
      })
    }
  }

  // ── 3. Queda de frequência ────────────────────────────────────────────────
  // O churn silencioso: o aluno não some de uma vez, ele reduz. Só faz sentido
  // com baseline — aluno novo tem "queda" artificial no segundo mês.
  if (hasBaseline) {
    const drop = (input.workoutsPrevious30 - input.workoutsLast30) / input.workoutsPrevious30
    if (drop >= 0.3) {
      const points = clamp(((drop - 0.3) / 0.7) * MAX_FREQUENCY_DROP + 12, 12, MAX_FREQUENCY_DROP)
      signals.push({
        key: 'frequency_drop',
        points: Math.round(points),
        label: `Frequência caiu ${Math.round(drop * 100)}% (${input.workoutsPrevious30} → ${input.workoutsLast30} treinos)`,
      })
    }
  }

  // ── 4. Feedback piorando ──────────────────────────────────────────────────
  const currentRating = avg(input.recentRatings)
  if (currentRating != null && input.recentRatings.length >= 2) {
    if (currentRating <= 2.5) {
      signals.push({
        key: 'rating_drop',
        points: MAX_RATING_DROP,
        label: `Nota média dos treinos em ${round1(currentRating)} de 5`,
      })
    } else if (input.previousAvgRating != null && input.previousAvgRating - currentRating >= 1) {
      signals.push({
        key: 'rating_drop',
        points: Math.round(MAX_RATING_DROP * 0.6),
        label: `Nota dos treinos caiu de ${round1(input.previousAvgRating)} para ${round1(currentRating)}`,
      })
    }
  }

  // ── 5. Prontidão baixa persistente ────────────────────────────────────────
  // Não é preguiça: é sinal de que o aluno vem chegando mal, e quem chega mal
  // repetidamente para de vir.
  const readinessAvg = avg(input.recentReadiness.slice(0, 5))
  if (readinessAvg != null && input.recentReadiness.length >= 3 && readinessAvg < 45) {
    const points = clamp(((45 - readinessAvg) / 45) * MAX_LOW_READINESS + 6, 6, MAX_LOW_READINESS)
    signals.push({
      key: 'low_readiness',
      points: Math.round(points),
      label: `Prontidão média em ${Math.round(readinessAvg)}/100 nos últimos check-ins`,
    })
  }

  // ── 6. Fatura vencida ─────────────────────────────────────────────────────
  // Peso deliberadamente menor que ausência. Atraso costuma ser esquecimento;
  // sumiço é decisão. Tratar dívida como sinal principal transformaria o radar
  // em régua de cobrança — e não é isso que retém aluno.
  if (input.overdueInvoices > 0) {
    const days = input.daysOverdue ?? 0
    const points = clamp((days / 30) * MAX_OVERDUE + 8, 8, MAX_OVERDUE)
    signals.push({
      key: 'overdue_invoice',
      points: Math.round(points),
      label: input.overdueInvoices === 1
        ? `1 fatura vencida há ${days} dias`
        : `${input.overdueInvoices} faturas vencidas`,
    })
  }

  // ── 7. Relatório publicado e ignorado ─────────────────────────────────────
  // Sinal fraco sozinho, mas somado a outros indica desengajamento do app.
  if (input.lastReportViewed === false) {
    signals.push({
      key: 'report_ignored',
      points: REPORT_IGNORED,
      label: 'Não abriu o último relatório de evolução',
    })
  }

  // ── Score ─────────────────────────────────────────────────────────────────
  const riskScore = clamp(Math.round(signals.reduce((sum, s) => sum + s.points, 0)), 0, 100)
  const riskBand: RiskBand =
    riskScore >= BAND_RED ? 'red' : riskScore >= BAND_YELLOW ? 'yellow' : 'green'

  // ── Supressão ─────────────────────────────────────────────────────────────
  // O personal já agiu: insistir no dia seguinte transforma a fila em ruído e
  // ele para de abrir o radar.
  let suppressed = false
  let suppressedReason: string | null = null

  if (input.snoozedUntil && input.snoozedUntil >= today) {
    suppressed = true
    suppressedReason = `Adiado até ${input.snoozedUntil}`
  } else if (
    input.daysSinceLastAction != null &&
    input.daysSinceLastAction < ACTION_COOLDOWN_DAYS
  ) {
    suppressed = true
    suppressedReason = `Você já agiu há ${input.daysSinceLastAction} dia${input.daysSinceLastAction === 1 ? '' : 's'}`
  }

  return {
    riskScore,
    riskBand,
    signals: signals.sort((a, b) => b.points - a.points),
    headline: buildHeadline(signals, riskBand),
    suppressed,
    suppressedReason,
  }
}

/** O sinal de maior peso vira a manchete. Uma linha, factual, sem alarmismo. */
function buildHeadline(signals: Signal[], band: RiskBand): string {
  if (signals.length === 0) return 'Tudo em ordem'

  const dominant = [...signals].sort((a, b) => b.points - a.points)[0]
  const others = signals.length - 1

  const suffix = others > 0
    ? ` · +${others} ${others === 1 ? 'sinal' : 'sinais'}`
    : ''

  if (band === 'green') return `${dominant.label}${suffix}`
  return `${dominant.label}${suffix}`
}

// ─── Fila do dia ──────────────────────────────────────────────────────────────

export type QueueCandidate<T> = {
  item: T
  assessment: RetentionAssessment
}

/**
 * A fila do dia tem TAMANHO MÁXIMO por design (padrão: 3).
 *
 * Uma lista de 30 alunos em risco não é acionável — o personal olha, sente
 * culpa e fecha. Três casos ele resolve. O resto continua no radar, ordenado,
 * para quem quiser ver a lista completa.
 */
export function buildDailyQueue<T>(
  candidates: QueueCandidate<T>[],
  limit = 3,
): { queue: QueueCandidate<T>[]; remaining: QueueCandidate<T>[] } {
  const eligible = candidates
    .filter((c) => !c.assessment.suppressed && c.assessment.riskBand !== 'green')
    .sort((a, b) => b.assessment.riskScore - a.assessment.riskScore)

  return { queue: eligible.slice(0, limit), remaining: eligible.slice(limit) }
}

// ─── Sugestão de ação ─────────────────────────────────────────────────────────

export type SuggestedAction = 'message' | 'challenge'

/**
 * Qual ação faz mais sentido para este caso.
 *
 * Desafio serve para quem sumiu por tédio — quem vinha treinando e perdeu a
 * graça. NÃO serve para quem tem fatura vencida (convidar para competição quem
 * está devendo é constrangedor), nem para quem nunca começou (não tem repertório
 * para competir), nem para quem chega mal (prontidão baixa pede menos carga, não
 * mais). Nesses casos, conversa.
 */
export function suggestAction(assessment: RetentionAssessment): SuggestedAction {
  const keys = new Set(assessment.signals.map((s) => s.key))

  if (keys.has('overdue_invoice')) return 'message'
  if (keys.has('never_started')) return 'message'
  if (keys.has('low_readiness')) return 'message'
  if (keys.has('rating_drop')) return 'message'

  if (keys.has('absence') || keys.has('frequency_drop')) return 'challenge'

  return 'message'
}

/**
 * Rascunho determinístico da mensagem de retomada. É o que aparece se a IA
 * estiver indisponível — e o que garante que o personal nunca encare um campo
 * de texto em branco, que é onde a ação morre.
 */
export function fallbackMessage(
  assessment: RetentionAssessment,
  studentFirstName: string,
  personalFirstName: string,
): { title: string; body: string } {
  const keys = new Set(assessment.signals.map((s) => s.key))

  if (keys.has('never_started')) {
    return {
      title: 'Vamos começar?',
      body:
        `${studentFirstName}, vi que seu treino já está montado mas você ainda não iniciou. ` +
        'Me diz o que está pegando — horário, dúvida sobre algum exercício, qualquer coisa. ' +
        `A gente ajusta.\n\n${personalFirstName}`,
    }
  }

  if (keys.has('absence')) {
    const absence = assessment.signals.find((s) => s.key === 'absence')
    const days = absence?.label.match(/^(\d+)/)?.[1]
    return {
      title: 'Senti sua falta',
      body:
        `${studentFirstName}, faz ${days ?? 'alguns'} dias que não te vejo por aqui. ` +
        'Sem cobrança — só quero entender se rolou alguma coisa e ver como facilitar sua volta. ' +
        `Se preferir, começamos com um treino mais curto.\n\n${personalFirstName}`,
    }
  }

  if (keys.has('frequency_drop')) {
    return {
      title: 'Como está a rotina?',
      body:
        `${studentFirstName}, notei que a frequência caiu nas últimas semanas. ` +
        'Costuma ser rotina apertada, e dá para adaptar o treino a isso. ' +
        `Me diz quantos dias você consegue e eu remonto.\n\n${personalFirstName}`,
    }
  }

  if (keys.has('rating_drop')) {
    return {
      title: 'Quero seu feedback',
      body:
        `${studentFirstName}, vi que os últimos treinos não te agradaram muito. ` +
        'Isso é informação boa, não problema. Me conta o que não está funcionando ' +
        `que eu ajusto.\n\n${personalFirstName}`,
    }
  }

  if (keys.has('low_readiness')) {
    return {
      title: 'Vamos ajustar a carga',
      body:
        `${studentFirstName}, seus check-ins mostram que você vem chegando cansado nos treinos. ` +
        'Isso costuma ser sono ou recuperação. Vamos baixar o volume por uma ou duas semanas ' +
        `para você voltar a render.\n\n${personalFirstName}`,
    }
  }

  if (keys.has('overdue_invoice')) {
    return {
      title: 'Tudo certo por aí?',
      body:
        `${studentFirstName}, sua fatura está em aberto. Se for só esquecimento, é rápido de resolver. ` +
        `Se for outra coisa, me fala que a gente vê o que dá para fazer.\n\n${personalFirstName}`,
    }
  }

  return {
    title: 'Passando para saber de você',
    body: `${studentFirstName}, tudo certo? Qualquer coisa que precise ajustar no treino, é só falar.\n\n${personalFirstName}`,
  }
}

export { BAND_YELLOW, BAND_RED, ACTION_COOLDOWN_DAYS }
