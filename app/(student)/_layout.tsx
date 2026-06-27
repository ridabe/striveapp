import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@/stores/themeStore';
import { useModulesStore } from '@/stores/modulesStore';
import { MODULE } from '@/lib/modules';
import { Colors } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStudent } from '@/hooks/useStudent';
import { View, ActivityIndicator } from 'react-native';

export default function StudentLayout() {
  const { primaryColor } = useThemeStore();
  const { selectedStudent, allStudents, loading } = useStudent();
  const insets = useSafeAreaInsets();
  const { has, isLoaded } = useModulesStore();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg }}>
        <ActivityIndicator color={primaryColor} size="large" />
      </View>
    );
  }

  if (allStudents.length > 1 && !selectedStudent) {
    return <Redirect href="/(student)/select-tenant" />;
  }

  // While loading, keep tabs visible to avoid flicker. Once loaded, apply gating.
  const showTreinos   = !isLoaded || has(MODULE.PLANOS_TREINO) || has(MODULE.EXECUCAO_TREINO);
  const showProgresso = !isLoaded || has(MODULE.MEU_PROGRESSO);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'DMSans_500Medium',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="treinos"
        options={{
          title: 'Treinos',
          href: showTreinos ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="progresso"
        options={{
          title: 'Evolução',
          href: showProgresso ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
      {/* Telas de detalhe — ocultas do tab bar */}
      <Tabs.Screen name="mais" options={{ href: null }} />
      <Tabs.Screen name="select-tenant" options={{ href: null }} />
    </Tabs>
  );
}
