import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

interface AnamneseField {
  id: string;
  field_key: string;
  label: string;
  category: string;
  field_type: string;
  required: boolean;
  sort_order: number;
}

interface AnamneseResponse {
  id: string;
  student_id: string;
  responses: Record<string, any>;
  completed_at: string | null;
  updated_at: string;
}

interface Student {
  id: string;
  full_name: string;
  status: string;
}

interface StudentWithResponse extends Student {
  response: AnamneseResponse | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatFieldValue(value: any): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) return value.join(', ') || '—';
  return String(value);
}

// Groups fields by category
function groupFields(fields: AnamneseField[]) {
  const groups: Record<string, AnamneseField[]> = {};
  for (const f of fields) {
    const cat = f.category || 'Geral';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(f);
  }
  return Object.entries(groups);
}

const CATEGORY_ICONS: Record<string, any> = {
  medical: 'medical-outline',
  saude: 'medical-outline',
  lifestyle: 'bicycle-outline',
  estilo: 'bicycle-outline',
  goals: 'flag-outline',
  objetivos: 'flag-outline',
  personal: 'person-outline',
  pessoal: 'person-outline',
  Geral: 'list-outline',
};

function catIcon(cat: string): any {
  const key = Object.keys(CATEGORY_ICONS).find(k => cat.toLowerCase().includes(k.toLowerCase()));
  return key ? CATEGORY_ICONS[key] : 'list-outline';
}

export default function AnamneseScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id;

  const [fields, setFields] = useState<AnamneseField[]>([]);
  const [students, setStudents] = useState<StudentWithResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithResponse | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const [fieldsRes, studentsRes, responsesRes] = await Promise.all([
      supabase.from('anamnese_templates')
        .select('id, field_key, label, category, field_type, required, sort_order')
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .eq('is_active', true)
        .order('sort_order'),
      supabase.from('students')
        .select('id, full_name, status')
        .eq('tenant_id', tenantId)
        .order('full_name'),
      supabase.from('anamnese_responses')
        .select('id, student_id, responses, completed_at, updated_at')
        .eq('tenant_id', tenantId),
    ]);

    setFields(fieldsRes.data ?? []);

    const responseMap: Record<string, AnamneseResponse> = {};
    (responsesRes.data ?? []).forEach((r: any) => { responseMap[r.student_id] = r; });

    const enriched: StudentWithResponse[] = (studentsRes.data ?? []).map((st: any) => ({
      ...st,
      response: responseMap[st.id] ?? null,
    }));
    setStudents(enriched);
  }, [tenantId]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const completed = students.filter(s => s.response?.completed_at).length;
  const pending = students.filter(s => s.status === 'active' && !s.response?.completed_at).length;
  const totalActive = students.filter(s => s.status === 'active').length;
  const pct = totalActive > 0 ? Math.round((completed / totalActive) * 100) : 0;

  const grouped = groupFields(fields);

  function openStudent(st: StudentWithResponse) {
    setSelectedStudent(st);
    setModalVisible(true);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Anamnese</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} /> : (
        <FlatList
          data={students}
          keyExtractor={i => i.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ListHeaderComponent={
            <>
              {/* Completion stats */}
              <View style={s.statsCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View>
                    <Text style={s.statsTitle}>Preenchimento</Text>
                    <Text style={s.statsDesc}>{completed} de {totalActive} alunos</Text>
                  </View>
                  <Text style={[s.pctText, { color: primaryColor }]}>{pct}%</Text>
                </View>
                {/* Progress bar */}
                <View style={s.progressBg}>
                  <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: primaryColor }]} />
                </View>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: primaryColor }]} />
                    <Text style={s.legendText}>{completed} Completos</Text>
                  </View>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: Colors.border }]} />
                    <Text style={s.legendText}>{pending} Pendentes</Text>
                  </View>
                </View>
              </View>

              {/* Template overview */}
              {fields.length > 0 && (
                <View style={s.templateCard}>
                  <Text style={s.templateTitle}>FORMULÁRIO • {fields.length} CAMPOS</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {grouped.map(([cat]) => (
                      <View key={cat} style={[s.catBadge, { backgroundColor: `${primaryColor}15` }]}>
                        <Ionicons name={catIcon(cat)} size={11} color={primaryColor} />
                        <Text style={[s.catBadgeText, { color: primaryColor }]}>{cat}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <Text style={s.sectionLabel}>ALUNOS</Text>
            </>
          }
          renderItem={({ item }) => {
            const done = !!item.response?.completed_at;
            const hasDraft = !!item.response && !item.response.completed_at;
            const initials = item.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            const fieldsAnswered = item.response
              ? Object.values(item.response.responses ?? {}).filter(v => v !== '' && v !== null && v !== undefined).length
              : 0;

            return (
              <TouchableOpacity style={s.studentCard} onPress={() => openStudent(item)} activeOpacity={0.75}>
                <View style={[s.avatar, { backgroundColor: `${primaryColor}20` }]}>
                  <Text style={[s.avatarLetter, { color: primaryColor }]}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.studentName}>{item.full_name}</Text>
                  <Text style={s.studentSub}>
                    {done
                      ? `Completo · ${fmtDate(item.response!.completed_at!)}`
                      : hasDraft
                        ? `Rascunho · ${fieldsAnswered} de ${fields.length} campos`
                        : 'Não preenchido'
                    }
                  </Text>
                </View>
                <View style={[s.statusBadge, {
                  backgroundColor: done ? `${Colors.success}18` : hasDraft ? `${Colors.warning}18` : Colors.border + '40',
                }]}>
                  <Ionicons
                    name={done ? 'checkmark-circle' : hasDraft ? 'time-outline' : 'ellipse-outline'}
                    size={14}
                    color={done ? Colors.success : hasDraft ? Colors.warning : Colors.textSecondary}
                  />
                  <Text style={[s.statusText, {
                    color: done ? Colors.success : hasDraft ? Colors.warning : Colors.textSecondary,
                  }]}>
                    {done ? 'Completo' : hasDraft ? 'Parcial' : 'Pendente'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="document-text-outline" size={52} color={Colors.border} />
              <Text style={s.emptyTitle}>Nenhum aluno</Text>
              <Text style={s.emptyText}>Cadastre alunos para gerenciar as anamneses.</Text>
            </View>
          }
        />
      )}

      {/* Response viewer modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={s.modalSafe} edges={['top']}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={s.backBtn}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.title} numberOfLines={1}>
              {selectedStudent?.full_name.split(' ')[0]}
            </Text>
            <View style={{ width: 38 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 16 }}>
            {selectedStudent?.response?.completed_at && (
              <View style={s.completedBanner}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={s.completedText}>Preenchido em {fmtDate(selectedStudent.response.completed_at)}</Text>
              </View>
            )}

            {fields.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>Nenhum campo no formulário configurado.</Text>
              </View>
            ) : (
              grouped.map(([cat, catFields]) => (
                <View key={cat} style={{ marginBottom: 20 }}>
                  {/* Category header */}
                  <View style={s.catHeader}>
                    <Ionicons name={catIcon(cat)} size={15} color={primaryColor} />
                    <Text style={[s.catHeaderText, { color: primaryColor }]}>{cat}</Text>
                  </View>
                  <View style={s.catCard}>
                    {catFields.map((field, idx) => {
                      const val = selectedStudent?.response?.responses?.[field.field_key];
                      const hasAnswer = val !== undefined && val !== null && val !== '';
                      return (
                        <View key={field.field_key} style={[
                          s.fieldRow,
                          idx < catFields.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border },
                        ]}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>
                              {field.label}
                              {field.required && <Text style={{ color: Colors.error }}> *</Text>}
                            </Text>
                            <Text style={[s.fieldValue, !hasAnswer && { color: Colors.textSecondary, fontStyle: 'italic' }]}>
                              {hasAnswer ? formatFieldValue(val) : 'Não respondido'}
                            </Text>
                          </View>
                          {hasAnswer && (
                            <Ionicons name="checkmark" size={16} color={Colors.success} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))
            )}

            {!selectedStudent?.response && (
              <View style={s.pendingBox}>
                <Ionicons name="time-outline" size={40} color={Colors.textSecondary} />
                <Text style={s.pendingTitle}>Anamnese não preenchida</Text>
                <Text style={s.pendingText}>Este aluno ainda não respondeu ao formulário de anamnese.</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },

  statsCard: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border, padding: 18, marginTop: 16, marginBottom: 14,
  },
  statsTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  statsDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  pctText: { fontFamily: FontFamily.bodyBold, fontSize: 32 },
  progressBg: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },

  templateCard: {
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, padding: 14, marginBottom: 14,
  },
  templateTitle: { fontFamily: FontFamily.bodyBold, fontSize: 10, color: Colors.textSecondary, letterSpacing: 0.8 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  catBadgeText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },

  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 10 },

  studentCard: {
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: FontFamily.bodyBold, fontSize: 15 },
  studentName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  studentSub: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  modalSafe: { flex: 1, backgroundColor: Colors.bg },
  completedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${Colors.success}18`, borderRadius: 12, padding: 12, marginBottom: 16,
  },
  completedText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.success },

  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  catHeaderText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, letterSpacing: 0.5 },
  catCard: {
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, overflow: 'hidden',
  },
  fieldRow: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: 4 },
  fieldValue: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },

  pendingBox: { alignItems: 'center', paddingTop: 40, gap: 12 },
  pendingTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  pendingText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
