import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import { useModulesStore } from '@/stores/modulesStore';
import { MODULE } from '@/lib/modules';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

interface ModuleCard {
  slug: string;
  label: string;
  description: string;
  icon: any;
  route: string | null;
}

const TREINO_MODULES: ModuleCard[] = [
  {
    slug: MODULE.BANCO_EXERCICIOS,
    label: 'Banco de Exercícios',
    description: 'Gerencie o catálogo de exercícios',
    icon: 'library-outline',
    route: '/(admin)/banco-exercicios',
  },
  {
    slug: MODULE.PLANOS_TREINO,
    label: 'Planos de Treino',
    description: 'Fichas e rotinas dos alunos',
    icon: 'document-text-outline',
    route: '/(admin)/planos',
  },
  {
    slug: MODULE.TREINOS_EXTRAS,
    label: 'Treinos Extras',
    description: 'HIIT, cardio, mobilidade e mais',
    icon: 'flash-outline',
    route: '/(admin)/treinos-extras',
  },
  {
    slug: MODULE.EXECUCAO_TREINO,
    label: 'Execução',
    description: 'Histórico de sessões dos alunos',
    icon: 'play-circle-outline',
    route: '/(admin)/execucao',
  },
];

export default function TreinosScreen() {
  const { primaryColor } = useThemeStore();
  const { has } = useModulesStore();

  const enabledModules = TREINO_MODULES.filter(m => has(m.slug as any));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Treinos</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>MÓDULOS ATIVOS</Text>

        {enabledModules.map(mod => (
          <TouchableOpacity
            key={mod.slug}
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => mod.route ? router.push(mod.route as any) : null}
          >
            <View style={[styles.iconBox, { backgroundColor: `${primaryColor}18` }]}>
              <Ionicons name={mod.icon} size={24} color={primaryColor} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardLabel}>{mod.label}</Text>
              <Text style={styles.cardDesc}>{mod.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        ))}

        {enabledModules.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="barbell-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyText}>Nenhum módulo de treino habilitado</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  sectionLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 10,
    gap: 14,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  cardDesc: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
