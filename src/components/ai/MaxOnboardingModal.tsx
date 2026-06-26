import { useEffect, useRef, useState } from 'react';
import {
  Animated, Image, Modal, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const MAX_COLOR = '#7C3AED';
const STORAGE_PREFIX = 'max_onboarding_seen_';

const DESCRIPTION =
  'Olá! Sou a Max Strive — sua nova parceira de inteligência artificial.\n\n' +
  'Fui criada para ajudar você a treinar seus alunos com mais inteligência, ' +
  'velocidade e personalização. Vou analisar dados, criar planos e sugerir ' +
  'estratégias em segundos.';

const STEPS = [
  {
    icon: 'person-outline' as const,
    label: 'Abra o perfil de um aluno e toque em "Consultar Max"',
  },
  {
    icon: 'flash-outline' as const,
    label: 'Escolha uma ação: gerar treino, analisar progresso, sugerir cargas ou motivar',
  },
  {
    icon: 'chatbubble-ellipses-outline' as const,
    label: 'Use o chat para conversar livremente e personalizar ainda mais',
  },
  {
    icon: 'checkmark-circle-outline' as const,
    label: 'Planos gerados são salvos automaticamente no perfil do aluno',
  },
];

interface Props {
  userId: string | null;
}

export function MaxOnboardingModal({ userId }: Props) {
  const [visible, setVisible]             = useState(false);
  const [typedText, setTypedText]         = useState('');
  const [typingDone, setTypingDone]       = useState(false);
  const [shownSteps, setShownSteps]       = useState(0);

  const cursorAnim    = useRef(new Animated.Value(1)).current;
  const stepAnims     = useRef(STEPS.map(() => new Animated.Value(0))).current;
  const avatarScale   = useRef(new Animated.Value(0.85)).current;
  const avatarOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity   = useRef(new Animated.Value(0)).current;

  // ── Check if already seen ─────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    SecureStore.getItemAsync(STORAGE_PREFIX + userId).then((val) => {
      if (!val) setVisible(true);
    });
  }, [userId]);

  // ── Entrance animations ───────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1, duration: 350, useNativeDriver: true,
      }),
      Animated.spring(avatarScale, {
        toValue: 1, tension: 60, friction: 8, useNativeDriver: true,
      }),
      Animated.timing(avatarOpacity, {
        toValue: 1, duration: 500, useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  // ── Cursor blink ──────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
        Animated.timing(cursorAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Typewriter ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    let index = 0;
    const id = setInterval(() => {
      if (index < DESCRIPTION.length) {
        setTypedText(DESCRIPTION.slice(0, index + 1));
        index++;
      } else {
        clearInterval(id);
        // small pause before marking done
        setTimeout(() => setTypingDone(true), 400);
      }
    }, 20);
    return () => clearInterval(id);
  }, [visible]);

  // ── Steps cascade ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!typingDone) return;
    let count = 0;
    const showNext = () => {
      if (count >= STEPS.length) return;
      const idx = count;
      setShownSteps(idx + 1);
      Animated.spring(stepAnims[idx], {
        toValue: 1, tension: 80, friction: 10, useNativeDriver: true,
      }).start(() => {
        count++;
        setTimeout(showNext, 180);
      });
    };
    setTimeout(showNext, 250);
  }, [typingDone]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleNeverAgain() {
    if (userId) {
      await SecureStore.setItemAsync(STORAGE_PREFIX + userId, '1');
    }
    setVisible(false);
  }

  function handleDismissSession() {
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={s.overlay}>
        <Animated.View style={[s.card, { opacity: cardOpacity }]}>
          <ScrollView
            style={s.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scrollContent}
            bounces={false}
          >
            {/* ── Badge ── */}
            <View style={s.badge}>
              <Ionicons name="flash" size={10} color={MAX_COLOR} />
              <Text style={s.badgeText}>NOVO MÓDULO DISPONÍVEL</Text>
            </View>

            {/* ── Avatar ── */}
            <Animated.View
              style={[s.avatarContainer, {
                opacity: avatarOpacity,
                transform: [{ scale: avatarScale }],
              }]}
            >
              <View style={s.glowRing1} />
              <View style={s.glowRing2} />
              <Image
                source={require('@/assets/ai/max-avatar.png')}
                style={s.avatar}
                resizeMode="contain"
              />
            </Animated.View>

            {/* ── Title ── */}
            <Text style={s.title}>Conheça a Max</Text>
            <Text style={s.subtitle}>Assistente de Inteligência Artificial</Text>

            {/* ── Typewriter ── */}
            <View style={s.terminalBox}>
              <View style={s.terminalHeader}>
                <View style={[s.terminalDot, { backgroundColor: '#FF5F57' }]} />
                <View style={[s.terminalDot, { backgroundColor: '#FEBC2E' }]} />
                <View style={[s.terminalDot, { backgroundColor: '#28C840' }]} />
                <Text style={s.terminalTitle}>max@strive ~ assistente-ia</Text>
              </View>
              <Text style={s.terminalText}>
                {typedText}
                {!typingDone && (
                  <Animated.Text style={[s.cursor, { opacity: cursorAnim }]}>█</Animated.Text>
                )}
              </Text>
            </View>

            {/* ── Steps — apenas os revelados são montados no layout ── */}
            {shownSteps > 0 && (
              <View style={s.stepsList}>
                <Text style={s.stepsTitle}>Como usar</Text>
                {STEPS.map((step, idx) => {
                  if (idx >= shownSteps) return null;
                  return (
                    <Animated.View
                      key={idx}
                      style={[s.stepRow, {
                        opacity: stepAnims[idx],
                        transform: [{
                          translateX: stepAnims[idx].interpolate({
                            inputRange: [0, 1], outputRange: [18, 0],
                          }),
                        }],
                      }]}
                    >
                      <View style={s.stepNumber}>
                        <Text style={s.stepNumberText}>{idx + 1}</Text>
                      </View>
                      <View style={s.stepIconWrap}>
                        <Ionicons name={step.icon} size={15} color={MAX_COLOR} />
                      </View>
                      <Text style={s.stepLabel}>{step.label}</Text>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* ── Actions ── */}
          <View style={s.actions}>
            <TouchableOpacity
              style={s.btnNever}
              onPress={handleNeverAgain}
              activeOpacity={0.75}
            >
              <Ionicons name="eye-off-outline" size={13} color={Colors.textSecondary} />
              <Text style={s.btnNeverText}>Não mostrar mais</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.btnExplore}
              onPress={handleDismissSession}
              activeOpacity={0.85}
            >
              <Text style={s.btnExploreText}>Explorar agora</Text>
              <Ionicons name="arrow-forward-outline" size={15} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxHeight: '92%',
    flexDirection: 'column',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: `${MAX_COLOR}40`,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 22,
    paddingBottom: 4,
    alignItems: 'center',
  },

  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${MAX_COLOR}18`,
    borderWidth: 1,
    borderColor: `${MAX_COLOR}30`,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 18,
  },
  badgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    color: MAX_COLOR,
    letterSpacing: 1.5,
  },

  // Avatar
  avatarContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  glowRing1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${MAX_COLOR}18`,
    borderWidth: 1,
    borderColor: `${MAX_COLOR}30`,
  },
  glowRing2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${MAX_COLOR}22`,
  },
  avatar: {
    width: 88,
    height: 88,
    zIndex: 1,
  },

  // Title
  title: {
    fontFamily: FontFamily.display,
    fontSize: 26,
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: MAX_COLOR,
    textAlign: 'center',
    letterSpacing: 1.5,
    marginTop: 4,
    marginBottom: 18,
    textTransform: 'uppercase',
  },

  // Terminal box
  terminalBox: {
    width: '100%',
    backgroundColor: Colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${MAX_COLOR}25`,
    overflow: 'hidden',
    marginBottom: 20,
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: `${MAX_COLOR}15`,
    backgroundColor: `${MAX_COLOR}08`,
  },
  terminalDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  terminalTitle: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: Colors.textSecondary,
    marginLeft: 6,
    opacity: 0.6,
  },
  terminalText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 22,
    padding: 14,
  },
  cursor: {
    color: MAX_COLOR,
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
  },

  // Steps
  stepsList: {
    width: '100%',
    marginBottom: 8,
  },
  stepsTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: `${MAX_COLOR}20`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumberText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: MAX_COLOR,
  },
  stepIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: `${MAX_COLOR}12`,
    borderWidth: 1,
    borderColor: `${MAX_COLOR}25`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepLabel: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  btnNever: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnNeverText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  btnExplore: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: MAX_COLOR,
  },
  btnExploreText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.sm,
    color: '#fff',
  },
});
