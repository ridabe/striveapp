import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';

export function useTenant() {
  const { user } = useAuthStore();
  const { primaryColor, tenantName, tenantLogoUrl, setTenant, setPrimaryColor } = useThemeStore();

  useEffect(() => {
    if (!user) return;

    async function loadTenant() {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user!.id)
        .single();

      if (!profile?.tenant_id) return;

      const { data: tenant } = await supabase
        .from('tenants')
        .select('business_name, logo_url, primary_color')
        .eq('id', profile.tenant_id)
        .single();

      if (tenant) {
        setTenant(tenant.business_name ?? 'Strive Personal', tenant.logo_url ?? null);
        if (tenant.primary_color) setPrimaryColor(tenant.primary_color);
      }
    }

    loadTenant();
  }, [user]);

  return { primaryColor, tenantName, tenantLogoUrl };
}
