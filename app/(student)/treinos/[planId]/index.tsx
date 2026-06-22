import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '@/theme';
import { FontFamily, FontSize } from '@/theme/typography';

export default function PlanDetailScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, padding: 24, paddingTop: 60 }}>
      <Text style={{ fontFamily: FontFamily.display, fontSize: FontSize.xl, color: Colors.textPrimary }}>
        PLANO DE TREINO
      </Text>
      <Text style={{ fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 8 }}>
        ID: {planId}
      </Text>
    </View>
  );
}
