import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { StriveLoader } from '@/components/StriveLoader';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { useModulesStore } from '@/stores/modulesStore';
import { MODULE } from '@/lib/modules';
import { TenantLogo } from '@/components/TenantLogo';
import { MaxOnboardingModal } from '@/components/ai/MaxOnboardingModal';
import { ModuleOnboardingPopup } from '@/components/onboarding/ModuleOnboardingPopup';
import { TrainerNotificationBell } from '@/components/notifications/TrainerNotificationBell';

interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  pendingPayments: number;
  activePlans: number;
  maxStudents: number;
}

// Convenção do plano "Elite": max_students >= UNLIMITED_THRESHOLD significa ilimitado
const UNLIMITED_THRESHOLD = 9999;

interface TodayAttendance {
  student_id: string;
  full_name: string;
  attended_at: string;
}

export default function AdminDashboard() {
  const { profile } = useAuthStore();
  const { tenantName, primaryColor, primaryTextColor, tenantType, effectiveRole } = useThemeStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const tenantId = profile?.tenant_id;
  const displayName = profile?.full_name?.split(' ')[0] ?? 'Personal';
  const { has, enabledSlugs, isLoaded: modulesLoaded } = useModulesStore();

  const isLightText = primaryTextColor === '#000' || primaryTextColor === '#000000';

  // Numa academia, um personal comum (não owner/admin) só vê, via RLS, os
  // alunos atribuídos a ele — o texto deixa isso explícito para não parecer
  // que faltam alunos da equipe. Owner/admin veem a academia toda, mantém o
  // texto genérico. Espelha a distinção equivalente feita no web.
  const isTeamMemberView = tenantType === 'academia' && effectiveRole === 'personal';
  const studentsHeroLabel = isTeamMemberView ? 'SEUS ALUNOS ATIVOS' : 'ALUNOS ATIVOS';
  const totalStudentsLabel = isTeamMemberView ? 'Sua carteira' : 'Total alunos';
  const ROLE_LABEL: Record<string, string> = { owner: 'Dono(a) da academia', admin: 'Administrador(a)', personal: 'Personal da equipe' };
  const roleSubtitle = tenantType === 'academia' && effectiveRole ? ROLE_LABEL[effectiveRole] : null;

  async function loadDashboard() {
    if (!tenantId) return;

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const [studentsRes, pendingRes, plansRes, todayRes, tenantRes] = await Promise.all([
      supabase.from('students').select('id, status', { count: 'exact' }).eq('tenant_id', tenantId),
      supabase.from('financial_plans').select('id', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'pending'),
      supabase.from('workout_plans').select('id', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'active'),
      supabase.from('attendance')
        .select('student_id, attended_at, students(full_name)')
        .eq('tenant_id', tenantId)
        .gte('attended_at', dayStart)
        .lt('attended_at', dayEnd)
        .order('attended_at', { ascending: false }),
      supabase.from('tenants').select('max_students').eq('id', tenantId).single(),
    ]);

    const allStudents = studentsRes.data ?? [];
    setStats({
      totalStudents: studentsRes.count ?? 0,
      activeStudents: allStudents.filter(s => s.status === 'active').length,
      pendingPayments: pendingRes.count ?? 0,
      activePlans: plansRes.count ?? 0,
      maxStudents: tenantRes.data?.max_students ?? 0,
    });

    // Um aluno pode ter mais de um registro de presença no dia (ex: combos);
    // mantém só o mais recente de cada um para a lista.
    const seen = new Set<string>();
    const todayRows: any[] = todayRes.data ?? [];
    const today: TodayAttendance[] = [];
    for (const row of todayRows) {
      if (seen.has(row.student_id)) continue;
      seen.add(row.student_id);
      today.push({
        student_id: row.student_id,
        full_name: row.students?.full_name ?? '—',
        attended_at: row.attended_at,
      });
    }
    setTodayAttendance(today);
  }

  useEffect(() => { loadDashboard().finally(() => setLoading(false)); }, [tenantId]);

  async function onRefresh() {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }

  // Plano "Elite" (ilimitado) não tem um denominador útil para a barra de capacidade
  const isUnlimitedPlan = (stats?.maxStudents ?? 0) >= UNLIMITED_THRESHOLD;
  const capacityRate = stats && !isUnlimitedPlan && stats.maxStudents > 0
    ? Math.min(100, Math.round((stats.activeStudents / stats.maxStudents) * 100))
    : 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Max Strive IA — onboarding mostrado uma vez por usuário */}
      {has(MODULE.ASSISTENTE_IA) && (
        <MaxOnboardingModal userId={profile?.id ?? null} />
      )}
      {/* Loop de onboarding por módulo — um módulo por login (adia enquanto o Max pendente) */}
      <ModuleOnboardingPopup
        userId={profile?.id ?? null}
        role="personal"
        enabledSlugs={enabledSlugs}
        modulesLoaded={modulesLoaded}
        deferUntilMaxSeen={has(MODULE.ASSISTENTE_IA)}
      />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <TenantLogo size={40} />
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>Olá, {displayName} 👋</Text>
            <Text style={s.tenantName}>{tenantName}</Text>
            {roleSubtitle && <Text style={s.roleSubtitle}>{roleSubtitle}</Text>}
          </View>
          <TrainerNotificationBell tenantId={tenantId} />
        </View>

        {loading ? (
          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <StriveLoader color={primaryColor} size={32} />
          </View>
        ) : (
          <>
            {/* ── Hero card — alunos ativos ── */}
            <TouchableOpacity
              style={[s.heroCard, { backgroundColor: primaryColor }]}
              onPress={() => router.push('/(admin)/alunos')}
              activeOpacity={0.88}
            >
              <View style={s.heroLeft}>
                <Text style={[s.heroLabel, { color: isLightText ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)' }]}>
                  {studentsHeroLabel}
                </Text>
                <Text style={[s.heroValue, { color: primaryTextColor }]}>
                  {stats?.activeStudents ?? 0}
                  <Text style={[s.heroTotal, { color: isLightText ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)' }]}>
                    {' '}/ {isUnlimitedPlan ? '∞' : (stats?.maxStudents ?? 0)}
                  </Text>
                </Text>
                {!isUnlimitedPlan && (
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, {
                      width: `${capacityRate}%` as any,
                      backgroundColor: isLightText ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.85)',
                    }]} />
                  </View>
                )}
                <Text style={[s.progressLabel, { color: isLightText ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.6)' }]}>
                  {isUnlimitedPlan ? 'Plano com alunos ilimitados' : `${capacityRate}% da capacidade do plano`}
                </Text>
              </View>
              <View style={[s.heroIconWrap, { backgroundColor: isLightText ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)' }]}>
                <Ionicons name="people" size={28} color={primaryTextColor} />
              </View>
            </TouchableOpacity>

            {/* ── Mini stats row ── */}
            <View style={s.miniRow}>
              <MiniStat
                label="Planos ativos"
                value={stats?.activePlans ?? 0}
                icon="clipboard"
                color="#60A5FA"
                onPress={() => router.push('/(admin)/treinos')}
              />
              {has(MODULE.FATURAS) ? (
                <MiniStat
                  label="Pag. pendentes"
                  value={stats?.pendingPayments ?? 0}
                  icon="alert-circle"
                  color={stats?.pendingPayments ? Colors.warning : Colors.success}
                  onPress={() => router.push('/(admin)/financeiro' as any)}
                />
              ) : (
                // Módulo de Faturas desativado para este tenant — mostra um dado
                // sempre disponível (check-ins do dia, já carregado abaixo) no
                // lugar do card de pagamentos pendentes.
                <MiniStat
                  label="Check-ins hoje"
                  value={todayAttendance.length}
                  icon="checkmark-done-circle"
                  color={Colors.success}
                  onPress={() => { if (has(MODULE.FREQUENCIA)) router.push('/(admin)/frequencia' as any); }}
                />
              )}
              <MiniStat
                label={totalStudentsLabel}
                value={stats?.totalStudents ?? 0}
                icon="people-circle"
                color={Colors.textSecondary}
                onPress={() => router.push('/(admin)/alunos')}
              />
            </View>

            {/* ── Quick actions ── */}
            <Text style={s.sectionTitle}>Ações rápidas</Text>

            {/* Primary CTA — full width */}
            <TouchableOpacity
              style={[s.primaryCTA, { backgroundColor: primaryColor }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(admin)/alunos');
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add-outline" size={22} color={primaryTextColor} />
              <Text style={[s.primaryCTAText, { color: primaryTextColor }]}>Novo Aluno</Text>
            </TouchableOpacity>

            {/* Secondary 2-column grid */}
            <View style={s.actionsRow}>
              {has(MODULE.PLANOS_TREINO) && (
                <ActionPill
                  icon="add-circle-outline"
                  label="Novo treino"
                  onPress={() => router.push('/(admin)/treinos')}
                />
              )}
              <ActionPill
                icon="trophy-outline"
                label="Ranking"
                onPress={() => router.push('/(admin)/ranking' as any)}
              />
            </View>

            {/* Modulos novos: ficam aqui na Inicio e no menu Mais — nao na tab
                bar, que tem espaco curto demais para mais itens. Cada um so
                aparece se o tenant tiver o modulo habilitado. */}
            {(has(MODULE.TREINO_ADAPTATIVO) || has(MODULE.RADAR_RETENCAO) || has(MODULE.RELATORIO_EVOLUCAO)) && (
              <View style={s.actionsRow}>
                {has(MODULE.TREINO_ADAPTATIVO) && (
                  <ActionPill
                    icon="speedometer-outline"
                    label="Treino Adaptativo"
                    onPress={() => router.push('/(admin)/treino-adaptativo' as any)}
                  />
                )}
                {has(MODULE.RADAR_RETENCAO) && (
                  <ActionPill
                    icon="radio-outline"
                    label="Radar"
                    onPress={() => router.push('/(admin)/radar' as any)}
                  />
                )}
                {has(MODULE.RELATORIO_EVOLUCAO) && (
                  <ActionPill
                    icon="bar-chart-outline"
                    label="Relatórios"
                    onPress={() => router.push('/(admin)/relatorios' as any)}
                  />
                )}
              </View>
            )}

            {/* ── Frequência de hoje ── */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Frequência de hoje</Text>
              {has(MODULE.FREQUENCIA) && (
                <TouchableOpacity onPress={() => router.push('/(admin)/frequencia' as any)}>
                  <Text style={[s.seeAll, { color: primaryColor }]}>Ver histórico</Text>
                </TouchableOpacity>
              )}
            </View>
            {todayAttendance.length === 0 ? (
              <View style={s.emptyAttendance}>
                <Ionicons name="calendar-outline" size={22} color={Colors.border} />
                <Text style={s.emptyAttendanceText}>Nenhum aluno treinou hoje ainda.</Text>
              </View>
            ) : (
              <View style={s.studentList}>
                {todayAttendance.map((att, idx) => {
                  const initials = att.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                  const isLast = idx === todayAttendance.length - 1;
                  const time = new Date(att.attended_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <TouchableOpacity
                      key={att.student_id}
                      style={[s.studentRow, !isLast && s.studentRowBorder]}
                      onPress={() => router.push(`/(admin)/alunos/${att.student_id}` as any)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.studentAvatar, { backgroundColor: `${primaryColor}20` }]}>
                        <Text style={[s.studentInitials, { color: primaryColor }]}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.studentName}>{att.full_name}</Text>
                        <Text style={s.studentStatus}>Treinou às {time}</Text>
                      </View>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                      <Ionicons name="chevron-forward" size={14} color={Colors.border} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Mini stat card (3-column row) ───────────────────────────────────────────
function MiniStat({ label, value, icon, color, onPress }: {
  label: string; value: number; icon: any; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.miniCard} onPress={onPress} activeOpacity={0.75}>
      <View style={[s.miniIconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[s.miniValue, { color }]}>{value}</Text>
      <Text style={s.miniLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Action pill ──────────────────────────────────────────────────────────────
function ActionPill({ icon, label, onPress }: {
  icon: any; label: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.actionPill, s.actionPillBorder]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <Ionicons name={icon} size={19} color={Colors.textPrimary} />
      <Text style={[s.actionLabel, { color: Colors.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 32 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingTop: 16, paddingBottom: 18,
  },
  greeting: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  tenantName: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  roleSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    opacity: 0.6,
    marginTop: 1,
  },

  // Hero card
  heroCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroLeft: { flex: 1 },
  heroLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.xs,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heroValue: {
    fontFamily: FontFamily.display,
    fontSize: 40,
    lineHeight: 44,
  },
  heroTotal: {
    fontFamily: FontFamily.body,
    fontSize: 22,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 10,
    marginBottom: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },

  // Mini stats
  miniRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  miniCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    alignItems: 'center',
    gap: 5,
  },
  miniIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniValue: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.lg,
    lineHeight: 22,
  },
  miniLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 15,
  },

  // Section titles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  seeAll: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.xs,
    marginBottom: 10,
  },
  emptyAttendance: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyAttendanceText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  // Quick actions
  primaryCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 10,
  },
  primaryCTAText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
    flexWrap: 'wrap',
  },
  actionPill: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
  },
  actionPillBorder: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.xs,
    textAlign: 'center',
    color: Colors.textPrimary,
  },

  // Student list
  studentList: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  studentRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentInitials: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
  },
  studentName: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  studentStatus: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
