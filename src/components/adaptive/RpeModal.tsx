// Coleta do RPE ao fechar cada série.
//
// Aparece como folha inferior logo depois do toque em "concluir série", e sai
// sozinha assim que o aluno escolhe — um toque, sem botão de confirmar. No
// meio do treino, cada toque a mais é um motivo a mais para o aluno abandonar
// o registro e o motor ficar sem dado.
//
// Rótulos em "repetições que sobraram" em vez do número abstrato: é a pergunta
// que um leigo sabe responder de verdade. A conversão para RPE é interna.

import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native'
import { Colors } from '@/theme/colors'
import { FontFamily, FontSize } from '@/theme/typography'

const RPE_OPTIONS = [
  { value: 6,  label: 'Fácil',      hint: 'Sobrariam 4+ repetições', color: Colors.success },
  { value: 7,  label: 'Moderado',   hint: 'Sobrariam 3 repetições',  color: Colors.success },
  { value: 8,  label: 'Difícil',    hint: 'Sobrariam 2 repetições',  color: Colors.primary },
  { value: 9,  label: 'Muito duro', hint: 'Sobraria 1 repetição',    color: Colors.warning },
  { value: 10, label: 'Falha',      hint: 'Não fazia mais nenhuma',  color: Colors.error },
] as const

export function RpeModal({
  visible,
  seriesNumber,
  exerciseName,
  targetRpe,
  onSelect,
  onSkip,
}: {
  visible: boolean
  seriesNumber: number
  exerciseName: string
  targetRpe: number | null
  onSelect: (rpe: number) => void
  onSkip: () => void
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <Pressable style={s.backdrop} onPress={onSkip}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={s.grabber} />

          <View style={s.header}>
            <Text style={s.title}>Como foi a série {seriesNumber}?</Text>
            <Text style={s.subtitle} numberOfLines={1}>
              {exerciseName}
              {targetRpe != null && <Text style={s.target}>  ·  alvo {targetRpe}</Text>}
            </Text>
          </View>

          <View style={s.options}>
            {RPE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => onSelect(opt.value)}
                style={[s.option, { borderColor: `${opt.color}55` }]}
                accessibilityRole="button"
                accessibilityLabel={`Esforço ${opt.label}. ${opt.hint}`}
              >
                <View style={[s.badge, { backgroundColor: `${opt.color}1F`, borderColor: `${opt.color}55` }]}>
                  <Text style={[s.badgeText, { color: opt.color }]}>{opt.value}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.optionLabel}>{opt.label}</Text>
                  <Text style={s.optionHint}>{opt.hint}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={onSkip} style={s.skip}>
            <Text style={s.skipText}>Pular</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28, gap: 16,
    borderTopWidth: 1, borderColor: Colors.border,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center',
  },
  header: { gap: 3 },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  subtitle: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary },
  target: { color: Colors.primary },

  options: { gap: 8 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 12, padding: 12,
    backgroundColor: Colors.bg,
  },
  badge: {
    width: 38, height: 38, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: FontFamily.display, fontSize: FontSize.sm },
  optionLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  optionHint: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  skip: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 20 },
  skipText: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary },
})
