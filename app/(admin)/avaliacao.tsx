import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Animated, Modal,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

interface Assessment {
  id: string;
  student_id: string;
  assessed_at: string;
  weight: number | null;
  height: number | null;
  sex: string | null;
  bmi: number | null;
  body_fat: number | null;
  chest: number | null;
  arm: number | null;
  waist: number | null;
  hip: number | null;
  thigh: number | null;
  notes: string | null;
}

interface Student { id: string; full_name: string; status: string }

interface StudentSummary extends Student {
  totalAssessments: number;
  lastBMI: number | null;
  lastWeight: number | null;
  lastDate: string | null;
}

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function calcBMI(weight?: number | null, height?: number | null): number | null {
  if (!weight || !height) return null;
  return weight / Math.pow(height / 100, 2);
}

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Abaixo do peso', color: '#60A5FA' };
  if (bmi < 25)   return { label: 'Peso normal', color: Colors.success };
  if (bmi < 30)   return { label: 'Sobrepeso', color: Colors.warning };
  return { label: 'Obesidade', color: Colors.error };
}

function BMIBar({ bmi, primaryColor }: { bmi: number; primaryColor: string }) {
  const barAnim = useRef(new Animated.Value(0)).current;
  const { label, color } = bmiCategory(bmi);
  const pct = Math.min(Math.max((bmi - 10) / 30, 0), 1);

  useEffect(() => {
    barAnim.setValue(0);
    Animated.timing(barAnim, { toValue: pct, duration: 900, useNativeDriver: false }).start();
  }, [bmi]);

  const markerLeft = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={bmiSt.container}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <View>
          <Text style={bmiSt.bmiNum}>{bmi.toFixed(1)}</Text>
          <Text style={[bmiSt.bmiCat, { color }]}>{label}</Text>
        </View>
        <View style={bmiSt.legend}>
          {[{ c: '#60A5FA', l: '<18.5' }, { c: Colors.success, l: '18.5–25' }, { c: Colors.warning, l: '25–30' }, { c: Colors.error, l: '>30' }].map(({ c, l }) => (
            <View key={l} style={bmiSt.legendRow}>
              <View style={[bmiSt.legendDot, { backgroundColor: c }]} />
              <Text style={bmiSt.legendText}>{l}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={bmiSt.trackBg}>
        <View style={[bmiSt.seg, { flex: 8.5, backgroundColor: '#60A5FA' }]} />
        <View style={[bmiSt.seg, { flex: 6.5, backgroundColor: Colors.success }]} />
        <View style={[bmiSt.seg, { flex: 5, backgroundColor: Colors.warning }]} />
        <View style={[bmiSt.seg, { flex: 10, backgroundColor: Colors.error }]} />
      </View>
      <View style={bmiSt.markerTrack}>
        <Animated.View style={[bmiSt.markerLine, { left: markerLeft, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function Measure({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  if (!value) return null;
  return (
    <View style={meSt.row}>
      <Text style={meSt.label}>{label}</Text>
      <Text style={meSt.value}>{value} <Text style={meSt.unit}>{unit}</Text></Text>
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
              {students.reduce((s, a) => s + a.totalAssessments, 0)}
            </Text>
            <Text style={sl.statLabel}>Avaliações</Text>
          </View>
          <View style={sl.statCard}>
            <Text style={[sl.statNum, { color: primaryColor }]}>
              {students.filter(s => s.totalAssessments > 0).length}
            </Text>
            <Text style={sl.statLabel}>Avaliados</Text>
          </View>
        </View>
      }
      renderItem={({ item }) => {
        const initials = item.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
        const bmi = item.lastBMI;
        const bmiInfo = bmi ? bmiCategory(bmi) : null;

        return (
          <TouchableOpacity style={sl.card} onPress={() => onSelect(item)} activeOpacity={0.75}>
            <View style={[sl.avatar, { backgroundColor: `${primaryColor}20` }]}>
              <Text style={[sl.avatarLetter, { color: primaryColor }]}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sl.name}>{item.full_name}</Text>
              <Text style={sl.sub}>
                {item.totalAssessments === 0
                  ? 'Sem avaliações'
                  : `${item.totalAssessments} avaliação(ões) · última: ${item.lastDate ? (() => { const d = new Date(item.lastDate); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; })() : '—'}`}
              </Text>
              {bmiInfo && bmi && (
                <View style={[sl.bmiBadge, { backgroundColor: `${bmiInfo.color}18` }]}>
                  <Text style={[sl.bmiText, { color: bmiInfo.color }]}>IMC {bmi.toFixed(1)} · {bmiInfo.label}</Text>
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
          <Text style={sl.emptyText}>Cadastre alunos para gerenciar as avaliações físicas.</Text>
        </View>
      }
    />
  );
}

// ─── Student detail view ──────────────────────────────────────────────────────
function StudentDetailView({
  assessments, loading, primaryColor, onAddPress,
}: {
  assessments: Assessment[];
  loading: boolean;
  primaryColor: string;
  onAddPress: () => void;
}) {
  if (loading) return <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />;

  const latest = assessments[0] ?? null;

  return (
    <FlatList
      data={assessments.slice(1)}
      keyExtractor={a => a.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      ListHeaderComponent={
        <>
          {latest ? (
            <View style={det.latestCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <View>
                  <Text style={det.latestLabel}>ÚLTIMA AVALIAÇÃO</Text>
                  <Text style={det.latestDate}>{fmtDate(latest.assessed_at)}</Text>
                </View>
                {latest.sex && (
                  <View style={[det.sexBadge, { backgroundColor: `${primaryColor}18` }]}>
                    <Ionicons name={latest.sex === 'male' ? 'male-outline' : 'female-outline'} size={14} color={primaryColor} />
                    <Text style={[det.sexText, { color: primaryColor }]}>
                      {latest.sex === 'male' ? 'Masculino' : 'Feminino'}
                    </Text>
                  </View>
                )}
              </View>

              <View style={det.metricsGrid}>
                {latest.weight && (
                  <View style={det.metricItem}>
                    <Text style={det.metricVal}>{latest.weight}</Text>
                    <Text style={det.metricUnit}>kg</Text>
                    <Text style={det.metricLabel}>Peso</Text>
                  </View>
                )}
                {latest.height && (
                  <View style={det.metricItem}>
                    <Text style={det.metricVal}>{latest.height}</Text>
                    <Text style={det.metricUnit}>cm</Text>
                    <Text style={det.metricLabel}>Altura</Text>
                  </View>
                )}
                {latest.body_fat && (
                  <View style={det.metricItem}>
                    <Text style={det.metricVal}>{latest.body_fat}</Text>
                    <Text style={det.metricUnit}>%</Text>
                    <Text style={det.metricLabel}>% Gordura</Text>
                  </View>
                )}
              </View>

              {latest.bmi && <BMIBar bmi={latest.bmi} primaryColor={primaryColor} />}

              {(latest.chest || latest.arm || latest.waist || latest.hip || latest.thigh) && (
                <View style={det.measureBlock}>
                  <Text style={det.measureTitle}>CIRCUNFERÊNCIAS</Text>
                  <Measure label="Peito" value={latest.chest} unit="cm" />
                  <Measure label="Braço" value={latest.arm} unit="cm" />
                  <Measure label="Cintura" value={latest.waist} unit="cm" />
                  <Measure label="Quadril" value={latest.hip} unit="cm" />
                  <Measure label="Coxa" value={latest.thigh} unit="cm" />
                </View>
              )}

              {latest.notes && (
                <View style={det.notesBox}>
                  <Ionicons name="document-text-outline" size={14} color={Colors.textSecondary} />
                  <Text style={det.notesText}>{latest.notes}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={det.empty}>
              <Ionicons name="stats-chart-outline" size={52} color={Colors.border} />
              <Text style={det.emptyTitle}>Sem avaliações</Text>
              <Text style={det.emptyText}>Toque em + para registrar a primeira avaliação.</Text>
            </View>
          )}

          <TouchableOpacity style={[det.addBtn, { borderColor: primaryColor }]} onPress={onAddPress} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={18} color={primaryColor} />
            <Text style={[det.addBtnText, { color: primaryColor }]}>Nova avaliação física</Text>
          </TouchableOpacity>

          {assessments.length > 1 && <Text style={det.sectionLabel}>HISTÓRICO</Text>}
        </>
      }
      renderItem={({ item }) => {
        const bmi = item.bmi ?? calcBMI(item.weight, item.height);
        return (
          <View style={det.histCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[det.histDot, { backgroundColor: primaryColor }]} />
              <Text style={det.histDate}>{fmtDate(item.assessed_at)}</Text>
            </View>
            <View style={det.histRow}>
              {item.weight && <View style={det.histStat}><Text style={det.histVal}>{item.weight}kg</Text><Text style={det.histKey}>Peso</Text></View>}
              {bmi && <View style={det.histStat}><Text style={det.histVal}>{bmi.toFixed(1)}</Text><Text style={det.histKey}>IMC</Text></View>}
              {item.body_fat && <View style={det.histStat}><Text style={det.histVal}>{item.body_fat}%</Text><Text style={det.histKey}>Gordura</Text></View>}
              {item.waist && <View style={det.histStat}><Text style={det.histVal}>{item.waist}cm</Text><Text style={det.histKey}>Cintura</Text></View>}
            </View>
          </View>
        );
      }}
    />
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AvaliacaoScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id;

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalStudent, setModalStudent] = useState<StudentSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [fWeight, setFWeight] = useState('');
  const [fHeight, setFHeight] = useState('');
  const [fSex, setFSex] = useState<'male' | 'female' | ''>('');
  const [fBodyFat, setFBodyFat] = useState('');
  const [fChest, setFChest] = useState('');
  const [fArm, setFArm] = useState('');
  const [fWaist, setFWaist] = useState('');
  const [fHip, setFHip] = useState('');
  const [fThigh, setFThigh] = useState('');
  const [fNotes, setFNotes] = useState('');

  const lightText = ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(primaryColor);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const [stRes, assRes] = await Promise.all([
      supabase.from('students').select('id, full_name, status').eq('tenant_id', tenantId).order('full_name'),
      supabase.from('physical_assessments')
        .select('student_id, assessed_at, weight, height, bmi')
        .eq('tenant_id', tenantId)
        .order('assessed_at', { ascending: false }),
    ]);

    const allAss: any[] = assRes.data ?? [];

    const summary: StudentSummary[] = (stRes.data ?? []).map((s: Student) => {
      const recs = allAss.filter(a => a.student_id === s.id);
      const latest = recs[0];
      return {
        ...s,
        totalAssessments: recs.length,
        lastBMI: latest?.bmi ?? null,
        lastWeight: latest?.weight ?? null,
        lastDate: latest?.assessed_at ?? null,
      };
    });

    setStudents(summary);
  }, [tenantId]);

  const loadDetail = useCallback(async (studentId: string) => {
    setLoadingDetail(true);
    const { data } = await supabase.from('physical_assessments')
      .select('id,student_id,assessed_at,weight,height,sex,bmi,body_fat,chest,arm,waist,hip,thigh,notes')
      .eq('student_id', studentId)
      .order('assessed_at', { ascending: false });
    setAssessments(data ?? []);
    setLoadingDetail(false);
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  function openAdd(student: StudentSummary) {
    setModalStudent(student);
    setFWeight(''); setFHeight(''); setFSex(''); setFBodyFat('');
    setFChest(''); setFArm(''); setFWaist(''); setFHip(''); setFThigh(''); setFNotes('');
    setModalVisible(true);
  }

  async function handleSelect(s: StudentSummary) {
    setSelected(s);
    await loadDetail(s.id);
  }

  async function handleSave() {
    if (!modalStudent || !tenantId) return;
    const weight = fWeight ? parseFloat(fWeight.replace(',', '.')) : null;
    const height = fHeight ? parseFloat(fHeight.replace(',', '.')) : null;
    const bmi = calcBMI(weight, height);

    setSaving(true);
    try {
      const { error } = await supabase.from('physical_assessments').insert({
        tenant_id: tenantId, student_id: modalStudent.id,
        assessed_at: new Date().toISOString(),
        weight, height, sex: fSex || null, bmi,
        body_fat: fBodyFat ? parseFloat(fBodyFat) : null,
        chest:  fChest  ? parseFloat(fChest)  : null,
        arm:    fArm    ? parseFloat(fArm)    : null,
        waist:  fWaist  ? parseFloat(fWaist)  : null,
        hip:    fHip    ? parseFloat(fHip)    : null,
        thigh:  fThigh  ? parseFloat(fThigh)  : null,
        notes: fNotes.trim() || null,
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

  const previewBMI = fWeight && fHeight ? calcBMI(parseFloat(fWeight), parseFloat(fHeight)) : null;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.header}>
        <TouchableOpacity
          onPress={() => selected ? setSelected(null) : router.back()}
          style={st.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={st.title} numberOfLines={1}>
          {selected ? selected.full_name.split(' ')[0] : 'Avaliação Física'}
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
          assessments={assessments} loading={loadingDetail}
          primaryColor={primaryColor} onAddPress={() => openAdd(selected)}
        />
      ) : (
        <StudentListView
          students={students} loading={loading}
          primaryColor={primaryColor}
          onSelect={handleSelect} onAdd={openAdd}
        />
      )}

      {/* Add modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => !saving && setModalVisible(false)}>
        <KeyboardAvoidingView style={st.modalSafe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={st.modalHeader}>
            <TouchableOpacity onPress={() => !saving && setModalVisible(false)} style={st.backBtn}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={st.title}>Nova Avaliação</Text>
            <View style={{ width: 38 }} />
          </View>
          <ScrollView contentContainerStyle={st.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={st.modalLabel}>ALUNO</Text>
            <Text style={st.modalStudentName}>{modalStudent?.full_name}</Text>

            <Text style={[st.modalLabel, { marginTop: 20 }]}>SEXO</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['male', 'female'] as const).map(sex => (
                <TouchableOpacity key={sex}
                  style={[st.sexOption, fSex === sex && { borderColor: primaryColor, backgroundColor: `${primaryColor}15` }]}
                  onPress={() => setFSex(sex)} activeOpacity={0.8}>
                  <Ionicons name={sex === 'male' ? 'male-outline' : 'female-outline'}
                    size={18} color={fSex === sex ? primaryColor : Colors.textSecondary} />
                  <Text style={[st.sexOptionText, { color: fSex === sex ? primaryColor : Colors.textSecondary }]}>
                    {sex === 'male' ? 'Masculino' : 'Feminino'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[st.inputRow, { marginTop: 16 }]}>
              <View style={{ flex: 1 }}>
                <Text style={st.modalLabel}>PESO (kg)</Text>
                <TextInput value={fWeight} onChangeText={setFWeight} placeholder="Ex: 75.5"
                  placeholderTextColor={Colors.textSecondary} keyboardType="decimal-pad" style={st.modalInput} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.modalLabel}>ALTURA (cm)</Text>
                <TextInput value={fHeight} onChangeText={setFHeight} placeholder="Ex: 175"
                  placeholderTextColor={Colors.textSecondary} keyboardType="decimal-pad" style={st.modalInput} />
              </View>
            </View>

            {previewBMI && (() => {
              const { label, color } = bmiCategory(previewBMI);
              return (
                <View style={[st.bmiPreview, { backgroundColor: `${color}15`, borderColor: color }]}>
                  <Text style={[st.bmiPreviewText, { color }]}>IMC: {previewBMI.toFixed(1)} — {label}</Text>
                </View>
              );
            })()}

            <Text style={[st.modalLabel, { marginTop: 16 }]}>% GORDURA CORPORAL</Text>
            <TextInput value={fBodyFat} onChangeText={setFBodyFat} placeholder="Ex: 18.5"
              placeholderTextColor={Colors.textSecondary} keyboardType="decimal-pad" style={st.modalInput} />

            <Text style={[st.modalLabel, { marginTop: 20 }]}>CIRCUNFERÊNCIAS (cm)</Text>
            <View style={st.inputRow}>
              <TextInput value={fChest} onChangeText={setFChest} placeholder="Peito"
                placeholderTextColor={Colors.textSecondary} keyboardType="decimal-pad"
                style={[st.modalInput, { flex: 1 }]} />
              <TextInput value={fArm} onChangeText={setFArm} placeholder="Braço"
                placeholderTextColor={Colors.textSecondary} keyboardType="decimal-pad"
                style={[st.modalInput, { flex: 1 }]} />
            </View>
            <View style={[st.inputRow, { marginTop: 10 }]}>
              <TextInput value={fWaist} onChangeText={setFWaist} placeholder="Cintura"
                placeholderTextColor={Colors.textSecondary} keyboardType="decimal-pad"
                style={[st.modalInput, { flex: 1 }]} />
              <TextInput value={fHip} onChangeText={setFHip} placeholder="Quadril"
                placeholderTextColor={Colors.textSecondary} keyboardType="decimal-pad"
                style={[st.modalInput, { flex: 1 }]} />
            </View>
            <TextInput value={fThigh} onChangeText={setFThigh} placeholder="Coxa (cm)"
              placeholderTextColor={Colors.textSecondary} keyboardType="decimal-pad"
              style={[st.modalInput, { marginTop: 10 }]} />

            <Text style={[st.modalLabel, { marginTop: 16 }]}>OBSERVAÇÕES</Text>
            <TextInput value={fNotes} onChangeText={setFNotes}
              placeholder="Observações do personal trainer..."
              placeholderTextColor={Colors.textSecondary}
              multiline numberOfLines={3} style={[st.modalInput, st.textArea]} />

            <TouchableOpacity
              style={[st.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
              onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color={lightText ? '#000' : '#fff'} /> : (
                <Text style={[st.saveBtnText, { color: lightText ? '#000' : '#fff' }]}>Salvar Avaliação</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const bmiSt = StyleSheet.create({
  container: { marginTop: 16 },
  bmiNum: { fontFamily: FontFamily.bodyBold, fontSize: 24, color: Colors.textPrimary },
  bmiCat: { fontFamily: FontFamily.bodyMedium, fontSize: 12, marginTop: 2 },
  legend: { alignItems: 'flex-end', gap: 3 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
  trackBg: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 8 },
  seg: { height: 10 },
  markerTrack: { position: 'relative', height: 12 },
  markerLine: { position: 'absolute', width: 3, height: 12, borderRadius: 2, top: 0, marginLeft: -1.5 },
});

const meSt = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
  value: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  unit: { fontFamily: FontFamily.body, color: Colors.textSecondary },
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
  bmiBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginTop: 5 },
  bmiText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  addBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

const det = StyleSheet.create({
  latestCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 18, marginTop: 16, marginBottom: 14 },
  latestLabel: { fontFamily: FontFamily.bodyBold, fontSize: 10, color: Colors.textSecondary, letterSpacing: 1 },
  latestDate: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, color: Colors.textPrimary, marginTop: 4 },
  sexBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  sexText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  metricsGrid: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  metricItem: { flex: 1, backgroundColor: Colors.bg, borderRadius: 12, padding: 12, alignItems: 'center' },
  metricVal: { fontFamily: FontFamily.bodyBold, fontSize: 22, color: Colors.textPrimary },
  metricUnit: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  metricLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  measureBlock: { marginTop: 16 },
  measureTitle: { fontFamily: FontFamily.bodyBold, fontSize: 10, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  notesBox: { flexDirection: 'row', gap: 8, backgroundColor: Colors.bg, borderRadius: 10, padding: 10, marginTop: 12, alignItems: 'flex-start' },
  notesText: { flex: 1, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 14 },
  addBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },
  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 10 },
  histCard: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 8, gap: 10 },
  histDot: { width: 8, height: 8, borderRadius: 4 },
  histDate: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  histRow: { flexDirection: 'row', gap: 16 },
  histStat: { alignItems: 'center' },
  histVal: { fontFamily: FontFamily.bodyBold, fontSize: 16, color: Colors.textPrimary },
  histKey: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
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
  inputRow: { flexDirection: 'row', gap: 10 },
  modalInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  sexOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  sexOptionText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },
  bmiPreview: { borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 10, alignItems: 'center' },
  bmiPreviewText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16, marginTop: 28 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md },
});
