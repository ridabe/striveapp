import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert, Dimensions,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const { width: W } = Dimensions.get('window');
const CHART_W = W - 64;
const CHART_H = 120;

interface ProgressEntry {
  id: string;
  recorded_at: string;
  weight: number | null;
  notes: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function ProgressoScreen() {
  const { student } = useStudent();
  const { primaryColor } = useThemeStore();

  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fWeight, setFWeight] = useState('');
  const [fNotes, setFNotes] = useState('');

  const load = useCallback(async () => {
    if (!student) return;
    const { data } = await supabase
      .from('student_progress')
      .select('id, recorded_at, weight, notes')
      .eq('student_id', student.id)
      .order('recorded_at', { ascending: true })
      .limit(30);
    setEntries(data ?? []);
    setLoading(false);
  }, [student?.id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!student || !fWeight.trim()) { Alert.alert('Informe o peso.'); return; }
    setSaving(true);
    await supabase.from('student_progress').insert({
      student_id: student.id,
      tenant_id: student.tenant_id,
      weight: parseFloat(fWeight.replace(',', '.')),
      notes: fNotes.trim() || null,
      recorded_at: new Date().toISOString(),
      photo_urls: [],
    } as any);
    setFWeight(''); setFNotes('');
    setModalVisible(false);
    setSaving(false);
    await load();
  }

  // Mini chart with weights
  const weightEntries = entries.filter(e => e.weight != null);
  const weights = weightEntries.map(e => e.weight as number);
  const minW = weights.length ? Math.min(...weights) - 2 : 0;
  const maxW = weights.length ? Math.max(...weights) + 2 : 100;
  const range = maxW - minW || 1;

  function toY(w: number) {
    return CHART_H - ((w - minW) / range) * CHART_H;
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.headerRow}>
          <Text style={s.title}>Progresso</Text>
        </View>
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const latest = weightEntries[weightEntries.length - 1];
  const prev = weightEntries[weightEntries.length - 2];
  const diff = latest && prev ? latest.weight! - prev.weight! : null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.headerRow}>
        <Text style={s.title}>Progresso</Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: primaryColor }]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Current weight card */}
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
                <Ionicons
                  name={diff > 0 ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={diff > 0 ? '#EF4444' : '#4ADE80'}
                />
                <Text style={[s.diffText, { color: diff > 0 ? '#EF4444' : '#4ADE80' }]}>
                  {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={s.emptyCard}>
            <Ionicons name="scale-outline" size={40} color={Colors.border} />
            <Text style={s.emptyTitle}>Nenhum registro ainda</Text>
            <Text style={s.emptyDesc}>Registre seu peso para acompanhar sua evolução.</Text>
            <TouchableOpacity
              style={[s.emptyBtn, { backgroundColor: primaryColor }]}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={s.emptyBtnText}>Registrar peso</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Weight chart */}
        {weightEntries.length >= 2 && (
          <View style={s.chartCard}>
            <Text style={s.chartTitle}>EVOLUÇÃO DO PESO</Text>
            <View style={{ height: CHART_H + 24, position: 'relative', marginTop: 8 }}>
              {/* Y axis labels */}
              <Text style={[s.chartAxisLabel, { top: 0 }]}>{maxW.toFixed(0)}kg</Text>
              <Text style={[s.chartAxisLabel, { bottom: 20 }]}>{minW.toFixed(0)}kg</Text>

              {/* Dots and line */}
              <View style={{ position: 'absolute', left: 36, right: 0, top: 0, height: CHART_H }}>
                {weightEntries.map((entry, idx) => {
                  const x = idx === 0 ? 0 : (idx / (weightEntries.length - 1)) * (CHART_W - 36);
                  const y = toY(entry.weight!);
                  return (
                    <View key={entry.id}
                      style={{
                        position: 'absolute',
                        left: x - 5,
                        top: y - 5,
                        width: 10, height: 10,
                        borderRadius: 5,
                        backgroundColor: primaryColor,
                      }}
                    />
                  );
                })}
              </View>
              {/* Date labels */}
              <View style={{ position: 'absolute', left: 36, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={s.chartDateLabel}>{fmtDate(weightEntries[0].recorded_at)}</Text>
                <Text style={s.chartDateLabel}>{fmtDate(weightEntries[weightEntries.length - 1].recorded_at)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* History list */}
        {entries.length > 0 && (
          <>
            <Text style={s.sectionLabel}>HISTÓRICO</Text>
            {[...entries].reverse().slice(0, 10).map(entry => (
              <View key={entry.id} style={s.historyRow}>
                <View style={[s.historyDot, { backgroundColor: primaryColor }]} />
                <View style={{ flex: 1 }}>
                  {entry.weight && (
                    <Text style={s.historyWeight}>{entry.weight.toFixed(1)} kg</Text>
                  )}
                  {entry.notes && <Text style={s.historyNotes}>{entry.notes}</Text>}
                </View>
                <Text style={s.historyDate}>{fmtDate(entry.recorded_at)}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Add weight modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => !saving && setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => !saving && setModalVisible(false)} style={s.iconBtn}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={s.modalTitle}>Registrar Peso</Text>
              <View style={{ width: 40 }} />
            </View>
            <ScrollView contentContainerStyle={s.modalBody}>
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
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.saveBtnText}>Salvar</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
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
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 12 },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  historyWeight: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  historyNotes: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  historyDate: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary },
  // Modal
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  modalBody: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  inputLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontFamily: FontFamily.body, fontSize: FontSize.md, color: Colors.textPrimary },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  saveBtn: { borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 28 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: '#fff' },
});
