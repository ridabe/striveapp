import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { muscleColor } from '@/lib/exerciseConfig';
import { MediaViewerModal } from '@/components/MediaViewerModal';

type Phase = 'ready' | 'active' | 'finishing' | 'saving';

interface ExItem {
  itemId: string;
  exerciseId: string;
  name: string;
  muscleGroup: string;
  prescription: string;
  videoUrl: string | null;
  defaultSets: number;
  defaultReps: string | null;
  defaultLoad: string;
  // mutable per-exercise state
  currentLoad: string;
  done: boolean;
}

interface Section {
  routineId: string;
  name: string;
  items: ExItem[];
}

const INTENSITIES = [
  { key: 'muito_leve', label: 'Muito leve', emoji: '😴', color: '#94A3B8' },
  { key: 'leve',       label: 'Leve',       emoji: '🙂', color: '#60A5FA' },
  { key: 'moderado',   label: 'Moderado',   emoji: '💪', color: '#4ADE80' },
  { key: 'intenso',    label: 'Intenso',    emoji: '🔥', color: '#F59E0B' },
  { key: 'muito_intenso', label: 'Pesado',  emoji: '😤', color: '#EF4444' },
];

function fmtTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function PlanExecutionScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { student } = useStudent();
  const { primaryColor } = useThemeStore();

  const [planName, setPlanName] = useState('Treino');
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>('ready');
  const [sessionSecs, setSessionSecs] = useState(0);
  const [intensity, setIntensity] = useState('moderado');
  const [finishNotes, setFinishNotes] = useState('');

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStart = useRef<Date | null>(null);

  useEffect(() => {
    if (planId) load();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [planId]);

  async function load() {
    const [planRes, routinesRes] = await Promise.all([
      supabase.from('workout_plans').select('name').eq('id', planId).single(),
      supabase.from('workout_routines').select('id, name, display_order').eq('workout_plan_id', planId).order('display_order'),
    ]);

    setPlanName(planRes.data?.name ?? 'Treino');
    const rIds = (routinesRes.data ?? []).map((r: any) => r.id);

    const itemsRes = rIds.length > 0
      ? await supabase
          .from('workout_items')
          .select('id, routine_id, exercise_id, display_order, sets, reps, load, duration_secs, exercises(name, muscle_group, video_url)')
          .in('routine_id', rIds)
          .order('display_order')
      : { data: [] };

    const allItems: any[] = itemsRes.data ?? [];
    const mapped: Section[] = (routinesRes.data ?? []).map((r: any) => ({
      routineId: r.id,
      name: r.name,
      items: allItems
        .filter(i => i.routine_id === r.id)
        .map(i => {
          const ex = i.exercises;
          const parts: string[] = [];
          if (i.sets) parts.push(`${i.sets}×`);
          if (i.reps) parts.push(i.reps);
          if (i.duration_secs) parts.push(`${i.duration_secs}s`);
          return {
            itemId: i.id,
            exerciseId: i.exercise_id,
            name: ex?.name ?? 'Exercício',
            muscleGroup: ex?.muscle_group ?? '',
            prescription: parts.join(' '),
            videoUrl: ex?.video_url ?? null,
            defaultSets: i.sets ?? 1,
            defaultReps: i.reps ?? null,
            defaultLoad: i.load ?? '',
            currentLoad: i.load ?? '',
            done: false,
          };
        }),
    }));

    setSections(mapped);
    setLoading(false);
  }

  function updateLoad(sectionIdx: number, itemIdx: number, value: string) {
    setSections(prev => prev.map((sec, si) =>
      si !== sectionIdx ? sec : {
        ...sec,
        items: sec.items.map((it, ii) => ii !== itemIdx ? it : { ...it, currentLoad: value }),
      }
    ));
  }

  function toggleDone(sectionIdx: number, itemIdx: number) {
    setSections(prev => prev.map((sec, si) =>
      si !== sectionIdx ? sec : {
        ...sec,
        items: sec.items.map((it, ii) => ii !== itemIdx ? it : { ...it, done: !it.done }),
      }
    ));
  }

  function startWorkout() {
    sessionStart.current = new Date();
    timerRef.current = setInterval(() => setSessionSecs(s => s + 1), 1000);
    setPhase('active');
  }

  function handleAbandon() {
    Alert.alert('Abandonar treino?', 'O progresso não será salvo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Abandonar', style: 'destructive', onPress: () => {
          if (timerRef.current) clearInterval(timerRef.current);
          router.back();
        },
      },
    ]);
  }

  function openFinish() {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('finishing');
  }

  async function handleSave() {
    if (!student) return;
    setPhase('saving');

    const finishedAt = new Date().toISOString();
    const startedAt = sessionStart.current?.toISOString() ?? finishedAt;

    const { data: session, error } = await supabase
      .from('workout_sessions')
      .insert({
        student_id: student.id,
        tenant_id: student.tenant_id,
        workout_plan_id: planId ?? null,
        workout_routine_id: null,
        started_at: startedAt,
        finished_at: finishedAt,
        duration_seconds: sessionSecs,
        intensity,
        notes: finishNotes.trim() || null,
      } as any)
      .select('id')
      .single();

    if (!error && session?.id) {
      const allItems = sections.flatMap(s => s.items);
      const completed = allItems.filter(it => it.done);
      if (completed.length > 0) {
        await supabase.from('workout_session_exercises').insert(
          completed.map(it => ({
            session_id: session.id,
            exercise_id: it.exerciseId,
            workout_item_id: it.itemId,
            sets_done: it.defaultSets,
            reps_done: it.defaultReps,
            load_used: it.currentLoad || null,
          })) as any
        );
      }
    }

    router.back();
  }

  const allItems = sections.flatMap(s => s.items);
  const doneCount = allItems.filter(it => it.done).length;
  const totalCount = allItems.length;
  const allDone = totalCount > 0 && doneCount === totalCount;

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.loadHeader}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (phase === 'saving') {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.centered}>
          <ActivityIndicator color={primaryColor} size="large" />
          <Text style={s.savingText}>Salvando treino...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Sticky top bar ── */}
      <View style={s.topBar}>
        {/* Left: back / abandon */}
        <TouchableOpacity
          style={s.iconBtn}
          onPress={phase === 'active' ? handleAbandon : () => router.back()}
        >
          <Ionicons
            name={phase === 'active' ? 'close' : 'arrow-back'}
            size={22}
            color={phase === 'active' ? Colors.error : Colors.textPrimary}
          />
        </TouchableOpacity>

        {/* Center: name + timer */}
        <View style={s.topCenter}>
          <Text style={s.topName} numberOfLines={1}>{planName}</Text>
          {phase === 'active' && (
            <View style={s.timerRow}>
              <Ionicons name="time-outline" size={13} color={primaryColor} />
              <Text style={[s.timerText, { color: primaryColor }]}>{fmtTime(sessionSecs)}</Text>
              <Text style={s.progressChip}>{doneCount}/{totalCount}</Text>
            </View>
          )}
        </View>

        {/* Right: CTA button */}
        {phase === 'ready' && (
          <TouchableOpacity
            style={[s.ctaBtn, { backgroundColor: primaryColor }]}
            onPress={startWorkout}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={14} color="#fff" />
            <Text style={s.ctaBtnText}>Iniciar</Text>
          </TouchableOpacity>
        )}
        {phase === 'active' && allDone && (
          <TouchableOpacity
            style={[s.ctaBtn, { backgroundColor: '#4ADE80' }]}
            onPress={openFinish}
            activeOpacity={0.85}
          >
            <Ionicons name="trophy" size={14} color="#fff" />
            <Text style={s.ctaBtnText}>Finalizar</Text>
          </TouchableOpacity>
        )}
        {phase === 'active' && !allDone && (
          <View style={{ width: 80 }} />
        )}
      </View>

      {/* ── Exercise list ── */}
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {sections.map((section, si) => (
          <View key={section.routineId}>
            {sections.length > 1 && (
              <Text style={s.sectionLabel}>{section.name.toUpperCase()}</Text>
            )}
            {section.items.map((item, ii) => {
              const mc = muscleColor(item.muscleGroup);
              const isDone = item.done;
              const isInteractive = phase === 'active';

              return (
                <View
                  key={item.itemId}
                  style={[s.exCard, isDone && s.exCardDone]}
                >
                  {/* Top row: thumbnail + info */}
                  <View style={s.exTop}>
                    {/* Video thumbnail */}
                    <TouchableOpacity
                      style={s.thumbWrap}
                      onPress={() => {
                        if (item.videoUrl) {
                          setVideoTitle(item.name);
                          setVideoUri(item.videoUrl);
                        }
                      }}
                      disabled={!item.videoUrl}
                      activeOpacity={0.8}
                    >
                      {item.videoUrl ? (
                        <>
                          <Video
                            source={{ uri: item.videoUrl }}
                            style={s.thumb}
                            shouldPlay={false}
                            isMuted
                            resizeMode={ResizeMode.COVER}
                          />
                          <View style={s.playOverlay}>
                            <Ionicons name="play" size={16} color="#fff" />
                          </View>
                        </>
                      ) : (
                        <View style={[s.thumbPlaceholder, { backgroundColor: `${mc}25` }]}>
                          <Ionicons name="barbell-outline" size={22} color={mc} />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Name + muscle + prescription */}
                    <View style={s.exInfo}>
                      <Text style={[s.exName, isDone && s.exNameDone]} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <View style={s.exMeta}>
                        <View style={[s.musclePill, { backgroundColor: `${mc}20` }]}>
                          <View style={[s.muscleDot, { backgroundColor: mc }]} />
                          <Text style={[s.musclePillText, { color: mc }]}>
                            {item.muscleGroup || 'Geral'}
                          </Text>
                        </View>
                        {item.prescription ? (
                          <Text style={s.prescText}>{item.prescription}</Text>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {/* Bottom row: load input + done button */}
                  <View style={s.exBottom}>
                    <View style={s.loadWrap}>
                      <Ionicons name="barbell-outline" size={14} color={Colors.textSecondary} />
                      <TextInput
                        style={s.loadInput}
                        value={item.currentLoad}
                        onChangeText={v => updateLoad(si, ii, v)}
                        placeholder="Carga"
                        placeholderTextColor={Colors.textSecondary}
                        editable={!isDone}
                        keyboardType="default"
                        returnKeyType="done"
                      />
                      <Text style={s.loadUnit}>kg</Text>
                    </View>

                    {isDone ? (
                      <TouchableOpacity
                        style={[s.doneTag, { backgroundColor: `${primaryColor}18` }]}
                        onPress={() => isInteractive && toggleDone(si, ii)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="checkmark-circle" size={18} color={primaryColor} />
                        <Text style={[s.doneTagText, { color: primaryColor }]}>Feito</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[
                          s.markBtn,
                          isInteractive ? { backgroundColor: primaryColor } : s.markBtnDisabled,
                        ]}
                        onPress={() => isInteractive && toggleDone(si, ii)}
                        disabled={!isInteractive}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark" size={15} color={isInteractive ? '#fff' : Colors.textSecondary} />
                        <Text style={[s.markBtnText, !isInteractive && s.markBtnTextDisabled]}>
                          {isInteractive ? 'Feito' : 'Inicie'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {/* Bottom CTA (also shows when all done) */}
        {phase === 'ready' && (
          <TouchableOpacity
            style={[s.bottomBtn, { backgroundColor: primaryColor }]}
            onPress={startWorkout}
            activeOpacity={0.87}
          >
            <Ionicons name="play-circle" size={20} color="#fff" />
            <Text style={s.bottomBtnText}>Iniciar Treino</Text>
          </TouchableOpacity>
        )}
        {phase === 'active' && allDone && (
          <TouchableOpacity
            style={[s.bottomBtn, { backgroundColor: '#4ADE80' }]}
            onPress={openFinish}
            activeOpacity={0.87}
          >
            <Ionicons name="trophy" size={20} color="#fff" />
            <Text style={s.bottomBtnText}>Finalizar Treino</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Finishing modal ── */}
      <Modal
        visible={phase === 'finishing'}
        animationType="slide"
        transparent
        onRequestClose={() => setPhase('active')}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.finishOverlay}>
            <View style={s.finishSheet}>
              <View style={s.sheetHandle} />
              <Text style={s.finishTitle}>Como foi o treino?</Text>

              {/* Summary */}
              <View style={[s.summaryRow, { borderColor: `${primaryColor}30` }]}>
                <View style={s.summaryItem}>
                  <Text style={[s.summaryNum, { color: primaryColor }]}>{fmtTime(sessionSecs)}</Text>
                  <Text style={s.summaryLabel}>Duração</Text>
                </View>
                <View style={s.summaryDiv} />
                <View style={s.summaryItem}>
                  <Text style={[s.summaryNum, { color: primaryColor }]}>{doneCount}/{totalCount}</Text>
                  <Text style={s.summaryLabel}>Exercícios</Text>
                </View>
              </View>

              {/* Intensity */}
              <Text style={s.finishSectionLabel}>INTENSIDADE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {INTENSITIES.map(item => (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      s.intensityBtn,
                      intensity === item.key && { borderColor: item.color, backgroundColor: `${item.color}18` },
                    ]}
                    onPress={() => setIntensity(item.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.intensityEmoji}>{item.emoji}</Text>
                    <Text style={[s.intensityLabel, intensity === item.key && { color: item.color }]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Notes */}
              <Text style={[s.finishSectionLabel, { marginTop: 16 }]}>FEEDBACK (opcional)</Text>
              <TextInput
                value={finishNotes}
                onChangeText={setFinishNotes}
                style={s.notesInput}
                placeholder="Como se sentiu? Dificuldades, conquistas..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                textAlignVertical="top"
              />

              {/* Buttons */}
              <View style={s.finishBtns}>
                <TouchableOpacity
                  style={s.cancelBtn}
                  onPress={() => {
                    setPhase('active');
                    timerRef.current = setInterval(() => setSessionSecs(s => s + 1), 1000);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={s.cancelBtnText}>Voltar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.saveBtn, { backgroundColor: primaryColor }]}
                  onPress={handleSave}
                  activeOpacity={0.87}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={s.saveBtnText}>Salvar Treino</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Video viewer */}
      {videoUri && (
        <MediaViewerModal
          visible
          uri={videoUri}
          type="video"
          title={videoTitle}
          onClose={() => setVideoUri(null)}
        />
      )}
    </SafeAreaView>
  );
}

const THUMB_SIZE = 76;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  savingText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  loadHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 8,
  },
  topCenter: { flex: 1, gap: 2 },
  topName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timerText: { fontFamily: FontFamily.bodyBold, fontSize: 13 },
  progressChip: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginLeft: 4 },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20,
  },
  ctaBtnText: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: '#fff' },

  // ── Scroll ──
  scroll: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 48, gap: 10 },
  sectionLabel: {
    fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary,
    letterSpacing: 0.8, marginTop: 4, marginBottom: 4, paddingHorizontal: 2,
  },

  // ── Exercise card ──
  exCard: {
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  exCardDone: { opacity: 0.55 },
  exTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },

  // thumbnail
  thumbWrap: {
    width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 14,
    overflow: 'hidden', backgroundColor: Colors.border,
    flexShrink: 0,
  },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE },
  thumbPlaceholder: { width: THUMB_SIZE, height: THUMB_SIZE, alignItems: 'center', justifyContent: 'center' },
  playOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },

  // exercise info
  exInfo: { flex: 1, paddingTop: 2 },
  exName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  exNameDone: { textDecorationLine: 'line-through', color: Colors.textSecondary },
  exMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  musclePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  muscleDot: { width: 7, height: 7, borderRadius: 4 },
  musclePillText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  prescText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },

  // bottom row
  exBottom: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 2,
  },
  loadWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 9, gap: 6,
  },
  loadInput: {
    flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm,
    color: Colors.textPrimary, padding: 0,
  },
  loadUnit: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },

  markBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
  },
  markBtnDisabled: { backgroundColor: Colors.border },
  markBtnText: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: '#fff' },
  markBtnTextDisabled: { color: Colors.textSecondary },
  doneTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
  },
  doneTagText: { fontFamily: FontFamily.bodyBold, fontSize: 13 },

  // bottom action buttons
  bottomBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 17, borderRadius: 18, marginTop: 6,
  },
  bottomBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: '#fff' },

  // ── Finishing modal ──
  finishOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  finishSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12, gap: 12,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 8,
  },
  finishTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  summaryRow: {
    flexDirection: 'row', backgroundColor: Colors.bg,
    borderRadius: 18, borderWidth: 1.5, padding: 20,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryNum: { fontFamily: FontFamily.bodyBold, fontSize: 28 },
  summaryLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  summaryDiv: { width: 1, backgroundColor: Colors.border, marginHorizontal: 12 },
  finishSectionLabel: {
    fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs,
    color: Colors.textSecondary, letterSpacing: 1,
  },
  intensityBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.bg,
  },
  intensityEmoji: { fontSize: 18 },
  intensityLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  notesInput: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 14,
    fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary,
    minHeight: 80, textAlignVertical: 'top',
  },
  finishBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, paddingVertical: 14, alignItems: 'center',
  },
  cancelBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  saveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14,
  },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: '#fff' },
});
