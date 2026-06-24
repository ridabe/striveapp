import { useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Session } from '@supabase/supabase-js';

const PROFILE_FETCH_TIMEOUT_MS = 6_000;
const INIT_TIMEOUT_MS          = 10_000;

async function fetchAndSetProfile(session: Session | null, setProfile: (p: any) => void) {
  if (!session?.user) {
    setProfile(null);
    return;
  }
  try {
    // Race contra timeout: evita spinner eterno se o fetch do perfil travar na rede
    const result = await Promise.race([
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('timeout') }), PROFILE_FETCH_TIMEOUT_MS)
      ),
    ]);
    setProfile(result.data ?? null);
  } catch {
    setProfile(null);
  }
}

export function useAuth() {
  const { session, user, profile, isLoading, setSession, setProfile, setLoading } = useAuthStore();

  useEffect(() => {
    // Fallback: garante que o loading sempre termina, mesmo que getSession() trave
    const initFallback = setTimeout(() => {
      setSession(null);
      setProfile(null);
      setLoading(false);
    }, INIT_TIMEOUT_MS);

    // getSession() é obrigatório para disparar a inicialização do Supabase auth.
    // onAuthStateChange sozinho não garante que a inicialização ocorra — sem getSession()
    // o INITIAL_SESSION pode nunca disparar, deixando isLoading=true eternamente.
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        setSession(session);
        await fetchAndSetProfile(session, setProfile);
      })
      .catch(() => setSession(null))
      .finally(() => {
        clearTimeout(initFallback);
        setLoading(false);
      });

    // onAuthStateChange lida com mudanças após a inicialização: login, logout, token refresh.
    // INITIAL_SESSION é ignorado aqui — já tratado pelo getSession() acima.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT') {
        supabase.removeAllChannels();
      }
      setSession(session);
      await fetchAndSetProfile(session, setProfile);
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      clearTimeout(initFallback);
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  return { session, user, profile, isLoading };
}
