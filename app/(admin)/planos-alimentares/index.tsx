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
import { ModuleGuard } from '@/components/ModuleGuard';
import { MODULE } from '@/lib/modules';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const GOALS = ['Emagrecimento', 'Hipertrofia', 'Manutenção', 'Saúde Geral', 'Performance', 'Vegetariano'];
const GOAL_COLORS: Record<string, string> = {
  Emagrecimento: '#3B82F6', Hipertrofia: '#EF4444', Manutenção: '#10B981',
  'Saúde Geral': '#8B5CF6', Performance: '#F59E0B', Vegetariano: '#4ADE80',
};

type MealPlan = {
  id: string; name: string; goal: string | null; status: string;
  daily_calories: number | null; created_at: string;
  student_count?: number;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PlanosAlimentaresScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? '';

  const [plans, setPlans]     = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<'all' | 'active' | 'inactive'>('all');

  // New plan modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [fName, setFName]         = useState('');
  const [fGoal, setFGoal]         = useState('');
  const [fCalories, setFCalories] = useState('');
  const [fDescription, setFDescription] = useState('');

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('meal_plans')
      .select('id, name, goal, status, daily_calories, created_at, student_meal_plan_assignments(student_id)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    const mapped: MealPlan[] = (data ?? []).map((p: any) => ({
      id: p.id, name: p.name, goal: p.goal, status: p.status,
      daily_calories: p.daily_calories, created_at: p.created_at,
      student_count: (p.student_meal_plan_assignments ?? []).filter((a: any) => a).length,
    }));
    setPlans(mapped);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const filtered = plans.filter(p => filter === 'all' || p.status === filter);

  async function handleCreate() {
    if (!fName.trim()) return Alert.alert('Atenção', 'Informe o nome do plano.');
    setSaving(true);
    const { data, error } = await supabase.from('meal_plans').insert({
      tenant_id: tenantId,
      name: fName.trim(),
      goal: fGoal || null,
      daily_calories: fCalories ? parseInt(fCalories) : null,
      description: fDescription || null,
      status: 'inactive',
    }).select('id').single();
    setSaving(false);
    if (error || !data) return Alert.alert('Erro', 'Não foi possível criar o plano.');
    setShowModal(false);
    load();
    router.push(`/(admin)/planos-alimentares/${data.id}` as any);
  }

  async function handleDelete(id: string) {
    Alert.alert('Excluir plano', 'Tem certeza? Todos os dados do plano serão removidos.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        await supabase.from('meal_plans').delete().eq('id', id);
        load();
      }},
    ]);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Planos Alimentares</Text>
        <TouchableOpacity onPress={() => { setFName(''); setFGoal(''); setFCalories(''); setFDescription(''); setShowModal(true); }} style={[s.addBtn, { backgroundColor: primaryColor }]}>
          <Ionicons name="add" size={22} color="#000" />
        </TouchableOpacity>
      </View>

      <ModuleGuard slug={MODULE.PLANOS_ALIMENTARES}>
        {/* Filter tabs */}
        <View style={s.filterRow}>
          {(['all', 'active', 'inactive'] as const).map(f => (
            <TouchableOpacity key={f} style={[s.filterTab, filter === f && { backgroundColor: primaryColor }]} onPress={() => setFilter(f)}>
              <Text style={[s.filterText, filter === f && { color: '#000' }]}>
                {f === 'all' ? 'Todos' : f === 'active' ? 'Publicados' : 'Rascunhos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={p => p.id}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="restaurant-outline" size={48} color={Colors.border} />
                <Text style={s.emptyTitle}>Nenhum plano{filter !== 'all' ? ' neste filtro' : ''}</Text>
                <Text style={s.emptyDesc}>Crie um plano alimentar para seus alunos.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const goalColor = GOAL_COLORS[item.goal ?? ''] ?? Colors.textSecondary;
              return (
                <TouchableOpacity style={s.card} onPress={() => router.push(`/(admin)/planos-alimentares/${item.id}` as any)} activeOpacity={0.7}>
                  <View style={[s.statusDot, { backgroundColor: item.status === 'active' ? '#10B981' : '#94A3B8' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      {item.goal && (
                        <View style={[s.goalBadge, { backgroundColor: `${goalColor}20`, borderColor: `${goalColor}40` }]}>
                          <Text style={[s.goalText, { color: goalColor }]}>{item.goal}</Text>
                        </View>
                      )}
                      <View style={[s.goalBadge, { backgroundColor: item.status === 'active' ? '#10B98118' : '#94A3B818', borderColor: item.status === 'active' ? '#10B98140' : '#94A3B840' }]}>
                        <Text style={[s.goalText, { color: item.status === 'active' ? '#10B981' : '#94A3B8' }]}>
                          {item.status === 'active' ? 'Publicado' : 'Rascunho'}
                        </Text>
                      </View>
                      {item.daily_calories && (
                        <Text style={s.caloriesText}>🔥 {item.daily_calories} kcal/dia</Text>
                      )}
                    </View>
                    <Text style={s.cardMeta}>
                      {item.student_count} aluno{item.student_count !== 1 ? 's' : ''} · Criado em {fmtDate(item.created_at)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* New Plan Modal */}
        <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={s.modal} edges={['top', 'bottom']}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={s.modalTitle}>Novo Plano Alimentar</Text>
              <TouchableOpacity onPress={handleCreate} disabled={saving}>
                <Text style={[s.modalSave, { color: primaryColor }]}>{saving ? 'Criando...' : 'Criar'}</Text>
              </TouchableOpacity>
            </View>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <ScrollView style={{ paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
                <Text style={s.fieldLabel}>Nome do Plano *</Text>
                <TextInput style={s.input} value={fName} onChangeText={setFName} placeholder="Ex.: Dieta Low Carb - Cutting" placeholderTextColor={Colors.textSecondary} />

                <Text style={s.fieldLabel}>Objetivo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={[s.chip, !fGoal && { borderColor: primaryColor, backgroundColor: `${primaryColor}20` }]} onPress={() => setFGoal('')}>
                      <Text style={[s.chipText, !fGoal && { color: primaryColor }]}>Nenhum</Text>
                    </TouchableOpacity>
                    {GOALS.map(g => {
                      const c = GOAL_COLORS[g];
                      return (
                        <TouchableOpacity key={g} style={[s.chip, fGoal === g && { borderColor: c, backgroundColor: `${c}20` }]} onPress={() => setFGoal(g)}>
                          <Text style={[s.chipText, fGoal === g && { color: c }]}>{g}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                <Text style={s.fieldLabel}>Meta Calórica Diária (kcal)</Text>
                <TextInput style={s.input} value={fCalories} onChangeText={setFCalories} placeholder="Ex.: 2000" placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" />

                <Text style={s.fieldLabel}>Observações / Restrições</Text>
                <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} value={fDescription} onChangeText={setFDescription} placeholder="Alergias, restrições alimentares..." placeholderTextColor={Colors.textSecondary} multiline />
                <View style={{ height: 40 }} />
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      </ModuleGuard>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  addBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: Colors.textSecondary },
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginTop: 4 },
  cardName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  goalBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  goalText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  caloriesText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  cardMeta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 5 },
  deleteBtn: { padding: 8 },
  empty: { alignItems: 'center', paddingTop: 64, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  modal: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  modalSave: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
  fieldLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
});
