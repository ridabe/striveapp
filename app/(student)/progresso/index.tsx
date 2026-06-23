import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert, Dimensions,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { TenantLogo } from '@/components/TenantLogo';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { MediaViewerModal } from '@/components/MediaViewerModal';

const { width: W } = Dimensions.get('window');
const CHART_W = W - 64;
const CHART_H = 120;
const THUMB = 76;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = 'progress-photos';

interface ProgressEntry {
  id: string;
  recorded_at: string;
  weight: number | null;
  notes: string | null;
  photo_urls: string[];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function storagePath(publicUrl: string) {
  const marker = `${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  return idx >= 0 ? publicUrl.slice(idx + marker.length) : '';
}

async function uploadPhotos(
  assets: ImagePicker.ImagePickerAsset[],
  tenantId: string,
  studentId: string,
  token: string,
): Promise<string[]> {
  const urls: string[] = [];
  for (const photo of assets) {
    const uid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const ext = photo.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${tenantId}/${studentId}/${uid}.${ext}`;
    const res = await FileSystem.uploadAsync(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
      photo.uri,
      {
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_KEY,
          'Content-Type': photo.mimeType ?? 'image/jpeg',
        },
      },
    );
    if (res.status !== 200) throw new Error('Falha ao enviar foto.');
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

export default function ProgressoScreen() {
  const { student } = useStudent();
  const { primaryColor } = useThemeStore();

  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [addVisible, setAddVisible] = useState(false);
  const [fWeight, setFWeight] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [pickedPhotos, setPickedPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [saving, setSaving] = useState(false);

  // Edit modal (manage photos on existing entry)
  const [editEntry, setEditEntry] = useState<ProgressEntry | null>(null);
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  // Viewer
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!student) return;
    const { data } = await supabase
      .from('student_progress')
      .select('id, recorded_at, weight, notes, photo_urls')
      .eq('student_id', student.id)
      .order('recorded_at', { ascending: true })
      .limit(30);
    setEntries((data ?? []).map((e: any) => ({ ...e, photo_urls: e.photo_urls ?? [] })));
    setLoading(false);
  }, [student?.id]);

  useEffect(() => { load(); }, [load]);

  // ── Add entry ──────────────────────────────────────────────────────────────

  async function pickAdd() {
    if (pickedPhotos.length >= 5) { Alert.alert('Máximo de 5 fotos por registro.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.75,
    });
    if (!res.canceled) {
      setPickedPhotos(prev => [...prev, ...res.assets].slice(0, 5));
    }
  }

  async function handleAdd() {
    if (!student) return;
    if (!fWeight.trim() && pickedPhotos.length === 0) {
      Alert.alert('Informe o peso ou adicione pelo menos uma foto.');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada.');

      const photoUrls = pickedPhotos.length > 0
        ? await uploadPhotos(pickedPhotos, student.tenant_id, student.id, session.access_token)
        : [];

      const { error } = await supabase.from('student_progress').insert({
        student_id: student.id,
        tenant_id: student.tenant_id,
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
    } finally {
      setSaving(false);
    }
  }

  // ── Edit photos on existing entry ──────────────────────────────────────────

  function openEdit(entry: ProgressEntry) {
    setEditEntry(entry);
    setEditPhotos([...entry.photo_urls]);
  }

  async function pickEdit() {
    if (editPhotos.length >= 5) { Alert.alert('Máximo de 5 fotos por registro.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.75,
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
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function removeEditPhoto(url: string) {
    setEditPhotos(prev => prev.filter(u => u !== url));
    const path = storagePath(url);
    if (path) await supabase.storage.from(BUCKET).remove([path]);
  }

  async function saveEdit() {
    if (!editEntry || !student) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from('student_progress')
        .update({ photo_urls: editPhotos } as any)
        .eq('id', editEntry.id);
      if (error) throw error;
      setEditEntry(null);
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setEditSaving(false);
    }
  }

  // ── Chart ──────────────────────────────────────────────────────────────────

  const weightEntries = entries.filter(e => e.weight != null);
  const weights = weightEntries.map(e => e.weight as number);
  const minW = weights.length ? Math.min(...weights) - 2 : 0;
  const maxW = weights.length ? Math.max(...weights) + 2 : 100;
  const range = maxW - minW || 1;
  function toY(w: number) { return CHART_H - ((w - minW) / range) * CHART_H; }

  const latest = weightEntries[weightEntries.length - 1];
  const prev = weightEntries[weightEntries.length - 2];
  const diff = latest && prev ? latest.weight! - prev.weight! : null;

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.headerRow}>
          <Text style={s.title}>Evolução</Text>
          <TenantLogo size={32} />
        </View>
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.headerRow}>
        <Text style={s.title}>Evolução</Text>
        <View style={s.headerRight}>
          <TenantLogo size={32} />
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: primaryColor }]}
            onPress={() => setAddVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Current weight */}
        {latest ? (
          <View style={[s.currentCard, { borderColor: `${primaryColor}30` }]}>
            <View>
              <Text style={s.currentLabel}>PESO ATUAL</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 4 }}>
                <Text style={[s.currentWeight, { color: primaryColor }]}>{latest.weight?.toFixed(1)}</Text>
                <Text style={s.currentUnit}>kg</Text>
              </View>
              <Text style={s.currentDate}>{fmtDate(latest.recorded_at)}</Text>
            </View>
            {diff != null && (
              <View style={[s.diffBadge, { backgroundColor: diff > 0 ? '#EF444420' : '#4ADE8020' }]}>
                <Ionicons name={diff > 0 ? 'trending-up' : 'trending-down'} size={16} color={diff > 0 ? '#EF4444' : '#4ADE80'} />
                <Text style={[s.diffText, { color: diff > 0 ? '#EF4444' : '#4ADE80' }]}>
                  {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={s.emptyCard}>
            <Ionicons name="camera-outline" size={40} color={Colors.border} />
            <Text style={s.emptyTitle}>Nenhum registro ainda</Text>
            <Text style={s.emptyDesc}>Registre seu peso e fotos para acompanhar sua evolução.</Text>
            <TouchableOpacity
              style={[s.emptyBtn, { backgroundColor: primaryColor }]}
              onPress={() => setAddVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={s.emptyBtnText}>Adicionar registro</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Weight chart */}
        {weightEntries.length >= 2 && (
          <View style={s.chartCard}>
            <Text style={s.chartTitle}>EVOLUÇÃO DO PESO</Text>
            <View style={{ height: CHART_H + 24, position: 'relative', marginTop: 8 }}>
              <Text style={[s.chartAxisLabel, { top: 0 }]}>{maxW.toFixed(0)}kg</Text>
              <Text style={[s.chartAxisLabel, { bottom: 20 }]}>{minW.toFixed(0)}kg</Text>
              <View style={{ position: 'absolute', left: 36, right: 0, top: 0, height: CHART_H }}>
                {weightEntries.map((entry, idx) => {
                  const x = idx === 0 ? 0 : (idx / (weightEntries.length - 1)) * (CHART_W - 36);
                  const y = toY(entry.weight!);
                  return (
                    <View key={entry.id} style={{ position: 'absolute', left: x - 5, top: y - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: primaryColor }} />
                  );
                })}
              </View>
              <View style={{ position: 'absolute', left: 36, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={s.chartDateLabel}>{fmtDate(weightEntries[0].recorded_at)}</Text>
                <Text style={s.chartDateLabel}>{fmtDate(weightEntries[weightEntries.length - 1].recorded_at)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* History */}
        {entries.length > 0 && (
          <>
            <Text style={s.sectionLabel}>HISTÓRICO</Text>
            {[...entries].reverse().slice(0, 15).map(entry => (
              <View key={entry.id} style={s.historyCard}>
                <View style={s.historyTop}>
                  <View style={[s.historyDot, { backgroundColor: primaryColor }]} />
                  <View style={{ flex: 1 }}>
                    {entry.weight && (
                      <Text style={s.historyWeight}>{entry.weight.toFixed(1)} kg</Text>
                    )}
                    {entry.notes && <Text style={s.historyNotes}>{entry.notes}</Text>}
                  </View>
                  <View style={s.historyRight}>
                    <Text style={s.historyDate}>{fmtDate(entry.recorded_at)}</Text>
                    <TouchableOpacity
                      style={s.editPhotoBtn}
                      onPress={() => openEdit(entry)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="camera-outline" size={15} color={primaryColor} />
                      <Text style={[s.editPhotoBtnText, { color: primaryColor }]}>
                        {entry.photo_urls.length > 0 ? `${entry.photo_urls.length} foto${entry.photo_urls.length > 1 ? 's' : ''}` : 'Foto'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Photo thumbnails */}
                {entry.photo_urls.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoRow}>
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
      </ScrollView>

      {/* ── Add entry modal ── */}
      <Modal visible={addVisible} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => !saving && setAddVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => !saving && setAddVisible(false)} style={s.iconBtn}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={s.modalTitle}>Novo Registro</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={s.inputLabel}>PESO (kg)</Text>
              <TextInput
                value={fWeight}
                onChangeText={setFWeight}
                style={s.input}
                placeholder="Ex: 75.5"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="decimal-pad"
                autoFocus
              />

              <Text style={[s.inputLabel, { marginTop: 18 }]}>OBSERVAÇÕES (opcional)</Text>
              <TextInput
                value={fNotes}
                onChangeText={setFNotes}
                style={[s.input, s.textArea]}
                placeholder="Como se sentiu, medidas..."
                placeholderTextColor={Colors.textSecondary}
                multiline
              />

              <Text style={[s.inputLabel, { marginTop: 18 }]}>FOTOS (opcional)</Text>
              <View style={s.photoGrid}>
                {pickedPhotos.map((p, idx) => (
                  <View key={idx} style={s.pickedWrap}>
                    <Image source={{ uri: p.uri }} style={s.pickedThumb} resizeMode="cover" />
                    <TouchableOpacity
                      style={s.removeBtn}
                      onPress={() => setPickedPhotos(prev => prev.filter((_, i) => i !== idx))}
                    >
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
                onPress={handleAdd}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Salvar</Text>}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit photos modal ── */}
      <Modal visible={!!editEntry} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => !editSaving && setEditEntry(null)}>
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => !editSaving && setEditEntry(null)} style={s.iconBtn}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Fotos — {editEntry ? fmtDate(editEntry.recorded_at) : ''}</Text>
            <View style={{ width: 40 }} />
          </View>

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
                <TouchableOpacity style={s.addPhotoBtn} onPress={pickEdit} activeOpacity={0.75} disabled={editSaving}>
                  {editSaving
                    ? <ActivityIndicator color={Colors.textSecondary} size="small" />
                    : <>
                        <Ionicons name="camera-outline" size={24} color={Colors.textSecondary} />
                        <Text style={s.addPhotoBtnText}>Adicionar</Text>
                      </>
                  }
                </TouchableOpacity>
              )}
            </View>

            {editPhotos.length === 0 && (
              <Text style={s.noPhotosText}>Nenhuma foto neste registro.</Text>
            )}

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: primaryColor }, editSaving && { opacity: 0.6 }]}
              onPress={saveEdit}
              disabled={editSaving}
              activeOpacity={0.85}
            >
              {editSaving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.saveBtnText}>Salvar alterações</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Full-screen photo viewer */}
      {viewerUri && (
        <MediaViewerModal visible uri={viewerUri} type="image" title="Foto" onClose={() => setViewerUri(null)} />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.display, fontSize: 28, color: Colors.textPrimary },
  addBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8, gap: 12 },

  currentCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1.5, padding: 20 },
  currentLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },
  currentWeight: { fontFamily: FontFamily.bodyBold, fontSize: 44 },
  currentUnit: { fontFamily: FontFamily.body, fontSize: FontSize.md, color: Colors.textSecondary, paddingBottom: 6 },
  currentDate: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  diffBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  diffText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },

  emptyCard: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 32, alignItems: 'center', gap: 10 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  emptyBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: '#fff' },

  chartCard: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16 },
  chartTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },
  chartAxisLabel: { position: 'absolute', left: 0, fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
  chartDateLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },

  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginTop: 8 },

  historyCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  historyTop: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  historyWeight: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  historyNotes: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  historyRight: { alignItems: 'flex-end', gap: 6 },
  historyDate: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary },
  editPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  editPhotoBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  photoRow: { paddingHorizontal: 14, paddingBottom: 12, gap: 8 },
  photoThumb: { width: THUMB, height: THUMB, borderRadius: 10 },

  // Modal
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  modalBody: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48, gap: 0 },
  inputLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontFamily: FontFamily.body, fontSize: FontSize.md, color: Colors.textPrimary },
  textArea: { minHeight: 90, textAlignVertical: 'top' },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 0 },
  pickedWrap: { position: 'relative' },
  pickedThumb: { width: 90, height: 90, borderRadius: 12 },
  removeBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: Colors.bg, borderRadius: 10 },
  addPhotoBtn: { width: 90, height: 90, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: Colors.surface },
  addPhotoBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  noPhotosText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginVertical: 20 },

  saveBtn: { borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 28 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: '#fff' },
});
