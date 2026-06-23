import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { TenantLogo } from '@/components/TenantLogo';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { GOAL_COLORS, extraCategoryLabel } from '@/lib/exerciseConfig';

const { width: W } = Dimensions.get('window');

// Sunday-first, matching JavaScript Date.getDay()
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_SHORT  = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const CATEGORY_ICON: Record<string, any> = {
  aquecimento: 'flame-outline', hiit: 'flash-outline', mobilidade: 'body-outline',
  cardio: 'heart-outline', desafio: 'trophy-outline', forca: 'barbell-outline', outros: 'ellipsis-horizontal-outline',
};
const CATEGORY_COLOR: Record<string, string> = {
  aquecimento: '#F97316', hiit: '#EF4444', mobilidade: '#8B5CF6',
  cardio: '#EC4899', desafio: '#F59E0B', forca: '#3B82F6', outros: '#64748B',
};

interface Plan {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  routines: { id: string; name: string; day_of_week: number | null }[];
}

interface ExtraWorkout {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

// ─── Weekly tracker ───────────────────────────────────────────────────────────

function WeekTracker({ executedDays, primaryColor }: { executedDays: Set<number>; primaryColor: string }) {
  const today = new Date().getDay();
  const count = executedDays.size;

  // Week range label (Sun–Sat)
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  const rangeLabel = `${fmt(weekStart)} – ${fmt(weekEnd)}`;

  return (
    <View style={[wt.card, { borderColor: `${primaryColor}25` }]}>
      <View style={wt.cardTop}>
        <View>
          <Text style={wt.cardTitle}>ESTA SEMANA</Text>
          <Text style={wt.rangeText}>{rangeLabel}</Text>
        </View>
        <View style={[wt.countBadge, { backgroundColor: `${primaryColor}18` }]}>
          <Text style={[wt.countNum, { color: primaryColor }]}>{count}</Text>
          <Text style={[wt.countLabel, { color: primaryColor }]}>treino{count !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <View style={wt.dotsRow}>
        {DAY_LABELS.map((label, idx) => {
          const done = executedDays.has(idx);
          const isToday = idx === today;
          return (
            <View key={idx} style={wt.dayCol}>
              <View
                style={[
                  wt.dot,
                  done && { backgroundColor: primaryColor },
                  isToday && !done && { borderColor: primaryColor, borderWidth: 1.5 },
                  isToday && done && wt.dotTodayDone,
                ]}
              >
                <Text style={[
                  wt.dotText,
                  done && { color: '#fff' },
                  isToday && !done && { color: primaryColor },
                  !done && !isToday && { color: Colors.textSecondary },
                ]}>
                  {DAY_SHORT[idx]}
                </Text>
                {done && (
                  <View style={[wt.checkMark, { backgroundColor: primaryColor }]}>
                    <Ionicons name="checkmark" size={8} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={[wt.dayLabel, isToday && { color: primaryColor, fontFamily: FontFamily.bodyBold }]}>
                {label.substring(0, 3)}
              </Text>
            </View>
          );
        })}
      </View>

      {count === 0 && (
        <Text style={wt.motivational}>Nenhum treino concluído ainda. Vai lá! 💪</Text>
      )}
      {count > 0 && count < 5 && (
        <Text style={wt.motivational}>Boa semana! Continue assim.</Text>
      )}
      {count >= 5 && (
        <Text style={[wt.motivational, { color: primaryColor }]}>Semana incrível! {count} treinos concluídos 🔥</Text>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TreinosScreen() {
  const { student } = useStudent();
  const { primaryColor } = useThemeStore();

  const [tab, setTab] = useState<'treinos' | 'extras'>('treinos');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [extras, setExtras] = useState<ExtraWorkout[]>([]);
  const [executedDays, setExecutedDays] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!student) return;

    // Current week bounds (Sun → Sat)
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const [assignRes, extraRes, sessionsRes] = await Promise.all([
      supabase
        .from('student_plan_assignments')
        .select('plan_id, status, workout_plans(id, name, goal, status, workout_routines(id, name, day_of_week, display_order))')
        .eq('student_id', student.id)
        .order('assigned_at', { ascending: false }),
      supabase
        .from('extra_workouts')
        .select('id, name, category, description')
        .eq('student_id', student.id)
        .eq('is_template', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('workout_sessions')
        .select('started_at')
        .eq('student_id', student.id)
        .not('finished_at', 'is', null)
        .gte('started_at', weekStart.toISOString())
        .lte('started_at', weekEnd.toISOString()),
    ]);

    const mapped: Plan[] = (assignRes.data ?? [])
      .filter((a: any) => a.workout_plans)
      .map((a: any) => ({
        id: a.workout_plans.id,
        name: a.workout_plans.name,
        goal: a.workout_plans.goal,
        status: a.workout_plans.status,
        routines: (a.workout_plans.workout_routines ?? [])
          .sort((x: any, y: any) => x.display_order - y.display_order),
      }));

    const days = new Set<number>(
      (sessionsRes.data ?? []).map((s: any) => new Date(s.started_at).getDay())
    );

    setPlans(mapped);
    setExtras(extraRes.data ?? []);
    setExecutedDays(days);
    setLoading(false);
  }, [student?.id]);

  useEffect(() => { load(); }, [load]);

  // Scheduled days display for a plan: e.g. "Seg · Qua · Sex"
  function scheduledDaysText(routines: Plan['routines']): string {
    const scheduled = routines
      .filter(r => r.day_of_week != null)
      .map(r => DAY_LABELS[r.day_of_week!])
      .filter(Boolean);
    return scheduled.length > 0 ? scheduled.join(' · ') : '';
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.headerRow}>
          <Text style={s.title}>Treinos</Text>
        </View>
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.headerRow}>
        <Text style={s.title}>Treinos</Text>
        <TenantLogo size={36} />
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['treinos', 'extras'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, tab === t && { borderBottomColor: primaryColor }]}
            onPress={() => setTab(t)}
            activeOpacity={0.75}
          >
            <Text style={[s.tabText, tab === t && { color: primaryColor }]}>
              {t === 'treinos' ? `Treinos (${plans.length})` : `Extras (${extras.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'treinos' ? (
        <FlatList
          data={plans}
          keyExtractor={p => p.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <WeekTracker executedDays={executedDays} primaryColor={primaryColor} />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="document-text-outline" size={48} color={Colors.border} />
              <Text style={s.emptyTitle}>Nenhum treino atribuído</Text>
              <Text style={s.emptyDesc}>Seu treinador ainda não atribuiu nenhum treino.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const goalColor = GOAL_COLORS[item.goal ?? ''] ?? primaryColor;
            const days = scheduledDaysText(item.routines);
            return (
              <TouchableOpacity
                style={s.planCard}
                onPress={() => router.push(`/(student)/treinos/${item.id}/executar` as any)}
                activeOpacity={0.8}
              >
                {/* Active status stripe */}
                {item.status === 'active' && (
                  <View style={[s.activeStripe, { backgroundColor: primaryColor }]} />
                )}

                <View style={s.planContent}>
                  {/* Name + goal */}
                  <View style={s.planTop}>
                    <Text style={s.planName} numberOfLines={1}>{item.name}</Text>
                    {item.goal && (
                      <View style={[s.pill, { backgroundColor: `${goalColor}20` }]}>
                        <Text style={[s.pillText, { color: goalColor }]}>{item.goal}</Text>
                      </View>
                    )}
                  </View>

                  {/* Scheduled days */}
                  {days.length > 0 && (
                    <View style={s.scheduledRow}>
                      <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
                      <Text style={s.scheduledText}>{days}</Text>
                    </View>
                  )}

                  {/* Meta */}
                  <View style={s.planMeta}>
                    <Ionicons name="barbell-outline" size={12} color={Colors.textSecondary} />
                    <Text style={s.planMetaText}>
                      {item.routines.length} {item.routines.length !== 1 ? 'Exercícios' : 'Exercício'}
                    </Text>
                    <View style={[s.statusDot, { backgroundColor: item.status === 'active' ? '#4ADE80' : Colors.border }]} />
                    <Text style={s.planMetaText}>{item.status === 'active' ? 'Ativo' : 'Inativo'}</Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <FlatList
          data={extras}
          keyExtractor={e => e.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="flash-outline" size={48} color={Colors.border} />
              <Text style={s.emptyTitle}>Nenhum treino extra</Text>
              <Text style={s.emptyDesc}>Seu treinador ainda não atribuiu treinos extras.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cc = CATEGORY_COLOR[item.category] ?? '#64748B';
            const icon = CATEGORY_ICON[item.category] ?? 'flash-outline';
            return (
              <TouchableOpacity
                style={s.extraCard}
                onPress={() => router.push(`/(student)/treinos/extras/${item.id}/executar` as any)}
                activeOpacity={0.8}
              >
                <View style={[s.extraIcon, { backgroundColor: `${cc}18` }]}>
                  <Ionicons name={icon} size={22} color={cc} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.extraName} numberOfLines={1}>{item.name}</Text>
                  <View style={[s.pill, { backgroundColor: `${cc}18`, alignSelf: 'flex-start', marginTop: 4 }]}>
                    <Text style={[s.pillText, { color: cc }]}>{extraCategoryLabel(item.category)}</Text>
                  </View>
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

// ─── Week tracker styles ──────────────────────────────────────────────────────

const DOT_SIZE = Math.floor((W - 32 - 24 - 12 * 6) / 7); // fit 7 dots with gaps

const wt = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, padding: 18, marginBottom: 14, gap: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },
  rangeText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  countBadge: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  countNum: { fontFamily: FontFamily.bodyBold, fontSize: 22, lineHeight: 26 },
  countLabel: { fontFamily: FontFamily.body, fontSize: 10, letterSpacing: 0.5 },

  dotsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 6 },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dotTodayDone: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  dotText: { fontFamily: FontFamily.bodyBold, fontSize: 11 },
  checkMark: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.surface },
  dayLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
  motivational: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center', marginTop: 2 },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  title: { fontFamily: FontFamily.display, fontSize: 28, color: Colors.textPrimary },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, marginTop: 4 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 10 },

  planCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', paddingRight: 14 },
  activeStripe: { width: 4, alignSelf: 'stretch' },
  planContent: { flex: 1, padding: 14, gap: 6 },
  planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  planName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, flexShrink: 0 },
  pillText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  scheduledRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  scheduledText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },
  planMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  planMetaText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 4 },

  extraCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 12 },
  extraIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  extraName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  empty: { alignItems: 'center', paddingTop: 64, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
