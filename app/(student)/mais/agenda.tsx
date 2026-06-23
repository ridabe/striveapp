import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TenantLogo } from '@/components/TenantLogo';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const ACCENT = '#818CF8';

const FEATURES = [
  'Agendar sessão com o personal',
  'Visualizar horários disponíveis',
  'Confirmação e lembretes',
  'Histórico de sessões',
];

export default function AgendaScreen() {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.topNav}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <TenantLogo size={32} radius={9} />
      </View>
      {/* Header */}
      <View style={s.header}>
        <View style={[s.headerIcon, { backgroundColor: `${ACCENT}20` }]}>
          <Ionicons name="calendar-outline" size={22} color={ACCENT} />
        </View>
        <View style={s.headerText}>
          <Text style={s.headerTitle}>AGENDA</Text>
          <Text style={s.headerSub}>Agendamentos e horários com seu personal trainer.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Coming soon card */}
        <View style={[s.card, { borderColor: `${ACCENT}25` }]}>
          {/* Big icon */}
          <View style={[s.bigIcon, { backgroundColor: `${ACCENT}20` }]}>
            <Ionicons name="calendar-outline" size={40} color={ACCENT} />
          </View>

          {/* Badge */}
          <View style={[s.badge, { borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}12` }]}>
            <Ionicons name="time-outline" size={12} color={ACCENT} />
            <Text style={[s.badgeText, { color: ACCENT }]}>EM BREVE</Text>
          </View>

          <Text style={s.cardTitle}>MÓDULO EM{'\n'}DESENVOLVIMENTO</Text>

          <Text style={s.cardDesc}>
            Aqui você poderá agendar sessões, visualizar horários disponíveis e confirmar compromissos com seu personal.
          </Text>

          {/* Feature list */}
          <View style={s.featureList}>
            {FEATURES.map(f => (
              <View key={f} style={s.featureRow}>
                <View style={[s.dot, { backgroundColor: ACCENT }]} />
                <Text style={s.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Back link */}
      <TouchableOpacity style={s.backRow} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={16} color={Colors.textSecondary} />
        <Text style={s.backText}>Voltar ao início</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  topNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  headerIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerTitle: { fontFamily: FontFamily.display, fontSize: 22, color: Colors.textPrimary, letterSpacing: 1 },
  headerSub: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 3, lineHeight: 18 },

  scroll: { paddingHorizontal: 16, paddingBottom: 24 },

  card: { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, padding: 28, alignItems: 'center', gap: 16 },
  bigIcon: { width: 80, height: 80, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 1.5 },
  cardTitle: { fontFamily: FontFamily.display, fontSize: 22, color: Colors.textPrimary, letterSpacing: 0.8, textAlign: 'center', lineHeight: 30 },
  cardDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  featureList: { alignSelf: 'stretch', gap: 10, marginTop: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  featureText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 18, borderTopWidth: 1, borderTopColor: Colors.border },
  backText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
});
