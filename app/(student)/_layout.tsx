import { Tabs, Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@/stores/themeStore';
import { useModulesStore } from '@/stores/modulesStore';
import { MODULE } from '@/lib/modules';
import { Colors } from '@/theme';
import { FontFamily, FontSize } from '@/theme/typography';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useStudent } from '@/hooks/useStudent';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { signOut } from '@/services/auth';

export default function StudentLayout() {
  const { primaryColor, accentTextColor } = useThemeStore();
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

  if (allStudents.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: `${Colors.border}80`, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name="person-remove-outline" size={22} color={Colors.textSecondary} />
        </View>
        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: FontSize.lg, color: Colors.textPrimary, textAlign: 'center', marginBottom: 6 }}>
          Sem mentoria ativa
        </Text>
        <Text style={{ fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
          Você não tem nenhum personal trainer ativo no momento. Entre em contato com seu personal para retomar o acompanhamento.
        </Text>
        <TouchableOpacity
          onPress={async () => { await signOut(); router.replace('/(auth)/welcome'); }}
          style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 }}
          activeOpacity={0.75}
        >
          <Text style={{ fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary }}>Sair</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Rota fora deste grupo — select-tenant não pode ser filho da própria Tabs
  // que este redirect substitui, senão o Tabs (que hospedaria a tela) nunca
  // chega a renderizar e o app fica em loop de redirect.
  if (allStudents.length > 1 && !selectedStudent) {
    return <Redirect href="/select-tenant" />;
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
        tabBarActiveTintColor: accentTextColor,
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
    </Tabs>
  );
}
