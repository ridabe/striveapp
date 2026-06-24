import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut } from '@/services/auth';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useModulesStore } from '@/stores/modulesStore';
import { MODULE } from '@/lib/modules';
import { TenantLogo } from '@/components/TenantLogo';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { APP_VERSION_NAME, APP_VERSION_CODE } from '@/lib/appVersion';

interface TenantContact {
  business_name: string;
  contact_phone: string | null;
  contact_email: string | null;
}

const ALL_MODULES = [
  { label: 'Frequência',      icon: 'calendar-outline',      route: '/(student)/mais/frequencia',  desc: 'Calendário de presenças',      slug: MODULE.FREQUENCIA },
  { label: 'Anamnese',        icon: 'document-text-outline', route: '/(student)/mais/anamnese',    desc: 'Histórico de saúde',           slug: MODULE.ANAMNESE },
  { label: 'Avaliação Física',icon: 'body-outline',          route: '/(student)/mais/avaliacao',   desc: 'Medidas e composição corporal',slug: MODULE.AVALIACOES },
  { label: 'Feedback',        icon: 'star-outline',          route: '/(student)/mais/feedback',    desc: 'Avalie seus treinos',          slug: MODULE.FEEDBACKS },
  { label: 'Arquivos',        icon: 'folder-outline',        route: '/(student)/mais/arquivos',    desc: 'Material compartilhado',       slug: MODULE.ARQUIVOS },
  { label: 'Histórico',       icon: 'time-outline',          route: '/(student)/mais/historico',   desc: 'Sessões anteriores',           slug: MODULE.EXECUCAO_TREINO },
  { label: 'Financeiro',      icon: 'card-outline',          route: '/(student)/mais/financeiro',  desc: 'Faturas e pagamentos',         slug: MODULE.FATURAS },
];

function fmtPhone(raw: string) {
  const d = raw.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return raw;
}

async function openWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, '');
  // Add Brazil DDI if not already present
  const fullNum = digits.startsWith('55') ? digits : `55${digits}`;
  const nativeUrl = `whatsapp://send?phone=${fullNum}`;
  const webUrl    = `https://api.whatsapp.com/send?phone=${fullNum}`;
  const can = await Linking.canOpenURL(nativeUrl);
  await Linking.openURL(can ? nativeUrl : webUrl);
}

export default function PerfilScreen() {
  const { student, loading: studentLoading } = useStudent();
  const { profile } = useAuthStore();
  const { primaryColor, tenantName, tenantLogoUrl } = useThemeStore();
  const { has: hasModule, isLoaded: modulesLoaded } = useModulesStore();

  const visibleModules = ALL_MODULES.filter(m => !modulesLoaded || hasModule(m.slug as any));

  const [tenantContact, setTenantContact] = useState<TenantContact | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);

  const fullName = student?.full_name ?? profile?.full_name ?? 'Aluno';
  const email    = student?.email ?? profile?.email ?? '';
  const phone    = student?.phone ?? null;
  const goal     = student?.goal ?? null;

  const initials = fullName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    const tenantId = profile?.tenant_id;
    if (!tenantId) { setLoadingTenant(false); return; }
    supabase
      .from('tenants')
      .select('business_name, contact_phone, contact_email')
      .eq('id', tenantId)
      .single()
      .then(({ data }) => {
        setTenantContact(data ?? null);
        setLoadingTenant(false);
      });
  }, [profile?.tenant_id]);

  async function handleSignOut() {
    Alert.alert('Sair da conta', 'Deseja encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  if (studentLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ActivityIndicator color={primaryColor} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={s.pageHeader}>
          <Text style={s.pageTitle}>Meu Perfil</Text>
          <TenantLogo size={36} />
        </View>

        {/* ── Student card ─────────────────────────────────────────────── */}
        <View style={[s.card, { borderColor: `${primaryColor}30` }]}>
          <View style={[s.avatarCircle, { backgroundColor: `${primaryColor}22` }]}>
            <Text style={[s.avatarText, { color: primaryColor }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.studentName}>{fullName}</Text>
            {email ? (
              <View style={s.infoRow}>
                <Ionicons name="mail-outline" size={13} color={Colors.textSecondary} />
                <Text style={s.infoText}>{email}</Text>
              </View>
            ) : null}
            {phone ? (
              <View style={s.infoRow}>
                <Ionicons name="call-outline" size={13} color={Colors.textSecondary} />
                <Text style={s.infoText}>{fmtPhone(phone)}</Text>
              </View>
            ) : null}
            {goal ? (
              <View style={[s.goalPill, { backgroundColor: `${primaryColor}18` }]}>
                <Text style={[s.goalPillText, { color: primaryColor }]}>{goal}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Personal / Studio card ───────────────────────────────────── */}
        <Text style={s.sectionLabel}>MEU PERSONAL</Text>
        <View style={[s.card, s.personalCard]}>
          <View style={s.personalTop}>
            <TenantLogo size={52} radius={14} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.personalName}>{tenantContact?.business_name ?? tenantName}</Text>
              {tenantContact?.contact_email ? (
                <View style={s.infoRow}>
                  <Ionicons name="mail-outline" size={13} color={Colors.textSecondary} />
                  <Text style={s.infoText} numberOfLines={1}>{tenantContact.contact_email}</Text>
                </View>
              ) : null}
              {tenantContact?.contact_phone ? (
                <View style={s.infoRow}>
                  <Ionicons name="call-outline" size={13} color={Colors.textSecondary} />
                  <Text style={s.infoText}>{fmtPhone(tenantContact.contact_phone)}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Action buttons */}
          {(tenantContact?.contact_phone || tenantContact?.contact_email) ? (
            <View style={s.contactActions}>
              {tenantContact.contact_phone ? (
                <TouchableOpacity
                  style={s.whatsappBtn}
                  onPress={() => openWhatsApp(tenantContact.contact_phone!)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                  <Text style={s.whatsappBtnText}>WhatsApp</Text>
                </TouchableOpacity>
              ) : null}
              {tenantContact.contact_phone ? (
                <TouchableOpacity
                  style={[s.contactBtn, { borderColor: `${primaryColor}40` }]}
                  onPress={() => Linking.openURL(`tel:${tenantContact.contact_phone}`)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call-outline" size={16} color={primaryColor} />
                  <Text style={[s.contactBtnText, { color: primaryColor }]}>Ligar</Text>
                </TouchableOpacity>
              ) : null}
              {tenantContact.contact_email ? (
                <TouchableOpacity
                  style={[s.contactBtn, { borderColor: `${primaryColor}40` }]}
                  onPress={() => Linking.openURL(`mailto:${tenantContact.contact_email}`)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="mail-outline" size={16} color={primaryColor} />
                  <Text style={[s.contactBtnText, { color: primaryColor }]}>E-mail</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {loadingTenant && !tenantContact ? (
            <ActivityIndicator color={primaryColor} size="small" style={{ marginTop: 8 }} />
          ) : null}
        </View>

        {/* ── Account settings ─────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>MINHA CONTA</Text>
        <View style={s.menuGroup}>
          <TouchableOpacity
            style={[s.menuItem, s.menuItemBorder]}
            onPress={() => router.push('/(auth)/change-password' as any)}
            activeOpacity={0.75}
          >
            <View style={[s.menuIcon, { backgroundColor: `${primaryColor}12` }]}>
              <Ionicons name="lock-closed-outline" size={18} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.menuLabel}>Alterar senha</Text>
              <Text style={s.menuDesc}>Mude sua senha de acesso</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.menuItem}
            onPress={() => router.push('/(student)/mais/anamnese' as any)}
            activeOpacity={0.75}
          >
            <View style={[s.menuIcon, { backgroundColor: `${primaryColor}12` }]}>
              <Ionicons name="person-outline" size={18} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.menuLabel}>Meus dados de saúde</Text>
              <Text style={s.menuDesc}>Anamnese e informações pessoais</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Módulos ──────────────────────────────────────────────────── */}
        {visibleModules.length > 0 && <Text style={s.sectionLabel}>MÓDULOS</Text>}
        {visibleModules.length > 0 && <View style={s.menuGroup}>
          {visibleModules.map((item, idx) => (
            <TouchableOpacity
              key={item.route}
              style={[s.menuItem, idx < visibleModules.length - 1 && s.menuItemBorder]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.75}
            >
              <View style={[s.menuIcon, { backgroundColor: `${primaryColor}12` }]}>
                <Ionicons name={item.icon as any} size={18} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuLabel}>{item.label}</Text>
                <Text style={s.menuDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>}

        {/* ── App info ─────────────────────────────────────────────────── */}
        <View style={s.appInfo}>
          <TenantLogo size={28} radius={7} />
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text style={s.appInfoName}>{tenantName}</Text>
            <Text style={s.appInfoVersion}>Versão {APP_VERSION_NAME} (Build {APP_VERSION_CODE})</Text>
          </View>
          <Text style={s.appInfoPowered}>Powered by Strive Personal</Text>
        </View>

        {/* ── Sign out ─────────────────────────────────────────────────── */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.75}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={s.signOutText}>Sair da conta</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 18 },

  pageHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  pageTitle:     { fontFamily: FontFamily.display, fontSize: 26, color: Colors.textPrimary },

  // ── Student card ───────────────────────────────────────────────────────────
  card:          { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, padding: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 24 },
  avatarCircle:  { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:    { fontFamily: FontFamily.bodyBold, fontSize: 22 },
  studentName:   { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText:      { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, flex: 1 },
  goalPill:      { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginTop: 4 },
  goalPillText:  { fontFamily: FontFamily.bodyMedium, fontSize: 11 },

  // ── Personal card ──────────────────────────────────────────────────────────
  personalCard:  { flexDirection: 'column', gap: 14 },
  personalTop:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  personalName:  { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  contactActions:{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  whatsappBtn:   { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#25D366', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  whatsappBtnText:{ fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: '#fff' },
  contactBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5 },
  contactBtnText:{ fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },

  // ── Menu groups ────────────────────────────────────────────────────────────
  sectionLabel:  { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 10 },
  menuGroup:     { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 24 },
  menuItem:      { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  menuItemBorder:{ borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuIcon:      { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  menuLabel:     { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  menuDesc:      { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  // ── App info ───────────────────────────────────────────────────────────────
  appInfo:       { alignItems: 'center', gap: 10, paddingVertical: 20, marginBottom: 16 },
  appInfoName:   { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  appInfoVersion:{ fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary },
  appInfoPowered:{ fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, opacity: 0.5 },

  // ── Sign out ───────────────────────────────────────────────────────────────
  signOutBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: `${Colors.error}30`, padding: 16 },
  signOutText:   { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.error },
});
