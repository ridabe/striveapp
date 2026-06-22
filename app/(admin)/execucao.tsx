import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

interface SessionSummary {
  id: string;
  student_id: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  intensity: string | null;
  notes: string | null;
  workout_plan_name: string | null;
  workout_routine_name: string | null;
}

interface StudentSummary {
  id: string;
  full_name: string;
  totalSessions: number;
  lastSession: string | null;
}

const INTENSITY_CONFIG: Record<string, { label: string; color: string }> = {
  muito_leve: { label: 'Muito leve', color: '#94A3B8' },
  leve:       { label: 'Leve',       color: '#60A5FA' },
  moderado:   { label: 'Moderado',   color: '#4ADE80' },
  intenso:    { label: 'Intenso',    color: '#F59E0B' },
  muito_intenso: { label: 'Muito intenso', color: '#EF4444' },
};

function fmtDuration(secs: number | null): string {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}min${s > 0 ? ` ${s}s` : ''}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function ExecucaoScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? '';

  const [studentList, setStudentList] = useState<StudentSummary[]>([]);
  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const [studentsRes, sessionsRes] = await Promise.all([
      supabase.from('students').select('id, full_name').eq('tenant_id', tenantId).order('full_name'),
      supabase.from('workout_sessions').select('student_id, started_at, finished_at')
        .eq('tenant_id', tenantId).order('started_at', { ascending: false }),
    ]);

    const allSessions: any[] = sessionsRes.data ?? [];
    const summary: StudentSummary[] = (studentsRes.data ?? []).map((s: any) => {
      const sts = allSessions.filter(sess => sess.student_id === s.id && sess.finished_at);
      return {
        id: s.id,
        full_name: s.full_name,
        totalSessions: sts.length,
        lastSession: sts[0]?.started_at ?? null,
      };
    }).filter((s: StudentSummary) => s.totalSessions > 0);

    setStudentList(summary);
  }, [tenantId]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function handleSelectStudent(student: StudentSummary) {
    setSelected(student);
    setLoadingDetail(true);
    const { data } = await supabase.from('workout_sessions')
      .select(`
        id, student_id, started_at, finished_at, duration_seconds, intensity, notes,
        workout_plans(name),
        workout_routines(name)
      `)
      .eq('student_id', student.id)
      .not('finished_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(30);

    setSessions((data ?? []).map((s: any) => ({
      ...s,
      workout_plan_name: s.workout_plans?.name ?? null,
      workout_routine_name: s.workout_routines?.name ?? null,
    })));
    setLoadingDetail(false);
  }

  // Student list view
  if (!selected) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.title}>Histórico de Execução</Text>
          <View style={{ width: 38 }} />
        </View>

        {loading ? <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} /> : (
          <FlatList
            data={studentList}
            keyExtractor={st => st.id}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={s.summaryCard}>
                <View style={s.summaryItem}>
                  <Text style={[s.summaryNum, { color: primaryColor }]}>{studentList.length}</Text>
                  <Text style={s.summaryLabel}>Alunos ativos</Text>
                </View>
                <View style={s.summaryItem}>
                  <Text style={[s.summaryNum, { color: primaryColor }]}>
                    {studentList.reduce((acc, s) => acc + s.totalSessions, 0)}
                  </Text>
                  <Text style={s.summaryLabel}>Sessões totais</Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="play-circle-outline" size={52} color={Colors.border} />
                <Text style={s.emptyTitle}>Nenhuma sessão registrada</Text>
                <Text style={s.emptyText}>Os treinos executados pelos alunos aparecerão aqui.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const initials = item.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <TouchableOpacity style={s.studentCard}
                  onPress={() => handleSelectStudent(item)} activeOpacity={0.75}>
                  <View style={[s.avatar, { backgroundColor: `${primaryColor}20` }]}>
                    <Text style={[s.avatarText, { color: primaryColor }]}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.studentName}>{item.full_name}</Text>
                    <Text style={s.studentMeta}>
                      {item.totalSessions} sessão{item.totalSessions !== 1 ? 'ões' : ''}
                      {item.lastSession ? ` · última ${fmtDate(item.lastSession)}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    );
  }

  // Session detail view
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => setSelected(null)} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{selected.full_name.split(' ')[0]}</Text>
        <View style={{ width: 38 }} />
      </View>

      {loadingDetail ? <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} /> : (
        <FlatList
          data={sessions}
          keyExtractor={ss => ss.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={s.studentHeader}>
              <View style={[s.avatarLg, { backgroundColor: `${primaryColor}20` }]}>
                <Text style={[s.avatarLgText, { color: primaryColor }]}>
                  {selected.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <Text style={s.studentHeaderName}>{selected.full_name}</Text>
              <View style={s.studentHeaderMeta}>
                <View style={s.metaChip}>
                  <Text style={[s.metaChipText, { color: primaryColor }]}>{selected.totalSessions}</Text>
                  <Text style={s.metaChipLabel}>sessões</Text>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="calendar-outline" size={40} color={Colors.border} />
              <Text style={s.emptyTitle}>Sem sessões registradas</Text>
            </View>
          }
          renderItem={({ item }) => {
            const ic = item.intensity ? INTENSITY_CONFIG[item.intensity] : null;
            return (
              <View style={s.sessionCard}>
                <View style={s.sessionHeader}>
                  <View>
                    <Text style={s.sessionDate}>{fmtDate(item.started_at)}</Text>
                    <Text style={s.sessionTime}>{fmtTime(item.started_at)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {ic && (
                      <View style={[s.intensityBadge, { backgroundColor: `${ic.color}18` }]}>
                        <Text style={[s.intensityText, { color: ic.color }]}>{ic.label}</Text>
                      </View>
                    )}
                    <Text style={s.duration}>
                      <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
                      {' '}{fmtDuration(item.duration_seconds)}
                    </Text>
                  </View>
                </View>
                {(item.workout_plan_name || item.workout_routine_name) && (
                  <View style={s.sessionPlan}>
                    <Ionicons name="document-text-outline" size={13} color={Colors.textSecondary} />
                    <Text style={s.sessionPlanText} numberOfLines={1}>
                      {[item.workout_plan_name, item.workout_routine_name].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                )}
                {item.notes && (
                  <Text style={s.sessionNotes} numberOfLines={2}>{item.notes}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, flex: 1, marginHorizontal: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 12, gap: 8 },
  summaryCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 16, gap: 16 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryNum: { fontFamily: FontFamily.bodyBold, fontSize: 28 },
  summaryLabel: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },
  studentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FontFamily.bodyBold, fontSize: 15 },
  studentName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  studentMeta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  studentHeader: { alignItems: 'center', paddingVertical: 24, gap: 10, marginBottom: 8 },
  avatarLg: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarLgText: { fontFamily: FontFamily.bodyBold, fontSize: 22 },
  studentHeaderName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  studentHeaderMeta: { flexDirection: 'row', gap: 10 },
  metaChip: { alignItems: 'center', gap: 2 },
  metaChipText: { fontFamily: FontFamily.bodyBold, fontSize: 20 },
  metaChipLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  sessionCard: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 8 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sessionDate: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  sessionTime: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  intensityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  intensityText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  duration: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },
  sessionPlan: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sessionPlanText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, flex: 1 },
  sessionNotes: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 18 },
});
