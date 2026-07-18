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
import { groupByCombo, comboTypeLabel, comboTypeKey } from '@/lib/comboExercises';

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
  combo_group_id: string | null;
  combo_type: string | null;
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
  const { primaryColor, primaryTextColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? '';

  const [extra, setExtra] = useState<ExtraWorkout | null>(null);
  const [items, setItems] = useState<ExtraItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Combine exercises into bi/tri-série
  const [combining, setCombining] = useState(false);
  const [selectedForCombo, setSelectedForCombo] = useState<Set<string>>(new Set());

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
        .select('id,exercise_id,sets,reps,duration_secs,rest_seconds,load,count_type,display_order,notes,combo_group_id,combo_type,exercises(name,muscle_group)')
        .eq('extra_workout_id', id).order('display_order'),
    ]);
    setExtra({ ...(extraRes.data as any), student: (extraRes.data as any)?.students });
    setItems((itemsRes.data ?? []).map((i: any) => ({ ...i, exercise: i.exercises })));
  }, [id, tenantId]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function handleAddExercises(exercises: ExerciseSummary[]) {
    setPickerVisible(false);
    if (!exercises.length) return;
    const rows = exercises.map((exercise, i) => ({
      extra_workout_id: id,
      tenant_id: tenantId,
      exercise_id: exercise.id,
      count_type: exercise.count_type,
      sets: exercise.default_sets ?? 3,
      reps: exercise.default_reps ?? '10-12',
      duration_secs: exercise.duration_secs ?? null,
      display_order: items.length + i,
    }));
    const { error } = await supabase.from('extra_workout_items').insert(rows);
    if (error) { Alert.alert('Erro', error.message); return; }
    await load();
  }

  async function handleDeleteItem(itemId: string) {
    await supabase.from('extra_workout_items').delete().eq('id', itemId);
    await load();
  }

  function toggleCombining() {
    setCombining(prev => !prev);
    setSelectedForCombo(new Set());
  }

  function toggleComboItem(itemId: string) {
    setSelectedForCombo(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  /** Abre o modo de seleção já com os membros da combinação existente marcados, para adicionar/trocar exercícios. */
  function handleEditCombo(comboGroupId: string) {
    const memberIds = items.filter(it => it.combo_group_id === comboGroupId).map(it => it.id);
    setCombining(true);
    setSelectedForCombo(new Set(memberIds));
  }

  async function handleGroupItems(explicitIds?: string[]) {
    const ids = new Set(explicitIds ?? Array.from(selectedForCombo));
    if (ids.size < 2) return;
    const comboGroupId = items.find(it => ids.has(it.id))?.id;
    if (!comboGroupId) return;
    const comboType = comboTypeKey(ids.size);

    // Libera membros de combinações antigas que não foram re-selecionados desta vez
    // (permite recombinar/trocar exercícios de uma bi/tri-série já existente).
    const oldGroupIdsInvolved = new Set(
      items.filter(it => it.combo_group_id && ids.has(it.id)).map(it => it.combo_group_id!)
    );
    const toRelease = items.filter(it => it.combo_group_id && oldGroupIdsInvolved.has(it.combo_group_id) && !ids.has(it.id));

    const newOrder: ExtraItem[] = [];
    let insertedCombo = false;
    for (const it of items) {
      if (ids.has(it.id)) {
        if (!insertedCombo) {
          newOrder.push(...items.filter(i => ids.has(i.id)));
          insertedCombo = true;
        }
      } else {
        newOrder.push(it);
      }
    }

    const results = await Promise.all([
      ...newOrder.map((it, idx) => supabase.from('extra_workout_items').update({
        display_order: idx,
        ...(ids.has(it.id) ? { combo_group_id: comboGroupId, combo_type: comboType } : {}),
      }).eq('id', it.id)),
      ...toRelease.map(it => supabase.from('extra_workout_items').update({ combo_group_id: null, combo_type: null }).eq('id', it.id)),
    ]);
    const firstError = results.find(r => r.error)?.error;
    if (firstError) { Alert.alert('Erro ao combinar', firstError.message); return; }

    setCombining(false);
    setSelectedForCombo(new Set());
    await load();
  }

  async function handleUngroupCombo(comboGroupId: string) {
    await supabase.from('extra_workout_items').update({ combo_group_id: null, combo_type: null }).eq('combo_group_id', comboGroupId);
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
        const { data: insertedRows, error: insertError } = await supabase.from('extra_workout_items').insert(
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
        ).select('id');
        if (insertError) throw insertError;

        // Remap combo_group_id to the freshly copied items' ids so the grouping survives the assignment.
        const oldToNewId = new Map(items.map((i, idx) => [i.id, insertedRows![idx].id]));
        const comboUpdates = items
          .filter(i => i.combo_group_id)
          .map(i => supabase.from('extra_workout_items').update({
            combo_group_id: oldToNewId.get(i.combo_group_id!),
            combo_type: i.combo_type,
          }).eq('id', oldToNewId.get(i.id)!));
        if (comboUpdates.length) await Promise.all(comboUpdates);
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
            {items.length >= 2 && (
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: combining ? `${primaryColor}25` : Colors.surface, borderWidth: 1, borderColor: Colors.border }]}
                onPress={toggleCombining} activeOpacity={0.8}>
                <Ionicons name="git-merge-outline" size={16} color={primaryColor} />
                <Text style={[s.actionBtnText, { color: primaryColor }]}>{combining ? 'Cancelar' : 'Combinar'}</Text>
              </TouchableOpacity>
            )}
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
          {(() => {
            const soloItems = items.filter(it => !it.combo_group_id);
            const comboReady = items.map(it => ({ ...it, itemId: it.id, comboGroupId: it.combo_group_id }));
            const comboGroups = groupByCombo(comboReady).filter(g => g.isCombo);

            function renderRow(item: ExtraItem, opts: { badgeIndex?: number; borderBottom: boolean }) {
              const mc = muscleColor(item.exercise?.muscle_group ?? '');
              const isSelected = selectedForCombo.has(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  disabled={!combining}
                  activeOpacity={combining ? 0.7 : 1}
                  onPress={() => toggleComboItem(item.id)}
                  style={[s.itemRow, opts.borderBottom && s.itemBorder, combining && isSelected && { backgroundColor: `${primaryColor}1f` }]}>
                  {combining && (
                    <Ionicons name={isSelected ? 'checkbox' : 'square-outline'} size={18} color={isSelected ? primaryColor : Colors.textSecondary} />
                  )}
                  {opts.badgeIndex != null && !combining && (
                    <View style={[s.comboIndexBadge, { borderColor: primaryColor }]}>
                      <Text style={[s.comboIndexBadgeText, { color: primaryColor }]}>{opts.badgeIndex}</Text>
                    </View>
                  )}
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
                  {!combining && (
                    <>
                      <TouchableOpacity onPress={() => openEditItem(item)} style={s.iconBtn} activeOpacity={0.75}>
                        <Ionicons name="create-outline" size={16} color={primaryColor} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={s.iconBtn} activeOpacity={0.75}>
                        <Ionicons name="trash-outline" size={15} color={Colors.error} />
                      </TouchableOpacity>
                    </>
                  )}
                </TouchableOpacity>
              );
            }

            return (
              <>
                {/* Exercícios individuais */}
                {soloItems.map((item, idx) => renderRow(item, {
                  borderBottom: idx < soloItems.length - 1,
                }))}

                {/* Exercícios Combinados — seção própria, "lista dentro da lista" */}
                {comboGroups.length > 0 && (
                  <View style={s.combinedSection}>
                    <View style={s.combinedSectionHeader}>
                      <Ionicons name="link" size={12} color={Colors.textSecondary} />
                      <Text style={s.combinedSectionTitle}>
                        EXERCÍCIOS COMBINADOS · {comboGroups.length} {comboGroups.length > 1 ? 'GRUPOS' : 'GRUPO'}
                      </Text>
                    </View>
                    {comboGroups.map((group, gi) => (
                      <View key={group.comboId ?? `combo-${gi}`}
                        style={[s.comboWrap, { borderColor: primaryColor, backgroundColor: `${primaryColor}0f` }]}>
                        <View style={[s.comboHeader, { backgroundColor: `${primaryColor}22` }]}>
                          <Ionicons name="git-merge" size={14} color={primaryColor} />
                          <Text style={[s.comboLabel, { color: primaryColor }]}>{comboTypeLabel(group.items.length)} · {group.items.length} exercícios</Text>
                          {!combining && (
                            <View style={s.comboHeaderActions}>
                              <TouchableOpacity onPress={() => handleEditCombo(group.comboId!)}
                                style={s.comboHeaderActionBtn} activeOpacity={0.75}>
                                <Ionicons name="swap-horizontal-outline" size={13} color={primaryColor} />
                                <Text style={[s.comboHeaderActionText, { color: primaryColor }]}>Recombinar</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleUngroupCombo(group.comboId!)}
                                style={s.comboHeaderActionBtn} activeOpacity={0.75}>
                                <Ionicons name="close-circle-outline" size={13} color={Colors.error} />
                                <Text style={[s.comboHeaderActionText, { color: Colors.error }]}>Desagrupar</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                        {group.items.map((item, memberIdx) => renderRow(item, {
                          badgeIndex: memberIdx + 1,
                          borderBottom: memberIdx < group.items.length - 1,
                        }))}
                      </View>
                    ))}
                  </View>
                )}
              </>
            );
          })()}
        </View>
        {combining && selectedForCombo.size >= 2 && (
          <TouchableOpacity
            style={[s.groupConfirmBtn, { backgroundColor: primaryColor }]}
            onPress={() => handleGroupItems()} activeOpacity={0.85}>
            <Ionicons name="checkmark" size={16} color={primaryTextColor} />
            <Text style={[s.groupConfirmBtnText, { color: primaryTextColor }]}>
              Agrupar em {comboTypeLabel(selectedForCombo.size)}
            </Text>
          </TouchableOpacity>
        )}
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
                {saving ? <ActivityIndicator color={primaryTextColor} /> : <Text style={[s.saveBtnText, { color: primaryTextColor }]}>Salvar</Text>}
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
                  {savingAssign ? <ActivityIndicator color={primaryTextColor} /> : <Text style={[s.saveBtnText, { color: primaryTextColor }]}>Atribuir</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>

      <ExercisePickerModal visible={pickerVisible} tenantId={tenantId}
        multiSelect onConfirm={handleAddExercises} onClose={() => setPickerVisible(false)} />
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
  combinedSection: { marginTop: 14, paddingHorizontal: 12, paddingBottom: 4, gap: 8 },
  combinedSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  combinedSectionTitle: { fontFamily: FontFamily.bodyBold, fontSize: 10.5, letterSpacing: 1, color: Colors.textSecondary },
  muscleTag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, minWidth: 44, alignItems: 'center' },
  muscleTagText: { fontFamily: FontFamily.bodyMedium, fontSize: 10 },
  itemName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  itemMeta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  comboWrap: { borderWidth: 1.5, borderRadius: 12, overflow: 'hidden', marginVertical: 4 },
  comboHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, flexWrap: 'wrap' },
  comboLabel: { fontFamily: FontFamily.bodyBold, fontSize: 11.5, letterSpacing: 0.3, textTransform: 'uppercase', flex: 1 },
  comboHeaderActions: { flexDirection: 'row', gap: 12 },
  comboHeaderActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  comboHeaderActionText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  comboIndexBadge: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  comboIndexBadgeText: { fontFamily: FontFamily.bodyBold, fontSize: 10 },
  groupConfirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 10, paddingVertical: 12, marginTop: 12,
  },
  groupConfirmBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
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
