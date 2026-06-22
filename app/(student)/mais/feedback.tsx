import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
  Modal, TextInput, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

interface WorkoutSession {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  intensity: string | null;
  notes: string | null;
  workout_plans: { name: string } | null;
  workout_routines: { name: string } | null;
}

const INTENSITY_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  muito_leve:   { label: 'Muito leve', color: '#94A3B8', emoji: '😴' },
  leve:         { label: 'Leve',       color: '#60A5FA', emoji: '🙂' },
  moderado:     { label: 'Moderado',   color: '#4ADE80', emoji: '💪' },
  intenso:      { label: 'Intenso',    color: '#F59E0B', emoji: '🔥' },
  muito_intenso:{ label: 'Pesado',    color: '#EF4444', emoji: '😤' },
};

const INTENSITY_LEVELS = Object.entries(INTENSITY_CONFIG).map(([key, cfg]) => ({ key, ...cfg }));

export default function FeedbackScreen() {
  const { student } = useStudent();
  const { primaryColor } = useThemeStore();

  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WorkoutSession | null>(null);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!student) return;
    const { data } = await supabase
      .from('workout_sessions')
      .select('id, started_at, duration_seconds, intensity, notes, workout_plans(name), workout_routines(name)')
      .eq('student_id', student.id)
      .not('finished_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(30);
    setSessions((data ?? []) as WorkoutSession[]);
    setLoading(false);
  }, [student?.id]);

  useEffect(() => { load(); }, [load]);

  function openFeedback(session: WorkoutSession) {
    setSelected(session);
    setNoteText(session.notes ?? '');
  }

  async function saveFeedback() {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from('workout_sessions')
      .update({ notes: noteText.trim() || null })
      .eq('id', selected.id);
    setSaving(false);
    if (error) {
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } else {
      setSessions(prev => prev.map(s =>
        s.id === selected.id ? { ...s, notes: noteText.trim() || null } : s
      ));
      setSelected(null);
    }
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  function fmtDuration(secs: number | null) {
    if (!secs) return '—';
    return `${Math.floor(secs / 60)} min`;
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Feedback</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} /> : (
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            sessions.length > 0 ? (
              <Text style={s.hint}>Toque em um treino para adicionar observações.</Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="star-outline" size={52} color={Colors.border} />
              <Text style={s.emptyTitle}>Nenhum treino ainda</Text>
              <Text style={s.emptyDesc}>Conclua um treino para dar feedback aqui.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const ic = item.intensity ? INTENSITY_CONFIG[item.intensity] : null;
            return (
              <TouchableOpacity
                style={s.sessionCard}
                onPress={() => openFeedback(item)}
                activeOpacity={0.8}
              >
                <View style={s.sessionTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sessionDate}>{fmtDate(item.started_at)}</Text>
                    {(item.workout_plans?.name || item.workout_routines?.name) && (
                      <Text style={s.sessionSub} numberOfLines={1}>
                        {[item.workout_plans?.name, item.workout_routines?.name].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {ic && (
                      <View style={[s.badge, { backgroundColor: `${ic.color}18` }]}>
                        <Text style={{ fontSize: 11 }}>{ic.emoji}</Text>
                        <Text style={[s.badgeText, { color: ic.color }]}>{ic.label}</Text>
                      </View>
                    )}
                    <Text style={s.duration}>{fmtDuration(item.duration_seconds)}</Text>
                  </View>
                </View>

                {item.notes ? (
                  <View style={s.notesRow}>
                    <Ionicons name="chatbubble-outline" size={13} color={Colors.textSecondary} />
                    <Text style={s.notesText} numberOfLines={2}>{item.notes}</Text>
                    <Ionicons name="pencil-outline" size={13} color={primaryColor} />
                  </View>
                ) : (
                  <View style={[s.addNoteRow, { borderColor: `${primaryColor}30` }]}>
                    <Ionicons name="add-circle-outline" size={16} color={primaryColor} />
                    <Text style={[s.addNoteText, { color: primaryColor }]}>Adicionar observação</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Edit notes modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />

            {selected && (
              <>
                <Text style={s.modalTitle}>Observações do treino</Text>
                <Text style={s.modalSession}>{fmtDate(selected.started_at)}</Text>
                {(selected.workout_plans?.name || selected.workout_routines?.name) && (
                  <Text style={s.modalSub}>
                    {[selected.workout_plans?.name, selected.workout_routines?.name].filter(Boolean).join(' · ')}
                  </Text>
                )}

                {selected.intensity && INTENSITY_CONFIG[selected.intensity] && (
                  <View style={[s.intensityDisplay, { backgroundColor: `${INTENSITY_CONFIG[selected.intensity].color}12`, borderColor: `${INTENSITY_CONFIG[selected.intensity].color}30` }]}>
                    <Text style={{ fontSize: 20 }}>{INTENSITY_CONFIG[selected.intensity].emoji}</Text>
                    <View>
                      <Text style={s.intensityDisplayLabel}>Intensidade percebida</Text>
                      <Text style={[s.intensityDisplayValue, { color: INTENSITY_CONFIG[selected.intensity].color }]}>
                        {INTENSITY_CONFIG[selected.intensity].label}
                      </Text>
                    </View>
                  </View>
                )}

                <Text style={s.notesLabel}>Suas observações</Text>
                <TextInput
                  style={s.notesInput}
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder="Como foi esse treino? O que foi desafiador? O que melhorou?"
                  placeholderTextColor={Colors.textSecondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </>
            )}

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setSelected(null)} activeOpacity={0.75}>
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submitBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
                onPress={saveFeedback}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.submitBtnText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40, gap: 10 },
  hint: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  sessionCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 10 },
  sessionTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sessionDate: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  sessionSub: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 3 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  duration: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },
  notesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: Colors.bg, borderRadius: 10, padding: 10 },
  notesText: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  addNoteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  addNoteText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: '#00000060', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, gap: 4 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  modalSession: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  modalSub: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 12 },
  intensityDisplay: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginVertical: 8 },
  intensityDisplayLabel: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary },
  intensityDisplayValue: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
  notesLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 0.5, marginTop: 8, marginBottom: 8 },
  notesInput: { backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, minHeight: 100, marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  submitBtn: { flex: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: '#fff' },
});
