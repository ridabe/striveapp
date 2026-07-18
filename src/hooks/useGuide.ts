import { useEffect, useRef, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { GuideKey } from '@/lib/guides';

const DISMISSED_PREFIX = 'guide_dismissed_';

function dismissKey(guideKey: GuideKey, userId: string) {
  return `${DISMISSED_PREFIX}${guideKey}_${userId}`;
}

/**
 * Controla exibição/persistência de um guia (ver src/lib/guides.ts).
 * Abre sozinho na primeira visita à tela (a menos que o usuário já tenha
 * marcado "não mostrar mais"), e expõe `open()` para reabrir via um link
 * na própria tela.
 */
export function useGuide(guideKey: GuideKey, userId: string | null | undefined) {
  const [visible, setVisible] = useState(false);
  const initedRef = useRef(false);

  useEffect(() => {
    if (initedRef.current || !userId) return;
    initedRef.current = true;
    (async () => {
      const dismissed = await SecureStore.getItemAsync(dismissKey(guideKey, userId));
      if (!dismissed) setVisible(true);
    })();
  }, [guideKey, userId]);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  const dismissForever = useCallback(async () => {
    if (userId) await SecureStore.setItemAsync(dismissKey(guideKey, userId), '1');
    setVisible(false);
  }, [guideKey, userId]);

  return { visible, open, close, dismissForever };
}
