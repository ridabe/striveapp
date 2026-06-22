import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { GOAL_COLORS, extraCategoryLabel, EXTRA_CATEGORIES } from '@/lib/exerciseConfig';

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const CATEGORY_ICON: Record<string, any> = {
  aquecimento: 'flame-outline', hiit: 'flash-outline', mobilidade: 'body-outline',
  cardio: 'heart-outline', desafio: 'trophy-outline', forca: 'barbell-outline', outros: 'ellipsis-horizontal-outline',
};
const CATEGORY_COLOR: Record<string, string> = {
  aquecimento: '#F97316', hiit: '#EF4444', mobilidade: '#8B5CF6',
  cardio: '#EC4899', desafio: '#F59E0B', forca: '#3B82F6', outros: '#64748B',
};

interface Plan {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  routines: { id: string; name: string; day_of_week: number | null }[];
}

interface ExtraWorkout {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

export default function TreinosScreen() {
  const { student } = useStudent();
  const { primaryColor } = useThemeStore();

  const [tab, setTab] = useState<'planos' | 'extras'>('planos');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [extras, setExtras] = useState<ExtraWorkout[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!student) return;
    const [assignRes, extraRes] = await Promise.all([
      supabase
        .from('student_plan_assignments')
        .select('plan_id, status, workout_plans(id, name, goal, status, workout_routines(id, name, day_of_week, display_order))')
        .eq('student_id', student.id)
        .order('assigned_at', { ascending: false }),
      supabase
        .from('extra_workouts')
        .select('id, name, category, description')
        .eq('student_id', student.id)
        .eq('is_template', false)
        .order('created_at', { ascending: false }),
    ]);

    const mapped: Plan[] = (assignRes.data ?? [])
      .filter((a: any) => a.workout_plans)
      .map((a: any) => ({
        id: a.workout_plans.id,
        name: a.workout_plans.name,
        goal: a.workout_plans.goal,
        status: a.workout_plans.status,
        routines: (a.workout_plans.workout_routines ?? [])
          .sort((x: any, y: any) => x.display_order - y.display_order),
      }));

    setPlans(mapped);
    setExtras(extraRes.data ?? []);
    setLoading(false);
  }, [student?.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.headerRow}>
          <Text style={s.title}>Treinos</Text>
        </View>
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.headerRow}>
        <Text style={s.title}>Treinos</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['planos', 'extras'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, tab === t && { borderBottomColor: primaryColor }]}
            onPress={() => setTab(t)}
            activeOpacity={0.75}
          >
            <Text style={[s.tabText, tab === t && { color: primaryColor }]}>
              {t === 'planos' ? `Planos (${plans.length})` : `Extras (${extras.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'planos' ? (
        <FlatList
          data={plans}
          keyExtractor={p => p.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="document-text-outline" size={48} color={Colors.border} />
              <Text style={s.emptyTitle}>Nenhum plano atribuído</Text>
              <Text style={s.emptyDesc}>Seu treinador ainda não atribuiu nenhum plano de treino.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const goalColor = GOAL_COLORS[item.goal ?? ''] ?? primaryColor;
            const todayIdx = new Date().getDay();
            return (
              <TouchableOpacity
                style={s.planCard}
                onPress={() => router.push(`/(student)/treinos/${item.id}/executar` as any)}
                activeOpacity={0.8}
              >
                <View style={s.planTop}>
                  <Text style={s.planName} numberOfLines={1}>{item.name}</Text>
                  {item.goal && (
                    <View style={[s.pill, { backgroundColor: `${goalColor}20` }]}>
                      <Text style={[s.pillText, { color: goalColor }]}>{item.goal}</Text>
                    </View>
                  )}
                </View>
                {/* Day indicators */}
                <View style={s.daysRow}>
                  {DAY_LABELS.map((label, idx) => {
                    const hasRoutine = item.routines.some(r => r.day_of_week === idx);
                    const isToday = idx === todayIdx;
                    return (
                      <View
                        key={idx}
                        style={[
                          s.dayDot,
                          hasRoutine && { backgroundColor: isToday ? primaryColor : `${primaryColor}55` },
                          isToday && hasRoutine && s.dayDotToday,
                        ]}
                      >
                        <Text style={[s.dayDotText, hasRoutine && { color: isToday ? '#fff' : primaryColor }]}>
                          {label[0]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <View style={s.planMeta}>
                  <Ionicons name="list-outline" size={12} color={Colors.textSecondary} />
                  <Text style={s.planMetaText}>{item.routines.length} rotina{item.routines.length !== 1 ? 's' : ''}</Text>
                  <View style={[s.statusDot, { backgroundColor: item.status === 'active' ? '#4ADE80' : Colors.border }]} />
                  <Text style={s.planMetaText}>{item.status === 'active' ? 'Ativo' : 'Inativo'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} style={s.chevron} />
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <FlatList
          data={extras}
          keyExtractor={e => e.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="flash-outline" size={48} color={Colors.border} />
              <Text style={s.emptyTitle}>Nenhum treino extra</Text>
              <Text style={s.emptyDesc}>Seu treinador ainda não atribuiu treinos extras.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cc = CATEGORY_COLOR[item.category] ?? '#64748B';
            const icon = CATEGORY_ICON[item.category] ?? 'flash-outline';
            return (
              <TouchableOpacity
                style={s.extraCard}
                onPress={() => router.push(`/(student)/treinos/extras/${item.id}/executar` as any)}
                activeOpacity={0.8}
              >
                <View style={[s.extraIcon, { backgroundColor: `${cc}18` }]}>
                  <Ionicons name={icon} size={22} color={cc} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.extraName} numberOfLines={1}>{item.name}</Text>
                  <View style={[s.pill, { backgroundColor: `${cc}18`, alignSelf: 'flex-start', marginTop: 4 }]}>
                    <Text style={[s.pillText, { color: cc }]}>{extraCategoryLabel(item.category)}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  headerRow: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  title: { fontFamily: FontFamily.display, fontSize: 28, color: Colors.textPrimary },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, marginTop: 4 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 10 },
  planCard: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16 },
  planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  planName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pillText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  daysRow: { flexDirection: 'row', gap: 5, marginBottom: 12 },
  dayDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  dayDotToday: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 3 },
  dayDotText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  planMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  planMetaText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 6 },
  chevron: { position: 'absolute', right: 16, top: '50%' },
  extraCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 12 },
  extraIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  extraName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  empty: { alignItems: 'center', paddingTop: 64, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
