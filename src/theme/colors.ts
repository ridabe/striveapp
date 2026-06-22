export const Colors = {
  bg: '#0E0E1A',
  surface: '#1A1A2E',
  border: '#2A2A45',
  primary: '#E8FF47',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0C3',

  success: '#4ADE80',
  error: '#F87171',
  warning: '#FBBF24',
} as const;

export type ColorKey = keyof typeof Colors;
