import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useModulesStore } from '@/stores/modulesStore';
import type { ModuleSlug } from '@/lib/modules';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

interface Props {
  slug: ModuleSlug;
  children: ReactNode;
}

export function ModuleGuard({ slug, children }: Props) {
  const { has, isLoaded } = useModulesStore();

  // While modules haven't been fetched yet, show nothing (avoid flash).
  if (!isLoaded) return null;

  if (!has(slug)) {
    return (
      <View style={s.wrap}>
        <View style={s.iconWrap}>
          <Ionicons name="lock-closed" size={36} color={Colors.textSecondary} />
        </View>
        <Text style={s.title}>Módulo não disponível</Text>
        <Text style={s.desc}>
          Este recurso não está ativo no seu plano atual.{'\n'}
          Entre em contato com seu personal trainer.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

const s = StyleSheet.create({
  wrap:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: `${Colors.border}`, alignItems: 'center', justifyContent: 'center' },
  title:    { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, textAlign: 'center' },
  desc:     { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
