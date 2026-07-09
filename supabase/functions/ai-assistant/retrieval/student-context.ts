import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Tipos públicos ──────────────────────────────────────────────────────────

export interface StudentContext {
  student: {
    id: string;
    name: string;
    goal: string | null;
    age: number | null;
  };
  activePlan: WorkoutPlanContext | null;
  recentSessions: SessionSummary[];
  latestAssessment: AssessmentContext | null;
  progressSummary: ProgressSummary;
}

interface WorkoutPlanContext {
  id: string;
  name: string;
  goal: string | null;
  routines: RoutineContext[];
}

interface RoutineContext {
  id: string;
  name: string;
  daysOfWeek: number[] | null;
  items: WorkoutItemContext[];
}

interface WorkoutItemContext {
  exerciseName: string;
  muscleGroup: string;
  sets: number | null;
  reps: string | null;
  load: string | null;
  restSeconds: number | null;
}

interface SessionSummary {
  date: string;
  routineName: string | null;
  durationMinutes: number | null;
  intensity: string | null;
  caloriesActive: number | null;
  heartRateAvg: number | null;
}

interface AssessmentContext {
  assessedAt: string;
  weight: number | null;
  height: number | null;
  bmi: number | null;
  bodyFat: number | null;
  notes: string | null;
}

interface ProgressSummary {
  currentWeight: number | null;
  weightChangeLast30Days: number | null;
  sessionsLast30Days: number;
}

// ── Função principal ────────────────────────────────────────────────────────

export async function fetchStudentContext(
  supabase: SupabaseClient,
  studentId: string,
  tenantId: string,
): Promise<StudentContext> {
  const [
    studentResult,
    planResult,
    sessionsResult,
    assessmentResult,
    progressResult,
  ] = await Promise.all([
    fetchStudent(supabase, studentId, tenantId),
    fetchActivePlan(supabase, studentId),
    fetchRecentSessions(supabase, studentId),
    fetchLatestAssessment(supabase, studentId),
    fetchProgressSummary(supabase, studentId),
  ]);

  return {
    student: studentResult,
    activePlan: planResult,
    recentSessions: sessionsResult,
    latestAssessment: assessmentResult,
    progressSummary: progressResult,
  };
}

// ── Helpers internos ────────────────────────────────────────────────────────

async function fetchStudent(
  supabase: SupabaseClient,
  studentId: string,
  tenantId: string,
) {
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, goal, birth_date')
    .eq('id', studentId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) throw new Error('Aluno não encontrado');

  const age = data.birth_date
    ? calcAge(data.birth_date)
    : null;

  return {
    id: data.id,
    name: data.full_name,
    goal: data.goal ?? null,
    age,
  };
}

async function fetchActivePlan(
  supabase: SupabaseClient,
  studentId: string,
): Promise<WorkoutPlanContext | null> {
  const { data } = await supabase
    .from('workout_plans')
    .select(`
      id, name, goal,
      workout_routines (
        id, name, days_of_week, display_order,
        workout_items (
          sets, reps, load, rest_seconds, display_order,
          exercise:exercises ( name, muscle_group )
        )
      )
    `)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const routines = (data.workout_routines ?? [])
    .sort((a: any, b: any) => a.display_order - b.display_order)
    .map((r: any) => ({
      id: r.id,
      name: r.name,
      daysOfWeek: r.days_of_week ?? null,
      items: (r.workout_items ?? [])
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((i: any) => ({
          exerciseName: i.exercise?.name ?? 'Exercício',
          muscleGroup:  i.exercise?.muscle_group ?? '',
          sets:         i.sets ?? null,
          reps:         i.reps ?? null,
          load:         i.load ?? null,
          restSeconds:  i.rest_seconds ?? null,
        })),
    }));

  return { id: data.id, name: data.name, goal: data.goal ?? null, routines };
}

async function fetchRecentSessions(
  supabase: SupabaseClient,
  studentId: string,
): Promise<SessionSummary[]> {
  const { data } = await supabase
    .from('workout_sessions')
    .select(`
      started_at, duration_seconds, intensity,
      calories_active, heart_rate_avg,
      workout_routines ( name )
    `)
    .eq('student_id', studentId)
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(5);

  return (data ?? []).map((s: any) => ({
    date:            s.started_at?.slice(0, 10) ?? '',
    routineName:     s.workout_routines?.name ?? null,
    durationMinutes: s.duration_seconds ? Math.round(s.duration_seconds / 60) : null,
    intensity:       s.intensity ?? null,
    caloriesActive:  s.calories_active ?? null,
    heartRateAvg:    s.heart_rate_avg ?? null,
  }));
}

async function fetchLatestAssessment(
  supabase: SupabaseClient,
  studentId: string,
): Promise<AssessmentContext | null> {
  const { data } = await supabase
    .from('physical_assessments')
    .select('assessed_at, weight, height, bmi, body_fat, notes')
    .eq('student_id', studentId)
    .order('assessed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    assessedAt: data.assessed_at?.slice(0, 10) ?? '',
    weight:     data.weight ?? null,
    height:     data.height ?? null,
    bmi:        data.bmi    ?? null,
    bodyFat:    data.body_fat ?? null,
    notes:      data.notes ?? null,
  };
}

async function fetchProgressSummary(
  supabase: SupabaseClient,
  studentId: string,
): Promise<ProgressSummary> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [progressRows, sessionCount] = await Promise.all([
    supabase
      .from('student_progress')
      .select('recorded_at, weight')
      .eq('student_id', studentId)
      .not('weight', 'is', null)
      .order('recorded_at', { ascending: false })
      .limit(2),
    supabase
      .from('workout_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .gte('started_at', thirtyDaysAgo)
      .not('finished_at', 'is', null),
  ]);

  const rows = progressRows.data ?? [];
  const currentWeight = rows[0]?.weight ?? null;
  const weightChangeLast30Days =
    rows.length >= 2 && rows[0]?.weight && rows[1]?.weight
      ? Math.round((rows[0].weight - rows[1].weight) * 10) / 10
      : null;

  return {
    currentWeight,
    weightChangeLast30Days,
    sessionsLast30Days: sessionCount.count ?? 0,
  };
}

// ── Utilidade ───────────────────────────────────────────────────────────────

function calcAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
