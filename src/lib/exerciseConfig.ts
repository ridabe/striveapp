export const MUSCLE_GROUPS = [
  'Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Antebraços',
  'Core / Abdômen', 'Glúteos', 'Quadríceps', 'Posterior de Coxa',
  'Panturrilha', 'Corpo Inteiro', 'Cardio / Funcional',
] as const;

export type MuscleGroup = typeof MUSCLE_GROUPS[number];

const MUSCLE_COLORS: Record<string, string> = {
  'Peito': '#EF4444',
  'Costas': '#8B5CF6',
  'Ombros': '#F59E0B',
  'Bíceps': '#10B981',
  'Tríceps': '#06B6D4',
  'Antebraços': '#84CC16',
  'Core / Abdômen': '#F43F5E',
  'Glúteos': '#EC4899',
  'Quadríceps': '#3B82F6',
  'Posterior de Coxa': '#6366F1',
  'Panturrilha': '#14B8A6',
  'Corpo Inteiro': '#F97316',
  'Cardio / Funcional': '#64748B',
};

export function muscleColor(group: string): string {
  return MUSCLE_COLORS[group] ?? '#64748B';
}

export const LOAD_TYPES = [
  { key: 'bodyweight', label: 'Peso corporal' },
  { key: 'dumbbell',   label: 'Halter' },
  { key: 'barbell',    label: 'Barra' },
  { key: 'elastic',    label: 'Elástico' },
  { key: 'machine',    label: 'Máquina' },
  { key: 'cable',      label: 'Cabo' },
  { key: 'mixed',      label: 'Misto' },
] as const;

export const COUNT_TYPES = [
  { key: 'reps', label: 'Repetições' },
  { key: 'time', label: 'Tempo' },
  { key: 'both', label: 'Reps + Tempo' },
] as const;

export const PLAN_GOALS = [
  'Hipertrofia', 'Emagrecimento', 'Resistência',
  'Força', 'Condicionamento', 'Reabilitação',
] as const;

export const EXTRA_CATEGORIES = [
  { key: 'aquecimento', label: 'Aquecimento' },
  { key: 'hiit',        label: 'HIIT' },
  { key: 'mobilidade',  label: 'Mobilidade' },
  { key: 'cardio',      label: 'Cardio' },
  { key: 'desafio',     label: 'Desafio' },
  { key: 'forca',       label: 'Força' },
  { key: 'outros',      label: 'Outros' },
] as const;

export const GOAL_COLORS: Record<string, string> = {
  'Hipertrofia': '#8B5CF6',
  'Emagrecimento': '#EF4444',
  'Resistência': '#10B981',
  'Força': '#F59E0B',
  'Condicionamento': '#06B6D4',
  'Reabilitação': '#EC4899',
};

export const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

export function loadTypeLabel(key: string): string {
  return LOAD_TYPES.find(l => l.key === key)?.label ?? key;
}

export function countTypeLabel(key: string): string {
  return COUNT_TYPES.find(c => c.key === key)?.label ?? key;
}

export function extraCategoryLabel(key: string): string {
  return EXTRA_CATEGORIES.find(c => c.key === key)?.label ?? key;
}
