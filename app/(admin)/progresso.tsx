import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Animated, Modal,
  TextInput, KeyboardAvoidingView, Platform, Alert, Image,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { MediaViewerModal } from '@/components/MediaViewerModal';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const { width: W } = Dimensions.get('window');
const CHART_W = W - 80;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = 'progress-photos';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProgressEntry {
  id: string;
  student_id: string;
  recorded_at: string;
  weight: number | null;
  photo_urls: string[];
  notes: string | null;
}
interface Student { id: string; full_name: string; status: string }
interface StudentSummary extends Student {
  latestWeight: number | null;
  totalEntries: number;
  lastDate: string | null;
  totalPhotos: number;
}
interface WeekPoint { label: string; avgLoad: number }
interface DayCount  { day: number; count: number }

const MONTHS    = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DAY_LABELS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Upload corrigido: fetch + FormData ───────────────────────────────────────
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
    if (!res.ok) throw new Error(`Falha ao enviar foto: ${await res.text().catch(() => res.statusText)}`);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

// ─── Line chart ───────────────────────────────────────────────────────────────
function LineChart({ points, color }: { points: { x: number; y: number; label: string; value: string }[]; color: string }) {
  if (points.length < 2) return null;
  const H = 100;
  const lines: { x1: number; y1: number; len: number; angle: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x, dy = points[i + 1].y - points[i].y;
    lines.push({ x1: points[i].x, y1: points[i].y, len: Math.sqrt(dx * dx + dy * dy), angle: Math.atan2(dy, dx) * 180 / Math.PI });
  }
  return (
    <View style={{ height: H + 28, width: CHART_W, marginTop: 8 }}>
      {lines.map((l, i) => (
        <View key={i} style={{
          position: 'absolute', left: l.x1, top: l.y1,
          width: l.len, height: 2, backgroundColor: color, borderRadius: 1, opacity: 0.7,
          transform: [{ translateY: -1 }, { rotate: `${l.angle}deg` }, { translateX: l.len / 2 - l.x1 }],
          transformOrigin: `0px 1px`,
        }} />
      ))}
      {points.map((p, i) => (
        <View key={i} style={{ position: 'absolute', left: p.x, top: p.y, alignItems: 'center' }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, transform: [{ translateX: -5 }, { translateY: -5 }] }} />
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 10, color, transform: [{ translateX: -5 }, { translateY: -20 }] }}>{p.value}</Text>
        </View>
      ))}
      {points.map((p, i) => (
        <Text key={i} style={{ position: 'absolute', left: p.x - 18, top: H + 6, fontFamily: FontFamily.body, fontSize: 9, color: Colors.textSecondary, width: 36, textAlign: 'center' }}>{p.label}</Text>
      ))}
    </View>
  );
}

// ─── Weekly bars ──────────────────────────────────────────────────────────────
function WeeklyBars({ dayCounts, color }: { dayCounts: DayCount[]; color: string }) {
  const maxCount = Math.max(...dayCounts.map(d => d.count), 1);
  const BAR_H = 60;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginTop: 10 }}>
      {WEEK_ORDER.map(dayIdx => {
        const count = dayCounts.find(d => d.day === dayIdx)?.count ?? 0;
        const barH = count > 0 ? Math.max(10, (count / maxCount) * BAR_H) : 5;
        return (
          <View key={dayIdx} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 10, color: Colors.textSecondary }}>{count}</Text>
            <View style={{ width: '100%', height: barH, borderRadius: 5, backgroundColor: count > 0 ? color : Colors.border }} />
            <Text style={{ fontFamily: FontFamily.body, fontSize: 9, color: Colors.textSecondary }}>{DAY_LABELS[dayIdx].slice(0, 3).toUpperCase()}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Student list view ────────────────────────────────────────────────────────
function StudentListView({ students, loading, primaryColor, onSelect, onAdd }: {
  students: StudentSummary[]; loading: boolean; primaryColor: string;
  onSelect: (s: StudentSummary) => void; onAdd: (s: StudentSummary) => void;
}) {
  if (loading) return <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />;
  return (
    <FlatList
      data={students}
      keyExtractor={s => s.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 12 }}
      ListHeaderComponent={
        <View style={sl.statsRow}>
          {[
            { num: students.length, label: 'Alunos' },
            { num: students.reduce((s, a) => s + a.totalEntries, 0), label: 'Registros' },
            { num: students.reduce((s, a) => s + a.totalPhotos, 0), label: 'Fotos' },
          ].map(({ num, label }) => (
            <View key={label} style={sl.statCard}>
              <Text style={[sl.statNum, { color: primaryColor }]}>{num}</Text>
              <Text style={sl.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      }
      renderItem={({ item }) => {
        const initials = item.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
        return (
          <TouchableOpacity style={sl.card} onPress={() => onSelect(item)} activeOpacity={0.75}>
            <View style={[sl.avatar, { backgroundColor: `${primaryColor}20` }]}>
              <Text style={[sl.avatarLetter, { color: primaryColor }]}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sl.name}>{item.full_name}</Text>
              <Text style={sl.sub}>{item.totalEntries === 0 ? 'Nenhum registro' : `${item.totalEntries} registro(s) · ${item.totalPhotos} foto(s)`}</Text>
              {item.latestWeight && (
                <View style={[sl.weightBadge, { backgroundColor: `${primaryColor}15` }]}>
                  <Ionicons name="scale-outline" size={11} color={primaryColor} />
                  <Text style={[sl.weightText, { color: primaryColor }]}>{item.latestWeight} kg</Text>
                </View>
              )}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <TouchableOpacity style={[sl.addBtn, { backgroundColor: primaryColor }]} onPress={() => onAdd(item)} activeOpacity={0.8}>
                <Ionicons name="add" size={16} color="#000" />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={sl.empty}>
          <Ionicons name="people-outline" size={52} color={Colors.border} />
          <Text style={sl.emptyTitle}>Nenhum aluno</Text>
          <Text style={sl.emptyText}>Cadastre alunos para acompanhar o progresso.</Text>
        </View>
      }
    />
  );
}

// ─── Student detail view ──────────────────────────────────────────────────────
function StudentDetailView({ student, entries, workoutData, loading, primaryColor, onAddPress, onPhotoPress }: {
  student: StudentSummary;
  entries: ProgressEntry[];
  workoutData: { totalWorkouts: number; weeklyRate: number; avgLoadDelta: number; weekPoints: WeekPoint[]; dayCounts: DayCount[] };
  loading: boolean;
  primaryColor: string;
  onAddPress: () => void;
  onPhotoPress: (uri: string) => void;
}) {
  const [tab, setTab] = useState<'evolucao' | 'corpo'>('evolucao');

  if (loading) return <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />;

  const weightEntries = entries.filter(e => e.weight != null);
  const latestWeight  = weightEntries[0]?.weight ?? null;
  const prevWeight    = weightEntries[1]?.weight ?? null;
  const weightDiff    = latestWeight && prevWeight ? latestWeight - prevWeight : null;

  // Build line chart for load
  const { weekPoints } = workoutData;
  const chartValues = weekPoints.map(w => w.avgLoad);
  const minV = chartValues.length ? Math.min(...chartValues) - 5 : 0;
  const maxV = chartValues.length ? Math.max(...chartValues) + 5 : 100;
  const vRange = maxV - minV || 1;
  const chartPoints = weekPoints.map((w, i) => ({
    x: i === 0 ? 8 : (i / (weekPoints.length - 1)) * (CHART_W - 20),
    y: 100 - ((w.avgLoad - minV) / vRange) * 100,
    label: w.label,
    value: `${w.avgLoad}`,
  }));

  // Build line chart for weight
  const wEntAsc  = [...weightEntries].reverse();
  const wMinV    = wEntAsc.length ? Math.min(...wEntAsc.map(e => e.weight!)) - 3 : 0;
  const wMaxV    = wEntAsc.length ? Math.max(...wEntAsc.map(e => e.weight!)) + 3 : 100;
  const wRange   = wMaxV - wMinV || 1;
  const wChartPoints = wEntAsc.map((e, i) => ({
    x: i === 0 ? 8 : (i / (wEntAsc.length - 1)) * (CHART_W - 20),
    y: 100 - ((e.weight! - wMinV) / wRange) * 100,
    label: `${new Date(e.recorded_at).getDate()}/${new Date(e.recorded_at).getMonth() + 1}`,
    value: `${e.weight}`,
  }));

  const totalPhotos = entries.reduce((s, e) => s + e.photo_urls.length, 0);

  return (
    <View style={{ flex: 1 }}>
      {/* Tabs */}
      <View style={dv.tabs}>
        {(['evolucao', 'corpo'] as const).map(t => (
          <TouchableOpacity key={t} style={[dv.tab, tab === t && { borderBottomColor: primaryColor, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)} activeOpacity={0.75}>
            <Text style={[dv.tabText, tab === t && { color: primaryColor }]}>
              {t === 'evolucao' ? 'Evolução' : 'Corpo & Fotos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={dv.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'evolucao' ? (
          <>
            {/* Métricas de treino */}
            <View style={dv.metricsRow}>
              <View style={dv.metricCard}>
                <Ionicons name="flame" size={18} color={primaryColor} />
                <Text style={[dv.metricNum, { color: primaryColor }]}>{workoutData.totalWorkouts}</Text>
                <Text style={dv.metricLabel}>Treinos{'\n'}(30 dias)</Text>
              </View>
              <View style={dv.metricCard}>
                <Ionicons name={workoutData.avgLoadDelta >= 0 ? 'trending-up' : 'trending-down'} size={18}
                  color={workoutData.avgLoadDelta >= 0 ? Colors.success : Colors.error} />
                <Text style={[dv.metricNum, { color: workoutData.avgLoadDelta >= 0 ? Colors.success : Colors.error }]}>
                  {workoutData.avgLoadDelta >= 0 ? '+' : ''}{workoutData.avgLoadDelta} kg
                </Text>
                <Text style={dv.metricLabel}>Carga{'\n'}média</Text>
              </View>
              <View style={dv.metricCard}>
                <Ionicons name="star" size={18} color={primaryColor} />
                <Text style={[dv.metricNum, { color: primaryColor }]}>{workoutData.weeklyRate}%</Text>
                <Text style={dv.metricLabel}>Assiduidade{'\n'}semanal</Text>
              </View>
            </View>

            {/* Gráfico de carga */}
            <View style={dv.chartCard}>
              <Text style={dv.chartTitle}>Carga média por semana (kg)</Text>
              {weekPoints.length >= 2 ? (
                <LineChart points={chartPoints} color={primaryColor} />
              ) : (
                <View style={dv.emptyChart}>
                  <Ionicons name="bar-chart-outline" size={28} color={Colors.border} />
                  <Text style={dv.emptyChartText}>Mínimo 2 semanas de treino para exibir o gráfico.</Text>
                </View>
              )}
            </View>

            {/* Gráfico de frequência */}
            <View style={dv.chartCard}>
              <Text style={dv.chartTitle}>Frequência semanal (últimos 30 dias)</Text>
              <WeeklyBars dayCounts={workoutData.dayCounts} color={primaryColor} />
              <View style={dv.legendRow}>
                <View style={dv.legendItem}><View style={[dv.legendDot, { backgroundColor: primaryColor }]} /><Text style={dv.legendText}>Treino</Text></View>
                <View style={dv.legendItem}><View style={[dv.legendDot, { backgroundColor: Colors.border }]} /><Text style={dv.legendText}>Descanso</Text></View>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Peso atual */}
            {latestWeight ? (
              <View style={dv.bodyCard}>
                <View>
                  <Text style={dv.bodyLabel}>PESO ATUAL</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 4 }}>
                    <Text style={[dv.bodyWeight, { color: primaryColor }]}>{latestWeight.toFixed(1)}</Text>
                    <Text style={dv.bodyUnit}>kg</Text>
                  </View>
                  <Text style={dv.bodyDate}>{fmtDate(weightEntries[0].recorded_at)}</Text>
                </View>
                {weightDiff != null && (
                  <View style={[dv.diffBadge, { backgroundColor: weightDiff > 0 ? '#EF444420' : '#4ADE8020' }]}>
                    <Ionicons name={weightDiff > 0 ? 'trending-up' : 'trending-down'} size={16} color={weightDiff > 0 ? '#EF4444' : '#4ADE80'} />
                    <Text style={[dv.diffText, { color: weightDiff > 0 ? '#EF4444' : '#4ADE80' }]}>
                      {weightDiff > 0 ? '+' : ''}{weightDiff.toFixed(1)} kg
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={dv.emptyBody}>
                <Ionicons name="scale-outline" size={36} color={Colors.border} />
                <Text style={dv.emptyBodyText}>Nenhum dado de peso registrado.</Text>
              </View>
            )}

            {/* Gráfico de evolução do peso */}
            {wEntAsc.length >= 2 && (
              <View style={dv.chartCard}>
                <Text style={dv.chartTitle}>Evolução do peso (kg)</Text>
                <LineChart points={wChartPoints} color={primaryColor} />
              </View>
            )}

            {/* Botão novo registro */}
            <TouchableOpacity style={[dv.addBtn, { borderColor: primaryColor }]} onPress={onAddPress} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={18} color={primaryColor} />
              <Text style={[dv.addBtnText, { color: primaryColor }]}>Novo registro de progresso</Text>
            </TouchableOpacity>

            {/* Resumo de fotos */}
            {totalPhotos > 0 && (
              <View style={[dv.photoSummaryCard, { borderColor: `${primaryColor}25` }]}>
                <Ionicons name="images-outline" size={18} color={primaryColor} />
                <Text style={[dv.photoSummaryText, { color: primaryColor }]}>{totalPhotos} foto{totalPhotos > 1 ? 's' : ''} registrada{totalPhotos > 1 ? 's' : ''}</Text>
              </View>
            )}

            {/* Histórico de registros com thumbnails */}
            {entries.length > 0 && (
              <>
                <Text style={dv.sectionLabel}>HISTÓRICO</Text>
                {entries.map(item => (
                  <View key={item.id} style={dv.entryCard}>
                    <View style={dv.entryHeader}>
                      <View style={[dv.entryDot, { backgroundColor: primaryColor }]} />
                      <Text style={dv.entryDate}>{fmtDate(item.recorded_at)}</Text>
                      {item.weight && (
                        <View style={[dv.weightBadge, { backgroundColor: `${primaryColor}18` }]}>
                          <Ionicons name="scale-outline" size={11} color={primaryColor} />
                          <Text style={[dv.weightBadgeText, { color: primaryColor }]}>{item.weight} kg</Text>
                        </View>
                      )}
                    </View>
                    {item.notes && <Text style={dv.entryNotes}>{item.notes}</Text>}

                    {/* Thumbnails reais das fotos */}
                    {item.photo_urls.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, marginTop: 10 }}>
                        {item.photo_urls.map((url, idx) => (
                          <TouchableOpacity key={idx} onPress={() => onPhotoPress(url)} activeOpacity={0.85}>
                            <Image source={{ uri: url }} style={dv.photoThumb} resizeMode="cover" />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                ))}
              </>
            )}

            {entries.length === 0 && (
              <View style={dv.empty}>
                <Ionicons name="trending-up-outline" size={52} color={Colors.border} />
                <Text style={dv.emptyTitle}>Nenhum registro</Text>
                <Text style={dv.emptyText}>Toque em "Novo registro" para começar o acompanhamento.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ProgressoScreen() {
  const { profile }    = useAuthStore();
  const { primaryColor } = useThemeStore();
  const { studentId }  = useLocalSearchParams<{ studentId?: string }>();
  const tenantId = profile?.tenant_id;

  const [students, setStudents]           = useState<StudentSummary[]>([]);
  const [loading, setLoading]             = useState(true);
  const [selected, setSelected]           = useState<StudentSummary | null>(null);
  const [detailEntries, setDetailEntries] = useState<ProgressEntry[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [workoutData, setWorkoutData] = useState({
    totalWorkouts: 0, weeklyRate: 0, avgLoadDelta: 0,
    weekPoints: [] as { label: string; avgLoad: number }[],
    dayCounts:  [] as { day: number; count: number }[],
  });

  const [mediaUri, setMediaUri]         = useState('');
  const [mediaVisible, setMediaVisible] = useState(false);

  const [modalVisible, setModalVisible]   = useState(false);
  const [modalStudent, setModalStudent]   = useState<StudentSummary | null>(null);
  const [inputWeight, setInputWeight]     = useState('');
  const [inputNotes, setInputNotes]       = useState('');
  const [pickedPhotos, setPickedPhotos]   = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [saving, setSaving]               = useState(false);

  const lightText = ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(primaryColor);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const [stRes, progRes] = await Promise.all([
      supabase.from('students').select('id, full_name, status').eq('tenant_id', tenantId).order('full_name'),
      supabase.from('student_progress').select('student_id, weight, photo_urls, recorded_at').eq('tenant_id', tenantId).order('recorded_at', { ascending: false }),
    ]);
    const allProg: any[] = progRes.data ?? [];
    const summary: StudentSummary[] = (stRes.data ?? []).map((s: Student) => {
      const recs = allProg.filter(p => p.student_id === s.id);
      return {
        ...s,
        totalEntries: recs.length,
        latestWeight: recs.find((p: any) => p.weight)?.weight ?? null,
        lastDate: recs[0]?.recorded_at ?? null,
        totalPhotos: recs.reduce((acc: number, p: any) => acc + (p.photo_urls?.length ?? 0), 0),
      };
    });
    setStudents(summary);

    if (studentId) {
      const match = summary.find(st => st.id === studentId);
      if (match) { setSelected(match); await loadDetail(match.id); }
    }
  }, [tenantId, studentId]);

  const loadDetail = useCallback(async (sid: string) => {
    setLoadingDetail(true);
    const { data } = await supabase.from('student_progress')
      .select('id, student_id, recorded_at, weight, photo_urls, notes')
      .eq('student_id', sid).order('recorded_at', { ascending: false });
    setDetailEntries((data ?? []).map((e: any) => ({ ...e, photo_urls: e.photo_urls ?? [] })));

    // Carrega dados de treino para os gráficos
    const now    = new Date();
    const d30ago = new Date(now); d30ago.setDate(d30ago.getDate() - 30);

    const { data: sessions } = await supabase.from('workout_sessions')
      .select('id, started_at').eq('student_id', sid)
      .not('finished_at', 'is', null).gte('started_at', d30ago.toISOString());

    const allSessions = sessions ?? [];
    const total = allSessions.length;
    const trainedDays = new Set(allSessions.map(s => new Date(s.started_at).toDateString()));
    const rate = Math.min(100, Math.round((trainedDays.size / 28) * 100));

    const dayMap: Record<number, number> = {};
    allSessions.forEach(s => { const d = new Date(s.started_at).getDay(); dayMap[d] = (dayMap[d] ?? 0) + 1; });
    const dayCounts = [0,1,2,3,4,5,6].map(d => ({ day: d, count: dayMap[d] ?? 0 }));

    const weeklyLoads: Record<number, number[]> = {};
    if (allSessions.length > 0) {
      const { data: exData } = await supabase.from('workout_session_exercises')
        .select('load_used, sets_done, session_id').in('session_id', allSessions.map(s => s.id)).not('load_used', 'is', null);
      (exData ?? []).forEach(ex => {
        const sess = allSessions.find(s => s.id === ex.session_id);
        if (!sess) return;
        const load = parseFloat(ex.load_used ?? '0');
        if (!load || isNaN(load)) return;
        const weekNum = Math.floor((now.getTime() - new Date(sess.started_at).getTime()) / 86400000 / 7) + 1;
        if (weekNum > 4) return;
        if (!weeklyLoads[weekNum]) weeklyLoads[weekNum] = [];
        for (let i = 0; i < (ex.sets_done ?? 1); i++) weeklyLoads[weekNum].push(load);
      });
    }

    const weeks: { label: string; avgLoad: number }[] = [];
    for (let w = 4; w >= 1; w--) {
      const loads = weeklyLoads[w];
      if (!loads || loads.length === 0) continue;
      weeks.push({ label: `Sem ${5 - w}`, avgLoad: parseFloat((loads.reduce((a, b) => a + b, 0) / loads.length).toFixed(1)) });
    }
    const delta = weeks.length >= 2 ? parseFloat((weeks[weeks.length - 1].avgLoad - weeks[0].avgLoad).toFixed(1)) : 0;

    setWorkoutData({ totalWorkouts: total, weeklyRate: rate, avgLoadDelta: delta, weekPoints: weeks, dayCounts });
    setLoadingDetail(false);
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function pickPhotos() {
    if (pickedPhotos.length >= 5) { Alert.alert('Limite', 'Máximo de 5 fotos.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.75 });
    if (!res.canceled) setPickedPhotos(prev => [...prev, ...res.assets.slice(0, 5 - prev.length)]);
  }

  async function handleSave() {
    if (!modalStudent || !tenantId) return;
    if (!inputWeight && pickedPhotos.length === 0) { Alert.alert('Atenção', 'Informe o peso ou adicione uma foto.'); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada.');
      const photoUrls = pickedPhotos.length > 0
        ? await uploadPhotos(pickedPhotos, tenantId, modalStudent.id, session.access_token)
        : [];
      const { error } = await supabase.from('student_progress').insert({
        tenant_id: tenantId, student_id: modalStudent.id,
        recorded_at: new Date().toISOString(),
        weight: inputWeight ? parseFloat(inputWeight.replace(',', '.')) : null,
        photo_urls: photoUrls, notes: inputNotes.trim() || null,
      });
      if (error) throw error;
      setModalVisible(false);
      await load();
      if (selected?.id === modalStudent.id) await loadDetail(modalStudent.id);
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setSaving(false); }
  }

  async function handleSelect(s: StudentSummary) {
    setSelected(s); await loadDetail(s.id);
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => { if (studentId) { router.back(); return; } selected ? setSelected(null) : router.back(); }} style={st.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={st.title} numberOfLines={1}>
          {selected ? selected.full_name.split(' ')[0] : 'Progresso'}
        </Text>
        {selected ? (
          <TouchableOpacity style={[st.addBtn, { backgroundColor: primaryColor }]} onPress={() => { setModalStudent(selected); setInputWeight(''); setInputNotes(''); setPickedPhotos([]); setModalVisible(true); }} activeOpacity={0.85}>
            <Ionicons name="add" size={20} color={lightText ? '#000' : '#fff'} />
          </TouchableOpacity>
        ) : <View style={{ width: 38 }} />}
      </View>

      {selected ? (
        <StudentDetailView
          student={selected} entries={detailEntries} workoutData={workoutData}
          loading={loadingDetail} primaryColor={primaryColor}
          onAddPress={() => { setModalStudent(selected); setInputWeight(''); setInputNotes(''); setPickedPhotos([]); setModalVisible(true); }}
          onPhotoPress={uri => { setMediaUri(uri); setMediaVisible(true); }}
        />
      ) : (
        <StudentListView students={students} loading={loading} primaryColor={primaryColor} onSelect={handleSelect} onAdd={s => { setModalStudent(s); setInputWeight(''); setInputNotes(''); setPickedPhotos([]); setModalVisible(true); }} />
      )}

      <MediaViewerModal visible={mediaVisible} uri={mediaUri} type="image" onClose={() => setMediaVisible(false)} />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !saving && setModalVisible(false)}>
        <KeyboardAvoidingView style={st.modalSafe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={st.modalHeader}>
            <TouchableOpacity onPress={() => !saving && setModalVisible(false)} style={st.backBtn}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={st.title}>Novo Registro</Text>
            <View style={{ width: 38 }} />
          </View>
          <ScrollView contentContainerStyle={st.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={st.modalLabel}>ALUNO</Text>
            <Text style={st.modalStudentName}>{modalStudent?.full_name}</Text>

            <Text style={[st.modalLabel, { marginTop: 20 }]}>PESO (kg)</Text>
            <TextInput value={inputWeight} onChangeText={setInputWeight} placeholder="Ex: 75.5"
              placeholderTextColor={Colors.textSecondary} keyboardType="decimal-pad" style={st.modalInput} />

            <Text style={[st.modalLabel, { marginTop: 16 }]}>OBSERVAÇÕES (opcional)</Text>
            <TextInput value={inputNotes} onChangeText={setInputNotes} placeholder="Como está o aluno?"
              placeholderTextColor={Colors.textSecondary} multiline numberOfLines={3} style={[st.modalInput, st.textArea]} />

            <Text style={[st.modalLabel, { marginTop: 16 }]}>FOTOS ({pickedPhotos.length}/5)</Text>

            {/* Preview das fotos selecionadas */}
            {pickedPhotos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
                {pickedPhotos.map((p, idx) => (
                  <View key={idx} style={{ position: 'relative' }}>
                    <Image source={{ uri: p.uri }} style={{ width: 80, height: 80, borderRadius: 10 }} resizeMode="cover" />
                    <TouchableOpacity
                      style={{ position: 'absolute', top: -6, right: -6, backgroundColor: Colors.bg, borderRadius: 10 }}
                      onPress={() => setPickedPhotos(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <Ionicons name="close-circle" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={st.photoPickBtn} onPress={pickPhotos} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={22} color={Colors.textSecondary} />
              <Text style={st.photoPickText}>
                {pickedPhotos.length === 0 ? 'Adicionar fotos' : 'Adicionar mais fotos'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[st.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
              onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color={lightText ? '#000' : '#fff'} />
                : <Text style={[st.saveBtnText, { color: lightText ? '#000' : '#fff' }]}>Salvar Registro</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const sl = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 4 },
  statNum:  { fontFamily: FontFamily.bodyBold, fontSize: 22 },
  statLabel:{ fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },
  card:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 10 },
  avatar:   { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: FontFamily.bodyBold, fontSize: 16 },
  name:     { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  sub:      { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 3 },
  weightBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start', marginTop: 5 },
  weightText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  addBtn:   { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  empty:    { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyText:  { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

const dv = StyleSheet.create({
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab:  { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48, gap: 12 },

  // Métricas
  metricsRow: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 5 },
  metricNum:  { fontFamily: FontFamily.bodyBold, fontSize: 18 },
  metricLabel:{ fontFamily: FontFamily.body, fontSize: 9, color: Colors.textSecondary, textAlign: 'center', lineHeight: 13 },

  // Charts
  chartCard:     { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  chartTitle:    { fontFamily: FontFamily.bodyBold, fontSize: 12, color: Colors.textPrimary, marginBottom: 4 },
  emptyChart:    { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyChartText:{ fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  legendRow:     { flexDirection: 'row', gap: 14, marginTop: 10 },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:     { width: 8, height: 8, borderRadius: 4 },
  legendText:    { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },

  // Corpo
  bodyCard:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.border, padding: 18 },
  bodyLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },
  bodyWeight:{ fontFamily: FontFamily.bodyBold, fontSize: 40 },
  bodyUnit:  { fontFamily: FontFamily.body, fontSize: FontSize.md, color: Colors.textSecondary, paddingBottom: 4 },
  bodyDate:  { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 3 },
  diffBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12 },
  diffText:  { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
  emptyBody: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyBodyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
  addBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, padding: 13 },
  addBtnText:{ fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },
  photoSummaryCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, padding: 12 },
  photoSummaryText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },

  // Histórico
  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.textSecondary, letterSpacing: 0.8 },
  entryCard:    { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  entryHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryDot:     { width: 8, height: 8, borderRadius: 4 },
  entryDate:    { flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  weightBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  weightBadgeText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  entryNotes:   { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 8, lineHeight: 18 },
  photoThumb:   { width: 88, height: 88, borderRadius: 12 },
  empty:        { alignItems: 'center', paddingTop: 32, gap: 10, paddingHorizontal: 32 },
  emptyTitle:   { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyText:    { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
});

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, flex: 1, textAlign: 'center' },
  addBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalSafe: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 52 },
  modalLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  modalStudentName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: 4 },
  modalInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  photoPickBtn: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: 12, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  photoPickText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16, marginTop: 28 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md },
});
