import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

// Rota antiga — redireciona para a execução por plano (sem routineId)
export default function LegacyRoutineExecution() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  useEffect(() => {
    router.replace(`/(student)/treinos/${planId}/executar` as any);
  }, [planId]);
  return null;
}
