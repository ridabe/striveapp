import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { signIn } from '@/services/auth';
import { Colors } from '@/theme';
import { FontFamily, FontSize } from '@/theme/typography';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace('/(student)/');
    } catch (e: any) {
      setError('E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontFamily: FontFamily.display, fontSize: FontSize['3xl'], color: Colors.primary, marginBottom: 8 }}>
          STRIVE
        </Text>
        <Text style={{ fontFamily: FontFamily.body, fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: 40 }}>
          Seu treino. Sua evolução.
        </Text>

        <Text style={{ fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 6 }}>
          E-mail
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="seu@email.com"
          placeholderTextColor={Colors.textSecondary}
          style={{
            backgroundColor: Colors.surface,
            color: Colors.textPrimary,
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: 12,
            padding: 14,
            fontFamily: FontFamily.body,
            fontSize: FontSize.md,
            marginBottom: 16,
          }}
        />

        <Text style={{ fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 6 }}>
          Senha
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={Colors.textSecondary}
          style={{
            backgroundColor: Colors.surface,
            color: Colors.textPrimary,
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: 12,
            padding: 14,
            fontFamily: FontFamily.body,
            fontSize: FontSize.md,
            marginBottom: 8,
          }}
        />

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
          style={{
            backgroundColor: Colors.primary,
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
          }}
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
