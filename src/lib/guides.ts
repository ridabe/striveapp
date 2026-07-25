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

  treino_adaptativo: {
    title: 'Como funciona o Treino Adaptativo',
    intro: 'O treino do seu aluno passa a responder ao dia dele — sempre dentro dos limites que você definir aqui. Nada acontece fora do que você autorizar.',
    sections: [
      {
        icon: 'clipboard-outline',
        title: '1. O aluno faz um check-in de 15 segundos',
        body: 'Antes de iniciar o treino, ele responde três toques no app: como dormiu, se está com dor muscular e como está a energia. Isso vira uma nota de prontidão de 0 a 100.',
      },
      {
        icon: 'options-outline',
        title: '2. Você define até onde o treino pode ir',
        body: 'Ajuste o quanto a carga pode subir num dia bom e o quanto pode aliviar num dia ruim. O padrão é 7,5% para cada lado — conservador de propósito. Nem prontidão 100 passa do teto que você marcar.',
      },
      {
        icon: 'lock-closed-outline',
        title: '3. Trave o que não pode mudar',
        body: 'Exercícios de reabilitação, aprendizado técnico ou que exijam carga exata podem ser travados. Eles nunca são ajustados nem trocados, em nenhuma condição — nem quando o aluno reporta dor.',
      },
      {
        icon: 'toggle-outline',
        title: '4. Ligue o ajuste automático',
        body: 'Enquanto estiver desligado, o aluno ainda faz o check-in e marca o esforço, mas nada é alterado sozinho. Ligue quando estiver confortável com os limites. Alunos que precisam de regra diferente do padrão ganham uma exceção própria.',
      },
      {
        icon: 'barbell-outline',
        title: '5. Durante o treino, o esforço afina a carga',
        body: 'Ao fechar cada série, o aluno marca quantas repetições ainda conseguiria fazer. Sobrou muito, a próxima série sobe; passou do limite, desce. Sempre dentro do seu teto.',
      },
      {
        icon: 'notifications-outline',
        title: '6. Você recebe só o que exige decisão',
        body: 'Nada de relatório diário. Você é avisado quando algo muda de verdade — por exemplo, um aluno chegando mal três vezes seguidas, ou treinando bem abaixo do esforço alvo, sinal de que a carga base já pode subir.',
      },
    ],
  },

  relatorio_evolucao: {
    title: 'Como usar os Relatórios de Evolução',
    intro: 'Todo dia 1º o sistema fecha o mês de cada aluno e deixa o rascunho pronto aqui. Você revisa, ajusta o que quiser e publica — nada chega ao aluno sem passar por você.',
    sections: [
      {
        icon: 'document-text-outline',
        title: '1. O rascunho já vem escrito',
        body: 'O relatório reúne treinos feitos, recordes batidos, evolução de carga, frequência e medidas do período. O texto explicando o mês vem pronto, montado a partir desses números reais — nada é inventado.',
      },
      {
        icon: 'create-outline',
        title: '2. Leia e ajuste antes de publicar',
        body: 'Você pode reescrever o título e o texto à vontade. Os números não são editáveis, porque vêm dos registros do aluno. Lembre que é o seu nome que aparece embaixo — vale uma lida antes de enviar.',
      },
      {
        icon: 'eye-outline',
        title: '3. Confira a prévia',
        body: 'Logo abaixo do texto você vê exatamente o que o aluno vai receber, com os mesmos números e o mesmo destaque. O que você enxerga ali é o que chega para ele.',
      },
      {
        icon: 'send-outline',
        title: '4. Publique',
        body: 'Ao publicar, o relatório aparece no app do aluno com um aviso em destaque na tela inicial dele. Na lista você acompanha quem já abriu e quem ainda não viu.',
      },
      {
        icon: 'add-circle-outline',
        title: 'Precisa de um relatório fora da data?',
        body: 'Use "Gerar relatório agora", escolha o aluno e o mês. Regerar um mês ainda em rascunho substitui o anterior; um mês já publicado fica protegido — arquive antes, se quiser refazer.',
      },
    ],
  },

  radar_retencao: {
    title: 'Como usar o Radar de Retenção',
    intro: 'Todo dia o sistema compara cada aluno com o ritmo dele mesmo e traz no máximo três casos para você resolver — com a ação já pronta.',
    sections: [
      {
        icon: 'analytics-outline',
        title: '1. A comparação é com ele mesmo',
        body: 'Quem treina duas vezes por semana há um ano não está em risco por treinar duas vezes; está em risco quando cai para uma. Por isso o radar nunca usa média geral — cada aluno é medido contra o próprio histórico.',
      },
      {
        icon: 'list-outline',
        title: '2. No máximo três casos por dia',
        body: 'Três é o que dá para fazer bem feito. Uma lista de trinta alunos em risco não ajuda ninguém, só dá culpa. Os demais ficam em observação e entram na fila conforme você resolve os de cima.',
      },
      {
        icon: 'help-circle-outline',
        title: '3. Cada caso mostra o porquê',
        body: 'Abaixo do nome aparecem os sinais que dispararam o alerta: dias parado, queda de frequência, notas caindo, prontidão baixa. Você entende a situação antes de decidir o que fazer.',
      },
      {
        icon: 'chatbubble-ellipses-outline',
        title: '4. A mensagem já vem escrita',
        body: 'O texto de retomada é montado com o contexto real daquele aluno — quantos dias parado, o que ele vinha fazendo bem. Leia, ajuste o que quiser e envie. Ela chega como uma mensagem sua, no app dele.',
      },
      {
        icon: 'trophy-outline',
        title: '5. Ou convide para um desafio',
        body: 'Para quem sumiu por tédio, o convite costuma funcionar melhor que conversa. O aluno é inscrito e recebe um aviso seu contando do convite — inscrever em silêncio não traz ninguém de volta.',
      },
      {
        icon: 'shield-checkmark-outline',
        title: 'Nada sai sem você mandar',
        body: 'O radar prepara, você decide. Nenhuma mensagem é enviada automaticamente. E o aluno nunca vê nada sobre risco ou classificação — para ele, é só uma mensagem do personal dele.',
      },
    ],
  },
} satisfies Record<string, GuideContent>;

export type GuideKey = keyof typeof GUIDES;
