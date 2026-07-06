import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert, Image,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { ModuleGuard } from '@/components/ModuleGuard';
import { MODULE } from '@/lib/modules';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

interface ChallengeRow {
  id: string;
  name: string;
  status: string;
  duration_days: number;
  cover_image_url: string | null;
  participantCount: number;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Rascunho',   color: Colors.textSecondary },
  active:    { label: 'Ativo',      color: '#4ADE80' },
  finished:  { label: 'Finalizado', color: '#F59E0B' },
  published: { label: 'Publicado',  color: '#60A5FA' },
};

const RELEASE_MODES = [
  { key: 'progressive', label: 'Progressiva', desc: 'Publique um dia de cada vez' },
  { key: 'all_at_once',  label: 'Tudo de uma vez', desc: 'Monte tudo e publique junto' },
] as const;

function ChallengesListScreen() {
  const { profile } = useAuthStore();
  const { primaryColor, primaryTextColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? '';

  const [planBlocked, setPlanBlocked] = useState<boolean | null>(null);
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fName, setFName] = useState('');
  const [fDescription, setFDescription] = useState('');
  const [fDuration, setFDuration] = useState('21');
  const [fRules, setFRules] = useState('');
  const [fPrizes, setFPrizes] = useState('');
  const [fReleaseMode, setFReleaseMode] = useState<'progressive' | 'all_at_once'>('progressive');

  const load = useCallback(async () => {
    if (!tenantId) return;

    const { data: tenant } = await supabase.from('tenants').select('plan').eq('id', tenantId).single();
    const blocked = tenant?.plan === 'free';
    setPlanBlocked(blocked);
    if (blocked) { setLoading(false); return; }

    const [challengesRes, participantsRes] = await Promise.all([
      supabase.from('challenges')
        .select('id, name, status, duration_days, cover_image_url')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
      supabase.from('challenge_participants').select('challenge_id').eq('tenant_id', tenantId),
    ]);

    const counts = new Map<string, number>();
    (participantsRes.data ?? []).forEach((p: any) => {
      counts.set(p.challenge_id, (counts.get(p.challenge_id) ?? 0) + 1);
    });

    setChallenges((challengesRes.data ?? []).map((c: any) => ({
      ...c,
      participantCount: counts.get(c.id) ?? 0,
    })));
    setLoading(false);
  }, [tenantId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function resetForm() {
    setFName(''); setFDescription(''); setFDuration('21');
    setFRules(''); setFPrizes(''); setFReleaseMode('progressive');
  }

  async function handleCreate() {
    if (!fName.trim()) { Alert.alert('Atenção', 'Informe o nome do desafio.'); return; }
    const duration = parseInt(fDuration, 10);
    if (!duration || duration <= 0) { Alert.alert('Atenção', 'Informe uma duração válida em dias.'); return; }

    setSaving(true);
    try {
      const { data, error } = await supabase.from('challenges').insert({
        tenant_id: tenantId,
        created_by: profile?.id,
        name: fName.trim(),
        description: fDescription.trim() || null,
        rules: fRules.trim() || null,
        prizes: fPrizes.trim() || null,
        duration_days: duration,
        release_mode: fReleaseMode,
        status: 'draft',
      } as any).select('id').single();
      if (error) throw error;
      setModalVisible(false);
      resetForm();
      await load();
      router.push(`/(admin)/desafios/${data.id}` as any);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (planBlocked === true) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.title}>Desafios</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={s.upsell}>
          <Ionicons name="flag-outline" size={52} color={Colors.border} />
          <Text style={s.upsellTitle}>Disponível a partir do plano Pro</Text>
          <Text style={s.upsellText}>
            O módulo Desafios não está incluído no plano Free. Faça upgrade do seu plano para criar desafios com ranking de evolução para seus alunos.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Desafios</Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: primaryColor }]}
          onPress={() => setModalVisible(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color={primaryTextColor} />
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={primaryColor} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={challenges}
          keyExtractor={c => c.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="flag-outline" size={52} color={Colors.border} />
              <Text style={s.emptyTitle}>Nenhum desafio</Text>
              <Text style={s.emptyText}>Crie um desafio com duração definida para engajar seus alunos.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const st = STATUS_LABEL[item.status] ?? STATUS_LABEL.draft;
            return (
              <TouchableOpacity
                style={s.card}
                onPress={() => router.push(`/(admin)/desafios/${item.id}` as any)}
                activeOpacity={0.8}
              >
                <View style={s.coverWrap}>
                  {item.cover_image_url ? (
                    <Image source={{ uri: item.cover_image_url }} style={s.cover} resizeMode="cover" />
                  ) : (
                    <View style={[s.cover, s.coverPlaceholder]}>
                      <Ionicons name="flag-outline" size={26} color={Colors.border} />
                    </View>
                  )}
                </View>
                <View style={s.cardBody}>
                  <View style={s.cardTop}>
                    <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                    <View style={[s.statusPill, { backgroundColor: `${st.color}20` }]}>
                      <Text style={[s.statusPillText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  <View style={s.cardMeta}>
                    <Ionicons name="people-outline" size={12} color={Colors.textSecondary} />
                    <Text style={s.cardMetaText}>{item.participantCount} participante{item.participantCount !== 1 ? 's' : ''}</Text>
                    <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} style={{ marginLeft: 8 }} />
                    <Text style={s.cardMetaText}>{item.duration_days} dias</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Create modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => !saving && setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
              <TouchableOpacity onPress={() => !saving && setModalVisible(false)} style={s.iconBtn}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={s.title}>Novo Desafio</Text>
              <View style={{ width: 38 }} />
            </View>
            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>NOME</Text>
              <TextInput value={fName} onChangeText={setFName} style={s.input}
                placeholder="Ex: 21 dias — Queima de Gordura" placeholderTextColor={Colors.textSecondary} />

              <Text style={[s.label, { marginTop: 18 }]}>DURAÇÃO (DIAS)</Text>
              <TextInput value={fDuration} onChangeText={setFDuration} style={s.input}
                keyboardType="number-pad" placeholder="21" placeholderTextColor={Colors.textSecondary} />

              <Text style={[s.label, { marginTop: 18 }]}>DESCRIÇÃO</Text>
              <TextInput value={fDescription} onChangeText={setFDescription} style={[s.input, s.textArea]}
                multiline placeholder="Meta e objetivo do desafio..." placeholderTextColor={Colors.textSecondary} />

              <Text style={[s.label, { marginTop: 18 }]}>REGRAS</Text>
              <TextInput value={fRules} onChangeText={setFRules} style={[s.input, s.textArea]}
                multiline placeholder="Regras do desafio..." placeholderTextColor={Colors.textSecondary} />

              <Text style={[s.label, { marginTop: 18 }]}>PREMIAÇÕES</Text>
              <TextInput value={fPrizes} onChangeText={setFPrizes} style={[s.input, s.textArea]}
                multiline placeholder="O que o vencedor ganha..." placeholderTextColor={Colors.textSecondary} />

              <Text style={[s.label, { marginTop: 18 }]}>MODO DE LIBERAÇÃO DOS DIAS</Text>
              <View style={{ gap: 8 }}>
                {RELEASE_MODES.map(mode => (
                  <TouchableOpacity
                    key={mode.key}
                    style={[s.modeRow, fReleaseMode === mode.key && { borderColor: primaryColor, backgroundColor: `${primaryColor}12` }]}
                    onPress={() => setFReleaseMode(mode.key)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={fReleaseMode === mode.key ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={fReleaseMode === mode.key ? primaryColor : Colors.textSecondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.modeLabel}>{mode.label}</Text>
                      <Text style={s.modeDesc}>{mode.desc}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
                onPress={handleCreate} disabled={saving} activeOpacity={0.85}>
                {saving
                  ? <ActivityIndicator color={primaryTextColor} />
                  : <Text style={[s.saveBtnText, { color: primaryTextColor }]}>Criar Desafio</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

export default function DesafiosScreen() {
  return (
    <ModuleGuard slug={MODULE.DESAFIOS}>
      <ChallengesListScreen />
    </ModuleGuard>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, flex: 1, marginLeft: 8 },
  addBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  upsell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  upsellTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.lg, color: Colors.textPrimary, textAlign: 'center' },
  upsellText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', paddingRight: 12, gap: 12 },
  coverWrap: { width: 88, aspectRatio: 1200 / 630 },
  cover: { width: '100%', height: '100%' },
  coverPlaceholder: { backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, paddingVertical: 12, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { flex: 1, fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusPillText: { fontFamily: FontFamily.bodyMedium, fontSize: 10 },
  cardMeta: { flexDirection: 'row', alignItems: 'center' },
  cardMetaText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginLeft: 4 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },

  modalContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  label: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface, borderRadius: 12, padding: 14 },
  modeLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  modeDesc: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md },
});
