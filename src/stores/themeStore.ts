import { create } from 'zustand';
import { Colors } from '@/theme/colors';
import { getReadableTextColor } from '@/lib/colorContrast';

// Papel efetivo do usuário dentro do tenant ativo, quando é uma academia —
// vem de tenant_members.role (owner/admin/personal). Para tenant autônomo,
// ou enquanto ainda não foi resolvido, fica null (profiles.role já basta).
export type EffectiveRole = 'owner' | 'admin' | 'personal' | null;

interface ThemeState {
  primaryColor: string;
  accentTextColor: string;
  // Cor de texto legível sobre um fundo primaryColor (badges, topo, botões) —
  // já resolvida (auto por contraste, ou override manual do tenant).
  primaryTextColor: string;
  tenantName: string;
  appName: string;
  tenantLogoUrl: string | null;
  tenantCref: string | null;
  // 'autonomo' | 'academia' — null enquanto não carregado ainda.
  tenantType: string | null;
  effectiveRole: EffectiveRole;
  setPrimaryColor: (color: string) => void;
  setAccentTextColor: (color: string) => void;
  setPrimaryTextColor: (color: string) => void;
  setTenant: (name: string, appName: string, logoUrl: string | null, cref?: string | null) => void;
  setTenantType: (tenantType: string | null) => void;
  setEffectiveRole: (role: EffectiveRole) => void;
  resetTenant: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  primaryColor: Colors.primary,
  accentTextColor: '#FFFFFF',
  primaryTextColor: getReadableTextColor(Colors.primary),
  tenantName: 'Strive Personal',
  appName: 'Strive Personal',
  tenantLogoUrl: null,
  tenantCref: null,
  tenantType: null,
  effectiveRole: null,
  setPrimaryColor: (color) => set({ primaryColor: color }),
  setAccentTextColor: (color) => set({ accentTextColor: color }),
  setPrimaryTextColor: (color) => set({ primaryTextColor: color }),
  setTenant: (tenantName, appName, tenantLogoUrl, cref = null) =>
    set({ tenantName, appName, tenantLogoUrl, tenantCref: cref ?? null }),
  setTenantType: (tenantType) => set({ tenantType }),
  setEffectiveRole: (effectiveRole) => set({ effectiveRole }),
  resetTenant: () =>
    set({
      primaryColor: Colors.primary,
      accentTextColor: '#FFFFFF',
      primaryTextColor: getReadableTextColor(Colors.primary),
      tenantName: 'Strive Personal',
      appName: 'Strive Personal',
      tenantLogoUrl: null,
      tenantCref: null,
      tenantType: null,
      effectiveRole: null,
    }),
}));
