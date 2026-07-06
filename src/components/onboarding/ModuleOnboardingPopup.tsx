import { useEffect, useRef, useState } from 'react';
import {
  Animated, Modal, Pressable, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { useThemeStore } from '@/stores/themeStore';
import { MaxAvatar, MAX_COLOR } from '@/components/ai/MaxAvatar';
import type { ModuleSlug } from '@/lib/modules';
import {
  getOnboardingLoop,
  type ModuleOnboardingItem,
  type OnboardingRole,
} from '@/lib/moduleOnboarding';

// Chaves persistidas por perfil + usuário (adaptação mobile do localStorage web → SecureStore).
const DISMISSED_PREFIX = 'module_onboarding_dismissed_forever_';
const INDEX_PREFIX     = 'module_onboarding_index_';
// Reutiliza a flag do onboarding dedicado do Max para coordenar a exibição.
const MAX_SEEN_PREFIX  = 'max_onboarding_seen_';

// Falas de abertura do Max — ele é o garoto-propaganda apresentando cada módulo.
const MAX_OPENERS = [
  'Oi! Deixa eu te mostrar uma parada boa 👇',
  'Bora conhecer mais um recurso? 💪',
  'Esse aqui vai te ajudar demais 👇',
  'Olha só o que dá pra fazer por aqui 👀',
  'Tenho uma dica pra você hoje ✨',
  'Vem que eu te explico rapidinho 🚀',
];

interface Props {
  userId: string | null;
  role: OnboardingRole;
  /** Slugs habilitados no tenant (fonte: modulesStore). */
  enabledSlugs: ModuleSlug[];
  /** modulesStore.isLoaded — evita rodar o loop antes de saber os módulos. */
  modulesLoaded: boolean;
  /**
   * Quando true (dashboard do personal com IA habilitada), o loop genérico
   * espera o onboarding dedicado do Max ser dispensado para sempre antes de
   * assumir a tela — evitando dois modais empilhados no mesmo login.
   */
  deferUntilMaxSeen?: boolean;
}

export function ModuleOnboardingPopup({
  userId,
  role,
  enabledSlugs,
  modulesLoaded,
  deferUntilMaxSeen = false,
}: Props) {
  const { primaryColor, primaryTextColor } = useThemeStore();
  const accent = primaryColor || Colors.primary;

  const [visible, setVisible] = useState(false);
  const [item, setItem]       = useState<ModuleOnboardingItem | null>(null);
  const [intro, setIntro]     = useState(MAX_OPENERS[0]);

  const nextIndexRef = useRef(0);
  const initedRef    = useRef(false);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale   = useRef(new Animated.Value(0.94)).current;

  // ── Decide, uma única vez por montagem, se e qual módulo mostrar ───────────
  useEffect(() => {
    if (initedRef.current) return;
    if (!userId || !modulesLoaded) return;
    initedRef.current = true;

    (async () => {
      // Desativado para sempre → nunca renderiza.
      const dismissed = await SecureStore.getItemAsync(DISMISSED_PREFIX + role + '_' + userId);
      if (dismissed) return;

      // Coordenação com o onboarding dedicado do Max (só no dashboard do personal).
      if (deferUntilMaxSeen) {
        const maxSeen = await SecureStore.getItemAsync(MAX_SEEN_PREFIX + userId);
        if (!maxSeen) return; // deixa o Max ter a tela primeiro
      }

      // Loop do perfil filtrado pelos módulos habilitados do tenant.
      const loop = getOnboardingLoop(role).filter((m) => enabledSlugs.includes(m.slug));
      if (loop.length === 0) return;

      const rawIndex = parseInt(
        (await SecureStore.getItemAsync(INDEX_PREFIX + role + '_' + userId)) ?? '0',
        10,
      );
      const idx = Number.isFinite(rawIndex) ? rawIndex : 0;
      const pos = ((idx % loop.length) + loop.length) % loop.length;

      setItem(loop[pos]);
      setIntro(MAX_OPENERS[pos % MAX_OPENERS.length]);
      nextIndexRef.current = pos + 1; // wraparound aplicado na próxima leitura
      setVisible(true);
    })();
  }, [userId, role, modulesLoaded, enabledSlugs, deferUntilMaxSeen]);

  // ── Animação de entrada ────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  // ── Fechar (X, "Entendi" ou toque fora) → avança o loop ────────────────────
  async function advanceAndClose() {
    if (userId) {
      await SecureStore.setItemAsync(
        INDEX_PREFIX + role + '_' + userId,
        String(nextIndexRef.current),
      );
    }
    setVisible(false);
  }

  // ── "Não quero mais ver isso" → desliga o recurso definitivamente ──────────
  async function dismissForever() {
    if (userId) {
      await SecureStore.setItemAsync(DISMISSED_PREFIX + role + '_' + userId, '1');
    }
    setVisible(false);
  }

  if (!visible || !item) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={advanceAndClose}>
      <Pressable style={s.overlay} onPress={advanceAndClose}>
        <Animated.View
          style={[s.card, { borderColor: `${accent}40`, opacity: cardOpacity, transform: [{ scale: cardScale }] }]}
        >
          {/* Pressable interno impede que toques no card fechem o modal. */}
          <Pressable style={s.cardInner}>
            {/* ── Close (X) ── */}
            <TouchableOpacity
              style={s.closeBtn}
              onPress={advanceAndClose}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>

            <ScrollView
              style={s.scrollArea}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.scrollContent}
              bounces={false}
            >
              {/* ── Apresentador: o Max (garoto-propaganda), cabeçalho compacto ── */}
              <View style={s.presenterRow}>
                <MaxAvatar variant="happy" size="md" />
                <View style={s.presenterInfo}>
                  <View style={[s.badge, { backgroundColor: `${MAX_COLOR}18`, borderColor: `${MAX_COLOR}30` }]}>
                    <Ionicons name="sparkles" size={9} color={MAX_COLOR} />
                    <Text style={[s.badgeText, { color: MAX_COLOR }]}>MAX STRIVE APRESENTA</Text>
                  </View>
                  <Text style={s.maxName}>Max Strive</Text>
                  <Text style={s.maxRole}>Seu guia aqui no app</Text>
                </View>
              </View>

              {/* ── Fala do Max (balão de conversa) ── */}
              <View style={[s.bubble, { borderColor: `${MAX_COLOR}30` }]}>
                <Text style={s.bubbleOpener}>{intro}</Text>

                {/* Chip do módulo em foco */}
                <View style={[s.moduleChip, { backgroundColor: `${accent}12`, borderColor: `${accent}25` }]}>
                  <View style={[s.moduleChipIcon, { backgroundColor: `${accent}18` }]}>
                    <Ionicons name={item.icon as any} size={16} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.moduleChipTitle}>{item.title}</Text>
                    <Text style={[s.moduleChipCategory, { color: accent }]}>{item.category}</Text>
                  </View>
                </View>

                {/* Descrição — o Max falando com o usuário */}
                <Text style={s.bubbleText}>{item.description}</Text>
              </View>

              {/* ── Como usar ── */}
              <View style={[s.howToBox, { borderColor: `${accent}22` }]}>
                <View style={s.howToHeader}>
                  <Ionicons name="bulb-outline" size={13} color={accent} />
                  <Text style={[s.howToTitle, { color: accent }]}>COMO USAR — DICA DO MAX</Text>
                </View>
                <Text style={s.howToText}>{item.howTo}</Text>
              </View>
            </ScrollView>

            {/* ── Ações ── */}
            <View style={s.actions}>
              <TouchableOpacity
                style={s.btnNever}
                onPress={dismissForever}
                activeOpacity={0.75}
              >
                <Ionicons name="eye-off-outline" size={13} color={Colors.textSecondary} />
                <Text style={s.btnNeverText}>Não quero mais ver isso</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnOk, { backgroundColor: accent }]}
                onPress={advanceAndClose}
                activeOpacity={0.85}
              >
                <Text style={[s.btnOkText, { color: primaryTextColor }]}>Entendi</Text>
                <Ionicons name="arrow-forward" size={15} color={primaryTextColor} />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
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
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  card: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    // Sombra só no overlay do modal (design system).
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  cardInner: {
    flexShrink: 1,
  },
  scrollArea: {
    flexShrink: 1,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 18,
    paddingTop: 20,
    alignItems: 'center',
  },

  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  badgeText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 1.2,
  },

  // Max — apresentador (linha horizontal compacta)
  presenterRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  presenterInfo: {
    flex: 1,
  },
  maxName: {
    fontFamily: FontFamily.display,
    fontSize: 17,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  maxRole: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.xs,
    color: MAX_COLOR,
    letterSpacing: 0.3,
    marginTop: 2,
  },

  // Balão de fala do Max
  bubble: {
    width: '100%',
    backgroundColor: Colors.bg,
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    marginBottom: 12,
    gap: 10,
  },
  bubbleOpener: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },

  // Chip do módulo em foco
  moduleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 9,
  },
  moduleChipIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleChipTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  moduleChipCategory: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: 1,
  },

  // Texto do balão (descrição — o Max falando)
  bubbleText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 21,
  },

  // How to
  howToBox: {
    width: '100%',
    backgroundColor: Colors.bg,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  howToHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  howToTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  howToText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
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
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnNeverText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  btnOk: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnOkText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.sm,
  },
});
