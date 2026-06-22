import { create } from 'zustand';
import type { ModuleSlug } from '@/lib/modules';

interface ModulesState {
  enabledSlugs: ModuleSlug[];
  isLoaded: boolean;
  setModules: (slugs: ModuleSlug[]) => void;
  reset: () => void;
  has: (slug: ModuleSlug) => boolean;
}

export const useModulesStore = create<ModulesState>((set, get) => ({
  enabledSlugs: [],
  isLoaded: false,
  setModules: (enabledSlugs) => set({ enabledSlugs, isLoaded: true }),
  reset: () => set({ enabledSlugs: [], isLoaded: false }),
  has: (slug) => get().enabledSlugs.includes(slug),
}));
