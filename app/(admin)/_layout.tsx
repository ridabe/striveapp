import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme';
import { useModulesStore } from '@/stores/modulesStore';
import { MODULE } from '@/lib/modules';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminLayout() {
  const { primaryColor } = useThemeStore();
  const insets = useSafeAreaInsets();
  const { has } = useModulesStore();

  const hasTreinos = has(MODULE.PLANOS_TREINO) || has(MODULE.TREINOS_EXTRAS) || has(MODULE.BANCO_EXERCICIOS);

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
        name="alunos"
        options={{
          title: 'Alunos',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="treinos"
        options={{
          title: 'Treinos',
          href: hasTreinos ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mais"
        options={{
          title: 'Mais',
          tabBarIcon: ({ color, size }) => <Ionicons name="menu" size={size} color={color} />,
        }}
      />
      {/* Telas de detalhe — ocultas do tab bar */}
      <Tabs.Screen name="studio" options={{ href: null }} />
      <Tabs.Screen name="perfil" options={{ href: null }} />
      <Tabs.Screen name="arquivos" options={{ href: null }} />
      <Tabs.Screen name="feedbacks" options={{ href: null }} />
      <Tabs.Screen name="frequencia" options={{ href: null }} />
      <Tabs.Screen name="progresso" options={{ href: null }} />
      <Tabs.Screen name="avaliacao" options={{ href: null }} />
      <Tabs.Screen name="anamnese" options={{ href: null }} />
      {/* alunos/[id] é gerenciado pelo Stack em app/(admin)/alunos/_layout.tsx */}
      {/* Módulos de treino */}
      <Tabs.Screen name="banco-exercicios" options={{ href: null }} />
      <Tabs.Screen name="planos" options={{ href: null }} />
      <Tabs.Screen name="treinos-extras" options={{ href: null }} />
      <Tabs.Screen name="execucao" options={{ href: null }} />
      {/* Novos módulos */}
      <Tabs.Screen name="agenda" options={{ href: null }} />
      <Tabs.Screen name="ranking" options={{ href: null }} />
      <Tabs.Screen name="planos-alimentares" options={{ href: null }} />
      {/* Max Strive IA */}
      <Tabs.Screen name="assistente-ia" options={{ href: null }} />
      <Tabs.Screen name="assistente-ia-chat" options={{ href: null }} />
    </Tabs>
  );
}
