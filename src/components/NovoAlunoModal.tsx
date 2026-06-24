import { useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { useThemeStore } from '@/stores/themeStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormState {
  full_name: string;
  email: string;
  phone: string;
  birth_date: string;
  goal: string;
  notes: string;
}

const EMPTY: FormState = {
  full_name: '', email: '', phone: '', birth_date: '', goal: '', notes: '',
};

export function NovoAlunoModal({ visible, onClose, onSuccess }: Props) {
  const { primaryColor } = useThemeStore();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  function set(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleClose() {
    if (saving) return;
    setForm(EMPTY);
    onClose();
  }

  async function handleSubmit() {
    if (!form.full_name.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome completo do aluno.');
      return;
    }
    if (!form.email.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o email do aluno.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      Alert.alert('Email inválido', 'Informe um endereço de email válido.');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-student', {
        body: {
          full_name: form.full_name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || null,
          birth_date: form.birth_date.trim() || null,
          goal: form.goal.trim() || null,
          notes: form.notes.trim() || null,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setForm(EMPTY);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar aluno';
      Alert.alert('Erro', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />

            {/* Header */}
            <View style={s.header}>
              <Text style={s.title}>Novo Aluno</Text>
              <TouchableOpacity onPress={handleClose} disabled={saving} style={s.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.sectionLabel}>DADOS PESSOAIS</Text>

              <Field label="Nome completo *" icon="person-outline">
                <TextInput
                  style={s.input}
                  value={form.full_name}
                  onChangeText={v => set('full_name', v)}
                  placeholder="Nome do aluno"
                  placeholderTextColor={Colors.textSecondary}
                  autoCapitalize="words"
                  editable={!saving}
                />
              </Field>

              <Field label="Email *" icon="mail-outline">
                <TextInput
                  style={s.input}
                  value={form.email}
                  onChangeText={v => set('email', v)}
                  placeholder="email@exemplo.com"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!saving}
                />
              </Field>

              <Field label="Telefone" icon="call-outline">
                <TextInput
                  style={s.input}
                  value={form.phone}
                  onChangeText={v => set('phone', v)}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="phone-pad"
                  editable={!saving}
                />
              </Field>

              <Field label="Data de nascimento" icon="calendar-outline">
                <TextInput
                  style={s.input}
                  value={form.birth_date}
                  onChangeText={v => set('birth_date', v)}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="numeric"
                  editable={!saving}
                />
              </Field>

              <Text style={[s.sectionLabel, { marginTop: 20 }]}>TREINO</Text>

              <Field label="Objetivo" icon="fitness-outline">
                <TextInput
                  style={s.input}
                  value={form.goal}
                  onChangeText={v => set('goal', v)}
                  placeholder="Ex: Hipertrofia, emagrecimento..."
                  placeholderTextColor={Colors.textSecondary}
                  autoCapitalize="sentences"
                  editable={!saving}
                />
              </Field>

              <Field label="Observações" icon="document-text-outline">
                <TextInput
                  style={[s.input, s.multiline]}
                  value={form.notes}
                  onChangeText={v => set('notes', v)}
                  placeholder="Restrições, lesões, informações importantes..."
                  placeholderTextColor={Colors.textSecondary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  autoCapitalize="sentences"
                  editable={!saving}
                />
              </Field>

              <View style={s.info}>
                <Ionicons name="information-circle-outline" size={14} color={Colors.textSecondary} />
                <Text style={s.infoText}>
                  Um email com os dados de acesso provisório será enviado automaticamente para o aluno.
                </Text>
              </View>

              <TouchableOpacity
                style={[s.submitBtn, { backgroundColor: primaryColor }, saving && s.submitDisabled]}
                onPress={handleSubmit}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={18} color="#000" />
                    <Text style={s.submitText}>Criar aluno e enviar convite</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label, icon, children,
}: {
  label: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.field}>
      <View style={s.fieldHeader}>
        <Ionicons name={icon as any} size={13} color={Colors.textSecondary} />
        <Text style={s.fieldLabel}>{label}</Text>
      </View>
      <View style={s.fieldInput}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '92%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  title: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  field: { marginBottom: 14 },
  fieldHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6,
  },
  fieldLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  fieldInput: {
    backgroundColor: Colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    minHeight: 46,
    justifyContent: 'center',
  },
  input: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    paddingVertical: 12,
  },
  multiline: {
    minHeight: 72,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  info: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.bg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    marginTop: 6,
  },
  infoText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14,
    paddingVertical: 16,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.sm,
    color: '#000',
  },
});
