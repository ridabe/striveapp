// Resumo do ajuste, exibido na tela "pronto para começar" logo após o check-in.
//
// Transparência é requisito, não enfeite: se a carga na tela não é a que o
// personal escreveu e o app não explica, o aluno acha que é bug — ou pior,
// acha que o personal errou. Valor antes → depois e o motivo, sempre.

import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/theme/colors'
import { FontFamily, FontSize } from '@/theme/typography'
import type { PlannedAdaptation, ReadinessBand } from '@/lib/adaptationEngine'

function iconFor(type: PlannedAdaptation['adaptationType']): {
  name: keyof typeof Ionicons.glyphMap
  color: string
} {
  switch (type) {
    case 'load_increase':
    case 'set_added':
      return { name: 'trending-up', color: Colors.success }
    case 'load_decrease':
    case 'set_removed':
      return { name: 'trending-down', color: Colors.warning }
    case 'exercise_swapped':
      return { name: 'swap-horizontal', color: Colors.warning }
    default:
      return { name: 'shield-checkmark-outline', color: Colors.textSecondary }
  }
}

export function AdaptationSummary({
  readinessScore,
  band,
  summary,
  adaptations,
  primaryColor = Colors.primary,
}: {
  readinessScore: number
  band: ReadinessBand
  summary: string
  adaptations: PlannedAdaptation[]
  primaryColor?: string
}) {
  const changed = adaptations.filter((a) => a.adaptationType !== 'no_change')
  const bandColor =
    band === 'high' ? primaryColor : band === 'low' ? Colors.warning : Colors.textSecondary

  return (
    <View style={[s.card, { borderColor: `${bandColor}40` }]}>
      <View style={s.head}>
        <View style={s.gaugeWrap}>
          <Ionicons name="speedometer-outline" size={20} color={bandColor} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.scoreLine}>
            <Text style={[s.score, { color: bandColor }]}>{readinessScore}</Text>
            <Text style={s.scoreUnit}>/100 prontidão</Text>
          </View>
          <Text style={s.summary}>{summary}</Text>
        </View>
      </View>

      {changed.length > 0 && (
        <View style={s.list}>
          <Text style={s.listTitle}>O QUE MUDOU HOJE</Text>
          {changed.map((a, i) => {
            const icon = iconFor(a.adaptationType)
            return (
              <View key={`${a.itemId}-${i}`} style={s.item}>
                <Ionicons name={icon.name} size={14} color={icon.color} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  {!!a.valueBefore && !!a.valueAfter && (
                    <Text style={s.change}>
                      <Text style={s.before}>{a.valueBefore}</Text>
                      <Text style={s.arrow}>  →  </Text>
                      <Text style={s.after}>{a.valueAfter}</Text>
                      {a.deltaPct != null && a.deltaPct !== 0 && (
                        <Text style={{ color: a.deltaPct > 0 ? Colors.success : Colors.warning }}>
                          {'  '}({a.deltaPct > 0 ? '+' : ''}{a.deltaPct}%)
                        </Text>
                      )}
                    </Text>
                  )}
                  <Text style={s.reason}>{a.reason}</Text>
                </View>
              </View>
            )
          })}
        </View>
      )}

      <Text style={s.footer}>
        Ajustes feitos dentro dos limites definidos pelo seu personal. Você pode alterar
        qualquer carga manualmente durante o treino.
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1, borderRadius: 16, padding: 16, gap: 14,
    backgroundColor: Colors.surface,
  },
  head: { flexDirection: 'row', gap: 12 },
  gaugeWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.bg,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  score: { fontFamily: FontFamily.display, fontSize: FontSize['2xl'] },
  scoreUnit: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  summary: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17, marginTop: 3 },

  list: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, gap: 10 },
  listTitle: { fontFamily: FontFamily.bodyBold, fontSize: 10, color: Colors.textSecondary, letterSpacing: 1.2 },
  item: { flexDirection: 'row', gap: 9 },
  change: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textPrimary },
  before: { color: Colors.textSecondary, textDecorationLine: 'line-through' },
  arrow: { color: Colors.textSecondary },
  after: { color: Colors.textPrimary },
  reason: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, lineHeight: 16, marginTop: 2 },

  footer: {
    fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, lineHeight: 15,
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12,
  },
})
