import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TenantLogo } from '@/components/TenantLogo';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

interface StudentHeaderProps {
  title: string;
  showBack?: boolean;
}

export function StudentHeader({ title, showBack = true }: StudentHeaderProps) {
  return (
    <View style={s.row}>
      {showBack ? (
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={s.backBtn} />
      )}
      <Text style={s.title} numberOfLines={1}>{title}</Text>
      <TenantLogo size={32} radius={9} />
    </View>
  );
}

const s = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 32, alignItems: 'flex-start' },
  title:   { flex: 1, fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, textAlign: 'center' },
});
