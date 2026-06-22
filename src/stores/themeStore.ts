import { create } from 'zustand';
import { Colors } from '@/theme/colors';

interface ThemeState {
  primaryColor: string;
  tenantName: string;
  tenantLogoUrl: string | null;
  setPrimaryColor: (color: string) => void;
  setTenant: (name: string, logoUrl: string | null) => void;
  resetTenant: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  primaryColor: Colors.primary,
  tenantName: 'Strive Personal',
  tenantLogoUrl: null,
  setPrimaryColor: (color) => set({ primaryColor: color }),
  setTenant: (tenantName, tenantLogoUrl) => set({ tenantName, tenantLogoUrl }),
  resetTenant: () =>
    set({ primaryColor: Colors.primary, tenantName: 'Strive Personal', tenantLogoUrl: null }),
}));
