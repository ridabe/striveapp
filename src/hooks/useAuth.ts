import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Session } from '@supabase/supabase-js';

async function fetchAndSetProfile(session: Session | null, setProfile: (p: any) => void) {
  if (!session?.user) {
    setProfile(null);
    return;
  }
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  setProfile(data ?? null);
}

export function useAuth() {
  const { session, user, profile, isLoading, setSession, setProfile, setLoading } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      await fetchAndSetProfile(session, setProfile);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        // Remove todos os canais realtime antes de trocar de sessão,
        // evitando o erro "cannot add postgres_changes callbacks" ao logar com outro usuário.
        await supabase.removeAllChannels();
      }
      setSession(session);
      await fetchAndSetProfile(session, setProfile);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, user, profile, isLoading };
}
