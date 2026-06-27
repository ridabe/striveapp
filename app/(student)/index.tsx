import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator, Dimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useModulesStore } from '@/stores/modulesStore';
import { MODULE } from '@/lib/modules';
import { TenantLogo } from '@/components/TenantLogo';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const { width: W } = Dimensions.get('window');

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const INTENSITY_LABEL: Record<string, { label: string; emoji: string }> = {
  muito_leve:    { label: 'Muito leve', emoji: '😴' },
  leve:          { label: 'Leve',       emoji: '🙂' },
  moderado:      { label: 'Moderado',   emoji: '💪' },
  intenso:       { label: 'Intenso',    emoji: '🔥' },
  muito_intenso: { label: 'Pesado',     emoji: '😤' },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function fmtDuration(secs: number | null) {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  return m > 0 ? `${m} min` : `${secs}s`;
}

export default function StudentHome() {
  const { selectedStudent, loading: studentLoading } = useStudent();
  const { profile } = useAuthStore();
  const { primaryColor, tenantName, tenantCref } = useThemeStore();
  const { has: hasModule, isLoaded: modulesLoaded } = useModulesStore();

  const [todayPlan, setTodayPlan]       = useState<any>(null);
  const [todaySession, setTodaySession] = useState<any>(null);
  const [streak, setStreak]             = useState(0);
  const [weekSessions, setWeekSessions] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // ── Notification states ────────────────────────────────────────────────────
  const [anamnesePending, setAnamnesePending] = useState(false);
  const [unseenAssignment, setUnseenAssignment] = useState<{
    label: string; route: string; icon: string;
  } | null>(null);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;

  // Recalcula a quantidade de mensagens não lidas para manter o sino sincronizado.
  async function refreshUnreadMessageCount(studentId: string) {
    const { data } = await supabase
      .from('student_messages')
      .select('*')
      .eq('student_id', studentId)
      .is('read_at', null)
      .order('created_at', { ascending: false });

    const unreadMessages = data ?? [];
    setUnreadMessageCount(unreadMessages.length);

    if (unreadMessages.length > 0) {
      setUnseenAssignment({
        label: unreadMessages.length === 1
          ? `Nova mensagem: ${unreadMessages[0].title ?? 'do personal'}`
          : `${unreadMessages.length} mensagens novas do personal`,
        route: '/(student)/mais/mensagens',
        icon: 'notifications-outline',
      });
    } else {
      setUnseenAssignment((prev) => prev?.route === '/(student)/mais/mensagens' ? null : prev);
    }
  }

  useEffect(() => {
    if (!selectedStudent) { if (!studentLoading) setLoading(false); return; }
    loadData(selectedStudent.id, selectedStudent.tenant_id);
  }, [selectedStudent?.id, studentLoading]);

  // Atualiza o sino ao retornar para a home depois de ler mensagens.
  useFocusEffect(
    useCallback(() => {
      if (!selectedStudent?.id) {
        setUnreadMessageCount(0);
        return;
      }

      void refreshUnreadMessageCount(selectedStudent.id);
    }, [selectedStudent?.id])
  );

  // ── Real-time subscription for new assignments ────────────────────────────
  useEffect(() => {
    if (!selectedStudent?.id) return;
    const sid = selectedStudent.id;

    const channel = supabase
      .channel(`student-notify:${sid}:${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'student_plan_assignments',
        filter: `student_id=eq.${sid}`,
      }, async (payload: any) => {
        const { data } = await supabase
          .from('workout_plans').select('name').eq('id', payload.new.plan_id).single();
        setUnseenAssignment({
          label: `Novo plano atribuído: ${data?.name ?? 'Treino'}`,
          route: '/(student)/treinos',
          icon: 'barbell-outline',
        });
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'extra_workouts',
        filter: `student_id=eq.${sid}`,
      }, (payload: any) => {
        setUnseenAssignment({
          label: `Novo treino extra: ${payload.new.name ?? 'Treino extra'}`,
          route: '/(student)/treinos',
          icon: 'flash-outline',
        });
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'student_meal_plan_assignments',
        filter: `student_id=eq.${sid}`,
      }, async (payload: any) => {
        const { data } = await supabase
          .from('meal_plans').select('name').eq('id', payload.new.meal_plan_id).single();
        setUnseenAssignment({
          label: `Novo plano alimentar: ${data?.name ?? 'Dieta'}`,
          route: '/(student)/mais/planos-alimentares',
          icon: 'restaurant-outline',
        });
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'student_messages',
        filter: `student_id=eq.${sid}`,
      }, async (payload: any) => {
        setUnseenAssignment({
          label: payload.new.title ?? 'Nova mensagem do personal',
          route: '/(student)/mais/mensagens',
          icon: 'notifications-outline',
        });
        await refreshUnreadMessageCount(sid);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'student_messages',
        filter: `student_id=eq.${sid}`,
      }, async () => {
        await refreshUnreadMessageCount(sid);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedStudent?.id]);

  // Carrega o resumo inicial da home e os indicadores visuais do aluno.
  async function loadData(studentId: string, tenantId?: string | null) {
    const today     = new Date().getDay();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const weekStart  = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0, 0, 0, 0);

    const [assignRes, sessionsRes, anamneseRes, templateCountRes, messagesRes] = await Promise.all([
      supabase
        .from('student_plan_assignments')
        .select('plan_id, workout_plans(id, name, goal, status, workout_routines(id, name, day_of_week, display_order))')
        .eq('student_id', studentId)
        .eq('status', 'active'),
      supabase
        .from('workout_sessions')
        .select('id, started_at, finished_at, duration_seconds, intensity, workout_plan_id, workout_plans(name)')
        .eq('student_id', studentId)
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false }),
      supabase.from('anamnese_responses').select('completed_at').eq('student_id', studentId).maybeSingle(),
      tenantId
        ? supabase.from('anamnese_templates').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
        : Promise.resolve({ count: 0 }),
      supabase.from('student_messages').select('*').eq('student_id', studentId).is('read_at', null).order('created_at', { ascending: false }),
    ]);

    // Anamnese: show banner if templates exist but not yet filled/completed
    const hasTemplates = (templateCountRes.count ?? 0) > 0;
    const isCompleted  = !!anamneseRes.data?.completed_at;
    setAnamnesePending(hasTemplates && !isCompleted);

    // Check for unread messages to show banner
    const unreadMessages = messagesRes.data ?? [];
    setUnreadMessageCount(unreadMessages.length);
    if (unreadMessages.length > 0) {
      setUnseenAssignment({
        label: unreadMessages.length === 1 
          ? `Nova mensagem: ${unreadMessages[0].title ?? 'do personal'}`
          : `${unreadMessages.length} mensagens novas do personal`,
        route: '/(student)/mais/mensagens',
        icon: 'notifications-outline',
      });
    }

    const sessions: any[]    = sessionsRes.data ?? [];
    const assignments: any[] = assignRes.data ?? [];

    // Today's plan (scheduled by day-of-week)
    let found: any = null;
    for (const a of assignments) {
      const plan = a.workout_plans;
      if (!plan || plan.status !== 'active') continue;
      const routine = (plan.workout_routines ?? []).find((r: any) => r.day_of_week === today);
      if (routine) { found = { plan, routine }; break; }
    }
    setTodayPlan(found);

    // Most recent session completed today
    const latestToday = sessions.find(s => new Date(s.started_at) >= todayStart) ?? null;
    setTodaySession(latestToday);

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
      Animated.timing(fadeAnim,  { toValue: 1, duration: 480, useNativeDriver: true }),
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

  const displayName = selectedStudent?.full_name ?? profile?.full_name ?? 'Aluno';
  const nameFontSize = displayName.length > 20 ? 18 : displayName.length > 15 ? 22 : displayName.length > 10 ? 26 : 30;
  const todayLabel = DAY_LABELS[new Date().getDay()];

  // ── Today card logic ──────────────────────────────────────────────────────
  // Priority: if ANY session was completed today → show "done" card
  // Only show "Iniciar" when today has a scheduled plan AND no session yet
  const trainedToday = !!todaySession;

  function renderTodayCard() {
    // ─ CASE A: Trained today ─────────────────────────────────────────────
    if (trainedToday) {
      const sessionName  = todaySession.workout_plans?.name ?? 'Treino livre';
      const duration     = fmtDuration(todaySession.duration_seconds);
      const intensityCfg = todaySession.intensity ? INTENSITY_LABEL[todaySession.intensity] : null;
      // Were they supposed to train today but hadn't yet done THE planned plan?
      // We still show "done" — the session is what matters.
      const planName = todayPlan && todaySession.workout_plan_id === todayPlan.plan.id
        ? todayPlan.routine.name
        : null;

      return (
        <View style={[s.doneCard, { borderColor: '#4ADE8040' }]}>
          {/* Green stripe */}
          <View style={[s.cardStripe, { backgroundColor: '#4ADE80' }]} />

          <View style={s.doneBody}>
            {/* Header row */}
            <View style={s.doneHeaderRow}>
              <View style={s.doneCheckWrap}>
                <Ionicons name="checkmark-circle" size={24} color="#4ADE80" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.doneTitleText}>Treino concluído!</Text>
                <Text style={s.doneSubText} numberOfLines={1}>
                  {planName ?? sessionName}
                </Text>
              </View>
            </View>

            {/* Stats row */}
            <View style={s.doneStatsRow}>
              {duration && (
                <View style={s.doneStat}>
                  <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
                  <Text style={s.doneStatText}>{duration}</Text>
                </View>
              )}
              {intensityCfg && (
                <View style={s.doneStat}>
                  <Text style={{ fontSize: 13 }}>{intensityCfg.emoji}</Text>
                  <Text style={s.doneStatText}>{intensityCfg.label}</Text>
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={s.doneActions}>
              <TouchableOpacity
                style={s.doneHistBtn}
                onPress={() => router.push('/(student)/mais/historico' as any)}
                activeOpacity={0.75}
              >
                <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                <Text style={s.doneHistBtnText}>Ver histórico</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.doneTreinosBtn, { borderColor: `${primaryColor}40` }]}
                onPress={() => router.push('/(student)/treinos' as any)}
                activeOpacity={0.8}
              >
                <Text style={[s.doneTreinosBtnText, { color: primaryColor }]}>Ver treinos</Text>
                <Ionicons name="chevron-forward" size={14} color={primaryColor} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // ─ CASE B: Scheduled plan, not trained yet ────────────────────────────
    if (todayPlan) {
      return (
        <View style={[s.todayCard, { borderColor: `${primaryColor}35` }]}>
          <View style={[s.cardStripe, { backgroundColor: primaryColor }]} />
          <View style={s.todayBody}>
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
            onPress={() => router.push(`/(student)/treinos/${todayPlan.plan.id}/executar` as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={s.startBtnText}>Iniciar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ─ CASE C: Rest day ───────────────────────────────────────────────────
    return (
      <View style={s.restCard}>
        <Ionicons name="moon-outline" size={34} color={Colors.textSecondary} />
        <Text style={s.restTitle}>Dia de descanso</Text>
        <Text style={s.restDesc}>Nenhum treino programado para hoje.</Text>
        <TouchableOpacity
          onPress={() => router.push('/(student)/treinos' as any)}
          activeOpacity={0.75}
          style={s.restLink}
        >
          <Text style={[s.restLinkText, { color: primaryColor }]}>Ver treinos disponíveis</Text>
          <Ionicons name="chevron-forward" size={14} color={primaryColor} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={s.header}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.greetSmall}>{greeting()},</Text>
              <Text style={[s.greetName, { fontSize: nameFontSize }]} numberOfLines={1} adjustsFontSizeToFit>{displayName} 👋</Text>
            </View>
            <View style={s.headerActions}>
              <TouchableOpacity
                onPress={() => router.push('/(student)/mais/mensagens' as any)}
                activeOpacity={0.8}
                style={[s.notificationBtn, unreadMessageCount > 0 && { borderColor: `${primaryColor}45` }]}
              >
                <Ionicons name="notifications-outline" size={20} color={primaryColor} />
                {unreadMessageCount > 0 && (
                  <View style={[s.notificationBadge, { backgroundColor: primaryColor }]}>
                    <Text style={s.notificationBadgeText}>
                      {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(student)/perfil' as any)} activeOpacity={0.8}>
                <TenantLogo size={44} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.tenantRow}>
            <View style={[s.tenantPill, { backgroundColor: `${primaryColor}15` }]}>
              <Ionicons name="shield-checkmark" size={11} color={primaryColor} />
              <Text style={[s.tenantPillText, { color: primaryColor }]}>{tenantName}</Text>
            </View>
            {!!tenantCref && (
              <View style={s.crefPill}>
                <Ionicons name="id-card-outline" size={11} color={Colors.textSecondary} />
                <Text style={s.crefText}>CREF {tenantCref}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── Banner: anamnese pendente ── */}
        {anamnesePending && (
          <TouchableOpacity
            style={s.bannerWarning}
            onPress={() => router.push('/(student)/mais/anamnese' as any)}
            activeOpacity={0.85}
          >
            <View style={s.bannerIconWrap}>
              <Ionicons name="document-text-outline" size={18} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.bannerTitle}>Anamnese pendente</Text>
              <Text style={s.bannerDesc}>Preencha seu histórico de saúde para que seu personal personalize seu treino.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
          </TouchableOpacity>
        )}

        {/* ── Banner: nova atribuição em tempo real ── */}
        {unseenAssignment && (
          <TouchableOpacity
            style={[s.bannerInfo, { backgroundColor: `${primaryColor}10`, borderColor: `${primaryColor}35` }]}
            onPress={() => { setUnseenAssignment(null); router.push(unseenAssignment.route as any); }}
            activeOpacity={0.85}
          >
            <View style={[s.bannerIconWrapBlue, { backgroundColor: `${primaryColor}18` }]}>
              <Ionicons name={unseenAssignment.icon as any} size={18} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.bannerTitleBlue}>Nova atribuição!</Text>
              <Text style={s.bannerDescBlue}>{unseenAssignment.label}</Text>
            </View>
            <TouchableOpacity onPress={() => setUnseenAssignment(null)} style={s.bannerClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Ionicons name="close" size={16} color={primaryColor} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* Treino de hoje */}
        <Animated.View style={[s.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={s.sectionLabel}>TREINO DE HOJE — {todayLabel.toUpperCase()}</Text>
          {renderTodayCard()}
        </Animated.View>

        {/* Stats */}
        <Animated.View style={[s.section, { opacity: fadeAnim }]}>
          <Text style={s.sectionLabel}>SEUS NÚMEROS</Text>
          <View style={s.statsRow}>
            {[
              { value: streak,        icon: 'flame',    label: 'Sequência' },
              { value: weekSessions,  icon: 'calendar', label: 'Esta semana' },
              { value: totalSessions, icon: 'trophy',   label: 'Total' },
            ].map(item => (
              <View key={item.label} style={[s.statCard, { borderColor: `${primaryColor}28` }]}>
                <Text style={[s.statNum, { color: primaryColor }]}>{item.value}</Text>
                <Ionicons name={item.icon as any} size={13} color={primaryColor} />
                <Text style={s.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Atalhos — filtrados por módulos habilitados */}
        <Animated.View style={[s.section, { opacity: fadeAnim }]}>
          <Text style={s.sectionLabel}>ATALHOS</Text>
          <View style={s.shortcuts}>
            {(
              [
                { icon: 'barbell-outline',     label: 'Treinos',    route: '/(student)/treinos',           slug: MODULE.PLANOS_TREINO },
                { icon: 'chatbubble-outline',  label: 'Mensagens',  route: '/(student)/mais/mensagens',    slug: null },
                { icon: 'trending-up-outline', label: 'Progresso',  route: '/(student)/progresso',         slug: MODULE.MEU_PROGRESSO },
                { icon: 'calendar-outline',    label: 'Frequência', route: '/(student)/mais/frequencia',   slug: MODULE.FREQUENCIA },
                { icon: 'time-outline',        label: 'Histórico',  route: '/(student)/mais/historico',    slug: MODULE.EXECUCAO_TREINO },
                { icon: 'folder-outline',      label: 'Arquivos',   route: '/(student)/mais/arquivos',     slug: MODULE.ARQUIVOS },
                { icon: 'star-outline',        label: 'Feedback',   route: '/(student)/mais/feedback',     slug: MODULE.FEEDBACKS },
                { icon: 'restaurant-outline',  label: 'Planos Alimentares', route: '/(student)/mais/planos-alimentares', slug: MODULE.PLANOS_ALIMENTARES },
                { icon: 'calendar-outline',    label: 'Agenda',     route: '/(student)/mais/agenda',       slug: MODULE.MINHA_AGENDA },
                { icon: 'trophy-outline',      label: 'Ranking',    route: '/(student)/mais/ranking',      slug: null },
              ] as { icon: string; label: string; route: string; slug: string | null }[]
            )
              .filter(item => !modulesLoaded || item.slug === null || hasModule(item.slug as any))
              .map(item => (
                <TouchableOpacity
                  key={item.label}
                  style={[s.shortcutCard, { backgroundColor: `${primaryColor}0E` }]}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.75}
                >
                  {item.route === '/(student)/mais/mensagens' && unreadMessageCount > 0 && (
                    <View style={[s.shortcutBadge, { backgroundColor: primaryColor }]}>
                      <Text style={s.shortcutBadgeText}>
                        {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                      </Text>
                    </View>
                  )}
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
  safe:         { flex: 1, backgroundColor: Colors.bg },
  scroll:       { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 18 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerActions:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  greetSmall:   { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
  greetName:    { fontFamily: FontFamily.display, fontSize: 30, color: Colors.textPrimary, marginTop: 2 },
  notificationBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  notificationBadgeText: { fontFamily: FontFamily.bodyBold, fontSize: 10, color: '#fff' },
  avatar:       { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontFamily: FontFamily.bodyBold, fontSize: 20 },
  tenantRow:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tenantPill:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  tenantPillText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  crefPill:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  crefText:     { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
  section:      { marginTop: 28 },
  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 12 },

  // ── Today card shared ──────────────────────────────────────────────────────
  cardStripe: { width: 4, borderRadius: 4, alignSelf: 'stretch' },

  // ── "Iniciar" card (has plan, not yet done) ──────────────────────────────
  todayCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1.5, overflow: 'hidden' },
  todayBody:    { flex: 1, padding: 16 },
  todayRoutine: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  todayPlan:    { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 3 },
  goalPill:     { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginTop: 8 },
  goalPillText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  startBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, margin: 14 },
  startBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: '#fff' },

  // ── "Concluído" card ──────────────────────────────────────────────────────
  doneCard:       { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1.5, overflow: 'hidden' },
  doneBody:       { flex: 1, padding: 14, gap: 10 },
  doneHeaderRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doneCheckWrap:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#4ADE8018', alignItems: 'center', justifyContent: 'center' },
  doneTitleText:  { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  doneSubText:    { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  doneStatsRow:   { flexDirection: 'row', gap: 14 },
  doneStat:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  doneStatText:   { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },
  doneActions:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doneHistBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  doneHistBtnText:{ fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  doneTreinosBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1 },
  doneTreinosBtnText: { fontFamily: FontFamily.bodyBold, fontSize: 12 },

  // ── Rest day card ─────────────────────────────────────────────────────────
  restCard:     { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 28, alignItems: 'center', gap: 8 },
  restTitle:    { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  restDesc:     { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
  restLink:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  restLinkText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsRow:   { flexDirection: 'row', gap: 10 },
  statCard:   { flex: 1, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1.5, paddingVertical: 18, alignItems: 'center', gap: 4 },
  statNum:    { fontFamily: FontFamily.bodyBold, fontSize: 30 },
  statLabel:  { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },

  // ── Banners ───────────────────────────────────────────────────────────────
  bannerWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F59E0B12',
    borderWidth: 1, borderColor: '#F59E0B35',
    borderRadius: 16, padding: 14, marginBottom: 12,
  },
  bannerInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12,
  },
  bannerIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F59E0B18', alignItems: 'center', justifyContent: 'center',
  },
  bannerIconWrapBlue: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  bannerTitle: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: '#F59E0B' },
  bannerDesc:  { fontFamily: FontFamily.body, fontSize: 11, color: '#F59E0B', opacity: 0.8, marginTop: 2, lineHeight: 15 },
  bannerTitleBlue: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: Colors.textPrimary },
  bannerDescBlue:  { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2, lineHeight: 15 },
  bannerClose: { padding: 4 },

  // ── Shortcuts ─────────────────────────────────────────────────────────────
  shortcuts:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shortcutCard: { width: (W - 50) / 2, borderRadius: 18, padding: 20, alignItems: 'center', gap: 10, position: 'relative' },
  shortcutLabel:{ fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },
  shortcutBadge: {
    position: 'absolute', top: 10, right: 10, minWidth: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  shortcutBadgeText: { fontFamily: FontFamily.bodyBold, fontSize: 10, color: '#fff' },
});
