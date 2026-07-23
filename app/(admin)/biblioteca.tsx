import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Linking,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { ModuleGuard } from '@/components/ModuleGuard';
import { MODULE } from '@/lib/modules';
import { GUIDES } from '@/lib/guides';
import { useGuide } from '@/hooks/useGuide';
import { GuideModal } from '@/components/guides/GuideModal';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

interface CategoryRow {
  id: string;
  name: string;
  kind: string;
  sort_order: number;
}

interface ItemRow {
  id: string;
  category_id: string;
  title: string;
  description: string | null;
  kind: string;
  format: string;
  thumbnail_url: string | null;
  canva_template_url: string | null;
  file_url: string | null;
  min_plan: string;
  category_name: string | null;
  saved: boolean;
}

const KIND_LABEL: Record<string, string> = { arte: 'Artes', material: 'Materiais', estudo: 'Estudos' };
const PLAN_LABEL: Record<string, string> = { free: 'Grátis', pro: 'Pro', premium: 'Premium' };
const PLAN_ORDER: Record<string, number> = { free: 0, pro: 1, premium: 2 };

function BibliotecaListScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? '';

  const guide = useGuide('biblioteca_conteudo', profile?.id);

  const [loading, setLoading] = useState(true);
  const [tenantPlan, setTenantPlan] = useState('free');
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;

    const [tenantRes, categoriesRes, itemsRes, savesRes] = await Promise.all([
      supabase.from('tenants').select('plan').eq('id', tenantId).single(),
      supabase.from('content_library_categories').select('id, name, kind, sort_order').order('kind').order('sort_order'),
      supabase.from('content_library_items')
        .select('id, category_id, title, description, kind, format, thumbnail_url, canva_template_url, file_url, min_plan, content_library_categories(name)')
        .eq('status', 'published')
        .order('created_at', { ascending: false }),
      profile?.id
        ? supabase.from('content_library_item_saves').select('item_id').eq('personal_id', profile.id)
        : Promise.resolve({ data: [] as { item_id: string }[] }),
    ]);

    setTenantPlan(tenantRes.data?.plan ?? 'free');
    setCategories(categoriesRes.data ?? []);

    const savedIds = new Set((savesRes.data ?? []).map((s: any) => s.item_id));
    setItems((itemsRes.data ?? []).map((it: any) => ({
      ...it,
      category_name: it.content_library_categories?.name ?? null,
      saved: savedIds.has(it.id),
    })));

    setLoading(false);
  }, [tenantId, profile?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filteredItems = useMemo(() => items.filter(it =>
    (!kindFilter || it.kind === kindFilter) && (!categoryFilter || it.category_id === categoryFilter),
  ), [items, kindFilter, categoryFilter]);

  const visibleCategories = useMemo(() =>
    categories.filter(c => !kindFilter || c.kind === kindFilter),
  [categories, kindFilter]);

  function trackUsage(itemId: string, event: 'canva_open' | 'download') {
    supabase.rpc('increment_content_library_item_usage', { p_item_id: itemId, p_event: event }).then(() => {});
  }

  async function toggleSave(item: ItemRow) {
    if (!profile?.id) return;
    setItems(prev => prev.map(it => it.id === item.id ? { ...it, saved: !it.saved } : it));
    if (item.saved) {
      await supabase.from('content_library_item_saves').delete().eq('item_id', item.id).eq('personal_id', profile.id);
    } else {
      await supabase.from('content_library_item_saves').insert({
        item_id: item.id, tenant_id: tenantId, personal_id: profile.id,
      } as any);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Biblioteca</Text>
        <TouchableOpacity onPress={guide.open} style={s.iconBtn}>
          <Ionicons name="help-circle-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={primaryColor} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={filteredItems}
          keyExtractor={it => it.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          ListHeaderComponent={
            <View style={{ gap: 10, marginBottom: 4 }}>
              <View style={s.chipRow}>
                {(['arte', 'material', 'estudo'] as const).map(k => (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setKindFilter(kindFilter === k ? null : k)}
                    style={[s.chip, kindFilter === k && { backgroundColor: `${primaryColor}20`, borderColor: primaryColor }]}
                  >
                    <Text style={[s.chipText, kindFilter === k && { color: primaryColor }]}>{KIND_LABEL[k]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {visibleCategories.length > 0 && (
                <View style={s.chipRow}>
                  {visibleCategories.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => setCategoryFilter(categoryFilter === c.id ? null : c.id)}
                      style={[s.chipSm, categoryFilter === c.id && { backgroundColor: `${primaryColor}20`, borderColor: primaryColor }]}
                    >
                      <Text style={[s.chipSmText, categoryFilter === c.id && { color: primaryColor }]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="images-outline" size={52} color={Colors.border} />
              <Text style={s.emptyTitle}>Nenhum item disponível ainda</Text>
              <Text style={s.emptyText}>Em breve teremos novidades por aqui.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const locked = PLAN_ORDER[item.min_plan] > PLAN_ORDER[tenantPlan];
            return (
              <View style={s.card}>
                <View style={s.coverWrap}>
                  {item.thumbnail_url ? (
                    <Image
                      source={{ uri: item.thumbnail_url }}
                      style={[s.cover, locked && { opacity: 0.35 }]}
                      resizeMode="cover"
                      blurRadius={locked ? 8 : 0}
                    />
                  ) : (
                    <View style={[s.cover, s.coverPlaceholder]}>
                      <Ionicons name="image-outline" size={22} color={Colors.border} />
                    </View>
                  )}
                  {locked && (
                    <View style={s.lockBadge}>
                      <Ionicons name="lock-closed" size={11} color={Colors.textPrimary} />
                      <Text style={s.lockBadgeText}>{PLAN_LABEL[item.min_plan]}</Text>
                    </View>
                  )}
                  {!locked && (
                    <TouchableOpacity style={s.saveBtn} onPress={() => toggleSave(item)}>
                      <Ionicons name={item.saved ? 'bookmark' : 'bookmark-outline'} size={14} color={item.saved ? primaryColor : Colors.textPrimary} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={s.cardBody}>
                  <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
                  {item.category_name && <Text style={s.cardCategory} numberOfLines={1}>{item.category_name}</Text>}

                  {locked ? (
                    <Text style={s.lockedHint}>Disponível no plano {PLAN_LABEL[item.min_plan]}</Text>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                      {item.canva_template_url && (
                        <TouchableOpacity
                          style={[s.actionBtn, { backgroundColor: primaryColor, flex: 1 }]}
                          onPress={() => { trackUsage(item.id, 'canva_open'); Linking.openURL(item.canva_template_url!); }}
                        >
                          <Ionicons name="color-palette-outline" size={13} color="#0B0B0B" />
                          <Text style={s.actionBtnTextPrimary}>Canva</Text>
                        </TouchableOpacity>
                      )}
                      {item.file_url && (
                        <TouchableOpacity
                          style={[s.actionBtn, s.actionBtnOutline, !item.canva_template_url && { flex: 1 }]}
                          onPress={() => { trackUsage(item.id, 'download'); Linking.openURL(item.file_url!); }}
                        >
                          <Ionicons name="download-outline" size={13} color={Colors.textPrimary} />
                          {!item.canva_template_url && <Text style={s.actionBtnText}>Baixar</Text>}
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      <GuideModal
        visible={guide.visible}
        content={GUIDES.biblioteca_conteudo}
        onClose={guide.close}
        onDismissForever={guide.dismissForever}
      />
    </SafeAreaView>
  );
}

export default function BibliotecaScreen() {
  return (
    <ModuleGuard slug={MODULE.BIBLIOTECA_CONTEUDO}>
      <BibliotecaListScreen />
    </ModuleGuard>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, flex: 1, marginLeft: 8 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: Colors.textSecondary },
  chipSm: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: `${Colors.surface}80` },
  chipSmText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },

  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 12 },
  card: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  coverWrap: { width: '100%', aspectRatio: 1, backgroundColor: Colors.bg },
  cover: { width: '100%', height: '100%' },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  lockBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.6)' },
  lockBadgeText: { fontFamily: FontFamily.bodyMedium, fontSize: 10, color: Colors.textPrimary },
  saveBtn: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },

  cardBody: { padding: 10, gap: 3 },
  cardTitle: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: Colors.textPrimary, lineHeight: 16 },
  cardCategory: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
  lockedHint: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, marginTop: 6 },

  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 8 },
  actionBtnOutline: { borderWidth: 1, borderColor: Colors.border, backgroundColor: 'transparent', paddingHorizontal: 8 },
  actionBtnTextPrimary: { fontFamily: FontFamily.bodyBold, fontSize: 10, color: '#0B0B0B' },
  actionBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 10, color: Colors.textPrimary },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
