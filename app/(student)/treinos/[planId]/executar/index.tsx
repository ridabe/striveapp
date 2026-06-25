import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Modal, Dimensions,
  Image, ScrollView, AppState, AppStateStatus,
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
import {
  preloadRestBeep,
  playRestEndAlert,
  releaseRestBeep,
  requestNotificationPermission,
  scheduleRestEndNotification,
  cancelRestNotification,
} from '@/lib/workoutAudio';

// ─── Types ────────────────────────────────────────────────────────────────────
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

const { width: W } = Dimensions.get('window');
const RING_SIZE = W * 0.62;
const RING_TICKS = 72;

function fmtTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Circular rest ring ───────────────────────────────────────────────────────
function RestRing({
  remaining, total, primaryColor,
}: {
  remaining: number; total: number; primaryColor: string;
}) {
  const progress = total > 0 ? remaining / total : 0;
  const R = RING_SIZE / 2;

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {/* Dim base ring */}
      <View style={{
        position: 'absolute',
        width: RING_SIZE, height: RING_SIZE,
        borderRadius: R,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.06)',
      }} />

      {/* Tick marks */}
      {Array.from({ length: RING_TICKS }, (_, i) => {
        const angle = (i / RING_TICKS) * Math.PI * 2 - Math.PI / 2;
        const active = i / RING_TICKS < progress;
        const isMajor = i % 6 === 0;
        const tickLen = isMajor ? 14 : 7;
        const tickW = isMajor ? 3 : 1.5;
        const tickR = R - 8;
        const cx = R + Math.cos(angle) * tickR;
        const cy = R + Math.sin(angle) * tickR;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: tickW,
              height: tickLen,
              borderRadius: tickW,
              backgroundColor: active
                ? primaryColor
                : isMajor ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
              left: cx - tickW / 2,
              top: cy - tickLen / 2,
              transform: [{ rotate: `${(i / RING_TICKS) * 360}deg` }],
            }}
          />
        );
      })}

      {/* Center glow */}
      <View style={{
        position: 'absolute',
        width: RING_SIZE * 0.55, height: RING_SIZE * 0.55,
        borderRadius: RING_SIZE * 0.275,
        backgroundColor: `${primaryColor}0D`,
      }} />

      {/* Time + label */}
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={[rt.ringTime, { color: primaryColor }]}>{fmtTime(remaining)}</Text>
        <Text style={rt.ringLabel}>DESCANSO</Text>
      </View>
    </View>
  );
}

// ─── Star row ─────────────────────────────────────────────────────────────────
function StarRow({ rating, onRate }: { rating: number; onRate: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onRate(n === rating ? 0 : n)} activeOpacity={0.7}>
          <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={28} color={n <= rating ? '#FBBF24' : 'rgba(255,255,255,0.2)'} />
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
  const [currentExIdx, setCurrentExIdx] = useState(0);

  // seriesDone[itemId][seriesIdx] = true/false
  const [seriesDone, setSeriesDone] = useState<Record<string, boolean[]>>({});
  // load per item
  const [loadValues, setLoadValues] = useState<Record<string, string>>({});

  // Instruction accordion (tela active) — recolhida por padrão, reseta ao mudar de exercício
  const [instrExpanded, setInstrExpanded] = useState(false);
  useEffect(() => { setInstrExpanded(false); }, [currentExIdx]);

  // Popup de conclusão de treino
  const [showDoneModal, setShowDoneModal] = useState(false);

  // Accordion e vídeo da tela "pronto para começar"
  const [readyExpanded, setReadyExpanded] = useState<Set<string>>(new Set());
  function toggleReadyExpand(itemId: string) {
    setReadyExpanded(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  // Rest
  const [isResting, setIsResting] = useState(false);
  const [restRemaining, setRestRemaining] = useState(0);
  const [restTotal, setRestTotal] = useState(0);

  // Finishing
  const [intensity, setIntensity] = useState('moderado');
  const [finishNotes, setFinishNotes] = useState('');
  const [finishRating, setFinishRating] = useState(0);
  const [wearableMetrics, setWearableMetrics] = useState<WearableMetrics | null>(null);
  const [fetchingMetrics, setFetchingMetrics] = useState(false);

  // Load adjustment modal
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [tempLoad, setTempLoad] = useState('');

  // Media
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState('');

  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStart = useRef<Date | null>(null);
  const restStartAt  = useRef<Date | null>(null); // wall clock para o descanso
  const restDuration = useRef<number>(0);          // duração total do descanso atual

  const { requestPermissions, getWorkoutMetrics } = useHealthConnect();

  // Derived flat list
  const flatItems: ExItem[] = sections.flatMap(s => s.items);
  const currentItem = flatItems[currentExIdx] ?? null;
  const currentSeries = currentItem ? (seriesDone[currentItem.itemId] ?? []) : [];
  const currentSeriesIdx = currentSeries.findIndex(d => !d);
  const allSeriesDoneForCurrent = currentSeries.length > 0 && currentSeries.every(Boolean);
  const totalDoneItems = flatItems.filter(it => (seriesDone[it.itemId] ?? []).some(Boolean)).length;
  const isLastExercise = currentExIdx === flatItems.length - 1;

  // Todos os exercícios com todas as séries concluídas
  const allWorkoutDone = phase === 'active' &&
    flatItems.length > 0 &&
    flatItems.every(it => {
      const series = seriesDone[it.itemId] ?? [];
      return series.length > 0 && series.every(Boolean);
    });

  // Dispara popup ao completar todos os exercícios
  useEffect(() => {
    if (allWorkoutDone && !showDoneModal && !isResting) {
      // Pequeno delay para o aluno ver a última série marcada
      const t = setTimeout(() => setShowDoneModal(true), 800);
      return () => clearTimeout(t);
    }
  }, [allWorkoutDone, isResting]);

  useEffect(() => {
    if (planId) load();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, [planId]);

  // Recompute timers from wall clock when app volta ao primeiro plano
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') return;
      if (phase === 'active' && sessionStart.current) {
        // Recalcula tempo de sessão pelo relógio real
        setSessionSecs(Math.floor((Date.now() - sessionStart.current.getTime()) / 1000));
      }
      if (phase === 'active' && isResting && restStartAt.current) {
        // Recalcula descanso restante pelo relógio real
        const elapsed = Math.floor((Date.now() - restStartAt.current.getTime()) / 1000);
        const remaining = Math.max(0, restDuration.current - elapsed);
        if (remaining === 0) {
          if (restTimerRef.current) clearInterval(restTimerRef.current);
          setIsResting(false);
          setRestRemaining(0);
          playRestEndAlert();
        } else {
          setRestRemaining(remaining);
        }
      }
    });
    return () => sub.remove();
  }, [phase, isResting]);

  // Init series state when sections load
  useEffect(() => {
    if (sections.length === 0) return;
    const initSeries: Record<string, boolean[]> = {};
    const initLoad: Record<string, string> = {};
    sections.flatMap(s => s.items).forEach(it => {
      initSeries[it.itemId] = Array(Math.max(it.defaultSets, 1)).fill(false);
      initLoad[it.itemId] = it.currentLoad;
    });
    setSeriesDone(initSeries);
    setLoadValues(initLoad);
  }, [sections]);

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

    const allRaw: any[] = itemsRes.data ?? [];
    const mapped: Section[] = (routinesRes.data ?? []).map((r: any) => ({
      routineId: r.id,
      name: r.name,
      items: allRaw.filter(i => i.routine_id === r.id).map(i => {
        const ex = i.exercises;
        const parts: string[] = [];
        if (i.sets) parts.push(`${i.sets}×`);
        if (i.reps) parts.push(i.reps);
        if (i.duration_secs) parts.push(`${i.duration_secs}s`);
        return {
          itemId: i.id, exerciseId: i.exercise_id,
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
        } as ExItem;
      }),
    }));
    setSections(mapped);
    setLoading(false);
  }

  function startWorkout() {
    sessionStart.current = new Date();
    // Usa wall clock: calcula tempo real em vez de contar ticks
    // Evita congelamento se o JS thread atrasar ou o app for ao background
    timerRef.current = setInterval(() => {
      if (sessionStart.current) {
        setSessionSecs(Math.floor((Date.now() - sessionStart.current.getTime()) / 1000));
      }
    }, 1000);
    setPhase('active');
    requestPermissions().catch(() => {});
    preloadRestBeep().catch(() => {});
    requestNotificationPermission().catch(() => {});
  }

  function startRest(secs: number) {
    if (restTimerRef.current) clearInterval(restTimerRef.current);

    restStartAt.current  = new Date(); // marca o momento exato de início
    restDuration.current = secs;

    setRestTotal(secs);
    setRestRemaining(secs);
    setIsResting(true);
    scheduleRestEndNotification(secs).catch(() => {});

    // Usa wall clock: calcula o tempo restante real a cada tick
    restTimerRef.current = setInterval(() => {
      if (!restStartAt.current) return;
      const elapsed   = Math.floor((Date.now() - restStartAt.current.getTime()) / 1000);
      const remaining = Math.max(0, secs - elapsed);

      if (remaining === 0) {
        clearInterval(restTimerRef.current!);
        restTimerRef.current = null;
        restStartAt.current  = null;
        setIsResting(false);
        setRestRemaining(0);
        playRestEndAlert();
      } else {
        setRestRemaining(remaining);
      }
    }, 500); // tick a cada 500ms para maior precisão de display
  }

  function skipRest() {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    restTimerRef.current = null;
    restStartAt.current  = null;
    setIsResting(false);
    setRestRemaining(0);
    cancelRestNotification().catch(() => {});
  }

  function completeSeries() {
    if (!currentItem || currentSeriesIdx === -1) return;
    const updated = [...currentSeries];
    updated[currentSeriesIdx] = true;
    setSeriesDone(prev => ({ ...prev, [currentItem.itemId]: updated }));

    const allDoneNow = updated.every(Boolean);
    const hasMoreSeries = currentSeriesIdx < currentSeries.length - 1;

    if (!allDoneNow && hasMoreSeries && currentItem.restSeconds) {
      startRest(currentItem.restSeconds);
    } else if (allDoneNow && !isLastExercise) {
      // Brief delay then advance
      setTimeout(() => setCurrentExIdx(i => i + 1), 400);
    }
  }

  function goToExercise(idx: number) {
    if (idx >= 0 && idx < flatItems.length) setCurrentExIdx(idx);
  }

  function handleAbandon() {
    Alert.alert('Abandonar treino?', 'O progresso não será salvo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Abandonar', style: 'destructive', onPress: () => {
          if (timerRef.current) clearInterval(timerRef.current);
          if (restTimerRef.current) clearInterval(restTimerRef.current);
          releaseRestBeep().catch(() => {});
          router.back();
        },
      },
    ]);
  }

  async function openFinish() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    setIsResting(false);
    releaseRestBeep().catch(() => {});
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
        student_id: student.id, tenant_id: student.tenant_id,
        workout_plan_id: planId ?? null, workout_routine_id: null,
        started_at: startedAt, finished_at: finishedAt,
        duration_seconds: sessionSecs, intensity,
        notes: finishNotes.trim() || null,
        heart_rate_avg:   wearableMetrics?.heartRateAvg    ?? null,
        heart_rate_max:   wearableMetrics?.heartRateMax    ?? null,
        heart_rate_min:   wearableMetrics?.heartRateMin    ?? null,
        calories_active:  wearableMetrics?.caloriesActive  ?? null,
        spo2_avg:         wearableMetrics?.spo2Avg         ?? null,
        steps:            wearableMetrics?.steps           ?? null,
        distance_meters:  wearableMetrics?.distanceMeters  ?? null,
        wearable_source:  wearableMetrics?.source          ?? null,
        wearable_device:  wearableMetrics?.wearableDevice  ?? null,
      } as any)
      .select('id').single();

    if (!error && session?.id) {
      const completed = flatItems.filter(it => (seriesDone[it.itemId] ?? []).some(Boolean));
      if (completed.length > 0) {
        await supabase.from('workout_session_exercises').insert(
          completed.map(it => ({
            session_id: session.id, exercise_id: it.exerciseId,
            workout_item_id: it.itemId,
            sets_done: (seriesDone[it.itemId] ?? []).filter(Boolean).length,
            reps_done: it.defaultReps,
            load_used: loadValues[it.itemId] || null,
          })) as any
        );
      }

      // Atualiza pontos do ranking (função atômica no banco)
      const allExDone = flatItems.length > 0 &&
        flatItems.every(it => (seriesDone[it.itemId] ?? []).every(Boolean));
      try {
        await supabase.rpc('award_workout_points', {
          p_student_id:      student.id,
          p_duration_secs:   sessionSecs,
          p_exercises_count: completed.length,
          p_all_done:        allExDone,
        });
      } catch {
        // falha silenciosa — não bloqueia o salvamento do treino
      }
    }

    if (finishRating > 0) {
      await supabase.from('workout_feedbacks').insert({
        tenant_id: student.tenant_id, student_id: student.id,
        workout_plan_id: planId ?? null,
        rating: finishRating, comment: finishNotes.trim() || null,
      } as any);
    }
    router.back();
  }

  const hasAnyDone = flatItems.some(it => (seriesDone[it.itemId] ?? []).some(Boolean));

  // ── Loading ──
  if (loading) {
    return (
      <View style={s.safe}>
        <SafeAreaView edges={['top']}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      </View>
    );
  }

  // ── Saving ──
  if (phase === 'saving') {
    return (
      <View style={[s.safe, s.centered]}>
        <ActivityIndicator color={primaryColor} size="large" />
        <Text style={s.savingText}>Salvando treino...</Text>
      </View>
    );
  }

  // ── Ready ──
  if (phase === 'ready') {
    return (
      <View style={s.safe}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={s.readyHeader}>
            <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
              <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
            <Text style={s.readyPlanName} numberOfLines={1}>{planName}</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={s.readyScroll} showsVerticalScrollIndicator={false}>
            <Text style={s.readyTitle}>Pronto para{'\n'}começar?</Text>
            <View style={[s.readyDivider, { backgroundColor: primaryColor }]} />

            {flatItems.map((item, idx) => {
              const mc = muscleColor(item.muscleGroup);
              const hasVideo = !!item.videoUrl;
              const isGif = item.videoUrl?.toLowerCase().includes('.gif');
              const isExpanded = readyExpanded.has(item.itemId);
              const instruction = item.itemNotes || item.exerciseInstructions;

              return (
                <View key={item.itemId} style={[s.readyItem, idx < flatItems.length - 1 && s.readyItemBorder]}>
                  {/* ── Main row: thumb + info + video pill ── */}
                  <View style={s.readyRow}>
                    {/* Thumbnail */}
                    <TouchableOpacity
                      style={[s.readyThumb, { backgroundColor: `${mc}20` }]}
                      onPress={() => { if (hasVideo) { setVideoTitle(item.name); setVideoUri(item.videoUrl!); } }}
                      disabled={!hasVideo}
                      activeOpacity={hasVideo ? 0.78 : 1}
                    >
                      {hasVideo && isGif ? (
                        <Image source={{ uri: item.videoUrl! }} style={s.readyThumbImg} resizeMode="cover" />
                      ) : hasVideo ? (
                        <>
                          <Video
                            source={{ uri: item.videoUrl! }}
                            style={s.readyThumbImg}
                            shouldPlay={false}
                            isMuted
                            resizeMode={ResizeMode.COVER}
                          />
                          <View style={s.readyThumbOverlay}>
                            <Ionicons name="play-circle" size={20} color="#fff" />
                          </View>
                        </>
                      ) : (
                        <Ionicons name="barbell-outline" size={18} color={mc} />
                      )}
                    </TouchableOpacity>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={s.readyItemName} numberOfLines={2}>{item.name}</Text>
                      <View style={s.readyMeta}>
                        <View style={[s.musclePill, { backgroundColor: `${mc}22` }]}>
                          <View style={[s.muscleDot, { backgroundColor: mc }]} />
                          <Text style={[s.musclePillText, { color: mc }]}>{item.muscleGroup || 'Geral'}</Text>
                        </View>
                        {item.prescription ? <Text style={s.readyPresc}>{item.prescription}</Text> : null}
                      </View>
                    </View>

                    {/* Video pill */}
                    {hasVideo && (
                      <TouchableOpacity
                        style={[s.readyVideoPill, { backgroundColor: `${mc}18`, borderColor: `${mc}40` }]}
                        onPress={() => { setVideoTitle(item.name); setVideoUri(item.videoUrl!); }}
                        activeOpacity={0.75}
                      >
                        <Ionicons name={isGif ? 'image-outline' : 'play-circle-outline'} size={13} color={mc} />
                        <Text style={[s.readyVideoPillText, { color: mc }]}>{isGif ? 'GIF' : 'Vídeo'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* ── Accordion ── */}
                  {!!instruction && (
                    <>
                      <TouchableOpacity
                        style={s.readyAccordionToggle}
                        onPress={() => toggleReadyExpand(item.itemId)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'information-circle-outline'}
                          size={13}
                          color="rgba(255,255,255,0.35)"
                        />
                        <Text style={s.readyAccordionLabel}>
                          {isExpanded ? 'Fechar instruções' : 'Como executar'}
                        </Text>
                        <Ionicons name={isExpanded ? 'remove' : 'chevron-down'} size={12} color="rgba(255,255,255,0.2)" />
                      </TouchableOpacity>
                      {isExpanded && (
                        <View style={s.readyAccordionBody}>
                          <Text style={s.readyAccordionText}>{instruction}</Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={s.readyFooter}>
            <TouchableOpacity
              style={[s.startBtn, { backgroundColor: primaryColor }]}
              onPress={startWorkout}
              activeOpacity={0.87}
            >
              <Ionicons name="play" size={20} color="#000" />
              <Text style={s.startBtnText}>Iniciar Treino</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Modal de vídeo compartilhado com a fase active */}
        {videoUri && (
          <MediaViewerModal
            visible uri={videoUri}
            type={videoUri.toLowerCase().includes('.gif') ? 'image' : 'video'}
            title={videoTitle}
            onClose={() => setVideoUri(null)}
          />
        )}
      </View>
    );
  }

  // ── Active ──
  const mc = currentItem ? muscleColor(currentItem.muscleGroup) : primaryColor;
  const currentLoad = currentItem ? (loadValues[currentItem.itemId] ?? '') : '';
  const instruction = currentItem ? (currentItem.itemNotes || currentItem.exerciseInstructions) : null;

  return (
    <View style={s.safe}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── Top bar ── */}
        <View style={s.topBar}>
          <TouchableOpacity style={s.iconBtn} onPress={handleAbandon}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <View style={s.topCenter}>
            <Text style={s.topPlanName} numberOfLines={1}>{planName}</Text>
            <View style={s.timerRow}>
              <Ionicons name="time-outline" size={12} color={primaryColor} />
              <Text style={[s.timerText, { color: primaryColor }]}>{fmtTime(sessionSecs)}</Text>
            </View>
          </View>
          {/* Botão de finalizar — compacto no header, mais visível quando há progresso */}
          <TouchableOpacity
            style={[
              s.finishPill,
              hasAnyDone
                ? { borderColor: primaryColor, backgroundColor: `${primaryColor}18` }
                : { borderColor: 'rgba(255,255,255,0.12)' },
            ]}
            onPress={openFinish}
            activeOpacity={0.8}
          >
            {hasAnyDone && <Ionicons name="checkmark-circle" size={13} color={primaryColor} />}
            <Text style={[s.finishPillText, hasAnyDone && { color: primaryColor }]}>Finalizar</Text>
          </TouchableOpacity>
        </View>

        {/* ── Main content ── */}
        {isResting ? (
          // ── Rest view ──
          <View style={s.restView}>
            <Text style={s.exNameRest} numberOfLines={2}>{currentItem?.name}</Text>
            <Text style={s.exNextLabel}>Próxima série em...</Text>
            <RestRing remaining={restRemaining} total={restTotal} primaryColor={primaryColor} />
            <TouchableOpacity
              style={[s.skipRestBtn, { borderColor: `${primaryColor}60` }]}
              onPress={skipRest}
              activeOpacity={0.8}
            >
              <Text style={[s.skipRestText, { color: primaryColor }]}>Pular descanso</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // ── Exercise view ──
          <ScrollView
            contentContainerStyle={s.exView}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Exercise header */}
            <View style={s.exHeader}>
              {/* Thumbnail */}
              {currentItem?.videoUrl ? (
                <TouchableOpacity
                  style={s.thumbWrap}
                  onPress={() => { setVideoTitle(currentItem.name); setVideoUri(currentItem.videoUrl); }}
                  activeOpacity={0.8}
                >
                  {currentItem.videoUrl.toLowerCase().includes('.gif') ? (
                    <Image source={{ uri: currentItem.videoUrl }} style={s.thumb} resizeMode="cover" />
                  ) : (
                    <>
                      <Video source={{ uri: currentItem.videoUrl }} style={s.thumb} shouldPlay={false} isMuted resizeMode={ResizeMode.COVER} />
                      <View style={s.playOverlay}>
                        <Ionicons name="play-circle" size={28} color="#fff" />
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={[s.thumbWrap, s.thumbPlaceholder, { backgroundColor: `${mc}20` }]}>
                  <Ionicons name="barbell-outline" size={28} color={mc} />
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={s.exName} numberOfLines={3}>{currentItem?.name}</Text>
                <View style={[s.musclePill, { backgroundColor: `${mc}20`, alignSelf: 'flex-start', marginTop: 8 }]}>
                  <View style={[s.muscleDot, { backgroundColor: mc }]} />
                  <Text style={[s.musclePillText, { color: mc }]}>{currentItem?.muscleGroup || 'Geral'}</Text>
                </View>
              </View>
            </View>

            {/* Instruction accordion — recolhida por padrão */}
            {instruction && (
              <View style={s.accordionWrap}>
                <TouchableOpacity
                  style={s.accordionToggle}
                  onPress={() => setInstrExpanded(v => !v)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={instrExpanded ? 'chevron-up' : 'information-circle-outline'}
                    size={14}
                    color="rgba(255,255,255,0.4)"
                  />
                  <Text style={s.accordionToggleText}>
                    {instrExpanded ? 'Fechar instruções' : 'Como executar'}
                  </Text>
                  <Ionicons
                    name={instrExpanded ? 'remove' : 'chevron-down'}
                    size={14}
                    color="rgba(255,255,255,0.25)"
                  />
                </TouchableOpacity>
                {instrExpanded && (
                  <View style={s.accordionBody}>
                    <Text style={s.instructionText}>{instruction}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Series chips */}
            <View style={s.seriesRow}>
              {currentSeries.map((done, idx) => {
                const isCurrent = idx === currentSeriesIdx;
                const isUpcoming = !done && idx > currentSeriesIdx;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      s.seriesChip,
                      done && { backgroundColor: `${primaryColor}25`, borderColor: primaryColor },
                      isCurrent && { borderColor: primaryColor, borderWidth: 2 },
                      isUpcoming && { opacity: 0.4 },
                    ]}
                    onPress={() => {
                      // Allow toggling series manually
                      const updated = [...currentSeries];
                      updated[idx] = !updated[idx];
                      setSeriesDone(prev => ({ ...prev, [currentItem!.itemId]: updated }));
                    }}
                    activeOpacity={0.75}
                  >
                    {done ? (
                      <Ionicons name="checkmark" size={12} color={primaryColor} />
                    ) : null}
                    <Text style={[s.seriesChipText, done && { color: primaryColor }, isCurrent && { color: '#fff' }]}>
                      Série {idx + 1}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Stats row */}
            <View style={s.statsRow}>
              <View style={s.statBlock}>
                <View style={s.statIconRow}>
                  <Ionicons name="fitness-outline" size={22} color="rgba(255,255,255,0.5)" />
                  <Text style={s.statValue}>
                    {currentLoad || '—'}
                    {currentLoad ? <Text style={s.statUnit}> kg</Text> : null}
                  </Text>
                </View>
                <Text style={s.statLabel}>Carga Atual</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statBlock}>
                <View style={s.statIconRow}>
                  <Ionicons name="body-outline" size={22} color="rgba(255,255,255,0.5)" />
                  <Text style={s.statValue}>
                    {currentItem?.defaultReps || currentItem?.prescription || '—'}
                  </Text>
                </View>
                <Text style={s.statLabel}>Repetições</Text>
              </View>
            </View>

            {/* Action buttons */}
            {currentSeriesIdx !== -1 ? (
              <TouchableOpacity
                style={[s.mainBtn, { backgroundColor: primaryColor }]}
                onPress={completeSeries}
                activeOpacity={0.87}
              >
                <Text style={s.mainBtnText}>Concluir Série {currentSeriesIdx + 1}</Text>
              </TouchableOpacity>
            ) : (
              <View style={[s.mainBtn, { backgroundColor: `${primaryColor}30`, borderWidth: 1.5, borderColor: primaryColor }]}>
                <Ionicons name="checkmark-circle" size={20} color={primaryColor} />
                <Text style={[s.mainBtnText, { color: primaryColor }]}>Exercício concluído</Text>
              </View>
            )}

            {/* Adjust load + manual rest timer — same row */}
            <View style={s.secondaryRow}>
              <TouchableOpacity
                style={s.adjustBtn}
                onPress={() => { setTempLoad(currentLoad); setShowLoadModal(true); }}
                activeOpacity={0.75}
              >
                <Ionicons name="barbell-outline" size={14} color="rgba(255,255,255,0.4)" />
                <Text style={s.adjustBtnText}>Ajustar Carga</Text>
              </TouchableOpacity>

              {/* Botão manual de pausa — sempre visível durante o treino */}
              <TouchableOpacity
                style={[s.restManualBtn, { borderColor: `${primaryColor}50` }]}
                onPress={() => startRest(currentItem?.restSeconds ?? 60)}
                activeOpacity={0.78}
              >
                <Ionicons name="timer-outline" size={15} color={primaryColor} />
                <Text style={[s.restManualBtnText, { color: primaryColor }]}>
                  {currentItem?.restSeconds ? `Pausar ${fmtTime(currentItem.restSeconds)}` : 'Pausar 1:00'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Exercise navigation */}
            <View style={s.navRow}>
              <TouchableOpacity
                style={[s.navBtn, currentExIdx === 0 && { opacity: 0.3 }]}
                onPress={() => goToExercise(currentExIdx - 1)}
                disabled={currentExIdx === 0}
                activeOpacity={0.75}
              >
                <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.6)" />
                <Text style={s.navBtnText}>Anterior</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.navBtn, isLastExercise && { opacity: 0.3 }]}
                onPress={() => goToExercise(currentExIdx + 1)}
                disabled={isLastExercise}
                activeOpacity={0.75}
              >
                <Text style={s.navBtnText}>Próximo</Text>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* ── Botão flutuante "Finalizar Treino" — aparece quando há progresso ── */}
        {hasAnyDone && !isResting && !allWorkoutDone && (
          <TouchableOpacity
            style={[s.floatFinish, { backgroundColor: `${primaryColor}22`, borderColor: `${primaryColor}60` }]}
            onPress={openFinish}
            activeOpacity={0.85}
          >
            <Ionicons name="flag-outline" size={16} color={primaryColor} />
            <Text style={[s.floatFinishText, { color: primaryColor }]}>Finalizar Treino</Text>
          </TouchableOpacity>
        )}

        {/* ── Progress footer ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>{currentExIdx + 1} de {flatItems.length} exercícios</Text>
          <View style={s.progressTrack}>
            {flatItems.map((it, idx) => {
              const done = (seriesDone[it.itemId] ?? []).every(Boolean) && (seriesDone[it.itemId] ?? []).length > 0;
              const isCur = idx === currentExIdx;
              return (
                <TouchableOpacity
                  key={it.itemId}
                  style={[
                    s.progressDot,
                    done && { backgroundColor: primaryColor },
                    isCur && !done && { backgroundColor: primaryColor, opacity: 0.5, width: 20, borderRadius: 4 },
                  ]}
                  onPress={() => goToExercise(idx)}
                  activeOpacity={0.7}
                />
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      {/* ── Modal: treino completo! ── */}
      <Modal visible={showDoneModal} transparent animationType="fade"
        onRequestClose={() => setShowDoneModal(false)}>
        <View style={s.doneOverlay}>
          <View style={s.doneSheet}>
            <Text style={s.doneEmoji}>🏆</Text>
            <Text style={s.doneTitle}>Treino Concluído!</Text>
            <Text style={s.doneDesc}>
              Você completou todos os exercícios do {planName}.{'\n'}
              Hora de registrar e ganhar seus pontos!
            </Text>

            {/* Resumo rápido */}
            <View style={[s.doneSummary, { borderColor: `${primaryColor}30` }]}>
              <View style={s.doneStat}>
                <Text style={[s.doneStatNum, { color: primaryColor }]}>{fmtTime(sessionSecs)}</Text>
                <Text style={s.doneStatLabel}>Duração</Text>
              </View>
              <View style={s.doneStatDiv} />
              <View style={s.doneStat}>
                <Text style={[s.doneStatNum, { color: primaryColor }]}>{flatItems.length}</Text>
                <Text style={s.doneStatLabel}>Exercícios</Text>
              </View>
              <View style={s.doneStatDiv} />
              <View style={s.doneStat}>
                <Text style={[s.doneStatNum, { color: primaryColor }]}>
                  {flatItems.reduce((acc, it) => acc + (seriesDone[it.itemId] ?? []).filter(Boolean).length, 0)}
                </Text>
                <Text style={s.doneStatLabel}>Séries</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[s.doneFinishBtn, { backgroundColor: primaryColor }]}
              onPress={() => { setShowDoneModal(false); openFinish(); }}
              activeOpacity={0.87}
            >
              <Ionicons name="trophy" size={18} color="#000" />
              <Text style={s.doneFinishBtnText}>Salvar e ver pontuação</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.doneContinueBtn}
              onPress={() => setShowDoneModal(false)}
              activeOpacity={0.75}
            >
              <Text style={s.doneContinueBtnText}>Continuar treinando</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Load adjustment modal ── */}
      <Modal visible={showLoadModal} transparent animationType="fade" onRequestClose={() => setShowLoadModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={s.loadOverlay} activeOpacity={1} onPress={() => setShowLoadModal(false)}>
            <TouchableOpacity style={s.loadSheet} activeOpacity={1}>
              <Text style={s.loadTitle}>Ajustar Carga</Text>
              <Text style={s.loadSubtitle}>{currentItem?.name}</Text>
              <View style={s.loadInputRow}>
                <TextInput
                  style={s.loadInput}
                  value={tempLoad}
                  onChangeText={setTempLoad}
                  placeholder="0"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="decimal-pad"
                  autoFocus
                  selectTextOnFocus
                />
                <Text style={s.loadUnit2}>kg</Text>
              </View>
              <TouchableOpacity
                style={[s.loadSaveBtn, { backgroundColor: primaryColor }]}
                onPress={() => {
                  if (currentItem) setLoadValues(prev => ({ ...prev, [currentItem.itemId]: tempLoad }));
                  setShowLoadModal(false);
                }}
                activeOpacity={0.87}
              >
                <Text style={s.loadSaveBtnText}>Salvar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

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
                  <Text style={[s.summaryNum, { color: primaryColor }]}>{totalDoneItems}/{flatItems.length}</Text>
                  <Text style={s.summaryLabel}>Exercícios</Text>
                </View>
              </View>

              {fetchingMetrics && (
                <View style={s.wearableCard}>
                  <Text style={s.wearableIcon}>⌚</Text>
                  <Text style={s.wearableTitle}>Buscando dados do smartwatch...</Text>
                  <ActivityIndicator color={primaryColor} style={{ marginTop: 8 }} />
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
                        <Text style={[s.wearableValue, { color: '#EF4444' }]}>{wearableMetrics.heartRateAvg}{wearableMetrics.heartRateMax !== null && `/${wearableMetrics.heartRateMax}`}</Text>
                        <Text style={s.wearableLabel}>FC méd/máx</Text>
                      </View>
                    )}
                    {wearableMetrics.caloriesActive !== null && (
                      <View style={s.wearableMetric}>
                        <Text style={[s.wearableValue, { color: '#F59E0B' }]}>{wearableMetrics.caloriesActive}</Text>
                        <Text style={s.wearableLabel}>Calorias</Text>
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

              <Text style={[s.finishSectionLabel, { marginTop: 16 }]}>AVALIAÇÃO</Text>
              <View style={s.starsRow}>
                <StarRow rating={finishRating} onRate={setFinishRating} />
                {finishRating > 0 && (
                  <Text style={[s.starLabel, { color: STAR_COLORS[finishRating] }]}>{STAR_LABELS[finishRating]}</Text>
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

              <Text style={[s.finishSectionLabel, { marginTop: 16 }]}>
                OBSERVAÇÕES <Text style={s.optional}>(opcional)</Text>
              </Text>
              <TextInput
                value={finishNotes}
                onChangeText={setFinishNotes}
                style={s.notesInput}
                placeholder="Como se sentiu? Dificuldades, conquistas..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                textAlignVertical="top"
              />

              <View style={[s.finishBtns, { paddingBottom: 36 }]}>
                <TouchableOpacity
                  style={s.backBtn}
                  onPress={() => {
                    setPhase('active');
                    timerRef.current = setInterval(() => {
                      if (sessionStart.current) {
                        setSessionSecs(Math.floor((Date.now() - sessionStart.current.getTime()) / 1000));
                      }
                    }, 1000);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={s.backBtnText}>Voltar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.saveBtn, { backgroundColor: primaryColor }]} onPress={handleSave} activeOpacity={0.87}>
                  <Ionicons name="checkmark-circle" size={18} color="#000" />
                  <Text style={s.saveBtnText}>Salvar Treino</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {videoUri && (
        <MediaViewerModal
          visible uri={videoUri}
          type={videoUri.toLowerCase().includes('.gif') ? 'image' : 'video'}
          title={videoTitle}
          onClose={() => setVideoUri(null)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const BG = '#0D0D0D';
const SURFACE = '#181818';
const BORDER = 'rgba(255,255,255,0.1)';
const THUMB_SIZE = 80;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  savingText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: BORDER,
    gap: 8,
  },
  topCenter: { flex: 1, alignItems: 'center', gap: 2 },
  topPlanName: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerText: { fontFamily: FontFamily.bodyBold, fontSize: 13 },
  finishPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5,
  },
  finishPillText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: 'rgba(255,255,255,0.4)' },

  // Botão flutuante de finalizar
  floatFinish: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, marginBottom: 6,
    paddingVertical: 12, borderRadius: 14, borderWidth: 1.5,
  },
  floatFinishText: { fontFamily: FontFamily.bodyBold, fontSize: 13 },

  // Modal de treino completo
  doneOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  doneSheet: {
    backgroundColor: '#1A1A1A', borderRadius: 28,
    padding: 28, width: '100%', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  doneEmoji:   { fontSize: 52 },
  doneTitle:   { fontFamily: FontFamily.display, fontSize: 26, color: '#fff', textAlign: 'center' },
  doneDesc:    { fontFamily: FontFamily.body, fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 20 },
  doneSummary: { flexDirection: 'row', borderWidth: 1.5, borderRadius: 18, padding: 16, width: '100%' },
  doneStat:    { flex: 1, alignItems: 'center', gap: 4 },
  doneStatNum: { fontFamily: FontFamily.bodyBold, fontSize: 22 },
  doneStatLabel: { fontFamily: FontFamily.body, fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  doneStatDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 8 },
  doneFinishBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 16, marginTop: 4,
  },
  doneFinishBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: '#000' },
  doneContinueBtn:   { paddingVertical: 10 },
  doneContinueBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.4)' },

  // ── Ready phase ──
  readyHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  readyPlanName: { flex: 1, fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  readyScroll: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24 },
  readyTitle: { fontFamily: FontFamily.display, fontSize: 30, color: '#fff', lineHeight: 36, marginBottom: 8 },
  readyDivider: { height: 3, width: 40, borderRadius: 2, marginBottom: 18 },
  // Each exercise card in ready
  readyItem: { paddingVertical: 12 },
  readyItemBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readyThumb: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
  },
  readyThumbImg: { width: 52, height: 52 },
  readyThumbOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  readyItemName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: '#fff', lineHeight: 18 },
  readyMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  readyPresc: { fontFamily: FontFamily.body, fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  readyVideoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, flexShrink: 0,
  },
  readyVideoPillText: { fontFamily: FontFamily.bodyBold, fontSize: 10 },
  readyAccordionToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8,
  },
  readyAccordionLabel: {
    flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  readyAccordionBody: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10, padding: 12, marginBottom: 4,
  },
  readyAccordionText: {
    fontFamily: FontFamily.body, fontSize: 12,
    color: 'rgba(255,255,255,0.5)', lineHeight: 18,
  },
  readyFooter: { padding: 18, paddingBottom: 28 },
  startBtn: {
    borderRadius: 18, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  startBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: '#000' },

  // ── Rest view ──
  restView: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, gap: 20 },
  exNameRest: { fontFamily: FontFamily.bodyBold, fontSize: 22, color: '#fff', textAlign: 'center', lineHeight: 28 },
  exNextLabel: { fontFamily: FontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 },
  skipRestBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 18, borderWidth: 1.5 },
  skipRestText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },

  // ── Exercise view ──
  exView: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 24, gap: 20 },
  exHeader: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  thumbWrap: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 16, overflow: 'hidden', flexShrink: 0 },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE },
  playOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  exName: { fontFamily: FontFamily.display, fontSize: 26, color: '#fff', lineHeight: 30 },
  musclePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  muscleDot: { width: 6, height: 6, borderRadius: 3 },
  musclePillText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  accordionWrap: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  accordionToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 10, paddingHorizontal: 4,
  },
  accordionToggleText: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium, fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  accordionBody: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  instructionText: { fontFamily: FontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 18 },

  // Series chips
  seriesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seriesChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  seriesChipText: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: 'rgba(255,255,255,0.5)' },

  // Stats
  statsRow: { flexDirection: 'row', backgroundColor: SURFACE, borderRadius: 18, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },
  statBlock: { flex: 1, alignItems: 'center', paddingVertical: 18, gap: 6 },
  statIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statValue: { fontFamily: FontFamily.bodyBold, fontSize: 28, color: '#fff' },
  statUnit: { fontFamily: FontFamily.body, fontSize: 16, color: 'rgba(255,255,255,0.5)' },
  statLabel: { fontFamily: FontFamily.body, fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: BORDER, marginVertical: 16 },

  // Buttons
  mainBtn: {
    borderRadius: 18, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  mainBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: '#000' },
  secondaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 4 },
  adjustBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, flex: 1, justifyContent: 'center' },
  adjustBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  restManualBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1.5, flex: 1, justifyContent: 'center',
  },
  restManualBtnText: { fontFamily: FontFamily.bodyBold, fontSize: 12 },

  // Nav
  navRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4 },
  navBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: 'rgba(255,255,255,0.4)' },

  // Progress footer
  footer: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: BORDER, gap: 8 },
  footerText: { fontFamily: FontFamily.body, fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },
  progressTrack: { flexDirection: 'row', gap: 5, justifyContent: 'center', alignItems: 'center' },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BORDER },

  // Load modal
  loadOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  loadSheet: { backgroundColor: SURFACE, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40, alignItems: 'center' },
  loadTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.lg, color: '#fff', marginBottom: 4 },
  loadSubtitle: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.4)', marginBottom: 24 },
  loadInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  loadInput: { fontFamily: FontFamily.display, fontSize: 56, color: '#fff', minWidth: 100, textAlign: 'center' },
  loadUnit2: { fontFamily: FontFamily.bodyMedium, fontSize: 22, color: 'rgba(255,255,255,0.35)' },
  loadSaveBtn: { width: '100%', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  loadSaveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: '#000' },

  // Finish modal
  finishOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  finishSheet: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, maxHeight: '92%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 12 },
  finishTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.lg, color: '#fff', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 18, borderWidth: 1.5, padding: 20 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryNum: { fontFamily: FontFamily.bodyBold, fontSize: 28 },
  summaryLabel: { fontFamily: FontFamily.body, fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  summaryDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 12 },
  wearableCard: { backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 14, marginTop: 12 },
  wearableHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  wearableIcon: { fontSize: 16 },
  wearableTitle: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: '#fff' },
  wearableMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  wearableMetric: { flex: 1, minWidth: 80, alignItems: 'center', gap: 2 },
  wearableValue: { fontFamily: FontFamily.bodyBold, fontSize: 20 },
  wearableLabel: { fontFamily: FontFamily.body, fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  finishSectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 10 },
  optional: { fontFamily: FontFamily.body, fontWeight: '400', letterSpacing: 0 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  starLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
  intensityBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, backgroundColor: '#111' },
  intensityEmoji: { fontSize: 18 },
  intensityLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  notesInput: { backgroundColor: '#111', borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: '#fff', minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
  finishBtns: { flexDirection: 'row', gap: 10 },
  backBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: BORDER, paddingVertical: 14, alignItems: 'center' },
  backBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.4)' },
  saveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: '#000' },
});

// ─── Rest ring styles ─────────────────────────────────────────────────────────
const rt = StyleSheet.create({
  ringTime: { fontFamily: FontFamily.bodyBold, fontSize: 58, lineHeight: 64 },
  ringLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 2.5 },
});
