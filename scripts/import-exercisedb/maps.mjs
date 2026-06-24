// ============================================================================
// Mapeamentos EN -> PT-BR para importação da ExerciseDB
// Alinhado com src/lib/exerciseConfig.ts (MUSCLE_GROUPS e LOAD_TYPES)
// ============================================================================

// Grupos musculares válidos no app (devem bater 1:1 com MUSCLE_GROUPS)
export const VALID_MUSCLE_GROUPS = [
  'Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Antebraços',
  'Core / Abdômen', 'Glúteos', 'Quadríceps', 'Posterior de Coxa',
  'Panturrilha', 'Corpo Inteiro', 'Cardio / Funcional',
];

// Tipos de carga válidos no app (key de LOAD_TYPES)
export const VALID_LOAD_TYPES = [
  'bodyweight', 'dumbbell', 'barbell', 'elastic', 'machine', 'cable', 'mixed',
];

// ExerciseDB `target` (músculo primário) -> grupo muscular do app.
// É o mapeamento PRINCIPAL para definir muscle_group.
export const TARGET_TO_GROUP = {
  'abductors': 'Glúteos',
  'adductors': 'Quadríceps',
  'abs': 'Core / Abdômen',
  'biceps': 'Bíceps',
  'calves': 'Panturrilha',
  'cardiovascular system': 'Cardio / Funcional',
  'delts': 'Ombros',
  'forearms': 'Antebraços',
  'glutes': 'Glúteos',
  'hamstrings': 'Posterior de Coxa',
  'lats': 'Costas',
  'levator scapulae': 'Ombros',
  'pectorals': 'Peito',
  'quads': 'Quadríceps',
  'serratus anterior': 'Core / Abdômen',
  'spine': 'Costas',
  'traps': 'Costas',
  'upper back': 'Costas',
};

// ExerciseDB `bodyPart` -> grupo muscular do app (FALLBACK, quando o target
// não estiver no mapa acima).
export const BODYPART_TO_GROUP = {
  'back': 'Costas',
  'cardio': 'Cardio / Funcional',
  'chest': 'Peito',
  'lower arms': 'Antebraços',
  'lower legs': 'Panturrilha',
  'neck': 'Ombros',
  'shoulders': 'Ombros',
  'upper arms': 'Bíceps',
  'upper legs': 'Quadríceps',
  'waist': 'Core / Abdômen',
};

// ExerciseDB `equipment` -> load_type do app
export const EQUIPMENT_TO_LOAD = {
  'assisted': 'machine',
  'band': 'elastic',
  'barbell': 'barbell',
  'body weight': 'bodyweight',
  'bosu ball': 'bodyweight',
  'cable': 'cable',
  'dumbbell': 'dumbbell',
  'elliptical machine': 'machine',
  'ez barbell': 'barbell',
  'hammer': 'machine',
  'kettlebell': 'dumbbell',
  'leverage machine': 'machine',
  'medicine ball': 'bodyweight',
  'olympic barbell': 'barbell',
  'resistance band': 'elastic',
  'roller': 'bodyweight',
  'rope': 'mixed',
  'skierg machine': 'machine',
  'sled machine': 'machine',
  'smith machine': 'machine',
  'stability ball': 'bodyweight',
  'stationary bike': 'machine',
  'stepmill machine': 'machine',
  'tire': 'mixed',
  'trap bar': 'barbell',
  'upper body ergometer': 'machine',
  'weighted': 'mixed',
  'wheel roller': 'bodyweight',
};

// Tradução de nomes de músculos (para secondary_muscles em PT-BR)
export const MUSCLE_PT = {
  'abductors': 'Abdutores',
  'adductors': 'Adutores',
  'abs': 'Abdômen',
  'biceps': 'Bíceps',
  'brachialis': 'Braquial',
  'calves': 'Panturrilhas',
  'cardiovascular system': 'Sistema cardiovascular',
  'delts': 'Deltoides',
  'forearms': 'Antebraços',
  'glutes': 'Glúteos',
  'hamstrings': 'Posteriores de coxa',
  'hip flexors': 'Flexores do quadril',
  'lats': 'Dorsais',
  'levator scapulae': 'Levantador da escápula',
  'pectorals': 'Peitorais',
  'quads': 'Quadríceps',
  'rhomboids': 'Romboides',
  'serratus anterior': 'Serrátil anterior',
  'soleus': 'Sóleo',
  'spine': 'Eretores da espinha',
  'traps': 'Trapézio',
  'triceps': 'Tríceps',
  'upper back': 'Parte superior das costas',
  'wrist extensors': 'Extensores do punho',
  'wrist flexors': 'Flexores do punho',
};

// ---- Funções de mapeamento ----------------------------------------------

export function mapMuscleGroup(target, bodyPart) {
  const t = (target || '').toLowerCase().trim();
  if (TARGET_TO_GROUP[t]) return TARGET_TO_GROUP[t];
  const bp = (bodyPart || '').toLowerCase().trim();
  if (BODYPART_TO_GROUP[bp]) return BODYPART_TO_GROUP[bp];
  return 'Corpo Inteiro';
}

export function mapLoadType(equipment) {
  const e = (equipment || '').toLowerCase().trim();
  return EQUIPMENT_TO_LOAD[e] || 'mixed';
}

export function mapCountType(bodyPart) {
  return (bodyPart || '').toLowerCase().trim() === 'cardio' ? 'time' : 'reps';
}

export function translateMuscleList(muscles) {
  if (!Array.isArray(muscles)) return [];
  return muscles
    .map((m) => MUSCLE_PT[(m || '').toLowerCase().trim()] || m)
    .filter(Boolean);
}

// ---- Dicionário de correção de jargão de musculação ----------------------
// Rede de segurança aplicada DEPOIS da tradução automática: corrige termos
// técnicos que tradutores costumam errar ou deixar em inglês.
// Chave = termo em inglês (minúsculo); valor = termo correto em PT-BR.
// A ordem importa: termos mais longos/específicos primeiro.
export const GLOSSARY = [
  ['romanian deadlift', 'levantamento terra romeno'],
  ['stiff leg deadlift', 'levantamento terra pernas semirrígidas'],
  ['deadlift', 'levantamento terra'],
  ['incline bench press', 'supino inclinado'],
  ['decline bench press', 'supino declinado'],
  ['bench press', 'supino'],
  ['overhead press', 'desenvolvimento'],
  ['shoulder press', 'desenvolvimento de ombros'],
  ['front squat', 'agachamento frontal'],
  ['hack squat', 'agachamento hack'],
  ['squat', 'agachamento'],
  ['lat pulldown', 'puxada na polia'],
  ['pulldown', 'puxada'],
  ['pull-up', 'barra fixa'],
  ['pull up', 'barra fixa'],
  ['chin-up', 'barra fixa (pegada supinada)'],
  ['chin up', 'barra fixa (pegada supinada)'],
  ['push-up', 'flexão de braço'],
  ['push up', 'flexão de braço'],
  ['bent-over row', 'remada curvada'],
  ['bent over row', 'remada curvada'],
  ['seated row', 'remada sentada'],
  ['row', 'remada'],
  ['hammer curl', 'rosca martelo'],
  ['biceps curl', 'rosca direta'],
  ['bicep curl', 'rosca direta'],
  ['preacher curl', 'rosca scott'],
  ['curl', 'rosca'],
  ['triceps pushdown', 'tríceps na polia'],
  ['triceps pressdown', 'tríceps na polia'],
  ['skull crusher', 'tríceps testa'],
  ['leg press', 'leg press'],
  ['leg curl', 'mesa flexora'],
  ['leg extension', 'cadeira extensora'],
  ['calf raise', 'elevação de panturrilha'],
  ['lateral raise', 'elevação lateral'],
  ['front raise', 'elevação frontal'],
  ['shrug', 'encolhimento'],
  ['lunge', 'avanço'],
  ['hip thrust', 'elevação de quadril'],
  ['glute bridge', 'elevação pélvica'],
  ['plank', 'prancha'],
  ['crunch', 'abdominal'],
  ['dumbbell', 'halter'],
  ['barbell', 'barra'],
  ['cable', 'polia'],
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Aplica o glossário ao texto (whole-word, case-insensitive).
export function correctTerms(text) {
  if (!text) return text;
  let out = text;
  for (const [en, pt] of GLOSSARY) {
    const re = new RegExp(`\\b${escapeRegExp(en)}\\b`, 'gi');
    out = out.replace(re, pt);
  }
  return out;
}
