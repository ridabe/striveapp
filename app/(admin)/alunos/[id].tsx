import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions, Alert, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useThemeStore } from '@/stores/themeStore';
import { useModulesStore } from '@/stores/modulesStore';
import { MODULE } from '@/lib/modules';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const MAX_COLOR = '#7C3AED';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 48) / 2;

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentDetail {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  goal: string | null;
  birth_date: string | null;
  notes: string | null;
  created_at: string;
}

interface ModuleCounts {
  anamnese: 'completed' | 'partial' | 'none';
  planos: number;
  avaliacoes: number;
  financeiro: number;
  frequencia: number;
  historico: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function fmtBirth(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  const age = calcAge(iso);
  return `${day}/${month}/${year} (${age} anos)`;
}

// ─── Module card config ───────────────────────────────────────────────────────
function getModuleLabel(counts: ModuleCounts) {
  const anamneseLabel =
    counts.anamnese === 'completed' ? 'Preenchida' :
    counts.anamnese === 'partial'   ? 'Rascunho' : 'Pendente';

  return [
    {
      key: 'anamnese',
      title: 'Anamnese',
      icon: 'document-text-outline' as const,
      iconBg: '#F43F5E',
      badge: anamneseLabel,
      badgeColor:
        counts.anamnese === 'completed' ? Colors.success :
        counts.anamnese === 'partial'   ? Colors.warning : Colors.textSecondary,
      onPress: (sid: string) => router.push({ pathname: '/(admin)/anamnese' as any, params: { studentId: sid } }),
    },
    {
      key: 'planos',
      title: 'Planos de Treino',
      icon: 'clipboard-outline' as const,
      iconBg: '#3B82F6',
      badge: `${counts.planos} ${counts.planos === 1 ? 'plano' : 'planos'}`,
      badgeColor: Colors.textSecondary,
      onPress: (sid: string) => router.push({ pathname: '/(admin)/planos' as any, params: { studentId: sid } }),
    },
    {
      key: 'avaliacoes',
      title: 'Avaliações',
      icon: 'trending-up-outline' as const,
      iconBg: '#8B5CF6',
      badge: `${counts.avaliacoes} ${counts.avaliacoes === 1 ? 'avaliação' : 'avaliações'}`,
      badgeColor: Colors.textSecondary,
      onPress: (sid: string) => router.push({ pathname: '/(admin)/avaliacao' as any, params: { studentId: sid } }),
    },
    {
      key: 'financeiro',
      title: 'Financeiro',
      icon: 'cash-outline' as const,
      iconBg: '#10B981',
      badge: `${counts.financeiro} ${counts.financeiro === 1 ? 'plano' : 'planos'}`,
      badgeColor: Colors.textSecondary,
      onPress: null,
    },
    {
      key: 'frequencia',
      title: 'Frequência',
      icon: 'calendar-outline' as const,
      iconBg: '#F59E0B',
      badge: `${counts.frequencia} ${counts.frequencia === 1 ? 'treino' : 'treinos'}`,
      badgeColor: counts.frequencia > 0 ? Colors.success : Colors.textSecondary,
      onPress: (sid: string) => router.push({ pathname: '/(admin)/frequencia' as any, params: { studentId: sid } }),
    },
    {
      key: 'historico',
      title: 'Histórico de Treinos',
      icon: 'time-outline' as const,
      iconBg: '#14B8A6',
      badge: `${counts.historico} ${counts.historico === 1 ? 'sessão' : 'sessões'}`,
      badgeColor: counts.historico > 0 ? Colors.success : Colors.textSecondary,
      onPress: (sid: string) => router.push({ pathname: '/(admin)/frequencia' as any, params: { studentId: sid } }),
    },
  ];
}

// ─── Info row ─────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoIconWrap}>
        <Ionicons name={icon} size={16} color={Colors.textSecondary} />
      </View>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

type RankingInfo = {
  rank: number;
  total: number;
  points: number;
  workouts: number;
  activeMinutes: number;
};

const MEDAL = ['🥇', '🥈', '🥉'];
const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { primaryColor } = useThemeStore();
  const hasMaxModule = useModulesStore().has(MODULE.ASSISTENTE_IA);

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [counts, setCounts] = useState<ModuleCounts>({
    anamnese: 'none', planos: 0, avaliacoes: 0, financeiro: 0, frequencia: 0, historico: 0,
  });
  const [rankingInfo, setRankingInfo] = useState<RankingInfo | null>(null);
  const [gamificationActive, setGamificationActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [resetting, setResetting] = useState(false);

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const lightText = ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(primaryColor);

  useEffect(() => {
    if (!id) return;
    loadAll();
  }, [id]);

  async function loadAll() {
    const [studentRes, anamneseRes, avaliacoesRes, frequenciaRes, gamSettingsRes] = await Promise.all([
      supabase.from('students')
        .select('id, full_name, email, phone, status, goal, birth_date, notes, created_at')
        .eq('id', id)
        .single(),
      supabase.from('anamnese_responses')
        .select('completed_at')
        .eq('student_id', id)
        .maybeSingle(),
      supabase.from('physical_assessments')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', id),
      supabase.from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', id),
      supabase.from('gamification_settings').select('is_active').single(),
    ]);

    const [planosRes, financeiroRes, historicoRes] = await Promise.all([
      supabase.from('student_plan_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', id),
      supabase.from('financial_plans')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', id),
      supabase.from('workout_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', id),
    ]);

    setStudent(studentRes.data ?? null);

    const anamData = anamneseRes.data;
    const anamStatus: ModuleCounts['anamnese'] =
      !anamData ? 'none' :
      anamData.completed_at ? 'completed' : 'partial';

    setCounts({
      anamnese: anamStatus,
      planos: planosRes.count ?? 0,
      avaliacoes: avaliacoesRes.count ?? 0,
      financeiro: financeiroRes.count ?? 0,
      frequencia: frequenciaRes.count ?? 0,
      historico: historicoRes.count ?? 0,
    });

    const isActive = gamSettingsRes.data?.is_active ?? false;
    setGamificationActive(isActive);

    if (isActive) {
      const [myPtsRes, aboveRes, totalRes] = await Promise.all([
        supabase.from('monthly_points')
          .select('total_points, workouts_completed, active_minutes')
          .eq('student_id', id).eq('month', month).eq('year', year)
          .maybeSingle(),
        supabase.from('monthly_points')
          .select('id', { count: 'exact', head: true })
          .eq('month', month).eq('year', year)
          .gt('total_points', 0),
        supabase.from('monthly_points')
          .select('id', { count: 'exact', head: true })
          .eq('month', month).eq('year', year),
      ]);

      if (myPtsRes.data) {
        const myPoints = myPtsRes.data.total_points;
        const { count: aboveCount } = await supabase.from('monthly_points')
          .select('id', { count: 'exact', head: true })
          .eq('month', month).eq('year', year)
          .gt('total_points', myPoints);

        setRankingInfo({
          rank: (aboveCount ?? 0) + 1,
          total: totalRes.count ?? 1,
          points: myPoints,
          workouts: myPtsRes.data.workouts_completed,
          activeMinutes: myPtsRes.data.active_minutes,
        });
      } else {
        setRankingInfo({ rank: 0, total: totalRes.count ?? 0, points: 0, workouts: 0, activeMinutes: 0 });
      }
    }

    setLoading(false);
  }

  async function handleResetPassword() {
    setActionsVisible(false);
    Alert.alert(
      'Enviar nova senha provisória',
      `Uma nova senha temporária será gerada e enviada para o e-mail de ${student?.full_name ?? 'este aluno'}. Ele precisará alterá-la no próximo acesso.\n\nDeseja continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          style: 'default',
          onPress: async () => {
            setResetting(true);
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const token = session?.access_token;
              if (!token) throw new Error('Sessão expirada. Faça login novamente.');

              const { data, error } = await supabase.functions.invoke('reset-student-password', {
                body: { student_id: id },
              });

              if (error) {
                let msg = error.message;
                try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch {}
                throw new Error(msg);
              }
              if (data?.error) throw new Error(data.error);

              Alert.alert(
                'Senha enviada!',
                `Uma nova senha provisória foi enviada para o e-mail de ${student?.full_name}. O aluno precisará alterá-la no próximo login.`,
              );
            } catch (err: any) {
              Alert.alert('Erro', err.message ?? 'Não foi possível redefinir a senha.');
            } finally {
              setResetting(false);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!student) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Aluno</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={s.emptyState}>
          <Ionicons name="person-outline" size={52} color={Colors.border} />
          <Text style={s.emptyTitle}>Aluno não encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initials = student.full_name
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const modules = getModuleLabel(counts);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Alunos</Text>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => setActionsVisible(true)}
          disabled={resetting}
        >
          {resetting
            ? <ActivityIndicator size="small" color={Colors.textSecondary} />
            : <Ionicons name="ellipsis-vertical" size={22} color={Colors.textPrimary} />
          }
        </TouchableOpacity>
      </View>

      {/* Action sheet */}
      <Modal
        visible={actionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionsVisible(false)}
      >
        <TouchableOpacity
          style={s.actionsOverlay}
          activeOpacity={1}
          onPress={() => setActionsVisible(false)}
        >
          <View style={s.actionsSheet}>
            <View style={s.actionsHandle} />
            <Text style={s.actionsTitle}>Ações do aluno</Text>

            <TouchableOpacity
              style={s.actionItem}
              onPress={handleResetPassword}
              activeOpacity={0.75}
            >
              <View style={[s.actionIconWrap, { backgroundColor: `${Colors.warning}18` }]}>
                <Ionicons name="key-outline" size={20} color={Colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.actionItemLabel}>Enviar nova senha provisória</Text>
                <Text style={s.actionItemDesc}>
                  Gera uma nova senha e envia por e-mail para {student?.full_name?.split(' ')[0]}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.border} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.actionItem, { marginBottom: 0 }]}
              onPress={() => setActionsVisible(false)}
              activeOpacity={0.75}
            >
              <View style={[s.actionIconWrap, { backgroundColor: Colors.border }]}>
                <Ionicons name="close-outline" size={20} color={Colors.textSecondary} />
              </View>
              <Text style={[s.actionItemLabel, { color: Colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Profile hero */}
        <View style={s.hero}>
          <View style={[s.avatarLarge, { backgroundColor: `${primaryColor}22` }]}>
            <Text style={[s.avatarText, { color: primaryColor }]}>{initials}</Text>
          </View>
          <View style={s.heroInfo}>
            <Text style={s.studentName}>{student.full_name.toUpperCase()}</Text>
            <View style={[
              s.statusBadge,
              { backgroundColor: student.status === 'active' ? `${Colors.success}22` : `${Colors.textSecondary}22` }
            ]}>
              <View style={[s.statusDot, { backgroundColor: student.status === 'active' ? Colors.success : Colors.textSecondary }]} />
              <Text style={[s.statusText, { color: student.status === 'active' ? Colors.success : Colors.textSecondary }]}>
                {student.status === 'active' ? 'Ativo' : 'Inativo'}
              </Text>
            </View>
          </View>
        </View>

        {/* Ranking card */}
        {gamificationActive && (
          <TouchableOpacity
            style={[s.rankCard, { borderColor: rankingInfo?.rank && rankingInfo.rank <= 3 ? `${primaryColor}60` : Colors.border }]}
            onPress={() => router.push('/(admin)/ranking' as any)}
            activeOpacity={0.8}
          >
            <View style={[s.rankIconWrap, { backgroundColor: `${primaryColor}18` }]}>
              <Ionicons name="trophy-outline" size={20} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rankLabel}>RANKING — {MONTH_NAMES[month - 1].toUpperCase()} {year}</Text>
              {rankingInfo && rankingInfo.rank > 0 ? (
                <>
                  <Text style={[s.rankPosition, { color: primaryColor }]}>
                    {rankingInfo.rank <= 3 ? MEDAL[rankingInfo.rank - 1] : `#${rankingInfo.rank}`}
                    {' '}
                    <Text style={s.rankOf}>de {rankingInfo.total}</Text>
                  </Text>
                  <Text style={s.rankStats}>
                    {rankingInfo.points.toLocaleString('pt-BR')} pts · {rankingInfo.workouts} treinos · {rankingInfo.activeMinutes} min
                  </Text>
                </>
              ) : (
                <Text style={s.rankNoData}>
                  {rankingInfo ? 'Sem pontos registrados este mês' : 'Carregando...'}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Info card */}
        <View style={s.infoCard}>
          {student.email && (
            <InfoRow icon="mail-outline" label="E-mail" value={student.email} />
          )}
          {student.phone && (
            <>
              <View style={s.divider} />
              <InfoRow icon="call-outline" label="Telefone" value={student.phone} />
            </>
          )}
          {student.birth_date && (
            <>
              <View style={s.divider} />
              <InfoRow icon="calendar-outline" label="Nascimento" value={fmtBirth(student.birth_date)} />
            </>
          )}
          {student.goal && (
            <>
              <View style={s.divider} />
              <InfoRow icon="flag-outline" label="Objetivo" value={student.goal} />
            </>
          )}
        </View>

        {/* Modules */}
        <Text style={s.sectionTitle}>MÓDULOS DO ALUNO</Text>
        <View style={s.moduleGrid}>
          {modules.map(mod => (
            <TouchableOpacity
              key={mod.key}
              style={s.moduleCard}
              activeOpacity={mod.onPress ? 0.72 : 1}
              onPress={() => mod.onPress?.(student!.id)}
            >
              <View style={s.moduleCardInner}>
                <View style={[s.moduleIcon, { backgroundColor: `${mod.iconBg}22` }]}>
                  <Ionicons name={mod.icon} size={22} color={mod.iconBg} />
                </View>
                <Text style={s.moduleName}>{mod.title}</Text>
                <View style={[s.moduleBadge, { backgroundColor: `${mod.badgeColor}22` }]}>
                  <Text style={[s.moduleBadgeText, { color: mod.badgeColor }]}>{mod.badge}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} style={s.moduleArrow} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Max Strive IA */}
        {hasMaxModule && (
          <TouchableOpacity
            style={s.maxCard}
            onPress={() => router.push({ pathname: '/(admin)/assistente-ia' as any, params: { studentId: student!.id } })}
            activeOpacity={0.8}
          >
            <View style={s.maxIconWrap}>
              <Ionicons name="flash-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.maxCardTitle}>Consultar Max Strive</Text>
              <Text style={s.maxCardSub}>IA consultora — crie treinos, analise progresso e mais</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={MAX_COLOR} />
          </TouchableOpacity>
        )}

        {/* Observações */}
        {(student.notes !== null && student.notes !== undefined) && (
          <>
            <Text style={s.sectionTitle}>OBSERVAÇÕES</Text>
            <View style={s.notesCard}>
              <Text style={s.notesText}>{student.notes || 'Sem restrições'}</Text>
            </View>
          </>
        )}

        {/* Member since */}
        <Text style={s.memberSince}>
          Aluno desde{' '}
          {new Date(student.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },

  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  // Hero
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 24 },
  avatarLarge: { width: 72, height: 72, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FontFamily.bodyBold, fontSize: 26 },
  heroInfo: { flex: 1, gap: 8 },
  studentName: { fontFamily: FontFamily.display, fontSize: FontSize.lg, color: Colors.textPrimary, letterSpacing: 0.5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },

  // Ranking card
  rankCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1,
    padding: 14, marginBottom: 16,
  },
  rankIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rankLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 10, color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 2 },
  rankPosition: { fontFamily: FontFamily.display, fontSize: 22 },
  rankOf: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.textSecondary },
  rankStats: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  rankNoData: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  // Info card
  infoCard: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border, overflow: 'hidden', marginBottom: 24,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  infoIconWrap: { width: 28, alignItems: 'center' },
  infoLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: Colors.textSecondary, width: 88 },
  infoValue: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 56 },

  // Modules
  sectionTitle: {
    fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs,
    color: Colors.textSecondary, letterSpacing: 1.2, marginBottom: 12,
  },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  moduleCard: {
    width: CARD_W, backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', padding: 14,
  },
  moduleCardInner: { flex: 1, gap: 8 },
  moduleIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  moduleName: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  moduleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  moduleBadgeText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  moduleArrow: { marginLeft: 4, opacity: 0.5 },

  // Notes
  notesCard: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border, padding: 16, marginBottom: 24,
  },
  notesText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 22 },

  // Max Strive IA
  maxCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1,
    borderColor: `${MAX_COLOR}55`, padding: 14, marginBottom: 24,
  },
  maxIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: MAX_COLOR, alignItems: 'center', justifyContent: 'center',
  },
  maxCardTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: 2 },
  maxCardSub: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },

  // Footer
  memberSince: {
    fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary,
    textAlign: 'center', paddingBottom: 8,
  },

  // States
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, color: Colors.textSecondary },

  // Action sheet
  actionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionsSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  actionsHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  actionsTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 16,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginBottom: 0,
  },
  actionIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  actionItemLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  actionItemDesc: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
});
