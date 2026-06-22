import { create } from 'zustand';
import { Colors } from '@/theme/colors';

interface ThemeState {
  primaryColor: string;
  tenantName: string;
  appName: string;
  tenantLogoUrl: string | null;
  setPrimaryColor: (color: string) => void;
  setTenant: (name: string, appName: string, logoUrl: string | null) => void;
  resetTenant: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  primaryColor: Colors.primary,
  tenantName: 'Strive Personal',
  appName: 'Strive Personal',
  tenantLogoUrl: null,
  setPrimaryColor: (color) => set({ primaryColor: color }),
  setTenant: (tenantName, appName, tenantLogoUrl) => set({ tenantName, appName, tenantLogoUrl }),
  resetTenant: () =>
    set({
      primaryColor: Colors.primary,
      tenantName: 'Strive Personal',
      appName: 'Strive Personal',
      tenantLogoUrl: null,
    }),
}));
