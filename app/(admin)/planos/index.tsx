import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { PLAN_GOALS, GOAL_COLORS } from '@/lib/exerciseConfig';

interface WorkoutPlan {
  id: string;
  name: string;
  goal: string | null;
  status: 'active' | 'inactive';
  start_date: string | null;
  end_date: string | null;
  student_count?: number;
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
}

export default function PlanosScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? '';
  const lightText = ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(primaryColor);

  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // New plan modal
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fName, setFName] = useState('');
  const [fGoal, setFGoal] = useState('');
  const [fDescription, setFDescription] = useState('');

  const load = useCallback(async () => {
    if (!tenantId) return;
    const { data: plansData } = await supabase.from('workout_plans')
      .select('id, name, goal, status, start_date, end_date')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });

    if (!plansData) { setPlans([]); return; }

    const planIds = plansData.map(p => p.id);
    const { data: assignments } = await supabase.from('student_plan_assignments')
      .select('plan_id')
      .in('plan_id', planIds);

    const countMap: Record<string, number> = {};
    (assignments ?? []).forEach((a: any) => {
      countMap[a.plan_id] = (countMap[a.plan_id] ?? 0) + 1;
    });

    setPlans(plansData.map(p => ({ ...p, student_count: countMap[p.id] ?? 0 })));
  }, [tenantId]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const filtered = filter === 'all' ? plans : plans.filter(p => p.status === filter);

  async function handleCreate() {
    if (!fName.trim()) { Alert.alert('Atenção', 'Informe o nome do plano.'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('workout_plans').insert({
        name: fName.trim(),
        goal: fGoal || null,
        description: fDescription.trim() || null,
        tenant_id: tenantId,
        status: 'inactive',
      }).select('id').single();
      if (error) throw error;
      setModalVisible(false);
      resetForm();
      await load();
      router.push(`/(admin)/planos/${data.id}` as any);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setFName(''); setFGoal(''); setFDescription('');
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Planos de Treino</Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: primaryColor }]}
          onPress={() => setModalVisible(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color={lightText ? '#000' : '#fff'} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={s.filters}>
        {(['all', 'active', 'inactive'] as const).map(f => (
          <TouchableOpacity key={f}
            style={[s.chip, filter === f && { backgroundColor: primaryColor, borderColor: primaryColor }]}
            onPress={() => setFilter(f)} activeOpacity={0.75}>
            <Text style={[s.chipText, filter === f && { color: lightText ? '#000' : '#fff' }]}>
              {f === 'all' ? `Todos (${plans.length})` : f === 'active' ? `Ativos (${plans.filter(p=>p.status==='active').length})` : `Inativos (${plans.filter(p=>p.status==='inactive').length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator color={primaryColor} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={filtered}
          keyExtractor={p => p.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="document-text-outline" size={52} color={Colors.border} />
              <Text style={s.emptyTitle}>Nenhum plano</Text>
              <Text style={s.emptyText}>Crie um plano de treino e atribua a seus alunos.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const gc = item.goal ? (GOAL_COLORS[item.goal] ?? Colors.textSecondary) : Colors.textSecondary;
            return (
              <TouchableOpacity style={s.card}
                onPress={() => router.push(`/(admin)/planos/${item.id}` as any)} activeOpacity={0.75}>
                <View style={s.cardRow}>
                  <Text style={s.planName} numberOfLines={1}>{item.name}</Text>
                  <View style={[s.statusDot, { backgroundColor: item.status === 'active' ? Colors.success : Colors.border }]} />
                </View>
                <View style={s.cardMeta}>
                  {item.goal && (
                    <View style={[s.badge, { backgroundColor: `${gc}18`, borderColor: `${gc}40` }]}>
                      <Text style={[s.badgeText, { color: gc }]}>{item.goal}</Text>
                    </View>
                  )}
                  <View style={s.badge}>
                    <Ionicons name="people-outline" size={11} color={Colors.textSecondary} />
                    <Text style={s.badgeText}>{item.student_count} aluno{item.student_count !== 1 ? 's' : ''}</Text>
                  </View>
                  {item.start_date && (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>{fmtDate(item.start_date)}</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} style={s.chevron} />
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* New plan modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => !saving && setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
              <TouchableOpacity onPress={() => !saving && setModalVisible(false)} style={s.iconBtn}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={s.title}>Novo Plano</Text>
              <View style={{ width: 38 }} />
            </View>
            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>NOME DO PLANO</Text>
              <TextInput value={fName} onChangeText={setFName} style={s.input}
                placeholder="Ex: Plano Hipertrofia A" placeholderTextColor={Colors.textSecondary} />

              <Text style={[s.label, { marginTop: 18 }]}>OBJETIVO</Text>
              <View style={s.goalGrid}>
                {PLAN_GOALS.map(g => {
                  const gc = GOAL_COLORS[g];
                  return (
                    <TouchableOpacity key={g}
                      style={[s.goalBtn, fGoal === g && { borderColor: gc, backgroundColor: `${gc}15` }]}
                      onPress={() => setFGoal(g === fGoal ? '' : g)} activeOpacity={0.75}>
                      <Text style={[s.goalBtnText, fGoal === g && { color: gc }]}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[s.label, { marginTop: 18 }]}>DESCRIÇÃO / OBSERVAÇÕES</Text>
              <TextInput value={fDescription} onChangeText={setFDescription} style={[s.input, s.textArea]}
                multiline placeholder="Frequência semanal, restrições, observações..." placeholderTextColor={Colors.textSecondary} />

              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
                onPress={handleCreate} disabled={saving} activeOpacity={0.85}>
                {saving
                  ? <ActivityIndicator color={lightText ? '#000' : '#fff'} />
                  : <Text style={[s.saveBtnText, { color: lightText ? '#000' : '#fff' }]}>Criar Plano</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
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
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: Colors.textSecondary },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    padding: 16, position: 'relative',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  planName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: Colors.border, borderWidth: 1, borderColor: 'transparent' },
  badgeText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  chevron: { position: 'absolute', right: 16, top: '50%' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  modalContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  label: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  textArea: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  goalBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: Colors.textSecondary },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md },
});
