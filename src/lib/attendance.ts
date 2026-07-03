import { supabase } from '@/lib/supabase';

// Registra a presença do aluno hoje, sem duplicar caso ele já tenha treinado
// mais de uma vez no mesmo dia (ex.: dois agrupamentos no mesmo dia).
export async function registerAttendanceToday(studentId: string, tenantId: string) {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('student_id', studentId)
    .gte('attended_at', dayStart)
    .lt('attended_at', dayEnd)
    .limit(1);

  if (existing && existing.length > 0) return;

  await supabase.from('attendance').insert({
    student_id: studentId,
    tenant_id: tenantId,
    attended_at: now.toISOString(),
  } as any);
}
