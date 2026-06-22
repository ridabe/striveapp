import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '@/theme';
import { FontFamily, FontSize } from '@/theme/typography';

export default function WorkoutExecutionScreen() {
  const { planId, routineId } = useLocalSearchParams<{ planId: string; routineId: string }>();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, padding: 24, paddingTop: 60 }}>
      <Text style={{ fontFamily: FontFamily.display, fontSize: FontSize.xl, color: Colors.textPrimary }}>
        EXECUÇÃO DO TREINO
      </Text>
      <Text style={{ fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 8 }}>
        Plano: {planId} | Rotina: {routineId}
      </Text>
      <Text style={{ fontFamily: FontFamily.body, fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 24 }}>
        Tela de execução com timer, séries e cargas será implementada aqui.
      </Text>
    </View>
  );
}
