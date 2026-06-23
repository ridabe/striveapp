import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { TenantLogo } from '@/components/TenantLogo';
import { ModuleGuard } from '@/components/ModuleGuard';
import { MODULE } from '@/lib/modules';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const INTENSITY_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  muito_leve: { label: 'Muito leve', color: '#94A3B8', emoji: '😴' },
  leve:       { label: 'Leve',       color: '#60A5FA', emoji: '🙂' },
  moderado:   { label: 'Moderado',   color: '#4ADE80', emoji: '💪' },
  intenso:    { label: 'Intenso',    color: '#F59E0B', emoji: '🔥' },
  muito_intenso: { label: 'Pesado', color: '#EF4444', emoji: '😤' },
};

function fmtDuration(secs: number | null) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  return `${m} min`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function HistoricoScreen() {
  const { student } = useStudent();
  const { primaryColor } = useThemeStore();

  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!student) return;
    const { data } = await supabase
      .from('workout_sessions')
      .select('id, started_at, finished_at, duration_seconds, intensity, notes, workout_plans(name), workout_routines(name)')
      .eq('student_id', student.id)
      .not('finished_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(50);
    setSessions(data ?? []);
    setLoading(false);
  }, [student?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Histórico</Text>
        <TenantLogo size={32} radius={9} />
      </View>

      <ModuleGuard slug={MODULE.EXECUCAO_TREINO}>
      {loading ? <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} /> : (
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            sessions.length > 0 ? (
              <View style={[s.summaryCard, { borderColor: `${primaryColor}30` }]}>
                <View style={s.summaryItem}>
                  <Text style={[s.summaryNum, { color: primaryColor }]}>{sessions.length}</Text>
                  <Text style={s.summaryLabel}>Sessões</Text>
                </View>
                <View style={s.summaryItem}>
                  <Text style={[s.summaryNum, { color: primaryColor }]}>
                    {Math.round(sessions.reduce((a, s) => a + (s.duration_seconds ?? 0), 0) / 60)}
                  </Text>
                  <Text style={s.summaryLabel}>Min totais</Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="time-outline" size={48} color={Colors.border} />
              <Text style={s.emptyTitle}>Nenhuma sessão ainda</Text>
              <Text style={s.emptyDesc}>Seus treinos concluídos aparecerão aqui.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const ic = item.intensity ? INTENSITY_CONFIG[item.intensity] : null;
            return (
              <View style={s.sessionCard}>
                <View style={s.sessionTop}>
                  <View>
                    <Text style={s.sessionDate}>{fmtDate(item.started_at)}</Text>
                    <Text style={s.sessionTime}>{fmtTime(item.started_at)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 5 }}>
                    {ic && (
                      <View style={[s.intensityPill, { backgroundColor: `${ic.color}18` }]}>
                        <Text style={s.intensityEmoji}>{ic.emoji}</Text>
                        <Text style={[s.intensityLabel, { color: ic.color }]}>{ic.label}</Text>
                      </View>
                    )}
                    <View style={s.durationRow}>
                      <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
                      <Text style={s.durationText}>{fmtDuration(item.duration_seconds)}</Text>
                    </View>
                  </View>
                </View>
                {(item.workout_plans?.name || item.workout_routines?.name) && (
                  <View style={s.planRow}>
                    <Ionicons name="document-text-outline" size={12} color={Colors.textSecondary} />
                    <Text style={s.planText} numberOfLines={1}>
                      {[item.workout_plans?.name, item.workout_routines?.name].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                )}
                {item.notes && (
                  <Text style={s.notes} numberOfLines={2}>{item.notes}</Text>
                )}
              </View>
            );
          }}
        />
      )}
      </ModuleGuard>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, gap: 10 },
  summaryCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1.5, padding: 20, marginBottom: 8, gap: 16 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryNum: { fontFamily: FontFamily.bodyBold, fontSize: 30 },
  summaryLabel: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary },
  sessionCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 8 },
  sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sessionDate: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  sessionTime: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  intensityPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  intensityEmoji: { fontSize: 12 },
  intensityLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  durationText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, flex: 1 },
  notes: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 18 },
  empty: { alignItems: 'center', paddingTop: 64, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
