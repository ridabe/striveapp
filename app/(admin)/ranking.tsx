import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const BADGE_CONFIG: Record<string, { label: string; color: string }> = {
  foco_total:          { label: '🔥 Foco Total',         color: '#F59E0B' },
  evolucao_aco:        { label: '💪 Evolução de Aço',    color: '#3B82F6' },
  consistencia_maxima: { label: '🛡️ Consistência Máx.', color: '#8B5CF6' },
  top_10:              { label: '⭐ Top 10',              color: '#F59E0B' },
  campeao_mes:         { label: '🏆 Campeão do Mês',     color: '#EAB308' },
  disciplina:          { label: '🎯 Disciplina',          color: '#10B981' },
  treino_completo:     { label: '⚡ Treino Completo',    color: '#E8FF47' },
};

type RankingEntry = {
  student_id: string;
  total_points: number;
  workouts_completed: number;
  exercises_completed: number;
  load_increases: number;
  active_minutes: number;
  student_name?: string;
  tenant_id?: string;
  rank_position: number;
};

type Snapshot = {
  id: string;
  month: number;
  year: number;
  closed_at: string;
  champion_id: string | null;
  rankings: { position: number; student_name: string; trainer_name: string | null; points: number; workouts_completed: number }[];
};

export default function AdminRankingScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? '';

  const now = new Date();
  const [isActive, setIsActive]       = useState<boolean | null>(null);
  const [ranking, setRanking]         = useState<RankingEntry[]>([]);
  const [snapshots, setSnapshots]     = useState<Snapshot[]>([]);
  const [loading, setLoading]         = useState(true);
  const [myStudentsOnly, setMyStudentsOnly] = useState(false);
  const [myStudentIds, setMyStudentIds]     = useState<string[]>([]);
  const [openSnapshot, setOpenSnapshot]     = useState<string | null>(null);

  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const load = useCallback(async () => {
    setLoading(true);
    // Check if gamification is active
    const { data: settings } = await supabase
      .from('gamification_settings')
      .select('is_active')
      .single();
    setIsActive(settings?.is_active ?? false);

    if (!settings?.is_active) { setLoading(false); return; }

    // Ranking GLOBAL — todos os alunos de todos os studios
    // O filtro "apenas meus alunos" é aplicado no frontend via myStudentIds
    const { data: rankData } = await supabase
      .from('monthly_points')
      .select('student_id, total_points, workouts_completed, exercises_completed, load_increases, active_minutes, students(full_name, tenant_id)')
      .eq('month', month)
      .eq('year', year)
      .order('total_points', { ascending: false })
      .order('workouts_completed', { ascending: false });

    const entries: RankingEntry[] = (rankData ?? []).map((r: any, i: number) => ({
      student_id: r.student_id,
      total_points: r.total_points,
      workouts_completed: r.workouts_completed,
      exercises_completed: r.exercises_completed,
      load_increases: r.load_increases,
      active_minutes: r.active_minutes,
      student_name: r.students?.full_name,
      tenant_id: r.students?.tenant_id,
      rank_position: i + 1,
    }));
    setRanking(entries);

    // Load month students for filter
    if (tenantId) {
      const { data: stds } = await supabase
        .from('students')
        .select('id')
        .eq('tenant_id', tenantId);
      setMyStudentIds((stds ?? []).map((s: any) => s.id));
    }

    // Load history
    const { data: hist } = await supabase
      .from('monthly_ranking_snapshots')
      .select('id, month, year, closed_at, champion_id, rankings')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(6);
    setSnapshots((hist ?? []) as Snapshot[]);

    setLoading(false);
  }, [tenantId, month, year]);

  useEffect(() => { load(); }, [load]);

  const displayedRanking = myStudentsOnly
    ? ranking.filter(r => myStudentIds.includes(r.student_id))
    : ranking;

  const totalParticipants = ranking.length;
  const totalPoints       = ranking.reduce((s, r) => s + r.total_points, 0);
  const avgPoints         = totalParticipants > 0 ? Math.round(totalPoints / totalParticipants) : 0;

  const MEDAL = ['🥇', '🥈', '🥉'];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Ranking dos Campeões</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Ranking é padrão do sistema — sem ModuleGuard, acesso irrestrito */}
        {loading ? (
          <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
        ) : isActive === false ? (
          <View style={s.inactiveBox}>
            <Ionicons name="trophy-outline" size={52} color={Colors.border} />
            <Text style={s.inactiveTitle}>Ranking inativo</Text>
            <Text style={s.inactiveDesc}>O módulo de gamificação está desativado. Ative-o no painel web de administração global.</Text>
          </View>
        ) : (
          <FlatList
            data={displayedRanking}
            keyExtractor={r => r.student_id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
            ListHeaderComponent={
              <View>
                {/* Metrics */}
                <View style={s.metricsRow}>
                  <View style={s.metricCard}>
                    <Text style={[s.metricValue, { color: primaryColor }]}>{totalParticipants}</Text>
                    <Text style={s.metricLabel}>Participantes</Text>
                  </View>
                  <View style={s.metricCard}>
                    <Text style={[s.metricValue, { color: primaryColor }]}>{totalPoints.toLocaleString('pt-BR')}</Text>
                    <Text style={s.metricLabel}>Pts totais</Text>
                  </View>
                  <View style={s.metricCard}>
                    <Text style={[s.metricValue, { color: primaryColor }]}>{avgPoints}</Text>
                    <Text style={s.metricLabel}>Média</Text>
                  </View>
                </View>

                {/* Filter toggle */}
                <View style={s.filterRow}>
                  <Text style={s.filterLabel}>Apenas meus alunos</Text>
                  <Switch
                    value={myStudentsOnly}
                    onValueChange={setMyStudentsOnly}
                    trackColor={{ false: Colors.border, true: `${primaryColor}80` }}
                    thumbColor={myStudentsOnly ? primaryColor : Colors.surface}
                  />
                </View>

                <Text style={s.sectionTitle}>
                  CLASSIFICAÇÃO — {MONTH_NAMES[month - 1].toUpperCase()} {year}
                </Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const medal = item.rank_position <= 3 ? MEDAL[item.rank_position - 1] : null;
              const isMyStudent = myStudentIds.includes(item.student_id);
              return (
                <View style={[s.rankCard, isMyStudent && { borderColor: `${primaryColor}40` }]}>
                  <Text style={[s.rankPos, item.rank_position <= 3 && { fontSize: 18 }]}>
                    {medal ?? `#${item.rank_position}`}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.rankName} numberOfLines={1}>{item.student_name ?? 'Aluno'}</Text>
                      {isMyStudent && (
                        <View style={[s.myBadge, { borderColor: `${primaryColor}60`, backgroundColor: `${primaryColor}18` }]}>
                          <Text style={[s.myBadgeText, { color: primaryColor }]}>Meu aluno</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.rankStats}>
                      {item.workouts_completed} treinos · {item.active_minutes} min · {item.load_increases} cargas↑
                    </Text>
                  </View>
                  <Text style={[s.rankPts, { color: item.rank_position === 1 ? '#EAB308' : Colors.textPrimary }]}>
                    {item.total_points.toLocaleString('pt-BR')} pts
                  </Text>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>Nenhum aluno no ranking ainda.</Text>
              </View>
            }
            ListFooterComponent={
              snapshots.length > 0 ? (
                <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                  <Text style={s.sectionTitle}>HISTÓRICO DE CAMPEÕES</Text>
                  {snapshots.map(snap => (
                    <View key={snap.id}>
                      <TouchableOpacity
                        style={s.snapCard}
                        onPress={() => setOpenSnapshot(openSnapshot === snap.id ? null : snap.id)}
                      >
                        <View style={s.snapIcon}>
                          <Text style={{ fontSize: 18 }}>🏆</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.snapTitle}>{MONTH_NAMES[snap.month - 1]} {snap.year}</Text>
                          <Text style={s.snapSub}>
                            {snap.rankings[0]?.student_name ?? 'Campeão'} · {snap.rankings[0]?.points ?? 0} pts
                          </Text>
                        </View>
                        <Ionicons name={openSnapshot === snap.id ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
                      </TouchableOpacity>
                      {openSnapshot === snap.id && (
                        <View style={s.snapDetail}>
                          {(snap.rankings ?? []).slice(0, 5).map(r => (
                            <View key={r.position} style={s.snapRow}>
                              <Text style={s.snapPos}>{r.position <= 3 ? MEDAL[r.position - 1] : `#${r.position}`}</Text>
                              <Text style={s.snapName} numberOfLines={1}>{r.student_name}</Text>
                              <Text style={s.snapPts}>{r.points} pts</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ) : null
            }
          />
        )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  inactiveBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  inactiveTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  inactiveDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  metricsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  metricCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, alignItems: 'center', gap: 4 },
  metricValue: { fontFamily: FontFamily.bodyBold, fontSize: 20 },
  metricLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, marginBottom: 4 },
  filterLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  sectionTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 0.8, paddingHorizontal: 16, marginBottom: 10, marginTop: 8 },
  rankCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, marginHorizontal: 16, marginBottom: 8, padding: 14 },
  rankPos: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textSecondary, width: 36, textAlign: 'center' },
  rankName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary, flexShrink: 1 },
  rankStats: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  rankPts: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
  myBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 1 },
  myBadgeText: { fontFamily: FontFamily.bodyMedium, fontSize: 10 },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
  snapCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 8 },
  snapIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EAB30820', alignItems: 'center', justifyContent: 'center' },
  snapTitle: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  snapSub: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  snapDetail: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, padding: 12, gap: 8 },
  snapRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  snapPos: { fontFamily: FontFamily.bodyBold, fontSize: 14, width: 28 },
  snapName: { flex: 1, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  snapPts: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
});
