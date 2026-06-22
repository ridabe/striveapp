import { View, Text, ScrollView } from 'react-native';
import { Colors } from '@/theme';
import { FontFamily, FontSize } from '@/theme/typography';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';

export default function HomeScreen() {
  const { tenantName, primaryColor } = useThemeStore();
  const { user } = useAuthStore();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={{ fontFamily: FontFamily.display, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 48, marginBottom: 4 }}>
          {tenantName.toUpperCase()}
        </Text>
        <Text style={{ fontFamily: FontFamily.display, fontSize: FontSize['2xl'], color: Colors.textPrimary, marginBottom: 32 }}>
          OLÁ, ALUNO
        </Text>

        <View style={{ backgroundColor: Colors.surface, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: Colors.border }}>
          <Text style={{ fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 8 }}>
            EM DESENVOLVIMENTO
          </Text>
          <Text style={{ fontFamily: FontFamily.body, fontSize: FontSize.md, color: Colors.textPrimary }}>
            O módulo de home será implementado com streak, plano ativo e atalhos.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
