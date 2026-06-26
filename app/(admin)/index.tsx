import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
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

interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  pendingPayments: number;
  activePlans: number;
}

interface RecentStudent {
  id: string;
  full_name: string;
  status: string;
  created_at: string;
}

export default function AdminDashboard() {
  const { profile } = useAuthStore();
  const { tenantName, primaryColor } = useThemeStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const tenantId = profile?.tenant_id;
  const displayName = profile?.full_name?.split(' ')[0] ?? 'Personal';
  const { has } = useModulesStore();

  const lightText = ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(primaryColor);

  async function loadDashboard() {
    if (!tenantId) return;

    const [studentsRes, pendingRes, plansRes, recentRes] = await Promise.all([
      supabase.from('students').select('id, status', { count: 'exact' }).eq('tenant_id', tenantId),
      supabase.from('financial_plans').select('id', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'pending'),
      supabase.from('workout_plans').select('id', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'active'),
      supabase.from('students').select('id, full_name, status, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5),
    ]);

    const allStudents = studentsRes.data ?? [];
    setStats({
      totalStudents: studentsRes.count ?? 0,
      activeStudents: allStudents.filter(s => s.status === 'active').length,
      pendingPayments: pendingRes.count ?? 0,
      activePlans: plansRes.count ?? 0,
    });
    setRecentStudents(recentRes.data ?? []);
  }

  useEffect(() => { loadDashboard().finally(() => setLoading(false)); }, [tenantId]);

  async function onRefresh() {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }

  const activeRate = stats && stats.totalStudents > 0
    ? Math.round((stats.activeStudents / stats.totalStudents) * 100)
    : 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Max Strive IA — onboarding mostrado uma vez por usuário */}
      {has(MODULE.ASSISTENTE_IA) && (
        <MaxOnboardingModal userId={profile?.id ?? null} />
      )}
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
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={primaryColor} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* ── Hero card — alunos ativos ── */}
            <TouchableOpacity
              style={[s.heroCard, { backgroundColor: primaryColor }]}
              onPress={() => router.push('/(admin)/alunos')}
              activeOpacity={0.88}
            >
              <View style={s.heroLeft}>
                <Text style={[s.heroLabel, { color: lightText ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)' }]}>
                  ALUNOS ATIVOS
                </Text>
                <Text style={[s.heroValue, { color: lightText ? '#000' : '#fff' }]}>
                  {stats?.activeStudents ?? 0}
                  <Text style={[s.heroTotal, { color: lightText ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)' }]}>
                    {' '}/ {stats?.totalStudents ?? 0}
                  </Text>
                </Text>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, {
                    width: `${activeRate}%` as any,
                    backgroundColor: lightText ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.85)',
                  }]} />
                </View>
                <Text style={[s.progressLabel, { color: lightText ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.6)' }]}>
                  {activeRate}% ativos
                </Text>
              </View>
              <View style={[s.heroIconWrap, { backgroundColor: lightText ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)' }]}>
                <Ionicons name="people" size={28} color={lightText ? '#000' : '#fff'} />
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
              <MiniStat
                label="Pag. pendentes"
                value={stats?.pendingPayments ?? 0}
                icon="alert-circle"
                color={stats?.pendingPayments ? Colors.warning : Colors.success}
                onPress={() => router.push('/(admin)/mais')}
              />
              <MiniStat
                label="Total alunos"
                value={stats?.totalStudents ?? 0}
                icon="people-circle"
                color={Colors.textSecondary}
                onPress={() => router.push('/(admin)/alunos')}
              />
            </View>

            {/* ── Quick actions ── */}
            <Text style={s.sectionTitle}>Ações rápidas</Text>
            <View style={s.actionsRow}>
              <ActionPill
                icon="person-add-outline"
                label="Novo aluno"
                onPress={() => router.push('/(admin)/alunos')}
                primary
                primaryColor={primaryColor}
                lightText={lightText}
              />
              {has(MODULE.PLANOS_TREINO) && (
                <ActionPill
                  icon="add-circle-outline"
                  label="Novo treino"
                  onPress={() => router.push('/(admin)/treinos')}
                />
              )}
              {has(MODULE.FREQUENCIA) && (
                <ActionPill
                  icon="calendar-outline"
                  label="Frequência"
                  onPress={() => router.push('/(admin)/frequencia' as any)}
                />
              )}
              {has(MODULE.AVALIACOES) && (
                <ActionPill
                  icon="stats-chart-outline"
                  label="Avaliação"
                  onPress={() => router.push('/(admin)/avaliacao' as any)}
                />
              )}
              <ActionPill
                icon="trophy-outline"
                label="Ranking"
                onPress={() => router.push('/(admin)/ranking' as any)}
              />
            </View>

            {/* ── Recent students ── */}
            {recentStudents.length > 0 && (
              <>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>Alunos recentes</Text>
                  <TouchableOpacity onPress={() => router.push('/(admin)/alunos')}>
                    <Text style={[s.seeAll, { color: primaryColor }]}>Ver todos</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.studentList}>
                  {recentStudents.slice(0, 5).map((student, idx) => {
                    const list = recentStudents.slice(0, 5);
                    const initials = student.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                    const isLast = idx === list.length - 1;
                    return (
                      <TouchableOpacity
                        key={student.id}
                        style={[s.studentRow, !isLast && s.studentRowBorder]}
                        onPress={() => router.push(`/(admin)/alunos/${student.id}` as any)}
                        activeOpacity={0.7}
                      >
                        <View style={[s.studentAvatar, { backgroundColor: `${primaryColor}20` }]}>
                          <Text style={[s.studentInitials, { color: primaryColor }]}>{initials}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.studentName}>{student.full_name}</Text>
                          <Text style={s.studentStatus}>
                            {student.status === 'active' ? 'Ativo' : 'Inativo'}
                          </Text>
                        </View>
                        <View style={[s.statusPill, {
                          backgroundColor: student.status === 'active' ? `${Colors.success}18` : `${Colors.border}`,
                        }]}>
                          <View style={[s.statusDot, {
                            backgroundColor: student.status === 'active' ? Colors.success : Colors.textSecondary,
                          }]} />
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={Colors.border} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
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
function ActionPill({ icon, label, onPress, primary, primaryColor, lightText }: {
  icon: any; label: string; onPress: () => void;
  primary?: boolean; primaryColor?: string; lightText?: boolean;
}) {
  const bg = primary ? primaryColor : Colors.surface;
  const iconColor = primary ? (lightText ? '#000' : '#fff') : Colors.textPrimary;
  const labelColor = primary ? (lightText ? '#000' : '#fff') : Colors.textPrimary;
  return (
    <TouchableOpacity
      style={[s.actionPill, { backgroundColor: bg }, !primary && s.actionPillBorder]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <Ionicons name={icon} size={19} color={iconColor} />
      <Text style={[s.actionLabel, { color: labelColor }]}>{label}</Text>
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
    fontSize: 10,
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
    fontSize: 11,
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
    fontSize: 9,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 12,
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

  // Quick actions
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
    flexWrap: 'wrap',
  },
  actionPill: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
  },
  actionPillBorder: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    textAlign: 'center',
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
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  statusPill: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
