import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '@/theme';

export default function Index() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return session ? <Redirect href="/(student)/" /> : <Redirect href="/(auth)/login" />;
}
