import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

interface Assessment {
  id: string;
  assessed_at: string;
  height: number | null;
  weight: number | null;
  bmi: number | null;
  body_fat: number | null;
  chest: number | null;
  waist: number | null;
  hip: number | null;
  arm: number | null;
  thigh: number | null;
  notes: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function Measure({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  if (value == null) return null;
  return (
    <View style={m.measureRow}>
      <Text style={m.measureLabel}>{label}</Text>
      <Text style={m.measureValue}>{value.toFixed(1)} <Text style={m.measureUnit}>{unit}</Text></Text>
    </View>
  );
}

export default function AvaliacaoScreen() {
  const { student } = useStudent();
  const { primaryColor } = useThemeStore();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selected, setSelected] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!student) return;
    const { data } = await supabase
      .from('physical_assessments')
      .select('id, assessed_at, height, weight, bmi, body_fat, chest, waist, hip, arm, thigh, notes')
      .eq('student_id', student.id)
      .order('assessed_at', { ascending: false });
    const list = data ?? [];
    setAssessments(list as Assessment[]);
    if (list.length > 0) setSelected(list[0] as Assessment);
    setLoading(false);
  }, [student?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={m.safe} edges={['top']}>
      <View style={m.header}>
        <TouchableOpacity onPress={() => router.back()} style={m.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={m.title}>Avaliação Física</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} /> : (
        assessments.length === 0 ? (
          <View style={m.empty}>
            <Ionicons name="body-outline" size={52} color={Colors.border} />
            <Text style={m.emptyTitle}>Nenhuma avaliação</Text>
            <Text style={m.emptyDesc}>Suas avaliações físicas registradas pelo treinador aparecerão aqui.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={m.scroll} showsVerticalScrollIndicator={false}>
            {/* Date selector */}
            {assessments.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
                {assessments.map(a => (
                  <TouchableOpacity
                    key={a.id}
                    style={[m.datePill, selected?.id === a.id && { backgroundColor: primaryColor }]}
                    onPress={() => setSelected(a)}
                    activeOpacity={0.8}
                  >
                    <Text style={[m.datePillText, selected?.id === a.id && { color: '#fff' }]}>
                      {new Date(a.assessed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {selected && (
              <>
                <Text style={m.assessDate}>{fmtDate(selected.assessed_at)}</Text>

                {/* Main metrics */}
                <View style={m.mainMetrics}>
                  {selected.weight != null && (
                    <View style={[m.mainMetric, { borderColor: `${primaryColor}30` }]}>
                      <Text style={[m.mainMetricNum, { color: primaryColor }]}>{selected.weight.toFixed(1)}</Text>
                      <Text style={m.mainMetricUnit}>kg</Text>
                      <Text style={m.mainMetricLabel}>Peso</Text>
                    </View>
                  )}
                  {selected.height != null && (
                    <View style={[m.mainMetric, { borderColor: `${primaryColor}30` }]}>
                      <Text style={[m.mainMetricNum, { color: primaryColor }]}>{selected.height.toFixed(0)}</Text>
                      <Text style={m.mainMetricUnit}>cm</Text>
                      <Text style={m.mainMetricLabel}>Altura</Text>
                    </View>
                  )}
                  {selected.bmi != null && (
                    <View style={[m.mainMetric, { borderColor: `${primaryColor}30` }]}>
                      <Text style={[m.mainMetricNum, { color: primaryColor }]}>{selected.bmi.toFixed(1)}</Text>
                      <Text style={m.mainMetricUnit}>IMC</Text>
                      <Text style={m.mainMetricLabel}>Índice</Text>
                    </View>
                  )}
                  {selected.body_fat != null && (
                    <View style={[m.mainMetric, { borderColor: `${primaryColor}30` }]}>
                      <Text style={[m.mainMetricNum, { color: primaryColor }]}>{selected.body_fat.toFixed(1)}</Text>
                      <Text style={m.mainMetricUnit}>%</Text>
                      <Text style={m.mainMetricLabel}>Gordura</Text>
                    </View>
                  )}
                </View>

                {/* Circumferences */}
                {(selected.chest || selected.waist || selected.hip || selected.arm || selected.thigh) && (
                  <View style={m.card}>
                    <Text style={m.cardTitle}>CIRCUNFERÊNCIAS</Text>
                    <Measure label="Peito" value={selected.chest} unit="cm" />
                    <Measure label="Cintura" value={selected.waist} unit="cm" />
                    <Measure label="Quadril" value={selected.hip} unit="cm" />
                    <Measure label="Braço" value={selected.arm} unit="cm" />
                    <Measure label="Coxa" value={selected.thigh} unit="cm" />
                  </View>
                )}

                {selected.notes && (
                  <View style={m.card}>
                    <Text style={m.cardTitle}>OBSERVAÇÕES</Text>
                    <Text style={m.notesText}>{selected.notes}</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )
      )}
    </SafeAreaView>
  );
}

const m = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 14 },
  datePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  datePillText: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: Colors.textPrimary },
  assessDate: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textSecondary, letterSpacing: 0.5 },
  mainMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mainMetric: { flex: 1, minWidth: 80, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1.5, padding: 16, alignItems: 'center' },
  mainMetricNum: { fontFamily: FontFamily.bodyBold, fontSize: 26 },
  mainMetricUnit: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  mainMetricLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 10 },
  cardTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },
  measureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  measureLabel: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
  measureValue: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  measureUnit: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  notesText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
