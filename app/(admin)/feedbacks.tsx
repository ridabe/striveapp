import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

interface FeedbackItem {
  id: string;
  student_id: string;
  student_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons key={i} name={i <= rating ? 'star' : 'star-outline'} size={size}
          color={i <= rating ? '#FBBF24' : Colors.border} />
      ))}
    </View>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function FeedbacksScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id;

  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [students, setStudents] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    if (!tenantId) return;
    const [fbRes, stRes] = await Promise.all([
      supabase.from('workout_feedbacks')
        .select('id, student_id, rating, comment, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
      supabase.from('students')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .order('full_name'),
    ]);
    const map: Record<string, string> = {};
    (stRes.data ?? []).forEach((s: any) => { map[s.id] = s.full_name; });
    setStudents(stRes.data ?? []);
    setFeedbacks((fbRes.data ?? []).map((f: any) => ({ ...f, student_name: map[f.student_id] ?? 'Aluno' })));
  }, [tenantId]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const list = filter === 'all' ? feedbacks : feedbacks.filter(f => f.student_id === filter);
  const avg = list.length ? list.reduce((s, f) => s + f.rating, 0) / list.length : 0;
  const now = new Date();
  const thisMonth = list.filter(f => {
    const d = new Date(f.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const dist = [5, 4, 3, 2, 1].map(r => ({ r, count: list.filter(f => f.rating === r).length }));
  const maxDist = Math.max(...dist.map(d => d.count), 1);
  const studentsWithFb = students.filter(s => feedbacks.some(f => f.student_id === s.id));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Feedbacks</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} /> : (
        <FlatList
          data={list}
          keyExtractor={i => i.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ListHeaderComponent={
            <>
              {/* Stats */}
              <View style={s.statsRow}>
                <View style={s.ratingCard}>
                  <Text style={[s.bigNum, { color: primaryColor }]}>{avg.toFixed(1)}</Text>
                  <Stars rating={Math.round(avg)} size={18} />
                  <Text style={s.smallLabel}>Média geral</Text>
                  <View style={{ width: '100%', gap: 5, marginTop: 10 }}>
                    {dist.map(({ r, count }) => (
                      <View key={r} style={s.distRow}>
                        <Text style={s.distNum}>{r}</Text>
                        <View style={s.distBg}>
                          <View style={[s.distFill, {
                            width: `${Math.max((count / maxDist) * 100, count > 0 ? 8 : 0)}%`,
                            backgroundColor: primaryColor,
                          }]} />
                        </View>
                        <Text style={s.distCount}>{count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={{ flex: 1, gap: 10 }}>
                  <View style={s.miniStat}>
                    <Ionicons name="chatbubbles-outline" size={20} color={primaryColor} />
                    <Text style={s.miniNum}>{list.length}</Text>
                    <Text style={s.miniLabel}>Total</Text>
                  </View>
                  <View style={s.miniStat}>
                    <Ionicons name="calendar-outline" size={20} color={primaryColor} />
                    <Text style={s.miniNum}>{thisMonth}</Text>
                    <Text style={s.miniLabel}>Este mês</Text>
                  </View>
                  <View style={s.miniStat}>
                    <Ionicons name="people-outline" size={20} color={primaryColor} />
                    <Text style={s.miniNum}>{studentsWithFb.length}</Text>
                    <Text style={s.miniLabel}>Alunos</Text>
                  </View>
                </View>
              </View>

              {/* Filter chips */}
              {studentsWithFb.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 14 }}
                  contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
                  {[{ id: 'all', full_name: 'Todos os alunos' }, ...studentsWithFb].map(st => (
                    <TouchableOpacity key={st.id}
                      style={[s.chip, filter === st.id && { backgroundColor: primaryColor, borderColor: primaryColor }]}
                      onPress={() => setFilter(st.id)} activeOpacity={0.75}>
                      <Text style={[s.chipText, filter === st.id && { color: '#000' }]}>
                        {st.full_name.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {list.length > 0 && (
                <Text style={s.sectionLabel}>{list.length} FEEDBACKS</Text>
              )}
            </>
          }
          renderItem={({ item }) => {
            const initials = item.student_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            return (
              <View style={s.card}>
                <View style={s.cardTop}>
                  <View style={[s.avatar, { backgroundColor: `${primaryColor}20` }]}>
                    <Text style={[s.avatarLetter, { color: primaryColor }]}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{item.student_name}</Text>
                    <Text style={s.dateText}>{fmtDate(item.created_at)}</Text>
                  </View>
                  <Stars rating={item.rating} />
                </View>
                {item.comment ? (
                  <View style={s.commentBox}>
                    <Ionicons name="chatbubble-outline" size={13} color={Colors.textSecondary} style={{ marginTop: 2 }} />
                    <Text style={s.commentText}>{item.comment}</Text>
                  </View>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={52} color={Colors.border} />
              <Text style={s.emptyTitle}>Nenhum feedback ainda</Text>
              <Text style={s.emptyText}>Os feedbacks aparecem aqui quando os alunos avaliam os treinos.</Text>
            </View>
          }
        />
      )}
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
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },

  statsRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 16 },
  ratingCard: {
    flex: 1.3, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border, padding: 16, alignItems: 'center', gap: 6,
  },
  bigNum: { fontFamily: FontFamily.bodyBold, fontSize: 38 },
  smallLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distNum: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, width: 8, textAlign: 'right' },
  distBg: { flex: 1, height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  distFill: { height: 5, borderRadius: 3, minWidth: 4 },
  distCount: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, width: 18, textAlign: 'right' },

  miniStat: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 4,
  },
  miniNum: { fontFamily: FontFamily.bodyBold, fontSize: 22, color: Colors.textPrimary },
  miniLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },

  chip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  chipText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 10 },

  card: {
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, padding: 14, marginBottom: 10, gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: FontFamily.bodyBold, fontSize: 15 },
  name: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  dateText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  commentBox: { flexDirection: 'row', gap: 8, backgroundColor: Colors.bg, borderRadius: 10, padding: 10, alignItems: 'flex-start' },
  commentText: { flex: 1, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  empty: { alignItems: 'center', paddingTop: 64, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
