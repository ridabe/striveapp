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
import { signOut } from '@/services/auth';
import { useModulesStore } from '@/stores/modulesStore';
import { MODULE } from '@/lib/modules';
import { TenantLogo } from '@/components/TenantLogo';

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
  const displayName = profile?.full_name ?? 'Personal';
  const { has } = useModulesStore();

  async function loadDashboard() {
    if (!tenantId) return;

    const [studentsRes, pendingRes, plansRes, recentRes] = await Promise.all([
      supabase
        .from('students')
        .select('id, status', { count: 'exact' })
        .eq('tenant_id', tenantId),
      supabase
        .from('financial_plans')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending'),
      supabase
        .from('workout_plans')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('status', 'active'),
      supabase
        .from('students')
        .select('id, full_name, status, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5),
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

  useEffect(() => {
    loadDashboard().finally(() => setLoading(false));
  }, [tenantId]);

  async function onRefresh() {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TenantLogo size={42} />
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Olá, {displayName} 👋</Text>
            <Text style={styles.tenantName}>{tenantName}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Stats */}
            <View style={styles.statsGrid}>
              <StatCard
                label="Alunos ativos"
                value={stats?.activeStudents ?? 0}
                icon="people"
                color={primaryColor}
                onPress={() => router.push('/(admin)/alunos')}
              />
              <StatCard
                label="Planos ativos"
                value={stats?.activePlans ?? 0}
                icon="barbell"
                color="#60A5FA"
                onPress={() => router.push('/(admin)/treinos')}
              />
              <StatCard
                label="Pagamentos pendentes"
                value={stats?.pendingPayments ?? 0}
                icon="alert-circle"
                color={stats?.pendingPayments ? Colors.warning : Colors.success}
                onPress={() => router.push('/(admin)/mais')}
              />
              <StatCard
                label="Total de alunos"
                value={stats?.totalStudents ?? 0}
                icon="people-circle"
                color={Colors.textSecondary}
                onPress={() => router.push('/(admin)/alunos')}
              />
            </View>

            {/* Quick actions */}
            <Text style={styles.sectionTitle}>Ações rápidas</Text>
            <View style={styles.actions}>
              <QuickAction
                icon="person-add"
                label="Novo aluno"
                onPress={() => router.push('/(admin)/alunos')}
                primary
                primaryColor={primaryColor}
              />
              {has(MODULE.PLANOS_TREINO) && (
                <QuickAction
                  icon="add-circle"
                  label="Novo treino"
                  onPress={() => router.push('/(admin)/treinos')}
                />
              )}
              {has(MODULE.FREQUENCIA) && (
                <QuickAction
                  icon="calendar"
                  label="Frequência"
                  onPress={() => router.push('/(admin)/mais')}
                />
              )}
              {has(MODULE.AVALIACOES) && (
                <QuickAction
                  icon="stats-chart"
                  label="Avaliação"
                  onPress={() => router.push('/(admin)/mais')}
                />
              )}
            </View>

            {/* Recent students */}
            {recentStudents.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Alunos recentes</Text>
                  <TouchableOpacity onPress={() => router.push('/(admin)/alunos')}>
                    <Text style={[styles.seeAll, { color: primaryColor }]}>Ver todos</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.studentList}>
                  {recentStudents.map(student => (
                    <TouchableOpacity
                      key={student.id}
                      style={styles.studentRow}
                      onPress={() => router.push(`/(admin)/alunos/${student.id}` as any)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.studentAvatar}>
                        <Text style={styles.studentInitial}>
                          {student.full_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.studentInfo}>
                        <Text style={styles.studentName}>{student.full_name}</Text>
                        <Text style={styles.studentStatus}>
                          {student.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Text>
                      </View>
                      <View style={[
                        styles.statusDot,
                        { backgroundColor: student.status === 'active' ? Colors.success : Colors.textSecondary }
                      ]} />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color, onPress }: {
  label: string; value: number; icon: any; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.75}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function QuickAction({ icon, label, onPress, primary, primaryColor }: {
  icon: any; label: string; onPress: () => void; primary?: boolean; primaryColor?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, primary && { backgroundColor: primaryColor ?? Colors.primary }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Ionicons name={icon} size={20} color={primary ? Colors.bg : Colors.textPrimary} />
      <Text style={[styles.actionLabel, primary && { color: Colors.bg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  headerText: { flex: 1 },
  greeting: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  tenantName: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 6,
  },
  statValue: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['3xl'],
  },
  statLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  seeAll: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  actionBtn: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  actionLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  studentList: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  studentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentInitial: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  studentInfo: { flex: 1 },
  studentName: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  studentStatus: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
