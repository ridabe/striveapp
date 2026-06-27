import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView,
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

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MEDAL = ['🥇', '🥈', '🥉'];

const BADGE_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  foco_total:          { label: 'Foco Total',        emoji: '🔥', color: '#F59E0B' },
  evolucao_aco:        { label: 'Evolução de Aço',   emoji: '💪', color: '#3B82F6' },
  consistencia_maxima: { label: 'Consistência Máx.', emoji: '🛡️', color: '#8B5CF6' },
  top_10:              { label: 'Top 10',             emoji: '⭐', color: '#F59E0B' },
  campeao_mes:         { label: 'Campeão do Mês',    emoji: '🏆', color: '#EAB308' },
  disciplina:          { label: 'Disciplina',         emoji: '🎯', color: '#10B981' },
  treino_completo:     { label: 'Treino Completo',   emoji: '⚡', color: '#E8FF47' },
};

const HOW_IT_WORKS = [
  { emoji: '🏋️', title: 'Conclua treinos', desc: 'Cada treino finalizado no app garante pontos. Quanto mais treinos, mais você sobe no ranking.' },
  { emoji: '⚡', title: 'Treinos extras', desc: 'Treinos extras realizados fora do plano padrão valem pontos adicionais — mostre dedicação!' },
  { emoji: '🔥', title: 'Consistência semanal', desc: 'Treinar todos os dias planejados na semana dá um bônus extra. Não quebre a sequência!' },
  { emoji: '🏆', title: 'Desafios do mês', desc: 'Seu personal pode criar desafios especiais. Completar cada um adiciona pontos à sua conta.' },
  { emoji: '🎖️', title: 'Conquistas (badges)', desc: 'Ao fim de cada mês, os destaques ganham badges: Campeão, Top 10, Foco Total e mais.' },
  { emoji: '🔄', title: 'Renovação mensal', desc: 'O ranking zera todo início de mês. O histórico fica salvo. Cada mês é uma nova chance!' },
];

type RankingEntry = { student_id: string; total_points: number; workouts_completed: number; student_name?: string; rank_position: number };
type Badge = { badge_type: string; earned_at: string };
type MyPoints = { total_points: number; workouts_completed: number; exercises_completed: number; active_minutes: number; weekly_bonuses: number };
type Snapshot = { id: string; month: number; year: number; rankings: any[]; champion_id: string | null };

function motivationalMessage(rank: number, total: number, points: number, nextPoints: number) {
  if (rank === 1) return '🏆 Você é o líder do ranking! Mantenha o ritmo!';
  if (rank <= 3)  return `🥇 Você está no Top 3! Faltam ${nextPoints - points} pts para subir!`;
  if (rank <= 10) return '⭐ Você está no Top 10! Continue assim!';
  if (nextPoints - points < 50) return `🔥 Quase lá! Faltam só ${nextPoints - points} pts para o próximo lugar!`;
  if (rank <= Math.ceil(total / 2)) return '💪 Você está na metade superior! Continue treinando!';
  return '🎯 Continue treinando para subir no ranking!';
}

function HowItWorksCard({ color }: { color: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[hw.card, { borderColor: `${color}30` }]}>
      <TouchableOpacity style={hw.header} onPress={() => setOpen(v => !v)} activeOpacity={0.7}>
        <View style={[hw.iconWrap, { backgroundColor: `${color}18` }]}>
          <Ionicons name="information-circle-outline" size={20} color={color} />
        </View>
        <Text style={hw.title}>Como funciona o Ranking?</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={hw.body}>
          <Text style={hw.intro}>
            A cada mês você compete com todos os alunos em uma disputa de pontos. Treine, seja consistente e ganhe destaque!
          </Text>
          {HOW_IT_WORKS.map(item => (
            <View key={item.title} style={hw.row}>
              <Text style={hw.emoji}>{item.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={hw.rowTitle}>{item.title}</Text>
                <Text style={hw.rowDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function StudentRankingScreen() {
  const { selectedStudent }      = useStudent();
  const { primaryColor } = useThemeStore();

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const [isActive, setIsActive]   = useState<boolean | null>(null);
  const [ranking, setRanking]     = useState<RankingEntry[]>([]);
  const [myPoints, setMyPoints]   = useState<MyPoints | null>(null);
  const [myRank, setMyRank]       = useState<number>(0);
  const [badges, setBadges]       = useState<Badge[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading]     = useState(true);
  const [openSnap, setOpenSnap]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: settings } = await supabase
      .from('gamification_settings').select('is_active').single();
    const active = settings?.is_active ?? false;
    setIsActive(active);

    if (!active) { setLoading(false); return; }

    // Ranking GLOBAL — todos os alunos de todos os studios competem entre si
    const { data: rankData } = await supabase
      .from('monthly_points')
      .select('student_id, total_points, workouts_completed, students(full_name)')
      .eq('month', month)
      .eq('year', year)
      .order('total_points', { ascending: false })
      .order('workouts_completed', { ascending: false });

    const entries: RankingEntry[] = ((rankData ?? []) as any[]).map((r, i) => ({
      student_id: r.student_id, total_points: r.total_points,
      workouts_completed: r.workouts_completed,
      student_name: (r.students as any)?.full_name,
      rank_position: i + 1,
    }));
    setRanking(entries);

    if (selectedStudent) {
      const { data: mp } = await supabase.from('monthly_points')
        .select('total_points, workouts_completed, exercises_completed, active_minutes, weekly_bonuses')
        .eq('student_id', selectedStudent.id).eq('month', month).eq('year', year).maybeSingle();
      setMyPoints((mp as MyPoints) ?? null);

      // Posição global — conta todos acima independente do studio
      const { count } = await supabase.from('monthly_points')
        .select('id', { count: 'exact', head: true })
        .eq('month', month).eq('year', year)
        .gt('total_points', mp?.total_points ?? 0);
      setMyRank((count ?? 0) + 1);

      const { data: bdgs } = await supabase.from('student_badges')
        .select('badge_type, earned_at')
        .eq('student_id', selectedStudent.id).eq('month', month).eq('year', year);
      setBadges((bdgs ?? []) as Badge[]);
    }

    const { data: hist } = await supabase
      .from('monthly_ranking_snapshots')
      .select('id, month, year, rankings, champion_id')
      .order('year', { ascending: false }).order('month', { ascending: false }).limit(6);
    setSnapshots((hist ?? []) as Snapshot[]);

    setLoading(false);
  }, [selectedStudent?.id, month, year]);

  useEffect(() => { load(); }, [load]);

  const top3    = ranking.slice(0, 3);
  const nextPts = ranking.find(r => r.rank_position === myRank - 1)?.total_points
    ?? (myPoints?.total_points ?? 0) + 1;

  // ──────────── Inactive state ─────────────
  if (!loading && isActive === false) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.title}>Ranking dos Campeões</Text>
          <TenantLogo size={32} radius={9} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={[s.heroCard, { borderColor: `${primaryColor}30` }]}>
            <Text style={{ fontSize: 56, textAlign: 'center' }}>🏆</Text>
            <Text style={[s.heroTitle, { color: primaryColor }]}>RANKING DOS CAMPEÕES</Text>
            <Text style={s.heroSub}>
              A competição mensal de treinos está chegando! Aqui você vai disputar pontos com os outros alunos e conquistar o topo do ranking.
            </Text>
            <View style={[s.comingSoonBadge, { borderColor: `${primaryColor}50`, backgroundColor: `${primaryColor}12` }]}>
              <Ionicons name="time-outline" size={13} color={primaryColor} />
              <Text style={[s.comingSoonText, { color: primaryColor }]}>AGUARDANDO ATIVAÇÃO</Text>
            </View>
          </View>

          {/* How it works – always expanded when inactive so the student understands the system */}
          <View style={[hw.card, { borderColor: `${primaryColor}30` }]}>
            <View style={hw.header}>
              <View style={[hw.iconWrap, { backgroundColor: `${primaryColor}18` }]}>
                <Ionicons name="information-circle-outline" size={20} color={primaryColor} />
              </View>
              <Text style={hw.title}>Como você vai ganhar pontos</Text>
            </View>
            <View style={hw.body}>
              <Text style={hw.intro}>
                A cada mês você compete com todos os alunos em uma disputa de pontos. Treine, seja consistente e ganhe destaque!
              </Text>
              {HOW_IT_WORKS.map(item => (
                <View key={item.title} style={hw.row}>
                  <Text style={hw.emoji}>{item.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={hw.rowTitle}>{item.title}</Text>
                    <Text style={hw.rowDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Badges preview */}
          <View style={[hw.card, { borderColor: `${primaryColor}30` }]}>
            <View style={hw.header}>
              <View style={[hw.iconWrap, { backgroundColor: `${primaryColor}18` }]}>
                <Ionicons name="medal-outline" size={20} color={primaryColor} />
              </View>
              <Text style={hw.title}>Conquistas que você pode ganhar</Text>
            </View>
            <View style={{ paddingHorizontal: 14, paddingBottom: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {Object.entries(BADGE_CONFIG).map(([key, cfg]) => (
                <View key={key} style={[s.badgeChip, { backgroundColor: `${cfg.color}20`, borderColor: `${cfg.color}40` }]}>
                  <Text style={{ fontSize: 14 }}>{cfg.emoji}</Text>
                  <Text style={[s.badgeLabel, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ──────────── Active state ─────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Ranking dos Campeões</Text>
        <TenantLogo size={32} radius={9} />
      </View>

      {loading ? (
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={ranking}
          keyExtractor={r => r.student_id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={
            <View>
              <Text style={s.subtitle}>
                {MONTH_NAMES[month - 1]} {year} · {ranking.length} participante{ranking.length !== 1 ? 's' : ''}
              </Text>

              {/* My card */}
              {myPoints ? (
                <View style={[s.myCard, { borderColor: `${primaryColor}50`, backgroundColor: `${primaryColor}08` }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={[s.myRankPos, { color: primaryColor }]}>
                      {myRank <= 3 ? MEDAL[myRank - 1] : `#${myRank}`} de {ranking.length}
                    </Text>
                    <Text style={[s.myPts, { color: primaryColor }]}>
                      {myPoints.total_points.toLocaleString('pt-BR')} pts
                    </Text>
                  </View>
                  <Text style={s.myStats}>
                    {myPoints.workouts_completed} treinos · {myPoints.active_minutes} min ativos · {myPoints.weekly_bonuses} bônus
                  </Text>
                  <Text style={[s.motivational, { color: primaryColor }]}>
                    {motivationalMessage(myRank, ranking.length, myPoints.total_points, nextPts)}
                  </Text>
                  {badges.length > 0 && (
                    <View style={s.badgesRow}>
                      {badges.map(b => {
                        const cfg = BADGE_CONFIG[b.badge_type];
                        if (!cfg) return null;
                        return (
                          <View key={b.badge_type} style={[s.badgeChip, { backgroundColor: `${cfg.color}20`, borderColor: `${cfg.color}40` }]}>
                            <Text style={{ fontSize: 14 }}>{cfg.emoji}</Text>
                            <Text style={[s.badgeLabel, { color: cfg.color }]}>{cfg.label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              ) : (
                /* No personal points yet — show encouragement card */
                <View style={[s.myCard, { borderColor: Colors.border }]}>
                  <Text style={[s.myRankPos, { color: Colors.textSecondary }]}>Ainda sem pontos este mês</Text>
                  <Text style={s.myStats}>Conclua seu próximo treino para entrar no ranking!</Text>
                </View>
              )}

              {/* Podium */}
              {top3.length >= 2 && (
                <View style={s.podiumRow}>
                  <View style={[s.podiumCard, s.podiumSilver]}>
                    <Text style={s.podiumMedal}>🥈</Text>
                    <Text style={s.podiumName} numberOfLines={1}>{top3[1]?.student_name ?? '-'}</Text>
                    <Text style={s.podiumPts}>{top3[1]?.total_points ?? 0} pts</Text>
                  </View>
                  <View style={[s.podiumCard, s.podiumGold]}>
                    <Text style={s.podiumMedal}>🥇</Text>
                    <Text style={s.podiumName} numberOfLines={1}>{top3[0]?.student_name ?? '-'}</Text>
                    <Text style={[s.podiumPts, { color: '#EAB308' }]}>{top3[0]?.total_points ?? 0} pts</Text>
                  </View>
                  <View style={[s.podiumCard, s.podiumBronze]}>
                    <Text style={s.podiumMedal}>🥉</Text>
                    <Text style={s.podiumName} numberOfLines={1}>{top3[2]?.student_name ?? '-'}</Text>
                    <Text style={s.podiumPts}>{top3[2]?.total_points ?? 0} pts</Text>
                  </View>
                </View>
              )}

              <Text style={s.sectionLabel}>CLASSIFICAÇÃO GERAL</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe  = item.student_id === selectedStudent?.id;
            const medal = item.rank_position <= 3 ? MEDAL[item.rank_position - 1] : null;
            return (
              <View style={[s.rankRow, isMe && { backgroundColor: `${primaryColor}12`, borderColor: `${primaryColor}50` }]}>
                <Text style={[s.rankPos, item.rank_position === 1 && { fontSize: 18 }]}>
                  {medal ?? `#${item.rank_position}`}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rankName, isMe && { color: primaryColor, fontFamily: FontFamily.bodyBold }]} numberOfLines={1}>
                    {isMe ? `▶ ${item.student_name ?? 'Você'}` : (item.student_name ?? 'Aluno')}
                  </Text>
                  <Text style={s.rankSub}>{item.workouts_completed} treino{item.workouts_completed !== 1 ? 's' : ''} este mês</Text>
                </View>
                <Text style={[s.rankPts, item.rank_position === 1 && { color: '#EAB308' }]}>
                  {item.total_points.toLocaleString('pt-BR')} pts
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Text style={{ fontSize: 40 }}>🏁</Text>
              <Text style={s.emptyTitle}>Ranking ainda vazio</Text>
              <Text style={s.emptyDesc}>Seja o primeiro! Conclua um treino para aparecer aqui.</Text>
            </View>
          }
          ListFooterComponent={
            <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
              {/* How it works */}
              <HowItWorksCard color={primaryColor} />

              {/* History */}
              {snapshots.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={s.sectionLabel}>HISTÓRICO</Text>
                  {snapshots.map(snap => (
                    <View key={snap.id}>
                      <TouchableOpacity
                        style={s.snapCard}
                        onPress={() => setOpenSnap(openSnap === snap.id ? null : snap.id)}
                      >
                        <Text style={{ fontSize: 18 }}>🏆</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={s.snapTitle}>{MONTH_NAMES[snap.month - 1]} {snap.year}</Text>
                          <Text style={s.snapSub}>Campeão: {snap.rankings[0]?.student_name ?? '—'} · {snap.rankings[0]?.points ?? 0} pts</Text>
                        </View>
                        <Ionicons name={openSnap === snap.id ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
                      </TouchableOpacity>
                      {openSnap === snap.id && (
                        <View style={s.snapDetail}>
                          {(snap.rankings ?? []).slice(0, 5).map((r: any) => (
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
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ──────────── Styles ─────────────
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:   { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  subtitle:{ fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 4 },

  // Hero (inactive)
  heroCard:       { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, padding: 24, alignItems: 'center', gap: 10 },
  heroTitle:      { fontFamily: FontFamily.display, fontSize: 20, letterSpacing: 1.5, textAlign: 'center' },
  heroSub:        { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  comingSoonBadge:{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginTop: 4 },
  comingSoonText: { fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 1.2 },

  // My card
  myCard:     { marginHorizontal: 16, marginTop: 8, marginBottom: 14, borderRadius: 18, borderWidth: 1.5, padding: 16, gap: 5 },
  myRankPos:  { fontFamily: FontFamily.display, fontSize: 20 },
  myPts:      { fontFamily: FontFamily.bodyBold, fontSize: 22 },
  myStats:    { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },
  motivational:{ fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, marginTop: 4 },
  badgesRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badgeChip:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  badgeLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },

  // Podium
  podiumRow:    { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 16, marginBottom: 16, gap: 8 },
  podiumCard:   { flex: 1, alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 10, gap: 4 },
  podiumGold:   { backgroundColor: '#EAB30812', borderColor: '#EAB30840', paddingBottom: 20, paddingTop: 16 },
  podiumSilver: { backgroundColor: '#94A3B812', borderColor: '#94A3B840' },
  podiumBronze: { backgroundColor: '#CD7F3212', borderColor: '#CD7F3240' },
  podiumMedal:  { fontSize: 22 },
  podiumName:   { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.textPrimary, textAlign: 'center' },
  podiumPts:    { fontFamily: FontFamily.bodyBold, fontSize: 12, color: Colors.textSecondary },

  // Ranking list
  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 0.8, paddingHorizontal: 16, marginBottom: 8, marginTop: 4 },
  rankRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 6, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11 },
  rankPos:      { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textSecondary, width: 34, textAlign: 'center' },
  rankName:     { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  rankSub:      { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  rankPts:      { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },

  // Empty
  emptyBox:   { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyDesc:  { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },

  // Snapshots
  snapCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 8 },
  snapTitle:  { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  snapSub:    { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  snapDetail: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, padding: 12, gap: 8 },
  snapRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  snapPos:    { fontFamily: FontFamily.bodyBold, fontSize: 14, width: 28 },
  snapName:   { flex: 1, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  snapPts:    { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
});

// ──────────── How it works styles ─────────────
const hw = StyleSheet.create({
  card:    { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  iconWrap:{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title:   { flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  body:    { paddingHorizontal: 14, paddingBottom: 14, gap: 12 },
  intro:   { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 20, marginBottom: 4 },
  row:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  emoji:   { fontSize: 22, width: 30, textAlign: 'center', marginTop: 1 },
  rowTitle:{ fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  rowDesc: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 19, marginTop: 2 },
});
