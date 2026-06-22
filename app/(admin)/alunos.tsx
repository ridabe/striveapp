import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

interface Student {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  goal: string | null;
  created_at: string;
}

export default function AlunosScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const tenantId = profile?.tenant_id;

  async function loadStudents() {
    if (!tenantId) return;
    const { data } = await supabase
      .from('students')
      .select('id, full_name, email, phone, status, goal, created_at')
      .eq('tenant_id', tenantId)
      .order('full_name');
    setStudents(data ?? []);
  }

  useEffect(() => {
    loadStudents().finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    let list = students;
    if (filter !== 'all') list = list.filter(s => s.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.full_name.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.includes(q)
      );
    }
    setFiltered(list);
  }, [students, search, filter]);

  async function onRefresh() {
    setRefreshing(true);
    await loadStudents();
    setRefreshing(false);
  }

  const activeCount = students.filter(s => s.status === 'active').length;
  const inactiveCount = students.filter(s => s.status === 'inactive').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Alunos</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: primaryColor }]}>
          <Ionicons name="add" size={22} color={Colors.bg} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color={Colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar aluno..."
          placeholderTextColor={Colors.textSecondary}
          style={styles.searchInput}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filters}>
        {(['all', 'active', 'inactive'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && { backgroundColor: primaryColor, borderColor: primaryColor }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && { color: Colors.bg }]}>
              {f === 'all' ? `Todos (${students.length})` :
               f === 'active' ? `Ativos (${activeCount})` : `Inativos (${inactiveCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyText}>
                {search ? 'Nenhum aluno encontrado' : 'Nenhum aluno cadastrado'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.studentCard}
              onPress={() => router.push(`/(admin)/alunos/${item.id}` as any)}
              activeOpacity={0.75}
            >
              <View style={styles.avatarCircle}>
                <Text style={[styles.avatarInitial, { color: primaryColor }]}>
                  {item.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{item.full_name}</Text>
                {item.goal && (
                  <Text style={styles.studentGoal} numberOfLines={1}>{item.goal}</Text>
                )}
                {item.email && (
                  <Text style={styles.studentEmail} numberOfLines={1}>{item.email}</Text>
                )}
              </View>
              <View style={styles.cardRight}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: item.status === 'active' ? 'rgba(74,222,128,0.15)' : 'rgba(176,176,195,0.15)' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: item.status === 'active' ? Colors.success : Colors.textSecondary }
                  ]}>
                    {item.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} style={{ marginTop: 8 }} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 24, gap: 8 },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.lg,
  },
  studentInfo: { flex: 1 },
  studentName: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  studentGoal: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  studentEmail: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  cardRight: { alignItems: 'flex-end' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
