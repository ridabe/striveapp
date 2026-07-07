import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export type ActiveOrgOption = {
  tenantId: string;
  role: 'owner' | 'admin' | 'personal';
  businessName: string;
  logoUrl: string | null;
  primaryColor: string | null;
};

// Espelha useStudent.ts (múltiplos cadastros de aluno), mas para vínculos de
// personal/admin/owner em tenant_members — um mesmo usuário pode ter mais de
// um vínculo ativo (ex: personal que atua em 2 academias diferentes). A
// "organização ativa" é literalmente `profiles.tenant_id`, a mesma coluna
// usada pelo web (ver selectActiveOrg em src/app/actions/personal-tenant.ts).
export function useActiveOrg() {
  const { profile, setProfile } = useAuthStore();
  const [activeOrgs, setActiveOrgs] = useState<ActiveOrgOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!profile?.id) {
      setActiveOrgs([]);
      setLoading(false);
      return;
    }

    async function loadActiveOrgs() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('tenant_members')
          .select('tenant_id, role, tenants(business_name, logo_url, primary_color)')
          .eq('user_id', profile!.id)
          .eq('status', 'active');

        if (error) throw error;
        if (!isMounted) return;

        const options: ActiveOrgOption[] = (data ?? []).map((row: any) => ({
          tenantId: row.tenant_id,
          role: row.role,
          businessName: row.tenants?.business_name ?? 'Organização',
          logoUrl: row.tenants?.logo_url ?? null,
          primaryColor: row.tenants?.primary_color ?? null,
        }));

        setActiveOrgs(options);
      } catch (error) {
        console.error('Error fetching active orgs:', error);
        if (isMounted) setActiveOrgs([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadActiveOrgs();

    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  const hasMultipleActiveOrgs = activeOrgs.length > 1;
  const currentOrgIsActive = activeOrgs.some((o) => o.tenantId === profile?.tenant_id);

  // Troca a organização ativa — só permite trocar para um tenant onde o
  // usuário realmente tem vínculo ativo em tenant_members (evita forçar um
  // tenant_id arbitrário). Espelha selectActiveOrg do web.
  async function selectOrg(tenantId: string): Promise<{ success?: boolean; error?: string }> {
    if (!profile?.id) return { error: 'Não autenticado' };

    const { data: membership, error: membershipError } = await supabase
      .from('tenant_members')
      .select('id')
      .eq('user_id', profile.id)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .maybeSingle();

    if (membershipError) return { error: membershipError.message };
    if (!membership) return { error: 'Vínculo não encontrado ou inativo.' };

    const { error } = await supabase
      .from('profiles')
      .update({ tenant_id: tenantId })
      .eq('id', profile.id);

    if (error) return { error: error.message };

    // Atualiza o profile local — useTenant() reage à mudança de tenant_id e
    // recarrega branding/effectiveRole automaticamente.
    setProfile({ ...profile, tenant_id: tenantId });
    return { success: true };
  }

  return { activeOrgs, hasMultipleActiveOrgs, currentOrgIsActive, loading, selectOrg };
}
