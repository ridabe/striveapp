// ─────────────────────────────────────────────────────────────────────────────
// Motor de autorregulação do módulo "Treino Adaptativo".
//
// DETERMINÍSTICO por decisão de arquitetura: nenhuma chamada de LLM no caminho
// crítico. O aluno está com o celular na mão, entre uma série e outra — não dá
// para esperar 3s de inferência, nem aceitar que a mesma entrada produza saídas
// diferentes. O Max entra depois, fora deste arquivo, só para reescrever o
// campo `reason` em linguagem mais natural.
//
// SEM IMPORTS, DE PROPÓSITO: este arquivo é copiado byte a byte para o projeto
// mobile (strivePersonalApp/src/lib/adaptation-engine.ts). Qualquer import de
// 'next/*', '@/lib/*' ou do client Supabase quebraria isso. Se precisar de
// dado do banco, receba por parâmetro.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Guardrails definidos pelo personal (linha de `adaptation_rules`). */
export type AdaptationRule = {
  id: string
  tenant_id: string
  student_id: string | null
  workout_plan_id: string | null
  enabled: boolean
  max_load_increase_pct: number
  max_load_decrease_pct: number
  min_readiness_for_increase: number
  max_readiness_for_decrease: number
  allow_volume_adjust: boolean
  max_sets_added: number
  max_sets_removed: number
  allow_exercise_swap: boolean
  locked_exercise_ids: string[]
  default_target_rpe: number
}

/** Respostas do check-in de prontidão (1 = pior, 5 = melhor; dor é invertida). */
export type ReadinessInput = {
  sleepQuality: number
  muscleSoreness: number
  energyLevel: number
  painAreas?: string[]
}

/** Um exercício prescrito na sessão, como vem de `workout_items`. */
export type PrescribedItem = {
  itemId: string
  exerciseId: string
  exerciseName: string
  muscleGroup: string | null
  sets: number | null
  reps: string | null
  load: string | null
  targetRpe?: number | null
}

export type AdaptationType =
  | 'load_increase'
  | 'load_decrease'
  | 'set_added'
  | 'set_removed'
  | 'exercise_swapped'
  | 'no_change'

export type TriggerSource = 'readiness' | 'rpe_feedback' | 'pain_report' | 'manual'

/** Uma alteração proposta pelo motor — espelha uma linha de `session_adaptations`. */
export type PlannedAdaptation = {
  itemId: string
  exerciseId: string
  adaptationType: AdaptationType
  scope: 'session' | 'exercise' | 'set'
  valueBefore: string | null
  valueAfter: string | null
  deltaPct: number | null
  triggerSource: TriggerSource
  reason: string
  /** Valores já resolvidos, prontos para a UI de execução consumir. */
  resolved: {
    sets: number | null
    load: string | null
    loadKg: number | null
    needsSwap: boolean
  }
}

export type SessionPlan = {
  readinessScore: number
  band: ReadinessBand
  adaptations: PlannedAdaptation[]
  /** Frase única resumindo a sessão, mostrada ao aluno logo após o check-in. */
  summary: string
}

export type ReadinessBand = 'low' | 'neutral' | 'high'

// ─── Constantes ───────────────────────────────────────────────────────────────

/**
 * Incremento mínimo de carga que existe numa academia real. Ajustar de 40kg
 * para 41,3kg é inútil: não há anilha para isso. Abaixo de 20kg (halteres,
 * caneleiras) o passo é 1kg; acima, 2,5kg (anilhas de 1,25kg dos dois lados).
 */
const PLATE_STEP_BELOW_20KG = 1
const PLATE_STEP_FROM_20KG = 2.5

/** Readiness acima disso autoriza acrescentar volume, não só carga. */
const READINESS_FOR_EXTRA_VOLUME = 90

/** Ajuste máximo aplicado por feedback de RPE dentro da própria sessão. */
const RPE_STEP_PCT = 5
const RPE_HARD_STEP_PCT = 10

// ─── Prontidão ────────────────────────────────────────────────────────────────

/**
 * Espelho EXATO da coluna gerada `readiness_checkins.readiness_score`.
 * Existe para a UI mostrar o score antes do insert, sem round-trip. Se a
 * fórmula mudar no banco, mude aqui na mesma migração — divergência entre os
 * dois é bug silencioso.
 */
export function calcReadinessScore(input: ReadinessInput): number {
  const { sleepQuality, muscleSoreness, energyLevel } = input
  const raw = sleepQuality + (6 - muscleSoreness) + energyLevel - 3
  return Math.round((raw / 12) * 100)
}

export function readinessBand(score: number, rule: AdaptationRule): ReadinessBand {
  if (score <= rule.max_readiness_for_decrease) return 'low'
  if (score >= rule.min_readiness_for_increase) return 'high'
  return 'neutral'
}

export function readinessLabel(band: ReadinessBand): string {
  if (band === 'low') return 'Dia de recuperar'
  if (band === 'high') return 'Dia de avançar'
  return 'Dia padrão'
}

// ─── Carga: parse, arredondamento e formatação ────────────────────────────────

/**
 * `workout_items.load` é texto livre ("20kg", "12,5 kg", "corpo livre", "elástico
 * médio"). Só dá para autorregular o que é numérico — o resto retorna null e o
 * motor deixa o exercício intacto, de propósito.
 */
export function parseLoadKg(load: string | null | undefined): number | null {
  if (!load) return null
  const normalized = load.trim().toLowerCase().replace(',', '.')
  const match = normalized.match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const value = Number(match[1])
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

/** Arredonda para o incremento de anilha mais próximo. */
export function roundToPlate(kg: number): number {
  const step = kg < 20 ? PLATE_STEP_BELOW_20KG : PLATE_STEP_FROM_20KG
  const rounded = Math.round(kg / step) * step
  return Math.round(rounded * 100) / 100
}

/** Reescreve a carga preservando o formato que o personal digitou. */
export function formatLoadKg(kg: number, originalLabel: string | null): string {
  const value = Number.isInteger(kg) ? String(kg) : String(kg).replace('.', ',')
  if (originalLabel && /kg/i.test(originalLabel)) return `${value}kg`
  return value
}

// ─── Resolução da regra aplicável ─────────────────────────────────────────────

/**
 * Escopo em cascata: a regra mais específica vence.
 *   aluno + plano  >  aluno  >  plano  >  tenant (padrão do negócio)
 * Retorna null quando não há nenhuma regra habilitada — nesse caso o módulo
 * simplesmente não age, e a execução do treino segue exatamente como hoje.
 */
export function resolveRule(
  rules: AdaptationRule[],
  studentId: string,
  workoutPlanId: string | null,
): AdaptationRule | null {
  const scoped = rules.filter(
    (r) =>
      (r.student_id === null || r.student_id === studentId) &&
      (r.workout_plan_id === null || r.workout_plan_id === workoutPlanId),
  )

  const specificity = (r: AdaptationRule) =>
    (r.student_id ? 2 : 0) + (r.workout_plan_id ? 1 : 0)

  const winner = scoped.sort((a, b) => specificity(b) - specificity(a))[0]
  if (!winner || !winner.enabled) return null
  return winner
}

// ─── Cálculo do delta de carga por prontidão ──────────────────────────────────

/**
 * Delta percentual proporcional à distância do limiar, nunca em degrau.
 * Readiness 76 com limiar 75 rende quase nada; readiness 100 rende o teto
 * cheio. Isso evita o efeito de "1 ponto a mais no check-in e a carga pula
 * 7,5%", que o aluno aprenderia a explorar.
 */
export function loadDeltaPctFromReadiness(score: number, rule: AdaptationRule): number {
  if (score >= rule.min_readiness_for_increase) {
    const span = 100 - rule.min_readiness_for_increase
    const factor = span <= 0 ? 1 : (score - rule.min_readiness_for_increase) / span
    return round1(rule.max_load_increase_pct * factor)
  }

  if (score <= rule.max_readiness_for_decrease) {
    const span = rule.max_readiness_for_decrease
    const factor = span <= 0 ? 1 : (rule.max_readiness_for_decrease - score) / span
    return -round1(rule.max_load_decrease_pct * factor)
  }

  return 0
}

// ─── Plano da sessão ──────────────────────────────────────────────────────────

/**
 * Ponto de entrada principal: recebe o check-in + os exercícios prescritos e
 * devolve o que muda na sessão. Função pura — mesma entrada, mesma saída,
 * testável sem banco.
 */
export function planSession(params: {
  readiness: ReadinessInput
  rule: AdaptationRule
  items: PrescribedItem[]
}): SessionPlan {
  const { readiness, rule, items } = params

  const score = calcReadinessScore(readiness)
  const band = readinessBand(score, rule)
  const deltaPct = loadDeltaPctFromReadiness(score, rule)
  const painAreas = (readiness.painAreas ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean)

  const adaptations: PlannedAdaptation[] = []

  items.forEach((item, index) => {
    const isLocked = rule.locked_exercise_ids.includes(item.exerciseId)

    // 1. Exercício travado pelo personal: intocável, sempre. Vem antes de tudo.
    if (isLocked) {
      adaptations.push(
        noChange(item, 'Exercício travado pelo seu personal — segue exatamente como prescrito.'),
      )
      return
    }

    // 2. Dor reportada na região trabalhada → troca, se o personal permitir.
    const muscle = (item.muscleGroup ?? '').trim().toLowerCase()
    const hasPain = muscle.length > 0 && painAreas.some((area) => matchesArea(area, muscle))

    if (hasPain && rule.allow_exercise_swap) {
      adaptations.push({
        itemId: item.itemId,
        exerciseId: item.exerciseId,
        adaptationType: 'exercise_swapped',
        scope: 'exercise',
        valueBefore: item.exerciseName,
        valueAfter: null, // o substituto é escolhido no servidor, no banco de exercícios
        deltaPct: null,
        triggerSource: 'pain_report',
        reason: `Você reportou dor em ${muscle}. Sugerimos trocar ${item.exerciseName} por outro exercício do mesmo grupo.`,
        resolved: { sets: item.sets, load: item.load, loadKg: parseLoadKg(item.load), needsSwap: true },
      })
      return
    }

    // 3. Dor reportada mas sem permissão de troca: reduz volume em vez de trocar.
    if (hasPain && !rule.allow_exercise_swap && rule.allow_volume_adjust && item.sets && item.sets > 1) {
      const newSets = Math.max(1, item.sets - Math.min(1, rule.max_sets_removed))
      if (newSets !== item.sets) {
        adaptations.push({
          itemId: item.itemId,
          exerciseId: item.exerciseId,
          adaptationType: 'set_removed',
          scope: 'exercise',
          valueBefore: String(item.sets),
          valueAfter: String(newSets),
          deltaPct: null,
          triggerSource: 'pain_report',
          reason: `Dor reportada em ${muscle}: reduzimos de ${item.sets} para ${newSets} séries em ${item.exerciseName}.`,
          resolved: { sets: newSets, load: item.load, loadKg: parseLoadKg(item.load), needsSwap: false },
        })
        return
      }
    }

    // 4. Ajuste de carga por prontidão.
    const currentKg = parseLoadKg(item.load)
    let loadAdaptation: PlannedAdaptation | null = null

    if (currentKg !== null && deltaPct !== 0) {
      const targetKg = roundToPlate(currentKg * (1 + deltaPct / 100))

      if (targetKg !== currentKg && targetKg > 0) {
        const realDelta = round1(((targetKg - currentKg) / currentKg) * 100)
        const increased = targetKg > currentKg
        const newLabel = formatLoadKg(targetKg, item.load)

        loadAdaptation = {
          itemId: item.itemId,
          exerciseId: item.exerciseId,
          adaptationType: increased ? 'load_increase' : 'load_decrease',
          scope: 'exercise',
          valueBefore: item.load,
          valueAfter: newLabel,
          deltaPct: realDelta,
          triggerSource: 'readiness',
          reason: increased
            ? `Prontidão ${score}/100: subimos ${item.exerciseName} de ${item.load} para ${newLabel}.`
            : `Prontidão ${score}/100: aliviamos ${item.exerciseName} de ${item.load} para ${newLabel}.`,
          resolved: { sets: item.sets, load: newLabel, loadKg: targetKg, needsSwap: false },
        }
      }
    }

    // 5. Ajuste de volume. Só no primeiro exercício da rotina (o principal) —
    //    mexer no volume de todos multiplicaria o efeito e sairia do controle.
    let volumeAdaptation: PlannedAdaptation | null = null

    if (rule.allow_volume_adjust && item.sets && index === 0) {
      if (band === 'low' && rule.max_sets_removed > 0 && item.sets > 1) {
        const removed = Math.min(rule.max_sets_removed, item.sets - 1)
        const newSets = item.sets - removed
        volumeAdaptation = {
          itemId: item.itemId,
          exerciseId: item.exerciseId,
          adaptationType: 'set_removed',
          scope: 'exercise',
          valueBefore: String(item.sets),
          valueAfter: String(newSets),
          deltaPct: null,
          triggerSource: 'readiness',
          reason: `Prontidão baixa (${score}/100): ${item.exerciseName} vai de ${item.sets} para ${newSets} séries hoje.`,
          resolved: {
            sets: newSets,
            load: loadAdaptation?.resolved.load ?? item.load,
            loadKg: loadAdaptation?.resolved.loadKg ?? currentKg,
            needsSwap: false,
          },
        }
      } else if (band === 'high' && score >= READINESS_FOR_EXTRA_VOLUME && rule.max_sets_added > 0) {
        const newSets = item.sets + Math.min(1, rule.max_sets_added)
        volumeAdaptation = {
          itemId: item.itemId,
          exerciseId: item.exerciseId,
          adaptationType: 'set_added',
          scope: 'exercise',
          valueBefore: String(item.sets),
          valueAfter: String(newSets),
          deltaPct: null,
          triggerSource: 'readiness',
          reason: `Prontidão alta (${score}/100): ${item.exerciseName} ganha 1 série extra hoje.`,
          resolved: {
            sets: newSets,
            load: loadAdaptation?.resolved.load ?? item.load,
            loadKg: loadAdaptation?.resolved.loadKg ?? currentKg,
            needsSwap: false,
          },
        }
      }
    }

    if (loadAdaptation) adaptations.push(loadAdaptation)
    if (volumeAdaptation) adaptations.push(volumeAdaptation)
    if (!loadAdaptation && !volumeAdaptation) {
      adaptations.push(noChange(item, reasonForNoChange(currentKg, deltaPct, score)))
    }
  })

  return { readinessScore: score, band, adaptations, summary: buildSummary(score, band, adaptations) }
}

// ─── Autorregulação dentro da sessão (RPE) ────────────────────────────────────

export type SetFeedback = {
  /** RPE que o aluno marcou na série que acabou de fechar (0-10). */
  rpe: number
  /** RPE-alvo prescrito para o exercício. */
  targetRpe: number
  /** Carga usada na série que acabou, em kg. */
  currentLoadKg: number
  currentLoadLabel: string | null
}

export type SetAdjustment = {
  nextLoadKg: number
  nextLoadLabel: string
  deltaPct: number
  adaptationType: AdaptationType
  reason: string
}

/**
 * Decide a carga da PRÓXIMA série a partir do RPE da que acabou.
 *
 * A assimetria é intencional: subir exige folga clara (2 pontos abaixo do
 * alvo), descer basta 1 ponto acima. Errar para menos custa uma série fraca;
 * errar para mais custa uma lesão.
 */
export function adjustNextSet(feedback: SetFeedback, rule: AdaptationRule): SetAdjustment | null {
  const { rpe, targetRpe, currentLoadKg, currentLoadLabel } = feedback
  if (!Number.isFinite(currentLoadKg) || currentLoadKg <= 0) return null

  const diff = rpe - targetRpe
  let pct = 0

  if (diff <= -2) {
    pct = Math.min(RPE_STEP_PCT, rule.max_load_increase_pct)
  } else if (diff >= 2 || rpe >= 10) {
    pct = -Math.min(RPE_HARD_STEP_PCT, rule.max_load_decrease_pct)
  } else if (diff >= 1) {
    pct = -Math.min(RPE_STEP_PCT, rule.max_load_decrease_pct)
  } else {
    return null // dentro do alvo: não mexe
  }

  const nextKg = roundToPlate(currentLoadKg * (1 + pct / 100))
  if (nextKg === currentLoadKg || nextKg <= 0) return null

  const realDelta = round1(((nextKg - currentLoadKg) / currentLoadKg) * 100)
  const label = formatLoadKg(nextKg, currentLoadLabel)

  return {
    nextLoadKg: nextKg,
    nextLoadLabel: label,
    deltaPct: realDelta,
    adaptationType: nextKg > currentLoadKg ? 'load_increase' : 'load_decrease',
    reason:
      nextKg > currentLoadKg
        ? `Você marcou RPE ${rpe} num alvo de ${targetRpe} — sobrou tanque. Próxima série: ${label}.`
        : `RPE ${rpe} acima do alvo de ${targetRpe}. Próxima série: ${label}, para manter a técnica.`,
  }
}

/**
 * Sinal para o personal: o aluno está consistentemente abaixo do RPE-alvo, ou
 * seja, a prescrição ficou leve demais e é hora de progredir a carga base.
 * Retorna null quando não há sinal claro.
 */
export function detectProgressionSignal(
  recentRpes: number[],
  targetRpe: number,
  minSamples = 3,
): { direction: 'increase' | 'decrease'; avgRpe: number } | null {
  const samples = recentRpes.filter((r) => Number.isFinite(r))
  if (samples.length < minSamples) return null

  const avg = round1(samples.reduce((sum, r) => sum + r, 0) / samples.length)

  if (avg <= targetRpe - 1.5) return { direction: 'increase', avgRpe: avg }
  if (avg >= targetRpe + 1.5) return { direction: 'decrease', avgRpe: avg }
  return null
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function noChange(item: PrescribedItem, reason: string): PlannedAdaptation {
  return {
    itemId: item.itemId,
    exerciseId: item.exerciseId,
    adaptationType: 'no_change',
    scope: 'exercise',
    valueBefore: item.load,
    valueAfter: item.load,
    deltaPct: 0,
    triggerSource: 'readiness',
    reason,
    resolved: { sets: item.sets, load: item.load, loadKg: parseLoadKg(item.load), needsSwap: false },
  }
}

function reasonForNoChange(currentKg: number | null, deltaPct: number, score: number): string {
  if (currentKg === null) return 'Carga não numérica — mantida como prescrita.'
  if (deltaPct === 0) return `Prontidão ${score}/100 dentro da faixa normal — sem ajuste.`
  return 'Ajuste menor que o incremento de anilha disponível — carga mantida.'
}

/**
 * Casamento entre região de dor reportada e grupo muscular do exercício.
 * Tolerante de propósito: o aluno digita/toca "ombro" e o exercício está
 * cadastrado como "Ombros" ou "Deltoides".
 */
function matchesArea(painArea: string, muscleGroup: string): boolean {
  if (muscleGroup.includes(painArea) || painArea.includes(muscleGroup)) return true

  const synonyms: Record<string, string[]> = {
    ombro: ['ombros', 'deltoide', 'deltoides'],
    joelho: ['perna', 'pernas', 'quadriceps', 'quadríceps', 'posterior'],
    lombar: ['costas', 'dorsal', 'lombar'],
    cotovelo: ['biceps', 'bíceps', 'triceps', 'tríceps', 'braco', 'braço'],
    punho: ['antebraco', 'antebraço', 'biceps', 'bíceps'],
    quadril: ['gluteo', 'glúteo', 'gluteos', 'glúteos', 'perna', 'pernas'],
    tornozelo: ['panturrilha', 'panturrilhas'],
    pescoco: ['trapezio', 'trapézio', 'ombros'],
  }

  return (synonyms[painArea] ?? []).some((s) => muscleGroup.includes(s))
}

function buildSummary(score: number, band: ReadinessBand, adaptations: PlannedAdaptation[]): string {
  const changed = adaptations.filter((a) => a.adaptationType !== 'no_change')

  if (changed.length === 0) {
    return `Prontidão ${score}/100. Treino de hoje segue exatamente como prescrito.`
  }

  const swaps = changed.filter((a) => a.adaptationType === 'exercise_swapped').length
  const loads = changed.filter(
    (a) => a.adaptationType === 'load_increase' || a.adaptationType === 'load_decrease',
  ).length
  const volume = changed.filter(
    (a) => a.adaptationType === 'set_added' || a.adaptationType === 'set_removed',
  ).length

  const parts: string[] = []
  if (loads > 0) parts.push(`${loads} ${loads === 1 ? 'carga ajustada' : 'cargas ajustadas'}`)
  if (volume > 0) parts.push(`${volume} ${volume === 1 ? 'ajuste' : 'ajustes'} de volume`)
  if (swaps > 0) parts.push(`${swaps} ${swaps === 1 ? 'troca sugerida' : 'trocas sugeridas'}`)

  const prefix =
    band === 'high'
      ? `Prontidão ${score}/100 — dia de avançar.`
      : band === 'low'
        ? `Prontidão ${score}/100 — dia de recuperar.`
        : `Prontidão ${score}/100.`

  return `${prefix} ${parts.join(', ')}.`
}
