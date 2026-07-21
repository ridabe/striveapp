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
import { backToStudentHub } from '@/lib/studentNav';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { GOAL_COLORS, PLAN_GOALS, muscleColor, DAYS_OF_WEEK } from '@/lib/exerciseConfig';
import { ExercisePickerModal, ExerciseSummary } from '@/components/ExercisePickerModal';
import { groupByCombo, comboTypeLabel, comboTypeKey } from '@/lib/comboExercises';
import { GuideModal } from '@/components/guides/GuideModal';
import { useGuide } from '@/hooks/useGuide';
import { GUIDES } from '@/lib/guides';

function maskDate(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function dateToISO(masked: string): string | null {
  const d = masked.replace(/\D/g, '');
  if (d.length !== 8) return null;
  return `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}

function isoToMasked(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

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
  combo_group_id: string | null;
  combo_type: string | null;
  exercise: { name: string; muscle_group: string; video_url: string | null } | null;
}

interface Routine {
  id: string;
  name: string;
  days_of_week: number[] | null;
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
  const { primaryColor, primaryTextColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? '';
  const routineGuide = useGuide('routine_builder', profile?.id);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Expanded routine
  const [expandedRoutine, setExpandedRoutine] = useState<string | null>(null);
  const [editingDaysId, setEditingDaysId] = useState<string | null>(null);

  // Add routine modal
  const [routineModal, setRoutineModal] = useState(false);
  const [fRoutineName, setFRoutineName] = useState('');
  const [fRoutineDays, setFRoutineDays] = useState<number[]>([]);

  // Edit plan modal
  const [editPlanModal, setEditPlanModal] = useState(false);
  const [fEditName, setFEditName] = useState('');
  const [fEditGoal, setFEditGoal] = useState('');
  const [fEditDescription, setFEditDescription] = useState('');
  const [fEditStartDate, setFEditStartDate] = useState('');
  const [fEditEndDate, setFEditEndDate] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  // Exercise picker
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerRoutineId, setPickerRoutineId] = useState('');

  // Combine exercises into bi/tri-série
  const [combiningRoutineId, setCombiningRoutineId] = useState<string | null>(null);
  const [selectedForCombo, setSelectedForCombo] = useState<Set<string>>(new Set());

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
      supabase.from('workout_routines').select('id,name,days_of_week,display_order,notes').eq('workout_plan_id', id).order('display_order'),
    ]);
    const routineIds: string[] = (routinesRes.data ?? []).map((r: any) => r.id);
    const itemsRes = routineIds.length > 0
      ? await supabase.from('workout_items')
          .select('id,exercise_id,sets,reps,duration_secs,rest_seconds,load,count_type,display_order,notes,combo_group_id,combo_type,routine_id,exercises(name,muscle_group,video_url)')
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
      .select('id,exercise_id,sets,reps,duration_secs,rest_seconds,load,count_type,display_order,notes,combo_group_id,combo_type,routine_id,exercises(name,muscle_group,video_url)')
      .eq('tenant_id', tenantId)
      .in('routine_id', routines.map(r => r.id))
      .order('display_order');
    const allItems: any[] = itemsRes.data ?? [];
    setRoutines(prev => prev.map(r => ({
      ...r,
      items: allItems.filter(i => i.routine_id === r.id).map(i => ({ ...i, exercise: i.exercises })),
    })));
  }

  function openEditPlan() {
    if (!plan) return;
    setFEditName(plan.name);
    setFEditGoal(plan.goal ?? '');
    setFEditDescription(plan.description ?? '');
    setFEditStartDate(isoToMasked(plan.start_date));
    setFEditEndDate(isoToMasked(plan.end_date));
    setEditPlanModal(true);
  }

  async function handleSaveEditPlan() {
    if (!plan || !fEditName.trim()) { Alert.alert('Atenção', 'Informe o nome do plano.'); return; }
    setSavingPlan(true);
    const updates = {
      name: fEditName.trim(),
      goal: fEditGoal || null,
      description: fEditDescription.trim() || null,
      start_date: dateToISO(fEditStartDate),
      end_date: dateToISO(fEditEndDate),
    };
    const { error } = await supabase.from('workout_plans').update(updates).eq('id', id);
    setSavingPlan(false);
    if (error) { Alert.alert('Erro', error.message); return; }
    setPlan(p => p ? { ...p, ...updates } : p);
    setEditPlanModal(false);
  }

  async function handleToggleStatus() {
    if (!plan) return;
    const newStatus = plan.status === 'active' ? 'inactive' : 'active';
    await supabase.from('workout_plans').update({ status: newStatus }).eq('id', id);
    setPlan(p => p ? { ...p, status: newStatus } : p);
  }

  function handleDeletePlan() {
    if (!plan) return;
    Alert.alert(
      'Excluir plano',
      `Tem certeza que deseja excluir "${plan.name}"? Os alunos atribuídos serão desvinculados e todas as rotinas e exercícios deste plano serão removidos permanentemente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive', onPress: async () => {
            setDeleting(true);
            try {
              const routineIds = routines.map(r => r.id);
              if (routineIds.length > 0) {
                await supabase.from('workout_items').delete().in('routine_id', routineIds);
              }
              await supabase.from('student_plan_assignments').delete().eq('plan_id', id);
              await supabase.from('workout_routines').delete().eq('workout_plan_id', id);
              const { error } = await supabase.from('workout_plans').delete().eq('id', id);
              if (error) throw error;
              router.back();
            } catch (e: any) {
              setDeleting(false);
              Alert.alert('Erro', e.message);
            }
          },
        },
      ]
    );
  }

  async function handleAddRoutine() {
    if (!fRoutineName.trim()) { Alert.alert('Atenção', 'Informe o nome da rotina.'); return; }
    setSaving(true);
    const { error } = await supabase.from('workout_routines').insert({
      workout_plan_id: id,
      tenant_id: tenantId,
      name: fRoutineName.trim(),
      days_of_week: fRoutineDays.length ? fRoutineDays : null,
      display_order: routines.length,
    });
    setSaving(false);
    if (error) { Alert.alert('Erro', error.message); return; }
    setRoutineModal(false);
    setFRoutineName(''); setFRoutineDays([]);
    await load();
  }

  async function handleUpdateRoutineDays(routineId: string, days: number[]) {
    const daysOfWeek = days.length ? days : null;
    setRoutines(prev => prev.map(r => r.id === routineId ? { ...r, days_of_week: daysOfWeek } : r));
    await supabase.from('workout_routines').update({ days_of_week: daysOfWeek }).eq('id', routineId);
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

  async function handleAddExercises(exercises: ExerciseSummary[]) {
    setPickerVisible(false);
    if (!exercises.length) return;
    const currentItems = routines.find(r => r.id === pickerRoutineId)?.items ?? [];
    const rows = exercises.map((exercise, i) => ({
      routine_id: pickerRoutineId,
      tenant_id: tenantId,
      exercise_id: exercise.id,
      count_type: exercise.count_type,
      sets: exercise.default_sets ?? 3,
      reps: exercise.default_reps ?? '10-12',
      duration_secs: exercise.duration_secs ?? null,
      display_order: currentItems.length + i,
    }));
    const { error } = await supabase.from('workout_items').insert(rows);
    if (error) { Alert.alert('Erro', error.message); return; }
    await reloadItems();
  }

  async function handleDeleteItem(itemId: string) {
    await supabase.from('workout_items').delete().eq('id', itemId);
    await reloadItems();
  }

  /** Move um exercício uma posição para cima/baixo dentro do seu contexto (lista de soltos ou membros do mesmo combo), trocando o display_order com o vizinho. */
  async function handleMoveItem(context: WorkoutItem[], itemId: string, direction: 'up' | 'down') {
    const idx = context.findIndex(i => i.id === itemId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || swapIdx < 0 || swapIdx >= context.length) return;
    const a = context[idx];
    const b = context[swapIdx];
    const [aOrder, bOrder] = [a.display_order, b.display_order];

    setRoutines(prev => prev.map(r => ({
      ...r,
      items: r.items
        .map(it => {
          if (it.id === a.id) return { ...it, display_order: bOrder };
          if (it.id === b.id) return { ...it, display_order: aOrder };
          return it;
        })
        .sort((x, y) => x.display_order - y.display_order),
    })));

    const [resA, resB] = await Promise.all([
      supabase.from('workout_items').update({ display_order: bOrder }).eq('id', a.id),
      supabase.from('workout_items').update({ display_order: aOrder }).eq('id', b.id),
    ]);
    const error = resA.error ?? resB.error;
    if (error) { Alert.alert('Erro', error.message); await reloadItems(); }
  }

  /** Move um bloco inteiro (exercício solto ou combo/bi-série/tri-série completo) uma posição para cima/baixo,
   * renumerando o display_order de todos os itens da rotina para refletir a nova ordem de execução. */
  async function handleMoveBlock(routineId: string, blocks: { items: WorkoutItem[] }[], blockIdx: number, direction: 'up' | 'down') {
    const swapIdx = direction === 'up' ? blockIdx - 1 : blockIdx + 1;
    if (swapIdx < 0 || swapIdx >= blocks.length) return;
    const newBlocks = [...blocks];
    [newBlocks[blockIdx], newBlocks[swapIdx]] = [newBlocks[swapIdx], newBlocks[blockIdx]];
    const flat = newBlocks.flatMap(b => b.items);
    const orderMap = new Map(flat.map((it, idx) => [it.id, idx]));

    setRoutines(prev => prev.map(r => r.id !== routineId ? r : {
      ...r,
      items: r.items
        .map(it => ({ ...it, display_order: orderMap.get(it.id) ?? it.display_order }))
        .sort((a, b) => a.display_order - b.display_order),
    }));

    const results = await Promise.all(
      flat.map((it, idx) => supabase.from('workout_items').update({ display_order: idx }).eq('id', it.id))
    );
    const firstError = results.find(r => r.error)?.error;
    if (firstError) { Alert.alert('Erro', firstError.message); await reloadItems(); }
  }

  function toggleCombining(routineId: string) {
    if (combiningRoutineId === routineId) {
      setCombiningRoutineId(null);
      setSelectedForCombo(new Set());
    } else {
      setCombiningRoutineId(routineId);
      setSelectedForCombo(new Set());
    }
  }

  /** Abre o modo de seleção já com os membros da combinação existente marcados, para adicionar/trocar exercícios. */
  function handleEditCombo(routineId: string, comboGroupId: string) {
    const routine = routines.find(r => r.id === routineId);
    const memberIds = routine?.items.filter(it => it.combo_group_id === comboGroupId).map(it => it.id) ?? [];
    setCombiningRoutineId(routineId);
    setSelectedForCombo(new Set(memberIds));
  }

  function toggleComboItem(itemId: string) {
    setSelectedForCombo(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  async function handleGroupItems(routineId: string, explicitIds?: string[]) {
    const routine = routines.find(r => r.id === routineId);
    const ids = new Set(explicitIds ?? Array.from(selectedForCombo));
    if (!routine || ids.size < 2) return;
    const items = routine.items;
    const comboGroupId = items.find(it => ids.has(it.id))?.id;
    if (!comboGroupId) return;
    const comboType = comboTypeKey(ids.size);

    // Libera membros de combinações antigas que não foram re-selecionados desta vez
    // (permite recombinar/trocar exercícios de uma bi/tri-série já existente).
    const oldGroupIdsInvolved = new Set(
      items.filter(it => it.combo_group_id && ids.has(it.id)).map(it => it.combo_group_id!)
    );
    const toRelease = items.filter(it => it.combo_group_id && oldGroupIdsInvolved.has(it.combo_group_id) && !ids.has(it.id));

    // Reorder so the selected items become contiguous, starting where the first one sits.
    const newOrder: WorkoutItem[] = [];
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
      ...newOrder.map((it, idx) => supabase.from('workout_items').update({
        display_order: idx,
        ...(ids.has(it.id) ? { combo_group_id: comboGroupId, combo_type: comboType } : {}),
      }).eq('id', it.id)),
      ...toRelease.map(it => supabase.from('workout_items').update({ combo_group_id: null, combo_type: null }).eq('id', it.id)),
    ]);
    const firstError = results.find(r => r.error)?.error;
    if (firstError) { Alert.alert('Erro ao combinar', firstError.message); return; }

    setCombiningRoutineId(null);
    setSelectedForCombo(new Set());
    await reloadItems();
  }

  async function handleUngroupCombo(comboGroupId: string) {
    await supabase.from('workout_items').update({ combo_group_id: null, combo_type: null }).eq('combo_group_id', comboGroupId);
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
          <TouchableOpacity onPress={() => backToStudentHub(fromStudentId)} style={s.iconBtn}>
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
        <TouchableOpacity onPress={() => backToStudentHub(fromStudentId)} style={s.iconBtn}>
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
        <TouchableOpacity onPress={handleDeletePlan} disabled={deleting} style={s.iconBtn} activeOpacity={0.75}>
          {deleting
            ? <ActivityIndicator size="small" color={Colors.error} />
            : <Ionicons name="trash-outline" size={20} color={Colors.error} />}
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

          {(plan.start_date || plan.end_date) && (
            <Text style={s.descText}>
              {plan.start_date ? isoToMasked(plan.start_date) : '—'} → {plan.end_date ? isoToMasked(plan.end_date) : '—'}
            </Text>
          )}

          <TouchableOpacity onPress={openEditPlan} activeOpacity={0.7} style={s.editPlanLink}>
            <Ionicons name="pencil-outline" size={12} color={Colors.textSecondary} />
            <Text style={s.editPlanLinkText}>Editar informações</Text>
          </TouchableOpacity>

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
        <View style={s.sectionLabelRow}>
          <Text style={s.sectionLabel}>ROTINAS ({routines.length})</Text>
          <TouchableOpacity onPress={routineGuide.open} style={s.guideLink} activeOpacity={0.7}>
            <Ionicons name="help-circle-outline" size={14} color={primaryColor} />
            <Text style={[s.guideLinkText, { color: primaryColor }]}>Como montar?</Text>
          </TouchableOpacity>
        </View>

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
                    {routine.days_of_week?.length ? routine.days_of_week.map(d => DAYS_OF_WEEK[d]).join(', ') : 'Dia livre'} · {routine.items.length} exercício{routine.items.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setEditingDaysId(editingDaysId === routine.id ? null : routine.id)}
                  style={s.iconBtn} activeOpacity={0.75}>
                  <Ionicons name="calendar-outline" size={17} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  setPickerRoutineId(routine.id);
                  setPickerVisible(true);
                }} style={s.addExBtn} activeOpacity={0.75}>
                  <Ionicons name="add" size={18} color={primaryColor} />
                </TouchableOpacity>
                <View style={s.chevronHit}>
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
                </View>
              </TouchableOpacity>

              {/* Editor inline de dias da semana */}
              {editingDaysId === routine.id && (
                <View style={s.inlineDaysEditor}>
                  <View style={s.daysRow}>
                    {DAYS_OF_WEEK.map((d, i) => {
                      const active = routine.days_of_week?.includes(i) ?? false;
                      return (
                        <TouchableOpacity key={i}
                          style={[s.dayBtnSmall, active && { backgroundColor: primaryColor, borderColor: primaryColor }]}
                          onPress={() => {
                            const current = routine.days_of_week ?? [];
                            const next = active ? current.filter(x => x !== i) : [...current, i].sort();
                            handleUpdateRoutineDays(routine.id, next);
                          }}
                          activeOpacity={0.75}>
                          <Text style={[s.dayBtnText, active && { color: primaryTextColor }]}>{d}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={[s.freeDayBtn, !routine.days_of_week?.length && { backgroundColor: `${primaryColor}18`, borderColor: primaryColor }]}
                      onPress={() => handleUpdateRoutineDays(routine.id, [])}
                      activeOpacity={0.75}>
                      <Text style={[s.freeDayBtnText, !routine.days_of_week?.length && { color: primaryColor }]}>Dia livre</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

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

                  {routine.items.length >= 2 && (
                    <TouchableOpacity
                      style={[s.combineToolbarBtn, combiningRoutineId === routine.id && { backgroundColor: `${primaryColor}18`, borderColor: primaryColor }]}
                      onPress={() => toggleCombining(routine.id)} activeOpacity={0.75}>
                      <Ionicons name="git-merge-outline" size={16} color={primaryColor} />
                      <Text style={[s.combineToolbarBtnText, { color: primaryColor }]}>
                        {combiningRoutineId === routine.id ? 'Cancelar combinação' : 'Combinar exercícios em Bi-Série/Tri-Série'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {(() => {
                    const isCombining = combiningRoutineId === routine.id;
                    // Blocos na ordem real de display_order: exercícios soltos viram blocos de 1,
                    // exercícios de um mesmo combo (contíguos) viram um único bloco — assim dá para
                    // mover o combo inteiro (início/meio/fim) entre os exercícios individuais.
                    const comboReady = routine.items.map(it => ({ ...it, itemId: it.id, comboGroupId: it.combo_group_id }));
                    const blocks = groupByCombo(comboReady);

                    function renderRow(item: WorkoutItem, opts: {
                      badgeIndex?: number; borderBottom: boolean;
                      move: { canUp: boolean; canDown: boolean; onUp: () => void; onDown: () => void };
                    }) {
                      const isSelected = selectedForCombo.has(item.id);
                      return (
                        <TouchableOpacity
                          key={item.id}
                          disabled={!isCombining}
                          activeOpacity={isCombining ? 0.7 : 1}
                          onPress={() => toggleComboItem(item.id)}
                          style={[s.itemRow, opts.borderBottom && s.itemBorder, isCombining && isSelected && { backgroundColor: `${primaryColor}1f` }]}>
                          {isCombining && (
                            <Ionicons name={isSelected ? 'checkbox' : 'square-outline'} size={18} color={isSelected ? primaryColor : Colors.textSecondary} />
                          )}
                          {opts.badgeIndex != null && !isCombining && (
                            <View style={[s.comboIndexBadge, { borderColor: primaryColor }]}>
                              <Text style={[s.comboIndexBadgeText, { color: primaryColor }]}>{opts.badgeIndex}</Text>
                            </View>
                          )}
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
                          {!isCombining && (
                            <>
                              <View style={s.reorderCol}>
                                <TouchableOpacity
                                  onPress={opts.move.onUp}
                                  disabled={!opts.move.canUp} style={s.reorderBtn} activeOpacity={0.6}>
                                  <Ionicons name="chevron-up" size={16} color={opts.move.canUp ? primaryColor : Colors.border} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={opts.move.onDown}
                                  disabled={!opts.move.canDown} style={s.reorderBtn} activeOpacity={0.6}>
                                  <Ionicons name="chevron-down" size={16} color={opts.move.canDown ? primaryColor : Colors.border} />
                                </TouchableOpacity>
                              </View>
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
                        {blocks.map((block, blockIdx) => {
                          const canBlockUp = blockIdx > 0;
                          const canBlockDown = blockIdx < blocks.length - 1;

                          if (!block.isCombo) {
                            const item = block.items[0];
                            return renderRow(item, {
                              borderBottom: false,
                              move: {
                                canUp: canBlockUp,
                                canDown: canBlockDown,
                                onUp: () => handleMoveBlock(routine.id, blocks, blockIdx, 'up'),
                                onDown: () => handleMoveBlock(routine.id, blocks, blockIdx, 'down'),
                              },
                            });
                          }

                          return (
                            <View key={block.comboId ?? `combo-${blockIdx}`}
                              style={[s.comboWrap, { borderColor: primaryColor, backgroundColor: `${primaryColor}0f` }]}>
                              <View style={[s.comboHeader, { backgroundColor: `${primaryColor}22` }]}>
                                {!isCombining && (
                                  <View style={s.blockMoveCol}>
                                    <TouchableOpacity
                                      onPress={() => handleMoveBlock(routine.id, blocks, blockIdx, 'up')}
                                      disabled={!canBlockUp} style={s.reorderBtn} activeOpacity={0.6}>
                                      <Ionicons name="chevron-up" size={16} color={canBlockUp ? primaryColor : Colors.border} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      onPress={() => handleMoveBlock(routine.id, blocks, blockIdx, 'down')}
                                      disabled={!canBlockDown} style={s.reorderBtn} activeOpacity={0.6}>
                                      <Ionicons name="chevron-down" size={16} color={canBlockDown ? primaryColor : Colors.border} />
                                    </TouchableOpacity>
                                  </View>
                                )}
                                <Ionicons name="git-merge" size={14} color={primaryColor} />
                                <Text style={[s.comboLabel, { color: primaryColor }]}>{comboTypeLabel(block.items.length)} · {block.items.length} exercícios</Text>
                                {!isCombining && (
                                  <View style={s.comboHeaderActions}>
                                    <TouchableOpacity onPress={() => handleEditCombo(routine.id, block.comboId!)}
                                      style={s.comboHeaderActionBtn} activeOpacity={0.75}>
                                      <Ionicons name="swap-horizontal-outline" size={13} color={primaryColor} />
                                      <Text style={[s.comboHeaderActionText, { color: primaryColor }]}>Recombinar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleUngroupCombo(block.comboId!)}
                                      style={s.comboHeaderActionBtn} activeOpacity={0.75}>
                                      <Ionicons name="close-circle-outline" size={13} color={Colors.error} />
                                      <Text style={[s.comboHeaderActionText, { color: Colors.error }]}>Desagrupar</Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </View>
                              {block.items.map((item, memberIdx) => renderRow(item, {
                                badgeIndex: memberIdx + 1,
                                borderBottom: memberIdx < block.items.length - 1,
                                move: {
                                  canUp: memberIdx > 0,
                                  canDown: memberIdx < block.items.length - 1,
                                  onUp: () => handleMoveItem(block.items, item.id, 'up'),
                                  onDown: () => handleMoveItem(block.items, item.id, 'down'),
                                },
                              }))}
                            </View>
                          );
                        })}
                      </>
                    );
                  })()}
                  {combiningRoutineId === routine.id && selectedForCombo.size >= 2 && (
                    <TouchableOpacity
                      style={[s.groupConfirmBtn, { backgroundColor: primaryColor }]}
                      onPress={() => handleGroupItems(routine.id)} activeOpacity={0.85}>
                      <Ionicons name="checkmark" size={16} color={primaryTextColor} />
                      <Text style={[s.groupConfirmBtnText, { color: primaryTextColor }]}>
                        Agrupar em {comboTypeLabel(selectedForCombo.size)}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={s.deleteRoutineBtn} onPress={() => handleDeleteRoutine(routine.id)} activeOpacity={0.75}>
                    <Ionicons name="trash-outline" size={14} color={Colors.error} />
                    <Text style={s.deleteRoutineBtnText}>Remover rotina</Text>
                  </TouchableOpacity>
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
              <Text style={[s.label, { marginTop: 18 }]}>DIA(S) DA SEMANA (opcional)</Text>
              <Text style={s.helperText}>Selecione um ou mais dias, ou deixe como &quot;Dia livre&quot; para o aluno executar quando quiser.</Text>
              <View style={s.daysRow}>
                {DAYS_OF_WEEK.map((d, i) => {
                  const active = fRoutineDays.includes(i);
                  return (
                    <TouchableOpacity key={i}
                      style={[s.dayBtn, active && { backgroundColor: primaryColor, borderColor: primaryColor }]}
                      onPress={() => setFRoutineDays(prev => active ? prev.filter(x => x !== i) : [...prev, i].sort())}
                      activeOpacity={0.75}>
                      <Text style={[s.dayBtnText, active && { color: primaryTextColor }]}>{d}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[s.freeDayBtn, !fRoutineDays.length && { backgroundColor: `${primaryColor}18`, borderColor: primaryColor }]}
                  onPress={() => setFRoutineDays([])}
                  activeOpacity={0.75}>
                  <Text style={[s.freeDayBtnText, !fRoutineDays.length && { color: primaryColor }]}>Dia livre</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
                onPress={handleAddRoutine} disabled={saving} activeOpacity={0.85}>
                {saving
                  ? <ActivityIndicator color={primaryTextColor} />
                  : <Text style={[s.saveBtnText, { color: primaryTextColor }]}>Criar Rotina</Text>}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit plan modal */}
      <Modal visible={editPlanModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => !savingPlan && setEditPlanModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
              <TouchableOpacity onPress={() => !savingPlan && setEditPlanModal(false)} style={s.iconBtn}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={s.title}>Editar Plano</Text>
              <View style={{ width: 38 }} />
            </View>
            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>NOME DO PLANO</Text>
              <TextInput value={fEditName} onChangeText={setFEditName} style={s.input}
                placeholder="Ex: Plano Hipertrofia A" placeholderTextColor={Colors.textSecondary} />

              <Text style={[s.label, { marginTop: 18 }]}>OBJETIVO</Text>
              <View style={s.goalGrid}>
                {PLAN_GOALS.map(g => {
                  const goalColor = GOAL_COLORS[g];
                  return (
                    <TouchableOpacity key={g}
                      style={[s.goalBtn, fEditGoal === g && { borderColor: goalColor, backgroundColor: `${goalColor}15` }]}
                      onPress={() => setFEditGoal(g === fEditGoal ? '' : g)} activeOpacity={0.75}>
                      <Text style={[s.goalBtnText, fEditGoal === g && { color: goalColor }]}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[s.label, { marginTop: 18 }]}>DESCRIÇÃO / OBSERVAÇÕES</Text>
              <TextInput value={fEditDescription} onChangeText={setFEditDescription} style={[s.input, s.textArea]}
                multiline placeholder="Frequência semanal, restrições, observações..." placeholderTextColor={Colors.textSecondary} />

              <View style={s.row4}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, { marginTop: 18 }]}>INÍCIO</Text>
                  <TextInput value={fEditStartDate} onChangeText={t => setFEditStartDate(maskDate(t))} style={s.input}
                    keyboardType="numeric" placeholder="DD/MM/AAAA" placeholderTextColor={Colors.textSecondary} maxLength={10} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, { marginTop: 18 }]}>TÉRMINO</Text>
                  <TextInput value={fEditEndDate} onChangeText={t => setFEditEndDate(maskDate(t))} style={s.input}
                    keyboardType="numeric" placeholder="DD/MM/AAAA" placeholderTextColor={Colors.textSecondary} maxLength={10} />
                </View>
              </View>
              <Text style={s.helperText}>Início e término são opcionais — deixe em branco se o plano não tem duração definida.</Text>

              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: primaryColor }, savingPlan && { opacity: 0.6 }]}
                onPress={handleSaveEditPlan} disabled={savingPlan} activeOpacity={0.85}>
                {savingPlan
                  ? <ActivityIndicator color={primaryTextColor} />
                  : <Text style={[s.saveBtnText, { color: primaryTextColor }]}>Salvar</Text>
                }
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
                  ? <ActivityIndicator color={primaryTextColor} />
                  : <Text style={[s.saveBtnText, { color: primaryTextColor }]}>Salvar</Text>}
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
                      {isAssigned && <Ionicons name="checkmark" size={14} color={primaryTextColor} />}
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
        multiSelect
        onConfirm={handleAddExercises}
        onClose={() => setPickerVisible(false)}
      />

      <GuideModal
        visible={routineGuide.visible}
        content={GUIDES.routine_builder}
        onClose={routineGuide.close}
        onDismissForever={routineGuide.dismissForever}
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
  editPlanLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  editPlanLinkText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  goalBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: Colors.textSecondary },
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
  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  guideLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  guideLinkText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
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
  reorderCol: { alignItems: 'center', justifyContent: 'center' },
  reorderBtn: { width: 24, height: 16, alignItems: 'center', justifyContent: 'center' },
  blockMoveCol: { alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  combinedSection: { marginTop: 14, paddingHorizontal: 12, paddingBottom: 4, gap: 8 },
  combinedSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  combinedSectionTitle: { fontFamily: FontFamily.bodyBold, fontSize: 10.5, letterSpacing: 1, color: Colors.textSecondary },
  itemThumb: { width: 40, height: 40, borderRadius: 8, marginRight: 4 },
  itemThumbPlaceholder: {
    width: 40, height: 40, borderRadius: 8, marginRight: 4,
    backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  itemMuscle: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, minWidth: 42, alignItems: 'center' },
  itemMuscleText: { fontFamily: FontFamily.bodyMedium, fontSize: 10 },
  itemName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  itemPrescription: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
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
    borderRadius: 10, paddingVertical: 12, margin: 12,
  },
  groupConfirmBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
  chevronHit: { paddingLeft: 10, paddingVertical: 4 },
  combineToolbarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingVertical: 11, marginHorizontal: 12, marginTop: 12,
  },
  combineToolbarBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 12.5, textAlign: 'center' },
  deleteRoutineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 12, marginTop: 16, marginBottom: 4, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  deleteRoutineBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 12.5, color: Colors.error },
  addExPlaceholder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  addExPlaceholderText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },
  modalContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  label: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  daysRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  dayBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  dayBtnSmall: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  dayBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  freeDayBtn: { paddingHorizontal: 12, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  freeDayBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  helperText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginBottom: 10 },
  inlineDaysEditor: { paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  row4: { flexDirection: 'row', gap: 10 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md },
  saveText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
  studentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  studentName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
});
