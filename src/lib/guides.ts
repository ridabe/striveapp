export interface GuideSection {
  icon: string;
  title: string;
  body: string;
}

export interface GuideContent {
  title: string;
  intro?: string;
  sections: GuideSection[];
}

/**
 * Registro central de guias/instruções reutilizáveis pelo app.
 * Para adicionar um novo guia em outra tela: crie uma chave aqui com o
 * conteúdo, depois use `useGuide('sua_chave')` + `<GuideModal>` na tela.
 */
export const GUIDES = {
  routine_builder: {
    title: 'Como montar rotinas e exercícios',
    intro: 'Um guia rápido para organizar os treinos dos seus alunos dentro de um plano.',
    sections: [
      {
        icon: 'list-outline',
        title: '1. Crie a rotina',
        body: 'Toque em "Nova Rotina", dê um nome (ex: "Treino A — Peito e Tríceps") e escolha os dias da semana, ou deixe como "Dia livre" para o aluno treinar quando quiser.',
      },
      {
        icon: 'add-circle-outline',
        title: '2. Adicione os exercícios',
        body: 'Toque no "+" da rotina para abrir a lista de exercícios. Use o filtro por grupo muscular para encontrar mais rápido, marque um ou mais exercícios (podem ser de grupos diferentes) e toque em "Adicionar" — todos entram de uma vez.',
      },
      {
        icon: 'git-merge-outline',
        title: '3. Bi-Série e Tri-Série',
        body: 'Com a rotina expandida, toque em "Combinar exercícios", marque 2 ou mais exercícios já adicionados e confirme. Eles passam a valer como uma série só: o aluno faz um exercício direto atrás do outro, sem descansar, e só descansa ao fechar a rodada toda.',
      },
      {
        icon: 'create-outline',
        title: '4. Ajuste séries, reps e descanso',
        body: 'Toque no ícone de lápis em qualquer exercício da lista para editar séries, repetições, carga e tempo de descanso.',
      },
    ],
  },
  faturas_cobranca: {
    title: 'Como cobrar seus alunos',
    intro: 'Sem gateway de pagamento — o aluno paga por fora (PIX, dinheiro, cartão) e você dá baixa manualmente. Existem dois jeitos de cobrar, escolha o que fizer mais sentido pra cada aluno.',
    sections: [
      {
        icon: 'repeat-outline',
        title: 'Mensalidade recorrente',
        body: 'Ideal pra aluno que paga todo mês, sem prazo definido. Defina o valor e o dia do vencimento uma vez, e a cobrança do mês é gerada sozinha, sempre que você abre o Financeiro.',
      },
      {
        icon: 'calendar-outline',
        title: 'Pacote de meses',
        body: 'Ideal pra aluno que já fechou um período fixo (ex: 6 meses de plano). Todas as parcelas são geradas de uma vez, na hora. Você dá baixa mês a mês normalmente, e só é avisado para renovar quando o pacote inteiro for quitado.',
      },
      {
        icon: 'checkmark-done-outline',
        title: 'Dando baixa',
        body: 'Na lista de cobranças, toque no ícone de check e escolha a forma de pagamento. Se marcar por engano, use "Desfazer" a qualquer momento.',
      },
      {
        icon: 'today-outline',
        title: 'Adicionar na agenda',
        body: 'Ao criar a cobrança, ative "Adicionar na agenda" para que cada mês apareça também na sua agenda e na do aluno — é opcional, fica desligado por padrão.',
      },
    ],
  },
  biblioteca_conteudo: {
    title: 'Como usar a Biblioteca de Conteúdo',
    intro: 'Um catálogo pronto de artes para redes sociais, materiais de apoio e estudos, mantido pela equipe Strive — você só escolhe, edita e usa.',
    sections: [
      {
        icon: 'color-palette-outline',
        title: 'Usar no Canva',
        body: 'Toque em "Usar no Canva" para abrir o design no seu próprio Canva. Ele entra como uma cópia independente na sua conta — edite textos, cores e imagens à vontade, sem afetar o modelo original.',
      },
      {
        icon: 'download-outline',
        title: 'Baixar direto',
        body: 'Materiais de apoio e estudos costumam vir prontos em PDF ou planilha — é só tocar em "Baixar" para abrir e salvar no seu dispositivo.',
      },
      {
        icon: 'bookmark-outline',
        title: 'Salvar para depois',
        body: 'Toque no ícone de marcador no canto do item para guardá-lo nos seus salvos e encontrar mais rápido depois.',
      },
      {
        icon: 'lock-closed-outline',
        title: 'Itens bloqueados',
        body: 'Alguns itens são exclusivos de planos superiores. Se aparecer o cadeado, dá pra ver uma prévia borrada e assinar o plano necessário para desbloquear.',
      },
    ],
  },
} satisfies Record<string, GuideContent>;

export type GuideKey = keyof typeof GUIDES;
