import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { resolveTextColor } from '@/lib/colorContrast';
import { useStudent } from './useStudent';

export function useTenant() {
  const { selectedStudent } = useStudent();
  const { profile } = useAuthStore();
  const {
    primaryColor, accentTextColor, primaryTextColor, tenantName, appName, tenantLogoUrl,
    setTenant, setPrimaryColor, setAccentTextColor, setPrimaryTextColor,
  } = useThemeStore();

  // Aluno: usa o tenant do registro de aluno selecionado.
  // Admin/personal: usa o tenant_id do próprio perfil (não tem registro em students).
  const tenantId = selectedStudent?.tenant_id ?? profile?.tenant_id;

  async function loadTenant(tid: string) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, app_name, logo_url, primary_color, accent_text_color, on_primary_text_color, cref')
      .eq('id', tid)
      .single();

    if (tenant) {
      const displayName = tenant.business_name ?? 'Strive Personal';
      const displayApp  = tenant.app_name ?? displayName;
      setTenant(displayName, displayApp, tenant.logo_url ?? null, (tenant as any).cref ?? null);
      if (tenant.primary_color) setPrimaryColor(tenant.primary_color);
      setAccentTextColor((tenant as any).accent_text_color ?? '#FFFFFF');
      setPrimaryTextColor(resolveTextColor(
        tenant.primary_color ?? '#E8FF47',
        (tenant as any).on_primary_text_color ?? null,
      ));
    }
  }

  useEffect(() => {
    if (!tenantId) return;

    loadTenant(tenantId);

    // Nome único por execução do effect evita conflito se o hook for
    // montado em paralelo em dois componentes com o mesmo tenantId.
    const channelName = `tenant:${tenantId}:${Date.now()}`;
    const channel = supabase
      .channel(channelName)
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

  return { primaryColor, accentTextColor, primaryTextColor, tenantName, appName, tenantLogoUrl };
}
