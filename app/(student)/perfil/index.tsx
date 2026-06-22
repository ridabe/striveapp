import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { signOut } from '@/services/auth';
import { Colors } from '@/theme';
import { FontFamily, FontSize } from '@/theme/typography';

const menuItems = [
  { label: 'Frequência', route: '/(student)/mais/frequencia' },
  { label: 'Anamnese', route: '/(student)/mais/anamnese' },
  { label: 'Avaliação Física', route: '/(student)/mais/avaliacao' },
  { label: 'Feedback', route: '/(student)/mais/feedback' },
  { label: 'Financeiro', route: '/(student)/mais/financeiro' },
  { label: 'Histórico', route: '/(student)/mais/historico' },
];

export default function PerfilScreen() {
  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)/login');
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, padding: 24, paddingTop: 60 }}>
      <Text style={{ fontFamily: FontFamily.display, fontSize: FontSize['2xl'], color: Colors.textPrimary, marginBottom: 32 }}>
        PERFIL
      </Text>

      {menuItems.map((item) => (
        <TouchableOpacity
          key={item.route}
          onPress={() => router.push(item.route as any)}
          style={{
            backgroundColor: Colors.surface,
            borderRadius: 12,
            padding: 16,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: Colors.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, color: Colors.textPrimary }}>
            {item.label}
          </Text>
          <Text style={{ color: Colors.textSecondary }}>›</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        onPress={handleSignOut}
        style={{
          marginTop: 24,
          borderRadius: 12,
          padding: 16,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: Colors.border,
        }}
      >
        <Text style={{ fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, color: Colors.error }}>
          Sair
        </Text>
      </TouchableOpacity>
    </View>
  );
}
