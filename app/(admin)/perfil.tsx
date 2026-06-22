import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Plan {
  slug: string;
  name: string;
  price_brl: number;
  max_students: number;
  features: string[];
  abacatepay_product_id: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function FieldHint({ children }: { children: string }) {
  return <Text style={styles.fieldHint}>{children}</Text>;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PerfilScreen() {
  const { profile, setProfile } = useAuthStore();
  const { primaryColor } = useThemeStore();

  const tenantId = profile?.tenant_id;

  // Personal data
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  // Business data
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [savingBusiness, setSavingBusiness] = useState(false);

  // Plans
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanSlug, setCurrentPlanSlug] = useState<string>('free');
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  // ─── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;

    Promise.all([
      supabase.from('tenants')
        .select('contact_email, contact_phone, plan')
        .eq('id', tenantId)
        .single(),
      supabase.from('plans')
        .select('slug, name, price_brl, max_students, features, abacatepay_product_id')
        .eq('is_active', true)
        .order('sort_order'),
    ]).then(([tenantRes, plansRes]) => {
      if (tenantRes.data) {
        setContactEmail(tenantRes.data.contact_email ?? '');
        setContactPhone(tenantRes.data.contact_phone ?? '');
        setCurrentPlanSlug(tenantRes.data.plan ?? 'free');
      }
      if (plansRes.data) setPlans(plansRes.data as Plan[]);
    });
  }, [tenantId]);

  // ─── Save personal data ────────────────────────────────────────────────────
  async function handleSaveProfile() {
    if (!profile?.id) return;
    if (!fullName.trim()) {
      Alert.alert('Atenção', 'O nome não pode estar em branco.');
      return;
    }
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', profile.id);
      if (error) throw error;
      setProfile({ ...profile, full_name: fullName.trim() });
      Alert.alert('Salvo!', 'Dados pessoais atualizados.');
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    } finally {
      setSavingProfile(false);
    }
  }

  // ─── Change password ───────────────────────────────────────────────────────
  async function handleChangePassword() {
    if (!newPass) {
      Alert.alert('Atenção', 'Informe a nova senha.');
      return;
    }
    if (newPass.length < 6) {
      Alert.alert('Atenção', 'A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPass !== confirmPass) {
      Alert.alert('Atenção', 'As senhas não conferem.');
      return;
    }
    setSavingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
      Alert.alert('Senha alterada!', 'Sua senha foi atualizada com sucesso.');
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    } finally {
      setSavingPass(false);
    }
  }

  // ─── Save business data ────────────────────────────────────────────────────
  async function handleSaveBusiness() {
    if (!tenantId) return;
    setSavingBusiness(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,
        })
        .eq('id', tenantId);
      if (error) throw error;
      Alert.alert('Salvo!', 'Dados do negócio atualizados.');
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    } finally {
      setSavingBusiness(false);
    }
  }

  // ─── Plan upgrade ──────────────────────────────────────────────────────────
  async function handleUpgradePlan(plan: Plan) {
    if (!plan.abacatepay_product_id) return;
    setCheckingOut(plan.slug);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const res = await supabase.functions.invoke('create-plan-checkout', {
        body: { plan_slug: plan.slug },
      });

      if (res.error) throw new Error(res.error.message);
      const { checkout_url } = res.data as { checkout_url: string };

      await WebBrowser.openBrowserAsync(checkout_url, {
        toolbarColor: Colors.bg,
        controlsColor: primaryColor,
      });
    } catch (err: any) {
      Alert.alert('Erro ao abrir checkout', err.message);
    } finally {
      setCheckingOut(null);
    }
  }

  const currentPlan = plans.find(p => p.slug === currentPlanSlug);
  const upgradePlans = plans.filter(p => p.slug !== 'free' && p.slug !== currentPlanSlug);
  const lightText = ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(primaryColor);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meu Perfil</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarRow}>
          <View style={[styles.avatar, { backgroundColor: `${primaryColor}30` }]}>
            <Text style={[styles.avatarInitial, { color: primaryColor }]}>
              {(profile?.full_name ?? profile?.email ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.avatarInfo}>
            <Text style={styles.avatarName}>{profile?.full_name ?? '—'}</Text>
            <Text style={styles.avatarEmail}>{profile?.email}</Text>
          </View>
        </View>

        {/* ── Dados Pessoais ─────────────────────────────────────── */}
        <SectionLabel>DADOS PESSOAIS</SectionLabel>
        <View style={styles.card}>
          <View style={styles.cardField}>
            <Text style={styles.fieldLabel}>Nome completo</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Seu nome"
              placeholderTextColor={Colors.textSecondary}
              style={styles.input}
            />
          </View>
          <View style={[styles.cardField, { borderTopWidth: 1, borderTopColor: Colors.border }]}>
            <Text style={styles.fieldLabel}>E-mail</Text>
            <TextInput
              value={profile?.email ?? ''}
              editable={false}
              style={[styles.input, styles.inputDisabled]}
            />
            <FieldHint>O e-mail não pode ser alterado aqui</FieldHint>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: primaryColor }, savingProfile && styles.btnDisabled]}
          onPress={handleSaveProfile}
          disabled={savingProfile}
          activeOpacity={0.85}
        >
          {savingProfile
            ? <ActivityIndicator color={lightText ? '#000' : '#fff'} />
            : <Text style={[styles.saveBtnText, { color: lightText ? '#000' : '#fff' }]}>Salvar dados pessoais</Text>
          }
        </TouchableOpacity>

        {/* ── Alterar Senha ──────────────────────────────────────── */}
        <SectionLabel>ALTERAR SENHA</SectionLabel>
        <View style={styles.card}>
          <View style={styles.cardField}>
            <Text style={styles.fieldLabel}>Nova senha</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={newPass}
                onChangeText={setNewPass}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry={!showNew}
                style={[styles.input, { flex: 1 }]}
              />
              <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.eyeBtn}>
                <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.cardField, { borderTopWidth: 1, borderTopColor: Colors.border }]}>
            <Text style={styles.fieldLabel}>Confirmar nova senha</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={confirmPass}
                onChangeText={setConfirmPass}
                placeholder="Repita a nova senha"
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry={!showConfirm}
                style={[styles.input, { flex: 1 }]}
              />
              <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: primaryColor }, savingPass && styles.btnDisabled]}
          onPress={handleChangePassword}
          disabled={savingPass}
          activeOpacity={0.85}
        >
          {savingPass
            ? <ActivityIndicator color={lightText ? '#000' : '#fff'} />
            : <Text style={[styles.saveBtnText, { color: lightText ? '#000' : '#fff' }]}>Alterar senha</Text>
          }
        </TouchableOpacity>

        {/* ── Dados do Negócio ───────────────────────────────────── */}
        <SectionLabel>DADOS DO NEGÓCIO</SectionLabel>
        <View style={styles.card}>
          <View style={styles.cardField}>
            <Text style={styles.fieldLabel}>E-mail de contato</Text>
            <TextInput
              value={contactEmail}
              onChangeText={setContactEmail}
              placeholder="email@seustudio.com.br"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
          </View>
          <View style={[styles.cardField, { borderTopWidth: 1, borderTopColor: Colors.border }]}>
            <Text style={styles.fieldLabel}>Telefone / WhatsApp</Text>
            <TextInput
              value={contactPhone}
              onChangeText={setContactPhone}
              placeholder="(11) 99999-9999"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: primaryColor }, savingBusiness && styles.btnDisabled]}
          onPress={handleSaveBusiness}
          disabled={savingBusiness}
          activeOpacity={0.85}
        >
          {savingBusiness
            ? <ActivityIndicator color={lightText ? '#000' : '#fff'} />
            : <Text style={[styles.saveBtnText, { color: lightText ? '#000' : '#fff' }]}>Salvar dados do negócio</Text>
          }
        </TouchableOpacity>

        {/* ── Plano Atual ────────────────────────────────────────── */}
        <SectionLabel>PLANO ATUAL</SectionLabel>
        {currentPlan && (
          <View style={[styles.currentPlanCard, { borderColor: primaryColor }]}>
            <View style={styles.currentPlanHeader}>
              <View>
                <Text style={styles.currentPlanName}>{currentPlan.name}</Text>
                {currentPlan.price_brl > 0 ? (
                  <Text style={[styles.currentPlanPrice, { color: primaryColor }]}>
                    R$ {currentPlan.price_brl}/mês
                  </Text>
                ) : (
                  <Text style={[styles.currentPlanPrice, { color: Colors.textSecondary }]}>Gratuito</Text>
                )}
              </View>
              <View style={[styles.activeBadge, { backgroundColor: `${primaryColor}20` }]}>
                <Text style={[styles.activeBadgeText, { color: primaryColor }]}>Ativo</Text>
              </View>
            </View>
            <View style={styles.featureList}>
              {(currentPlan.features as string[]).map((feat, i) => (
                <View key={i} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={primaryColor} />
                  <Text style={styles.featureText}>{feat}</Text>
                </View>
              ))}
            </View>
            {currentPlan.max_students < 9999 && (
              <View style={styles.limitRow}>
                <Ionicons name="people-outline" size={15} color={Colors.textSecondary} />
                <Text style={styles.limitText}>Até {currentPlan.max_students} alunos</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Upgrade de Plano ───────────────────────────────────── */}
        {upgradePlans.length > 0 && (
          <>
            <SectionLabel>FAZER UPGRADE</SectionLabel>
            {upgradePlans.map(plan => (
              <View key={plan.slug} style={styles.upgradePlanCard}>
                <View style={styles.upgradePlanHeader}>
                  <View>
                    <Text style={styles.upgradePlanName}>{plan.name}</Text>
                    <Text style={styles.upgradePlanPrice}>
                      R$ {plan.price_brl}/mês
                    </Text>
                  </View>
                  {plan.max_students >= 9999 ? (
                    <View style={styles.unlimitedBadge}>
                      <Text style={styles.unlimitedBadgeText}>Ilimitado</Text>
                    </View>
                  ) : (
                    <View style={styles.studentsBadge}>
                      <Ionicons name="people" size={13} color={Colors.textSecondary} />
                      <Text style={styles.studentsBadgeText}>até {plan.max_students}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.featureList}>
                  {(plan.features as string[]).slice(0, 4).map((feat, i) => (
                    <View key={i} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle-outline" size={15} color={Colors.textSecondary} />
                      <Text style={styles.featureTextMuted}>{feat}</Text>
                    </View>
                  ))}
                  {plan.features.length > 4 && (
                    <Text style={styles.moreFeatures}>+{plan.features.length - 4} recursos incluídos</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.upgradeBtn, { backgroundColor: primaryColor }, checkingOut === plan.slug && styles.btnDisabled]}
                  onPress={() => handleUpgradePlan(plan)}
                  disabled={!!checkingOut}
                  activeOpacity={0.85}
                >
                  {checkingOut === plan.slug ? (
                    <ActivityIndicator color={lightText ? '#000' : '#fff'} size="small" />
                  ) : (
                    <>
                      <Ionicons name="rocket-outline" size={16} color={lightText ? '#000' : '#fff'} />
                      <Text style={[styles.upgradeBtnText, { color: lightText ? '#000' : '#fff' }]}>
                        Assinar plano {plan.name}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 52,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 28,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: FontFamily.display,
    fontSize: 26,
  },
  avatarInfo: { flex: 1 },
  avatarName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  avatarEmail: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 10,
  },
  cardField: {
    padding: 14,
    gap: 6,
  },
  fieldLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  fieldHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 3,
    opacity: 0.7,
  },
  input: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyeBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 28,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.sm,
  },

  // Current plan card
  currentPlanCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 28,
    gap: 12,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  currentPlanName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  currentPlanPrice: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  activeBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeBadgeText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.xs,
  },
  featureList: {
    gap: 6,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    flex: 1,
  },
  featureTextMuted: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  limitText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  // Upgrade plan cards
  upgradePlanCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  upgradePlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  upgradePlanName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  upgradePlanPrice: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  unlimitedBadge: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  unlimitedBadgeText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.xs,
    color: '#6366F1',
  },
  studentsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  studentsBadgeText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  moreFeatures: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 13,
  },
  upgradeBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.sm,
  },
});
