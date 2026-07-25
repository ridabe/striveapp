// Check-in de prontidão — versão nativa.
//
// Mesma regra de design do web: ~15 segundos, três toques. No celular a
// tentação de "só mais um campinho" é ainda maior porque a tela é a tela
// inteira — e é ainda mais errado, porque o aluno está de pé na academia com
// o fone no ouvido. Nada de texto livre.

import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/theme/colors'
import { FontFamily, FontSize } from '@/theme/typography'

export type ReadinessAnswers = {
  sleepQuality: number
  muscleSoreness: number
  energyLevel: number
  painAreas: string[]
}

type Scale = { value: number; label: string }

const SLEEP: Scale[] = [
  { value: 1, label: 'Péssimo' },
  { value: 2, label: 'Ruim' },
  { value: 3, label: 'Ok' },
  { value: 4, label: 'Bom' },
  { value: 5, label: 'Ótimo' },
]

// Invertida: 1 = sem dor (melhor), 5 = muita dor (pior). O motor faz (6 - valor).
const SORENESS: Scale[] = [
  { value: 1, label: 'Nenhuma' },
  { value: 2, label: 'Leve' },
  { value: 3, label: 'Média' },
  { value: 4, label: 'Bastante' },
  { value: 5, label: 'Muita' },
]

const ENERGY: Scale[] = [
  { value: 1, label: 'No chão' },
  { value: 2, label: 'Baixa' },
  { value: 3, label: 'Normal' },
  { value: 4, label: 'Alta' },
  { value: 5, label: 'Ótima' },
]

// Precisa espelhar matchesArea() do adaptationEngine.ts. Região marcada aqui
// que não exista lá = aluno reporta dor e nada acontece.
const PAIN_AREAS = ['Ombro', 'Joelho', 'Lombar', 'Cotovelo', 'Punho', 'Quadril', 'Tornozelo', 'Pescoço']

function ScaleRow({
  title, hint, options, value, onChange, primaryColor, invert = false,
}: {
  title: string
  hint: string
  options: Scale[]
  value: number | null
  onChange: (v: number) => void
  primaryColor: string
  invert?: boolean
}) {
  return (
    <View style={s.block}>
      <Text style={s.blockTitle}>{title}</Text>
      <Text style={s.blockHint}>{hint}</Text>
      <View style={s.row}>
        {options.map((opt) => {
          const active = value === opt.value
          const good = invert ? opt.value <= 2 : opt.value >= 4
          const activeColor = good ? primaryColor : Colors.warning
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                s.chip,
                active && { borderColor: activeColor, backgroundColor: `${activeColor}1A` },
              ]}
            >
              <Text
                style={[s.chipText, active && { color: activeColor }]}
                numberOfLines={2}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

export function ReadinessCheckIn({
  onSubmit,
  submitting = false,
  primaryColor = Colors.primary,
}: {
  onSubmit: (answers: ReadinessAnswers) => void
  submitting?: boolean
  primaryColor?: string
}) {
  const [sleep, setSleep] = useState<number | null>(null)
  const [soreness, setSoreness] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [painAreas, setPainAreas] = useState<string[]>([])
  const [painOpen, setPainOpen] = useState(false)

  const complete = sleep !== null && soreness !== null && energy !== null

  function togglePain(area: string) {
    setPainAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    )
  }

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <Text style={[s.eyebrow, { color: primaryColor }]}>ANTES DE COMEÇAR</Text>
        <Text style={s.title}>Como você{'\n'}chegou hoje?</Text>
        <Text style={s.subtitle}>Três toques. O treino de hoje se ajusta à sua resposta.</Text>
      </View>

      <ScaleRow
        title="Sono da última noite"
        hint="Quantidade e qualidade juntas"
        options={SLEEP}
        value={sleep}
        onChange={setSleep}
        primaryColor={primaryColor}
      />
      <ScaleRow
        title="Dor muscular"
        hint="Do último treino, não dor de lesão"
        options={SORENESS}
        value={soreness}
        onChange={setSoreness}
        primaryColor={primaryColor}
        invert
      />
      <ScaleRow
        title="Energia agora"
        hint="Vontade e disposição para treinar"
        options={ENERGY}
        value={energy}
        onChange={setEnergy}
        primaryColor={primaryColor}
      />

      <View style={s.painSection}>
        <TouchableOpacity onPress={() => setPainOpen((v) => !v)} style={s.painToggle}>
          <Text style={s.painToggleText}>
            Alguma dor localizada?
            {painAreas.length > 0 && (
              <Text style={{ color: primaryColor }}>  {painAreas.length} marcada{painAreas.length > 1 ? 's' : ''}</Text>
            )}
          </Text>
          <Ionicons
            name={painOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>

        {painOpen && (
          <View style={s.painBody}>
            <View style={s.painGrid}>
              {PAIN_AREAS.map((area) => {
                const active = painAreas.includes(area)
                return (
                  <TouchableOpacity
                    key={area}
                    onPress={() => togglePain(area)}
                    style={[
                      s.painChip,
                      active && { borderColor: Colors.warning, backgroundColor: `${Colors.warning}1A` },
                    ]}
                  >
                    <Text style={[s.painChipText, active && { color: Colors.warning }]}>{area}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <Text style={s.painNote}>
              Marcar uma região pode trocar exercícios que a exigem. Dor forte ou persistente:
              fale com seu personal antes de treinar.
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        disabled={!complete || submitting}
        onPress={() =>
          onSubmit({
            sleepQuality: sleep!,
            muscleSoreness: soreness!,
            energyLevel: energy!,
            painAreas,
          })
        }
        style={[
          s.cta,
          { backgroundColor: primaryColor },
          (!complete || submitting) && s.ctaDisabled,
        ]}
      >
        {submitting
          ? <ActivityIndicator color={Colors.bg} />
          : <Text style={s.ctaText}>CONTINUAR</Text>}
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40, gap: 22 },
  header: { gap: 6 },
  eyebrow: { fontFamily: FontFamily.bodyBold, fontSize: 10, letterSpacing: 1.5 },
  title: { fontFamily: FontFamily.display, fontSize: FontSize.xl, color: Colors.textPrimary, lineHeight: 32 },
  subtitle: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  block: { gap: 8 },
  blockTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  blockHint: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: -4 },
  row: { flexDirection: 'row', gap: 6 },
  chip: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center',
    minHeight: 48,
  },
  chipText: {
    fontFamily: FontFamily.bodyBold, fontSize: 10, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 13,
  },

  painSection: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 16, gap: 12 },
  painToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  painToggleText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textSecondary },
  painBody: { gap: 10 },
  painGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  painChip: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  painChipText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  painNote: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, lineHeight: 15 },

  cta: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: { opacity: 0.35 },
  ctaText: { fontFamily: FontFamily.display, fontSize: FontSize.sm, color: Colors.bg, letterSpacing: 1.5 },
})
