import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useModulesStore } from '@/stores/modulesStore';
import type { ModuleSlug } from '@/lib/modules';

export function useModules() {
  const { profile } = useAuthStore();
  const { setModules, reset, has, enabledSlugs, isLoaded } = useModulesStore();

  const tenantId = profile?.tenant_id;

  async function fetchModules(tid: string) {
    const { data } = await supabase
      .from('tenant_modules')
      .select('enabled, system_modules(slug, available, status)')
      .eq('tenant_id', tid)
      .eq('enabled', true);

    const slugs = (data ?? [])
      .filter((row: any) =>
        row.system_modules?.available === true &&
        row.system_modules?.status === 'active'
      )
      .map((row: any) => row.system_modules.slug as ModuleSlug);

    setModules(slugs);
  }

  useEffect(() => {
    if (!tenantId) {
      reset();
      return;
    }

    fetchModules(tenantId);

    // Nome único por execução do effect — evita conflito de canal duplicado.
    const channel = supabase
      .channel(`modules:${tenantId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenant_modules',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => fetchModules(tenantId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  return { enabledSlugs, isLoaded, has };
}
