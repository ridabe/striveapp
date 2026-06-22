import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '@/theme';

export default function Index() {
  const { session, profile, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/welcome" />;

  const role = profile?.role;
  if (role === 'personal' || role === 'global_admin') {
    return <Redirect href={'/(admin)' as Href} />;
  }

  return <Redirect href="/(student)" />;
}
