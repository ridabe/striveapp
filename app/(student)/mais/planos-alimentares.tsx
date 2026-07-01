import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { ModuleGuard } from '@/components/ModuleGuard';
import { MODULE } from '@/lib/modules';
import { StudentHeader } from '@/components/StudentHeader';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const MEAL_TYPE_LABEL: Record<string, string> = {
  cafe_da_manha: '☀️ Café da Manhã',
  lanche_manha:  '🍌 Lanche da Manhã',
  almoco:        '🍽️ Almoço',
  lanche_tarde:  '🥪 Lanche da Tarde',
  jantar:        '🌙 Jantar',
  ceia:          '🌛 Ceia',
  pre_treino:    '⚡ Pré-Treino',
  pos_treino:    '💪 Pós-Treino',
  outro:         '🍴 Outro',
};

const GOAL_COLORS: Record<string, string> = {
  Emagrecimento: '#3B82F6', Hipertrofia: '#EF4444', Manutenção: '#10B981',
  'Saúde Geral': '#8B5CF6', Performance: '#F59E0B', Vegetariano: '#4ADE80',
};

type FoodItem = { id: string; name: string; portion_grams: number; calories: number; protein_g: number; carbs_g: number; fat_g: number };
type MealFood = { id: string; quantity: number; food_items: FoodItem | null };
type Meal = { id: string; name: string; meal_type: string; suggested_time: string | null; meal_plan_foods: MealFood[] };
type Plan = { id: string; name: string; goal: string | null; daily_calories: number | null; description: string | null; meal_plan_meals: Meal[] };

function calcMealMacros(foods: MealFood[]) {
  return foods.reduce((acc, f) => {
    const fi = f.food_items;
    if (!fi) return acc;
    const factor = f.quantity / fi.portion_grams;
    return {
      calories: acc.calories + fi.calories  * factor,
      protein:  acc.protein  + fi.protein_g * factor,
      carbs:    acc.carbs    + fi.carbs_g   * factor,
      fat:      acc.fat      + fi.fat_g     * factor,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function fmt1(v: number) { return v.toFixed(1); }

export default function StudentPlanosAlimentaresScreen() {
  const { selectedStudent }      = useStudent();
  const { primaryColor } = useThemeStore();

  const [plans, setPlans]   = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({});
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!selectedStudent) return;
    setLoading(true);
    const { data } = await supabase
      .from('student_meal_plan_assignments')
      .select(`
        meal_plans(
          id, name, goal, status, daily_calories, description,
          meal_plan_meals(
            id, name, meal_type, suggested_time, sort_order,
            meal_plan_foods(
              id, quantity, sort_order,
              food_items(id, name, portion_grams, calories, protein_g, carbs_g, fat_g)
            )
          )
        )
      `)
      .eq('student_id', selectedStudent.id)
      .eq('status', 'active');

    const loaded: Plan[] = ((data ?? []) as any[])
      .map((a: any) => a.meal_plans)
      .filter(Boolean)
      .filter((p: any) => p.status === 'active')
      .map((p: any) => ({
        ...p,
        meal_plan_meals: (p.meal_plan_meals ?? [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((m: any) => ({
            ...m,
            meal_plan_foods: (m.meal_plan_foods ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
          })),
      }));

    setPlans(loaded);
    // Default: expand first plan
    const expanded: Record<string, boolean> = {};
    loaded.forEach((p, i) => { expanded[p.id] = i === 0; });
    setExpandedPlans(expanded);
    setLoading(false);
  }, [selectedStudent?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StudentHeader title="Plano Alimentar" />

      <ModuleGuard slug={MODULE.PLANOS_ALIMENTARES}>
        {loading ? (
          <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
        ) : plans.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="restaurant-outline" size={52} color={Colors.border} />
            <Text style={s.emptyTitle}>Nenhum plano atribuído</Text>
            <Text style={s.emptyDesc}>Quando seu personal criar e atribuir um plano alimentar, ele aparecerá aqui.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
            {plans.map(plan => {
              const planExpanded = expandedPlans[plan.id] ?? false;
              const goalColor = GOAL_COLORS[plan.goal ?? ''] ?? Colors.textSecondary;

              // Total macros for day
              const totalMacros = plan.meal_plan_meals.reduce((acc, m) => {
                const mm = calcMealMacros(m.meal_plan_foods);
                return { calories: acc.calories + mm.calories, protein: acc.protein + mm.protein, carbs: acc.carbs + mm.carbs, fat: acc.fat + mm.fat };
              }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

              return (
                <View key={plan.id} style={s.planCard}>
                  {/* Plan header */}
                  <TouchableOpacity
                    style={s.planHeader}
                    onPress={() => setExpandedPlans(prev => ({ ...prev, [plan.id]: !prev[plan.id] }))}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.planName}>{plan.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                        {plan.goal && (
                          <View style={[s.goalBadge, { backgroundColor: `${goalColor}18`, borderColor: `${goalColor}40` }]}>
                            <Text style={[s.goalText, { color: goalColor }]}>{plan.goal}</Text>
                          </View>
                        )}
                        {plan.daily_calories && (
                          <Text style={s.caloriesMeta}>🔥 {plan.daily_calories} kcal/dia</Text>
                        )}
                      </View>
                    </View>
                    <Ionicons name={planExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>

                  {planExpanded && (
                    <View>
                      {plan.description && (
                        <Text style={s.planDesc}>{plan.description}</Text>
                      )}

                      {/* Daily total macros */}
                      <View style={s.totalMacroRow}>
                        {[
                          { label: 'Total Kcal', value: fmt1(totalMacros.calories), color: '#F59E0B' },
                          { label: 'Prot', value: `${fmt1(totalMacros.protein)}g`, color: '#3B82F6' },
                          { label: 'Carbs', value: `${fmt1(totalMacros.carbs)}g`, color: '#F59E0B' },
                          { label: 'Gordura', value: `${fmt1(totalMacros.fat)}g`, color: '#EF4444' },
                        ].map(m => (
                          <View key={m.label} style={s.totalMacroChip}>
                            <Text style={[s.totalMacroVal, { color: m.color }]}>{m.value}</Text>
                            <Text style={s.totalMacroLabel}>{m.label}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Progress bar if daily_calories is set */}
                      {plan.daily_calories && (
                        <View style={s.progressBarWrap}>
                          <View style={[s.progressBar, {
                            width: `${Math.min(100, (totalMacros.calories / plan.daily_calories) * 100)}%` as any,
                            backgroundColor: primaryColor,
                          }]} />
                          <Text style={s.progressLabel}>
                            {fmt1(totalMacros.calories)} / {plan.daily_calories} kcal
                          </Text>
                        </View>
                      )}

                      {/* Meals */}
                      {plan.meal_plan_meals.map(meal => {
                        const mealExpanded = expandedMeals[meal.id] ?? true;
                        const mealMacros   = calcMealMacros(meal.meal_plan_foods);
                        const typeLabel    = MEAL_TYPE_LABEL[meal.meal_type] ?? meal.name;

                        return (
                          <View key={meal.id} style={s.mealCard}>
                            <TouchableOpacity
                              style={s.mealHeader}
                              onPress={() => setExpandedMeals(prev => ({ ...prev, [meal.id]: !prev[meal.id] }))}
                              activeOpacity={0.7}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={s.mealType}>{typeLabel}</Text>
                                <Text style={s.mealName}>{meal.name}</Text>
                                <Text style={s.mealMeta}>
                                  {meal.suggested_time ? `${meal.suggested_time.slice(0,5)} · ` : ''}
                                  {fmt1(mealMacros.calories)} kcal
                                </Text>
                              </View>
                              <Ionicons name={mealExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
                            </TouchableOpacity>

                            {mealExpanded && (
                              <View style={s.mealBody}>
                                {meal.meal_plan_foods.length === 0 ? (
                                  <Text style={s.emptyFoodsText}>Nenhum alimento nesta refeição.</Text>
                                ) : (
                                  meal.meal_plan_foods.map(f => {
                                    const fi = f.food_items;
                                    if (!fi) return null;
                                    const factor = f.quantity / fi.portion_grams;
                                    return (
                                      <View key={f.id} style={s.foodRow}>
                                        <View style={{ flex: 1 }}>
                                          <Text style={s.foodName}>{fi.name}</Text>
                                          <Text style={s.foodMacros}>
                                            {fmt1(fi.calories * factor)} kcal · P: {fmt1(fi.protein_g * factor)}g · C: {fmt1(fi.carbs_g * factor)}g · G: {fmt1(fi.fat_g * factor)}g
                                          </Text>
                                        </View>
                                        <Text style={s.foodQty}>{f.quantity}g</Text>
                                      </View>
                                    );
                                  })
                                )}

                                {/* Meal total */}
                                {meal.meal_plan_foods.length > 0 && (
                                  <View style={s.mealTotalRow}>
                                    <Text style={s.mealTotalLabel}>Total da refeição</Text>
                                    <Text style={s.mealTotalVal}>
                                      {fmt1(mealMacros.calories)} kcal · P: {fmt1(mealMacros.protein)}g · C: {fmt1(mealMacros.carbs)}g · G: {fmt1(mealMacros.fat)}g
                                    </Text>
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </ModuleGuard>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  planCard: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 8 },
  planName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  goalBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  goalText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  caloriesMeta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  planDesc: { paddingHorizontal: 16, paddingBottom: 10, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  totalMacroRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingBottom: 12 },
  totalMacroChip: { flex: 1, backgroundColor: Colors.bg, borderRadius: 10, padding: 8, alignItems: 'center', gap: 2 },
  totalMacroVal: { fontFamily: FontFamily.bodyBold, fontSize: 13 },
  totalMacroLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
  progressBarWrap: { marginHorizontal: 12, marginBottom: 12, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', position: 'relative' },
  progressBar: { height: '100%', borderRadius: 3 },
  progressLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  mealCard: { borderTopWidth: 1, borderTopColor: Colors.border },
  mealHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 8 },
  mealType: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: Colors.textPrimary },
  mealName: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  mealMeta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  mealBody: { backgroundColor: Colors.bg, paddingHorizontal: 14, paddingBottom: 12, gap: 6 },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.border },
  foodName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  foodMacros: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  foodQty: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textSecondary },
  emptyFoodsText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', paddingVertical: 8 },
  mealTotalRow: { paddingTop: 8 },
  mealTotalLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  mealTotalVal: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textPrimary, marginTop: 2 },
});
