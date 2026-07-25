// Camada de dados do Radar de Retenção no app.
//
// LIMITAÇÃO DELIBERADA: aqui a mensagem de retomada usa SEMPRE o rascunho
// determinístico (`fallbackMessage`, do motor compartilhado). O app não chama
// a IA porque a chave da Anthropic iria no bundle — e chave de API em app
// distribuído é vazamento, não configuração.
//
// A versão escrita pelo Max fica no web. O rascunho determinístico é
// específico o suficiente (cita dias parado, queda de frequência, motivo real)
// para o personal editar e enviar do celular entre um atendimento e outro,
// que é justamente onde o radar é mais útil.

import { supabase } from '@/lib/supabase'
import {
  buildDailyQueue,
  fallbackMessage,
  suggestAction,
  type RetentionAssessment,
  type Signal,
} from '@/lib/retentionEngine'

export type RadarCase = {
  studentId: string
  studentName: string
  snapshotId: string
  riskScore: number
  riskBand: 'green' | 'yellow' | 'red'
  headline: string
  signals: Signal[]
  suggested: 'message' | 'challenge'
}

export type ActiveChallenge = { id: string; name: string; duration_days: number | null }

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Fila do dia + o resto. Lê o snapshot que o cron gravou; o app não recalcula
 * risco — se recalculasse, o número no celular divergiria do número no web.
 */
export async function loadRadar(tenantId: string): Promise<{
  queue: RadarCase[]
  remaining: RadarCase[]
  lastUpdated: string | null
}> {
  const { data: snapshots } = await supabase
    .from('retention_snapshots')
    .select('id, student_id, risk_score, risk_band, headline, signals, snapshot_date, students ( id, full_name )')
    .eq('tenant_id', tenantId)
    .eq('snapshot_date', todayIso())
    .order('risk_score', { ascending: false })

  const rows = (snapshots ?? []) as any[]
  if (rows.length === 0) return { queue: [], remaining: [], lastUpdated: null }

  // Quem já foi atendido hoje sai da fila na hora — inclusive se a ação veio
  // do web enquanto o app estava aberto.
  const { data: todayActions } = await supabase
    .from('retention_actions')
    .select('student_id')
    .eq('tenant_id', tenantId)
    .gte('created_at', `${todayIso()}T00:00:00.000Z`)

  const handled = new Set((todayActions ?? []).map((a: any) => a.student_id))

  const candidates = rows
    .filter((r) => !handled.has(r.student_id))
    .map((r) => {
      const student = Array.isArray(r.students) ? r.students[0] : r.students
      const signals: Signal[] = Array.isArray(r.signals) ? r.signals : []
      const item: RadarCase = {
        studentId: r.student_id,
        studentName: student?.full_name ?? 'Aluno',
        snapshotId: r.id,
        riskScore: r.risk_score,
        riskBand: r.risk_band,
        headline: r.headline,
        signals,
        suggested: suggestAction({ signals } as RetentionAssessment),
      }
      return {
        item,
        assessment: {
          riskScore: r.risk_score,
          riskBand: r.risk_band,
          signals,
          headline: r.headline,
          suppressed: false,
          suppressedReason: null,
        } as RetentionAssessment,
      }
    })

  const { queue, remaining } = buildDailyQueue(candidates, 3)

  return {
    queue: queue.map((c) => c.item),
    remaining: remaining.map((c) => c.item),
    lastUpdated: rows[0]?.snapshot_date ?? null,
  }
}

/** Rascunho determinístico. Ver nota no topo sobre por que não há IA aqui. */
export function draftMessage(
  radarCase: RadarCase,
  personalFirstName: string,
): { title: string; body: string } {
  return fallbackMessage(
    { signals: radarCase.signals } as RetentionAssessment,
    radarCase.studentName.split(' ')[0],
    personalFirstName,
  )
}

export async function sendMessage(params: {
  tenantId: string
  studentId: string
  snapshotId: string | null
  trainerId: string | null
  title: string
  body: string
  riskScore: number
  edited: boolean
}): Promise<{ error?: string }> {
  const { error } = await supabase.from('student_messages').insert({
    tenant_id: params.tenantId,
    student_id: params.studentId,
    trainer_id: params.trainerId,
    title: params.title.trim() || 'Mensagem do seu personal',
    message: params.body.trim(),
    message_type: 'retention',
  } as any)

  if (error) return { error: error.message }

  await supabase.from('retention_actions').insert({
    tenant_id: params.tenantId,
    student_id: params.studentId,
    snapshot_id: params.snapshotId,
    action_type: 'message_sent',
    risk_score_at_action: params.riskScore,
    message_body: params.body.trim(),
    edited_by_personal: params.edited,
    performed_by: params.trainerId,
  } as any)

  return {}
}

export async function listActiveChallenges(tenantId: string): Promise<ActiveChallenge[]> {
  const { data } = await supabase
    .from('challenges')
    .select('id, name, duration_days')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('start_date', { ascending: false })

  return (data ?? []) as ActiveChallenge[]
}

export async function inviteToChallenge(params: {
  tenantId: string
  studentId: string
  snapshotId: string | null
  trainerId: string | null
  challengeId: string
  challengeName: string
  riskScore: number
}): Promise<{ error?: string }> {
  // upsert e não check-then-insert: existe UNIQUE (challenge_id, student_id)
  // e toque duplo no botão bateria nela.
  const { error } = await supabase.from('challenge_participants').upsert(
    {
      tenant_id: params.tenantId,
      challenge_id: params.challengeId,
      student_id: params.studentId,
    } as any,
    { onConflict: 'challenge_id,student_id', ignoreDuplicates: true },
  )

  if (error) return { error: error.message }

  // Inscrever em silêncio não retém ninguém: o aluno precisa saber.
  await supabase.from('student_messages').insert({
    tenant_id: params.tenantId,
    student_id: params.studentId,
    trainer_id: params.trainerId,
    title: 'Te inscrevi num desafio',
    message:
      `Coloquei você no desafio "${params.challengeName}". ` +
      'Achei que ia te animar a retomar o ritmo. Dá uma olhada nas regras — e me fala o que achou.',
    message_type: 'retention',
  } as any)

  await supabase.from('retention_actions').insert({
    tenant_id: params.tenantId,
    student_id: params.studentId,
    snapshot_id: params.snapshotId,
    action_type: 'challenge_invited',
    risk_score_at_action: params.riskScore,
    challenge_id: params.challengeId,
    performed_by: params.trainerId,
  } as any)

  return {}
}

/** `dismissed`/`snoozed` só tiram da fila — não contam como "agiu" no cooldown. */
export async function parkCase(params: {
  tenantId: string
  studentId: string
  snapshotId: string | null
  trainerId: string | null
  mode: 'dismissed' | 'snoozed'
  days?: number
}): Promise<{ error?: string }> {
  const { error } = await supabase.from('retention_actions').insert({
    tenant_id: params.tenantId,
    student_id: params.studentId,
    snapshot_id: params.snapshotId,
    action_type: params.mode,
    snooze_until:
      params.mode === 'snoozed' && params.days
        ? new Date(Date.now() + params.days * 86_400_000).toISOString().slice(0, 10)
        : null,
    performed_by: params.trainerId,
  } as any)

  if (error) return { error: error.message }
  return {}
}
