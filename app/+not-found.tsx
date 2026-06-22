import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/theme';
import { FontFamily, FontSize } from '@/theme/typography';

export default function NotFoundScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ fontFamily: FontFamily.display, fontSize: FontSize['3xl'], color: Colors.primary, marginBottom: 8 }}>
        404
      </Text>
      <Text style={{ fontFamily: FontFamily.body, fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: 32, textAlign: 'center' }}>
        Esta tela não existe.
      </Text>
      <TouchableOpacity onPress={() => router.replace('/')}>
        <Text style={{ fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, color: Colors.primary }}>
          Voltar ao início
        </Text>
      </TouchableOpacity>
    </View>
  );
}
