import { View, Text } from 'react-native';
import { Colors } from '@/theme';
import { FontFamily, FontSize } from '@/theme/typography';

export default function ProgressoScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, padding: 24, paddingTop: 60 }}>
      <Text style={{ fontFamily: FontFamily.display, fontSize: FontSize['2xl'], color: Colors.textPrimary, marginBottom: 24 }}>
        PROGRESSO
      </Text>
      <View style={{ backgroundColor: Colors.surface, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: Colors.border }}>
        <Text style={{ fontFamily: FontFamily.body, fontSize: FontSize.md, color: Colors.textSecondary }}>
          Registro de peso e fotos será implementado aqui.
        </Text>
      </View>
    </View>
  );
}
