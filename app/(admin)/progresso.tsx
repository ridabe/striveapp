import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Animated, Modal,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

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

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Animated weight bar chart
function WeightChart({ entries, primaryColor }: { entries: ProgressEntry[]; primaryColor: string }) {
  const chartAnim = useRef(new Animated.Value(0)).current;
  const data = entries.filter(e => e.weight).slice(-8);

  useEffect(() => {
    if (data.length < 2) return;
    chartAnim.setValue(0);
    Animated.timing(chartAnim, { toValue: 1, duration: 800, useNativeDriver: false }).start();
  }, [data.length]);

  if (data.length < 2) return null;

  const maxW = Math.max(...data.map(e => e.weight as number));
  const minW = Math.min(...data.map(e => e.weight as number));
  const range = Math.max(maxW - minW, 1);
  const CHART_H = 80;

  const diff = (data[data.length - 1].weight as number) - (data[0].weight as number);
  const diffColor = diff <= 0 ? Colors.success : Colors.error;

  return (
    <View style={chart.container}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={chart.label}>EVOLUÇÃO DO PESO</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name={diff <= 0 ? 'trending-down' : 'trending-up'} size={16} color={diffColor} />
          <Text style={[chart.diffText, { color: diffColor }]}>
            {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: CHART_H + 30 }}>
        {data.map((entry, i) => {
          const pct = ((entry.weight as number) - minW + range * 0.15) / (range * 1.15);
          const barH = chartAnim.interpolate({ inputRange: [0, 1], outputRange: [0, CHART_H * pct] });
          const d = new Date(entry.recorded_at);
          const isLast = i === data.length - 1;
          return (
            <View key={entry.id} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Text style={[chart.barLabel, isLast && { color: primaryColor }]}>
                {(entry.weight as number).toFixed(0)}
              </Text>
              <Animated.View style={[chart.bar, { height: barH, backgroundColor: isLast ? primaryColor : `${primaryColor}50` }]} />
              <Text style={chart.dateLabel}>{d.getDate()}/{d.getMonth() + 1}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Student list view ────────────────────────────────────────────────────────
function StudentListView({
  students, loading, primaryColor, onSelect, onAdd,
}: {
  students: StudentSummary[];
  loading: boolean;
  primaryColor: string;
  onSelect: (s: StudentSummary) => void;
  onAdd: (s: StudentSummary) => void;
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
          <View style={sl.statCard}>
            <Text style={[sl.statNum, { color: primaryColor }]}>{students.length}</Text>
            <Text style={sl.statLabel}>Alunos</Text>
          </View>
          <View style={sl.statCard}>
            <Text style={[sl.statNum, { color: primaryColor }]}>
              {students.reduce((s, a) => s + a.totalEntries, 0)}
            </Text>
            <Text style={sl.statLabel}>Registros</Text>
          </View>
          <View style={sl.statCard}>
            <Text style={[sl.statNum, { color: primaryColor }]}>
              {students.reduce((s, a) => s + a.totalPhotos, 0)}
            </Text>
            <Text style={sl.statLabel}>Fotos</Text>
          </View>
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
              <Text style={sl.sub}>
                {item.totalEntries === 0
                  ? 'Nenhum registro ainda'
                  : `${item.totalEntries} registro(s) · ${item.totalPhotos} foto(s)`}
              </Text>
              {item.latestWeight && (
                <View style={[sl.weightBadge, { backgroundColor: `${primaryColor}15` }]}>
                  <Ionicons name="scale-outline" size={11} color={primaryColor} />
                  <Text style={[sl.weightText, { color: primaryColor }]}>{item.latestWeight} kg</Text>
                </View>
              )}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <TouchableOpacity
                style={[sl.addBtn, { backgroundColor: primaryColor }]}
                onPress={() => onAdd(item)} activeOpacity={0.8}>
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
function StudentDetailView({
  student, entries, loading, primaryColor, onAddPress,
}: {
  student: StudentSummary;
  entries: ProgressEntry[];
  loading: boolean;
  primaryColor: string;
  onAddPress: () => void;
}) {
  if (loading) return <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />;

  const latestWeight = [...entries].reverse().find(e => e.weight)?.weight ?? null;
  const totalPhotos = entries.reduce((s, e) => s + e.photo_urls.length, 0);
  const sortedAsc = [...entries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));

  return (
    <FlatList
      data={[...entries].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))}
      keyExtractor={e => e.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      ListHeaderComponent={
        <>
          <View style={det.statsRow}>
            <View style={det.statCard}>
              <Ionicons name="scale-outline" size={20} color={primaryColor} />
              <Text style={det.statNum}>{latestWeight ? `${latestWeight}kg` : '—'}</Text>
              <Text style={det.statLabel}>Peso atual</Text>
            </View>
            <View style={det.statCard}>
              <Ionicons name="images-outline" size={20} color={primaryColor} />
              <Text style={det.statNum}>{totalPhotos}</Text>
              <Text style={det.statLabel}>Fotos</Text>
            </View>
            <View style={det.statCard}>
              <Ionicons name="calendar-outline" size={20} color={primaryColor} />
              <Text style={det.statNum}>{entries.length}</Text>
              <Text style={det.statLabel}>Registros</Text>
            </View>
          </View>

          <WeightChart entries={sortedAsc} primaryColor={primaryColor} />

          <TouchableOpacity style={[det.addBtn, { borderColor: primaryColor }]} onPress={onAddPress} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={18} color={primaryColor} />
            <Text style={[det.addBtnText, { color: primaryColor }]}>Novo registro de progresso</Text>
          </TouchableOpacity>

          {entries.length > 0 && <Text style={det.sectionLabel}>HISTÓRICO</Text>}
        </>
      }
      renderItem={({ item }) => (
        <View style={det.entryCard}>
          <View style={det.entryHeader}>
            <View style={[det.entryDot, { backgroundColor: primaryColor }]} />
            <Text style={det.entryDate}>{fmtDate(item.recorded_at)}</Text>
            {item.weight && (
              <View style={[det.weightBadge, { backgroundColor: `${primaryColor}20` }]}>
                <Ionicons name="scale-outline" size={12} color={primaryColor} />
                <Text style={[det.weightBadgeText, { color: primaryColor }]}>{item.weight} kg</Text>
              </View>
            )}
          </View>
          {item.notes && <Text style={det.entryNotes}>{item.notes}</Text>}
          {item.photo_urls.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, marginTop: 8 }}>
              {item.photo_urls.map((url, idx) => (
                <TouchableOpacity key={idx} onPress={() => WebBrowser.openBrowserAsync(url)}
                  style={det.photoThumb} activeOpacity={0.8}>
                  <Ionicons name="image-outline" size={22} color={primaryColor} />
                  <Text style={[det.photoLabel, { color: primaryColor }]}>Foto {idx + 1}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
      ListEmptyComponent={
        <View style={det.empty}>
          <Ionicons name="trending-up-outline" size={52} color={Colors.border} />
          <Text style={det.emptyTitle}>Nenhum registro</Text>
          <Text style={det.emptyText}>Toque em "Novo registro" para começar o acompanhamento.</Text>
        </View>
      }
    />
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ProgressoScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id;

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [detailEntries, setDetailEntries] = useState<ProgressEntry[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalStudent, setModalStudent] = useState<StudentSummary | null>(null);
  const [inputWeight, setInputWeight] = useState('');
  const [inputNotes, setInputNotes] = useState('');
  const [pickedPhotos, setPickedPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [saving, setSaving] = useState(false);

  const lightText = ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(primaryColor);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const [stRes, progRes] = await Promise.all([
      supabase.from('students').select('id, full_name, status').eq('tenant_id', tenantId).order('full_name'),
      supabase.from('student_progress')
        .select('student_id, weight, photo_urls, recorded_at')
        .eq('tenant_id', tenantId)
        .order('recorded_at', { ascending: false }),
    ]);

    const allProg: any[] = progRes.data ?? [];

    const summary: StudentSummary[] = (stRes.data ?? []).map((s: Student) => {
      const recs = allProg.filter(p => p.student_id === s.id);
      const latestW = recs.find(p => p.weight)?.weight ?? null;
      const photos = recs.reduce((acc: number, p: any) => acc + (p.photo_urls?.length ?? 0), 0);
      return {
        ...s,
        totalEntries: recs.length,
        latestWeight: latestW,
        lastDate: recs[0]?.recorded_at ?? null,
        totalPhotos: photos,
      };
    });

    setStudents(summary);
  }, [tenantId]);

  const loadDetail = useCallback(async (studentId: string) => {
    setLoadingDetail(true);
    const { data } = await supabase.from('student_progress')
      .select('id, student_id, recorded_at, weight, photo_urls, notes')
      .eq('student_id', studentId)
      .order('recorded_at', { ascending: false });
    setDetailEntries((data ?? []).map((e: any) => ({ ...e, photo_urls: e.photo_urls ?? [] })));
    setLoadingDetail(false);
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  function openAdd(student: StudentSummary) {
    setModalStudent(student);
    setInputWeight('');
    setInputNotes('');
    setPickedPhotos([]);
    setModalVisible(true);
  }

  async function pickPhotos() {
    if (pickedPhotos.length >= 5) { Alert.alert('Limite', 'Máximo de 5 fotos por registro.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.7 });
    if (res.canceled) return;
    setPickedPhotos(prev => [...prev, ...res.assets.slice(0, 5 - prev.length)]);
  }

  async function handleSave() {
    if (!modalStudent || !tenantId) return;
    if (!inputWeight && pickedPhotos.length === 0) { Alert.alert('Atenção', 'Informe o peso ou adicione uma foto.'); return; }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada.');

      const uploadedUrls: string[] = [];
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

      for (const photo of pickedPhotos) {
        const uuid = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const ext = photo.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const path = `${tenantId}/${modalStudent.id}/${uuid}.${ext}`;
        const res = await FileSystem.uploadAsync(
          `${supabaseUrl}/storage/v1/object/progress-photos/${path}`,
          photo.uri,
          { httpMethod: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, apikey: supabaseKey, 'Content-Type': photo.mimeType ?? 'image/jpeg' } },
        );
        if (res.status !== 200) throw new Error('Falha ao enviar foto.');
        const { data: urlData } = supabase.storage.from('progress-photos').getPublicUrl(path);
        uploadedUrls.push(urlData.publicUrl);
      }

      const { error } = await supabase.from('student_progress').insert({
        tenant_id: tenantId, student_id: modalStudent.id,
        recorded_at: new Date().toISOString(),
        weight: inputWeight ? parseFloat(inputWeight.replace(',', '.')) : null,
        photo_urls: uploadedUrls,
        notes: inputNotes.trim() || null,
      });
      if (error) throw error;

      setModalVisible(false);
      await load();
      if (selected?.id === modalStudent.id) await loadDetail(modalStudent.id);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSelect(s: StudentSummary) {
    setSelected(s);
    await loadDetail(s.id);
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.header}>
        <TouchableOpacity
          onPress={() => selected ? setSelected(null) : router.back()}
          style={st.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={st.title} numberOfLines={1}>
          {selected ? selected.full_name.split(' ')[0] : 'Progresso'}
        </Text>
        {selected ? (
          <TouchableOpacity
            style={[st.addBtn, { backgroundColor: primaryColor }]}
            onPress={() => openAdd(selected)} activeOpacity={0.85}>
            <Ionicons name="add" size={20} color={lightText ? '#000' : '#fff'} />
          </TouchableOpacity>
        ) : <View style={{ width: 38 }} />}
      </View>

      {selected ? (
        <StudentDetailView
          student={selected} entries={detailEntries}
          loading={loadingDetail} primaryColor={primaryColor}
          onAddPress={() => openAdd(selected)}
        />
      ) : (
        <StudentListView
          students={students} loading={loading}
          primaryColor={primaryColor}
          onSelect={handleSelect}
          onAdd={openAdd}
        />
      )}

      {/* Add progress modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => !saving && setModalVisible(false)}>
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
            <TextInput value={inputNotes} onChangeText={setInputNotes}
              placeholder="Como está o aluno?" placeholderTextColor={Colors.textSecondary}
              multiline numberOfLines={3} style={[st.modalInput, st.textArea]} />

            <Text style={[st.modalLabel, { marginTop: 16 }]}>FOTOS ({pickedPhotos.length}/5)</Text>
            <TouchableOpacity style={st.photoPickBtn} onPress={pickPhotos} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={24} color={Colors.textSecondary} />
              <Text style={st.photoPickText}>
                {pickedPhotos.length === 0 ? 'Adicionar fotos' : `${pickedPhotos.length} foto(s) selecionada(s)`}
              </Text>
            </TouchableOpacity>
            {pickedPhotos.length > 0 && (
              <TouchableOpacity onPress={() => setPickedPhotos([])} style={{ alignSelf: 'flex-end', marginTop: 6 }}>
                <Text style={{ fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.error }}>Remover todas</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[st.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
              onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color={lightText ? '#000' : '#fff'} /> : (
                <Text style={[st.saveBtnText, { color: lightText ? '#000' : '#fff' }]}>Salvar Registro</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const chart = StyleSheet.create({
  container: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 14 },
  label: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.textSecondary, letterSpacing: 0.8 },
  diffText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
  bar: { width: '100%', borderRadius: 4, minHeight: 2 },
  barLabel: { fontFamily: FontFamily.body, fontSize: 9, color: Colors.textSecondary },
  dateLabel: { fontFamily: FontFamily.body, fontSize: 9, color: Colors.textSecondary },
});

const sl = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 4 },
  statNum: { fontFamily: FontFamily.bodyBold, fontSize: 22 },
  statLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: FontFamily.bodyBold, fontSize: 16 },
  name: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  sub: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 3 },
  weightBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start', marginTop: 5 },
  weightText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  addBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

const det = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10, marginVertical: 16 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 5 },
  statNum: { fontFamily: FontFamily.bodyBold, fontSize: 18, color: Colors.textPrimary },
  statLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 16 },
  addBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },
  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 10 },
  entryCard: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 10 },
  entryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryDot: { width: 8, height: 8, borderRadius: 4 },
  entryDate: { flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  weightBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  weightBadgeText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  entryNotes: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 8, lineHeight: 20 },
  photoThumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoLabel: { fontFamily: FontFamily.body, fontSize: 10 },
  empty: { alignItems: 'center', paddingTop: 40, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
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
  photoPickBtn: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: 12, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  photoPickText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16, marginTop: 28 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md },
});
