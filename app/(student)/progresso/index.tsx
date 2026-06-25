import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert, Dimensions,
  KeyboardAvoidingView, Platform, Image, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { TenantLogo } from '@/components/TenantLogo';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { MediaViewerModal } from '@/components/MediaViewerModal';

const { width: W } = Dimensions.get('window');
const CHART_W = W - 48;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = 'progress-photos';

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Seg → Dom

interface ProgressEntry {
  id: string;
  recorded_at: string;
  weight: number | null;
  notes: string | null;
  photo_urls: string[];
}
interface WeekPoint { label: string; avgLoad: number; dateRange: string }
interface DayCount  { day: number; count: number }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
function weekLabel(n: number) { return `Sem ${n}`; }

// ─── Corrigido: usa fetch+FormData (sem expo-file-system/legacy) ──────────────
async function uploadPhotos(
  assets: ImagePicker.ImagePickerAsset[],
  tenantId: string,
  studentId: string,
  token: string,
): Promise<string[]> {
  const urls: string[] = [];
  for (const photo of assets) {
    const uid  = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const ext  = photo.mimeType?.split('/')[1] ?? photo.uri.split('.').pop() ?? 'jpg';
    const path = `${tenantId}/${studentId}/${uid}.${ext}`;

    const body = new FormData();
    body.append('file', { uri: photo.uri, type: photo.mimeType ?? 'image/jpeg', name: `photo.${ext}` } as any);

    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY },
      body,
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(`Falha ao enviar foto: ${msg}`);
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

function storagePath(publicUrl: string) {
  const m = `${BUCKET}/`;
  const i = publicUrl.indexOf(m);
  return i >= 0 ? publicUrl.slice(i + m.length) : '';
}

// ─── Line chart ───────────────────────────────────────────────────────────────
function LineChart({ points, color, height = 110 }: {
  points: { x: number; y: number; label: string; value: string }[];
  color: string;
  height?: number;
}) {
  if (points.length < 2) return null;
  const W_CHART = CHART_W - 24;

  const lines: { x1: number; y1: number; len: number; angle: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    lines.push({
      x1: points[i].x, y1: points[i].y,
      len: Math.sqrt(dx * dx + dy * dy),
      angle: Math.atan2(dy, dx) * 180 / Math.PI,
    });
  }

  return (
    <View style={{ height, width: W_CHART, marginTop: 8 }}>
      {/* Connecting lines */}
      {lines.map((l, i) => (
        <View key={i} style={{
          position: 'absolute',
          left: l.x1, top: l.y1,
          width: l.len, height: 2,
          backgroundColor: color,
          borderRadius: 1,
          opacity: 0.7,
          transform: [
            { translateY: -1 },
            { rotate: `${l.angle}deg` },
            { translateX: l.len / 2 - l.x1 },
          ],
          transformOrigin: `0px 1px`,
        }} />
      ))}
      {/* Dots + values */}
      {points.map((p, i) => (
        <View key={i} style={{ position: 'absolute', left: p.x, top: p.y, alignItems: 'center' }}>
          <View style={{
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: color,
            transform: [{ translateX: -5 }, { translateY: -5 }],
          }} />
          <Text style={{
            fontFamily: FontFamily.bodyBold, fontSize: 10, color,
            transform: [{ translateX: -5 }, { translateY: -20 }],
          }}>{p.value}</Text>
        </View>
      ))}
      {/* X labels */}
      {points.map((p, i) => (
        <Text key={i} style={{
          position: 'absolute', left: p.x - 20, top: height - 16,
          fontFamily: FontFamily.body, fontSize: 9, color: 'rgba(255,255,255,0.4)',
          width: 40, textAlign: 'center',
        }}>{p.label}</Text>
      ))}
    </View>
  );
}

// ─── Weekly bar chart ─────────────────────────────────────────────────────────
function WeeklyBars({ dayCounts, color }: { dayCounts: DayCount[]; color: string }) {
  const maxCount = Math.max(...dayCounts.map(d => d.count), 1);
  const BAR_H = 72;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 12 }}>
      {WEEK_ORDER.map(dayIdx => {
        const dc = dayCounts.find(d => d.day === dayIdx);
        const count = dc?.count ?? 0;
        const barH = count > 0 ? Math.max(12, (count / maxCount) * BAR_H) : 6;
        const hasWorkout = count > 0;
        return (
          <View key={dayIdx} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <Text style={bs.barCount}>{count}</Text>
            <View style={[bs.bar, {
              height: barH,
              backgroundColor: hasWorkout ? color : 'rgba(255,255,255,0.08)',
            }]} />
            <Text style={bs.barLabel}>{DAY_LABELS[dayIdx].slice(0, 3).toUpperCase()}</Text>
          </View>
        );
      })}
    </View>
  );
}

const bs = StyleSheet.create({
  bar:      { width: '100%', borderRadius: 6, minHeight: 6 },
  barCount: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  barLabel: { fontFamily: FontFamily.body, fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 },
});

// ─── Animated counter ─────────────────────────────────────────────────────────
function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => setDisp(Math.floor(v * 10) / 10));
    Animated.timing(anim, { toValue: value, duration: 900, useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value]);
  return <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 28, color: '#fff' }}>{disp}{suffix}</Text>;
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ProgressoScreen() {
  const { student } = useStudent();
  const { primaryColor } = useThemeStore();
  const lightText = ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(primaryColor);

  const [tab, setTab] = useState<'evolucao' | 'corpo'>('evolucao');
  const [loading, setLoading] = useState(true);

  // Evolution data
  const [totalWorkouts, setTotalWorkouts]   = useState(0);
  const [weeklyRate, setWeeklyRate]         = useState(0);
  const [avgLoadDelta, setAvgLoadDelta]     = useState(0);
  const [weekPoints, setWeekPoints]         = useState<WeekPoint[]>([]);
  const [dayCounts, setDayCounts]           = useState<DayCount[]>([]);

  // Body / progress data
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [addVisible, setAddVisible]     = useState(false);
  const [fWeight, setFWeight]           = useState('');
  const [fNotes, setFNotes]             = useState('');
  const [pickedPhotos, setPickedPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [saving, setSaving]             = useState(false);
  const [editEntry, setEditEntry]       = useState<ProgressEntry | null>(null);
  const [editPhotos, setEditPhotos]     = useState<string[]>([]);
  const [editSaving, setEditSaving]     = useState(false);
  const [viewerUri, setViewerUri]       = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!student) return;
    const now     = new Date();
    const d30ago  = new Date(now); d30ago.setDate(d30ago.getDate() - 30);
    const d90ago  = new Date(now); d90ago.setDate(d90ago.getDate() - 90);

    // ── Body progress ─────────────────────────────────────────────────────────
    const { data: progressData } = await supabase
      .from('student_progress')
      .select('id, recorded_at, weight, notes, photo_urls')
      .eq('student_id', student.id)
      .order('recorded_at', { ascending: true })
      .limit(30);
    setEntries((progressData ?? []).map((e: any) => ({ ...e, photo_urls: e.photo_urls ?? [] })));

    // ── Sessions (últimos 30 dias) ────────────────────────────────────────────
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('id, started_at')
      .eq('student_id', student.id)
      .not('finished_at', 'is', null)
      .gte('started_at', d30ago.toISOString())
      .order('started_at', { ascending: true });

    const allSessions = sessions ?? [];
    setTotalWorkouts(allSessions.length);

    // Assiduidade semanal: % de dias com treino nas últimas 4 semanas
    const trainedDays = new Set(allSessions.map(s => new Date(s.started_at).toDateString()));
    const rate = Math.round((trainedDays.size / 28) * 100);
    setWeeklyRate(Math.min(rate, 100));

    // Frequência por dia da semana (últimos 30 dias)
    const dayMap: Record<number, number> = {};
    allSessions.forEach(s => {
      const d = new Date(s.started_at).getDay();
      dayMap[d] = (dayMap[d] ?? 0) + 1;
    });
    setDayCounts([0, 1, 2, 3, 4, 5, 6].map(d => ({ day: d, count: dayMap[d] ?? 0 })));

    // ── Exercise loads (últimos 90 dias para o gráfico semanal) ───────────────
    if (allSessions.length === 0) { setLoading(false); return; }

    const sessionIds = allSessions.map(s => s.id);
    const { data: exData } = await supabase
      .from('workout_session_exercises')
      .select('load_used, sets_done, session_id')
      .in('session_id', sessionIds)
      .not('load_used', 'is', null);

    // Mapeia session_id → semana relativa
    const weeklyLoads: Record<number, number[]> = {};
    const weeklyDates: Record<number, Date[]>   = {};
    (exData ?? []).forEach(ex => {
      const sess = allSessions.find(s => s.id === ex.session_id);
      if (!sess) return;
      const load = parseFloat(ex.load_used ?? '0');
      if (!load || isNaN(load)) return;
      const daysDiff = Math.floor((now.getTime() - new Date(sess.started_at).getTime()) / 86400000);
      const weekNum  = Math.floor(daysDiff / 7) + 1;
      if (weekNum > 4) return; // mostra 4 semanas
      if (!weeklyLoads[weekNum]) { weeklyLoads[weekNum] = []; weeklyDates[weekNum] = []; }
      const sets = ex.sets_done ?? 1;
      for (let i = 0; i < sets; i++) weeklyLoads[weekNum].push(load);
      weeklyDates[weekNum].push(new Date(sess.started_at));
    });

    // Semanas em ordem cronológica (4 → 1)
    const weeks: WeekPoint[] = [];
    for (let w = 4; w >= 1; w--) {
      const loads = weeklyLoads[w];
      if (!loads || loads.length === 0) continue;
      const avg = loads.reduce((a, b) => a + b, 0) / loads.length;
      const dates = weeklyDates[w];
      const oldest = dates.reduce((a, b) => a < b ? a : b);
      const newest = dates.reduce((a, b) => a > b ? a : b);
      weeks.push({
        label: weekLabel(5 - w),
        avgLoad: parseFloat(avg.toFixed(1)),
        dateRange: oldest === newest
          ? fmtDate(oldest.toISOString())
          : `${fmtDate(oldest.toISOString())} – ${fmtDate(newest.toISOString())}`,
      });
    }
    setWeekPoints(weeks);

    // Delta de carga: primeira vs última semana
    if (weeks.length >= 2) {
      setAvgLoadDelta(parseFloat((weeks[weeks.length - 1].avgLoad - weeks[0].avgLoad).toFixed(1)));
    }

    setLoading(false);
  }, [student?.id]);

  useEffect(() => { load(); }, [load]);

  // Build chart data points
  const CHART_H = 110;
  const chartValues = weekPoints.map(w => w.avgLoad);
  const minV = chartValues.length ? Math.min(...chartValues) - 5 : 0;
  const maxV = chartValues.length ? Math.max(...chartValues) + 5 : 100;
  const vRange = maxV - minV || 1;
  const chartPoints = weekPoints.map((w, i) => ({
    x: i === 0 ? 8 : (i / (weekPoints.length - 1)) * (CHART_W - 40),
    y: CHART_H - ((w.avgLoad - minV) / vRange) * CHART_H,
    label: w.label,
    value: `${w.avgLoad}`,
  }));

  // ── Photo handlers ────────────────────────────────────────────────────────
  async function pickAdd() {
    if (pickedPhotos.length >= 5) { Alert.alert('Máximo de 5 fotos.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.75,
    });
    if (!res.canceled) setPickedPhotos(prev => [...prev, ...res.assets].slice(0, 5));
  }

  async function handleAdd() {
    if (!student) return;
    if (!fWeight.trim() && pickedPhotos.length === 0) {
      Alert.alert('Informe o peso ou adicione uma foto.'); return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada.');
      const photoUrls = pickedPhotos.length > 0
        ? await uploadPhotos(pickedPhotos, student.tenant_id, student.id, session.access_token)
        : [];
      const { error } = await supabase.from('student_progress').insert({
        student_id: student.id, tenant_id: student.tenant_id,
        recorded_at: new Date().toISOString(),
        weight: fWeight.trim() ? parseFloat(fWeight.replace(',', '.')) : null,
        notes: fNotes.trim() || null,
        photo_urls: photoUrls,
      } as any);
      if (error) throw error;
      setFWeight(''); setFNotes(''); setPickedPhotos([]);
      setAddVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível salvar.');
    } finally { setSaving(false); }
  }

  function openEdit(entry: ProgressEntry) {
    setEditEntry(entry); setEditPhotos([...entry.photo_urls]);
  }

  async function pickEdit() {
    if (editPhotos.length >= 5) { Alert.alert('Máximo de 5 fotos.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.75,
    });
    if (res.canceled || !editEntry || !student) return;
    setEditSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada.');
      const newUrls = await uploadPhotos(
        res.assets.slice(0, 5 - editPhotos.length),
        student.tenant_id, student.id, session.access_token,
      );
      setEditPhotos(prev => [...prev, ...newUrls]);
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setEditSaving(false); }
  }

  async function removeEditPhoto(url: string) {
    setEditPhotos(prev => prev.filter(u => u !== url));
    const path = storagePath(url);
    if (path) await supabase.storage.from(BUCKET).remove([path]);
  }

  async function saveEdit() {
    if (!editEntry) return;
    setEditSaving(true);
    try {
      const { error } = await supabase.from('student_progress')
        .update({ photo_urls: editPhotos } as any).eq('id', editEntry.id);
      if (error) throw error;
      setEditEntry(null); await load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setEditSaving(false); }
  }

  const weightEntries = entries.filter(e => e.weight != null);
  const latestWeight  = weightEntries[weightEntries.length - 1];
  const prevWeight    = weightEntries[weightEntries.length - 2];
  const weightDiff    = latestWeight && prevWeight
    ? latestWeight.weight! - prevWeight.weight! : null;

  if (loading) {
    return (
      <View style={s.safe}>
        <SafeAreaView edges={['top']}>
          <View style={s.header}>
            <Text style={s.headerTitle}>Minha Evolução</Text>
            <TenantLogo size={32} />
          </View>
        </SafeAreaView>
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      </View>
    );
  }

  return (
    <View style={s.safe}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Minha Evolução</Text>
            <Text style={s.headerSub}>Últimos 30 dias</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TenantLogo size={32} />
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: primaryColor }]}
              onPress={() => setAddVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={20} color={lightText ? '#000' : '#fff'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Tabs ── */}
        <View style={s.tabs}>
          {(['evolucao', 'corpo'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tab, tab === t && { borderBottomColor: primaryColor, borderBottomWidth: 2 }]}
              onPress={() => setTab(t)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabText, tab === t && { color: primaryColor }]}>
                {t === 'evolucao' ? 'Evolução' : 'Corpo & Fotos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {tab === 'evolucao' ? (
            <>
              {/* ── 3 metric cards ── */}
              <View style={s.metricsRow}>
                <View style={s.metricCard}>
                  <Ionicons name={avgLoadDelta >= 0 ? 'trending-up' : 'trending-down'} size={20}
                    color={avgLoadDelta >= 0 ? primaryColor : '#EF4444'} />
                  <Counter value={Math.abs(avgLoadDelta)} suffix=" kg" />
                  <Text style={s.metricLabel}>Carga média{'\n'}aumentada</Text>
                </View>
                <View style={s.metricCard}>
                  <Ionicons name="flame" size={20} color={primaryColor} />
                  <Counter value={totalWorkouts} />
                  <Text style={s.metricLabel}>Treinos{'\n'}concluídos</Text>
                </View>
                <View style={s.metricCard}>
                  <Ionicons name="star" size={20} color={primaryColor} />
                  <Counter value={weeklyRate} suffix="%" />
                  <Text style={s.metricLabel}>Assiduidade{'\n'}semanal</Text>
                </View>
              </View>

              {/* ── Load line chart ── */}
              {weekPoints.length >= 2 ? (
                <View style={s.chartCard}>
                  <View style={s.chartHeaderRow}>
                    <Text style={s.chartTitle}>Carga média (kg)</Text>
                    <View style={[s.periodPill, { borderColor: `${primaryColor}50` }]}>
                      <Text style={[s.periodText, { color: primaryColor }]}>4 semanas</Text>
                    </View>
                  </View>
                  <LineChart points={chartPoints} color={primaryColor} height={130} />
                  {/* Date ranges below */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 4 }}>
                    {weekPoints.map((w, i) => (
                      <Text key={i} style={s.chartSub} numberOfLines={1}>
                        {w.dateRange}
                      </Text>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={s.chartCard}>
                  <Text style={s.chartTitle}>Carga média (kg)</Text>
                  <View style={s.emptyChart}>
                    <Ionicons name="bar-chart-outline" size={32} color="rgba(255,255,255,0.15)" />
                    <Text style={s.emptyChartText}>
                      Complete ao menos 2 semanas de treino para ver o gráfico de evolução.
                    </Text>
                  </View>
                </View>
              )}

              {/* ── Weekly frequency bar chart ── */}
              <View style={s.chartCard}>
                <Text style={s.chartTitle}>Frequência Semanal</Text>
                <WeeklyBars dayCounts={dayCounts} color={primaryColor} />
                <View style={s.legendRow}>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: primaryColor }]} />
                    <Text style={s.legendText}>Treino concluído</Text>
                  </View>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
                    <Text style={s.legendText}>Descanso</Text>
                  </View>
                </View>
              </View>

              {/* ── Goal card ── */}
              {totalWorkouts > 0 && (
                <View style={s.goalCard}>
                  <View style={s.goalHeader}>
                    <View style={[s.goalIcon, { backgroundColor: `${primaryColor}20` }]}>
                      <Ionicons name="flag" size={16} color={primaryColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.goalTitle}>Próxima Meta</Text>
                      <Text style={s.goalDesc}>
                        Completar {Math.ceil(totalWorkouts / 5) * 5} treinos este mês
                      </Text>
                    </View>
                    <Text style={[s.goalPct, { color: primaryColor }]}>
                      {Math.min(100, Math.round((totalWorkouts / (Math.ceil(totalWorkouts / 5) * 5)) * 100))}%{'\n'}
                      <Text style={s.goalPctSub}>concluído</Text>
                    </Text>
                  </View>
                  <View style={s.goalTrack}>
                    <View style={[s.goalFill, {
                      width: `${Math.min(100, Math.round((totalWorkouts / (Math.ceil(totalWorkouts / 5) * 5)) * 100))}%` as any,
                      backgroundColor: primaryColor,
                    }]} />
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              {/* ── Corpo tab: peso atual ── */}
              {latestWeight ? (
                <View style={s.bodyCard}>
                  <View>
                    <Text style={s.bodyLabel}>PESO ATUAL</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 4 }}>
                      <Text style={[s.bodyWeight, { color: primaryColor }]}>{latestWeight.weight?.toFixed(1)}</Text>
                      <Text style={s.bodyUnit}>kg</Text>
                    </View>
                    <Text style={s.bodyDate}>{fmtDate(latestWeight.recorded_at)}</Text>
                  </View>
                  {weightDiff != null && (
                    <View style={[s.diffBadge, { backgroundColor: weightDiff > 0 ? '#EF444420' : '#4ADE8020' }]}>
                      <Ionicons name={weightDiff > 0 ? 'trending-up' : 'trending-down'} size={16}
                        color={weightDiff > 0 ? '#EF4444' : '#4ADE80'} />
                      <Text style={[s.diffText, { color: weightDiff > 0 ? '#EF4444' : '#4ADE80' }]}>
                        {weightDiff > 0 ? '+' : ''}{weightDiff.toFixed(1)} kg
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={s.emptyBody}>
                  <Ionicons name="camera-outline" size={40} color="rgba(255,255,255,0.15)" />
                  <Text style={s.emptyBodyTitle}>Nenhum registro ainda</Text>
                  <Text style={s.emptyBodyDesc}>Registre seu peso e fotos para acompanhar sua evolução corporal.</Text>
                  <TouchableOpacity
                    style={[s.emptyBodyBtn, { backgroundColor: primaryColor }]}
                    onPress={() => setAddVisible(true)} activeOpacity={0.85}
                  >
                    <Text style={[s.emptyBodyBtnText, { color: lightText ? '#000' : '#fff' }]}>Adicionar registro</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Histórico de registros */}
              {entries.length > 0 && (
                <>
                  <Text style={s.sectionLabel}>HISTÓRICO</Text>
                  {[...entries].reverse().slice(0, 15).map(entry => (
                    <View key={entry.id} style={s.histCard}>
                      <View style={s.histTop}>
                        <View style={[s.histDot, { backgroundColor: primaryColor }]} />
                        <View style={{ flex: 1 }}>
                          {entry.weight && <Text style={s.histWeight}>{entry.weight.toFixed(1)} kg</Text>}
                          {entry.notes && <Text style={s.histNotes}>{entry.notes}</Text>}
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <Text style={s.histDate}>{fmtDate(entry.recorded_at)}</Text>
                          <TouchableOpacity
                            style={[s.photoBtn, { borderColor: `${primaryColor}50` }]}
                            onPress={() => openEdit(entry)} activeOpacity={0.7}
                          >
                            <Ionicons name="camera-outline" size={13} color={primaryColor} />
                            <Text style={[s.photoBtnText, { color: primaryColor }]}>
                              {entry.photo_urls.length > 0 ? `${entry.photo_urls.length} foto${entry.photo_urls.length > 1 ? 's' : ''}` : 'Foto'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      {entry.photo_urls.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}
                          contentContainerStyle={s.photoRow}>
                          {entry.photo_urls.map((url, idx) => (
                            <TouchableOpacity key={idx} onPress={() => setViewerUri(url)} activeOpacity={0.85}>
                              <Image source={{ uri: url }} style={s.photoThumb} resizeMode="cover" />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ── Add entry modal ── */}
      <Modal visible={addVisible} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => !saving && setAddVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.safe, { backgroundColor: Colors.surface }]}>
            <SafeAreaView edges={['top']}>
              <View style={s.modalHeader}>
                <TouchableOpacity onPress={() => !saving && setAddVisible(false)} style={s.iconBtn}>
                  <Ionicons name="close" size={22} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={s.modalTitle}>Novo Registro</Text>
                <View style={{ width: 40 }} />
              </View>
            </SafeAreaView>
            <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={s.inputLabel}>PESO (kg)</Text>
              <TextInput value={fWeight} onChangeText={setFWeight} style={s.input}
                placeholder="Ex: 75.5" placeholderTextColor={Colors.textSecondary}
                keyboardType="decimal-pad" autoFocus />
              <Text style={[s.inputLabel, { marginTop: 18 }]}>OBSERVAÇÕES (opcional)</Text>
              <TextInput value={fNotes} onChangeText={setFNotes} style={[s.input, s.textArea]}
                placeholder="Como se sentiu, medidas..." placeholderTextColor={Colors.textSecondary} multiline />
              <Text style={[s.inputLabel, { marginTop: 18 }]}>FOTOS (opcional)</Text>
              <View style={s.photoGrid}>
                {pickedPhotos.map((p, idx) => (
                  <View key={idx} style={s.pickedWrap}>
                    <Image source={{ uri: p.uri }} style={s.pickedThumb} resizeMode="cover" />
                    <TouchableOpacity style={s.removeBtn}
                      onPress={() => setPickedPhotos(prev => prev.filter((_, i) => i !== idx))}>
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                {pickedPhotos.length < 5 && (
                  <TouchableOpacity style={s.addPhotoBtn} onPress={pickAdd} activeOpacity={0.75}>
                    <Ionicons name="camera-outline" size={24} color={Colors.textSecondary} />
                    <Text style={s.addPhotoBtnText}>Adicionar</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
                onPress={handleAdd} disabled={saving} activeOpacity={0.85}>
                {saving ? <ActivityIndicator color={lightText ? '#000' : '#fff'} />
                  : <Text style={[s.saveBtnText, { color: lightText ? '#000' : '#fff' }]}>Salvar</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit photos modal ── */}
      <Modal visible={!!editEntry} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => !editSaving && setEditEntry(null)}>
        <View style={[s.safe, { backgroundColor: Colors.surface }]}>
          <SafeAreaView edges={['top']}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => !editSaving && setEditEntry(null)} style={s.iconBtn}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={s.modalTitle}>Fotos — {editEntry ? fmtDate(editEntry.recorded_at) : ''}</Text>
              <View style={{ width: 40 }} />
            </View>
          </SafeAreaView>
          <ScrollView contentContainerStyle={s.modalBody}>
            <View style={s.photoGrid}>
              {editPhotos.map((url, idx) => (
                <View key={idx} style={s.pickedWrap}>
                  <Image source={{ uri: url }} style={s.pickedThumb} resizeMode="cover" />
                  <TouchableOpacity style={s.removeBtn} onPress={() => removeEditPhoto(url)}>
                    <Ionicons name="close-circle" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              {editPhotos.length < 5 && (
                <TouchableOpacity style={s.addPhotoBtn} onPress={pickEdit}
                  activeOpacity={0.75} disabled={editSaving}>
                  {editSaving
                    ? <ActivityIndicator color={Colors.textSecondary} size="small" />
                    : <><Ionicons name="camera-outline" size={24} color={Colors.textSecondary} /><Text style={s.addPhotoBtnText}>Adicionar</Text></>}
                </TouchableOpacity>
              )}
            </View>
            {editPhotos.length === 0 && (
              <Text style={s.noPhotosText}>Nenhuma foto neste registro.</Text>
            )}
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: primaryColor }, editSaving && { opacity: 0.6 }]}
              onPress={saveEdit} disabled={editSaving} activeOpacity={0.85}>
              {editSaving ? <ActivityIndicator color={lightText ? '#000' : '#fff'} />
                : <Text style={[s.saveBtnText, { color: lightText ? '#000' : '#fff' }]}>Salvar alterações</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {viewerUri && (
        <MediaViewerModal visible uri={viewerUri} type="image" title="Foto" onClose={() => setViewerUri(null)} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const BG   = Colors.bg;
const SURF = Colors.surface;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  headerTitle: { fontFamily: FontFamily.display, fontSize: 26, color: Colors.textPrimary },
  headerSub:   { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  addBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },

  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48, gap: 14 },

  // ── Metrics ──────────────────────────────────────────────────────────────
  metricsRow: { flexDirection: 'row', gap: 10 },
  metricCard: {
    flex: 1, backgroundColor: SURF, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, alignItems: 'center', gap: 6,
  },
  metricLabel: {
    fontFamily: FontFamily.body, fontSize: 10,
    color: Colors.textSecondary, textAlign: 'center', lineHeight: 14,
  },

  // ── Charts ───────────────────────────────────────────────────────────────
  chartCard: {
    backgroundColor: SURF, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border, padding: 16,
  },
  chartHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartTitle: {
    fontFamily: FontFamily.bodyBold, fontSize: 13,
    color: Colors.textPrimary, letterSpacing: 0.3,
  },
  periodPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  periodText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  chartSub: { fontFamily: FontFamily.body, fontSize: 9, color: Colors.textSecondary, flex: 1, textAlign: 'center' },
  emptyChart: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyChartText: {
    fontFamily: FontFamily.body, fontSize: 12,
    color: Colors.textSecondary, textAlign: 'center', lineHeight: 18,
  },
  legendRow: { flexDirection: 'row', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },

  // ── Goal card ─────────────────────────────────────────────────────────────
  goalCard: { backgroundColor: SURF, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  goalTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  goalDesc:  { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  goalPct:   { fontFamily: FontFamily.bodyBold, fontSize: 18, textAlign: 'right' },
  goalPctSub:{ fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
  goalTrack: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  goalFill:  { height: 6, borderRadius: 3 },

  // ── Body tab ──────────────────────────────────────────────────────────────
  bodyCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: SURF, borderRadius: 18, borderWidth: 1.5,
    borderColor: Colors.border, padding: 20,
  },
  bodyLabel:  { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },
  bodyWeight: { fontFamily: FontFamily.bodyBold, fontSize: 44 },
  bodyUnit:   { fontFamily: FontFamily.body, fontSize: FontSize.md, color: Colors.textSecondary, paddingBottom: 6 },
  bodyDate:   { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  diffBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  diffText:   { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },

  emptyBody:      { backgroundColor: SURF, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 32, alignItems: 'center', gap: 10 },
  emptyBodyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyBodyDesc:  { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  emptyBodyBtn:   { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  emptyBodyBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },

  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },

  histCard:   { backgroundColor: SURF, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  histTop:    { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  histDot:    { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  histWeight: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  histNotes:  { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  histDate:   { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary },
  photoBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: BG, borderWidth: 1 },
  photoBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  photoRow:   { paddingHorizontal: 14, paddingBottom: 12, gap: 8 },
  photoThumb: { width: 76, height: 76, borderRadius: 10 },

  // ── Modals ────────────────────────────────────────────────────────────────
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  modalBody:  { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48, gap: 0 },
  inputLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  input:      { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontFamily: FontFamily.body, fontSize: FontSize.md, color: Colors.textPrimary },
  textArea:   { minHeight: 90, textAlignVertical: 'top' },
  photoGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pickedWrap: { position: 'relative' },
  pickedThumb:{ width: 90, height: 90, borderRadius: 12 },
  removeBtn:  { position: 'absolute', top: -6, right: -6, backgroundColor: Colors.bg, borderRadius: 10 },
  addPhotoBtn:{ width: 90, height: 90, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: Colors.surface },
  addPhotoBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  noPhotosText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginVertical: 20 },
  saveBtn:    { borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 28 },
  saveBtnText:{ fontFamily: FontFamily.bodyBold, fontSize: FontSize.md },
});
