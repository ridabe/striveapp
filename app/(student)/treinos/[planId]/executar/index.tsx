import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Modal, Dimensions, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useHealthConnect, type WearableMetrics } from '@/hooks/useHealthConnect';
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
  currentLoad: string;
  done: boolean;
  comboGroupId: string | null;
  itemNotes: string | null;
  exerciseInstructions: string | null;
  restSeconds: number | null;
}

interface ExGroup {
  comboId: string | null;
  isCombo: boolean;
  items: ExItem[];
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

const STAR_LABELS = ['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente'];
const STAR_COLORS = ['', '#EF4444', '#F97316', '#F59E0B', '#4ADE80', '#22C55E'];

function fmtTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function groupByCombo(items: ExItem[]): ExGroup[] {
  const groups: ExGroup[] = [];
  const seen = new Map<string, ExGroup>();
  for (const item of items) {
    if (!item.comboGroupId) {
      groups.push({ comboId: null, isCombo: false, items: [item] });
    } else {
      const existing = seen.get(item.comboGroupId);
      if (existing) {
        existing.items.push(item);
        existing.isCombo = true;
      } else {
        const g: ExGroup = { comboId: item.comboGroupId, isCombo: false, items: [item] };
        seen.set(item.comboGroupId, g);
        groups.push(g);
      }
    }
  }
  return groups;
}

// ─── Analog rest timer modal ──────────────────────────────────────────────────

const CLOCK_SIZE = 220;
const CLOCK_R = CLOCK_SIZE / 2;
const HAND_LEN = 82;
const TICK_OUTER_R = CLOCK_R - 10;

function RestTimerModal({
  visible, totalSecs, exerciseName, onClose, primaryColor,
}: {
  visible: boolean;
  totalSecs: number;
  exerciseName: string;
  onClose: () => void;
  primaryColor: string;
}) {
  const [remaining, setRemaining] = useState(totalSecs);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) { setRemaining(totalSecs); return; }
    setRemaining(totalSecs);
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(intervalRef.current!);
          setTimeout(onClose, 600);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [visible, totalSecs]);

  const elapsed = totalSecs - remaining;
  const progress = totalSecs > 0 ? elapsed / totalSecs : 0;
  const handDeg = progress * 360;

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const isMajor = i % 5 === 0;
    const tickLen = isMajor ? 14 : 7;
    const mid = TICK_OUTER_R - tickLen / 2;
    return {
      cx: CLOCK_R + Math.cos(angle) * mid,
      cy: CLOCK_R + Math.sin(angle) * mid,
      angleDeg: (i / 60) * 360,
      isMajor,
      tickLen,
      consumed: i / 60 < progress,
    };
  });

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={rt.overlay}>
        <View style={rt.sheet}>
          <View style={rt.sheetHandle} />
          <Text style={rt.heading}>Pausa</Text>
          <Text style={rt.sub} numberOfLines={1}>{exerciseName}</Text>

          {/* Clock face */}
          <View style={{ width: CLOCK_SIZE, height: CLOCK_SIZE, alignSelf: 'center', marginVertical: 28 }}>
            {/* Outer ring */}
            <View style={[rt.ring, { borderColor: `${primaryColor}25` }]} />

            {/* Tick marks */}
            {ticks.map(({ cx, cy, angleDeg, isMajor, tickLen, consumed }, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  width: isMajor ? 2.5 : 1.5,
                  height: tickLen,
                  borderRadius: 2,
                  backgroundColor: consumed
                    ? Colors.border
                    : isMajor ? Colors.textPrimary : Colors.textSecondary,
                  left: cx - (isMajor ? 1.25 : 0.75),
                  top: cy - tickLen / 2,
                  transform: [{ rotate: `${angleDeg}deg` }],
                }}
              />
            ))}

            {/* Clock hand */}
            <View
              style={{
                position: 'absolute',
                width: 3,
                height: HAND_LEN,
                borderRadius: 3,
                backgroundColor: primaryColor,
                bottom: CLOCK_R,
                left: CLOCK_R - 1.5,
                transform: [
                  { translateY: HAND_LEN / 2 },
                  { rotate: `${handDeg}deg` },
                  { translateY: -HAND_LEN / 2 },
                ],
              }}
            />

            {/* Center dot */}
            <View
              style={{
                position: 'absolute',
                width: 12, height: 12, borderRadius: 6,
                backgroundColor: primaryColor,
                left: CLOCK_R - 6,
                top: CLOCK_R - 6,
              }}
            />

            {/* Center countdown */}
            <View style={rt.clockCenter}>
              <Text style={[rt.clockNum, { color: primaryColor }]}>{fmtTime(remaining)}</Text>
              <Text style={rt.clockLabel}>RESTANTE</Text>
            </View>
          </View>

          <View style={rt.totalRow}>
            <Ionicons name="timer-outline" size={14} color={Colors.textSecondary} />
            <Text style={rt.totalText}>Pausa de {fmtTime(totalSecs)}</Text>
          </View>

          <TouchableOpacity
            style={[rt.skipBtn, { borderColor: primaryColor }]}
            onPress={onClose}
            activeOpacity={0.75}
          >
            <Text style={[rt.skipText, { color: primaryColor }]}>Pular pausa</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Star row ─────────────────────────────────────────────────────────────────

function StarRow({
  rating,
  size = 28,
  onRate,
}: {
  rating: number;
  size?: number;
  onRate: (n: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity
          key={n}
          onPress={() => onRate(n === rating ? 0 : n)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={n <= rating ? 'star' : 'star-outline'}
            size={size}
            color={n <= rating ? '#FBBF24' : Colors.border}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

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
  const [finishRating, setFinishRating] = useState(0);

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [wearableMetrics, setWearableMetrics] = useState<WearableMetrics | null>(null);

  const [restTarget, setRestTarget] = useState<{ name: string; secs: number } | null>(null);
  const [fetchingMetrics, setFetchingMetrics] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStart = useRef<Date | null>(null);

  const { requestPermissions, getWorkoutMetrics } = useHealthConnect();

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
          .select('id, routine_id, exercise_id, display_order, sets, reps, load, duration_secs, rest_seconds, combo_group_id, notes, exercises(name, muscle_group, video_url, instructions)')
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
            currentLoad: i.load ?? '',
            done: false,
            comboGroupId: i.combo_group_id ?? null,
            itemNotes: i.notes ?? null,
            exerciseInstructions: ex?.instructions ?? null,
            restSeconds: i.rest_seconds ?? null,
          };
        }),
    }));

    setSections(mapped);
    setLoading(false);
  }

  function updateLoad(itemId: string, value: string) {
    setSections(prev => prev.map(sec => ({
      ...sec,
      items: sec.items.map(it => it.itemId === itemId ? { ...it, currentLoad: value } : it),
    })));
  }

  function toggleDone(itemId: string) {
    setSections(prev => prev.map(sec => ({
      ...sec,
      items: sec.items.map(it => it.itemId === itemId ? { ...it, done: !it.done } : it),
    })));
  }

  async function startWorkout() {
    sessionStart.current = new Date();
    timerRef.current = setInterval(() => setSessionSecs(s => s + 1), 1000);
    setPhase('active');
    // Pede permissão ao Health Connect em background — não bloqueia o início do treino
    requestPermissions().catch(() => {});
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

  async function openFinish() {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('finishing');
    if (sessionStart.current) {
      setFetchingMetrics(true);
      const metrics = await getWorkoutMetrics(sessionStart.current, new Date());
      setWearableMetrics(metrics);
      setFetchingMetrics(false);
    }
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
        heart_rate_avg: wearableMetrics?.heartRateAvg ?? null,
        heart_rate_max: wearableMetrics?.heartRateMax ?? null,
        heart_rate_min: wearableMetrics?.heartRateMin ?? null,
        calories_active: wearableMetrics?.caloriesActive ?? null,
        spo2_avg: wearableMetrics?.spo2Avg ?? null,
        steps: wearableMetrics?.steps ?? null,
        wearable_source: wearableMetrics?.source ?? null,
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

    if (finishRating > 0) {
      await supabase.from('workout_feedbacks').insert({
        tenant_id: student.tenant_id,
        student_id: student.id,
        workout_plan_id: planId ?? null,
        rating: finishRating,
        comment: finishNotes.trim() || null,
      } as any);
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

        {phase === 'ready' && (
          <TouchableOpacity style={[s.ctaBtn, { backgroundColor: primaryColor }]} onPress={startWorkout} activeOpacity={0.85}>
            <Ionicons name="play" size={14} color="#fff" />
            <Text style={s.ctaBtnText}>Iniciar</Text>
          </TouchableOpacity>
        )}
        {phase === 'active' && allDone && (
          <TouchableOpacity style={[s.ctaBtn, { backgroundColor: '#4ADE80' }]} onPress={openFinish} activeOpacity={0.85}>
            <Ionicons name="trophy" size={14} color="#fff" />
            <Text style={s.ctaBtnText}>Finalizar</Text>
          </TouchableOpacity>
        )}
        {phase === 'active' && !allDone && <View style={{ width: 80 }} />}
      </View>

      {/* ── Exercise list ── */}
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {sections.map((section, si) => {
          const groups = groupByCombo(section.items);
          return (
            <View key={section.routineId}>
              {sections.length > 1 && (
                <Text style={s.sectionLabel}>{section.name.toUpperCase()}</Text>
              )}

              {groups.map((group, gi) => (
                <View key={group.comboId ?? `solo-${si}-${gi}`} style={group.isCombo ? s.comboCard : undefined}>
                  {group.isCombo && (
                    <View style={s.comboHeader}>
                      <Ionicons name="git-merge-outline" size={13} color={primaryColor} />
                      <Text style={[s.comboLabel, { color: primaryColor }]}>Exercícios Combinados</Text>
                    </View>
                  )}

                  {group.items.map((item, ii) => {
                    const mc = muscleColor(item.muscleGroup);
                    const isDone = item.done;
                    const isInteractive = phase === 'active';
                    const instruction = item.itemNotes || item.exerciseInstructions;

                    return (
                      <View
                        key={item.itemId}
                        style={[
                          s.exCard,
                          isDone && s.exCardDone,
                          group.isCombo && s.exCardInCombo,
                          group.isCombo && ii < group.items.length - 1 && s.exCardComboGap,
                        ]}
                      >
                        {/* Top: thumbnail + info */}
                        <View style={s.exTop}>
                          <TouchableOpacity
                            style={s.thumbWrap}
                            onPress={() => { if (item.videoUrl) { setVideoTitle(item.name); setVideoUri(item.videoUrl); } }}
                            disabled={!item.videoUrl}
                            activeOpacity={0.8}
                          >
                            {item.videoUrl ? (
                              item.videoUrl.toLowerCase().includes('.gif') ? (
                                <Image source={{ uri: item.videoUrl }} style={s.thumb} resizeMode="cover" />
                              ) : (
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
                              )
                            ) : (
                              <View style={[s.thumbPlaceholder, { backgroundColor: `${mc}25` }]}>
                                <Ionicons name="barbell-outline" size={22} color={mc} />
                              </View>
                            )}
                          </TouchableOpacity>

                          <View style={s.exInfo}>
                            <Text style={[s.exName, isDone && s.exNameDone]} numberOfLines={2}>{item.name}</Text>
                            <View style={s.exMeta}>
                              <View style={[s.musclePill, { backgroundColor: `${mc}20` }]}>
                                <View style={[s.muscleDot, { backgroundColor: mc }]} />
                                <Text style={[s.musclePillText, { color: mc }]}>{item.muscleGroup || 'Geral'}</Text>
                              </View>
                              {item.prescription ? <Text style={s.prescText}>{item.prescription}</Text> : null}
                            </View>
                          </View>
                        </View>

                        {/* Instruction row */}
                        {instruction && (
                          <View style={s.instructionRow}>
                            <Ionicons name="information-circle-outline" size={14} color={Colors.textSecondary} style={{ marginTop: 1 }} />
                            <Text style={s.instructionText}>{instruction}</Text>
                          </View>
                        )}

                        {/* Bottom: load + rest timer + done button */}
                        <View style={s.exBottom}>
                          <View style={s.loadWrap}>
                            <Ionicons name="barbell-outline" size={14} color={Colors.textSecondary} />
                            <TextInput
                              style={s.loadInput}
                              value={item.currentLoad}
                              onChangeText={v => updateLoad(item.itemId, v)}
                              placeholder="Carga"
                              placeholderTextColor={Colors.textSecondary}
                              editable={!isDone}
                              keyboardType="default"
                              returnKeyType="done"
                            />
                            <Text style={s.loadUnit}>kg</Text>
                          </View>

                          {/* Rest timer button */}
                          {item.restSeconds && isInteractive && (
                            <TouchableOpacity
                              style={[s.restBtn, { borderColor: `${primaryColor}50` }]}
                              onPress={() => setRestTarget({ name: item.name, secs: item.restSeconds! })}
                              activeOpacity={0.75}
                            >
                              <Ionicons name="timer-outline" size={16} color={primaryColor} />
                              <Text style={[s.restBtnText, { color: primaryColor }]}>{fmtTime(item.restSeconds)}</Text>
                            </TouchableOpacity>
                          )}

                          {/* Done / Mark button */}
                          {isDone ? (
                            <TouchableOpacity
                              style={[s.doneTag, { backgroundColor: `${primaryColor}18` }]}
                              onPress={() => isInteractive && toggleDone(item.itemId)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="checkmark-circle" size={18} color={primaryColor} />
                              <Text style={[s.doneTagText, { color: primaryColor }]}>Feito</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={[s.markBtn, !isInteractive && s.markBtnDisabled]}
                              onPress={() => isInteractive && toggleDone(item.itemId)}
                              disabled={!isInteractive}
                              activeOpacity={0.8}
                            >
                              <Ionicons
                                name="ellipse-outline"
                                size={15}
                                color={isInteractive ? Colors.textPrimary : Colors.textSecondary}
                              />
                              <Text style={[s.markBtnText, isInteractive ? s.markBtnTextActive : s.markBtnTextDisabled]}>
                                {isInteractive ? 'Marcar' : 'Inicie'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          );
        })}

        {phase === 'ready' && (
          <TouchableOpacity style={[s.bottomBtn, { backgroundColor: primaryColor }]} onPress={startWorkout} activeOpacity={0.87}>
            <Ionicons name="play-circle" size={20} color="#fff" />
            <Text style={s.bottomBtnText}>Iniciar Treino</Text>
          </TouchableOpacity>
        )}
        {phase === 'active' && allDone && (
          <TouchableOpacity style={[s.bottomBtn, { backgroundColor: '#4ADE80' }]} onPress={openFinish} activeOpacity={0.87}>
            <Ionicons name="trophy" size={20} color="#fff" />
            <Text style={s.bottomBtnText}>Finalizar Treino</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Finishing modal ── */}
      <Modal visible={phase === 'finishing'} animationType="slide" transparent onRequestClose={() => setPhase('active')}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.finishOverlay}>
            <ScrollView style={s.finishSheet} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={s.sheetHandle} />
              <Text style={s.finishTitle}>Como foi o treino?</Text>

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

              {fetchingMetrics && (
                <View style={s.wearableCard}>
                  <View style={s.wearableHeader}>
                    <Text style={s.wearableIcon}>⌚</Text>
                    <Text style={s.wearableTitle}>Buscando dados do smartwatch...</Text>
                  </View>
                  <ActivityIndicator color={primaryColor} style={{ marginVertical: 8 }} />
                </View>
              )}

              {!fetchingMetrics && wearableMetrics && (
                <View style={s.wearableCard}>
                  <View style={s.wearableHeader}>
                    <Text style={s.wearableIcon}>⌚</Text>
                    <Text style={s.wearableTitle}>Dados do Smartwatch</Text>
                  </View>
                  <View style={s.wearableMetrics}>
                    {wearableMetrics.heartRateAvg !== null && (
                      <View style={s.wearableMetric}>
                        <Text style={[s.wearableValue, { color: '#EF4444' }]}>
                          {wearableMetrics.heartRateAvg}
                          {wearableMetrics.heartRateMax !== null && `/${wearableMetrics.heartRateMax}`}
                        </Text>
                        <Text style={s.wearableLabel}>FC méd/máx (bpm)</Text>
                      </View>
                    )}
                    {wearableMetrics.caloriesActive !== null && (
                      <View style={s.wearableMetric}>
                        <Text style={[s.wearableValue, { color: '#F59E0B' }]}>{wearableMetrics.caloriesActive}</Text>
                        <Text style={s.wearableLabel}>Calorias (kcal)</Text>
                      </View>
                    )}
                    {wearableMetrics.spo2Avg !== null && (
                      <View style={s.wearableMetric}>
                        <Text style={[s.wearableValue, { color: '#60A5FA' }]}>{wearableMetrics.spo2Avg}%</Text>
                        <Text style={s.wearableLabel}>SpO₂</Text>
                      </View>
                    )}
                    {wearableMetrics.steps !== null && (
                      <View style={s.wearableMetric}>
                        <Text style={[s.wearableValue, { color: '#4ADE80' }]}>{wearableMetrics.steps}</Text>
                        <Text style={s.wearableLabel}>Passos</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Star rating */}
              <Text style={[s.finishSectionLabel, { marginTop: 16 }]}>AVALIAÇÃO</Text>
              <View style={s.starsRow}>
                <StarRow rating={finishRating} onRate={setFinishRating} />
                {finishRating > 0 && (
                  <Text style={[s.starLabel, { color: STAR_COLORS[finishRating] }]}>
                    {STAR_LABELS[finishRating]}
                  </Text>
                )}
              </View>

              <Text style={[s.finishSectionLabel, { marginTop: 16 }]}>INTENSIDADE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {INTENSITIES.map(item => (
                  <TouchableOpacity
                    key={item.key}
                    style={[s.intensityBtn, intensity === item.key && { borderColor: item.color, backgroundColor: `${item.color}18` }]}
                    onPress={() => setIntensity(item.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.intensityEmoji}>{item.emoji}</Text>
                    <Text style={[s.intensityLabel, intensity === item.key && { color: item.color }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[s.finishSectionLabel, { marginTop: 16 }]}>OBSERVAÇÕES <Text style={s.optional}>(opcional)</Text></Text>
              <TextInput
                value={finishNotes}
                onChangeText={setFinishNotes}
                style={s.notesInput}
                placeholder="Como se sentiu? Dificuldades, conquistas..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                textAlignVertical="top"
              />

              <View style={[s.finishBtns, { paddingBottom: 32 }]}>
                <TouchableOpacity
                  style={s.cancelBtn}
                  onPress={() => {
                    setPhase('active');
                    timerRef.current = setInterval(() => setSessionSecs(sv => sv + 1), 1000);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={s.cancelBtnText}>Voltar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.saveBtn, { backgroundColor: primaryColor }]} onPress={handleSave} activeOpacity={0.87}>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={s.saveBtnText}>Salvar Treino</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Rest timer modal ── */}
      <RestTimerModal
        visible={!!restTarget}
        totalSecs={restTarget?.secs ?? 0}
        exerciseName={restTarget?.name ?? ''}
        onClose={() => setRestTarget(null)}
        primaryColor={primaryColor}
      />

      {videoUri && (
        <MediaViewerModal visible uri={videoUri} type={videoUri.toLowerCase().includes('.gif') ? 'image' : 'video'} title={videoTitle} onClose={() => setVideoUri(null)} />
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

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface, gap: 8 },
  topCenter: { flex: 1, gap: 2 },
  topName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timerText: { fontFamily: FontFamily.bodyBold, fontSize: 13 },
  progressChip: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginLeft: 4 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  ctaBtnText: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: '#fff' },

  scroll: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 48, gap: 10 },
  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 0.8, marginTop: 4, marginBottom: 4, paddingHorizontal: 2 },

  comboCard: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 20, overflow: 'hidden', gap: 0 },
  comboHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, backgroundColor: Colors.surface },
  comboLabel: { fontFamily: FontFamily.bodyBold, fontSize: 12, letterSpacing: 0.3 },

  exCard: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  exCardDone: { opacity: 0.55 },
  exCardInCombo: { borderRadius: 0, borderWidth: 0, borderTopWidth: 1, borderTopColor: Colors.border },
  exCardComboGap: { borderBottomWidth: 0 },

  exTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  thumbWrap: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 14, overflow: 'hidden', backgroundColor: Colors.border, flexShrink: 0 },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE },
  thumbPlaceholder: { width: THUMB_SIZE, height: THUMB_SIZE, alignItems: 'center', justifyContent: 'center' },
  playOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },

  exInfo: { flex: 1, paddingTop: 2 },
  exName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  exNameDone: { textDecorationLine: 'line-through', color: Colors.textSecondary },
  exMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  musclePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  muscleDot: { width: 7, height: 7, borderRadius: 4 },
  musclePillText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  prescText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },

  instructionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  instructionText: { flex: 1, fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  exBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 2 },
  loadWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 9, gap: 6 },
  loadInput: { flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary, padding: 0 },
  loadUnit: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },

  restBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  restBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },

  markBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: 'transparent' },
  markBtnDisabled: { borderColor: Colors.border, opacity: 0.5 },
  markBtnText: { fontFamily: FontFamily.bodyBold, fontSize: 13 },
  markBtnTextActive: { color: Colors.textPrimary },
  markBtnTextDisabled: { color: Colors.textSecondary },
  doneTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  doneTagText: { fontFamily: FontFamily.bodyBold, fontSize: 13 },

  bottomBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17, borderRadius: 18, marginTop: 6 },
  bottomBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: '#fff' },

  finishOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  finishSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, maxHeight: '92%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 12 },
  finishTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.lg, color: Colors.textPrimary, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', backgroundColor: Colors.bg, borderRadius: 18, borderWidth: 1.5, padding: 20 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryNum: { fontFamily: FontFamily.bodyBold, fontSize: 28 },
  summaryLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  summaryDiv: { width: 1, backgroundColor: Colors.border, marginHorizontal: 12 },

  wearableCard: { backgroundColor: Colors.bg, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, marginTop: 12 },
  wearableHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  wearableIcon: { fontSize: 16 },
  wearableTitle: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: Colors.textPrimary },
  wearableMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  wearableMetric: { flex: 1, minWidth: 80, alignItems: 'center', gap: 2 },
  wearableValue: { fontFamily: FontFamily.bodyBold, fontSize: 20 },
  wearableLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },

  finishSectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 10 },
  optional: { fontFamily: FontFamily.body, fontWeight: '400', letterSpacing: 0 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  starLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },

  intensityBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg },
  intensityEmoji: { fontSize: 18 },
  intensityLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  notesInput: { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
  finishBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  saveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: '#fff' },
});

// ─── Rest timer styles ────────────────────────────────────────────────────────

const rt = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: Colors.surface, borderRadius: 28, padding: 28, width: '100%', alignItems: 'center', gap: 4 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 8 },
  heading: { fontFamily: FontFamily.bodyBold, fontSize: 22, color: Colors.textPrimary },
  sub: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, maxWidth: 240, textAlign: 'center' },
  ring: { position: 'absolute', inset: 0, borderRadius: CLOCK_R, borderWidth: 1.5 },
  clockCenter: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  clockNum: { fontFamily: FontFamily.bodyBold, fontSize: 46, lineHeight: 52 },
  clockLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 10, color: Colors.textSecondary, letterSpacing: 2 },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  totalText: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary },
  skipBtn: { width: '100%', borderRadius: 14, borderWidth: 1.5, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  skipText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
});
