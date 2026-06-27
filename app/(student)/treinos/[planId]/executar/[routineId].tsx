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
export default function RoutineExecutionScreen() {
  const { planId, routineId } = useLocalSearchParams<{ planId: string; routineId: string }>();
  const { selectedStudent } = useStudent();
  const { primaryColor } = useThemeStore();

  const [planName, setPlanName] = useState('Treino');
  const [routineName, setRoutineName] = useState('Rotina');
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>('ready');
  const [sessionSecs, setSessionSecs] = useState(0);
  const [currentExIdx, setCurrentExIdx] = useState(0);

  // seriesDone[itemId][seriesIdx] = true/false
  const [seriesDone, setSeriesDone] = useState<Record<string, boolean[]>>({});
  // load per item
  const [loadValues, setLoadValues] = useState<Record<string, string>>({});

  // Instruction accordion (tela active) — recolhido por padrão, reseta ao mudar de exercício
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

  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const restTimerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStart          = useRef<Date | null>(null);
  const restStartAt           = useRef<Date | null>(null); // wall clock para o descanso
  const restDuration          = useRef<number>(0);          // duração total do descanso atual
  const awaitingHcPermissions = useRef(false);              // flag: usuário foi ao HC conceder permissões

  const { openPermissionsSettings, getWorkoutMetrics } = useHealthConnect();

  // Derived flat list — now only from our single routine
  const routineSection = sections.find(sec => sec.routineId === routineId);
  const flatItems: ExItem[] = routineSection?.items || [];
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
    if (planId && routineId) load();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, [planId, routineId]);

  // Recompute timers from wall clock when app volta ao primeiro plano
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') return;
      if (phase === 'active' && sessionStart.current) {
        setSessionSecs(Math.floor((Date.now() - sessionStart.current.getTime()) / 1000));
      }
      if (phase === 'active' && isResting && restStartAt.current) {
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
      // Auto-retry métricas do smartwatch após usuário retornar do app Health Connect
      if (awaitingHcPermissions.current && sessionStart.current) {
        awaitingHcPermissions.current = false;
        const start = sessionStart.current;
        setFetchingMetrics(true);
        // Aguarda 1.5s para o HC sincronizar os dados antes de ler
        setTimeout(() => {
          getWorkoutMetrics(start, new Date())
            .catch(() => null)
            .then(metrics => {
              setWearableMetrics(metrics);
              setFetchingMetrics(false);
            });
        }, 1500);
      }
    });
    return () => sub.remove();
  }, [phase, isResting, getWorkoutMetrics]);

  // Init series state when sections load
  useEffect(() => {
    if (sections.length === 0) return;
    const initSeries: Record<string, boolean[]> = {};
    const initLoad: Record<string, string> = {};
    (routineSection?.items || []).forEach(it => {
      initSeries[it.itemId] = Array(Math.max(it.defaultSets, 1)).fill(false);
      initLoad[it.itemId] = it.currentLoad;
    });
    setSeriesDone(initSeries);
    setLoadValues(initLoad);
  }, [sections, routineId]);

  async function load() {
    const [planRes, routinesRes] = await Promise.all([
      supabase.from('workout_plans').select('name').eq('id', planId).single(),
      supabase.from('workout_routines').select('id, name, display_order').eq('workout_plan_id', planId).order('display_order'),
    ]);
    setPlanName(planRes.data?.name || 'Treino');
    
    // Find our specific routine
    const ourRoutine = routinesRes.data?.find(r => r.id === routineId);
    setRoutineName(ourRoutine?.name || 'Rotina');

    const itemsRes = routineId
      ? await supabase
          .from('workout_items')
          .select('id, routine_id, exercise_id, display_order, sets, reps, load, duration_secs, rest_seconds, combo_group_id, notes, exercises(name, muscle_group, video_url, instructions)')
          .eq('routine_id', routineId)
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
    timerRef.current = setInterval(() => {
      if (sessionStart.current) {
        setSessionSecs(Math.floor((Date.now() - sessionStart.current.getTime()) / 1000));
      }
    }, 1000);
    setPhase('active');
    // Não solicitamos permissões do Health Connect aqui para evitar crash nativo
    // (requestPermission lança uma Activity Android que pode falhar silenciosamente).
    // As permissões são solicitadas apenas quando o usuário toca "Conectar Smartwatch"
    // na tela de finalização do treino.
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
    // Tenta ler métricas sem pedir permissão (silencioso — retorna null se não autorizado)
    if (sessionStart.current) {
      setFetchingMetrics(true);
      const metrics = await getWorkoutMetrics(sessionStart.current, new Date()).catch(() => null);
      setWearableMetrics(metrics);
      setFetchingMetrics(false);
    }
    setShowDoneModal(true);
  }

  async function handleConnectSmartwatch() {
    // Abre o Health Connect para o usuário conceder permissões.
    // Quando o usuário voltar, o AppState 'active' listener auto-busca os dados.
    awaitingHcPermissions.current = true;
    await openPermissionsSettings();
  }

  async function handleSave() {
    if (!selectedStudent) return;
    setPhase('saving');
    const finishedAt = new Date().toISOString();
    const startedAt = sessionStart.current?.toISOString() ?? finishedAt;

    const { data: session, error } = await supabase
      .from('workout_sessions')
      .insert({
        student_id: selectedStudent.id, tenant_id: selectedStudent.tenant_id,
        workout_plan_id: planId ?? null, workout_routine_id: routineId ?? null,
        started_at: startedAt, finished_at: finishedAt,
        duration_seconds: sessionSecs, intensity,
        notes: finishNotes.trim() || null,
        heart_rate_avg:   wearableMetrics?.heartRateAvg   ?? null,
        heart_rate_max:   wearableMetrics?.heartRateMax   ?? null,
        heart_rate_min:   wearableMetrics?.heartRateMin   ?? null,
        calories_active:  wearableMetrics?.caloriesActive ?? null,
        spo2_avg:         wearableMetrics?.spo2Avg        ?? null,
        steps:            wearableMetrics?.steps          ?? null,
        distance_meters:  wearableMetrics?.distanceMeters ?? null,
        wearable_source:  wearableMetrics?.source         ?? null,
        wearable_device:  wearableMetrics?.wearableDevice ?? null,
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
          p_student_id:      selectedStudent.id,
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
        tenant_id: selectedStudent.tenant_id, student_id: selectedStudent.id,
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
            <View style={{ alignItems: 'center' }}>
              <Text style={s.readyPlanName} numberOfLines={1}>{planName}</Text>
              <Text style={s.readyRoutineName} numberOfLines={1}>{routineName}</Text>
            </View>
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
              <Text style={s.startBtnText}>Iniciar {routineName}</Text>
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
            <Text style={s.topPlanName} numberOfLines={1}>{routineName}</Text>
            <View style={s.timerRow}>
              <Ionicons name="time-outline" size={12} color={primaryColor} />
              <Text style={[s.timerText, { color: primaryColor }]}>{fmtTime(sessionSecs)}</Text>
            </View>
          </View>
          {/* Botão de finalizar — sempre visível, mais proeminente */}
          <TouchableOpacity
            style={[
              s.finishPill,
              { borderColor: primaryColor, backgroundColor: `${primaryColor}18` },
            ]}
            onPress={openFinish}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={14} color={primaryColor} />
            <Text style={[s.finishPillText, { color: primaryColor }]}>Finalizar</Text>
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

            {/* Instruction accordion — recolhido por padrão */}
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
            <Text style={s.doneTitle}>Rotina concluída!</Text>
            <Text style={s.doneDesc}>
              Você completou todos os exercícios de {routineName}.{'\n'}
              Hora de registrar e ganhar seus pontos!
            </Text>

            {/* Resumo rápido */}
            <View style={[s.doneSummary, { borderColor: `${primaryColor}30` }]}>
              <View style={s.doneStat}>
                <Text style={[s.doneStatNum, { color: primaryColor }]}>{fmtTime(sessionSecs)}</Text>
                <Text style={s.doneStatLabel}>Duração</Text>
              </View>
              <View style={s.doneDivider} />
              <View style={s.doneStat}>
                <Text style={[s.doneStatNum, { color: primaryColor }]}>{totalDoneItems}</Text>
                <Text style={s.doneStatLabel}>Exercícios</Text>
              </View>
            </View>

            {/* Rating */}
            <Text style={s.doneSectionTitle}>Como foi o treino?</Text>
            <StarRow rating={finishRating} onRate={setFinishRating} />

            {/* Intensidade */}
            <Text style={s.doneSectionTitle}>Intensidade</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {INTENSITIES.map(int => (
                <TouchableOpacity
                  key={int.key}
                  style={[
                    s.intensityBtn,
                    intensity === int.key && { borderColor: int.color, backgroundColor: `${int.color}20` },
                  ]}
                  onPress={() => setIntensity(int.key)}
                >
                  <Text style={{ fontSize: 16 }}>{int.emoji}</Text>
                  <Text style={[
                    s.intensityBtnText,
                    intensity === int.key && { color: int.color },
                  ]}>{int.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Notes */}
            <Text style={s.doneSectionTitle}>Observações (opcional)</Text>
            <TextInput
              style={s.doneInput}
              placeholder="Como se sentiu hoje? Alguma dica para você mesmo?"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={finishNotes}
              onChangeText={setFinishNotes}
              multiline
            />

            {/* Smartwatch metrics area */}
            {!wearableMetrics ? (
              <TouchableOpacity
                style={s.hcBtn}
                onPress={handleConnectSmartwatch}
                disabled={fetchingMetrics}
              >
                {fetchingMetrics ? (
                  <ActivityIndicator color={primaryColor} />
                ) : (
                  <>
                    <Ionicons name="watch-outline" size={18} color={primaryColor} />
                    <Text style={[s.hcBtnText, { color: primaryColor }]}>
                      Conectar smartwatch
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={s.hcResult}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {wearableMetrics.heartRateAvg !== null && (
                    <View style={s.hcMetric}>
                      <Ionicons name="heart-outline" size={16} color="rgba(255,255,255,0.5)" />
                      <Text style={s.hcMetricText}>{wearableMetrics.heartRateAvg} bpm</Text>
                    </View>
                  )}
                  {wearableMetrics.caloriesActive !== null && (
                    <View style={s.hcMetric}>
                      <Ionicons name="flame-outline" size={16} color="rgba(255,255,255,0.5)" />
                      <Text style={s.hcMetricText}>{Math.round(wearableMetrics.caloriesActive)} kcal</Text>
                    </View>
                  )}
                  {wearableMetrics.steps !== null && (
                    <View style={s.hcMetric}>
                      <Ionicons name="walk-outline" size={16} color="rgba(255,255,255,0.5)" />
                      <Text style={s.hcMetricText}>{wearableMetrics.steps.toLocaleString('pt-BR')} passos</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity
                style={[s.doneBtn, s.doneBtnSecondary]}
                onPress={() => setShowDoneModal(false)}
              >
                <Text style={s.doneBtnTextSecondary}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.doneBtn, { backgroundColor: primaryColor, flex: 1 }]}
                onPress={handleSave}
              >
                <Ionicons name="checkmark" size={20} color="#000" />
                <Text style={s.doneBtnText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Load adjustment modal ── */}
      <Modal visible={showLoadModal} transparent animationType="slide"
        onRequestClose={() => setShowLoadModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.loadOverlay}>
            <View style={s.loadSheet}>
              <View style={s.loadHeader}>
                <Text style={s.loadTitle}>Ajustar carga</Text>
                <TouchableOpacity onPress={() => setShowLoadModal(false)}>
                  <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>

              <Text style={s.loadSub}>Nova carga para {currentItem?.name}</Text>
              <View style={s.loadInputRow}>
                <TextInput
                  style={s.loadInput}
                  placeholder="Ex: 20"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={tempLoad}
                  onChangeText={setTempLoad}
                  keyboardType="numeric"
                  autoFocus
                />
                <Text style={s.loadUnit}>kg</Text>
              </View>

              <TouchableOpacity
                style={[s.loadBtn, { backgroundColor: primaryColor }]}
                onPress={() => {
                  if (currentItem) {
                    setLoadValues(prev => ({ ...prev, [currentItem.itemId]: tempLoad }));
                  }
                  setShowLoadModal(false);
                }}
              >
                <Text style={s.loadBtnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Video modal ── */}
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

// ─── Styles ────────────────────────────────────────────────────────────────────

const rt = StyleSheet.create({
  ringTime: { fontFamily: FontFamily.display, fontSize: 48, letterSpacing: 2 },
  ringLabel: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginTop: 4 },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0E0E1A' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  savingText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)' },

  // ── Ready header ──
  readyHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  readyPlanName: { fontFamily: FontFamily.display, fontSize: FontSize.lg, color: '#fff' },
  readyRoutineName: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)' },

  // ── Ready scroll ──
  readyScroll: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 120,
  },
  readyTitle: { fontFamily: FontFamily.display, fontSize: 32, color: '#fff', marginBottom: 8 },
  readyDivider: { width: 40, height: 3, borderRadius: 2, marginBottom: 24 },

  // ── Ready item ──
  readyItem: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  readyItemBorder: { marginBottom: 8 },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  readyThumb: { width: 52, height: 52, borderRadius: 14, overflow: 'hidden' },
  readyThumbImg: { width: '100%', height: '100%' },
  readyThumbOverlay: {
    position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  readyItemName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: '#fff', flex: 1 },
  readyMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  musclePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  muscleDot: { width: 6, height: 6, borderRadius: 3 },
  musclePillText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  readyPresc: { fontFamily: FontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  readyVideoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, flexShrink: 0,
  },
  readyVideoPillText: { fontFamily: FontFamily.bodyBold, fontSize: 11 },
  readyAccordionToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  readyAccordionLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: 'rgba(255,255,255,0.4)', flex: 1 },
  readyAccordionBody: { marginTop: 8 },
  readyAccordionText: { fontFamily: FontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 18 },

  // ── Ready footer ──
  readyFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16,
    backgroundColor: 'rgba(14,14,26,0.95)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: 16,
  },
  startBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: '#000' },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  topCenter: { alignItems: 'center', gap: 2, flex: 1, paddingHorizontal: 12 },
  topPlanName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: '#fff' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerText: { fontFamily: FontFamily.bodyBold, fontSize: 12 },
  finishPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, flexShrink: 0,
  },
  finishPillText: { fontFamily: FontFamily.bodyBold, fontSize: 12, color: 'rgba(255,255,255,0.4)' },

  // ── Exercise view ──
  exView: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 140,
  },
  exHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 24 },
  thumbWrap: { width: 104, height: 104, borderRadius: 20, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  playOverlay: {
    position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  exName: { fontFamily: FontFamily.display, fontSize: 24, color: '#fff', flex: 1, lineHeight: 30 },

  // Accordion
  accordionWrap: { marginBottom: 24 },
  accordionToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: '#1A1A2E', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  accordionToggleText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: 'rgba(255,255,255,0.5)', flex: 1 },
  accordionBody: { paddingHorizontal: 14, paddingTop: 12 },
  instructionText: { fontFamily: FontFamily.body, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20 },

  // Series
  seriesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  seriesChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  seriesChipText: { fontFamily: FontFamily.bodyBold, fontSize: 12, color: 'rgba(255,255,255,0.5)' },

  // Stats
  statsRow: {
    flexDirection: 'row', backgroundColor: '#1A1A2E', borderRadius: 16,
    padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statBlock: { flex: 1, alignItems: 'center', gap: 4 },
  statIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { fontFamily: FontFamily.display, fontSize: 22, color: '#fff' },
  statUnit: { fontFamily: FontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  statLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },

  // Main button
  mainBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 16, marginBottom: 12,
  },
  mainBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: '#000' },

  // Secondary row
  secondaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  adjustBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, backgroundColor: '#1A1A2E', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  adjustBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  restManualBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  restManualBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 13 },

  // Nav
  navRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  navBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 12, backgroundColor: '#1A1A2E', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  navBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: 'rgba(255,255,255,0.6)' },

  // ── Rest view ──
  restView: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 100 },
  exNameRest: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: 'rgba(255,255,255,0.6)', marginBottom: 8 },
  exNextLabel: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.4)', marginBottom: 24 },
  skipRestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, borderWidth: 1, marginTop: 24,
  },
  skipRestText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },

  // ── Float finish ──
  floatFinish: {
    position: 'absolute', bottom: 100, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 16, borderWidth: 1,
  },
  floatFinishText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },

  // ── Footer ──
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingVertical: 16, paddingTop: 12,
    backgroundColor: 'rgba(14,14,26,0.95)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerText: { fontFamily: FontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 10 },
  progressTrack: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)' },

  // ── Done modal ──
  doneOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  doneSheet: {
    backgroundColor: '#0E0E1A', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, gap: 20,
  },
  doneEmoji: { fontSize: 48, textAlign: 'center', marginBottom: 4 },
  doneTitle: { fontFamily: FontFamily.display, fontSize: 24, color: '#fff', textAlign: 'center' },
  doneDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 20 },
  doneSummary: { flexDirection: 'row', backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, borderWidth: 1 },
  doneStat: { flex: 1, alignItems: 'center', gap: 4 },
  doneStatNum: { fontFamily: FontFamily.display, fontSize: 24 },
  doneStatLabel: { fontFamily: FontFamily.body, fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  doneDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  doneSectionTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)', marginBottom: -4 },
  intensityBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  intensityBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  doneInput: {
    width: '100%', backgroundColor: '#1A1A2E', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 80, textAlignVertical: 'top',
    fontFamily: FontFamily.body, fontSize: 13, color: '#fff',
  },
  hcBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, backgroundColor: '#1A1A2E', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  hcBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  hcResult: { padding: 14, backgroundColor: '#1A1A2E', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  hcMetric: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hcMetricText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 16,
  },
  doneBtnSecondary: { backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  doneBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: '#000' },
  doneBtnTextSecondary: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: 'rgba(255,255,255,0.6)' },

  // ── Load modal ──
  loadOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  loadSheet: {
    backgroundColor: '#0E0E1A', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, gap: 16,
  },
  loadHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loadTitle: { fontFamily: FontFamily.display, fontSize: 20, color: '#fff' },
  loadSub: { fontFamily: FontFamily.body, fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  loadInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1A1A2E', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4 },
  loadInput: { flex: 1, fontFamily: FontFamily.display, fontSize: 20, color: '#fff', paddingVertical: 10 },
  loadUnit: { fontFamily: FontFamily.bodyBold, fontSize: 16, color: 'rgba(255,255,255,0.4)' },
  loadBtn: { paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  loadBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: '#000' },
});
