import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ExerciseLoadHistory {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  prescribedLoad: string | null;
  prescribedSets: number | null;
  prescribedReps: string | null;
  history: Array<{
    date: string;
    loadUsed: string | null;
    setsDone: number | null;
    repsDone: string | null;
  }>;
}

interface FormatLoadHistoryOptions {
  maxExercises?: number;
  maxEntriesPerExercise?: number;
}

export async function fetchWorkoutLoadHistory(
  supabase: SupabaseClient,
  studentId: string,
  exerciseId?: string,
): Promise<ExerciseLoadHistory[]> {
  // 1. Busca o plano ativo para obter as cargas prescritas atuais
  const { data: planData } = await supabase
    .from('workout_plans')
    .select(`
      workout_routines (
        workout_items:workout_items (
          exercise_id, sets, reps, load,
          exercise:exercises ( id, name, muscle_group )
        )
      )
    `)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  // Monta mapa de carga prescrita por exercise_id
  const prescribedMap = new Map<string, { load: string | null; sets: number | null; reps: string | null }>();
  if (planData) {
    for (const routine of (planData.workout_routines ?? []) as any[]) {
      for (const item of (routine.workout_items ?? []) as any[]) {
        if (item.exercise_id && !prescribedMap.has(item.exercise_id)) {
          prescribedMap.set(item.exercise_id, {
            load: item.load ?? null,
            sets: item.sets ?? null,
            reps: item.reps ?? null,
          });
        }
      }
    }
  }

  // 2. Busca histórico de sessões com exercícios executados
  let query = supabase
    .from('workout_session_exercises')
    .select(`
      exercise_id,
      sets_done, reps_done, load_used,
      session:workout_sessions!inner ( started_at, student_id )
    `)
    .eq('session.student_id', studentId)
    .not('load_used', 'is', null)
    .order('session(started_at)', { ascending: false })
    .limit(120);

  if (exerciseId) query = query.eq('exercise_id', exerciseId);

  const { data: rows } = await query;
  if (!rows?.length) return [];

  // 3. Busca nomes dos exercícios distintos
  const exerciseIds = [...new Set((rows as any[]).map((r) => r.exercise_id))];
  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name, muscle_group')
    .in('id', exerciseIds);

  const exerciseInfoMap = new Map<string, { name: string; muscleGroup: string }>(
    (exercises ?? []).map((e: any) => [e.id, { name: e.name, muscleGroup: e.muscle_group }]),
  );

  // 4. Agrupa histórico por exercício (max 8 sessões por exercício)
  const grouped = new Map<string, ExerciseLoadHistory>();

  for (const row of rows as any[]) {
    const exId = row.exercise_id;
    const exInfo = exerciseInfoMap.get(exId);
    if (!exInfo) continue;

    if (!grouped.has(exId)) {
      const prescribed = prescribedMap.get(exId);
      grouped.set(exId, {
        exerciseId: exId,
        exerciseName: exInfo.name,
        muscleGroup: exInfo.muscleGroup,
        prescribedLoad: prescribed?.load ?? null,
        prescribedSets: prescribed?.sets ?? null,
        prescribedReps: prescribed?.reps ?? null,
        history: [],
      });
    }

    const entry = grouped.get(exId)!;
    if (entry.history.length < 8) {
      entry.history.push({
        date: (row.session?.started_at ?? '').slice(0, 10),
        loadUsed: row.load_used ?? null,
        setsDone: row.sets_done ?? null,
        repsDone: row.reps_done ?? null,
      });
    }
  }

  return [...grouped.values()];
}

/**
 * Compacta o historico de cargas para caber melhor no prompt sem perder tendencia.
 */
export function formatLoadHistoryForPrompt(
  history: ExerciseLoadHistory[],
  options: FormatLoadHistoryOptions = {},
): string {
  if (!history.length) return 'Nenhum histórico de carga disponível.';

  const maxExercises = options.maxExercises ?? 6;
  const maxEntriesPerExercise = options.maxEntriesPerExercise ?? 4;
  const selectedHistory = history.slice(0, maxExercises);
  const lines: string[] = ['HISTORICO DE CARGAS:'];

  for (const ex of selectedHistory) {
    const prescribed = ex.prescribedLoad
      ? `${ex.prescribedSets}x${ex.prescribedReps} @ ${ex.prescribedLoad}`
      : `${ex.prescribedSets}x${ex.prescribedReps} sem carga definida`;
    lines.push(`- ${ex.exerciseName} (${ex.muscleGroup}) | prescrito: ${prescribed}`);

    if (ex.history.length === 0) {
      lines.push('  sem execucoes registradas');
    } else {
      for (const h of ex.history.slice(0, maxEntriesPerExercise)) {
        const load = h.loadUsed ?? 'carga não registrada';
        const exec = h.setsDone ? `${h.setsDone}x${h.repsDone ?? '?'}` : 'séries não registradas';
        lines.push(`  ${h.date}: ${exec} @ ${load}`);
      }
      const hiddenEntries = Math.max(0, ex.history.length - maxEntriesPerExercise);
      if (hiddenEntries) lines.push(`  +${hiddenEntries} execucoes antigas omitidas`);
    }
  }

  const hiddenExercises = Math.max(0, history.length - maxExercises);
  if (hiddenExercises) lines.push(`- +${hiddenExercises} exercicios omitidos para reduzir tokens`);

  return lines.join('\n');
}
