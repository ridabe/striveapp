export interface ComboMember {
  itemId: string;
  comboGroupId: string | null;
}

export interface ComboGroup<T extends ComboMember> {
  comboId: string | null;
  isCombo: boolean;
  items: T[];
}

/** Groups a flat, ordered item list by comboGroupId. Items without a group become solo groups of 1. */
export function groupByCombo<T extends ComboMember>(items: T[]): ComboGroup<T>[] {
  const groups: ComboGroup<T>[] = [];
  const seen = new Map<string, ComboGroup<T>>();

  for (const item of items) {
    if (!item.comboGroupId) {
      groups.push({ comboId: null, isCombo: false, items: [item] });
    } else {
      const existing = seen.get(item.comboGroupId);
      if (existing) {
        existing.items.push(item);
        existing.isCombo = true;
      } else {
        const g: ComboGroup<T> = { comboId: item.comboGroupId, isCombo: false, items: [item] };
        seen.set(item.comboGroupId, g);
        groups.push(g);
      }
    }
  }
  return groups;
}

export function comboTypeLabel(count: number): string {
  if (count >= 4) return 'Série Combinada';
  if (count === 3) return 'Tri-Série';
  if (count === 2) return 'Bi-Série';
  return '';
}

/** Precisa bater com o CHECK constraint de combo_type em workout_items/extra_workout_items. */
export function comboTypeKey(count: number): string {
  if (count >= 4) return 'circuit';
  if (count === 3) return 'triset';
  return 'biset';
}
