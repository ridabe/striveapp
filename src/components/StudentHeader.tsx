import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TenantLogo } from '@/components/TenantLogo';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

interface StudentHeaderProps {
  title: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
}

export function StudentHeader({ title, onBack, rightSlot }: StudentHeaderProps) {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack ?? (() => router.back())} style={s.iconBtn}>
        <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
      </TouchableOpacity>
      <Text style={s.title} numberOfLines={1}>{title}</Text>
      {rightSlot ?? <TenantLogo size={32} radius={9} />}
    </View>
  );
}

const s = StyleSheet.create({
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:   { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
});
