import { useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { useThemeStore } from '@/stores/themeStore';
import { PLAN_GOALS, GOAL_COLORS } from '@/lib/exerciseConfig';
import { MAX_COLOR } from './MaxAvatar';

export interface PlanPreferences {
  workoutType?: string;
  goal?: string;
  daysCount?: number;
  notes?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSkip: () => void;
  onSubmit: (preferences: PlanPreferences) => void;
}

const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6];

const NOTES_TIPS = [
  'Poucos exercícios e cargas altas',
  'Foco em pernas e glúteos',
  'Treino em casa, sem equipamentos',
  'Evitar exercícios de impacto (joelho)',
];

export function CriarTreinoWizardModal({ visible, onClose, onSkip, onSubmit }: Props) {
  const { primaryColor, primaryTextColor } = useThemeStore();
  const [goal, setGoal] = useState('');
  const [daysCount, setDaysCount] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  function reset() {
    setGoal('');
    setDaysCount(null);
    setNotes('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSkip() {
    reset();
    onSkip();
  }

  function handleSubmit() {
    const preferences: PlanPreferences = {
      goal:      goal || undefined,
      daysCount: daysCount ?? undefined,
      notes:     notes.trim() || undefined,
    };
    reset();
    onSubmit(preferences);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />

            <View style={s.header}>
              <Text style={s.title}>Personalizar Treino</Text>
              <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.helperText}>
                Responda o que quiser — o que ficar em branco o Max decide sozinho.
              </Text>

              <Text style={s.sectionLabel}>OBJETIVO DO TREINO</Text>
              <View style={s.chipGrid}>
                {PLAN_GOALS.map((g) => {
                  const isSelected = goal === g;
                  const color = GOAL_COLORS[g] ?? primaryColor;
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[s.chip, isSelected && { borderColor: color, backgroundColor: `${color}18` }]}
                      onPress={() => setGoal(g === goal ? '' : g)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.chipText, isSelected && { color }]}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[s.sectionLabel, { marginTop: 20 }]}>QUANTIDADE DE DIAS</Text>
              <View style={s.chipGrid}>
                {DAYS_OPTIONS.map((n) => {
                  const isSelected = daysCount === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[s.dayChip, isSelected && { borderColor: primaryColor, backgroundColor: `${primaryColor}18` }]}
                      onPress={() => setDaysCount(isSelected ? null : n)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.chipText, isSelected && { color: primaryColor }]}>{n}x</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[s.sectionLabel, { marginTop: 20 }]}>OBSERVAÇÕES</Text>
              <TextInput
                style={s.input}
                value={notes}
                onChangeText={setNotes}
                placeholder="Ex: poucos exercícios e muita carga"
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <View style={s.tipsWrap}>
                {NOTES_TIPS.map((tip) => (
                  <TouchableOpacity
                    key={tip}
                    style={s.tipChip}
                    onPress={() => setNotes(tip)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.tipChipText}>{tip}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[s.submitBtn, { backgroundColor: primaryColor }]}
                onPress={handleSubmit}
                activeOpacity={0.85}
              >
                <Ionicons name="sparkles-outline" size={18} color={primaryTextColor} />
                <Text style={[s.submitText, { color: primaryTextColor }]}>Criar com essas preferências</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.skipBtn} onPress={handleSkip} activeOpacity={0.75}>
                <Ionicons name="flash-outline" size={16} color={MAX_COLOR} />
                <Text style={s.skipText}>Deixar o Max decidir automaticamente</Text>
              </TouchableOpacity>

              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, maxHeight: '90%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  helperText: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 16, lineHeight: 18 },
  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 10 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg,
  },
  dayChip: {
    width: 46, height: 40, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center',
  },
  chipText: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: Colors.textSecondary },
  input: {
    fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary,
    backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 72,
  },
  tipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tipChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  tipChipText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 16, marginTop: 24,
  },
  submitText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
  skipBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, marginTop: 8,
  },
  skipText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: MAX_COLOR },
});
