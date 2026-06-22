import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform, ScrollView, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { EXTRA_CATEGORIES, extraCategoryLabel } from '@/lib/exerciseConfig';

interface ExtraWorkout {
  id: string;
  name: string;
  category: string;
  description: string | null;
  is_template: boolean;
  student_id: string | null;
  tags: string[];
  student?: { full_name: string } | null;
}

const CATEGORY_ICONS: Record<string, any> = {
  aquecimento: 'flame-outline',
  hiit: 'flash-outline',
  mobilidade: 'body-outline',
  cardio: 'heart-outline',
  desafio: 'trophy-outline',
  forca: 'barbell-outline',
  outros: 'ellipsis-horizontal-outline',
};

const CATEGORY_COLORS: Record<string, string> = {
  aquecimento: '#F97316',
  hiit: '#EF4444',
  mobilidade: '#8B5CF6',
  cardio: '#EC4899',
  desafio: '#F59E0B',
  forca: '#3B82F6',
  outros: '#64748B',
};

export default function TreinosExtrasScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? '';
  const lightText = ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(primaryColor);

  const [extras, setExtras] = useState<ExtraWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'templates' | 'assigned'>('templates');

  // New extra modal
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fName, setFName] = useState('');
  const [fCategory, setFCategory] = useState('outros');
  const [fDescription, setFDescription] = useState('');
  const [fIsTemplate, setFIsTemplate] = useState(true);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase.from('extra_workouts')
      .select('id, name, category, description, is_template, student_id, tags, students(full_name)')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });
    setExtras((data ?? []).map((e: any) => ({ ...e, student: e.students })));
  }, [tenantId]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const templates = extras.filter(e => e.is_template);
  const assigned = extras.filter(e => !e.is_template);
  const displayed = tab === 'templates' ? templates : assigned;

  async function handleCreate() {
    if (!fName.trim()) { Alert.alert('Atenção', 'Informe o nome do treino extra.'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('extra_workouts').insert({
        name: fName.trim(),
        category: fCategory as any,
        description: fDescription.trim() || null,
        is_template: fIsTemplate,
        tenant_id: tenantId,
        tags: [],
      }).select('id').single();
      if (error) throw error;
      setModalVisible(false);
      resetForm();
      await load();
      router.push(`/(admin)/treinos-extras/${data.id}` as any);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setFName(''); setFCategory('outros'); setFDescription(''); setFIsTemplate(true);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Treinos Extras</Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: primaryColor }]}
          onPress={() => setModalVisible(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color={lightText ? '#000' : '#fff'} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['templates', 'assigned'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && { borderBottomColor: primaryColor }]}
            onPress={() => setTab(t)} activeOpacity={0.75}>
            <Text style={[s.tabText, tab === t && { color: primaryColor }]}>
              {t === 'templates' ? `Templates (${templates.length})` : `Atribuídos (${assigned.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator color={primaryColor} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={displayed}
          keyExtractor={e => e.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="flash-outline" size={52} color={Colors.border} />
              <Text style={s.emptyTitle}>{tab === 'templates' ? 'Nenhum template' : 'Nenhum treino atribuído'}</Text>
              <Text style={s.emptyText}>
                {tab === 'templates' ? 'Crie templates reutilizáveis para seus alunos.' : 'Atribua treinos avulsos a alunos específicos.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const cc = CATEGORY_COLORS[item.category] ?? Colors.textSecondary;
            const icon = CATEGORY_ICONS[item.category] ?? 'flash-outline';
            return (
              <TouchableOpacity style={s.card}
                onPress={() => router.push(`/(admin)/treinos-extras/${item.id}` as any)} activeOpacity={0.75}>
                <View style={[s.catIcon, { backgroundColor: `${cc}18` }]}>
                  <Ionicons name={icon} size={22} color={cc} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                  <View style={s.cardMeta}>
                    <View style={[s.badge, { backgroundColor: `${cc}18` }]}>
                      <Text style={[s.badgeText, { color: cc }]}>{extraCategoryLabel(item.category)}</Text>
                    </View>
                    {!item.is_template && item.student && (
                      <View style={s.badge}>
                        <Ionicons name="person-outline" size={10} color={Colors.textSecondary} />
                        <Text style={s.badgeText}>{item.student.full_name.split(' ')[0]}</Text>
                      </View>
                    )}
                    {item.is_template && (
                      <View style={s.badge}>
                        <Ionicons name="copy-outline" size={10} color={Colors.textSecondary} />
                        <Text style={s.badgeText}>Template</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* New extra modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => !saving && setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
              <TouchableOpacity onPress={() => !saving && setModalVisible(false)} style={s.iconBtn}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={s.title}>Novo Treino Extra</Text>
              <View style={{ width: 38 }} />
            </View>
            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>NOME</Text>
              <TextInput value={fName} onChangeText={setFName} style={s.input}
                placeholder="Ex: HIIT 20min" placeholderTextColor={Colors.textSecondary} />

              <Text style={[s.label, { marginTop: 18 }]}>CATEGORIA</Text>
              <View style={s.catGrid}>
                {EXTRA_CATEGORIES.map(cat => {
                  const cc = CATEGORY_COLORS[cat.key];
                  const icon = CATEGORY_ICONS[cat.key];
                  return (
                    <TouchableOpacity key={cat.key}
                      style={[s.catGridBtn, fCategory === cat.key && { borderColor: cc, backgroundColor: `${cc}15` }]}
                      onPress={() => setFCategory(cat.key)} activeOpacity={0.75}>
                      <Ionicons name={icon} size={18} color={fCategory === cat.key ? cc : Colors.textSecondary} />
                      <Text style={[s.catGridText, fCategory === cat.key && { color: cc }]}>{cat.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[s.label, { marginTop: 18 }]}>DESCRIÇÃO</Text>
              <TextInput value={fDescription} onChangeText={setFDescription} style={[s.input, s.textArea]}
                multiline placeholder="Descreva o objetivo e instruções gerais..." placeholderTextColor={Colors.textSecondary} />

              <View style={s.templateRow}>
                <View>
                  <Text style={s.templateLabel}>Salvar como template</Text>
                  <Text style={s.templateDesc}>Permite reutilizar e atribuir a múltiplos alunos</Text>
                </View>
                <Switch value={fIsTemplate} onValueChange={setFIsTemplate}
                  trackColor={{ false: Colors.border, true: primaryColor }} thumbColor="#fff" />
              </View>

              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
                onPress={handleCreate} disabled={saving} activeOpacity={0.85}>
                {saving
                  ? <ActivityIndicator color={lightText ? '#000' : '#fff'} />
                  : <Text style={[s.saveBtnText, { color: lightText ? '#000' : '#fff' }]}>Criar Treino Extra</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, flex: 1, marginLeft: 8 },
  addBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 12 },
  catIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: 6 },
  cardMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: Colors.border },
  badgeText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  modalContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  label: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catGridBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  catGridText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  templateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 16, marginTop: 18 },
  templateLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  templateDesc: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md },
});
