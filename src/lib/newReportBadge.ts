// Aviso de relatório novo para o aluno.
//
// O ciclo de "avisar só uma vez" NÃO precisa de estado novo: já existe
// `evolution_reports.viewed_by_student_at`, que é gravado no instante em que o
// aluno abre o relatório. A regra é uma linha:
//
//     publicado E ainda não visto  →  avisa
//     visto                        →  nunca mais avisa, para aquele mês
//
// Consequências desse desenho, todas desejadas:
//   - o aviso some sozinho, sem o aluno precisar clicar em "dispensar";
//   - não volta depois de reinstalar o app ou trocar de aparelho, porque o
//     estado vive no banco e não no dispositivo;
//   - o mês seguinte avisa de novo, porque é outro relatório.

import { supabase } from '@/lib/supabase'
import { periodLabel } from '@/lib/evolutionReport'

export type NewReportNotice = {
  reportId: string
  periodStart: string
  /** "junho de 2026" — pronto para a interface. */
  label: string
  headline: string | null
  /** Quantos relatórios publicados ele ainda não abriu. */
  count: number
}

/**
 * Devolve o relatório publicado mais recente que o aluno ainda não abriu.
 * null = nada a avisar.
 */
export async function loadNewReportNotice(studentId: string): Promise<NewReportNotice | null> {
  const { data } = await supabase
    .from('evolution_reports')
    .select('id, period_start, final_headline')
    .eq('student_id', studentId)
    .eq('status', 'published')
    .is('viewed_by_student_at', null)
    .order('period_start', { ascending: false })

  const rows = (data ?? []) as { id: string; period_start: string; final_headline: string | null }[]
  if (rows.length === 0) return null

  const latest = rows[0]
  return {
    reportId: latest.id,
    periodStart: latest.period_start,
    label: periodLabel(latest.period_start),
    headline: latest.final_headline,
    count: rows.length,
  }
}

/** Só a contagem — para o selo no menu, sem trazer texto à toa. */
export async function countUnseenReports(studentId: string): Promise<number> {
  const { count } = await supabase
    .from('evolution_reports')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('status', 'published')
    .is('viewed_by_student_at', null)

  return count ?? 0
}
