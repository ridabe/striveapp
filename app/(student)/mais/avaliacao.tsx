import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const { width: W } = Dimensions.get('window');
const BAR_W = W - 64; // horizontal padding 16*2 + card padding 16*2

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

// ── BMI scale ────────────────────────────────────────────────────────────────

const BMI_MIN = 10;
const BMI_MAX = 50;
const BMI_RANGE = BMI_MAX - BMI_MIN;

const BMI_ZONES = [
  { key: 'abaixo',   label: 'Abaixo do peso', min: 10,   max: 18.5, color: '#60A5FA' },
  { key: 'normal',   label: 'Normal',          min: 18.5, max: 25,   color: '#4ADE80' },
  { key: 'sobre',    label: 'Sobrepeso',       min: 25,   max: 30,   color: '#FBBF24' },
  { key: 'ob1',      label: 'Obesidade I',     min: 30,   max: 35,   color: '#F97316' },
  { key: 'ob2',      label: 'Obesidade II',    min: 35,   max: 40,   color: '#EF4444' },
  { key: 'ob3',      label: 'Obesidade III',   min: 40,   max: 50,   color: '#991B1B' },
];

function bmiZone(bmi: number) {
  return BMI_ZONES.find(z => bmi >= z.min && bmi < z.max) ?? BMI_ZONES[BMI_ZONES.length - 1];
}

function BmiBar({ bmi }: { bmi: number }) {
  const zone = bmiZone(bmi);
  const clamp = Math.max(BMI_MIN, Math.min(BMI_MAX - 0.01, bmi));
  const markerPct = (clamp - BMI_MIN) / BMI_RANGE;
  const markerX = markerPct * BAR_W;

  return (
    <View style={bmiS.wrap}>
      {/* Value + category */}
      <View style={bmiS.topRow}>
        <Text style={[bmiS.bigNum, { color: zone.color }]}>{bmi.toFixed(1)}</Text>
        <View style={[bmiS.zoneBadge, { backgroundColor: `${zone.color}22`, borderColor: `${zone.color}50` }]}>
          <View style={[bmiS.zoneDot, { backgroundColor: zone.color }]} />
          <Text style={[bmiS.zoneLabel, { color: zone.color }]}>{zone.label}</Text>
        </View>
      </View>

      {/* Colored bar */}
      <View style={bmiS.barTrack}>
        {BMI_ZONES.map(z => {
          const w = ((z.max - z.min) / BMI_RANGE) * BAR_W;
          return <View key={z.key} style={{ width: w, height: 14, backgroundColor: z.color }} />;
        })}
      </View>

      {/* Marker */}
      <View style={{ height: 20, position: 'relative' }}>
        <View
          style={[
            bmiS.marker,
            { left: Math.max(6, Math.min(BAR_W - 6, markerX)) - 6, borderColor: zone.color },
          ]}
        />
        <View style={[bmiS.markerLine, { left: Math.max(1, Math.min(BAR_W - 1, markerX)) - 1 }]} />
      </View>

      {/* Legend */}
      <View style={bmiS.legend}>
        {BMI_ZONES.map(z => (
          <View key={z.key} style={bmiS.legendItem}>
            <View style={[bmiS.legendDot, { backgroundColor: z.color }]} />
            <Text style={[bmiS.legendLabel, z.key === zone.key && { color: zone.color, fontFamily: FontFamily.bodyBold }]}>
              {z.label}
            </Text>
            <Text style={bmiS.legendRange}>
              {z.min}
              {z.key === 'ob3' ? '+' : `–${z.max}`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function DeltaBadge({ diff, unit }: { diff: number; unit: string }) {
  const up = diff > 0;
  const color = up ? '#F97316' : '#4ADE80';
  const icon = up ? 'arrow-up' : 'arrow-down';
  return (
    <View style={[delta.badge, { backgroundColor: `${color}18` }]}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[delta.text, { color }]}>
        {up ? '+' : ''}{diff.toFixed(1)} {unit}
      </Text>
    </View>
  );
}

function Measure({ label, value, unit, diff }: { label: string; value: number | null; unit: string; diff?: number | null }) {
  if (value == null) return null;
  return (
    <View style={m.measureRow}>
      <Text style={m.measureLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {diff != null && diff !== 0 && <DeltaBadge diff={diff} unit={unit} />}
        <Text style={m.measureValue}>{value.toFixed(1)} <Text style={m.measureUnit}>{unit}</Text></Text>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

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

  // Find previous assessment (chronologically before selected)
  const sortedAsc = [...assessments].sort(
    (a, b) => new Date(a.assessed_at).getTime() - new Date(b.assessed_at).getTime()
  );
  const selectedIdx = sortedAsc.findIndex(a => a.id === selected?.id);
  const prev = selectedIdx > 0 ? sortedAsc[selectedIdx - 1] : null;

  function diff(curr: number | null | undefined, before: number | null | undefined): number | null {
    if (curr == null || before == null) return null;
    const d = curr - before;
    return d === 0 ? null : d;
  }

  return (
    <SafeAreaView style={m.safe} edges={['top']}>
      <View style={m.header}>
        <TouchableOpacity onPress={() => router.back()} style={m.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={m.title}>Avaliação Física</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      ) : assessments.length === 0 ? (
        <View style={m.empty}>
          <Ionicons name="body-outline" size={52} color={Colors.border} />
          <Text style={m.emptyTitle}>Nenhuma avaliação</Text>
          <Text style={m.emptyDesc}>Suas avaliações físicas registradas pelo treinador aparecerão aqui.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={m.scroll} showsVerticalScrollIndicator={false}>

          {/* Date selector */}
          {assessments.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 4 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
              {assessments.map(a => (
                <TouchableOpacity
                  key={a.id}
                  style={[m.datePill, selected?.id === a.id && { backgroundColor: primaryColor }]}
                  onPress={() => setSelected(a)}
                  activeOpacity={0.8}
                >
                  <Text style={[m.datePillText, selected?.id === a.id && { color: '#fff' }]}>
                    {fmtShort(a.assessed_at)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {selected && (
            <>
              <Text style={m.assessDate}>{fmtDate(selected.assessed_at)}</Text>

              {/* Weight variation banner */}
              {prev && selected.weight != null && prev.weight != null && (
                <View style={m.variationBanner}>
                  <Ionicons name="swap-vertical-outline" size={16} color={Colors.textSecondary} />
                  <Text style={m.variationText}>
                    Em relação a{' '}
                    <Text style={{ fontFamily: FontFamily.bodyBold }}>
                      {fmtShort(prev.assessed_at)}
                    </Text>
                    :
                  </Text>
                  <DeltaBadge diff={selected.weight - prev.weight} unit="kg" />
                </View>
              )}

              {/* Main metrics grid */}
              <View style={m.mainMetrics}>
                {selected.weight != null && (
                  <View style={[m.mainMetric, { borderColor: `${primaryColor}30` }]}>
                    <Text style={[m.mainMetricNum, { color: primaryColor }]}>{selected.weight.toFixed(1)}</Text>
                    <Text style={m.mainMetricUnit}>kg</Text>
                    <Text style={m.mainMetricLabel}>Peso</Text>
                    {diff(selected.weight, prev?.weight) != null && (
                      <DeltaBadge diff={diff(selected.weight, prev?.weight)!} unit="kg" />
                    )}
                  </View>
                )}
                {selected.height != null && (
                  <View style={[m.mainMetric, { borderColor: `${primaryColor}30` }]}>
                    <Text style={[m.mainMetricNum, { color: primaryColor }]}>{selected.height.toFixed(0)}</Text>
                    <Text style={m.mainMetricUnit}>cm</Text>
                    <Text style={m.mainMetricLabel}>Altura</Text>
                  </View>
                )}
                {selected.body_fat != null && (
                  <View style={[m.mainMetric, { borderColor: `${primaryColor}30` }]}>
                    <Text style={[m.mainMetricNum, { color: primaryColor }]}>{selected.body_fat.toFixed(1)}</Text>
                    <Text style={m.mainMetricUnit}>%</Text>
                    <Text style={m.mainMetricLabel}>Gordura</Text>
                    {diff(selected.body_fat, prev?.body_fat) != null && (
                      <DeltaBadge diff={diff(selected.body_fat, prev?.body_fat)!} unit="%" />
                    )}
                  </View>
                )}
              </View>

              {/* IMC card with bar */}
              {selected.bmi != null && (
                <View style={m.bmiCard}>
                  <Text style={m.cardTitle}>ÍNDICE DE MASSA CORPORAL</Text>
                  <BmiBar bmi={selected.bmi} />
                  {diff(selected.bmi, prev?.bmi) != null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <Text style={m.compareLabel}>Variação:</Text>
                      <DeltaBadge diff={diff(selected.bmi, prev?.bmi)!} unit="" />
                    </View>
                  )}
                </View>
              )}

              {/* Circumferences */}
              {(selected.chest || selected.waist || selected.hip || selected.arm || selected.thigh) && (
                <View style={m.card}>
                  <Text style={m.cardTitle}>CIRCUNFERÊNCIAS</Text>
                  <Measure label="Peito"   value={selected.chest}  unit="cm" diff={diff(selected.chest,  prev?.chest)}  />
                  <Measure label="Cintura" value={selected.waist}  unit="cm" diff={diff(selected.waist,  prev?.waist)}  />
                  <Measure label="Quadril" value={selected.hip}    unit="cm" diff={diff(selected.hip,    prev?.hip)}    />
                  <Measure label="Braço"   value={selected.arm}    unit="cm" diff={diff(selected.arm,    prev?.arm)}    />
                  <Measure label="Coxa"    value={selected.thigh}  unit="cm" diff={diff(selected.thigh,  prev?.thigh)}  />
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
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const bmiS = StyleSheet.create({
  wrap: { gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bigNum: { fontFamily: FontFamily.bodyBold, fontSize: 36 },
  zoneBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },
  zoneLabel: { fontFamily: FontFamily.bodyBold, fontSize: 13 },
  barTrack: { flexDirection: 'row', borderRadius: 7, overflow: 'hidden', height: 14 },
  marker: { position: 'absolute', top: 3, width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', borderWidth: 2.5, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2 },
  markerLine: { position: 'absolute', top: 0, width: 2, height: 20, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 1 },
  legend: { gap: 6, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  legendLabel: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, flex: 1 },
  legendRange: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
});

const delta = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  text: { fontFamily: FontFamily.bodyBold, fontSize: 11 },
});

const m = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 14 },

  datePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  datePillText: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: Colors.textPrimary },
  assessDate: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textSecondary, letterSpacing: 0.5 },

  variationBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10 },
  variationText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },

  mainMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mainMetric: { flex: 1, minWidth: 88, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1.5, padding: 16, alignItems: 'center', gap: 2 },
  mainMetricNum: { fontFamily: FontFamily.bodyBold, fontSize: 26 },
  mainMetricUnit: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  mainMetricLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  bmiCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 10 },
  cardTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },
  compareLabel: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary },
  measureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  measureLabel: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
  measureValue: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  measureUnit: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  notesText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
