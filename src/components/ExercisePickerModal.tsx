import { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { MUSCLE_GROUPS, muscleColor } from '@/lib/exerciseConfig';

export interface ExerciseSummary {
  id: string;
  name: string;
  muscle_group: string;
  load_type: string;
  count_type: string;
  default_sets: number | null;
  default_reps: string | null;
  duration_secs: number | null;
  is_global: boolean;
}

interface Props {
  visible: boolean;
  tenantId: string;
  onSelect: (exercise: ExerciseSummary) => void;
  onClose: () => void;
}

export function ExercisePickerModal({ visible, tenantId, onSelect, onClose }: Props) {
  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('');

  const load = useCallback(async () => {
    if (!tenantId || !visible) return;
    setLoading(true);
    let q = supabase.from('exercises')
      .select('id, name, muscle_group, load_type, count_type, default_sets, default_reps, default_duration_secs, is_global')
      .or(`is_global.eq.true,tenant_id.eq.${tenantId}`)
      .order('name');

    if (muscle) q = q.eq('muscle_group', muscle);
    if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);

    const { data } = await q;
    setExercises((data ?? []).map((e: any) => ({ ...e, duration_secs: e.default_duration_secs })));
    setLoading(false);
  }, [tenantId, visible, search, muscle]);

  useEffect(() => { load(); }, [load]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.iconBtn}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.title}>Selecionar Exercício</Text>
          <View style={{ width: 38 }} />
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

        {/* Muscle filter */}
        <FlatList
          data={[{ key: '', label: 'Todos' }, ...MUSCLE_GROUPS.map(m => ({ key: m, label: m }))]}
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8, gap: 6 }}
          keyExtractor={i => i.key}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.chip, muscle === item.key && { backgroundColor: muscleColor(item.key), borderColor: muscleColor(item.key) }]}
              onPress={() => setMuscle(item.key)} activeOpacity={0.75}>
              <Text style={[s.chipText, muscle === item.key && { color: '#fff' }]}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />

        {/* List */}
        {loading ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} /> : (
          <FlatList
            data={exercises}
            keyExtractor={e => e.id}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32, gap: 6 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="search-outline" size={40} color={Colors.border} />
                <Text style={s.emptyText}>Nenhum exercício encontrado</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={s.exerciseRow} onPress={() => onSelect(item)} activeOpacity={0.75}>
                <View style={[s.muscleTag, { backgroundColor: `${muscleColor(item.muscle_group)}22` }]}>
                  <Text style={[s.muscleTagText, { color: muscleColor(item.muscle_group) }]} numberOfLines={1}>
                    {item.muscle_group.split(' ')[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.exName}>{item.name}</Text>
                  <Text style={s.exMeta}>{item.load_type} · {item.count_type}</Text>
                </View>
                {item.is_global && <Ionicons name="globe-outline" size={14} color={Colors.textSecondary} />}
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
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
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, margin: 12, paddingHorizontal: 12, height: 42,
  },
  searchInput: { flex: 1, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  chipText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  exerciseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  muscleTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, minWidth: 56, alignItems: 'center' },
  muscleTagText: { fontFamily: FontFamily.bodyMedium, fontSize: 10 },
  exName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  exMeta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
});
