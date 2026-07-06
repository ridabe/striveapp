import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Modal, TextInput, Alert, Image, FlatList,
  KeyboardAvoidingView, Platform, Switch, LayoutAnimation,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { ExercisePickerModal, type ExerciseSummary } from '@/components/ExercisePickerModal';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Challenge {
  id: string; name: string; description: string | null; rules: string | null; prizes: string | null;
  duration_days: number; release_mode: string; status: string; cover_image_url: string | null;
  show_results_to_students: boolean;
}
interface Participant {
  id: string; student_id: string; full_name: string; email: string | null;
  initial_age: number | null; initial_weight: number | null; initial_body_fat: number | null;
  initial_arm: number | null; initial_chest: number | null; initial_waist: number | null; initial_hip: number | null; initial_thigh: number | null;
  final_weight: number | null; final_body_fat: number | null;
  final_arm: number | null; final_chest: number | null; final_waist: number | null; final_hip: number | null; final_thigh: number | null;
  final_notes: string | null; result_rank: number | null; result_delta_pp: number | null;
}
interface DayItem {
  id: string; item_type: string; title: string; content: string | null; exercise_id: string | null;
  exercise_name?: string | null; file_url: string | null; sort_order: number;
}
interface Day {
  id: string; day_number: number; title: string | null; status: string; items: DayItem[];
}
interface StudentOption { id: string; full_name: string; email: string | null }

const ITEM_TYPES = [
  { key: 'exercise', label: 'Exercício', icon: 'barbell-outline' },
  { key: 'reading',  label: 'Leitura',   icon: 'book-outline' },
  { key: 'tip',      label: 'Recado',    icon: 'chatbubble-ellipses-outline' },
  { key: 'file',     label: 'Arquivo',   icon: 'document-attach-outline' },
] as const;

function itemIcon(type: string) {
  return ITEM_TYPES.find(t => t.key === type)?.icon ?? 'ellipse-outline';
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthStore();
  const { primaryColor, primaryTextColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? '';

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [messages, setMessages] = useState<{ id: string; message: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Edit modal
  const [editVisible, setEditVisible] = useState(false);
  const [eName, setEName] = useState('');
  const [eDescription, setEDescription] = useState('');
  const [eRules, setERules] = useState('');
  const [ePrizes, setEPrizes] = useState('');
  const [eDuration, setEDuration] = useState('');
  const [eReleaseMode, setEReleaseMode] = useState<'progressive' | 'all_at_once'>('progressive');

  // Cover
  const [uploadingCover, setUploadingCover] = useState(false);

  // Add participant modal
  const [participantModal, setParticipantModal] = useState(false);
  const [participantTab, setParticipantTab] = useState<'existing' | 'invite'>('existing');
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [pickedStudentId, setPickedStudentId] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [pAge, setPAge] = useState('');
  const [pWeight, setPWeight] = useState('');
  const [pBodyFat, setPBodyFat] = useState('');

  // Final data modal
  const [finalModalParticipant, setFinalModalParticipant] = useState<Participant | null>(null);
  const [fWeight, setFWeight] = useState('');
  const [fBodyFat, setFBodyFat] = useState('');
  const [fNotes, setFNotes] = useState('');

  // Day modal
  const [dayModal, setDayModal] = useState(false);
  const [dTitle, setDTitle] = useState('');

  // Item modal
  const [itemModalDay, setItemModalDay] = useState<Day | null>(null);
  const [itemType, setItemType] = useState<typeof ITEM_TYPES[number]['key']>('exercise');
  const [itemTitle, setItemTitle] = useState('');
  const [itemContent, setItemContent] = useState('');
  const [itemFileUrl, setItemFileUrl] = useState('');
  const [itemExercise, setItemExercise] = useState<ExerciseSummary | null>(null);
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);

  // Publish results modal
  const [publishModal, setPublishModal] = useState(false);
  const [showResults, setShowResults] = useState(true);

  // Messages
  const [newMessage, setNewMessage] = useState('');

  const load = useCallback(async () => {
    if (!id || !tenantId) return;
    const [challengeRes, participantsRes, daysRes, itemsRes, messagesRes] = await Promise.all([
      supabase.from('challenges').select('*').eq('id', id).single(),
      supabase.from('challenge_participants').select('*, students(full_name, email)').eq('challenge_id', id),
      supabase.from('challenge_days').select('id, day_number, title, status').eq('challenge_id', id).order('day_number'),
      supabase.from('challenge_day_items').select('id, challenge_day_id, item_type, title, content, exercise_id, file_url, sort_order, exercises(name)')
        .in('challenge_day_id',
          (await supabase.from('challenge_days').select('id').eq('challenge_id', id)).data?.map((d: any) => d.id) ?? []),
      supabase.from('challenge_messages').select('id, message, created_at').eq('challenge_id', id).order('created_at', { ascending: false }),
    ]);

    setChallenge(challengeRes.data as any);
    setParticipants((participantsRes.data ?? []).map((p: any) => ({
      ...p, full_name: p.students?.full_name ?? 'Aluno', email: p.students?.email ?? null,
    })));

    const allItems: any[] = itemsRes.data ?? [];
    setDays((daysRes.data ?? []).map((d: any) => ({
      ...d,
      items: allItems
        .filter(i => i.challenge_day_id === d.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(i => ({ ...i, exercise_name: i.exercises?.name ?? null })),
    })));
    setMessages(messagesRes.data ?? []);
    setLoading(false);
  }, [id, tenantId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Edit challenge ──
  function openEdit() {
    if (!challenge) return;
    setEName(challenge.name);
    setEDescription(challenge.description ?? '');
    setERules(challenge.rules ?? '');
    setEPrizes(challenge.prizes ?? '');
    setEDuration(String(challenge.duration_days));
    setEReleaseMode(challenge.release_mode as any);
    setEditVisible(true);
  }

  async function handleSaveEdit() {
    if (!challenge || !eName.trim()) { Alert.alert('Atenção', 'Informe o nome do desafio.'); return; }
    const duration = parseInt(eDuration, 10);
    if (!duration || duration <= 0) { Alert.alert('Atenção', 'Duração inválida.'); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from('challenges').update({
        name: eName.trim(), description: eDescription.trim() || null,
        rules: eRules.trim() || null, prizes: ePrizes.trim() || null,
        duration_days: duration, release_mode: eReleaseMode,
      } as any).eq('id', challenge.id);
      if (error) throw error;
      setEditVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleDelete() {
    if (!challenge) return;
    if (challenge.status === 'active') {
      Alert.alert(
        'Não é possível excluir',
        'Este desafio está em andamento. Finalize o desafio antes de excluí-lo.',
      );
      return;
    }
    Alert.alert('Excluir desafio?', 'Isso remove participantes, dias, itens, progresso e mensagens. Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('challenges').delete().eq('id', challenge.id);
          if (error) { Alert.alert('Erro', error.message); return; }
          router.back();
        },
      },
    ]);
  }

  // ── Lifecycle actions ──
  async function handleStart() {
    if (!challenge) return;
    if (participants.length === 0) { Alert.alert('Atenção', 'Adicione ao menos 1 participante antes de iniciar.'); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from('challenges')
        .update({ status: 'active', start_date: new Date().toISOString().slice(0, 10) } as any)
        .eq('id', challenge.id);
      if (error) throw error;
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleFinish() {
    if (!challenge) return;
    Alert.alert('Finalizar desafio?', 'O ranking será calculado com base nos dados de peso/gordura preenchidos. O resultado ainda não fica visível ao aluno até você publicar.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Finalizar', onPress: async () => {
          setBusy(true);
          try {
            const ranked = participants
              .filter(p => p.initial_body_fat != null && p.final_body_fat != null)
              .map(p => ({ ...p, delta: (p.initial_body_fat as number) - (p.final_body_fat as number) }))
              .sort((a, b) => b.delta - a.delta);

            await Promise.all([
              ...ranked.map((p, idx) => supabase.from('challenge_participants')
                .update({ result_rank: idx + 1, result_delta_pp: p.delta } as any)
                .eq('id', p.id)),
              ...participants
                .filter(p => p.initial_body_fat == null || p.final_body_fat == null)
                .map(p => supabase.from('challenge_participants')
                  .update({ result_rank: null, result_delta_pp: null } as any)
                  .eq('id', p.id)),
            ]);

            const { error } = await supabase.from('challenges').update({ status: 'finished' } as any).eq('id', challenge.id);
            if (error) throw error;
            await load();
          } catch (e: any) {
            Alert.alert('Erro', e.message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  async function handlePublishResults() {
    if (!challenge) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('challenges').update({
        status: 'published', show_results_to_students: showResults, results_published_at: new Date().toISOString(),
      } as any).eq('id', challenge.id);
      if (error) throw error;
      setPublishModal(false);
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setBusy(false);
    }
  }

  // ── Cover ──
  async function pickCover() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para alterar a capa.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1200, 630], quality: 0.85,
    });
    if (result.canceled || !result.assets[0] || !challenge) return;
    setUploadingCover(true);
    try {
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = uri.toLowerCase().includes('.png') ? 'png' : 'jpg';
      const path = `${tenantId}/${challenge.id}.${ext}`;
      const { error } = await supabase.storage.from('challenge-covers')
        .upload(path, blob, { contentType: ext === 'png' ? 'image/png' : 'image/jpeg', upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('challenge-covers').getPublicUrl(path);
      const finalUrl = `${urlData.publicUrl}?v=${Date.now()}`;
      await supabase.from('challenges').update({ cover_image_url: finalUrl } as any).eq('id', challenge.id);
      await load();
    } catch (e: any) {
      Alert.alert('Erro', `Falha ao enviar a capa: ${e.message}`);
    } finally {
      setUploadingCover(false);
    }
  }

  async function removeCover() {
    if (!challenge) return;
    await supabase.from('challenges').update({ cover_image_url: null } as any).eq('id', challenge.id);
    await load();
  }

  // ── Participants ──
  async function openParticipantModal() {
    setParticipantTab('existing');
    setPickedStudentId(null);
    setInviteName(''); setInviteEmail('');
    setPAge(''); setPWeight(''); setPBodyFat('');
    const existingIds = new Set(participants.map(p => p.student_id));
    const { data } = await supabase.from('students').select('id, full_name, email').eq('tenant_id', tenantId).order('full_name');
    setStudentOptions((data ?? []).filter((s: any) => !existingIds.has(s.id)));
    setParticipantModal(true);
  }

  async function handleAddParticipant() {
    if (!challenge) return;
    const initialData = {
      initial_age: pAge ? parseInt(pAge, 10) : null,
      initial_weight: pWeight ? parseFloat(pWeight.replace(',', '.')) : null,
      initial_body_fat: pBodyFat ? parseFloat(pBodyFat.replace(',', '.')) : null,
    };
    setBusy(true);
    try {
      let studentId = pickedStudentId;

      if (participantTab === 'invite') {
        if (!inviteName.trim() || !inviteEmail.trim()) {
          Alert.alert('Atenção', 'Informe nome e email do novo participante.');
          setBusy(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke('invite-student', {
          body: { full_name: inviteName.trim(), email: inviteEmail.trim().toLowerCase() },
        });
        if (error) {
          let msg = error.message;
          try { const body = await (error as any).context?.json?.(); if (body?.error) msg = body.error; } catch {}
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);
        studentId = data.studentId;
      }

      if (!studentId) { Alert.alert('Atenção', 'Selecione um aluno existente ou convide um novo.'); setBusy(false); return; }

      const { error } = await supabase.from('challenge_participants').insert({
        tenant_id: tenantId, challenge_id: challenge.id, student_id: studentId, ...initialData,
      } as any);
      if (error) throw error;
      setParticipantModal(false);
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleRemoveParticipant(participant: Participant) {
    if (!challenge || challenge.status !== 'draft') {
      Alert.alert('Não é possível remover', 'Só é possível remover participantes enquanto o desafio está em rascunho.');
      return;
    }
    Alert.alert('Remover participante?', `${participant.full_name} será removido do desafio.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: async () => {
          await supabase.from('challenge_participants').delete().eq('id', participant.id);
          await load();
        },
      },
    ]);
  }

  function openFinalModal(participant: Participant) {
    setFinalModalParticipant(participant);
    setFWeight(participant.final_weight != null ? String(participant.final_weight) : '');
    setFBodyFat(participant.final_body_fat != null ? String(participant.final_body_fat) : '');
    setFNotes(participant.final_notes ?? '');
  }

  async function handleSaveFinalData() {
    if (!finalModalParticipant) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('challenge_participants').update({
        final_weight: fWeight ? parseFloat(fWeight.replace(',', '.')) : null,
        final_body_fat: fBodyFat ? parseFloat(fBodyFat.replace(',', '.')) : null,
        final_notes: fNotes.trim() || null,
      } as any).eq('id', finalModalParticipant.id);
      if (error) throw error;
      setFinalModalParticipant(null);
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setBusy(false);
    }
  }

  // ── Days & items ──
  async function handleCreateDay() {
    if (!challenge) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('challenge_days').insert({
        tenant_id: tenantId, challenge_id: challenge.id,
        day_number: days.length + 1, title: dTitle.trim() || null, status: 'draft',
      } as any);
      if (error) throw error;
      setDayModal(false);
      setDTitle('');
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleDeleteDay(day: Day) {
    Alert.alert('Excluir dia?', `Dia ${day.day_number} e seus itens serão removidos.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          await supabase.from('challenge_day_items').delete().eq('challenge_day_id', day.id);
          await supabase.from('challenge_days').delete().eq('id', day.id);
          await load();
        },
      },
    ]);
  }

  async function handlePublishDay(day: Day) {
    await supabase.from('challenge_days').update({ status: 'published' } as any).eq('id', day.id);
    await load();
  }

  async function handlePublishAllDays() {
    if (!challenge) return;
    Alert.alert('Publicar todos os dias?', 'Todos os dias em rascunho ficarão visíveis aos participantes.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Publicar', onPress: async () => {
          await supabase.from('challenge_days').update({ status: 'published' } as any).eq('challenge_id', challenge.id);
          await load();
        },
      },
    ]);
  }

  function toggleDay(dayId: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayId)) next.delete(dayId); else next.add(dayId);
      return next;
    });
  }

  function openItemModal(day: Day) {
    setItemModalDay(day);
    setItemType('exercise');
    setItemTitle(''); setItemContent(''); setItemFileUrl(''); setItemExercise(null);
  }

  async function handleAddItem() {
    if (!itemModalDay || !challenge) return;
    if (itemType === 'exercise' && !itemExercise) { Alert.alert('Atenção', 'Selecione um exercício.'); return; }
    if (itemType !== 'exercise' && !itemTitle.trim()) { Alert.alert('Atenção', 'Informe um título.'); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from('challenge_day_items').insert({
        tenant_id: tenantId, challenge_day_id: itemModalDay.id, item_type: itemType,
        title: itemType === 'exercise' ? (itemExercise?.name ?? '') : itemTitle.trim(),
        content: itemContent.trim() || null,
        exercise_id: itemType === 'exercise' ? itemExercise?.id ?? null : null,
        file_url: itemType === 'file' ? (itemFileUrl.trim() || null) : null,
        sort_order: itemModalDay.items.length,
      } as any);
      if (error) throw error;
      setItemModalDay(null);
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleDeleteItem(item: DayItem) {
    Alert.alert('Excluir item?', item.title, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          await supabase.from('challenge_day_items').delete().eq('id', item.id);
          await load();
        },
      },
    ]);
  }

  // ── Messages ──
  async function handleSendMessage() {
    if (!challenge || !newMessage.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('challenge_messages').insert({
        tenant_id: tenantId, challenge_id: challenge.id, message: newMessage.trim(),
      } as any);
      if (error) throw error;
      setNewMessage('');
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setBusy(false);
    }
  }

  // ── Derived ──
  const publishedItemCount = days.filter(d => d.status === 'published').reduce((sum, d) => sum + d.items.length, 0);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      if (!challenge || participants.length === 0 || publishedItemCount === 0) { setProgressMap({}); return; }
      const publishedItemIds = days.filter(d => d.status === 'published').flatMap(d => d.items.map(i => i.id));
      const { data } = await supabase.from('challenge_item_progress')
        .select('participant_id, challenge_day_item_id')
        .in('participant_id', participants.map(p => p.id));
      const map: Record<string, number> = {};
      participants.forEach(p => {
        const done = (data ?? []).filter((r: any) => r.participant_id === p.id && publishedItemIds.includes(r.challenge_day_item_id)).length;
        map[p.id] = publishedItemCount > 0 ? Math.round((done / publishedItemCount) * 100) : 0;
      });
      setProgressMap(map);
    })();
  }, [challenge, participants, publishedItemCount, days]);

  if (loading || !challenge) {
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

  const st = STATUS_LABEL[challenge.status] ?? STATUS_LABEL.draft;
  const canDelete = challenge.status !== 'active';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{challenge.name}</Text>
        <TouchableOpacity onPress={openEdit} style={s.iconBtn}>
          <Ionicons name="create-outline" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={s.iconBtn}>
          <Ionicons name="trash-outline" size={20} color={canDelete ? Colors.error : Colors.border} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Status + action */}
        <View style={s.statusRow}>
          <View style={[s.statusPill, { backgroundColor: `${st.color}20` }]}>
            <Text style={[s.statusPillText, { color: st.color }]}>{st.label}</Text>
          </View>
          {challenge.status === 'draft' && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: primaryColor }]} onPress={handleStart} disabled={busy}>
              <Ionicons name="play" size={14} color={primaryTextColor} />
              <Text style={[s.actionBtnText, { color: primaryTextColor }]}>Iniciar Desafio</Text>
            </TouchableOpacity>
          )}
          {challenge.status === 'active' && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#F59E0B' }]} onPress={handleFinish} disabled={busy}>
              <Ionicons name="flag" size={14} color="#000" />
              <Text style={[s.actionBtnText, { color: '#000' }]}>Finalizar Desafio</Text>
            </TouchableOpacity>
          )}
          {challenge.status === 'finished' && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#60A5FA' }]} onPress={() => { setShowResults(challenge.show_results_to_students); setPublishModal(true); }} disabled={busy}>
              <Ionicons name="megaphone" size={14} color="#000" />
              <Text style={[s.actionBtnText, { color: '#000' }]}>Publicar Resultados</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Cover */}
        <View style={s.coverCard}>
          {challenge.cover_image_url ? (
            <Image source={{ uri: challenge.cover_image_url }} style={s.coverImg} resizeMode="cover" />
          ) : (
            <View style={[s.coverImg, s.coverPlaceholder]}>
              <Ionicons name="image-outline" size={32} color={Colors.border} />
            </View>
          )}
          <View style={s.coverActions}>
            <TouchableOpacity style={s.coverBtn} onPress={pickCover} disabled={uploadingCover}>
              {uploadingCover ? <ActivityIndicator size="small" color={primaryColor} /> : (
                <>
                  <Ionicons name="camera-outline" size={14} color={primaryColor} />
                  <Text style={[s.coverBtnText, { color: primaryColor }]}>{challenge.cover_image_url ? 'Trocar capa' : 'Adicionar capa'}</Text>
                </>
              )}
            </TouchableOpacity>
            {challenge.cover_image_url && (
              <TouchableOpacity style={s.coverBtn} onPress={removeCover}>
                <Ionicons name="trash-outline" size={14} color={Colors.error} />
                <Text style={[s.coverBtnText, { color: Colors.error }]}>Remover</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Description/rules/prizes */}
        {(challenge.description || challenge.rules || challenge.prizes) && (
          <View style={s.infoCard}>
            {challenge.description && <InfoBlock label="DESCRIÇÃO" text={challenge.description} />}
            {challenge.rules && <InfoBlock label="REGRAS" text={challenge.rules} />}
            {challenge.prizes && <InfoBlock label="PREMIAÇÕES" text={challenge.prizes} />}
          </View>
        )}

        {/* Participants */}
        <SectionHeader title={`PARTICIPANTES (${participants.length})`} onAdd={openParticipantModal} />
        {participants.length === 0 ? (
          <Text style={s.emptyHint}>Nenhum participante ainda.</Text>
        ) : participants.map(p => (
          <View key={p.id} style={s.participantCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.participantName}>{p.full_name}</Text>
              <Text style={s.participantMeta}>
                {p.initial_body_fat != null ? `Inicial: ${p.initial_body_fat}% gordura` : 'Sem dados iniciais'}
                {p.final_body_fat != null ? ` · Final: ${p.final_body_fat}%` : ''}
                {p.result_rank != null ? ` · #${p.result_rank}` : ''}
              </Text>
            </View>
            {(challenge.status === 'active' || challenge.status === 'finished') && (
              <TouchableOpacity style={s.smallBtn} onPress={() => openFinalModal(p)}>
                <Text style={[s.smallBtnText, { color: primaryColor }]}>Dados finais</Text>
              </TouchableOpacity>
            )}
            {challenge.status === 'draft' && (
              <TouchableOpacity style={s.iconBtnSmall} onPress={() => handleRemoveParticipant(p)}>
                <Ionicons name="close-circle-outline" size={20} color={Colors.error} />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Days */}
        <SectionHeader title={`DIAS DO DESAFIO (${days.length})`} onAdd={() => setDayModal(true)} />
        {days.length > 0 && days.some(d => d.status === 'draft') && (
          <TouchableOpacity style={[s.publishAllBtn, { borderColor: primaryColor }]} onPress={handlePublishAllDays}>
            <Ionicons name="megaphone-outline" size={14} color={primaryColor} />
            <Text style={[s.publishAllText, { color: primaryColor }]}>Publicar Todos</Text>
          </TouchableOpacity>
        )}
        {days.length === 0 ? (
          <Text style={s.emptyHint}>Nenhum dia criado ainda.</Text>
        ) : days.map(day => {
          const expanded = expandedDays.has(day.id);
          return (
            <View key={day.id} style={s.dayCard}>
              <TouchableOpacity style={s.dayHeader} onPress={() => toggleDay(day.id)} activeOpacity={0.75}>
                <View style={[s.dayBadge, day.status === 'published' && { backgroundColor: `${primaryColor}20` }]}>
                  <Text style={[s.dayBadgeText, day.status === 'published' && { color: primaryColor }]}>{day.day_number}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.dayTitle}>{day.title || `Dia ${day.day_number}`}</Text>
                  <Text style={s.dayMeta}>{day.items.length} item(ns) · {day.status === 'published' ? 'Publicado' : 'Rascunho'}</Text>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
              </TouchableOpacity>

              {expanded && (
                <View style={s.dayBody}>
                  {day.items.map(item => (
                    <View key={item.id} style={s.itemRow}>
                      <Ionicons name={itemIcon(item.item_type) as any} size={16} color={Colors.textSecondary} />
                      <Text style={s.itemTitle} numberOfLines={1}>{item.exercise_name || item.title}</Text>
                      <TouchableOpacity onPress={() => handleDeleteItem(item)}>
                        <Ionicons name="close" size={16} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={s.dayFooter}>
                    <TouchableOpacity style={s.smallBtn} onPress={() => openItemModal(day)}>
                      <Ionicons name="add" size={14} color={primaryColor} />
                      <Text style={[s.smallBtnText, { color: primaryColor }]}>Adicionar item</Text>
                    </TouchableOpacity>
                    {day.status === 'draft' && (
                      <TouchableOpacity style={s.smallBtn} onPress={() => handlePublishDay(day)}>
                        <Ionicons name="megaphone-outline" size={14} color={primaryColor} />
                        <Text style={[s.smallBtnText, { color: primaryColor }]}>Publicar dia</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={s.smallBtn} onPress={() => handleDeleteDay(day)}>
                      <Ionicons name="trash-outline" size={14} color={Colors.error} />
                      <Text style={[s.smallBtnText, { color: Colors.error }]}>Excluir dia</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* Tracking */}
        {challenge.status !== 'draft' && participants.length > 0 && (
          <>
            <SectionHeader title="ACOMPANHAMENTO" />
            {[...participants].sort((a, b) => (progressMap[b.id] ?? 0) - (progressMap[a.id] ?? 0)).map(p => {
              const pct = progressMap[p.id] ?? 0;
              const color = pct >= 70 ? '#4ADE80' : pct >= 35 ? '#F59E0B' : '#EF4444';
              return (
                <View key={p.id} style={s.trackRow}>
                  <Text style={s.trackName} numberOfLines={1}>{p.full_name}</Text>
                  <View style={s.trackBarBg}>
                    <View style={[s.trackBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                  </View>
                  <Text style={[s.trackPct, { color }]}>{pct}%</Text>
                </View>
              );
            })}
          </>
        )}

        {/* Messages */}
        <SectionHeader title="DICAS PARA OS PARTICIPANTES" />
        <View style={s.messageInputRow}>
          <TextInput
            style={s.messageInput} value={newMessage} onChangeText={setNewMessage}
            placeholder="Escreva uma dica ou recado..." placeholderTextColor={Colors.textSecondary}
            multiline
          />
          <TouchableOpacity style={[s.sendBtn, { backgroundColor: primaryColor }]} onPress={handleSendMessage} disabled={busy || !newMessage.trim()}>
            <Ionicons name="send" size={16} color={primaryTextColor} />
          </TouchableOpacity>
        </View>
        {messages.map(m => (
          <View key={m.id} style={s.messageCard}>
            <Text style={s.messageText}>{m.message}</Text>
            <Text style={s.messageDate}>{new Date(m.created_at).toLocaleString('pt-BR')}</Text>
          </View>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Edit modal ── */}
      <Modal visible={editVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !busy && setEditVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={s.safe} edges={['top']}>
            <ModalHeader title="Editar Desafio" onClose={() => setEditVisible(false)} busy={busy} />
            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <Field label="NOME"><TextInput value={eName} onChangeText={setEName} style={s.input} placeholderTextColor={Colors.textSecondary} /></Field>
              <Field label="DURAÇÃO (DIAS)"><TextInput value={eDuration} onChangeText={setEDuration} style={s.input} keyboardType="number-pad" placeholderTextColor={Colors.textSecondary} /></Field>
              <Field label="DESCRIÇÃO"><TextInput value={eDescription} onChangeText={setEDescription} style={[s.input, s.textArea]} multiline placeholderTextColor={Colors.textSecondary} /></Field>
              <Field label="REGRAS"><TextInput value={eRules} onChangeText={setERules} style={[s.input, s.textArea]} multiline placeholderTextColor={Colors.textSecondary} /></Field>
              <Field label="PREMIAÇÕES"><TextInput value={ePrizes} onChangeText={setEPrizes} style={[s.input, s.textArea]} multiline placeholderTextColor={Colors.textSecondary} /></Field>
              <TouchableOpacity style={[s.saveBtn, { backgroundColor: primaryColor }, busy && { opacity: 0.6 }]} onPress={handleSaveEdit} disabled={busy}>
                {busy ? <ActivityIndicator color={primaryTextColor} /> : <Text style={[s.saveBtnText, { color: primaryTextColor }]}>Salvar</Text>}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add participant modal ── */}
      <Modal visible={participantModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !busy && setParticipantModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={s.safe} edges={['top']}>
            <ModalHeader title="Adicionar Participante" onClose={() => setParticipantModal(false)} busy={busy} />
            <View style={s.tabs}>
              {(['existing', 'invite'] as const).map(t => (
                <TouchableOpacity key={t} style={[s.tabBtn, participantTab === t && { borderBottomColor: primaryColor }]} onPress={() => setParticipantTab(t)}>
                  <Text style={[s.tabText, participantTab === t && { color: primaryColor }]}>{t === 'existing' ? 'Aluno existente' : 'Convidar novo'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              {participantTab === 'existing' ? (
                <View style={{ gap: 8, marginBottom: 8 }}>
                  {studentOptions.length === 0 ? (
                    <Text style={s.emptyHint}>Todos os alunos já participam ou você não tem alunos cadastrados.</Text>
                  ) : studentOptions.map(opt => (
                    <TouchableOpacity
                      key={opt.id}
                      style={[s.studentRow, pickedStudentId === opt.id && { borderColor: primaryColor, backgroundColor: `${primaryColor}12` }]}
                      onPress={() => setPickedStudentId(opt.id)}
                    >
                      <Ionicons name={pickedStudentId === opt.id ? 'radio-button-on' : 'radio-button-off'} size={18} color={pickedStudentId === opt.id ? primaryColor : Colors.textSecondary} />
                      <Text style={s.studentRowText}>{opt.full_name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <>
                  <Field label="NOME"><TextInput value={inviteName} onChangeText={setInviteName} style={s.input} placeholder="Nome completo" placeholderTextColor={Colors.textSecondary} /></Field>
                  <Field label="EMAIL"><TextInput value={inviteEmail} onChangeText={setInviteEmail} style={s.input} keyboardType="email-address" autoCapitalize="none" placeholder="email@exemplo.com" placeholderTextColor={Colors.textSecondary} /></Field>
                  <View style={s.info}>
                    <Ionicons name="information-circle-outline" size={14} color={Colors.textSecondary} />
                    <Text style={s.infoText}>Um convite com senha provisória será enviado por email. A partir daí, essa pessoa passa a ser aluno permanente.</Text>
                  </View>
                </>
              )}

              <Text style={[s.label, { marginTop: 18 }]}>DADOS INICIAIS (OPCIONAL)</Text>
              <View style={s.row3}>
                <Field label="IDADE" flex><TextInput value={pAge} onChangeText={setPAge} style={s.input} keyboardType="number-pad" placeholderTextColor={Colors.textSecondary} /></Field>
                <Field label="PESO (KG)" flex><TextInput value={pWeight} onChangeText={setPWeight} style={s.input} keyboardType="decimal-pad" placeholderTextColor={Colors.textSecondary} /></Field>
                <Field label="% GORDURA" flex><TextInput value={pBodyFat} onChangeText={setPBodyFat} style={s.input} keyboardType="decimal-pad" placeholderTextColor={Colors.textSecondary} /></Field>
              </View>

              <TouchableOpacity style={[s.saveBtn, { backgroundColor: primaryColor }, busy && { opacity: 0.6 }]} onPress={handleAddParticipant} disabled={busy}>
                {busy ? <ActivityIndicator color={primaryTextColor} /> : <Text style={[s.saveBtnText, { color: primaryTextColor }]}>Adicionar</Text>}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Final data modal ── */}
      <Modal visible={!!finalModalParticipant} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !busy && setFinalModalParticipant(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={s.safe} edges={['top']}>
            <ModalHeader title={`Dados finais — ${finalModalParticipant?.full_name ?? ''}`} onClose={() => setFinalModalParticipant(null)} busy={busy} />
            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <View style={s.row3}>
                <Field label="PESO (KG)" flex><TextInput value={fWeight} onChangeText={setFWeight} style={s.input} keyboardType="decimal-pad" placeholderTextColor={Colors.textSecondary} /></Field>
                <Field label="% GORDURA" flex><TextInput value={fBodyFat} onChangeText={setFBodyFat} style={s.input} keyboardType="decimal-pad" placeholderTextColor={Colors.textSecondary} /></Field>
              </View>
              <Field label="OBSERVAÇÕES FINAIS"><TextInput value={fNotes} onChangeText={setFNotes} style={[s.input, s.textArea]} multiline placeholderTextColor={Colors.textSecondary} /></Field>
              <TouchableOpacity style={[s.saveBtn, { backgroundColor: primaryColor }, busy && { opacity: 0.6 }]} onPress={handleSaveFinalData} disabled={busy}>
                {busy ? <ActivityIndicator color={primaryTextColor} /> : <Text style={[s.saveBtnText, { color: primaryTextColor }]}>Salvar</Text>}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── New day modal ── */}
      <Modal visible={dayModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !busy && setDayModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={s.safe} edges={['top']}>
            <ModalHeader title={`Novo dia (${days.length + 1})`} onClose={() => setDayModal(false)} busy={busy} />
            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <Field label="TÍTULO (OPCIONAL)"><TextInput value={dTitle} onChangeText={setDTitle} style={s.input} placeholder={`Dia ${days.length + 1}`} placeholderTextColor={Colors.textSecondary} /></Field>
              <TouchableOpacity style={[s.saveBtn, { backgroundColor: primaryColor }, busy && { opacity: 0.6 }]} onPress={handleCreateDay} disabled={busy}>
                {busy ? <ActivityIndicator color={primaryTextColor} /> : <Text style={[s.saveBtnText, { color: primaryTextColor }]}>Criar Dia</Text>}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── New item modal ── */}
      <Modal visible={!!itemModalDay} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !busy && setItemModalDay(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={s.safe} edges={['top']}>
            <ModalHeader title={`Novo item — ${itemModalDay?.title || `Dia ${itemModalDay?.day_number}`}`} onClose={() => setItemModalDay(null)} busy={busy} />
            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>TIPO</Text>
              <View style={s.catGrid}>
                {ITEM_TYPES.map(t => (
                  <TouchableOpacity key={t.key}
                    style={[s.catGridBtn, itemType === t.key && { borderColor: primaryColor, backgroundColor: `${primaryColor}15` }]}
                    onPress={() => setItemType(t.key)} activeOpacity={0.75}>
                    <Ionicons name={t.icon as any} size={18} color={itemType === t.key ? primaryColor : Colors.textSecondary} />
                    <Text style={[s.catGridText, itemType === t.key && { color: primaryColor }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {itemType === 'exercise' ? (
                <TouchableOpacity style={s.exercisePickBtn} onPress={() => setExercisePickerVisible(true)}>
                  <Ionicons name="barbell-outline" size={16} color={primaryColor} />
                  <Text style={[s.exercisePickText, { color: primaryColor }]}>
                    {itemExercise ? itemExercise.name : 'Selecionar exercício'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Field label="TÍTULO"><TextInput value={itemTitle} onChangeText={setItemTitle} style={s.input} placeholderTextColor={Colors.textSecondary} /></Field>
              )}

              {itemType === 'file' && (
                <Field label="URL DO ARQUIVO"><TextInput value={itemFileUrl} onChangeText={setItemFileUrl} style={s.input} autoCapitalize="none" placeholder="https://..." placeholderTextColor={Colors.textSecondary} /></Field>
              )}

              <Field label={itemType === 'exercise' ? 'INSTRUÇÕES (OPCIONAL)' : 'CONTEÚDO'}>
                <TextInput value={itemContent} onChangeText={setItemContent} style={[s.input, s.textArea]} multiline placeholderTextColor={Colors.textSecondary} />
              </Field>

              <TouchableOpacity style={[s.saveBtn, { backgroundColor: primaryColor }, busy && { opacity: 0.6 }]} onPress={handleAddItem} disabled={busy}>
                {busy ? <ActivityIndicator color={primaryTextColor} /> : <Text style={[s.saveBtnText, { color: primaryTextColor }]}>Adicionar Item</Text>}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
      <ExercisePickerModal
        visible={exercisePickerVisible}
        tenantId={tenantId}
        onSelect={(ex) => { setItemExercise(ex); setExercisePickerVisible(false); }}
        onClose={() => setExercisePickerVisible(false)}
      />

      {/* ── Publish results modal ── */}
      <Modal visible={publishModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !busy && setPublishModal(false)}>
        <SafeAreaView style={s.safe} edges={['top']}>
          <ModalHeader title="Publicar Resultados" onClose={() => setPublishModal(false)} busy={busy} />
          <View style={s.modalContent}>
            <View style={s.templateRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.templateLabel}>Mostrar números aos alunos</Text>
                <Text style={s.templateDesc}>Se desligado, os alunos veem só a posição no ranking, sem peso/% de gordura.</Text>
              </View>
              <Switch value={showResults} onValueChange={setShowResults}
                trackColor={{ false: Colors.border, true: primaryColor }} thumbColor="#fff" />
            </View>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: primaryColor }, busy && { opacity: 0.6 }]} onPress={handlePublishResults} disabled={busy}>
              {busy ? <ActivityIndicator color={primaryTextColor} /> : <Text style={[s.saveBtnText, { color: primaryTextColor }]}>Publicar</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Small shared pieces ───────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Rascunho',   color: Colors.textSecondary },
  active:    { label: 'Ativo',      color: '#4ADE80' },
  finished:  { label: 'Finalizado', color: '#F59E0B' },
  published: { label: 'Publicado',  color: '#60A5FA' },
};

function InfoBlock({ label, text }: { label: string; text: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.infoBlockText}>{text}</Text>
    </View>
  );
}

function SectionHeader({ title, onAdd }: { title: string; onAdd?: () => void }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {onAdd && (
        <TouchableOpacity onPress={onAdd} style={s.sectionAddBtn}>
          <Ionicons name="add" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function ModalHeader({ title, onClose, busy }: { title: string; onClose: () => void; busy: boolean }) {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={() => !busy && onClose()} style={s.iconBtn}>
        <Ionicons name="close" size={22} color={Colors.textPrimary} />
      </TouchableOpacity>
      <Text style={s.title} numberOfLines={1}>{title}</Text>
      <View style={{ width: 38 }} />
    </View>
  );
}

function Field({ label, children, flex }: { label: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <View style={[{ marginBottom: 14 }, flex && { flex: 1 }]}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 4 },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, flex: 1, marginLeft: 4 },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusPillText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actionBtnText: { fontFamily: FontFamily.bodyBold, fontSize: 12 },

  coverCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 16 },
  coverImg: { width: '100%', aspectRatio: 1200 / 630 },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  coverActions: { flexDirection: 'row', gap: 16, padding: 12 },
  coverBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coverBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },

  infoCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 16 },
  infoBlockText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20, marginTop: 4 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 10 },
  sectionTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 0.8 },
  sectionAddBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  emptyHint: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 12 },

  participantCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 8, gap: 8 },
  participantName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  participantMeta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.bg },
  smallBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  iconBtnSmall: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  publishAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10 },
  publishAllText: { fontFamily: FontFamily.bodyBold, fontSize: 12 },

  dayCard: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, overflow: 'hidden' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  dayBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  dayBadgeText: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: Colors.textSecondary },
  dayTitle: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  dayMeta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  dayBody: { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, gap: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { flex: 1, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  dayFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },

  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  trackName: { width: 90, fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textPrimary },
  trackBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: Colors.border, overflow: 'hidden' },
  trackBarFill: { height: '100%', borderRadius: 4 },
  trackPct: { width: 38, fontFamily: FontFamily.bodyBold, fontSize: 11, textAlign: 'right' },

  messageInputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 10 },
  messageInput: { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, minHeight: 44 },
  sendBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  messageCard: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 8 },
  messageText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  messageDate: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, marginTop: 4 },

  modalContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },
  label: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  textArea: { minHeight: 70, textAlignVertical: 'top', paddingTop: 12 },
  row3: { flexDirection: 'row', gap: 10 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface, borderRadius: 12, padding: 12 },
  studentRowText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: Colors.surface, borderRadius: 10, padding: 12, marginTop: 4 },
  infoText: { flex: 1, fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catGridBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  catGridText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  exercisePickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 14 },
  exercisePickText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },

  templateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12 },
  templateLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  templateDesc: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 4, lineHeight: 16 },
});
