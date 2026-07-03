import { MODULE, type ModuleSlug } from '@/lib/modules';

export type OnboardingRole = 'personal' | 'student';

export interface ModuleOnboardingItem {
  slug: ModuleSlug;
  /** Nome exibido como título do card. */
  title: string;
  /** Categoria curta exibida no badge. */
  category: string;
  /** Ícone Ionicons. */
  icon: string;
  /** Descrição curta (1–2 frases). */
  description: string;
  /** Bloco "Como usar" (1–3 frases). */
  howTo: string;
}

// ─── Personal trainer (dashboard) ─────────────────────────────────────────────
// Ordem: Treinos → Acompanhamento → Financeiro → Comunicação → Identidade → IA
// Inclui módulos administrativos (🔒) que só o personal enxerga.
const PERSONAL_LOOP: ModuleOnboardingItem[] = [
  {
    slug: MODULE.BANCO_EXERCICIOS,
    title: 'Banco de exercícios',
    category: 'Treinos',
    icon: 'barbell-outline',
    description:
      'Seu catálogo de exercícios, com vídeo, grupo muscular e instruções de execução.',
    howTo:
      'Cadastre exercícios com vídeo demonstrativo e grupo muscular. Eles ficam disponíveis para montar planos de treino e treinos extras para qualquer aluno.',
  },
  {
    slug: MODULE.PLANOS_TREINO,
    title: 'Planos de treino',
    category: 'Treinos',
    icon: 'clipboard-outline',
    description:
      'Onde você monta e atribui os planos semanais de treino para seus alunos.',
    howTo:
      'Crie um plano, organize por dia da semana e atribua a um ou mais alunos. O aluno vê o plano no app dele e registra a execução.',
  },
  {
    slug: MODULE.TREINOS_EXTRAS,
    title: 'Treinos extras',
    category: 'Treinos',
    icon: 'flash-outline',
    description:
      'Treinos avulsos fora do plano semanal — aquecimentos, HIIT especial, treinos de reposição.',
    howTo:
      'Use quando quiser enviar algo pontual sem alterar o plano semanal do aluno. Ideal para substituições ou desafios extras.',
  },
  {
    slug: MODULE.EXECUCAO_TREINO,
    title: 'Execução do treino',
    category: 'Treinos',
    icon: 'play-circle-outline',
    description:
      'O modo ativo do aluno durante o treino: timer entre séries e registro de carga.',
    howTo:
      'Acompanhe aqui o histórico de execuções dos alunos — cargas usadas, séries completas e tempo de treino.',
  },
  {
    slug: MODULE.AVALIACOES,
    title: 'Avaliações físicas',
    category: 'Acompanhamento',
    icon: 'stats-chart-outline',
    description:
      'Peso, medidas corporais, % de gordura, dobras cutâneas e fotos de avaliação.',
    howTo:
      'Registre uma nova avaliação por aluno periodicamente para acompanhar a evolução física, com comparativo visual.',
  },
  {
    slug: MODULE.ANAMNESE,
    title: 'Anamnese',
    category: 'Acompanhamento',
    icon: 'document-text-outline',
    description: 'Histórico de saúde, restrições médicas e objetivos do aluno.',
    howTo:
      'Preencha na entrada do aluno ou atualize quando houver mudança de condição de saúde. Serve de base para montar planos seguros.',
  },
  {
    slug: MODULE.MEU_PROGRESSO,
    title: 'Meu progresso',
    category: 'Acompanhamento',
    icon: 'trending-up-outline',
    description: 'Auto-registro do aluno: peso, fotos de progresso e notas pessoais.',
    howTo:
      'O aluno alimenta esses dados pelo app dele. Você acompanha a evolução direto pelo perfil do aluno, sem precisar pedir manualmente.',
  },
  {
    slug: MODULE.FREQUENCIA,
    title: 'Frequência',
    category: 'Acompanhamento',
    icon: 'calendar-outline',
    description:
      'Calendário de treinos, sequência de dias ativos e relatório de assiduidade por aluno.',
    howTo:
      'Veja quem está treinando consistentemente e quem está sumindo — útil para identificar risco de cancelamento.',
  },
  {
    slug: MODULE.FEEDBACKS,
    title: 'Feedbacks',
    category: 'Comunicação',
    icon: 'star-outline',
    description:
      'O aluno avalia o treino com nota e comentário; você visualiza e filtra.',
    howTo:
      'Revise os feedbacks recentes para ajustar carga, volume ou trocar exercícios que não estão funcionando para o aluno.',
  },
  {
    slug: MODULE.FATURAS,
    title: 'Faturas',
    category: 'Financeiro',
    icon: 'card-outline',
    description:
      'Geração de faturas, controle de pagamentos e relatório financeiro mensal.',
    howTo:
      'Gere a fatura do aluno, acompanhe o status de pagamento e veja o fechamento do mês em um único painel.',
  },
  {
    slug: MODULE.ARQUIVOS,
    title: 'Arquivos',
    category: 'Comunicação',
    icon: 'folder-outline',
    description:
      'Upload de PDFs e imagens — dietas, protocolos — compartilhados com alunos.',
    howTo:
      'Envie um arquivo direto para o perfil do aluno. Ele acessa pelo app dele, sem precisar de e-mail ou WhatsApp.',
  },
  {
    slug: MODULE.NOTIFICACOES,
    title: 'Notificações',
    category: 'Comunicação',
    icon: 'notifications-outline',
    description:
      'Push notifications automáticas para treino, fatura vencendo, feedbacks e novidades.',
    howTo:
      'As notificações saem automaticamente conforme eventos do sistema. Configure aqui o que deve ou não ser enviado ao aluno.',
  },
  {
    slug: MODULE.MINHA_AGENDA,
    title: 'Minha agenda',
    category: 'Agenda',
    icon: 'calendar-number-outline',
    description:
      'Compromissos, atendimentos presenciais e virtuais, e pagamentos em um calendário completo.',
    howTo:
      'Cadastre atendimentos e pagamentos a fazer/receber. Eventos com aluno vinculado aparecem também no painel dele.',
  },
  {
    slug: MODULE.PLANOS_ALIMENTARES,
    title: 'Planos alimentares',
    category: 'Nutrição',
    icon: 'restaurant-outline',
    description:
      'Montagem e envio de dietas e planos de nutrição para os alunos.',
    howTo:
      'Monte um plano alimentar por refeição e envie para o aluno. Ele acompanha pelo app, junto com o treino.',
  },
  {
    slug: MODULE.WHITE_LABEL,
    title: 'Identidade visual',
    category: 'Identidade',
    icon: 'color-palette-outline',
    description:
      'Nome do app, cor primária, logo e links de Instagram/WhatsApp exibidos para o aluno.',
    howTo:
      'Personalize a marca que o aluno vê no app dele — isso não afeta seu painel de personal, só a experiência do aluno.',
  },
  {
    slug: MODULE.ASSISTENTE_IA,
    title: 'Max Strive IA',
    category: 'Inteligência Artificial',
    icon: 'sparkles-outline',
    description:
      'Assistente de IA que gera treinos, analisa evolução e sugere ajustes de carga.',
    howTo:
      'Abra o perfil de um aluno e acesse "Consultar Max Strive IA" para gerar planos ou tirar dúvidas sobre o progresso dele.',
  },
];

// ─── Aluno (student) ──────────────────────────────────────────────────────────
// Ordem: Treinos → Acompanhamento → Financeiro → Comunicação
// Sem os módulos administrativos (banco, notificações, white-label, IA).
const STUDENT_LOOP: ModuleOnboardingItem[] = [
  {
    slug: MODULE.PLANOS_TREINO,
    title: 'Planos de treino',
    category: 'Treinos',
    icon: 'clipboard-outline',
    description:
      'Aqui você vê os planos de treino que seu personal montou para você, organizados por dia da semana.',
    howTo:
      'Escolha o dia da semana e inicie o treino. Cada exercício mostra vídeo, séries e repetições indicadas pelo seu personal.',
  },
  {
    slug: MODULE.TREINOS_EXTRAS,
    title: 'Treinos extras',
    category: 'Treinos',
    icon: 'flash-outline',
    description:
      'Treinos avulsos que seu personal enviou fora do plano semanal — aquecimentos, desafios, reposições.',
    howTo:
      'Acesse quando seu personal indicar um treino extra. Ele fica disponível aqui até você completar.',
  },
  {
    slug: MODULE.EXECUCAO_TREINO,
    title: 'Execução do treino',
    category: 'Treinos',
    icon: 'play-circle-outline',
    description:
      'O modo ativo do seu treino: timer entre séries e registro de carga usada.',
    howTo:
      'Durante o treino, registre a carga de cada série. O timer avisa quando o descanso termina, para manter o ritmo certo.',
  },
  {
    slug: MODULE.AVALIACOES,
    title: 'Avaliações físicas',
    category: 'Acompanhamento',
    icon: 'stats-chart-outline',
    description:
      'Seu histórico de peso, medidas corporais e fotos de avaliação registrados pelo personal.',
    howTo:
      'Acompanhe aqui sua evolução física ao longo do tempo, com comparativo entre avaliações.',
  },
  {
    slug: MODULE.ANAMNESE,
    title: 'Anamnese',
    category: 'Acompanhamento',
    icon: 'document-text-outline',
    description: 'Seu histórico de saúde e objetivos, preenchido com seu personal.',
    howTo:
      'Revise as informações registradas. Se algo mudar na sua condição de saúde, avise seu personal para atualizar.',
  },
  {
    slug: MODULE.MEU_PROGRESSO,
    title: 'Meu progresso',
    category: 'Acompanhamento',
    icon: 'trending-up-outline',
    description:
      'Espaço para você registrar seu próprio peso, fotos de progresso e notas pessoais.',
    howTo:
      'Atualize periodicamente seu peso e fotos. Isso ajuda seu personal a acompanhar sua evolução sem você precisar avisar.',
  },
  {
    slug: MODULE.FREQUENCIA,
    title: 'Frequência',
    category: 'Acompanhamento',
    icon: 'calendar-outline',
    description: 'Seu calendário de treinos e sequência de dias ativos.',
    howTo:
      'Veja quantos dias seguidos você está treinando e seu histórico de assiduidade no mês.',
  },
  {
    slug: MODULE.FEEDBACKS,
    title: 'Feedbacks',
    category: 'Comunicação',
    icon: 'star-outline',
    description: 'Onde você avalia cada treino com nota e comentário.',
    howTo:
      'Depois de treinar, dê uma nota e deixe um comentário. Seu personal usa isso para ajustar seus próximos treinos.',
  },
  {
    slug: MODULE.FATURAS,
    title: 'Faturas',
    category: 'Financeiro',
    icon: 'card-outline',
    description: 'Suas faturas e status de pagamento junto ao seu personal.',
    howTo: 'Consulte faturas em aberto e o histórico de pagamentos.',
  },
  {
    slug: MODULE.ARQUIVOS,
    title: 'Arquivos',
    category: 'Comunicação',
    icon: 'folder-outline',
    description:
      'PDFs e imagens que seu personal compartilhou com você — dietas, protocolos.',
    howTo:
      'Acesse os arquivos enviados pelo seu personal a qualquer momento, direto pelo app.',
  },
  {
    slug: MODULE.MINHA_AGENDA,
    title: 'Minha agenda',
    category: 'Agenda',
    icon: 'calendar-number-outline',
    description:
      'Seus compromissos com o personal — atendimentos presenciais e virtuais.',
    howTo:
      'Veja seus horários agendados ou solicite um atendimento presencial diretamente por aqui.',
  },
  {
    slug: MODULE.PLANOS_ALIMENTARES,
    title: 'Planos alimentares',
    category: 'Nutrição',
    icon: 'restaurant-outline',
    description: 'Sua dieta e plano de nutrição montado pelo personal.',
    howTo:
      'Consulte as refeições indicadas para cada dia, junto com o seu treino.',
  },
];

/** Lista ordenada do loop de onboarding para o perfil informado. */
export function getOnboardingLoop(role: OnboardingRole): ModuleOnboardingItem[] {
  return role === 'personal' ? PERSONAL_LOOP : STUDENT_LOOP;
}
