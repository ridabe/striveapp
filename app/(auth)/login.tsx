import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { signIn } from '@/services/auth';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useBiometric } from '@/hooks/useBiometric';
import { Colors } from '@/theme';
import { FontFamily, FontSize } from '@/theme/typography';
import { StriveLogo } from '@/components/StriveLogo';

export default function LoginScreen() {
  const { setProfile } = useAuthStore();
  const { available, hasSavedCreds, authType, authenticate, saveCreds } = useBiometric();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Auto-trigger biometric if available and creds are saved
  useEffect(() => {
    if (available && hasSavedCreds) {
      handleBiometricLogin();
    }
  }, [available, hasSavedCreds]);

  async function navigateAfterLogin(userId: string): Promise<boolean> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(profile ?? null);

    if (profile?.must_change_password) {
      router.replace('/(auth)/change-password');
      return true;
    }

    const role = profile?.role;
    const dest: Href = (role === 'personal' || role === 'global_admin')
      ? '/(admin)' as Href
      : '/(student)';
    router.replace(dest);
    return false;
  }

  async function handleBiometricLogin() {
    setBioLoading(true);
    setError(null);
    try {
      const creds = await authenticate();
      if (!creds) {
        setBioLoading(false);
        return;
      }
      const { user } = await signIn(creds.email, creds.password);
      await navigateAfterLogin(user.id);
    } catch {
      setError('Não foi possível autenticar. Tente com senha.');
    } finally {
      setBioLoading(false);
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { user } = await signIn(email, password);
      const needsPasswordChange = await navigateAfterLogin(user.id);

      // Offer biometric only after a normal login (not when redirected to change password)
      if (!needsPasswordChange && available && !hasSavedCreds) {
        Alert.alert(
          `Usar ${authType} para entrar?`,
          `Ative o acesso rápido com ${authType} para não precisar digitar a senha toda vez.`,
          [
            { text: 'Agora não', style: 'cancel' },
            {
              text: 'Ativar',
              onPress: () => saveCreds(email, password),
            },
          ],
        );
      }
    } catch {
      setError('E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  }

  const showBioButton = available && hasSavedCreds;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <StriveLogo iconSize={64} />
        </View>

        {/* Biometric quick login */}
        {showBioButton && (
          <TouchableOpacity
            onPress={handleBiometricLogin}
            disabled={bioLoading}
            style={bioBtn}
            activeOpacity={0.8}
          >
            {bioLoading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <>
                <Ionicons
                  name={authType === 'Face ID' ? 'scan-outline' : 'finger-print-outline'}
                  size={22}
                  color={Colors.primary}
                />
                <Text style={bioBtnText}>Entrar com {authType}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Divider when biometric button is shown */}
        {showBioButton && (
          <View style={dividerRow}>
            <View style={dividerLine} />
            <Text style={dividerText}>ou entre com senha</Text>
            <View style={dividerLine} />
          </View>
        )}

        <Text style={label}>E-mail</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="seu@email.com"
          placeholderTextColor={Colors.textSecondary}
          style={input}
        />

        <Text style={[label, { marginTop: 16 }]}>Senha</Text>
        <View style={{ position: 'relative', marginBottom: 8 }}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholder="••••••••"
            placeholderTextColor={Colors.textSecondary}
            style={[input, { paddingRight: 48 }]}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(v => !v)}
            style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(auth)/forgot-password')}
          style={{ alignSelf: 'flex-end', marginBottom: 24 }}
        >
          <Text style={{ fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.primary }}>
            Esqueci minha senha
          </Text>
        </TouchableOpacity>

        {error && (
          <Text style={{ color: Colors.error, fontFamily: FontFamily.body, fontSize: FontSize.sm, marginBottom: 16, textAlign: 'center' }}>
            {error}
          </Text>
        )}

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          style={submitBtn}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.bg} />
          ) : (
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.bg }}>
              Entrar
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Inline styles (simple screen, no StyleSheet needed) ─────────────────────
const label = {
  fontFamily: FontFamily.bodyMedium,
  fontSize: FontSize.sm,
  color: Colors.textSecondary,
  marginBottom: 6,
} as const;

const input = {
  backgroundColor: Colors.surface,
  color: Colors.textPrimary,
  borderWidth: 1,
  borderColor: Colors.border,
  borderRadius: 12,
  padding: 14,
  fontFamily: FontFamily.body,
  fontSize: FontSize.md,
} as const;

const submitBtn = {
  backgroundColor: Colors.primary,
  borderRadius: 12,
  padding: 16,
  alignItems: 'center' as const,
};

const bioBtn = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 10,
  borderWidth: 1.5,
  borderColor: Colors.primary,
  borderRadius: 12,
  padding: 14,
  marginBottom: 4,
  backgroundColor: `${Colors.primary}12`,
};

const bioBtnText = {
  fontFamily: FontFamily.bodyBold,
  fontSize: FontSize.md,
  color: Colors.primary,
};

const dividerRow = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 12,
  marginVertical: 20,
};

const dividerLine = {
  flex: 1,
  height: 1,
  backgroundColor: Colors.border,
};

const dividerText = {
  fontFamily: FontFamily.body,
  fontSize: FontSize.xs,
  color: Colors.textSecondary,
};
