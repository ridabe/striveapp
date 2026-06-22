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
import { extraCategoryLabel, muscleColor } from '@/lib/exerciseConfig';
import { ExercisePickerModal, ExerciseSummary } from '@/components/ExercisePickerModal';

interface ExtraItem {
  id: string;
  exercise_id: string;
  sets: number | null;
  reps: string | null;
  duration_secs: number | null;
  rest_seconds: number | null;
  load: string | null;
  count_type: string;
  display_order: number;
  notes: string | null;
  exercise: { name: string; muscle_group: string } | null;
}

interface ExtraWorkout {
  id: string;
  name: string;
  category: string;
  description: string | null;
  is_template: boolean;
  student_id: string | null;
  student?: { full_name: string } | null;
}

interface Student { id: string; full_name: string }

const CATEGORY_COLORS: Record<string, string> = {
  aquecimento: '#F97316', hiit: '#EF4444', mobilidade: '#8B5CF6',
  cardio: '#EC4899', desafio: '#F59E0B', forca: '#3B82F6', outros: '#64748B',
};

export default function ExtraWorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? '';
  const lightText = ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(primaryColor);

  const [extra, setExtra] = useState<ExtraWorkout | null>(null);
  const [items, setItems] = useState<ExtraItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit item modal
  const [editItem, setEditItem] = useState<ExtraItem | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [fSets, setFSets] = useState('');
  const [fReps, setFReps] = useState('');
  const [fLoad, setFLoad] = useState('');
  const [fRest, setFRest] = useState('');
  const [fNotes, setFNotes] = useState('');

  // Assign modal (for templates)
  const [assignModal, setAssignModal] = useState(false);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const load = useCallback(async () => {
    if (!id || !tenantId) return;
    const [extraRes, itemsRes] = await Promise.all([
      supabase.from('extra_workouts')
        .select('id,name,category,description,is_template,student_id,students(full_name)')
        .eq('id', id).single(),
      supabase.from('extra_workout_items')
        .select('id,exercise_id,sets,reps,duration_secs,rest_seconds,load,count_type,display_order,notes,exercises(name,muscle_group)')
        .eq('extra_workout_id', id).order('display_order'),
    ]);
    setExtra({ ...(extraRes.data as any), student: (extraRes.data as any)?.students });
    setItems((itemsRes.data ?? []).map((i: any) => ({ ...i, exercise: i.exercises })));
  }, [id, tenantId]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function handleAddExercise(exercise: ExerciseSummary) {
    setPickerVisible(false);
    const { error } = await supabase.from('extra_workout_items').insert({
      extra_workout_id: id,
      tenant_id: tenantId,
      exercise_id: exercise.id,
      count_type: exercise.count_type,
      sets: exercise.default_sets ?? 3,
      reps: exercise.default_reps ?? '10-12',
      duration_secs: exercise.duration_secs ?? null,
      display_order: items.length,
    });
    if (error) { Alert.alert('Erro', error.message); return; }
    await load();
  }

  async function handleDeleteItem(itemId: string) {
    await supabase.from('extra_workout_items').delete().eq('id', itemId);
    await load();
  }

  function openEditItem(item: ExtraItem) {
    setEditItem(item);
    setFSets(String(item.sets ?? ''));
    setFReps(item.reps ?? '');
    setFLoad(item.load ?? '');
    setFRest(String(item.rest_seconds ?? ''));
    setFNotes(item.notes ?? '');
    setEditModal(true);
  }

  async function handleSaveItem() {
    if (!editItem) return;
    setSaving(true);
    await supabase.from('extra_workout_items').update({
      sets: fSets ? parseInt(fSets) : null,
      reps: fReps || null,
      load: fLoad || null,
      rest_seconds: fRest ? parseInt(fRest) : null,
      notes: fNotes || null,
    }).eq('id', editItem.id);
    setSaving(false);
    setEditModal(false);
    await load();
  }

  async function openAssignModal() {
    setLoadingStudents(true);
    setAssignModal(true);
    setSelectedStudent('');
    const { data } = await supabase.from('students')
      .select('id, full_name').eq('tenant_id', tenantId).eq('status', 'active').order('full_name');
    setAllStudents(data ?? []);
    setLoadingStudents(false);
  }

  async function handleAssign() {
    if (!selectedStudent) { Alert.alert('Atenção', 'Selecione um aluno.'); return; }
    setSavingAssign(true);
    try {
      // Copy all items to new assigned extra workout
      const { data: newExtra, error } = await supabase.from('extra_workouts').insert({
        name: extra!.name,
        category: extra!.category as any,
        description: extra?.description,
        is_template: false,
        student_id: selectedStudent,
        tenant_id: tenantId,
        tags: [],
      }).select('id').single();
      if (error) throw error;

      if (items.length > 0) {
        await supabase.from('extra_workout_items').insert(
          items.map(i => ({
            extra_workout_id: newExtra.id,
            tenant_id: tenantId,
            exercise_id: i.exercise_id,
            count_type: i.count_type,
            sets: i.sets,
            reps: i.reps,
            duration_secs: i.duration_secs,
            rest_seconds: i.rest_seconds,
            load: i.load,
            notes: i.notes,
            display_order: i.display_order,
          }))
        );
      }
      setAssignModal(false);
      Alert.alert('Sucesso', 'Treino atribuído ao aluno com sucesso.');
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSavingAssign(false);
    }
  }

  async function handleDelete() {
    Alert.alert('Remover', 'Tem certeza que deseja remover este treino extra?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: async () => {
          await supabase.from('extra_workouts').delete().eq('id', id);
          router.back();
        },
      },
    ]);
  }

  if (loading || !extra) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const cc = CATEGORY_COLORS[extra.category] ?? primaryColor;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{extra.name}</Text>
        <TouchableOpacity onPress={handleDelete} style={s.iconBtn} activeOpacity={0.75}>
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Info card */}
        <View style={[s.infoCard, { borderColor: `${cc}30` }]}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <View style={[s.catBadge, { backgroundColor: `${cc}18` }]}>
              <Text style={[s.catBadgeText, { color: cc }]}>{extraCategoryLabel(extra.category)}</Text>
            </View>
            <View style={[s.catBadge, { backgroundColor: Colors.surface }]}>
              <Ionicons name={extra.is_template ? 'copy-outline' : 'person-outline'} size={12} color={Colors.textSecondary} />
              <Text style={s.catBadgeText}>{extra.is_template ? 'Template' : 'Atribuído'}</Text>
            </View>
          </View>
          {extra.description && <Text style={s.descText}>{extra.description}</Text>}
          {!extra.is_template && extra.student && (
            <Text style={s.studentLabel}>Aluno: {extra.student.full_name}</Text>
          )}
          <View style={s.actionRow}>
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: `${primaryColor}18` }]}
              onPress={() => setPickerVisible(true)} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={16} color={primaryColor} />
              <Text style={[s.actionBtnText, { color: primaryColor }]}>Adicionar Exercício</Text>
            </TouchableOpacity>
            {extra.is_template && (
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]}
                onPress={openAssignModal} activeOpacity={0.8}>
                <Ionicons name="person-add-outline" size={16} color={Colors.textPrimary} />
                <Text style={s.actionBtnText}>Atribuir a Aluno</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Items */}
        <Text style={s.sectionLabel}>EXERCÍCIOS ({items.length})</Text>
        {items.length === 0 && (
          <TouchableOpacity style={s.emptyEx} onPress={() => setPickerVisible(true)} activeOpacity={0.75}>
            <Ionicons name="add-circle-outline" size={24} color={primaryColor} />
            <Text style={[s.emptyExText, { color: primaryColor }]}>Adicionar exercício</Text>
          </TouchableOpacity>
        )}
        <View style={s.itemsCard}>
          {items.map((item, idx) => {
            const mc = muscleColor(item.exercise?.muscle_group ?? '');
            return (
              <View key={item.id} style={[s.itemRow, idx < items.length - 1 && s.itemBorder]}>
                <View style={[s.muscleTag, { backgroundColor: `${mc}20` }]}>
                  <Text style={[s.muscleTagText, { color: mc }]} numberOfLines={1}>
                    {(item.exercise?.muscle_group ?? '').split(' ')[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName} numberOfLines={1}>{item.exercise?.name ?? '—'}</Text>
                  <Text style={s.itemMeta}>
                    {item.sets ?? '—'}×{item.reps ?? (item.duration_secs ? `${item.duration_secs}s` : '—')}
                    {item.load ? ` · ${item.load}` : ''}
                    {item.rest_seconds ? ` · ${item.rest_seconds}s` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => openEditItem(item)} style={s.iconBtn} activeOpacity={0.75}>
                  <Ionicons name="create-outline" size={16} color={primaryColor} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={s.iconBtn} activeOpacity={0.75}>
                  <Ionicons name="trash-outline" size={15} color={Colors.error} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Edit item modal */}
      <Modal visible={editModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setEditModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
              <TouchableOpacity onPress={() => setEditModal(false)} style={s.iconBtn}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={s.title} numberOfLines={1}>{editItem?.exercise?.name ?? 'Exercício'}</Text>
              <View style={{ width: 38 }} />
            </View>
            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>SÉRIES</Text>
                  <TextInput value={fSets} onChangeText={setFSets} style={s.input} keyboardType="numeric" placeholder="3" placeholderTextColor={Colors.textSecondary} />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={s.label}>REPS / TEMPO</Text>
                  <TextInput value={fReps} onChangeText={setFReps} style={s.input} placeholder="10-12" placeholderTextColor={Colors.textSecondary} />
                </View>
              </View>
              <View style={[s.row2, { marginTop: 14 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>CARGA</Text>
                  <TextInput value={fLoad} onChangeText={setFLoad} style={s.input} placeholder="20kg" placeholderTextColor={Colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>DESCANSO</Text>
                  <TextInput value={fRest} onChangeText={setFRest} style={s.input} keyboardType="numeric" placeholder="60s" placeholderTextColor={Colors.textSecondary} />
                </View>
              </View>
              <Text style={[s.label, { marginTop: 14 }]}>OBSERVAÇÕES</Text>
              <TextInput value={fNotes} onChangeText={setFNotes} style={[s.input, s.textArea]} multiline placeholderTextColor={Colors.textSecondary} placeholder="Dicas de execução..." />
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
                onPress={handleSaveItem} disabled={saving} activeOpacity={0.85}>
                {saving ? <ActivityIndicator color={lightText ? '#000' : '#fff'} /> : <Text style={[s.saveBtnText, { color: lightText ? '#000' : '#fff' }]}>Salvar</Text>}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Assign modal */}
      <Modal visible={assignModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => !savingAssign && setAssignModal(false)}>
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => !savingAssign && setAssignModal(false)} style={s.iconBtn}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.title}>Atribuir a Aluno</Text>
            <View style={{ width: 38 }} />
          </View>
          {loadingStudents ? <ActivityIndicator color={primaryColor} style={{ marginTop: 40 }} /> : (
            <>
              <FlatList
                data={allStudents}
                keyExtractor={st => st.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 8 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[s.studentRow, selectedStudent === item.id && { borderColor: primaryColor, backgroundColor: `${primaryColor}08` }]}
                    onPress={() => setSelectedStudent(item.id)} activeOpacity={0.75}>
                    <Text style={s.studentName}>{item.full_name}</Text>
                    {selectedStudent === item.id && <Ionicons name="checkmark-circle" size={20} color={primaryColor} />}
                  </TouchableOpacity>
                )}
              />
              <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
                <TouchableOpacity
                  style={[s.saveBtn, { backgroundColor: primaryColor }, savingAssign && { opacity: 0.6 }]}
                  onPress={handleAssign} disabled={savingAssign} activeOpacity={0.85}>
                  {savingAssign ? <ActivityIndicator color={lightText ? '#000' : '#fff'} /> : <Text style={[s.saveBtnText, { color: lightText ? '#000' : '#fff' }]}>Atribuir</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>

      <ExercisePickerModal visible={pickerVisible} tenantId={tenantId}
        onSelect={handleAddExercise} onClose={() => setPickerVisible(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, flex: 1, marginHorizontal: 8 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 12 },
  infoCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20, gap: 8 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  catBadgeText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  descText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  studentLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 10 },
  actionBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: Colors.textPrimary },
  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 10 },
  itemsCard: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, gap: 10 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  muscleTag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, minWidth: 44, alignItems: 'center' },
  muscleTagText: { fontFamily: FontFamily.bodyMedium, fontSize: 10 },
  itemName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  itemMeta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  emptyEx: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 24 },
  emptyExText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },
  modalContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  label: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  row2: { flexDirection: 'row', gap: 10 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md },
  studentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  studentName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
});
