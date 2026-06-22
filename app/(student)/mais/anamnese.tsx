import { View, Text } from 'react-native';
import { Colors } from '@/theme';
import { FontFamily, FontSize } from '@/theme/typography';

export default function AnamneseScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, padding: 24, paddingTop: 60 }}>
      <Text style={{ fontFamily: FontFamily.display, fontSize: FontSize['2xl'], color: Colors.textPrimary }}>
        ANAMNESE
      </Text>
      <Text style={{ fontFamily: FontFamily.body, fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 16 }}>
        Formulário de saúde e histórico será implementado aqui.
      </Text>
    </View>
  );
}
