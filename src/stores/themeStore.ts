import { create } from 'zustand';
import { Colors } from '@/theme/colors';
import { getReadableTextColor } from '@/lib/colorContrast';

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
  setPrimaryColor: (color: string) => void;
  setAccentTextColor: (color: string) => void;
  setPrimaryTextColor: (color: string) => void;
  setTenant: (name: string, appName: string, logoUrl: string | null, cref?: string | null) => void;
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
  setPrimaryColor: (color) => set({ primaryColor: color }),
  setAccentTextColor: (color) => set({ accentTextColor: color }),
  setPrimaryTextColor: (color) => set({ primaryTextColor: color }),
  setTenant: (tenantName, appName, tenantLogoUrl, cref = null) =>
    set({ tenantName, appName, tenantLogoUrl, tenantCref: cref ?? null }),
  resetTenant: () =>
    set({
      primaryColor: Colors.primary,
      accentTextColor: '#FFFFFF',
      primaryTextColor: getReadableTextColor(Colors.primary),
      tenantName: 'Strive Personal',
      appName: 'Strive Personal',
      tenantLogoUrl: null,
      tenantCref: null,
    }),
}));
