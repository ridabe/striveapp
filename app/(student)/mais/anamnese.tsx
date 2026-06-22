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
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
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

export default function AnamneseScreen() {
  const { student } = useStudent();
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();

  const [templates, setTemplates] = useState<AnamneseTemplate[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!student || !profile?.tenant_id) return;
    const tenantId = profile.tenant_id;

    const [templatesRes, responseRes] = await Promise.all([
      supabase
        .from('anamnese_templates')
        .select('id, field_key, label, field_type, options, required, sort_order, category')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('anamnese_responses')
        .select('responses, updated_at')
        .eq('student_id', student.id)
        .eq('tenant_id', tenantId)
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
      setHasExisting(true);
      setLastUpdated(existing.updated_at);
    } else {
      const defaults: Record<string, string> = {};
      tList.forEach(t => { if (t.field_type === 'boolean') defaults[t.field_key] = 'false'; });
      setAnswers(defaults);
    }

    setLoading(false);
  }, [student?.id, profile?.tenant_id]);

  useEffect(() => { load(); }, [load]);

  function setAnswer(key: string, value: string) {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!student || !profile?.tenant_id) return;
    const tenantId = profile.tenant_id;

    const missing = templates.filter(t => t.required && !answers[t.field_key]?.trim());
    if (missing.length > 0) {
      Alert.alert('Campos obrigatórios', `Preencha: ${missing.map(t => t.label).join(', ')}`);
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('anamnese_responses')
      .upsert(
        { student_id: student.id, tenant_id: tenantId, responses: answers, completed_at: new Date().toISOString() },
        { onConflict: 'student_id,tenant_id' }
      );

    setSaving(false);
    if (error) {
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } else {
      Alert.alert('Salvo!', 'Suas respostas foram salvas com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }

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

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Anamnese</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} /> : (
        templates.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="document-text-outline" size={52} color={Colors.border} />
            <Text style={s.emptyTitle}>Formulário não configurado</Text>
            <Text style={s.emptyDesc}>Seu treinador ainda não configurou o formulário de anamnese.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {hasExisting && lastUpdated && (
              <View style={s.infoBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                <Text style={s.infoBannerText}>
                  Última atualização em {new Date(lastUpdated).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            )}

            <View style={s.formCard}>
              {templates.map(renderField)}
            </View>

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={s.saveBtnText}>{hasExisting ? 'Atualizar respostas' : 'Salvar anamnese'}</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        )
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48, gap: 14 },
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#4ADE8010', borderRadius: 12, borderWidth: 1, borderColor: '#4ADE8030', paddingHorizontal: 14, paddingVertical: 10 },
  infoBannerText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: '#4ADE80' },
  formCard: { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  fieldBlock: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  fieldLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: 10 },
  textInput: { backgroundColor: Colors.bg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  textArea: { backgroundColor: Colors.bg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, minHeight: 100 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  optionText: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: Colors.textPrimary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 16 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
