import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';

export function useTenant() {
  const { profile } = useAuthStore();
  const { primaryColor, tenantName, appName, tenantLogoUrl, setTenant, setPrimaryColor } = useThemeStore();

  const tenantId = profile?.tenant_id;

  async function loadTenant(tid: string) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, app_name, logo_url, primary_color')
      .eq('id', tid)
      .single();

    if (tenant) {
      const displayName = tenant.business_name ?? 'Strive Personal';
      const displayApp  = tenant.app_name ?? displayName;
      setTenant(displayName, displayApp, tenant.logo_url ?? null);
      if (tenant.primary_color) setPrimaryColor(tenant.primary_color);
    }
  }

  useEffect(() => {
    if (!tenantId) return;

    loadTenant(tenantId);

    // Realtime: reflete mudanças de logo/cor instantaneamente
    const channel = supabase
      .channel(`tenant:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenants',
          filter: `id=eq.${tenantId}`,
        },
        () => loadTenant(tenantId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  return { primaryColor, tenantName, appName, tenantLogoUrl };
}
