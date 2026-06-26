export const MODULE = {
  PLANOS_TREINO:      'planos-de-treino',
  BANCO_EXERCICIOS:   'banco-de-exercicios',
  TREINOS_EXTRAS:     'treinos-extras',
  EXECUCAO_TREINO:    'execucao-do-treino',
  FREQUENCIA:         'frequencia',
  AVALIACOES:         'avaliacoes-fisicas',
  ANAMNESE:           'anamnese',
  FEEDBACKS:          'feedbacks',
  FATURAS:            'faturas',
  ARQUIVOS:           'arquivos',
  MEU_PROGRESSO:      'meu-progresso',
  WHITE_LABEL:        'white-label',
  NOTIFICACOES:       'notificacoes',
  MINHA_AGENDA:       'minha-agenda',
  PLANOS_ALIMENTARES: 'planos-alimentares',
  GAMIFICACAO:        'gamificacao-ranking',
  ASSISTENTE_IA:      'assistente-ia',
} as const;

export type ModuleSlug = typeof MODULE[keyof typeof MODULE];
