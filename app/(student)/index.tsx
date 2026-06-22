import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const { width: W } = Dimensions.get('window');

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function StudentHome() {
  const { student, loading: studentLoading } = useStudent();
  const { primaryColor, tenantName } = useThemeStore();

  const [todayPlan, setTodayPlan] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [weekSessions, setWeekSessions] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    if (!student) { if (!studentLoading) setLoading(false); return; }
    loadData(student.id);
  }, [student?.id, studentLoading]);

  async function loadData(studentId: string) {
    const today = new Date().getDay();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const [assignRes, sessionsRes] = await Promise.all([
      supabase
        .from('student_plan_assignments')
        .select('plan_id, workout_plans(id, name, goal, status, workout_routines(id, name, day_of_week, display_order))')
        .eq('student_id', studentId)
        .eq('status', 'active'),
      supabase
        .from('workout_sessions')
        .select('id, started_at, finished_at')
        .eq('student_id', studentId)
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false }),
    ]);

    const sessions: any[] = sessionsRes.data ?? [];
    const assignments: any[] = assignRes.data ?? [];

    let found: any = null;
    for (const a of assignments) {
      const plan = a.workout_plans;
      if (!plan || plan.status !== 'active') continue;
      const routine = (plan.workout_routines ?? []).find((r: any) => r.day_of_week === today);
      if (routine) { found = { plan, routine }; break; }
    }
    setTodayPlan(found);

    const thisWeek = sessions.filter(s => new Date(s.started_at) >= weekStart);
    setWeekSessions(thisWeek.length);
    setTotalSessions(sessions.length);

    const sessionDays = new Set(sessions.map(s => new Date(s.started_at).toDateString()));
    let st = 0;
    const d = new Date();
    while (sessionDays.has(d.toDateString())) { st++; d.setDate(d.getDate() - 1); }
    setStreak(st);
    setLoading(false);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
  }

  if (studentLoading || loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ActivityIndicator color={primaryColor} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const firstName = student?.full_name?.split(' ')[0] ?? 'Aluno';
  const todayLabel = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date().getDay()];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={s.header}>
            <View>
              <Text style={s.greetSmall}>{greeting()},</Text>
              <Text style={s.greetName}>{firstName} 👋</Text>
            </View>
            <View style={[s.avatar, { backgroundColor: `${primaryColor}22` }]}>
              <Text style={[s.avatarText, { color: primaryColor }]}>{firstName[0]?.toUpperCase()}</Text>
            </View>
          </View>
          <View style={[s.tenantPill, { backgroundColor: `${primaryColor}15` }]}>
            <Ionicons name="shield-checkmark" size={11} color={primaryColor} />
            <Text style={[s.tenantPillText, { color: primaryColor }]}>{tenantName}</Text>
          </View>
        </Animated.View>

        {/* Treino de hoje */}
        <Animated.View style={[s.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={s.sectionLabel}>TREINO DE HOJE — {todayLabel.toUpperCase()}</Text>

          {todayPlan ? (
            <View style={[s.todayCard, { borderColor: `${primaryColor}35` }]}>
              <View style={[s.todayStripe, { backgroundColor: primaryColor }]} />
              <View style={{ flex: 1, paddingLeft: 14 }}>
                <Text style={s.todayRoutine}>{todayPlan.routine.name}</Text>
                <Text style={s.todayPlan}>{todayPlan.plan.name}</Text>
                {todayPlan.plan.goal ? (
                  <View style={[s.goalPill, { backgroundColor: `${primaryColor}18` }]}>
                    <Text style={[s.goalPillText, { color: primaryColor }]}>{todayPlan.plan.goal}</Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity
                style={[s.startBtn, { backgroundColor: primaryColor }]}
                onPress={() => router.push(
                  `/(student)/treinos/${todayPlan.plan.id}/executar/${todayPlan.routine.id}` as any
                )}
                activeOpacity={0.85}
              >
                <Ionicons name="play" size={16} color="#fff" />
                <Text style={s.startBtnText}>Iniciar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.restCard}>
              <Ionicons name="moon-outline" size={34} color={Colors.textSecondary} />
              <Text style={s.restTitle}>Dia de descanso</Text>
              <Text style={s.restDesc}>Nenhum treino programado para hoje.</Text>
            </View>
          )}
        </Animated.View>

        {/* Stats */}
        <Animated.View style={[s.section, { opacity: fadeAnim }]}>
          <Text style={s.sectionLabel}>SEUS NÚMEROS</Text>
          <View style={s.statsRow}>
            {[
              { value: streak, icon: 'flame', label: 'Sequência' },
              { value: weekSessions, icon: 'calendar', label: 'Esta semana' },
              { value: totalSessions, icon: 'trophy', label: 'Total' },
            ].map(item => (
              <View key={item.label} style={[s.statCard, { borderColor: `${primaryColor}28` }]}>
                <Text style={[s.statNum, { color: primaryColor }]}>{item.value}</Text>
                <Ionicons name={item.icon as any} size={13} color={primaryColor} />
                <Text style={s.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Atalhos */}
        <Animated.View style={[s.section, { opacity: fadeAnim }]}>
          <Text style={s.sectionLabel}>ATALHOS</Text>
          <View style={s.shortcuts}>
            {[
              { icon: 'barbell-outline', label: 'Treinos', route: '/(student)/treinos' },
              { icon: 'trending-up-outline', label: 'Progresso', route: '/(student)/progresso' },
              { icon: 'calendar-outline', label: 'Frequência', route: '/(student)/mais/frequencia' },
              { icon: 'time-outline', label: 'Histórico', route: '/(student)/mais/historico' },
            ].map(item => (
              <TouchableOpacity
                key={item.label}
                style={[s.shortcutCard, { backgroundColor: `${primaryColor}0E` }]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.75}
              >
                <Ionicons name={item.icon as any} size={26} color={primaryColor} />
                <Text style={[s.shortcutLabel, { color: primaryColor }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greetSmall: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
  greetName: { fontFamily: FontFamily.display, fontSize: 30, color: Colors.textPrimary, marginTop: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FontFamily.bodyBold, fontSize: 20 },
  tenantPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginTop: 14 },
  tenantPillText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  section: { marginTop: 28 },
  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 12 },
  todayCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1.5, padding: 18 },
  todayStripe: { width: 4, borderRadius: 4, minHeight: 64 },
  todayRoutine: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  todayPlan: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 3 },
  goalPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginTop: 8 },
  goalPillText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14 },
  startBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: '#fff' },
  restCard: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 28, alignItems: 'center', gap: 8 },
  restTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  restDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1.5, paddingVertical: 18, alignItems: 'center', gap: 4 },
  statNum: { fontFamily: FontFamily.bodyBold, fontSize: 30 },
  statLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shortcutCard: { width: (W - 50) / 2, borderRadius: 18, padding: 20, alignItems: 'center', gap: 10 },
  shortcutLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },
});
