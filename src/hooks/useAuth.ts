import { useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Session } from '@supabase/supabase-js';

async function fetchAndSetProfile(session: Session | null, setProfile: (p: any) => void) {
  if (!session?.user) {
    setProfile(null);
    return;
  }
  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    setProfile(data ?? null);
  } catch {
    setProfile(null);
  }
}

export function useAuth() {
  const { session, user, profile, isLoading, setSession, setProfile, setLoading } = useAuthStore();

  useEffect(() => {
    // onAuthStateChange é a única fonte de verdade para o estado de autenticação.
    // O evento INITIAL_SESSION dispara uma vez ao registrar o listener, com a sessão
    // armazenada (ou null), eliminando a race condition com initSession() paralelo.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        // Fire-and-forget: não aguarda para não bloquear a atualização de estado
        // (await aqui causava loop quando o token expirava e o refresh falhava).
        supabase.removeAllChannels();
      }

      setSession(session);

      try {
        await fetchAndSetProfile(session, setProfile);
      } finally {
        // Resolve o isLoading somente após o INITIAL_SESSION ser processado.
        // Usar finally garante que o loading sempre termina mesmo se o fetch falhar.
        if (event === 'INITIAL_SESSION') {
          setLoading(false);
        }
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  return { session, user, profile, isLoading };
}
