import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { MUSCLE_GROUPS, muscleColor, loadTypeLabel } from '@/lib/exerciseConfig';

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  load_type: string;
  count_type: string;
  default_sets: number | null;
  default_reps: string | null;
  is_global: boolean;
  video_url: string | null;
}

const PAGE_SIZE = 30;

export default function BancoExerciciosScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? '';

  const [exercises, setExercises]   = useState<Exercise[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]       = useState(true);
  const [page, setPage]             = useState(0);
  const [search, setSearch]         = useState('');
  const [muscle, setMuscle]         = useState('');

  const lightText = ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(primaryColor);

  const fetchPage = useCallback(async (pageIndex: number, reset: boolean) => {
    if (!tenantId) return;
    const from = pageIndex * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;
    let q = supabase.from('exercises')
      .select('id, name, muscle_group, load_type, count_type, default_sets, default_reps, is_global, video_url')
      .or(`is_global.eq.true,tenant_id.eq.${tenantId}`)
      .order('name')
      .range(from, to);
    if (muscle) q = q.eq('muscle_group', muscle);
    if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
    const { data } = await q;
    const rows = data ?? [];
    setExercises(prev => reset ? rows : [...prev, ...rows]);
    setHasMore(rows.length === PAGE_SIZE);
  }, [tenantId, muscle, search]);

  // Reset to page 0 whenever filters change
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    setLoading(true);
    fetchPage(0, true).finally(() => setLoading(false));
  }, [fetchPage]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    await fetchPage(next, false);
    setPage(next);
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, fetchPage]);

  const globalCount = exercises.filter(e => e.is_global).length;
  const tenantCount = exercises.filter(e => !e.is_global).length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Banco de Exercícios</Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: primaryColor }]}
          onPress={() => router.push('/(admin)/banco-exercicios/novo' as any)}
          activeOpacity={0.85}>
          <Ionicons name="add" size={20} color={lightText ? '#000' : '#fff'} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color={Colors.textSecondary} />
        <TextInput
          value={search} onChangeText={setSearch}
          placeholder="Buscar exercício..." placeholderTextColor={Colors.textSecondary}
          style={s.searchInput} autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Muscle group filter */}
      <FlatList
        data={[{ key: '', label: 'Todos' }, ...MUSCLE_GROUPS.map(m => ({ key: m, label: m }))]}
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 2, gap: 6 }}
        keyExtractor={i => i.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.chip, muscle === item.key && { backgroundColor: muscleColor(item.key) || primaryColor, borderColor: muscleColor(item.key) || primaryColor }]}
            onPress={() => setMuscle(m => m === item.key ? '' : item.key)} activeOpacity={0.75}>
            <Text style={[s.chipText, muscle === item.key && { color: '#fff' }]}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Stats row */}
      <View style={s.statsRow}>
        <Text style={s.statsText}>{exercises.length}{hasMore ? '+' : ''} exercícios</Text>
        <View style={s.statsDot} />
        <Text style={s.statsText}>{globalCount} globais</Text>
        <View style={s.statsDot} />
        <Text style={[s.statsText, { color: primaryColor }]}>{tenantCount} seus</Text>
      </View>

      {/* List */}
      {loading ? <ActivityIndicator color={primaryColor} style={{ marginTop: 40 }} /> : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={exercises}
            keyExtractor={e => e.id}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={primaryColor} style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="barbell-outline" size={52} color={Colors.border} />
              <Text style={s.emptyTitle}>Nenhum exercício encontrado</Text>
              <Text style={s.emptyText}>Tente outro filtro ou crie um novo exercício.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const mc = muscleColor(item.muscle_group);
            return (
              <TouchableOpacity
                style={s.card}
                onPress={() => router.push(`/(admin)/banco-exercicios/${item.id}` as any)}
                activeOpacity={0.75}>
                <View style={[s.strip, { backgroundColor: mc }]} />
                {item.video_url ? (
                  <Image source={{ uri: item.video_url }} style={s.thumb} resizeMode="cover" />
                ) : (
                  <View style={s.thumbPlaceholder}>
                    <Ionicons name="barbell-outline" size={18} color={Colors.border} />
                  </View>
                )}
                <View style={s.cardContent}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <Text style={s.exName} numberOfLines={1}>{item.name}</Text>
                    {item.is_global && (
                      <Ionicons name="globe-outline" size={12} color={Colors.textSecondary} />
                    )}
                  </View>
                  <View style={s.cardMeta}>
                    <View style={[s.badge, { backgroundColor: `${mc}18`, borderColor: `${mc}40` }]}>
                      <Text style={[s.badgeText, { color: mc }]}>{item.muscle_group}</Text>
                    </View>
                    <View style={s.badge}>
                      <Text style={s.badgeText}>{loadTypeLabel(item.load_type)}</Text>
                    </View>
                    {item.default_sets && item.default_reps && (
                      <View style={s.badge}>
                        <Text style={s.badgeText}>{item.default_sets}×{item.default_reps}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            );
          }}
          />
        </View>
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
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, flex: 1, marginLeft: 8 },
  addBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, marginHorizontal: 16, marginTop: 12, marginBottom: 4, paddingHorizontal: 12, height: 42,
  },
  searchInput: { flex: 1, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
    alignSelf: 'flex-start',
  },
  chipText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  statsText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },
  statsDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  strip: { width: 4, alignSelf: 'stretch' },
  thumb: { width: 52, height: 52, borderRadius: 10, marginLeft: 8 },
  thumbPlaceholder: {
    width: 52, height: 52, borderRadius: 10, marginLeft: 8,
    backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  cardContent: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, gap: 6 },
  exName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  badge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20,
    backgroundColor: Colors.border, borderWidth: 1, borderColor: 'transparent',
  },
  badgeText: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
