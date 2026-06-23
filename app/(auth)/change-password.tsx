import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Colors } from '@/theme';
import { FontFamily, FontSize } from '@/theme/typography';
import { StriveLogo } from '@/components/StriveLogo';

export default function ChangePasswordScreen() {
  const { profile, setProfile } = useAuthStore();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);

    if (newPassword.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) { setError(updateErr.message); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ must_change_password: false }).eq('id', user.id);
        // Refresh profile in store
        const { data: updated } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(updated ?? null);

        const role = updated?.role;
        const dest: Href = (role === 'personal' || role === 'global_admin')
          ? '/(admin)' as Href
          : '/(student)';
        router.replace(dest);
      }
    } catch {
      setError('Não foi possível alterar a senha. Tente novamente.');
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
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.logoWrap}>
          <StriveLogo iconSize={56} />
        </View>

        <View style={s.card}>
          {/* Icon + heading */}
          <View style={s.cardHeader}>
            <View style={[s.shieldIcon, { backgroundColor: `${Colors.primary}15`, borderColor: `${Colors.primary}30` }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
            </View>
            <View style={s.cardHeaderText}>
              <Text style={s.cardTitle}>Crie sua nova senha</Text>
              <Text style={s.cardSubtitle}>
                Este é seu primeiro acesso. Defina uma senha pessoal para continuar.
              </Text>
            </View>
          </View>

          {/* First-access warning */}
          <View style={[s.warningBox, { borderColor: `${Colors.primary}30`, backgroundColor: `${Colors.primary}08` }]}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.primary} />
            <Text style={[s.warningText, { color: Colors.primary }]}>
              Sua senha provisória será invalidada após esta etapa.
            </Text>
          </View>

          {/* Error */}
          {error && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {/* New password */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Nova senha</Text>
            <View style={s.inputRow}>
              <TextInput
                style={[s.input, { paddingRight: 48 }]}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor={Colors.textSecondary}
                returnKeyType="next"
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowNew(v => !v)}
                style={s.eyeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm password */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Confirmar nova senha</Text>
            <View style={s.inputRow}>
              <TextInput
                style={[s.input, { paddingRight: 48 }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                placeholder="••••••••"
                placeholderTextColor={Colors.textSecondary}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowConfirm(v => !v)}
                style={s.eyeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: Colors.primary }, loading && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.bg} />
            ) : (
              <Text style={s.submitBtnText}>Alterar senha e continuar</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoWrap: { alignItems: 'center', marginBottom: 32 },

  card: { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 24, gap: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  shieldIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardHeaderText: { flex: 1 },
  cardTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  cardSubtitle: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },

  warningBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  warningText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, flex: 1, lineHeight: 17 },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${Colors.error}10`, borderRadius: 10, borderWidth: 1, borderColor: `${Colors.error}30`, paddingHorizontal: 12, paddingVertical: 10 },
  errorText: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.error, flex: 1 },

  fieldWrap: { gap: 6 },
  fieldLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: Colors.textSecondary },
  inputRow: { position: 'relative' },
  input: { backgroundColor: Colors.bg, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontFamily: FontFamily.body, fontSize: FontSize.md },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },

  submitBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.bg },
});
