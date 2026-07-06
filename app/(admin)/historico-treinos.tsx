import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { backToStudentHub } from '@/lib/studentNav';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

// ─── Intensidade ────────────────────────────────────────────────────────────────
const INTENSITY_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  muito_leve:    { label: 'Muito leve', color: '#94A3B8', emoji: '😴' },
  leve:          { label: 'Leve',       color: '#60A5FA', emoji: '🙂' },
  moderado:      { label: 'Moderado',   color: '#4ADE80', emoji: '💪' },
  intenso:       { label: 'Intenso',    color: '#F59E0B', emoji: '🔥' },
  muito_intenso: { label: 'Pesado',     color: '#EF4444', emoji: '😤' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDuration(secs: number | null) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}min ${s}s` : `${m}min`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface SessionExercise {
  id: string;
  sets_done: number | null;
  reps_done: string | null;
  load_used: string | null;
  feedback: string | null;
  exercises: { name: string; muscle_group: string } | { name: string; muscle_group: string }[] | null;
}

interface Session {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  intensity: string | null;
  notes: string | null;
  heart_rate_avg: number | null;
  heart_rate_max: number | null;
  heart_rate_min: number | null;
  calories_active: number | null;
  spo2_avg: number | null;
  steps: number | null;
  distance_meters: number | null;
  wearable_device: string | null;
  workout_plans: { name: string } | { name: string }[] | null;
  workout_routines: { name: string } | { name: string }[] | null;
  workout_session_exercises: SessionExercise[];
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HistoricoTreinosScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const tenantId = profile?.tenant_id;

  const [studentName, setStudentName] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!tenantId || !studentId) return;

    const [studentRes, sessionsRes] = await Promise.all([
      supabase.from('students').select('full_name').eq('id', studentId).single(),
      supabase.from('workout_sessions')
        .select(`
          id, started_at, duration_seconds, intensity, notes,
          heart_rate_avg, heart_rate_max, heart_rate_min,
          calories_active, spo2_avg, steps, distance_meters, wearable_device,
          workout_plans ( name ),
          workout_routines ( name ),
          workout_session_exercises (
            id, sets_done, reps_done, load_used, feedback,
            exercises ( name, muscle_group )
          )
        `)
        .eq('student_id', studentId)
        .eq('tenant_id', tenantId)
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(30),
    ]);

    setStudentName(studentRes.data?.full_name ?? null);
    setSessions((sessionsRes.data ?? []) as unknown as Session[]);
  }, [tenantId, studentId]);

  // Tela vive dentro do Tabs navigator e fica montada em segundo plano — recarrega
  // sempre que a tela ganha foco, para refletir sessões concluídas recentemente.
  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const totalSessions = sessions.length;
  const totalMinutes = sessions.reduce((acc, s) => acc + Math.floor((s.duration_seconds ?? 0) / 60), 0);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => backToStudentHub(studentId)} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>
          {studentName ? studentName.split(' ')[0] : 'Aluno'}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <Text style={s.pageTitle}>Histórico de Treinos</Text>
              {sessions.length > 0 && (
                <View style={[s.summaryCard, { borderColor: `${primaryColor}30` }]}>
                  <View style={s.summaryItem}>
                    <Text style={[s.summaryNum, { color: primaryColor }]}>{totalSessions}</Text>
                    <Text style={s.summaryLabel}>Sessões realizadas</Text>
                  </View>
                  <View style={s.summaryItem}>
                    <Text style={[s.summaryNum, { color: primaryColor }]}>{totalMinutes}</Text>
                    <Text style={s.summaryLabel}>Minutos totais</Text>
                  </View>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="time-outline" size={48} color={Colors.border} />
              <Text style={s.emptyTitle}>Nenhuma sessão ainda</Text>
              <Text style={s.emptyDesc}>O aluno ainda não completou nenhum treino.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isOpen = expanded.has(item.id);
            const ic = item.intensity ? INTENSITY_CONFIG[item.intensity] : null;
            const plan = one(item.workout_plans);
            const routine = one(item.workout_routines);
            const hasHealth = item.heart_rate_avg || item.calories_active != null ||
              item.spo2_avg != null || item.steps != null || item.distance_meters != null;

            return (
              <View style={s.sessionCard}>
                <TouchableOpacity
                  style={s.sessionTop}
                  activeOpacity={0.75}
                  onPress={() => toggle(item.id)}
                >
                  <View style={s.sessionIconWrap}>
                    <Ionicons name="calendar" size={16} color="#60A5FA" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.sessionPlan} numberOfLines={1}>
                      {plan?.name ?? 'Treino'}
                    </Text>
                    {routine?.name && (
                      <Text style={s.sessionRoutine} numberOfLines={1}>{routine.name}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Text style={s.sessionDate}>{fmtDate(item.started_at)}</Text>
                    <Text style={s.sessionTime}>{fmtTime(item.started_at)}</Text>
                  </View>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={Colors.textSecondary}
                    style={{ marginLeft: 6 }}
                  />
                </TouchableOpacity>

                {isOpen && (
                  <View style={s.sessionBody}>
                    {/* Meta */}
                    <View style={s.metaRow}>
                      <View style={s.metaPill}>
                        <Ionicons name="time-outline" size={11} color={Colors.textSecondary} />
                        <Text style={s.metaPillText}>{fmtDuration(item.duration_seconds)}</Text>
                      </View>
                      {ic && (
                        <View style={[s.metaPill, { backgroundColor: `${ic.color}18` }]}>
                          <Text style={{ fontSize: 12 }}>{ic.emoji}</Text>
                          <Text style={[s.metaPillText, { color: ic.color }]}>{ic.label}</Text>
                        </View>
                      )}
                    </View>

                    {item.notes && (
                      <Text style={s.notes}>{item.notes}</Text>
                    )}

                    {/* Wearable */}
                    {hasHealth && (
                      <View style={s.healthSection}>
                        <View style={s.healthHeader}>
                          <Text style={{ fontSize: 12 }}>⌚</Text>
                          <Text style={s.healthSourceText}>{item.wearable_device ?? 'Smartwatch'}</Text>
                        </View>
                        <View style={s.healthGrid}>
                          {item.heart_rate_avg != null && (
                            <View style={s.healthItem}>
                              <Ionicons name="heart" size={13} color="#EF4444" />
                              <Text style={s.healthValue}>
                                {item.heart_rate_min ?? '?'}–{item.heart_rate_max ?? '?'}
                              </Text>
                              <Text style={s.healthLabel}>bpm (média {item.heart_rate_avg})</Text>
                            </View>
                          )}
                          {item.calories_active != null && (
                            <View style={s.healthItem}>
                              <Ionicons name="flame" size={13} color="#F59E0B" />
                              <Text style={s.healthValue}>{item.calories_active}</Text>
                              <Text style={s.healthLabel}>kcal</Text>
                            </View>
                          )}
                          {item.spo2_avg != null && (
                            <View style={s.healthItem}>
                              <Ionicons name="water" size={13} color="#60A5FA" />
                              <Text style={s.healthValue}>{item.spo2_avg}%</Text>
                              <Text style={s.healthLabel}>SpO₂</Text>
                            </View>
                          )}
                          {item.steps != null && (
                            <View style={s.healthItem}>
                              <Ionicons name="footsteps" size={13} color="#4ADE80" />
                              <Text style={s.healthValue}>{item.steps.toLocaleString('pt-BR')}</Text>
                              <Text style={s.healthLabel}>passos</Text>
                            </View>
                          )}
                          {item.distance_meters != null && (
                            <View style={s.healthItem}>
                              <Ionicons name="navigate" size={13} color="#A78BFA" />
                              <Text style={s.healthValue}>{(item.distance_meters / 1000).toFixed(2)}</Text>
                              <Text style={s.healthLabel}>km</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Exercícios */}
                    {item.workout_session_exercises.length > 0 && (
                      <View style={{ gap: 8 }}>
                        <Text style={s.sectionLabel}>Exercícios realizados</Text>
                        {item.workout_session_exercises.map(ex => {
                          const exercise = one(ex.exercises);
                          return (
                            <View key={ex.id} style={s.exerciseCard}>
                              <View style={s.exerciseTop}>
                                <Ionicons name="barbell-outline" size={13} color={primaryColor} />
                                <Text style={s.exerciseName} numberOfLines={1}>{exercise?.name ?? '—'}</Text>
                                {exercise?.muscle_group && (
                                  <View style={s.muscleBadge}>
                                    <Text style={s.muscleBadgeText}>{exercise.muscle_group}</Text>
                                  </View>
                                )}
                              </View>
                              <View style={s.exerciseStats}>
                                {ex.sets_done != null && <Text style={s.exerciseStatText}>{ex.sets_done} séries</Text>}
                                {ex.reps_done && <Text style={s.exerciseStatText}>{ex.reps_done} reps</Text>}
                                {ex.load_used && <Text style={s.exerciseLoadText}>{ex.load_used}</Text>}
                              </View>
                              {ex.feedback && (
                                <View style={s.exerciseFeedbackRow}>
                                  <Ionicons name="chatbox-ellipses-outline" size={11} color={Colors.textSecondary} />
                                  <Text style={s.exerciseFeedback}>{ex.feedback}</Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },

  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 10 },
  pageTitle: {
    fontFamily: FontFamily.display, fontSize: FontSize.lg, color: Colors.textPrimary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 14,
  },

  summaryCard: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1.5, padding: 16, marginBottom: 16, gap: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryNum: { fontFamily: FontFamily.display, fontSize: 26 },
  summaryLabel: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },

  sessionCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  sessionTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  sessionIconWrap: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(96,165,250,0.1)',
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  sessionPlan: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  sessionRoutine: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  sessionDate: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textPrimary },
  sessionTime: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },

  sessionBody: {
    paddingHorizontal: 14, paddingBottom: 16, paddingTop: 4,
    borderTopWidth: 1, borderTopColor: Colors.border, gap: 12,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5,
  },
  metaPillText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  notes: {
    fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary,
    fontStyle: 'italic', lineHeight: 18, borderLeftWidth: 2, borderLeftColor: Colors.border, paddingLeft: 10,
  },

  sectionLabel: {
    fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1,
  },

  healthSection: { backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 10, gap: 8 },
  healthHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  healthSourceText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  healthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  healthItem: { alignItems: 'center', gap: 2, minWidth: 56 },
  healthValue: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.textPrimary },
  healthLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },

  exerciseCard: { backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, gap: 8 },
  exerciseTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseName: { flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  muscleBadge: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  muscleBadgeText: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
  exerciseStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  exerciseStatText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },
  exerciseLoadText: { fontFamily: FontFamily.bodyBold, fontSize: 12, color: Colors.textPrimary },
  exerciseFeedbackRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  exerciseFeedback: { flex: 1, fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' },

  empty: { alignItems: 'center', paddingTop: 64, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
