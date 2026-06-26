import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { StriveLogo } from '@/components/StriveLogo';

const BENEFITS = [
  { icon: '⚡', text: 'Treinos personalizados' },
  { icon: '📊', text: 'Acompanhe a evolução em tempo real' },
  { icon: '✅', text: 'Registre cargas e conquiste metas' },
];

export default function WelcomeScreen() {
  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.logoSection}>
          <StriveLogo iconSize={88} />
        </View>

        <View style={styles.heroSection}>
          <Text style={styles.headline}>Evolução que você vê.</Text>
          <Text style={styles.subheadline}>
            Acompanhe cada treino, cada série, cada avanço.
          </Text>
        </View>

        <View style={styles.benefits}>
          {BENEFITS.map((item, i) => (
            <View key={i} style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>{item.icon}</Text>
              <Text style={styles.benefitText}>{item.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.ctaPrimary}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaPrimaryText}>Começar Agora</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(auth)/login')}
          style={styles.ctaSecondary}
          activeOpacity={0.7}
        >
          {/* <Text style={styles.ctaSecondaryText}>Já tenho conta. Fazer login</Text> */}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 24,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 37,
  },
  heroSection: {
    marginBottom: 35,
  },
  headline: {
    fontFamily: FontFamily.display,
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 38,
    marginBottom: 16,
  },
  subheadline: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  benefits: {
    gap: 20,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  benefitIcon: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
  },
  benefitText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    paddingTop: 16,
    gap: 16,
  },
  ctaPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaPrimaryText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.lg,
    color: Colors.bg,
  },
  ctaSecondary: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  ctaSecondaryText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
