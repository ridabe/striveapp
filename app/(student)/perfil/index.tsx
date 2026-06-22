import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut } from '@/services/auth';
import { useStudent } from '@/hooks/useStudent';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const MENU_ITEMS = [
  { label: 'Frequência',     icon: 'calendar-outline',       route: '/(student)/mais/frequencia',  desc: 'Calendário de presenças' },
  { label: 'Anamnese',       icon: 'document-text-outline',  route: '/(student)/mais/anamnese',    desc: 'Histórico de saúde' },
  { label: 'Avaliação Física', icon: 'body-outline',         route: '/(student)/mais/avaliacao',   desc: 'Medidas e composição' },
  { label: 'Feedback',       icon: 'star-outline',           route: '/(student)/mais/feedback',    desc: 'Avalie seus treinos' },
  { label: 'Financeiro',     icon: 'card-outline',           route: '/(student)/mais/financeiro',  desc: 'Faturas e pagamentos' },
  { label: 'Histórico',      icon: 'time-outline',           route: '/(student)/mais/historico',   desc: 'Sessões anteriores' },
];

export default function PerfilScreen() {
  const { student } = useStudent();
  const { profile } = useAuthStore();
  const { primaryColor, tenantName } = useThemeStore();

  const firstName = student?.full_name?.split(' ')[0] ?? profile?.full_name?.split(' ')[0] ?? 'Aluno';
  const initials = (student?.full_name ?? profile?.full_name ?? 'A')
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)/login');
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.profileHeader}>
          <View style={[s.avatar, { backgroundColor: `${primaryColor}22` }]}>
            <Text style={[s.avatarText, { color: primaryColor }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{student?.full_name ?? profile?.full_name ?? 'Aluno'}</Text>
            <Text style={s.email}>{profile?.email ?? ''}</Text>
            <View style={[s.tenantPill, { backgroundColor: `${primaryColor}15` }]}>
              <Ionicons name="shield-checkmark" size={11} color={primaryColor} />
              <Text style={[s.tenantPillText, { color: primaryColor }]}>{tenantName}</Text>
            </View>
          </View>
        </View>

        {/* Menu */}
        <Text style={s.sectionLabel}>MÓDULOS</Text>
        <View style={s.menuGroup}>
          {MENU_ITEMS.map((item, idx) => (
            <TouchableOpacity
              key={item.route}
              style={[s.menuItem, idx < MENU_ITEMS.length - 1 && s.menuItemBorder]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.75}
            >
              <View style={[s.menuIcon, { backgroundColor: `${primaryColor}12` }]}>
                <Ionicons name={item.icon as any} size={20} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuLabel}>{item.label}</Text>
                <Text style={s.menuDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.75}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={s.signOutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 20 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 20, marginBottom: 28 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FontFamily.bodyBold, fontSize: 22 },
  name: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  email: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  tenantPill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, marginTop: 8 },
  tenantPillText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 10 },
  menuGroup: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 24 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  menuDesc: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: `${Colors.error}30`, padding: 16 },
  signOutText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.error },
});
