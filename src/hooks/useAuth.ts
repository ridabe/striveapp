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
    let mounted = true;

    async function initSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(session);
        await fetchAndSetProfile(session, setProfile);
      } catch {
        if (!mounted) return;
        setSession(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initSession();

    // Revalida a sessão toda vez que o app volta ao foreground,
    // evitando o spinner infinito quando o token foi renovado em background.
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        // Remove todos os canais realtime antes de trocar de sessão,
        // evitando o erro "cannot add postgres_changes callbacks" ao logar com outro usuário.
        await supabase.removeAllChannels();
      }
      if (!mounted) return;
      setSession(session);
      await fetchAndSetProfile(session, setProfile);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  return { session, user, profile, isLoading };
}
