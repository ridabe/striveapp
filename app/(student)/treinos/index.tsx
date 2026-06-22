import { View, Text } from 'react-native';
import { Colors } from '@/theme';
import { FontFamily, FontSize } from '@/theme/typography';

export default function TreinosScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, padding: 24, paddingTop: 60 }}>
      <Text style={{ fontFamily: FontFamily.display, fontSize: FontSize['2xl'], color: Colors.textPrimary, marginBottom: 24 }}>
        TREINOS
      </Text>
      <View style={{ backgroundColor: Colors.surface, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: Colors.border }}>
        <Text style={{ fontFamily: FontFamily.body, fontSize: FontSize.md, color: Colors.textSecondary }}>
          Lista de planos de treino será exibida aqui.
        </Text>
      </View>
    </View>
  );
}
