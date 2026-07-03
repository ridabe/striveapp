import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, LayoutAnimation,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { StudentHeader } from '@/components/StudentHeader';
import { MediaViewerModal } from '@/components/MediaViewerModal';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Challenge {
  id: string; name: string; description: string | null; rules: string | null; prizes: string | null;
  status: string; cover_image_url: string | null; show_results_to_students: boolean;
}
interface DayItem {
  id: string; item_type: string; title: string; content: string | null;
  exercise_name: string | null; exercise_video_url: string | null;
}
interface Day { id: string; day_number: number; title: string | null; items: DayItem[] }
interface Message { id: string; message: string; created_at: string }
interface RankingRow {
  student_id: string; full_name: string; result_rank: number | null;
  initial_weight: number | null; final_weight: number | null;
  initial_body_fat: number | null; final_body_fat: number | null; result_delta_pp: number | null;
}

const ITEM_ICON: Record<string, any> = {
  exercise: 'barbell-outline', reading: 'book-outline', tip: 'chatbubble-ellipses-outline', file: 'document-attach-outline',
};

export default function StudentDesafiosScreen() {
  const { selectedStudent } = useStudent();
  const { primaryColor } = useThemeStore();

  const [loading, setLoading] = useState(true);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [completedItemIds, setCompletedItemIds] = useState<Set<string>>(new Set());
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState('');

  const load = useCallback(async () => {
    if (!selectedStudent) return;

    // Todas as participações ativas/publicadas — nunca .maybeSingle() aqui:
    // um aluno pode estar em mais de um desafio ao mesmo tempo.
    const { data: participations } = await supabase
      .from('challenge_participants')
      .select('id, challenge_id, result_rank, result_delta_pp, initial_weight, initial_body_fat, final_weight, final_body_fat, challenges(id, name, description, rules, prizes, status, cover_image_url, show_results_to_students, created_at)')
      .eq('student_id', selectedStudent.id);

    const visible = (participations ?? [])
      .filter((p: any) => p.challenges && (p.challenges.status === 'active' || p.challenges.status === 'published'))
      .sort((a: any, b: any) => {
        // Prioriza um desafio ativo sobre um publicado; entre iguais, o mais recente.
        if (a.challenges.status !== b.challenges.status) return a.challenges.status === 'active' ? -1 : 1;
        return new Date(b.challenges.created_at).getTime() - new Date(a.challenges.created_at).getTime();
      });

    const current = visible[0];
    if (!current) {
      setChallenge(null);
      setLoading(false);
      return;
    }

    setParticipantId(current.id);
    setChallenge(current.challenges);

    if (current.challenges.status === 'active') {
      const { data: daysData } = await supabase
        .from('challenge_days')
        .select('id, day_number, title, challenge_day_items(id, item_type, title, content, sort_order, exercises(name, video_url))')
        .eq('challenge_id', current.challenge_id)
        .eq('status', 'published')
        .order('day_number', { ascending: false });

      setDays((daysData ?? []).map((d: any) => ({
        id: d.id, day_number: d.day_number, title: d.title,
        items: (d.challenge_day_items ?? [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((i: any) => ({
            ...i,
            exercise_name: i.exercises?.name ?? null,
            exercise_video_url: i.exercises?.video_url ?? null,
          })),
      })));

      const { data: progress } = await supabase
        .from('challenge_item_progress')
        .select('challenge_day_item_id')
        .eq('participant_id', current.id);
      setCompletedItemIds(new Set((progress ?? []).map((p: any) => p.challenge_day_item_id)));

      const { data: msgs } = await supabase
        .from('challenge_messages')
        .select('id, message, created_at')
        .eq('challenge_id', current.challenge_id)
        .order('created_at', { ascending: false })
        .limit(5);
      setMessages(msgs ?? []);
    }

    if (current.challenges.status === 'published') {
      const { data: allParticipants } = await supabase
        .from('challenge_participants')
        .select('student_id, result_rank, result_delta_pp, initial_weight, final_weight, initial_body_fat, final_body_fat, students(full_name)')
        .eq('challenge_id', current.challenge_id)
        .order('result_rank', { ascending: true, nullsFirst: false });

      setRanking((allParticipants ?? []).map((p: any) => ({
        student_id: p.student_id, full_name: p.students?.full_name ?? 'Aluno',
        result_rank: p.result_rank, result_delta_pp: p.result_delta_pp,
        initial_weight: p.initial_weight, final_weight: p.final_weight,
        initial_body_fat: p.initial_body_fat, final_body_fat: p.final_body_fat,
      })));
    }

    setLoading(false);
  }, [selectedStudent]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function toggleDay(dayId: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayId)) next.delete(dayId); else next.add(dayId);
      return next;
    });
  }

  // Marcar item concluído — sem confirmação e sem "desmarcar" (irreversível por design,
  // ver docs/MODULO_DESAFIOS.md §3.6 e §13.2). Pontuação é decidida inteiramente no
  // servidor pela RPC mark_challenge_item_complete — nenhuma lógica de pontos aqui.
  async function handleMarkComplete(itemId: string) {
    setMarkingId(itemId);
    setCompletedItemIds(prev => new Set(prev).add(itemId)); // otimista
    try {
      const { data, error } = await supabase.rpc('mark_challenge_item_complete', { p_item_id: itemId });
      if (error || (data as any)?.error) {
        setCompletedItemIds(prev => { const n = new Set(prev); n.delete(itemId); return n; });
      }
    } catch {
      setCompletedItemIds(prev => { const n = new Set(prev); n.delete(itemId); return n; });
    } finally {
      setMarkingId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <StudentHeader title="Desafios" />
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  // ── Vazio ──
  if (!challenge) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <StudentHeader title="Desafios" />
        <View style={s.empty}>
          <Ionicons name="flag-outline" size={52} color={Colors.border} />
          <Text style={s.emptyTitle}>Nenhum desafio no momento</Text>
          <Text style={s.emptyText}>Quando seu personal colocar você em um desafio, ele aparece aqui.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Resultado publicado ──
  if (challenge.status === 'published') {
    const MEDAL = ['🥇', '🥈', '🥉'];
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <StudentHeader title="Desafios" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {challenge.cover_image_url && (
            <Image source={{ uri: challenge.cover_image_url }} style={s.cover} resizeMode="cover" />
          )}
          <Text style={s.challengeName}>{challenge.name}</Text>
          <Text style={s.resultLabel}>RESULTADO FINAL</Text>

          {ranking.map(r => {
            const isMe = r.student_id === selectedStudent?.id;
            return (
              <View key={r.student_id} style={[s.rankRow, isMe && { borderColor: `${primaryColor}60`, backgroundColor: `${primaryColor}12` }]}>
                <Text style={[s.rankPos, r.result_rank != null && r.result_rank <= 3 && { fontSize: 18 }]}>
                  {r.result_rank ? (r.result_rank <= 3 ? MEDAL[r.result_rank - 1] : `#${r.result_rank}`) : '—'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rankName, isMe && { color: primaryColor, fontFamily: FontFamily.bodyBold }]} numberOfLines={1}>
                    {isMe ? `▶ Você` : r.full_name}
                  </Text>
                  {challenge.show_results_to_students && r.initial_body_fat != null && r.final_body_fat != null && (
                    <Text style={s.rankSub}>
                      {r.initial_body_fat}% → {r.final_body_fat}% ({r.result_delta_pp && r.result_delta_pp > 0 ? '-' : '+'}{Math.abs(r.result_delta_pp ?? 0)} p.p.)
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
          {ranking.length === 0 && <Text style={s.emptyHint}>Resultado ainda não disponível.</Text>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Ativo ──
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StudentHeader title="Desafios" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {challenge.cover_image_url && (
          <Image source={{ uri: challenge.cover_image_url }} style={s.cover} resizeMode="cover" />
        )}
        <Text style={s.challengeName}>{challenge.name}</Text>
        {challenge.description && <Text style={s.challengeDesc}>{challenge.description}</Text>}
        {challenge.rules && <InfoBlock label="REGRAS" text={challenge.rules} />}
        {challenge.prizes && <InfoBlock label="PREMIAÇÕES" text={challenge.prizes} />}

        {messages.length > 0 && (
          <>
            <Text style={s.sectionTitle}>DICAS DO SEU PERSONAL</Text>
            {messages.map(m => (
              <View key={m.id} style={s.messageCard}>
                <Text style={s.messageText}>{m.message}</Text>
                <Text style={s.messageDate}>{new Date(m.created_at).toLocaleDateString('pt-BR')}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={s.sectionTitle}>DIAS DISPONÍVEIS</Text>
        {days.length === 0 ? (
          <Text style={s.emptyHint}>Nenhum dia liberado ainda. Volte em breve!</Text>
        ) : days.map(day => {
          const expanded = expandedDays.has(day.id);
          const doneCount = day.items.filter(i => completedItemIds.has(i.id)).length;
          return (
            <View key={day.id} style={s.dayCard}>
              <TouchableOpacity style={s.dayHeader} onPress={() => toggleDay(day.id)} activeOpacity={0.75}>
                <View style={[s.dayBadge, doneCount === day.items.length && day.items.length > 0 && { backgroundColor: `${primaryColor}20` }]}>
                  <Text style={[s.dayBadgeText, doneCount === day.items.length && day.items.length > 0 && { color: primaryColor }]}>{day.day_number}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.dayTitle}>{day.title || `Dia ${day.day_number}`}</Text>
                  <Text style={s.dayMeta}>{doneCount}/{day.items.length} concluído(s)</Text>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
              {expanded && (
                <View style={s.dayBody}>
                  {day.items.map(item => {
                    const done = completedItemIds.has(item.id);
                    const hasVideo = item.item_type === 'exercise' && !!item.exercise_video_url;
                    const isGif = item.exercise_video_url?.toLowerCase().includes('.gif');
                    return (
                      <View key={item.id} style={s.itemRow}>
                        <Ionicons name={ITEM_ICON[item.item_type] ?? 'ellipse-outline'} size={16} color={Colors.textSecondary} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.itemTitle}>{item.exercise_name || item.title}</Text>
                          {item.content && <Text style={s.itemContent}>{item.content}</Text>}
                          {hasVideo && (
                            <TouchableOpacity
                              style={[s.videoPill, { backgroundColor: `${primaryColor}18`, borderColor: `${primaryColor}40` }]}
                              onPress={() => {
                                setVideoTitle(item.exercise_name || item.title);
                                setVideoUri(item.exercise_video_url);
                              }}
                              activeOpacity={0.75}
                            >
                              <Ionicons name={isGif ? 'image-outline' : 'play-circle-outline'} size={13} color={primaryColor} />
                              <Text style={[s.videoPillText, { color: primaryColor }]}>Ver Exercício</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <TouchableOpacity
                          style={[s.checkBtn, done && { backgroundColor: `${primaryColor}20`, borderColor: primaryColor }]}
                          onPress={() => !done && handleMarkComplete(item.id)}
                          disabled={done || markingId === item.id}
                          activeOpacity={0.75}
                        >
                          {markingId === item.id ? (
                            <ActivityIndicator size="small" color={primaryColor} />
                          ) : (
                            <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={done ? primaryColor : Colors.textSecondary} />
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>

      {videoUri && (
        <MediaViewerModal
          visible
          uri={videoUri}
          type={videoUri.toLowerCase().includes('.gif') ? 'image' : 'video'}
          title={videoTitle}
          onClose={() => setVideoUri(null)}
        />
      )}
    </SafeAreaView>
  );
}

function InfoBlock({ label, text }: { label: string; text: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.infoBlockText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40, marginTop: -60 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.lg, color: Colors.textPrimary, textAlign: 'center' },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyHint: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },

  cover: { width: '100%', aspectRatio: 1200 / 630, borderRadius: 16, marginBottom: 14 },
  challengeName: { fontFamily: FontFamily.display, fontSize: 24, color: Colors.textPrimary, marginBottom: 6 },
  challengeDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  label: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 4 },
  infoBlockText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },

  sectionTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 0.8, marginTop: 16, marginBottom: 10 },

  messageCard: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 8 },
  messageText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  messageDate: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, marginTop: 4 },

  dayCard: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, overflow: 'hidden' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  dayBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  dayBadgeText: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: Colors.textSecondary },
  dayTitle: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  dayMeta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  dayBody: { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemTitle: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  itemContent: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  videoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, marginTop: 6,
  },
  videoPillText: { fontFamily: FontFamily.bodyBold, fontSize: 11 },
  checkBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },

  resultLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 10 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 8 },
  rankPos: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textSecondary, width: 36, textAlign: 'center' },
  rankName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  rankSub: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
});
