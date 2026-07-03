# Feature: Popup de Onboarding por Módulo (loop no login)

**Status:** proposta — aguardando aprovação
**Criado em:** 2026-07-02

---

## 1. Objetivo

Ensinar o usuário (personal trainer ou aluno) sobre os módulos do sistema, um por vez, a cada login — sem exigir tour interativo nem sobrecarregar a primeira sessão com tudo de uma vez.

## 2. Regras de funcionamento

1. **Um popup por login.** Cada vez que o usuário faz login e chega no dashboard (personal) ou no painel do aluno, aparece **um único** popup explicando **um módulo**.
2. **Loop sequencial.** Os módulos têm uma ordem fixa (ver seção 4). A cada novo login, mostra o próximo módulo da lista. Ao chegar no fim, volta para o primeiro — e assim continua indefinidamente até o usuário desativar.
3. **Fechar ≠ desativar.** O usuário pode fechar o popup (X ou clique fora) a qualquer momento sem afetar o loop — no próximo login, aparece o próximo módulo normalmente, como se tivesse visto.
4. **"Não mostrar mais" é definitivo.** Um botão separado ("Não quero mais ver isso") desliga o recurso por completo. Nenhum módulo — nem os que o usuário nunca viu — volta a aparecer depois disso, em nenhum login futuro.
5. **Somente módulos habilitados.** O loop pula módulos que o tenant não tem habilitado (`tenant_modules.enabled = false` ou `system_modules.available = false`). Se um módulo for habilitado depois, ele entra no loop na próxima vez que seu "turno" chegar.
6. **Persistência local, sem servidor.** O estado (posição atual no loop + flag de "não mostrar mais") fica salvo **no navegador** (localStorage), por usuário (`userId`), não no banco. Se o usuário limpar o navegador, trocar de dispositivo, ou os dados forem perdidos por qualquer motivo, o loop **recomeça do zero** — comportamento aceito e esperado (não há sincronização entre dispositivos).
7. **Escopo por perfil.** Personal trainer e aluno têm listas de módulos e progressões de loop **independentes** — cada um armazenado com uma chave própria no localStorage, para não conflitar.
8. **Exceção — Max Strive IA:** o módulo de IA já possui um popup de boas-vindas dedicado (`MaxOnboardingModal`, com efeito de digitação e visual próprio em roxo), disparado na primeira vez que o módulo aparece habilitado para o usuário. Ele **continua existindo como está, sem alteração**. O card do Max dentro do loop genérico usa o **mesmo template visual dos demais módulos** (sem repetir o efeito de digitação), apenas para reforçar a explicação em um momento futuro do ciclo.

## 3. Comportamento técnico (visão geral, para implementação)

- Componente client-side montado no layout do dashboard (personal) e no layout do aluno, similar ao padrão já existente em `src/components/ai/MaxOnboardingModal.tsx` e nos prompts de instalação PWA (`AndroidInstallPrompt.tsx` / `IOSInstallPrompt.tsx`).
- Chaves de localStorage propostas:
  - `module_onboarding_dismissed_forever_<role>_<userId>` — boolean. Se `true`, o componente nunca renderiza.
  - `module_onboarding_index_<role>_<userId>` — índice do próximo módulo a mostrar no loop.
- Lista de módulos do loop é filtrada em runtime pelos módulos habilitados do tenant (mesma fonte que já alimenta a sidebar — `enabledModules`).
- Ao abrir: mostra o módulo da posição atual (mod o tamanho da lista filtrada). Ao fechar (X ou "entendi"): incrementa o índice em 1 (com wraparound) e salva. Ao clicar em "não mostrar mais": grava a flag definitiva e fecha.
- Um único popup por carregamento de página — não reabre se o usuário navegar dentro da mesma sessão sem novo login.

## 4. Loop — Personal Trainer (dashboard)

Ordem: Treinos → Acompanhamento → Financeiro → Comunicação → Identidade Visual → IA

**Módulos administrativos (somente personal, marcados com 🔒):** `banco-de-exercicios`, `notificacoes`, `white-label` e `assistente-ia` aparecem **apenas** no loop do personal — o aluno não interage com eles, então ficam fora do loop do aluno (seção 5).

| # | Módulo (slug) | Descrição | Como usar |
|---|---|---|---|
| 1 | `banco-de-exercicios` 🔒 | Seu catálogo de exercícios, com vídeo, grupo muscular e instruções de execução. | Cadastre exercícios com vídeo demonstrativo e grupo muscular. Eles ficam disponíveis para montar planos de treino e treinos extras para qualquer aluno. |
| 2 | `planos-de-treino` | Onde você monta e atribui os planos semanais de treino para seus alunos. | Crie um plano, organize por dia da semana e atribua a um ou mais alunos. O aluno vê o plano no app dele e registra a execução. |
| 3 | `treinos-extras` | Treinos avulsos fora do plano semanal — aquecimentos, HIIT especial, treinos de reposição. | Use quando quiser enviar algo pontual sem alterar o plano semanal do aluno. Ideal para substituições ou desafios extras. |
| 4 | `execucao-do-treino` | O modo ativo do aluno durante o treino: timer entre séries e registro de carga. | Acompanhe aqui o histórico de execuções dos alunos — cargas usadas, séries completas e tempo de treino. |
| 5 | `avaliacoes-fisicas` | Peso, medidas corporais, % de gordura, dobras cutâneas e fotos de avaliação. | Registre uma nova avaliação por aluno periodicamente para acompanhar a evolução física, com comparativo visual. |
| 6 | `anamnese` | Histórico de saúde, restrições médicas e objetivos do aluno. | Preencha na entrada do aluno ou atualize quando houver mudança de condição de saúde. Serve de base para montar planos seguros. |
| 7 | `meu-progresso` | Auto-registro do aluno: peso, fotos de progresso e notas pessoais. | O aluno alimenta esses dados pelo app dele. Você acompanha a evolução direto pelo perfil do aluno, sem precisar pedir manualmente. |
| 8 | `frequencia` | Calendário de treinos, sequência de dias ativos e relatório de assiduidade por aluno. | Veja quem está treinando consistentemente e quem está sumindo — útil para identificar risco de cancelamento. |
| 9 | `feedbacks` | O aluno avalia o treino com nota e comentário; você visualiza e filtra. | Revise os feedbacks recentes para ajustar carga, volume ou trocar exercícios que não estão funcionando para o aluno. |
| 10 | `faturas` | Geração de faturas, controle de pagamentos e relatório financeiro mensal. | Gere a fatura do aluno, acompanhe o status de pagamento e veja o fechamento do mês em um único painel. |
| 11 | `arquivos` | Upload de PDFs e imagens — dietas, protocolos — compartilhados com alunos. | Envie um arquivo direto para o perfil do aluno. Ele acessa pelo app dele, sem precisar de e-mail ou WhatsApp. |
| 12 | `notificacoes` 🔒 | Push notifications automáticas para treino, fatura vencendo, feedbacks e novidades. | As notificações saem automaticamente conforme eventos do sistema. Configure aqui o que deve ou não ser enviado ao aluno. |
| 13 | `minha-agenda` | Compromissos, atendimentos presenciais e virtuais, e pagamentos em um calendário completo. | Cadastre atendimentos e pagamentos a fazer/receber. Eventos com aluno vinculado aparecem também no painel dele. |
| 14 | `planos-alimentares` | Montagem e envio de dietas e planos de nutrição para os alunos. | Monte um plano alimentar por refeição e envie para o aluno. Ele acompanha pelo app, junto com o treino. |
| 15 | `white-label` 🔒 | Nome do app, cor primária, logo e links de Instagram/WhatsApp exibidos para o aluno. | Personalize a marca que o aluno vê no app dele — isso não afeta seu painel de personal, só a experiência do aluno. |
| 16 | `assistente-ia` 🔒 | Assistente de IA que gera treinos, analisa evolução e sugere ajustes de carga. | Abra o perfil de um aluno e acesse "Consultar Max Strive IA" para gerar planos ou tirar dúvidas sobre o progresso dele. |

## 5. Loop — Aluno (student)

**Observação:** hoje o menu do aluno é fixo (não há gating por módulo habilitado no tenant, conforme investigação técnica). Para não confundir o aluno com telas que talvez não use, o loop do aluno também deve respeitar os módulos habilitados no tenant sempre que possível.

Ordem: Treinos → Acompanhamento → Financeiro → Comunicação

| # | Módulo (slug) | Descrição | Como usar |
|---|---|---|---|
| 1 | `planos-de-treino` | Aqui você vê os planos de treino que seu personal montou para você, organizados por dia da semana. | Escolha o dia da semana e inicie o treino. Cada exercício mostra vídeo, séries e repetições indicadas pelo seu personal. |
| 2 | `treinos-extras` | Treinos avulsos que seu personal enviou fora do plano semanal — aquecimentos, desafios, reposições. | Acesse quando seu personal indicar um treino extra. Ele fica disponível aqui até você completar. |
| 3 | `execucao-do-treino` | O modo ativo do seu treino: timer entre séries e registro de carga usada. | Durante o treino, registre a carga de cada série. O timer avisa quando o descanso termina, para manter o ritmo certo. |
| 4 | `avaliacoes-fisicas` | Seu histórico de peso, medidas corporais e fotos de avaliação registrados pelo personal. | Acompanhe aqui sua evolução física ao longo do tempo, com comparativo entre avaliações. |
| 5 | `anamnese` | Seu histórico de saúde e objetivos, preenchido com seu personal. | Revise as informações registradas. Se algo mudar na sua condição de saúde, avise seu personal para atualizar. |
| 6 | `meu-progresso` | Espaço para você registrar seu próprio peso, fotos de progresso e notas pessoais. | Atualize periodicamente seu peso e fotos. Isso ajuda seu personal a acompanhar sua evolução sem você precisar avisar. |
| 7 | `frequencia` | Seu calendário de treinos e sequência de dias ativos. | Veja quantos dias seguidos você está treinando e seu histórico de assiduidade no mês. |
| 8 | `feedbacks` | Onde você avalia cada treino com nota e comentário. | Depois de treinar, dê uma nota e deixe um comentário. Seu personal usa isso para ajustar seus próximos treinos. |
| 9 | `faturas` | Suas faturas e status de pagamento junto ao seu personal. | Consulte faturas em aberto e o histórico de pagamentos. |
| 10 | `arquivos` | PDFs e imagens que seu personal compartilhou com você — dietas, protocolos. | Acesse os arquivos enviados pelo seu personal a qualquer momento, direto pelo app. |
| 11 | `minha-agenda` | Seus compromissos com o personal — atendimentos presenciais e virtuais. | Veja seus horários agendados ou solicite um atendimento presencial diretamente por aqui. |
| 12 | `planos-alimentares` | Sua dieta e plano de nutrição montado pelo personal. | Consulte as refeições indicadas para cada dia, junto com o seu treino. |

## 6. Visual

Segue o design system do projeto (`DESIGN.md` — "Performance Terminal"): fundo escuro, accent lima (`#E8FF47`) raro, flat por padrão, sombra só no overlay do modal. Estrutura de card similar ao `MaxOnboardingModal`, mas com o accent lima no lugar do violeta (reservado ao Max), sem efeito de digitação — texto estático para reduzir fricção de leitura repetida a cada login.

Elementos do popup:
- Nome do módulo (título)
- Badge/categoria do módulo
- Descrição curta (1–2 frases)
- Bloco "Como usar" (1–3 frases)
- Botão secundário: "Não quero mais ver isso" (desativa para sempre)
- Botão primário: "Entendi" (fecha e avança o loop)

## 7. Fora de escopo (por ora)

- Sincronizar o estado de "visto"/"desativado" no banco de dados (fica só client-side, por navegador).
- Onboarding para módulos `coming_soon` (chat, wearables, marketplace) — só entram no loop quando ficarem `active`.
- Tour interativo com highlight de elementos da tela — é só um popup informativo, sem apontar para a UI.

---

**Próximo passo:** após aprovação deste documento (regras + textos), iniciar implementação:
1. Componente genérico `ModuleOnboardingPopup` reutilizável por role (personal/aluno)
2. Hook/lib de persistência local (localStorage) com as chaves da seção 3
3. Integração no layout do dashboard e no layout do aluno
4. Atualizar graphify (`/graphify update`) e rodar lint-guard ao final
