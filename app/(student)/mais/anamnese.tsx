import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  TextInput, Switch, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { StudentHeader } from '@/components/StudentHeader';
import { ModuleGuard } from '@/components/ModuleGuard';
import { MODULE } from '@/lib/modules';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

interface AnamneseTemplate {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  options: string[] | null;
  required: boolean;
  sort_order: number;
  category: string;
}

type Mode = 'view' | 'edit';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AnamneseScreen() {
  const { selectedStudent } = useStudent();
  const { primaryColor } = useThemeStore();

  const [templates, setTemplates] = useState<AnamneseTemplate[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>('edit');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedStudent) return;
    const tenantId = selectedStudent.tenant_id;

    const [templatesRes, responseRes] = await Promise.all([
      supabase
        .from('anamnese_templates')
        .select('id, field_key, label, field_type, options, required, sort_order, category')
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('anamnese_responses')
        .select('responses, updated_at')
        .eq('student_id', selectedStudent.id)
        .maybeSingle(),
    ]);

    const tList = (templatesRes.data ?? []) as AnamneseTemplate[];
    setTemplates(tList);

    const existing = responseRes.data;
    if (existing?.responses && typeof existing.responses === 'object') {
      const map: Record<string, string> = {};
      Object.entries(existing.responses as Record<string, unknown>).forEach(([k, v]) => {
        map[k] = String(v ?? '');
      });
      setAnswers(map);
      setLastUpdated(existing.updated_at);
      setMode('view');
    } else {
      const defaults: Record<string, string> = {};
      tList.forEach(t => { if (t.field_type === 'boolean') defaults[t.field_key] = 'false'; });
      setAnswers(defaults);
      setMode('edit');
    }

    setLoading(false);
  }, [selectedStudent?.id]);

  useEffect(() => { load(); }, [load]);

  function setAnswer(key: string, value: string) {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!selectedStudent) return;
    const tenantId = selectedStudent.tenant_id;

    const missing = templates.filter(t => t.required && !answers[t.field_key]?.trim());
    if (missing.length > 0) {
      Alert.alert('Campos obrigatórios', `Preencha: ${missing.map(t => t.label).join(', ')}`);
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('anamnese_responses')
      .upsert(
        { student_id: selectedStudent.id, tenant_id: tenantId, responses: answers, completed_at: now },
        { onConflict: 'student_id,tenant_id' }
      );

    setSaving(false);
    if (error) {
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } else {
      setLastUpdated(now);
      setMode('view');
    }
  }

  // ── Read-only view ────────────────────────────────────────────────────────

  function renderViewAnswer(t: AnamneseTemplate) {
    const val = answers[t.field_key] ?? '';

    if (t.field_type === 'boolean') {
      const yes = val === 'true';
      return (
        <View key={t.id} style={s.viewRow}>
          <Text style={s.viewLabel} numberOfLines={2}>{t.label}</Text>
          <View style={[s.boolBadge, { backgroundColor: yes ? `${primaryColor}18` : `${Colors.border}` }]}>
            <Ionicons
              name={yes ? 'checkmark-circle' : 'close-circle-outline'}
              size={14}
              color={yes ? primaryColor : Colors.textSecondary}
            />
            <Text style={[s.boolBadgeText, { color: yes ? primaryColor : Colors.textSecondary }]}>
              {yes ? 'Sim' : 'Não'}
            </Text>
          </View>
        </View>
      );
    }

    if (t.field_type === 'select') {
      return (
        <View key={t.id} style={s.viewRow}>
          <Text style={s.viewLabel} numberOfLines={2}>{t.label}</Text>
          {val ? (
            <View style={[s.selectBadge, { backgroundColor: `${primaryColor}18`, borderColor: `${primaryColor}35` }]}>
              <Text style={[s.selectBadgeText, { color: primaryColor }]}>{val}</Text>
            </View>
          ) : (
            <Text style={s.viewEmpty}>—</Text>
          )}
        </View>
      );
    }

    // text / number / textarea
    return (
      <View key={t.id} style={[s.viewRow, (t.field_type === 'textarea' || val.length > 40) && s.viewRowColumn]}>
        <Text style={s.viewLabel}>{t.label}</Text>
        <Text style={[s.viewValue, (t.field_type === 'textarea' || val.length > 40) && s.viewValueFull]}>
          {val || '—'}
        </Text>
      </View>
    );
  }

  function renderViewMode() {
    // Group templates by category
    const categoryOrder: string[] = [];
    const byCategory: Record<string, AnamneseTemplate[]> = {};
    for (const t of templates) {
      if (!byCategory[t.category]) {
        byCategory[t.category] = [];
        categoryOrder.push(t.category);
      }
      byCategory[t.category].push(t);
    }

    return (
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Last update banner */}
        {lastUpdated && (
          <View style={s.infoBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
            <Text style={s.infoBannerText}>
              Preenchida em {fmtDate(lastUpdated)}
            </Text>
          </View>
        )}

        {categoryOrder.map(cat => (
          <View key={cat}>
            <Text style={s.categoryLabel}>{cat.toUpperCase()}</Text>
            <View style={s.viewCard}>
              {byCategory[cat].map((t, idx) => (
                <View key={t.id} style={idx > 0 ? s.viewItemBorder : undefined}>
                  {renderViewAnswer(t)}
                </View>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[s.editBtn, { borderColor: primaryColor }]}
          onPress={() => setMode('edit')}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={17} color={primaryColor} />
          <Text style={[s.editBtnText, { color: primaryColor }]}>Editar respostas</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Edit form ──────────────────────────────────────────────────────────────

  function renderField(t: AnamneseTemplate) {
    const val = answers[t.field_key] ?? '';
    const req = t.required ? <Text style={{ color: Colors.error }}> *</Text> : null;

    switch (t.field_type) {
      case 'boolean':
        return (
          <View key={t.id} style={s.fieldRow}>
            <Text style={[s.fieldLabel, { marginBottom: 0, flex: 1 }]}>{t.label}{req}</Text>
            <Switch
              value={val === 'true'}
              onValueChange={v => setAnswer(t.field_key, v ? 'true' : 'false')}
              trackColor={{ false: Colors.border, true: `${primaryColor}60` }}
              thumbColor={val === 'true' ? primaryColor : Colors.textSecondary}
            />
          </View>
        );

      case 'select':
        return (
          <View key={t.id} style={s.fieldBlock}>
            <Text style={s.fieldLabel}>{t.label}{req}</Text>
            <View style={s.optionRow}>
              {(t.options ?? []).map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[s.optionPill, val === opt && { backgroundColor: primaryColor, borderColor: primaryColor }]}
                  onPress={() => setAnswer(t.field_key, opt)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.optionText, val === opt && { color: '#fff' }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'textarea':
        return (
          <View key={t.id} style={s.fieldBlock}>
            <Text style={s.fieldLabel}>{t.label}{req}</Text>
            <TextInput
              style={s.textArea}
              value={val}
              onChangeText={v => setAnswer(t.field_key, v)}
              multiline
              numberOfLines={4}
              placeholder="Digite aqui..."
              placeholderTextColor={Colors.textSecondary}
              textAlignVertical="top"
            />
          </View>
        );

      case 'number':
        return (
          <View key={t.id} style={s.fieldBlock}>
            <Text style={s.fieldLabel}>{t.label}{req}</Text>
            <TextInput
              style={s.textInput}
              value={val}
              onChangeText={v => setAnswer(t.field_key, v)}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>
        );

      default:
        return (
          <View key={t.id} style={s.fieldBlock}>
            <Text style={s.fieldLabel}>{t.label}{req}</Text>
            <TextInput
              style={s.textInput}
              value={val}
              onChangeText={v => setAnswer(t.field_key, v)}
              placeholder="Digite aqui..."
              placeholderTextColor={Colors.textSecondary}
            />
          </View>
        );
    }
  }

  function renderEditMode() {
    return (
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.formCard}>
          {templates.map(renderField)}
        </View>

        <View style={s.editActions}>
          {lastUpdated && (
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => setMode('view')}
              activeOpacity={0.75}
            >
              <Text style={s.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }, lastUpdated ? { flex: 2 } : { flex: 1 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={s.saveBtnText}>{lastUpdated ? 'Salvar alterações' : 'Salvar anamnese'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StudentHeader
        title="Anamnese"
        onBack={mode === 'edit' && lastUpdated ? () => setMode('view') : () => router.back()}
      />

      <ModuleGuard slug={MODULE.ANAMNESE}>
      {loading ? (
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      ) : templates.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="document-text-outline" size={52} color={Colors.border} />
          <Text style={s.emptyTitle}>Formulário não configurado</Text>
          <Text style={s.emptyDesc}>Seu treinador ainda não configurou o formulário de anamnese.</Text>
        </View>
      ) : mode === 'view' ? renderViewMode() : renderEditMode()}
      </ModuleGuard>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48, gap: 14 },

  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#4ADE8010', borderRadius: 12, borderWidth: 1, borderColor: '#4ADE8030', paddingHorizontal: 14, paddingVertical: 10 },
  infoBannerText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: '#4ADE80' },

  // ── View mode ──
  categoryLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 6, paddingHorizontal: 2 },
  viewCard: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  viewItemBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  viewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  viewRowColumn: { flexDirection: 'column', alignItems: 'flex-start', gap: 6 },
  viewLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  viewValue: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', flexShrink: 1 },
  viewValueFull: { textAlign: 'left', lineHeight: 20 },
  viewEmpty: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.border },
  boolBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  boolBadgeText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  selectBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  selectBadgeText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, borderWidth: 1.5, paddingVertical: 14, marginTop: 4 },
  editBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },

  // ── Edit mode ──
  formCard: { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  fieldBlock: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  fieldLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: 10 },
  textInput: { backgroundColor: Colors.bg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  textArea: { backgroundColor: Colors.bg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, minHeight: 100 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  optionText: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: Colors.textPrimary },
  editActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 16 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: '#fff' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
