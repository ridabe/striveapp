import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform, FlatList, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { GOAL_COLORS, muscleColor, DAYS_OF_WEEK } from '@/lib/exerciseConfig';
import { ExercisePickerModal, ExerciseSummary } from '@/components/ExercisePickerModal';

interface WorkoutItem {
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
  exercise: { name: string; muscle_group: string; video_url: string | null } | null;
}

interface Routine {
  id: string;
  name: string;
  day_of_week: number | null;
  display_order: number;
  notes: string | null;
  items: WorkoutItem[];
}

interface Plan {
  id: string;
  name: string;
  goal: string | null;
  status: 'active' | 'inactive';
  description: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface AssignedStudent {
  student_id: string;
  students: { full_name: string } | null;
}

interface Student { id: string; full_name: string }

export default function PlanDetailScreen() {
  const { id, studentId: fromStudentId } = useLocalSearchParams<{ id: string; studentId?: string }>();
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? '';
  const lightText = ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(primaryColor);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Expanded routine
  const [expandedRoutine, setExpandedRoutine] = useState<string | null>(null);

  // Add routine modal
  const [routineModal, setRoutineModal] = useState(false);
  const [fRoutineName, setFRoutineName] = useState('');
  const [fRoutineDay, setFRoutineDay] = useState<number | null>(null);

  // Exercise picker
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerRoutineId, setPickerRoutineId] = useState('');

  // Edit item modal
  const [editItem, setEditItem] = useState<WorkoutItem | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [fSets, setFSets] = useState('');
  const [fReps, setFReps] = useState('');
  const [fLoad, setFLoad] = useState('');
  const [fRest, setFRest] = useState('');
  const [fNotes, setFNotes] = useState('');

  // Assign modal
  const [assignModal, setAssignModal] = useState(false);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);

  const load = useCallback(async () => {
    if (!id || !tenantId) return;
    const [planRes, routinesRes] = await Promise.all([
      supabase.from('workout_plans').select('id,name,goal,status,description,start_date,end_date').eq('id', id).single(),
      supabase.from('workout_routines').select('id,name,day_of_week,display_order,notes').eq('workout_plan_id', id).order('display_order'),
    ]);
    const routineIds: string[] = (routinesRes.data ?? []).map((r: any) => r.id);
    const itemsRes = routineIds.length > 0
      ? await supabase.from('workout_items')
          .select('id,exercise_id,sets,reps,duration_secs,rest_seconds,load,count_type,display_order,notes,routine_id,exercises(name,muscle_group,video_url)')
          .eq('tenant_id', tenantId)
          .in('routine_id', routineIds)
          .order('display_order')
      : { data: [] };

    setPlan(planRes.data as Plan);

    const allItems: any[] = itemsRes.data ?? [];
    const mapped: Routine[] = (routinesRes.data ?? []).map((r: any) => ({
      ...r,
      items: allItems
        .filter(i => i.routine_id === r.id)
        .map(i => ({ ...i, exercise: i.exercises })),
    }));
    setRoutines(mapped);
  }, [id, tenantId]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function reloadItems() {
    const itemsRes = await supabase.from('workout_items')
      .select('id,exercise_id,sets,reps,duration_secs,rest_seconds,load,count_type,display_order,notes,routine_id,exercises(name,muscle_group,video_url)')
      .eq('tenant_id', tenantId)
      .in('routine_id', routines.map(r => r.id))
      .order('display_order');
    const allItems: any[] = itemsRes.data ?? [];
    setRoutines(prev => prev.map(r => ({
      ...r,
      items: allItems.filter(i => i.routine_id === r.id).map(i => ({ ...i, exercise: i.exercises })),
    })));
  }

  async function handleToggleStatus() {
    if (!plan) return;
    const newStatus = plan.status === 'active' ? 'inactive' : 'active';
    await supabase.from('workout_plans').update({ status: newStatus }).eq('id', id);
    setPlan(p => p ? { ...p, status: newStatus } : p);
  }

  async function handleAddRoutine() {
    if (!fRoutineName.trim()) { Alert.alert('Atenção', 'Informe o nome da rotina.'); return; }
    setSaving(true);
    const { error } = await supabase.from('workout_routines').insert({
      workout_plan_id: id,
      tenant_id: tenantId,
      name: fRoutineName.trim(),
      day_of_week: fRoutineDay,
      display_order: routines.length,
    });
    setSaving(false);
    if (error) { Alert.alert('Erro', error.message); return; }
    setRoutineModal(false);
    setFRoutineName(''); setFRoutineDay(null);
    await load();
  }

  async function handleDeleteRoutine(routineId: string) {
    Alert.alert('Remover rotina', 'Todos os exercícios desta rotina serão removidos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: async () => {
          await supabase.from('workout_routines').delete().eq('id', routineId);
          await load();
        },
      },
    ]);
  }

  async function handleAddExercise(exercise: ExerciseSummary) {
    setPickerVisible(false);
    const currentItems = routines.find(r => r.id === pickerRoutineId)?.items ?? [];
    const { error } = await supabase.from('workout_items').insert({
      routine_id: pickerRoutineId,
      tenant_id: tenantId,
      exercise_id: exercise.id,
      count_type: exercise.count_type,
      sets: exercise.default_sets ?? 3,
      reps: exercise.default_reps ?? '10-12',
      duration_secs: exercise.duration_secs ?? null,
      display_order: currentItems.length,
    });
    if (error) { Alert.alert('Erro', error.message); return; }
    await reloadItems();
  }

  async function handleDeleteItem(itemId: string) {
    await supabase.from('workout_items').delete().eq('id', itemId);
    await reloadItems();
  }

  function openEditItem(item: WorkoutItem) {
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
    const { error } = await supabase.from('workout_items').update({
      sets: fSets ? parseInt(fSets) : null,
      reps: fReps || null,
      load: fLoad || null,
      rest_seconds: fRest ? parseInt(fRest) : null,
      notes: fNotes || null,
    }).eq('id', editItem.id);
    setSaving(false);
    if (error) { Alert.alert('Erro', error.message); return; }
    setEditModal(false);
    await reloadItems();
  }

  async function openAssignModal() {
    setLoadingAssign(true);
    setAssignModal(true);
    const [studentsRes, assignRes] = await Promise.all([
      supabase.from('students').select('id, full_name').eq('tenant_id', tenantId).eq('status', 'active').order('full_name'),
      supabase.from('student_plan_assignments').select('student_id').eq('plan_id', id),
    ]);
    setAllStudents(studentsRes.data ?? []);
    const existingIds = (assignRes.data ?? []).map((a: any) => a.student_id as string);
    // Pré-seleciona o aluno de origem (quando vindo do Max)
    const preSelected =
      fromStudentId && !existingIds.includes(fromStudentId)
        ? [...existingIds, fromStudentId]
        : existingIds;
    setAssigned(preSelected);
    setLoadingAssign(false);
  }

  async function handleSaveAssign() {
    setSavingAssign(true);
    const existing = (await supabase.from('student_plan_assignments').select('student_id').eq('plan_id', id)).data ?? [];
    const existingIds = existing.map((a: any) => a.student_id as string);

    const toAdd = assigned.filter(sid => !existingIds.includes(sid));
    const toRemove = existingIds.filter((sid: string) => !assigned.includes(sid));

    const ops = [];
    if (toAdd.length > 0)
      ops.push(supabase.from('student_plan_assignments').insert(toAdd.map(sid => ({ plan_id: id, student_id: sid, tenant_id: tenantId, status: 'active' }))));
    if (toRemove.length > 0)
      ops.push(supabase.from('student_plan_assignments').delete().eq('plan_id', id).in('student_id', toRemove));

    await Promise.all(ops);
    setSavingAssign(false);
    setAssignModal(false);
  }

  if (loading || !plan) {
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

  const gc = plan.goal ? (GOAL_COLORS[plan.goal] ?? primaryColor) : primaryColor;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{plan.name}</Text>
        <TouchableOpacity
          style={[s.statusBtn, { borderColor: plan.status === 'active' ? Colors.success : Colors.border }]}
          onPress={handleToggleStatus} activeOpacity={0.8}>
          <View style={[s.statusDot, { backgroundColor: plan.status === 'active' ? Colors.success : Colors.textSecondary }]} />
          <Text style={[s.statusText, { color: plan.status === 'active' ? Colors.success : Colors.textSecondary }]}>
            {plan.status === 'active' ? 'Ativo' : 'Inativo'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Plan info */}
        <View style={s.planCard}>
          {plan.goal && (
            <View style={[s.goalBadge, { backgroundColor: `${gc}18`, borderColor: `${gc}40` }]}>
              <Text style={[s.goalText, { color: gc }]}>{plan.goal}</Text>
            </View>
          )}
          {plan.description && <Text style={s.descText}>{plan.description}</Text>}

          {/* Botão de ativar/desativar — visível e explícito */}
          <TouchableOpacity
            style={[
              s.activateBtn,
              plan.status === 'active'
                ? { backgroundColor: `${Colors.success}18`, borderColor: Colors.success }
                : { backgroundColor: `${Colors.success}10`, borderColor: `${Colors.success}60` },
            ]}
            onPress={handleToggleStatus}
            activeOpacity={0.8}
          >
            <Ionicons
              name={plan.status === 'active' ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={18}
              color={Colors.success}
            />
            <Text style={[s.activateBtnText, { color: Colors.success }]}>
              {plan.status === 'active' ? 'Ativo — toque para desativar' : 'Ativar Plano'}
            </Text>
          </TouchableOpacity>

          <View style={s.actionRow}>
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: `${primaryColor}18` }]}
              onPress={openAssignModal} activeOpacity={0.8}>
              <Ionicons name="people-outline" size={16} color={primaryColor} />
              <Text style={[s.actionBtnText, { color: primaryColor }]}>Atribuir Alunos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]}
              onPress={() => setRoutineModal(true)} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={16} color={Colors.textPrimary} />
              <Text style={s.actionBtnText}>Nova Rotina</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Routines */}
        <Text style={s.sectionLabel}>ROTINAS ({routines.length})</Text>

        {routines.length === 0 && (
          <View style={s.emptyRoutine}>
            <Ionicons name="list-outline" size={40} color={Colors.border} />
            <Text style={s.emptyText}>Adicione rotinas a este plano (Treino A, B, C...)</Text>
          </View>
        )}

        {routines.map(routine => {
          const isExpanded = expandedRoutine === routine.id;
          return (
            <View key={routine.id} style={s.routineCard}>
              {/* Routine header */}
              <TouchableOpacity
                style={s.routineHeader}
                onPress={() => setExpandedRoutine(isExpanded ? null : routine.id)}
                activeOpacity={0.8}>
                <View style={[s.routineIcon, { backgroundColor: `${primaryColor}18` }]}>
                  <Ionicons name="list-outline" size={18} color={primaryColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.routineName}>{routine.name}</Text>
                  <Text style={s.routineMeta}>
                    {routine.day_of_week != null ? DAYS_OF_WEEK[routine.day_of_week] : 'Sem dia fixo'} · {routine.items.length} exercício{routine.items.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => {
                  setPickerRoutineId(routine.id);
                  setPickerVisible(true);
                }} style={s.addExBtn} activeOpacity={0.75}>
                  <Ionicons name="add" size={18} color={primaryColor} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteRoutine(routine.id)} style={s.iconBtn} activeOpacity={0.75}>
                  <Ionicons name="trash-outline" size={16} color={Colors.error} />
                </TouchableOpacity>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
              </TouchableOpacity>

              {/* Items */}
              {isExpanded && (
                <View style={s.itemsList}>
                  {routine.items.length === 0 && (
                    <TouchableOpacity style={s.addExPlaceholder}
                      onPress={() => { setPickerRoutineId(routine.id); setPickerVisible(true); }} activeOpacity={0.75}>
                      <Ionicons name="add-circle-outline" size={20} color={primaryColor} />
                      <Text style={[s.addExPlaceholderText, { color: primaryColor }]}>Adicionar exercício</Text>
                    </TouchableOpacity>
                  )}
                  {routine.items.map((item, idx) => {
                    const mc = muscleColor(item.exercise?.muscle_group ?? '');
                    return (
                      <View key={item.id} style={[s.itemRow, idx < routine.items.length - 1 && s.itemBorder]}>
                        {item.exercise?.video_url ? (
                          <Image source={{ uri: item.exercise.video_url }} style={s.itemThumb} resizeMode="cover" />
                        ) : (
                          <View style={s.itemThumbPlaceholder}>
                            <Ionicons name="barbell-outline" size={14} color={Colors.border} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={s.itemName} numberOfLines={1}>{item.exercise?.name ?? '—'}</Text>
                          <Text style={s.itemPrescription}>
                            {item.sets ?? '—'}×{item.reps ?? (item.duration_secs ? `${item.duration_secs}s` : '—')}
                            {item.load ? ` · ${item.load}kg` : ''}
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
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Add routine modal */}
      <Modal visible={routineModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setRoutineModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
              <TouchableOpacity onPress={() => setRoutineModal(false)} style={s.iconBtn}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={s.title}>Nova Rotina</Text>
              <View style={{ width: 38 }} />
            </View>
            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>NOME DA ROTINA</Text>
              <TextInput value={fRoutineName} onChangeText={setFRoutineName} style={s.input}
                placeholder="Ex: Treino A — Peito e Tríceps" placeholderTextColor={Colors.textSecondary} />
              <Text style={[s.label, { marginTop: 18 }]}>DIA DA SEMANA (opcional)</Text>
              <View style={s.daysRow}>
                {DAYS_OF_WEEK.map((d, i) => (
                  <TouchableOpacity key={i}
                    style={[s.dayBtn, fRoutineDay === i && { backgroundColor: primaryColor, borderColor: primaryColor }]}
                    onPress={() => setFRoutineDay(fRoutineDay === i ? null : i)} activeOpacity={0.75}>
                    <Text style={[s.dayBtnText, fRoutineDay === i && { color: lightText ? '#000' : '#fff' }]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
                onPress={handleAddRoutine} disabled={saving} activeOpacity={0.85}>
                {saving
                  ? <ActivityIndicator color={lightText ? '#000' : '#fff'} />
                  : <Text style={[s.saveBtnText, { color: lightText ? '#000' : '#fff' }]}>Criar Rotina</Text>}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

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
              <View style={s.row4}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>SÉRIES</Text>
                  <TextInput value={fSets} onChangeText={setFSets} style={s.input} keyboardType="numeric" placeholder="3" placeholderTextColor={Colors.textSecondary} />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={s.label}>REPS / TEMPO</Text>
                  <TextInput value={fReps} onChangeText={setFReps} style={s.input} placeholder="10-12 / 30s" placeholderTextColor={Colors.textSecondary} />
                </View>
              </View>
              <View style={[s.row4, { marginTop: 14 }]}>
                <View style={{ flex: 2 }}>
                  <Text style={s.label}>CARGA</Text>
                  <TextInput value={fLoad} onChangeText={setFLoad} style={s.input} placeholder="20kg / livre" placeholderTextColor={Colors.textSecondary} />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={s.label}>DESCANSO (seg)</Text>
                  <TextInput value={fRest} onChangeText={setFRest} style={s.input} keyboardType="numeric" placeholder="60" placeholderTextColor={Colors.textSecondary} />
                </View>
              </View>
              <Text style={[s.label, { marginTop: 14 }]}>OBSERVAÇÕES</Text>
              <TextInput value={fNotes} onChangeText={setFNotes} style={[s.input, s.textArea]} multiline placeholder="Cadência, posição, dicas..." placeholderTextColor={Colors.textSecondary} />
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
                onPress={handleSaveItem} disabled={saving} activeOpacity={0.85}>
                {saving
                  ? <ActivityIndicator color={lightText ? '#000' : '#fff'} />
                  : <Text style={[s.saveBtnText, { color: lightText ? '#000' : '#fff' }]}>Salvar</Text>}
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
            <Text style={s.title}>Atribuir a Alunos</Text>
            <TouchableOpacity onPress={handleSaveAssign} disabled={savingAssign} style={s.iconBtn}>
              {savingAssign
                ? <ActivityIndicator color={primaryColor} />
                : <Text style={[s.saveText, { color: primaryColor }]}>Salvar</Text>}
            </TouchableOpacity>
          </View>
          {loadingAssign ? <ActivityIndicator color={primaryColor} style={{ marginTop: 40 }} /> : (
            <FlatList
              data={allStudents}
              keyExtractor={st => st.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 8 }}
              renderItem={({ item }) => {
                const isAssigned = assigned.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[s.studentRow, isAssigned && { borderColor: primaryColor, backgroundColor: `${primaryColor}08` }]}
                    onPress={() => setAssigned(prev => isAssigned ? prev.filter(s => s !== item.id) : [...prev, item.id])}
                    activeOpacity={0.75}>
                    <Text style={s.studentName}>{item.full_name}</Text>
                    <View style={[s.checkCircle, isAssigned && { backgroundColor: primaryColor, borderColor: primaryColor }]}>
                      {isAssigned && <Ionicons name="checkmark" size={14} color={lightText ? '#000' : '#fff'} />}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Exercise picker */}
      <ExercisePickerModal
        visible={pickerVisible} tenantId={tenantId}
        onSelect={handleAddExercise}
        onClose={() => setPickerVisible(false)}
      />
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
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, flex: 1, marginHorizontal: 8 },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 12 },
  planCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 20, gap: 12 },
  goalBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
  goalText: { fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  descText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  activateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1,
  },
  activateBtnText: {
    fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm,
    flexShrink: 1, textAlign: 'center',
  },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 10 },
  actionBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: Colors.textPrimary },
  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 10 },
  emptyRoutine: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  routineCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 10, overflow: 'hidden' },
  routineHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  routineIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  routineName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  routineMeta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  addExBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  itemsList: { borderTopWidth: 1, borderTopColor: Colors.border },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemThumb: { width: 40, height: 40, borderRadius: 8, marginRight: 4 },
  itemThumbPlaceholder: {
    width: 40, height: 40, borderRadius: 8, marginRight: 4,
    backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  itemMuscle: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, minWidth: 42, alignItems: 'center' },
  itemMuscleText: { fontFamily: FontFamily.bodyMedium, fontSize: 10 },
  itemName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  itemPrescription: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  addExPlaceholder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  addExPlaceholderText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },
  modalContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  label: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  daysRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dayBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  dayBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  row4: { flexDirection: 'row', gap: 10 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md },
  saveText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
  studentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  studentName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
});
