import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Animated, FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const WEEK_DAYS = ['D','S','T','Q','Q','S','S'];

function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }

interface AttRecord {
  id: string;
  student_id: string;
  attended_at: string;
  notes: string | null;
}

interface Student {
  id: string;
  full_name: string;
  status: string;
}

interface StudentSummary extends Student {
  totalRecords: number;
  thisMonth: number;
  lastDate: string | null;
}

function AnimCounter({ value, suffix = '', color }: { value: number; suffix?: string; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => setDisp(Math.floor(v)));
    Animated.timing(anim, { toValue: value, duration: 900, useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value]);
  return (
    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 28, color }}>
      {disp}{suffix}
    </Text>
  );
}

// ─── Student list screen ──────────────────────────────────────────────────────
function StudentListView({
  students, loading, primaryColor, onSelect,
}: {
  students: StudentSummary[];
  loading: boolean;
  primaryColor: string;
  onSelect: (s: StudentSummary) => void;
}) {
  const now = new Date();

  if (loading) return <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />;

  return (
    <FlatList
      data={students}
      keyExtractor={s => s.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 12 }}
      ListHeaderComponent={
        <View style={sl.statsRow}>
          <View style={sl.statCard}>
            <Text style={[sl.statNum, { color: primaryColor }]}>{students.length}</Text>
            <Text style={sl.statLabel}>Alunos</Text>
          </View>
          <View style={sl.statCard}>
            <Text style={[sl.statNum, { color: primaryColor }]}>
              {students.reduce((s, a) => s + a.thisMonth, 0)}
            </Text>
            <Text style={sl.statLabel}>Check-ins este mês</Text>
          </View>
          <View style={sl.statCard}>
            <Text style={[sl.statNum, { color: primaryColor }]}>
              {students.reduce((s, a) => s + a.totalRecords, 0)}
            </Text>
            <Text style={sl.statLabel}>Total geral</Text>
          </View>
        </View>
      }
      renderItem={({ item }) => {
        const initials = item.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
        const lastDateStr = item.lastDate
          ? (() => { const d = new Date(item.lastDate); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; })()
          : null;
        return (
          <TouchableOpacity style={sl.card} onPress={() => onSelect(item)} activeOpacity={0.75}>
            <View style={[sl.avatar, { backgroundColor: `${primaryColor}20` }]}>
              <Text style={[sl.avatarLetter, { color: primaryColor }]}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sl.name}>{item.full_name}</Text>
              <Text style={sl.sub}>
                {item.totalRecords === 0
                  ? 'Nenhum treino registrado'
                  : `${item.thisMonth} treino(s) este mês · ${item.totalRecords} total`}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              {lastDateStr && (
                <View style={[sl.dateBadge, { backgroundColor: `${primaryColor}15` }]}>
                  <Ionicons name="calendar-outline" size={11} color={primaryColor} />
                  <Text style={[sl.dateText, { color: primaryColor }]}>{lastDateStr}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={sl.empty}>
          <Ionicons name="people-outline" size={52} color={Colors.border} />
          <Text style={sl.emptyTitle}>Nenhum aluno</Text>
          <Text style={sl.emptyText}>Cadastre alunos para acompanhar a frequência.</Text>
        </View>
      }
    />
  );
}

// ─── Student detail screen ────────────────────────────────────────────────────
function StudentDetailView({
  student, records, primaryColor,
}: {
  student: StudentSummary;
  records: AttRecord[];
  primaryColor: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dowToday = today.getDay();
  const startDay = new Date(today);
  startDay.setDate(today.getDate() - (dowToday + 28));
  const calDays: Date[] = [];
  for (let i = 0; i < 35; i++) {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);
    calDays.push(d);
  }

  const attendedDates = new Set(records.map(r => toDateStr(new Date(r.attended_at))));

  let streak = 0;
  const sd = new Date(today);
  while (attendedDates.has(toDateStr(sd))) { streak++; sd.setDate(sd.getDate() - 1); }

  const attendedThisMonth = new Set(
    records.filter(r => {
      const d = new Date(r.attended_at);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }).map(r => toDateStr(new Date(r.attended_at))),
  ).size;
  const monthPct = today.getDate() > 0 ? Math.round((attendedThisMonth / today.getDate()) * 100) : 0;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Stats */}
      <View style={det.statsRow}>
        <View style={det.statCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 20 }}>🔥</Text>
            <AnimCounter value={streak} color={primaryColor} />
          </View>
          <Text style={det.statLabel}>Sequência{'\n'}atual</Text>
        </View>
        <View style={det.statCard}>
          <AnimCounter value={attendedThisMonth} color={primaryColor} />
          <Text style={det.statLabel}>Treinos{'\n'}este mês</Text>
        </View>
        <View style={det.statCard}>
          <AnimCounter value={monthPct} suffix="%" color={primaryColor} />
          <Text style={det.statLabel}>% do{'\n'}mês</Text>
        </View>
      </View>

      {/* Heat map */}
      <View style={det.calCard}>
        <Text style={det.calTitle}>ÚLTIMAS 5 SEMANAS</Text>
        <View style={det.calRow}>
          {WEEK_DAYS.map((d, i) => <Text key={i} style={det.weekLabel}>{d}</Text>)}
        </View>
        {Array.from({ length: 5 }, (_, week) => (
          <View key={week} style={det.calRow}>
            {Array.from({ length: 7 }, (_, dow) => {
              const day = calDays[week * 7 + dow];
              const str = toDateStr(day);
              const isToday = str === toDateStr(today);
              const hasAtt = attendedDates.has(str);
              const isFuture = day > today;
              return (
                <View key={dow} style={[
                  det.calCell,
                  hasAtt && { backgroundColor: primaryColor },
                  isToday && !hasAtt && { borderWidth: 1.5, borderColor: primaryColor },
                  isFuture && { opacity: 0.15 },
                ]}>
                  {isToday && (
                    <Text style={[det.calCellText, { color: hasAtt ? '#000' : primaryColor }]}>
                      {day.getDate()}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
        <View style={det.legend}>
          <View style={[det.legendDot, { backgroundColor: Colors.border }]} />
          <Text style={det.legendText}>Sem registro</Text>
          <View style={[det.legendDot, { backgroundColor: primaryColor }]} />
          <Text style={det.legendText}>Treinou</Text>
        </View>
      </View>

      {/* Records list */}
      <Text style={[det.sectionLabel, { marginHorizontal: 16 }]}>REGISTROS RECENTES</Text>
      {records.length === 0 ? (
        <View style={det.empty}>
          <Ionicons name="calendar-outline" size={48} color={Colors.border} />
          <Text style={det.emptyText}>Nenhum treino registrado ainda.</Text>
        </View>
      ) : (
        records.slice(0, 30).map(item => {
          const d = new Date(item.attended_at);
          return (
            <View key={item.id} style={det.recordCard}>
              <View style={[det.dot, { backgroundColor: primaryColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={det.recordDate}>
                  {d.getDate()} {MONTHS[d.getMonth()]} {d.getFullYear()}
                </Text>
                <Text style={det.recordNote}>{item.notes ?? 'Treino concluído'}</Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function FrequenciaScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const { studentId } = useLocalSearchParams<{ studentId?: string }>();
  const tenantId = profile?.tenant_id;

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [detailRecords, setDetailRecords] = useState<AttRecord[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [stRes, attRes, monthRes] = await Promise.all([
      supabase.from('students').select('id, full_name, status').eq('tenant_id', tenantId).order('full_name'),
      supabase.from('attendance').select('student_id, attended_at').eq('tenant_id', tenantId).order('attended_at', { ascending: false }),
      supabase.from('attendance').select('student_id, attended_at').eq('tenant_id', tenantId).gte('attended_at', monthStart),
    ]);

    const allRec: { student_id: string; attended_at: string }[] = attRes.data ?? [];
    const monthRec: { student_id: string; attended_at: string }[] = monthRes.data ?? [];

    const summary: StudentSummary[] = (stRes.data ?? []).map((s: Student) => {
      const recs = allRec.filter(r => r.student_id === s.id);
      const monthDates = new Set(monthRec.filter(r => r.student_id === s.id).map(r => toDateStr(new Date(r.attended_at))));
      return {
        ...s,
        totalRecords: recs.length,
        thisMonth: monthDates.size,
        lastDate: recs[0]?.attended_at ?? null,
      };
    });

    setStudents(summary);

    // Auto-select if coming from student detail
    if (studentId) {
      const match = summary.find(st => st.id === studentId);
      if (match) {
        setSelected(match);
        setLoadingDetail(true);
        const { data } = await supabase.from('attendance')
          .select('id, student_id, attended_at, notes')
          .eq('student_id', match.id)
          .order('attended_at', { ascending: false });
        setDetailRecords(data ?? []);
        setLoadingDetail(false);
      }
    }
  }, [tenantId, studentId]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function handleSelect(s: StudentSummary) {
    setSelected(s);
    setLoadingDetail(true);
    const { data } = await supabase.from('attendance')
      .select('id, student_id, attended_at, notes')
      .eq('student_id', s.id)
      .order('attended_at', { ascending: false });
    setDetailRecords(data ?? []);
    setLoadingDetail(false);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => {
            if (studentId) { router.back(); return; }
            selected ? setSelected(null) : router.back();
          }}
          style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>
          {selected ? selected.full_name.split(' ')[0] : 'Frequência'}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {selected ? (
        loadingDetail
          ? <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
          : <StudentDetailView student={selected} records={detailRecords} primaryColor={primaryColor} />
      ) : (
        <StudentListView
          students={students} loading={loading}
          primaryColor={primaryColor} onSelect={handleSelect}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, flex: 1, textAlign: 'center' },
});

const sl = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 4,
  },
  statNum: { fontFamily: FontFamily.bodyBold, fontSize: 22 },
  statLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, padding: 14, marginBottom: 10,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: FontFamily.bodyBold, fontSize: 16 },
  name: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  sub: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 3 },
  dateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  dateText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

const det = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 16, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, padding: 14, alignItems: 'center', gap: 6,
  },
  statLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, textAlign: 'center', lineHeight: 15 },

  calCard: {
    marginHorizontal: 16, marginBottom: 20, backgroundColor: Colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16,
  },
  calTitle: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 10 },
  calRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  weekLabel: { width: 36, textAlign: 'center', fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
  calCell: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  calCellText: { fontFamily: FontFamily.bodyBold, fontSize: 9 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, justifyContent: 'flex-end' },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginRight: 6 },

  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 10 },

  recordCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  recordDate: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  recordNote: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  empty: { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
});
