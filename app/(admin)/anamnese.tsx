import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, Switch,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AnamneseField {
  id: string;
  field_key: string;
  label: string;
  category: string;
  field_type: string;
  required: boolean;
  options: string[] | null;
  sort_order: number;
  tenant_id: string | null;
}

interface AnamneseResponse {
  id: string;
  student_id: string;
  responses: Record<string, any>;
  completed_at: string | null;
  updated_at: string;
}

interface Student { id: string; full_name: string; status: string }

interface StudentWithResponse extends Student {
  response: AnamneseResponse | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FIELD_TYPES = [
  { key: 'text',     label: 'Texto curto', icon: 'text-outline' as const },
  { key: 'textarea', label: 'Texto longo', icon: 'document-text-outline' as const },
  { key: 'number',   label: 'Número',      icon: 'calculator-outline' as const },
  { key: 'select',   label: 'Seleção',     icon: 'chevron-down-circle-outline' as const },
  { key: 'boolean',  label: 'Sim/Não',     icon: 'toggle-outline' as const },
] as const;

const DEFAULT_CATEGORIES = ['saude', 'historico', 'objetivos', 'habitos', 'alimentacao', 'outros'];

const CATEGORY_LABELS: Record<string, string> = {
  saude:       'Saúde',
  historico:   'Histórico',
  objetivos:   'Objetivos',
  habitos:     'Hábitos',
  alimentacao: 'Alimentação',
  outros:      'Outros',
};

const CATEGORY_ICONS: Record<string, any> = {
  saude:       'medical-outline',
  historico:   'time-outline',
  objetivos:   'flag-outline',
  habitos:     'bicycle-outline',
  alimentacao: 'nutrition-outline',
  outros:      'list-outline',
};

function catIcon(cat: string): any {
  return CATEGORY_ICONS[cat] ?? 'list-outline';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatFieldValue(value: any): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (value === 'true') return 'Sim';
  if (value === 'false') return 'Não';
  if (Array.isArray(value)) return value.join(', ') || '—';
  return String(value);
}

function groupFields(fields: AnamneseField[]) {
  const groups: Record<string, AnamneseField[]> = {};
  for (const f of fields) {
    const cat = f.category || 'Outros';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(f);
  }
  return Object.entries(groups);
}

function generateFieldKey(label: string): string {
  return (
    label.toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') +
    '_' + Date.now().toString(36)
  );
}

function fieldTypeLabel(key: string): string {
  return FIELD_TYPES.find(t => t.key === key)?.label ?? key;
}

const needsOptions = (t: string) => t === 'select';

// ─── Field Editor Modal ───────────────────────────────────────────────────────
function FieldEditorModal({
  visible, field, primaryColor, tenantId, maxOrder,
  onClose, onSaved,
}: {
  visible: boolean;
  field: AnamneseField | null; // null = new field
  primaryColor: string;
  tenantId: string;
  maxOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);

  const lightText = ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(primaryColor);
  const isNew = field === null;

  useEffect(() => {
    if (visible) {
      if (field) {
        setLabel(field.label);
        setCategory(field.category);
        setFieldType(field.field_type);
        setRequired(field.required);
        setOptions(field.options && field.options.length > 0 ? field.options : ['']);
      } else {
        setLabel('');
        setCategory('');
        setFieldType('text');
        setRequired(false);
        setOptions(['']);
      }
    }
  }, [visible, field]);

  function addOption() { setOptions(prev => [...prev, '']); }
  function removeOption(i: number) { setOptions(prev => prev.filter((_, idx) => idx !== i)); }
  function updateOption(i: number, val: string) {
    setOptions(prev => prev.map((o, idx) => idx === i ? val : o));
  }

  async function handleSave() {
    const finalLabel = label.trim();
    const finalCategory = category;
    if (!finalLabel) { Alert.alert('Atenção', 'Informe o rótulo do campo.'); return; }
    if (!finalCategory) { Alert.alert('Atenção', 'Selecione uma categoria.'); return; }
    if (needsOptions(fieldType)) {
      const validOpts = options.filter(o => o.trim() !== '');
      if (validOpts.length < 1) { Alert.alert('Atenção', 'Adicione pelo menos uma opção.'); return; }
    }

    setSaving(true);
    try {
      const payload: any = {
        label: finalLabel,
        category: finalCategory,
        field_type: fieldType,
        required,
        options: needsOptions(fieldType) ? options.filter(o => o.trim() !== '') : null,
        is_active: true,
        tenant_id: tenantId,
      };

      if (isNew) {
        payload.field_key = generateFieldKey(finalLabel);
        payload.sort_order = maxOrder + 1;
        const { error } = await supabase.from('anamnese_templates').insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('anamnese_templates')
          .update({ label: payload.label, category: payload.category, field_type: payload.field_type, required: payload.required, options: payload.options })
          .eq('id', field!.id);
        if (error) throw error;
      }

      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet"
      onRequestClose={() => !saving && onClose()}>
      <KeyboardAvoidingView style={fe.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={fe.header}>
          <TouchableOpacity onPress={() => !saving && onClose()} style={fe.iconBtn}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={fe.title}>{isNew ? 'Novo Campo' : 'Editar Campo'}</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={fe.content} keyboardShouldPersistTaps="handled">
          {/* Label */}
          <Text style={fe.label}>RÓTULO DO CAMPO</Text>
          <TextInput
            value={label} onChangeText={setLabel}
            placeholder="Ex: Possui alguma lesão?"
            placeholderTextColor={Colors.textSecondary} style={fe.input}
          />

          {/* Category */}
          <Text style={[fe.label, { marginTop: 18 }]}>CATEGORIA</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {DEFAULT_CATEGORIES.map(cat => (
              <TouchableOpacity key={cat}
                style={[fe.catChip, category === cat && { backgroundColor: primaryColor, borderColor: primaryColor }]}
                onPress={() => setCategory(cat)} activeOpacity={0.75}>
                <Text style={[fe.catChipText, category === cat && { color: '#000' }]}>{CATEGORY_LABELS[cat] ?? cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Field type */}
          <Text style={[fe.label, { marginTop: 18 }]}>TIPO DE CAMPO</Text>
          <View style={fe.typeGrid}>
            {FIELD_TYPES.map(t => (
              <TouchableOpacity key={t.key}
                style={[fe.typeCard, fieldType === t.key && { borderColor: primaryColor, backgroundColor: `${primaryColor}15` }]}
                onPress={() => setFieldType(t.key)} activeOpacity={0.75}>
                <Ionicons name={t.icon} size={20} color={fieldType === t.key ? primaryColor : Colors.textSecondary} />
                <Text style={[fe.typeLabel, { color: fieldType === t.key ? primaryColor : Colors.textSecondary }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Options (for select) */}
          {needsOptions(fieldType) && (
            <>
              <Text style={[fe.label, { marginTop: 18 }]}>OPÇÕES</Text>
              {options.map((opt, i) => (
                <View key={i} style={fe.optionRow}>
                  <TextInput
                    value={opt} onChangeText={v => updateOption(i, v)}
                    placeholder={`Opção ${i + 1}`}
                    placeholderTextColor={Colors.textSecondary}
                    style={[fe.input, { flex: 1 }]}
                  />
                  {options.length > 1 && (
                    <TouchableOpacity onPress={() => removeOption(i)} style={fe.optionRemove}>
                      <Ionicons name="close-circle" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity style={[fe.addOptionBtn, { borderColor: primaryColor }]} onPress={addOption} activeOpacity={0.8}>
                <Ionicons name="add" size={16} color={primaryColor} />
                <Text style={[fe.addOptionText, { color: primaryColor }]}>Adicionar opção</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Required toggle */}
          <View style={fe.requiredRow}>
            <View>
              <Text style={fe.requiredLabel}>Campo obrigatório</Text>
              <Text style={fe.requiredDesc}>O aluno deve responder para submeter</Text>
            </View>
            <Switch
              value={required} onValueChange={setRequired}
              trackColor={{ false: Colors.border, true: primaryColor }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity
            style={[fe.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
            onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            {saving
              ? <ActivityIndicator color={lightText ? '#000' : '#fff'} />
              : <Text style={[fe.saveBtnText, { color: lightText ? '#000' : '#fff' }]}>
                  {isNew ? 'Criar Campo' : 'Salvar Alterações'}
                </Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AnamneseScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const { studentId } = useLocalSearchParams<{ studentId?: string }>();
  const tenantId = profile?.tenant_id ?? '';

  const [fields, setFields] = useState<AnamneseField[]>([]);
  const [students, setStudents] = useState<StudentWithResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'alunos' | 'formulario'>('alunos');

  // Student response viewer
  const [selectedStudent, setSelectedStudent] = useState<StudentWithResponse | null>(null);
  const [responseModal, setResponseModal] = useState(false);

  // Field editor
  const [editorField, setEditorField] = useState<AnamneseField | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);

  const lightText = ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(primaryColor);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const [fieldsRes, studentsRes, responsesRes] = await Promise.all([
      supabase.from('anamnese_templates')
        .select('id, field_key, label, category, field_type, required, options, sort_order, tenant_id')
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

    const rawFields: AnamneseField[] = (fieldsRes.data ?? []).map((f: any) => ({
      ...f,
      options: Array.isArray(f.options) ? f.options : f.options ? Object.values(f.options) : null,
    }));
    setFields(rawFields);

    const responseMap: Record<string, AnamneseResponse> = {};
    (responsesRes.data ?? []).forEach((r: any) => { responseMap[r.student_id] = r; });

    const studentList: StudentWithResponse[] = (studentsRes.data ?? []).map(
      (st: any) => ({ ...st, response: responseMap[st.id] ?? null }),
    );
    setStudents(studentList);

    // Auto-open if coming from student detail
    if (studentId) {
      const match = studentList.find(s => s.id === studentId);
      if (match) {
        setSelectedStudent(match);
        setResponseModal(true);
        setTab('alunos');
      }
    }
  }, [tenantId, studentId]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function handleDeleteField(field: AnamneseField) {
    if (field.tenant_id === null) return; // global field — protected
    Alert.alert(
      'Remover campo',
      `Remover "${field.label}" do formulário? As respostas já enviadas pelos alunos serão mantidas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('anamnese_templates')
              .update({ is_active: false })
              .eq('id', field.id);
            if (error) Alert.alert('Erro', error.message);
            else await load();
          },
        },
      ],
    );
  }

  const grouped = groupFields(fields);
  const tenantFields = fields.filter(f => f.tenant_id !== null);
  const globalFields = fields.filter(f => f.tenant_id === null);
  const maxOrder = fields.reduce((m, f) => Math.max(m, f.sort_order), 0);

  const completed = students.filter(s => s.response?.completed_at).length;
  const totalActive = students.filter(s => s.status === 'active').length;
  const pct = totalActive > 0 ? Math.round((completed / totalActive) * 100) : 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Anamnese</Text>
        {tab === 'formulario' ? (
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: primaryColor }]}
            onPress={() => { setEditorField(null); setEditorVisible(true); }}
            activeOpacity={0.85}>
            <Ionicons name="add" size={20} color={lightText ? '#000' : '#fff'} />
          </TouchableOpacity>
        ) : <View style={{ width: 38 }} />}
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['alunos', 'formulario'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && { borderBottomColor: primaryColor }]}
            onPress={() => setTab(t)} activeOpacity={0.75}>
            <Text style={[s.tabText, tab === t && { color: primaryColor }]}>
              {t === 'alunos' ? 'Alunos' : 'Formulário'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} /> : (

        tab === 'alunos' ? (
          // ── Tab: Alunos ───────────────────────────────────────────────────
          <FlatList
            data={students}
            keyExtractor={i => i.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            ListHeaderComponent={
              <View style={s.statsCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View>
                    <Text style={s.statsTitle}>Preenchimento</Text>
                    <Text style={s.statsDesc}>{completed} de {totalActive} alunos</Text>
                  </View>
                  <Text style={[s.pctText, { color: primaryColor }]}>{pct}%</Text>
                </View>
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
                    <Text style={s.legendText}>{totalActive - completed} Pendentes</Text>
                  </View>
                </View>
              </View>
            }
            renderItem={({ item }) => {
              const done = !!item.response?.completed_at;
              const hasDraft = !!item.response && !item.response.completed_at;
              const initials = item.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
              const answered = item.response
                ? Object.values(item.response.responses ?? {}).filter(v => v !== '' && v !== null && v !== undefined).length
                : 0;

              return (
                <TouchableOpacity style={s.studentCard}
                  onPress={() => { setSelectedStudent(item); setResponseModal(true); }}
                  activeOpacity={0.75}>
                  <View style={[s.avatar, { backgroundColor: `${primaryColor}20` }]}>
                    <Text style={[s.avatarLetter, { color: primaryColor }]}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.studentName}>{item.full_name}</Text>
                    <Text style={s.studentSub}>
                      {done
                        ? `Completo · ${fmtDate(item.response!.completed_at!)}`
                        : hasDraft
                          ? `Rascunho · ${answered} de ${fields.length} campos`
                          : 'Não preenchido'}
                    </Text>
                  </View>
                  <View style={[s.statusBadge, {
                    backgroundColor: done
                      ? `${Colors.success}18`
                      : hasDraft ? `${Colors.warning}18` : Colors.border + '40',
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
                <Ionicons name="people-outline" size={52} color={Colors.border} />
                <Text style={s.emptyTitle}>Nenhum aluno</Text>
                <Text style={s.emptyText}>Cadastre alunos para gerenciar as anamneses.</Text>
              </View>
            }
          />
        ) : (
          // ── Tab: Formulário ───────────────────────────────────────────────
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
            {/* Summary */}
            <View style={s.formSummary}>
              <View style={s.formStat}>
                <Text style={[s.formStatNum, { color: primaryColor }]}>{fields.length}</Text>
                <Text style={s.formStatLabel}>Campos ativos</Text>
              </View>
              <View style={s.formStat}>
                <Text style={[s.formStatNum, { color: primaryColor }]}>{tenantFields.length}</Text>
                <Text style={s.formStatLabel}>Personalizados</Text>
              </View>
              <View style={s.formStat}>
                <Text style={[s.formStatNum, { color: primaryColor }]}>{globalFields.length}</Text>
                <Text style={s.formStatLabel}>Padrão</Text>
              </View>
            </View>

            {/* Legend */}
            <View style={s.formLegend}>
              <View style={s.formLegendItem}>
                <Ionicons name="lock-closed-outline" size={13} color={Colors.textSecondary} />
                <Text style={s.formLegendText}>Campos padrão (somente leitura)</Text>
              </View>
              <View style={s.formLegendItem}>
                <Ionicons name="create-outline" size={13} color={primaryColor} />
                <Text style={s.formLegendText}>Campos personalizados (editáveis)</Text>
              </View>
            </View>

            {/* Fields by category */}
            {grouped.map(([cat, catFields]) => (
              <View key={cat} style={{ marginBottom: 20 }}>
                <View style={s.catHeader}>
                  <Ionicons name={catIcon(cat)} size={15} color={primaryColor} />
                  <Text style={[s.catHeaderText, { color: primaryColor }]}>{cat}</Text>
                  <Text style={s.catCount}>{catFields.length}</Text>
                </View>
                <View style={s.catCard}>
                  {catFields.map((field, idx) => {
                    const isGlobal = field.tenant_id === null;
                    return (
                      <View key={field.id} style={[
                        s.fieldRow,
                        idx < catFields.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border },
                      ]}>
                        {/* Type icon */}
                        <View style={[s.fieldTypeIcon, { backgroundColor: `${primaryColor}15` }]}>
                          <Ionicons
                            name={FIELD_TYPES.find(t => t.key === field.field_type)?.icon ?? 'text-outline'}
                            size={14} color={primaryColor}
                          />
                        </View>

                        {/* Label + meta */}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={s.fieldLabel}>{field.label}</Text>
                            {field.required && (
                              <Text style={{ color: Colors.error, fontSize: 13, fontFamily: FontFamily.bodyBold }}>*</Text>
                            )}
                          </View>
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                            <View style={s.typeBadge}>
                              <Text style={s.typeBadgeText}>{fieldTypeLabel(field.field_type)}</Text>
                            </View>
                            {field.options && field.options.length > 0 && (
                              <Text style={s.optionHint}>{field.options.length} opções</Text>
                            )}
                          </View>
                        </View>

                        {/* Actions */}
                        {isGlobal ? (
                          <Ionicons name="lock-closed-outline" size={16} color={Colors.textSecondary} />
                        ) : (
                          <View style={{ flexDirection: 'row', gap: 4 }}>
                            <TouchableOpacity
                              style={s.actionBtn}
                              onPress={() => { setEditorField(field); setEditorVisible(true); }}
                              activeOpacity={0.75}>
                              <Ionicons name="create-outline" size={16} color={primaryColor} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={s.actionBtn}
                              onPress={() => handleDeleteField(field)}
                              activeOpacity={0.75}>
                              <Ionicons name="trash-outline" size={16} color={Colors.error} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}

            {fields.length === 0 && (
              <View style={s.empty}>
                <Ionicons name="document-text-outline" size={52} color={Colors.border} />
                <Text style={s.emptyTitle}>Nenhum campo</Text>
                <Text style={s.emptyText}>Toque em + para criar o primeiro campo do formulário.</Text>
              </View>
            )}

            {/* Add button at bottom */}
            <TouchableOpacity
              style={[s.addFieldBtn, { borderColor: primaryColor }]}
              onPress={() => { setEditorField(null); setEditorVisible(true); }}
              activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={20} color={primaryColor} />
              <Text style={[s.addFieldBtnText, { color: primaryColor }]}>Adicionar novo campo</Text>
            </TouchableOpacity>
          </ScrollView>
        )
      )}

      {/* Response viewer modal */}
      <Modal visible={responseModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setResponseModal(false)}>
        <SafeAreaView style={s.modalSafe} edges={['top']}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => setResponseModal(false)} style={s.iconBtn}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.title} numberOfLines={1}>
              {selectedStudent?.full_name.split(' ')[0]}
            </Text>
            <View style={{ width: 38 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 16 }}>
            {selectedStudent?.response?.completed_at && (
              <View style={s.completedBanner}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={s.completedText}>Preenchido em {fmtDate(selectedStudent.response.completed_at)}</Text>
              </View>
            )}

            {!selectedStudent?.response ? (
              <View style={s.pendingBox}>
                <Ionicons name="time-outline" size={48} color={Colors.textSecondary} />
                <Text style={s.emptyTitle}>Não preenchido</Text>
                <Text style={s.emptyText}>Este aluno ainda não respondeu ao formulário.</Text>
              </View>
            ) : (
              grouped.map(([cat, catFields]) => (
                <View key={cat} style={{ marginBottom: 20 }}>
                  <View style={s.catHeader}>
                    <Ionicons name={catIcon(cat)} size={15} color={primaryColor} />
                    <Text style={[s.catHeaderText, { color: primaryColor }]}>{CATEGORY_LABELS[cat] ?? cat}</Text>
                  </View>
                  <View style={s.catCard}>
                    {catFields.map((field, idx) => {
                      const val = selectedStudent.response?.responses?.[field.field_key];
                      const hasAnswer = val !== undefined && val !== null && val !== '';
                      return (
                        <View key={field.field_key} style={[
                          s.fieldRow,
                          idx < catFields.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border },
                          { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
                        ]}>
                          <Text style={s.respFieldLabel}>
                            {field.label}
                            {field.required && <Text style={{ color: Colors.error }}> *</Text>}
                          </Text>
                          <Text style={[s.respFieldValue, !hasAnswer && { color: Colors.textSecondary, fontStyle: 'italic' }]}>
                            {hasAnswer ? formatFieldValue(val) : 'Não respondido'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Field editor modal */}
      <FieldEditorModal
        visible={editorVisible}
        field={editorField}
        primaryColor={primaryColor}
        tenantId={tenantId}
        maxOrder={maxOrder}
        onClose={() => setEditorVisible(false)}
        onSaved={load}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  addBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },

  // Stats card (alunos tab)
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

  // Form tab
  formSummary: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 12 },
  formStat: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 4 },
  formStatNum: { fontFamily: FontFamily.bodyBold, fontSize: 22 },
  formStatLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },

  formLegend: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, gap: 6, marginBottom: 16 },
  formLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  formLegendText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },

  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  catHeaderText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, letterSpacing: 0.5, flex: 1 },
  catCount: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },
  catCard: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },

  fieldRow: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldTypeIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  typeBadge: { backgroundColor: Colors.border, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  typeBadgeText: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
  optionHint: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, alignSelf: 'center' },
  actionBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  addFieldBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, padding: 14, marginTop: 4,
  },
  addFieldBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },

  // Response viewer
  respFieldLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  respFieldValue: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },

  // Shared
  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  modalSafe: { flex: 1, backgroundColor: Colors.bg },
  completedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${Colors.success}18`, borderRadius: 12, padding: 12, marginBottom: 16 },
  completedText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.success },
  pendingBox: { alignItems: 'center', paddingTop: 40, gap: 12 },
});

// Field editor modal styles
const fe = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 52 },
  label: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary,
  },

  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  catChipText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeCard: {
    width: '47%', flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, padding: 12,
  },
  typeLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 12, flex: 1 },

  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  optionRemove: { padding: 4 },
  addOptionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: 10, marginTop: 4,
  },
  addOptionText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },

  requiredRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginTop: 20,
  },
  requiredLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  requiredDesc: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16, marginTop: 28 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md },
});
