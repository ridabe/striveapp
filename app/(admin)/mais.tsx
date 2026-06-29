import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useModulesStore } from '@/stores/modulesStore';
import { MODULE } from '@/lib/modules';
import { TenantLogo } from '@/components/TenantLogo';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { signOut } from '@/services/auth';
import { APP_VERSION_NAME } from '@/lib/appVersion';

interface ModuleItem {
  slug: string;
  icon: any;
  label: string;
  description: string;
  route?: string;
  danger?: boolean;
  always?: boolean;
}

interface ModuleGroup {
  title: string;
  items: ModuleItem[];
}

export default function MaisScreen() {
  const { profile } = useAuthStore();
  const { primaryColor, tenantName } = useThemeStore();
  const { has } = useModulesStore();


  async function handleSignOut() {
    Alert.alert('Sair', 'Deseja encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair', style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  }

  const ALL_GROUPS: ModuleGroup[] = [
    {
      title: 'GESTÃO',
      items: [
        {
          slug: MODULE.GAMIFICACAO,
          icon: 'trophy-outline',
          label: 'Ranking',
          description: 'Competição mensal de treinos',
          route: '/(admin)/ranking',
        },
        {
          slug: MODULE.FREQUENCIA,
          icon: 'calendar-outline',
          label: 'Frequência',
          description: 'Registros de presença dos alunos',
          route: '/(admin)/frequencia',
        },
        {
          slug: MODULE.AVALIACOES,
          icon: 'stats-chart-outline',
          label: 'Avaliações',
          description: 'Medidas e composição corporal',
          route: '/(admin)/avaliacao',
        },
        {
          slug: MODULE.ANAMNESE,
          icon: 'document-text-outline',
          label: 'Anamnese',
          description: 'Questionários de saúde',
          route: '/(admin)/anamnese',
        },
        {
          slug: MODULE.MEU_PROGRESSO,
          icon: 'trending-up-outline',
          label: 'Progresso',
          description: 'Evolução e fotos dos alunos',
          route: '/(admin)/progresso',
        },
        {
          slug: MODULE.FEEDBACKS,
          icon: 'chatbubble-outline',
          label: 'Feedbacks',
          description: 'Avaliações dos alunos sobre os treinos',
          route: '/(admin)/feedbacks',
        },
        {
          slug: MODULE.FATURAS,
          icon: 'card-outline',
          label: 'Faturas',
          description: 'Planos e pagamentos dos alunos',
        },
      ],
    },
    {
      title: 'CONTEÚDO',
      items: [
        {
          slug: MODULE.PLANOS_ALIMENTARES,
          icon: 'restaurant-outline',
          label: 'Alimentação',
          description: 'Cardápios e macronutrientes',
          route: '/(admin)/planos-alimentares/',
        },
        {
          slug: MODULE.MINHA_AGENDA,
          icon: 'calendar-number-outline',
          label: 'Agenda',
          description: 'Atendimentos e compromissos',
          route: '/(admin)/agenda',
        },
        {
          slug: MODULE.ARQUIVOS,
          icon: 'folder-outline',
          label: 'Arquivos',
          description: 'Documentos e materiais compartilhados',
          route: '/(admin)/arquivos',
        },
        {
          slug: MODULE.NOTIFICACOES,
          icon: 'notifications-outline',
          label: 'Notificações',
          description: 'Avisos e comunicados',
        },
      ],
    },
    {
      title: 'IA',
      items: [
        {
          slug: 'assistente-ia',
          icon: 'flash-outline',
          label: 'Max Strive IA',
          description: 'Consultoria IA — crie treinos e analise alunos',
          route: '/(admin)/alunos/',
        },
      ],
    },
    {
      title: 'CONTA',
      items: [
        {
          slug: 'perfil',
          always: true,
          icon: 'person-outline',
          label: 'Meu Perfil',
          description: profile?.email ?? '',
          route: '/(admin)/perfil',
        },
        {
          slug: 'studio',
          always: true,
          icon: 'business-outline',
          label: tenantName,
          description: 'Cores, logo e identidade visual',
          route: '/(admin)/studio',
        },
        {
          slug: 'sair',
          always: true,
          danger: true,
          icon: 'log-out-outline',
          label: 'Sair',
          description: 'Encerrar sessão',
        },
      ],
    },
  ];

  // Filter items by module access, keep "always" items
  const visibleGroups = ALL_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.always || has(item.slug as any)),
    }))
    .filter(group => group.items.length > 0);

  function handleItemPress(item: ModuleItem) {
    if (item.slug === 'sair') { handleSignOut(); return; }
    if (item.route) router.push(item.route as any);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <TenantLogo size={56} radius={14} />
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{tenantName}</Text>
          <Text style={styles.profileRole}>{profile?.full_name ?? 'Personal Trainer'}</Text>
          <Text style={styles.profileEmail}>{profile?.email}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {visibleGroups.map(group => (
          <View key={group.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{group.title}</Text>
            <View style={styles.grid}>
              {group.items.map(item => (
                <TouchableOpacity
                  key={item.slug}
                  style={styles.gridCell}
                  onPress={() => handleItemPress(item)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.gridIcon,
                    {
                      backgroundColor: item.danger
                        ? 'rgba(248,113,113,0.12)'
                        : `${primaryColor}18`,
                    },
                  ]}>
                    <Ionicons
                      name={item.icon}
                      size={24}
                      color={item.danger ? Colors.error : primaryColor}
                    />
                  </View>
                  <Text
                    style={[styles.gridLabel, item.danger && { color: Colors.error }]}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.version}>Strive Personal v{APP_VERSION_NAME}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  profileRole: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  profileEmail: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  scroll: {
    paddingTop: 20,
    paddingBottom: 32,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  gridCell: {
    width: '33.33%',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 6,
  },
  gridIcon: {
    width: 52,
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  version: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingBottom: 8,
  },
});
