import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const MEAL_TYPES = [
  { value: 'cafe_da_manha', label: 'Café da Manhã' },
  { value: 'lanche_manha',  label: 'Lanche da Manhã' },
  { value: 'almoco',        label: 'Almoço' },
  { value: 'lanche_tarde',  label: 'Lanche da Tarde' },
  { value: 'jantar',        label: 'Jantar' },
  { value: 'ceia',          label: 'Ceia' },
  { value: 'pre_treino',    label: 'Pré-Treino' },
  { value: 'pos_treino',    label: 'Pós-Treino' },
  { value: 'outro',         label: 'Outro' },
];
const GOALS = ['Emagrecimento', 'Hipertrofia', 'Manutenção', 'Saúde Geral', 'Performance', 'Vegetariano'];

type FoodItem = {
  id: string; name: string; category: string;
  portion_grams: number; calories: number;
  protein_g: number; carbs_g: number; fat_g: number; fiber_g: number;
};
type DraftFood = { localId: string; dbId?: string; foodItem: FoodItem; quantity: number };
type Meal = {
  id: string; name: string; meal_type: string; suggested_time: string | null;
  sort_order: number; notes: string | null;
  meal_plan_foods: { id: string; quantity: number; sort_order: number; food_items: FoodItem | null }[];
};
type Plan = {
  id: string; name: string; goal: string | null; description: string | null;
  daily_calories: number | null; status: string;
};

function calcMacros(foods: DraftFood[]) {
  return foods.reduce((acc, df) => {
    const f = df.foodItem;
    const factor = df.quantity / f.portion_grams;
    return {
      calories: acc.calories + f.calories * factor,
      protein:  acc.protein  + f.protein_g * factor,
      carbs:    acc.carbs    + f.carbs_g * factor,
      fat:      acc.fat      + f.fat_g * factor,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function fmtMacro(v: number) { return v.toFixed(1); }

export default function PlanoAlimentarDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? '';

  const [plan, setPlan]         = useState<Plan | null>(null);
  const [meals, setMeals]       = useState<Meal[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [students, setStudents] = useState<{ id: string; full_name: string }[]>([]);
  const [assignments, setAssignments] = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  // Draft state: mealId → DraftFood[]
  const [draftMap, setDraftMap] = useState<Record<string, DraftFood[]>>({});
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({});
  const [savingMeal, setSavingMeal] = useState<string | null>(null);

  // Add meal modal
  const [showMealModal, setShowMealModal] = useState(false);
  const [fMealName, setFMealName]     = useState('');
  const [fMealType, setFMealType]     = useState('cafe_da_manha');
  const [fMealTime, setFMealTime]     = useState('');
  const [fMealNotes, setFMealNotes]   = useState('');

  // Food search for a meal
  const [searchMealId, setSearchMealId] = useState<string | null>(null);
  const [foodQuery, setFoodQuery]     = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [foodQty, setFoodQty]         = useState('100');

  // Plan edit modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [fPlanName, setFPlanName]     = useState('');
  const [fPlanGoal, setFPlanGoal]     = useState('');
  const [fPlanCalories, setFPlanCalories] = useState('');
  const [fPlanDesc, setFPlanDesc]     = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: planData }, { data: mealsData }, { data: foodsData }, { data: studentsData }, { data: assignData }] = await Promise.all([
      supabase.from('meal_plans').select('id, name, goal, description, daily_calories, status').eq('id', id).single(),
      supabase.from('meal_plan_meals').select('id, name, meal_type, suggested_time, sort_order, notes, meal_plan_foods(id, quantity, sort_order, food_items(id, name, category, portion_grams, calories, protein_g, carbs_g, fat_g, fiber_g))').eq('meal_plan_id', id).order('sort_order'),
      supabase.from('food_items').select('id, name, category, portion_grams, calories, protein_g, carbs_g, fat_g, fiber_g').order('name'),
      supabase.from('students').select('id, full_name').eq('tenant_id', tenantId).eq('status', 'active'),
      supabase.from('student_meal_plan_assignments').select('student_id').eq('meal_plan_id', id).eq('status', 'active'),
    ]);

    setPlan(planData as Plan ?? null);

    const sortedMeals = ((mealsData ?? []) as unknown as Meal[]).map(m => ({
      ...m,
      meal_plan_foods: (m.meal_plan_foods ?? []).sort((a, b) => a.sort_order - b.sort_order),
    }));
    setMeals(sortedMeals);

    // Init draft from server data
    const initialDraft: Record<string, DraftFood[]> = {};
    const initialExpanded: Record<string, boolean> = {};
    sortedMeals.forEach(m => {
      initialDraft[m.id] = m.meal_plan_foods
        .filter(f => f.food_items)
        .map(f => ({ localId: f.id, dbId: f.id, foodItem: f.food_items!, quantity: f.quantity }));
      initialExpanded[m.id] = true;
    });
    setDraftMap(initialDraft);
    setExpandedMeals(initialExpanded);

    setFoodItems((foodsData ?? []) as FoodItem[]);
    setStudents((studentsData ?? []) as any);
    setAssignments(((assignData ?? []) as any[]).map(a => a.student_id));
    setLoading(false);
  }, [id, tenantId]);

  useEffect(() => { load(); }, [load]);

  function isDirty(mealId: string, meal: Meal): boolean {
    const draft = draftMap[mealId] ?? [];
    const saved = meal.meal_plan_foods.filter(f => f.food_items);
    if (draft.length !== saved.length) return true;
    return draft.some((d, i) => {
      const s = saved[i];
      return !s || d.quantity !== s.quantity || d.foodItem.id !== s.food_items?.id;
    });
  }

  function addFoodToDraft(mealId: string, foodItem: FoodItem, quantity: number) {
    setDraftMap(prev => ({
      ...prev,
      [mealId]: [...(prev[mealId] ?? []), { localId: Date.now().toString(), foodItem, quantity }],
    }));
  }

  function updateDraftQty(mealId: string, localId: string, qty: number) {
    setDraftMap(prev => ({
      ...prev,
      [mealId]: (prev[mealId] ?? []).map(d => d.localId === localId ? { ...d, quantity: qty } : d),
    }));
  }

  function removeDraftFood(mealId: string, localId: string) {
    setDraftMap(prev => ({
      ...prev,
      [mealId]: (prev[mealId] ?? []).filter(d => d.localId !== localId),
    }));
  }

  async function saveMealFoods(meal: Meal) {
    const draft = draftMap[meal.id] ?? [];
    setSavingMeal(meal.id);

    // 1. Delete existing
    await supabase.from('meal_plan_foods').delete().eq('meal_id', meal.id);

    if (draft.length > 0) {
      // 2. Fetch latest nutrition data
      const foodIds = [...new Set(draft.map(d => d.foodItem.id))];
      const { data: freshFoods } = await supabase.from('food_items')
        .select('id, calories, protein_g, carbs_g, fat_g, fiber_g, portion_grams')
        .in('id', foodIds);
      const foodMap: Record<string, any> = {};
      (freshFoods ?? []).forEach((f: any) => { foodMap[f.id] = f; });

      // 3. Insert with pre-calculated macros
      const rows = draft.map((d, i) => {
        const fi = foodMap[d.foodItem.id];
        const factor = fi ? d.quantity / fi.portion_grams : 0;
        return {
          meal_id: meal.id, tenant_id: tenantId,
          food_item_id: d.foodItem.id, quantity: d.quantity, sort_order: i,
          calories:  fi ? fi.calories  * factor : 0,
          protein_g: fi ? fi.protein_g * factor : 0,
          carbs_g:   fi ? fi.carbs_g   * factor : 0,
          fat_g:     fi ? fi.fat_g     * factor : 0,
          fiber_g:   fi ? fi.fiber_g   * factor : 0,
        };
      });
      await supabase.from('meal_plan_foods').insert(rows);
    }
    setSavingMeal(null);
    load();
  }

  async function handleAddMeal() {
    if (!fMealName.trim()) return Alert.alert('Atenção', 'Informe o nome da refeição.');
    const { data: allMeals } = await supabase.from('meal_plan_meals').select('id').eq('meal_plan_id', id);
    await supabase.from('meal_plan_meals').insert({
      meal_plan_id: id, tenant_id: tenantId,
      name: fMealName.trim(), meal_type: fMealType,
      suggested_time: fMealTime || null,
      sort_order: (allMeals?.length ?? 0),
      notes: fMealNotes || null,
    });
    setShowMealModal(false);
    load();
  }

  async function handleDeleteMeal(mealId: string) {
    Alert.alert('Excluir refeição', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        await supabase.from('meal_plan_meals').delete().eq('id', mealId);
        load();
      }},
    ]);
  }

  async function togglePublish() {
    if (!plan) return;
    const anyDirty = meals.some(m => isDirty(m.id, m));
    if (anyDirty && plan.status !== 'active') {
      return Alert.alert('Atenção', 'Salve todas as refeições antes de publicar.');
    }
    const newStatus = plan.status === 'active' ? 'inactive' : 'active';
    await supabase.from('meal_plans').update({ status: newStatus }).eq('id', id);
    load();
  }

  async function handleUpdatePlan() {
    await supabase.from('meal_plans').update({
      name: fPlanName || plan?.name,
      goal: fPlanGoal || null,
      daily_calories: fPlanCalories ? parseInt(fPlanCalories) : null,
      description: fPlanDesc || null,
    }).eq('id', id as string);
    setShowPlanModal(false);
    load();
  }

  async function toggleAssignment(studentId: string) {
    if (assignments.includes(studentId)) {
      await supabase.from('student_meal_plan_assignments').delete().eq('meal_plan_id', id).eq('student_id', studentId);
      setAssignments(prev => prev.filter(s => s !== studentId));
    } else {
      await supabase.from('student_meal_plan_assignments').upsert({
        meal_plan_id: id, student_id: studentId, tenant_id: tenantId, status: 'active',
      }, { onConflict: 'meal_plan_id,student_id' });
      setAssignments(prev => [...prev, studentId]);
    }
  }

  const filteredFoods = foodItems
    .filter(f => f.name.toLowerCase().includes(foodQuery.toLowerCase()) || f.category.toLowerCase().includes(foodQuery.toLowerCase()))
    .slice(0, 30);

  const totalMacros = meals.reduce((acc, m) => {
    const d = draftMap[m.id] ?? [];
    const mMacros = calcMacros(d);
    return { calories: acc.calories + mMacros.calories, protein: acc.protein + mMacros.protein, carbs: acc.carbs + mMacros.carbs, fat: acc.fat + mMacros.fat };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.title}>Plano Alimentar</Text>
          <View style={{ width: 40 }} />
        </View>
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{plan?.name ?? 'Plano'}</Text>
        <TouchableOpacity onPress={() => { setFPlanName(plan?.name ?? ''); setFPlanGoal(plan?.goal ?? ''); setFPlanCalories(plan?.daily_calories ? String(plan.daily_calories) : ''); setFPlanDesc(plan?.description ?? ''); setShowPlanModal(true); }} style={s.iconBtn}>
          <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Plan info card */}
        <View style={s.planCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {plan?.goal && (
              <View style={s.goalBadge}>
                <Text style={[s.goalText, { color: primaryColor }]}>{plan.goal}</Text>
              </View>
            )}
            <View style={[s.statusBadge, { backgroundColor: plan?.status === 'active' ? '#10B98118' : '#94A3B818' }]}>
              <View style={[s.statusDot, { backgroundColor: plan?.status === 'active' ? '#10B981' : '#94A3B8' }]} />
              <Text style={[s.statusText, { color: plan?.status === 'active' ? '#10B981' : '#94A3B8' }]}>
                {plan?.status === 'active' ? 'Publicado' : 'Rascunho'}
              </Text>
            </View>
            {plan?.daily_calories && (
              <Text style={s.caloriesInfo}>🔥 Meta: {plan.daily_calories} kcal/dia</Text>
            )}
          </View>
          {plan?.description && <Text style={s.planDesc}>{plan.description}</Text>}

          {/* Day totals */}
          <View style={s.macroRow}>
            {[
              { label: 'Kcal', value: fmtMacro(totalMacros.calories), color: '#F59E0B' },
              { label: 'Prot', value: `${fmtMacro(totalMacros.protein)}g`, color: '#3B82F6' },
              { label: 'Carbs', value: `${fmtMacro(totalMacros.carbs)}g`, color: '#F59E0B' },
              { label: 'Gord', value: `${fmtMacro(totalMacros.fat)}g`, color: '#EF4444' },
            ].map(m => (
              <View key={m.label} style={s.macroChip}>
                <Text style={[s.macroValue, { color: m.color }]}>{m.value}</Text>
                <Text style={s.macroLabel}>{m.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[s.publishBtn, { backgroundColor: plan?.status === 'active' ? '#94A3B820' : primaryColor }]}
            onPress={togglePublish}
          >
            <Ionicons name={plan?.status === 'active' ? 'arrow-undo-outline' : 'checkmark-circle-outline'} size={16} color={plan?.status === 'active' ? '#94A3B8' : '#000'} />
            <Text style={[s.publishBtnText, { color: plan?.status === 'active' ? '#94A3B8' : '#000' }]}>
              {plan?.status === 'active' ? 'Despublicar' : 'Publicar Plano'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Meals */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>REFEIÇÕES</Text>
          <TouchableOpacity onPress={() => { setFMealName(''); setFMealType('cafe_da_manha'); setFMealTime(''); setFMealNotes(''); setShowMealModal(true); }} style={s.addMealBtn}>
            <Ionicons name="add" size={16} color={primaryColor} />
            <Text style={[s.addMealText, { color: primaryColor }]}>Adicionar</Text>
          </TouchableOpacity>
        </View>

        {meals.length === 0 ? (
          <View style={s.emptyMeals}>
            <Text style={s.emptyMealsText}>Nenhuma refeição ainda. Adicione a primeira refeição.</Text>
          </View>
        ) : (
          meals.map(meal => {
            const draft = draftMap[meal.id] ?? [];
            const dirty = isDirty(meal.id, meal);
            const macros = calcMacros(draft);
            const expanded = expandedMeals[meal.id] ?? true;
            const mealTypeLabel = MEAL_TYPES.find(t => t.value === meal.meal_type)?.label ?? meal.meal_type;

            return (
              <View key={meal.id} style={[s.mealCard, dirty && { borderColor: `${primaryColor}50` }]}>
                <TouchableOpacity
                  style={s.mealHeader}
                  onPress={() => setExpandedMeals(prev => ({ ...prev, [meal.id]: !prev[meal.id] }))}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={s.mealName}>{meal.name}</Text>
                      <Text style={s.mealType}>{mealTypeLabel}</Text>
                    </View>
                    <Text style={s.mealMeta}>
                      {meal.suggested_time ? `⏰ ${meal.suggested_time.slice(0,5)} · ` : ''}
                      {fmtMacro(macros.calories)} kcal
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {dirty && (
                      <TouchableOpacity
                        style={[s.saveBtn, { backgroundColor: `${primaryColor}20`, borderColor: primaryColor }]}
                        onPress={() => saveMealFoods(meal)}
                        disabled={savingMeal === meal.id}
                      >
                        {savingMeal === meal.id ? (
                          <ActivityIndicator size="small" color={primaryColor} />
                        ) : (
                          <>
                            <Ionicons name="save-outline" size={13} color={primaryColor} />
                            <Text style={[s.saveBtnText, { color: primaryColor }]}>Salvar</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleDeleteMeal(meal.id)}>
                      <Ionicons name="trash-outline" size={16} color={Colors.error} />
                    </TouchableOpacity>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
                  </View>
                </TouchableOpacity>

                {expanded && (
                  <View style={s.mealBody}>
                    {draft.map(df => (
                      <View key={df.localId} style={s.foodRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.foodName} numberOfLines={1}>{df.foodItem.name}</Text>
                          <Text style={s.foodMacros}>
                            {fmtMacro(df.foodItem.calories * df.quantity / df.foodItem.portion_grams)} kcal ·
                            P: {fmtMacro(df.foodItem.protein_g * df.quantity / df.foodItem.portion_grams)}g ·
                            C: {fmtMacro(df.foodItem.carbs_g * df.quantity / df.foodItem.portion_grams)}g
                          </Text>
                        </View>
                        <TextInput
                          style={s.qtyInput}
                          value={String(df.quantity)}
                          onChangeText={v => { const n = parseFloat(v); if (!isNaN(n) && n > 0) updateDraftQty(meal.id, df.localId, n); }}
                          keyboardType="decimal-pad"
                        />
                        <Text style={s.qtyLabel}>g</Text>
                        <TouchableOpacity onPress={() => removeDraftFood(meal.id, df.localId)} style={{ padding: 4 }}>
                          <Ionicons name="close-circle" size={18} color={Colors.border} />
                        </TouchableOpacity>
                      </View>
                    ))}

                    {/* Macros summary */}
                    {draft.length > 0 && (
                      <View style={s.mealMacroRow}>
                        {[
                          { label: 'Kcal', value: fmtMacro(macros.calories) },
                          { label: 'Prot', value: `${fmtMacro(macros.protein)}g` },
                          { label: 'Carbs', value: `${fmtMacro(macros.carbs)}g` },
                          { label: 'Gord', value: `${fmtMacro(macros.fat)}g` },
                        ].map(m => (
                          <View key={m.label} style={s.mealMacroChip}>
                            <Text style={s.mealMacroVal}>{m.value}</Text>
                            <Text style={s.mealMacroLabel}>{m.label}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <TouchableOpacity
                      style={[s.addFoodBtn, { borderColor: `${primaryColor}60` }]}
                      onPress={() => { setSearchMealId(meal.id); setFoodQuery(''); setSelectedFood(null); setFoodQty('100'); }}
                    >
                      <Ionicons name="add-circle-outline" size={16} color={primaryColor} />
                      <Text style={[s.addFoodText, { color: primaryColor }]}>Adicionar alimento</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Assign students */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>ALUNOS ATRIBUÍDOS</Text>
        </View>
        <View style={s.assignCard}>
          {students.length === 0 ? (
            <Text style={s.noStudents}>Nenhum aluno ativo no sistema.</Text>
          ) : (
            students.map(st => {
              const assigned = assignments.includes(st.id);
              return (
                <TouchableOpacity
                  key={st.id}
                  style={[s.studentRow, assigned && { backgroundColor: `${primaryColor}10` }]}
                  onPress={() => toggleAssignment(st.id)}
                  activeOpacity={0.7}
                >
                  <View style={[s.checkbox, assigned && { backgroundColor: primaryColor, borderColor: primaryColor }]}>
                    {assigned && <Ionicons name="checkmark" size={12} color="#000" />}
                  </View>
                  <Text style={s.studentName}>{st.full_name}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
        <View style={{ height: 48 }} />
      </ScrollView>

      {/* Add Meal Modal */}
      <Modal visible={showMealModal} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={s.modal} edges={['top', 'bottom']}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowMealModal(false)}>
              <Text style={[s.modalAction, { color: Colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Nova Refeição</Text>
            <TouchableOpacity onPress={handleAddMeal}>
              <Text style={[s.modalAction, { color: primaryColor }]}>Adicionar</Text>
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView style={{ paddingHorizontal: 16 }}>
              <Text style={s.fieldLabel}>Nome *</Text>
              <TextInput style={s.input} value={fMealName} onChangeText={setFMealName} placeholder="Ex.: Café da Manhã Reforçado" placeholderTextColor={Colors.textSecondary} />
              <Text style={s.fieldLabel}>Tipo</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {MEAL_TYPES.map(t => (
                    <TouchableOpacity key={t.value} style={[s.chip, fMealType === t.value && { borderColor: primaryColor, backgroundColor: `${primaryColor}20` }]} onPress={() => setFMealType(t.value)}>
                      <Text style={[s.chipText, fMealType === t.value && { color: primaryColor }]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={s.fieldLabel}>Horário sugerido (HH:MM)</Text>
              <TextInput style={s.input} value={fMealTime} onChangeText={setFMealTime} placeholder="08:00" placeholderTextColor={Colors.textSecondary} keyboardType="numbers-and-punctuation" />
              <Text style={s.fieldLabel}>Observações</Text>
              <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]} value={fMealNotes} onChangeText={setFMealNotes} placeholder="Notas desta refeição..." placeholderTextColor={Colors.textSecondary} multiline />
              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Food Search Modal */}
      <Modal visible={!!searchMealId} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modal} edges={['top', 'bottom']}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => { setSearchMealId(null); setSelectedFood(null); }}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Buscar Alimento</Text>
            {selectedFood && (
              <TouchableOpacity onPress={() => {
                const qty = parseFloat(foodQty) || 100;
                addFoodToDraft(searchMealId!, selectedFood, qty);
                setSearchMealId(null); setSelectedFood(null);
              }}>
                <Text style={[s.modalAction, { color: primaryColor }]}>Adicionar</Text>
              </TouchableOpacity>
            )}
            {!selectedFood && <View style={{ width: 60 }} />}
          </View>

          {selectedFood ? (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <ScrollView style={{ padding: 20 }}>
                <Text style={[s.foodName, { fontSize: FontSize.md, marginBottom: 4 }]}>{selectedFood.name}</Text>
                <Text style={[s.foodMacros, { marginBottom: 20 }]}>
                  Por {selectedFood.portion_grams}g: {fmtMacro(selectedFood.calories)} kcal · P: {fmtMacro(selectedFood.protein_g)}g · C: {fmtMacro(selectedFood.carbs_g)}g · G: {fmtMacro(selectedFood.fat_g)}g
                </Text>
                <Text style={s.fieldLabel}>Quantidade (gramas)</Text>
                <TextInput
                  style={[s.input, { fontSize: 20, textAlign: 'center', fontFamily: FontFamily.bodyBold }]}
                  value={foodQty} onChangeText={setFoodQty}
                  keyboardType="decimal-pad" autoFocus
                />
                {/* Preview macros */}
                {parseFloat(foodQty) > 0 && (() => {
                  const qty = parseFloat(foodQty);
                  const f = selectedFood;
                  const factor = qty / f.portion_grams;
                  return (
                    <View style={s.previewRow}>
                      {[
                        { label: 'Kcal', value: fmtMacro(f.calories * factor) },
                        { label: 'Prot', value: `${fmtMacro(f.protein_g * factor)}g` },
                        { label: 'Carbs', value: `${fmtMacro(f.carbs_g * factor)}g` },
                        { label: 'Gord', value: `${fmtMacro(f.fat_g * factor)}g` },
                      ].map(m => (
                        <View key={m.label} style={s.previewChip}>
                          <Text style={[s.macroValue, { fontSize: FontSize.sm }]}>{m.value}</Text>
                          <Text style={s.macroLabel}>{m.label}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}
                <TouchableOpacity style={s.backFoodBtn} onPress={() => setSelectedFood(null)}>
                  <Ionicons name="arrow-back" size={16} color={Colors.textSecondary} />
                  <Text style={s.backFoodText}>Voltar à busca</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : (
            <>
              <View style={s.searchBox}>
                <Ionicons name="search" size={16} color={Colors.textSecondary} />
                <TextInput
                  style={s.searchInput}
                  value={foodQuery} onChangeText={setFoodQuery}
                  placeholder="Buscar por nome ou categoria..."
                  placeholderTextColor={Colors.textSecondary}
                  autoFocus
                />
                {foodQuery ? (
                  <TouchableOpacity onPress={() => setFoodQuery('')}>
                    <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <FlatList
                data={filteredFoods}
                keyExtractor={f => f.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <Text style={[s.emptyMealsText, { textAlign: 'center', paddingTop: 40 }]}>
                    {foodQuery ? 'Nenhum alimento encontrado.' : 'Digite para buscar alimentos.'}
                  </Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity style={s.foodSearchRow} onPress={() => { setSelectedFood(item); setFoodQty('100'); }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.foodName}>{item.name}</Text>
                      <Text style={s.foodMacros}>
                        {fmtMacro(item.calories)} kcal/100g · P: {fmtMacro(item.protein_g)}g · C: {fmtMacro(item.carbs_g)}g
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                )}
              />
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* Plan Edit Modal */}
      <Modal visible={showPlanModal} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={s.modal} edges={['top', 'bottom']}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowPlanModal(false)}>
              <Text style={[s.modalAction, { color: Colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Editar Plano</Text>
            <TouchableOpacity onPress={handleUpdatePlan}>
              <Text style={[s.modalAction, { color: primaryColor }]}>Salvar</Text>
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView style={{ paddingHorizontal: 16 }}>
              <Text style={s.fieldLabel}>Nome</Text>
              <TextInput style={s.input} value={fPlanName} onChangeText={setFPlanName} placeholderTextColor={Colors.textSecondary} />
              <Text style={s.fieldLabel}>Objetivo</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {GOALS.map(g => (
                    <TouchableOpacity key={g} style={[s.chip, fPlanGoal === g && { borderColor: primaryColor, backgroundColor: `${primaryColor}20` }]} onPress={() => setFPlanGoal(g)}>
                      <Text style={[s.chipText, fPlanGoal === g && { color: primaryColor }]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={s.fieldLabel}>Meta calórica (kcal/dia)</Text>
              <TextInput style={s.input} value={fPlanCalories} onChangeText={setFPlanCalories} keyboardType="number-pad" placeholderTextColor={Colors.textSecondary} />
              <Text style={s.fieldLabel}>Observações</Text>
              <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} value={fPlanDesc} onChangeText={setFPlanDesc} multiline placeholderTextColor={Colors.textSecondary} />
              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, textAlign: 'center' },
  planCard: { margin: 16, backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12 },
  goalBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  goalText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  caloriesInfo: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },
  planDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  macroRow: { flexDirection: 'row', gap: 8 },
  macroChip: { flex: 1, backgroundColor: Colors.bg, borderRadius: 10, padding: 8, alignItems: 'center', gap: 2 },
  macroValue: { fontFamily: FontFamily.bodyBold, fontSize: 14 },
  macroLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
  publishBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12 },
  publishBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  sectionTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 0.8 },
  addMealBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addMealText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },
  emptyMeals: { paddingHorizontal: 16, paddingVertical: 20, alignItems: 'center' },
  emptyMealsText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
  mealCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  mealHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  mealName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  mealType: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  mealMeta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  saveBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  mealBody: { borderTopWidth: 1, borderTopColor: Colors.border, padding: 12, gap: 8 },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  foodName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  foodMacros: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  qtyInput: { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary, width: 56, textAlign: 'center' },
  qtyLabel: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },
  mealMacroRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  mealMacroChip: { flex: 1, backgroundColor: Colors.bg, borderRadius: 8, padding: 6, alignItems: 'center' },
  mealMacroVal: { fontFamily: FontFamily.bodyBold, fontSize: 12, color: Colors.textPrimary },
  mealMacroLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
  addFoodBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingVertical: 8, marginTop: 4, borderStyle: 'dashed' },
  addFoodText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },
  assignCard: { marginHorizontal: 16, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 8 },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  studentName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  noStudents: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, padding: 16, textAlign: 'center' },
  // Modal
  modal: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  modalAction: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
  fieldLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  foodSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  previewRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  previewChip: { flex: 1, backgroundColor: Colors.surface, borderRadius: 10, padding: 10, alignItems: 'center', gap: 2 },
  backFoodBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 24 },
  backFoodText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
});
