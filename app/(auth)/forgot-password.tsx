import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { resetPassword } from '@/services/auth';
import { Colors } from '@/theme';
import { FontFamily, FontSize } from '@/theme/typography';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    if (!email) { setError('Informe seu e-mail.'); return; }
    setLoading(true);
    setError(null);
    try {
      await resetPassword(email);
      setSent(true);
    } catch {
      setError('Não foi possível enviar o e-mail. Verifique o endereço.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontFamily: FontFamily.display, fontSize: FontSize['2xl'], color: Colors.textPrimary, marginBottom: 8 }}>
        Recuperar senha
      </Text>

      {sent ? (
        <>
          <Text style={{ fontFamily: FontFamily.body, fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: 32 }}>
            Enviamos um link para {email}. Verifique sua caixa de entrada.
          </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: Colors.primary, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, textAlign: 'center' }}>
              Voltar ao login
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={{ fontFamily: FontFamily.body, fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: 32 }}>
            Informe seu e-mail para receber o link de recuperação.
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
          {error && (
            <Text style={{ color: Colors.error, fontFamily: FontFamily.body, fontSize: FontSize.sm, marginBottom: 16 }}>
              {error}
            </Text>
          )}
          <TouchableOpacity
            onPress={handleReset}
            disabled={loading}
            style={{ backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 }}
          >
            {loading ? <ActivityIndicator color={Colors.bg} /> : (
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.bg }}>Enviar link</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: FontSize.sm, textAlign: 'center' }}>
              Voltar
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
