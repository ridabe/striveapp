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
} satisfies Record<string, GuideContent>;

export type GuideKey = keyof typeof GUIDES;
