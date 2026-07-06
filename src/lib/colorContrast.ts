// Decide se um texto deve ser preto ou branco em cima de um fundo hex,
// usando a fórmula de brilho percebido (YIQ) — mais confiável que listas
// fixas de cores "claras conhecidas", que falham para qualquer tom novo
// (ex: um amarelo customizado fora da lista).
export function getReadableTextColor(hexBackground: string): '#000000' | '#FFFFFF' {
  const hex = hexBackground.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return '#FFFFFF';

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;

  return yiq >= 128 ? '#000000' : '#FFFFFF';
}

// override: valor salvo pelo tenant ('#000000' | '#FFFFFF'), ou null/undefined
// para cálculo automático.
export function resolveTextColor(
  hexBackground: string,
  override?: string | null,
): '#000000' | '#FFFFFF' {
  if (override === '#000000' || override === '#FFFFFF') return override;
  return getReadableTextColor(hexBackground);
}
