import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
  Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

interface WorkoutFeedback {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  workout_plan_id: string | null;
  workout_plans: { name: string } | null;
}

interface WorkoutPlan {
  id: string;
  name: string;
}

const LABELS = ['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente'];
const LABEL_COLORS = ['', '#EF4444', '#F97316', '#F59E0B', '#4ADE80', '#22C55E'];

function StarRow({
  rating,
  size = 20,
  interactive = false,
  onRate,
}: {
  rating: number;
  size?: number;
  interactive?: boolean;
  onRate?: (n: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || rating;

  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity
          key={n}
          onPress={interactive ? () => { setHovered(0); onRate?.(n); } : undefined}
          onPressIn={interactive ? () => setHovered(n) : undefined}
          onPressOut={interactive ? () => setHovered(0) : undefined}
          activeOpacity={interactive ? 0.7 : 1}
          disabled={!interactive}
        >
          <Ionicons
            name={n <= active ? 'star' : 'star-outline'}
            size={size}
            color={n <= active ? '#FBBF24' : Colors.border}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function FeedbackScreen() {
  const { student } = useStudent();
  const { primaryColor } = useThemeStore();

  const [feedbacks, setFeedbacks] = useState<WorkoutFeedback[]>([]);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);

  const [rating, setRating] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [ratingError, setRatingError] = useState(false);

  const load = useCallback(async () => {
    if (!student) return;
    const [fbRes, plansRes] = await Promise.all([
      supabase
        .from('workout_feedbacks')
        .select('id, rating, comment, created_at, workout_plan_id, workout_plans(name)')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('workout_plans')
        .select('id, name')
        .eq('student_id', student.id)
        .order('name'),
    ]);
    setFeedbacks((fbRes.data ?? []) as WorkoutFeedback[]);
    setPlans((plansRes.data ?? []) as WorkoutPlan[]);
    setLoading(false);
  }, [student?.id]);

  useEffect(() => { load(); }, [load]);

  function openModal() {
    setRating(0);
    setSelectedPlan(null);
    setComment('');
    setRatingError(false);
    setModalOpen(true);
  }

  async function submitFeedback() {
    if (rating === 0) { setRatingError(true); return; }
    if (!student) return;
    setSaving(true);
    const { data: inserted, error } = await supabase
      .from('workout_feedbacks')
      .insert({
        tenant_id: student.tenant_id,
        student_id: student.id,
        workout_plan_id: selectedPlan?.id ?? null,
        rating,
        comment: comment.trim() || null,
      })
      .select('id, rating, comment, created_at, workout_plan_id, workout_plans(name)')
      .single();
    setSaving(false);
    if (error) {
      Alert.alert('Erro', 'Não foi possível enviar. Tente novamente.');
    } else {
      setFeedbacks(prev => [inserted as WorkoutFeedback, ...prev]);
      setModalOpen(false);
    }
  }

  function fmtDay(iso: string) { return new Date(iso).getDate().toString().padStart(2, '0'); }
  function fmtMonth(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
  }
  function fmtYear(iso: string) { return new Date(iso).getFullYear().toString(); }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Feedback</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={feedbacks}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <TouchableOpacity
              style={[s.newBtn, { backgroundColor: primaryColor }]}
              onPress={openModal}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={s.newBtnText}>Avaliar treino</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={[s.emptyIcon, { borderColor: `${primaryColor}30`, backgroundColor: `${primaryColor}10` }]}>
                <Ionicons name="star-outline" size={28} color={primaryColor} />
              </View>
              <Text style={s.emptyTitle}>Nenhum feedback ainda</Text>
              <Text style={s.emptyDesc}>
                Avalie seus treinos para ajudar seu personal a melhorar suas fichas.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              {/* Date badge */}
              <View style={s.dateBadge}>
                <Text style={s.dateMonth}>{fmtMonth(item.created_at)}</Text>
                <Text style={s.dateDay}>{fmtDay(item.created_at)}</Text>
                <Text style={s.dateYear}>{fmtYear(item.created_at)}</Text>
              </View>

              {/* Content */}
              <View style={s.cardBody}>
                <View style={s.cardTopRow}>
                  <StarRow rating={item.rating} size={14} />
                  {item.rating > 0 && (
                    <Text style={[s.ratingLabel, { color: LABEL_COLORS[item.rating] }]}>
                      {LABELS[item.rating]}
                    </Text>
                  )}
                </View>
                {item.workout_plans?.name && (
                  <Text style={s.planName} numberOfLines={1}>{item.workout_plans.name}</Text>
                )}
                {item.comment && (
                  <Text style={s.commentText} numberOfLines={3}>{item.comment}</Text>
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* New feedback modal */}
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setModalOpen(false)} />
          <View style={s.sheet}>
            <View style={s.handle} />

            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Avaliar Treino</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)} style={s.iconBtn}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Stars */}
              <Text style={s.fieldLabel}>NOTA DO TREINO</Text>
              <View style={s.starsRow}>
                <StarRow rating={rating} size={36} interactive onRate={r => { setRating(r); setRatingError(false); }} />
                {rating > 0 && (
                  <Text style={[s.ratingLabelLg, { color: LABEL_COLORS[rating] }]}>
                    {LABELS[rating]}
                  </Text>
                )}
              </View>
              {ratingError && (
                <View style={s.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
                  <Text style={s.errorText}>Selecione uma nota</Text>
                </View>
              )}

              {/* Plan selector */}
              {plans.length > 0 && (
                <>
                  <Text style={[s.fieldLabel, { marginTop: 20 }]}>
                    PLANO DE TREINO <Text style={s.optional}>(opcional)</Text>
                  </Text>
                  <TouchableOpacity
                    style={s.planSelector}
                    onPress={() => setPlanPickerOpen(true)}
                    activeOpacity={0.75}
                  >
                    <Text style={selectedPlan ? s.planSelectorVal : s.planSelectorPlaceholder} numberOfLines={1}>
                      {selectedPlan?.name ?? 'Sem plano específico'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </>
              )}

              {/* Comment */}
              <Text style={[s.fieldLabel, { marginTop: 20 }]}>
                COMENTÁRIO <Text style={s.optional}>(opcional)</Text>
              </Text>
              <TextInput
                style={s.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder="Como foi o treino? Ficou pesado? Alguma dificuldade?"
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setModalOpen(false)} activeOpacity={0.75}>
                  <Text style={s.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.submitBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
                  onPress={submitFeedback}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.submitBtnText}>Enviar</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Plan picker modal */}
      <Modal visible={planPickerOpen} animationType="slide" transparent onRequestClose={() => setPlanPickerOpen(false)}>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPlanPickerOpen(false)} />
          <View style={[s.sheet, { maxHeight: '60%' }]}>
            <View style={s.handle} />
            <Text style={[s.sheetTitle, { marginBottom: 12 }]}>Plano de Treino</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[s.planOption, !selectedPlan && s.planOptionActive]}
                onPress={() => { setSelectedPlan(null); setPlanPickerOpen(false); }}
                activeOpacity={0.75}
              >
                <Text style={[s.planOptionText, !selectedPlan && { color: primaryColor }]}>
                  Sem plano específico
                </Text>
                {!selectedPlan && <Ionicons name="checkmark" size={18} color={primaryColor} />}
              </TouchableOpacity>
              {plans.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[s.planOption, selectedPlan?.id === p.id && s.planOptionActive]}
                  onPress={() => { setSelectedPlan(p); setPlanPickerOpen(false); }}
                  activeOpacity={0.75}
                >
                  <Text style={[s.planOptionText, selectedPlan?.id === p.id && { color: primaryColor }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  {selectedPlan?.id === p.id && <Ionicons name="checkmark" size={18} color={primaryColor} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 10 },

  newBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginBottom: 6 },
  newBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: '#fff', letterSpacing: 1, textTransform: 'uppercase' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 40 },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  card: { flexDirection: 'row', gap: 14, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  dateBadge: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 8, minWidth: 48 },
  dateMonth: { fontFamily: FontFamily.body, fontSize: 9, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateDay: { fontFamily: FontFamily.bodyBold, fontSize: 22, color: Colors.textPrimary, lineHeight: 26 },
  dateYear: { fontFamily: FontFamily.body, fontSize: 9, color: Colors.textSecondary },
  cardBody: { flex: 1, gap: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingLabel: { fontFamily: FontFamily.bodyBold, fontSize: 12 },
  planName: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary },
  commentText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20, marginTop: 2 },

  overlay: { flex: 1, backgroundColor: '#00000060', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sheetTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.lg, color: Colors.textPrimary },

  fieldLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 10, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 10 },
  optional: { fontFamily: FontFamily.body, color: Colors.textSecondary, opacity: 0.6 },

  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ratingLabelLg: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  errorText: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: '#EF4444' },

  planSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12 },
  planSelectorVal: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1, marginRight: 8 },
  planSelectorPlaceholder: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1, marginRight: 8 },

  commentInput: { backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, minHeight: 100, marginBottom: 20 },

  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  submitBtn: { flex: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: '#fff' },

  planOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  planOptionActive: { /* highlighted by text color change */ },
  planOptionText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1, marginRight: 8 },
});
