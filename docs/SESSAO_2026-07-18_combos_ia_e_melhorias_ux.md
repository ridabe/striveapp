# Sessão 2026-07-18 — Bi/Tri-Série, IA e melhorias de UX

Resumo de referência para replicar os mesmos ajustes no sistema **web** do Strive (pasta separada). Cada seção lista o que mudou, por quê, e os arquivos deste projeto mobile que servem de modelo.

---

## 1. Filtro de grupo muscular na tela de seleção de exercícios

**Problema:** o filtro por grupo muscular (chips "Peito", "Costas"...) ficava atrás/colado na lista de exercícios, difícil de enxergar e usar.

**Solução:**
- Filtro passou a ficar num container próprio com sombra/elevação e borda inferior, separado visualmente da lista.
- Label "Grupo muscular" com ícone acima dos chips.
- Diferencial: cada chip ganhou uma bolinha colorida (cor do grupo muscular, já existente em `exerciseConfig.ts`), permitindo escanear por cor.

**Arquivo modelo:** `src/components/ExercisePickerModal.tsx`

---

## 2. Seleção múltipla de exercícios (sem sair da tela)

**Problema:** ao montar uma rotina, cada exercício adicionado fechava a lista e voltava para a tela da rotina — precisava reabrir a lista a cada exercício.

**Solução:** o `ExercisePickerModal` ganhou um modo `multiSelect`:
- Toque marca/desmarca (checkbox) em vez de fechar a tela.
- Filtro pode ser trocado sem perder os já selecionados.
- Barra de confirmação no rodapé "Adicionar N exercícios" — só aí fecha e insere todos de uma vez.
- Modo single-select (usado em outros fluxos, ex: desafios) continua funcionando via prop opcional, sem quebrar nada.

**Arquivo modelo:** `src/components/ExercisePickerModal.tsx` (prop `multiSelect`, `onConfirm`)

---

## 3. Bi-Série / Tri-Série (exercícios combinados)

### 3.1 Banco de dados
As colunas já existiam e **não precisam de migration** no web (assumindo mesmo schema Postgres/Supabase):
- `workout_items.combo_group_id` (uuid nullable) — agrupa itens.
- `workout_items.combo_type` (text nullable) — **CHECK constraint aceita só `'biset' | 'triset' | 'circuit'`** (2, 3, 4+ exercícios respectivamente). Mesmo para `extra_workout_items`.
- Convenção: o `combo_group_id` é o **id do primeiro item do grupo** (não é uma tabela separada) — evita depender de `crypto.randomUUID()`.

**Bug real encontrado:** o código inicial gerava valores `'biseries'/'triseries'/'giant_set'`, que violam a constraint — o update falhava silenciosamente (sem checar `error`) e nada era gravado. Lição: **sempre checar `error` do Supabase em updates em lote**, e conferir a constraint real via SQL antes de inventar valores.

**Helper compartilhado:** `src/lib/comboExercises.ts`
```ts
groupByCombo<T extends {itemId, comboGroupId}>(items) → grupos (solo = grupo de 1)
comboTypeLabel(count) → "Bi-Série" | "Tri-Série" | "Série Combinada"
comboTypeKey(count) → "biset" | "triset" | "circuit"  // tem que bater com o CHECK constraint
```

### 3.2 Lado do personal — criar/editar combinações
Arquivos modelo: `app/(admin)/planos/[id].tsx` e `app/(admin)/treinos-extras/[id].tsx`.

- Botão "Combinar exercícios em Bi-Série/Tri-Série" (toolbar, texto + ícone, não ícone isolado — ícone sozinho não era intuitivo o suficiente).
- Modo de seleção: toque marca exercícios (checkbox), botão "Agrupar em Bi-Série/Tri-Série" no rodapé confirma.
- **Seção própria "EXERCÍCIOS COMBINADOS"**: a lista é dividida em "Exercícios Individuais" (soltos) + uma seção separada abaixo com cada grupo em um card com borda colorida, badge numerado (1, 2, 3 = ordem de execução), header "BI-SÉRIE/TRI-SÉRIE · N exercícios".
- Duas ações no header de cada grupo: **"Recombinar"** (reabre seleção com os membros atuais pré-marcados, permite trocar/adicionar exercícios) e **"Desagrupar"** (remove a combinação).
- `handleGroupItems(routineId, explicitIds?)`: função única reusada tanto pelo botão de confirmação quanto pelo fluxo de recombinar. Ao recombinar, libera automaticamente membros antigos que não foram re-selecionados (evita grupo órfão).

**Melhoria de UX correlata:** o ícone de excluir rotina ficava colado ao chevron de expandir (risco de toque acidental). Solução: virou um botão de texto "Remover rotina" no rodapé da lista de itens, separado por espaço/borda — só aparece com a rotina já expandida.

### 3.3 Lado do aluno — visibilidade antes de treinar
- Tela de overview do plano (**antes de tocar "Iniciar"**) — `app/(student)/treinos/[planId]/index.tsx` — agora também busca `combo_group_id` e mostra os grupos combinados destacados (bloco "🔗 Bi-Série · exercícios combinados"), não só dentro da execução.
- Tela "pronto para começar" dos players de execução — mesmo tratamento visual.

### 3.4 Lado do aluno — execução (pular descanso dentro do combo)
Arquivos: `app/(student)/treinos/[planId]/executar/index.tsx` e `.../executar/[routineId].tsx`.

Lógica em `completeSeries()`:
- Item **solo** (fora de combo): comportamento 100% original — descansa após cada série do mesmo exercício.
- Item **em combo**: ao completar uma série, avança **imediatamente** (sem descanso) para o próximo exercício do mesmo grupo. Só quando o **último membro da rodada** termina é que entra o descanso — e só se ainda houver mais rodadas. Depois do descanso, volta ao primeiro membro do grupo para a próxima rodada.
- Badge "Bi-Série · Exercício 1 de 2" durante a execução avisa o aluno por que não teve descanso.

**Diagnóstico de bug (não era bug):** um aluno relatou "descanso não conta automaticamente" — a causa real era que os exercícios da rotina de teste não tinham `rest_seconds` preenchido no banco (dado, não código). Vale conferir isso primeiro antes de mexer em lógica de timer.

### 3.5 Tentativa de arrastar-e-soltar (revertida)
Tentamos adicionar "segurar e arrastar um exercício sobre outro para combinar" via `react-native-gesture-handler` + `react-native-reanimated`. **Não funcionou** mesmo após duas tentativas de correção (conflito entre gesto nativo e `TouchableOpacity` legado) — **foi revertido por completo** a pedido do usuário, voltando só ao método de seleção por toque (que funciona). Infra de gesture-handler desinstalada, `babel.config.js`/`app/_layout.tsx` revertidos.
**Lição para o web:** se for tentar isso no navegador, drag-and-drop nativo do browser (HTML5 DnD ou libs como `dnd-kit`/`react-dnd`) não tem esse tipo de conflito de "responder" que existe no React Native — é mais viável lá do que foi aqui.

---

## 4. Tela de instruções/guia reutilizável ("Guia do Max")

**Pedido:** popup de instruções que abre sozinho na primeira vez que o personal entra numa tela (ex: montar rotinas), com opção "não mostrar mais" e um link para reabrir depois. Arquitetura pensada para reuso em outras áreas do sistema.

**Arquivos:**
- `src/lib/guides.ts` — registro central de conteúdo por chave (`GUIDES.routine_builder`). Para nova área: só adicionar uma chave nova aqui.
- `src/hooks/useGuide.ts` — hook `useGuide(guideKey, userId)`: mostra sozinho na primeira visita (persistência via `SecureStore`, chave `guide_dismissed_<guideKey>_<userId>`), expõe `open()/close()/dismissForever()`.
- `src/components/guides/GuideModal.tsx` — modal genérico, usa o avatar do "Max" (mascote/IA do app) como identidade visual, título "GUIA DO MAX".

**Bug de scroll (2 tentativas até acertar):** primeiro era um card centralizado com `maxHeight: '86%'` + `ScrollView` com `flexShrink` — o conteúdo cortava sem rolar (problema comum de RN/Yoga: flex item não encolhe abaixo do conteúdo sem `minHeight: 0`). Correção definitiva: **abandonar o card centralizado** e usar modal em **tela cheia** (`presentationStyle="pageSheet"` + `SafeAreaView flex:1` + header fixo + `ScrollView flex:1` + rodapé fixo) — mesmo padrão já comprovado no `ExercisePickerModal`. Isso eliminou de vez a ambiguidade de altura.
**Lição para o web:** modais de conteúdo longo devem ter altura de scroll delimitada de forma inequívoca (ex: `max-height` numérico fixo no container do scroll, não porcentagem encadeada em vários níveis de flexbox).

**Integração:** em `app/(admin)/planos/[id].tsx`, abre sozinho ao entrar na tela + link "❓ Como montar?" ao lado do título "ROTINAS".

---

## 5. Assistente de IA (Max) — geração de treino com combinados

**Pedido:** o personal deve poder pedir, ao gerar um treino pela IA, que ela já monte bi-séries/tri-séries, opcionalmente dizendo quais tipos de exercício combinar.

**Onde fica a IA no backend:** Supabase Edge Function `supabase/functions/ai-assistant/` — `features/generate-plan.ts` é o arquivo que gera o plano (chama Claude com **tool use forçado** — schema JSON estrito, não é texto livre) e insere direto no banco (`workout_plans` → `workout_routines` → `workout_items`), sem passar pelo cliente.

**Mudanças:**
1. **UI do wizard** (`src/components/ai/CriarTreinoWizardModal.tsx`): toggle "Incluir bi-séries/tri-séries" + campo de texto opcional "quais exercícios combinar" (com chips de sugestão).
2. **Wire client → edge function**: `PlanPreferences`/`PlanPreferencesParams` (em `useMaxStream.ts` e no wizard) ganharam `wantsCombos`/`comboNotes`; mapeados para `wants_combos`/`combo_notes` no body JSON e de volta no `index.ts` da function.
3. **Prompt** (`buildUserPrompt` em `generate-plan.ts`): quando `wantsCombos`, instrui o modelo a marcar exercícios do mesmo grupo com uma tag livre `combo_group` (ex: "A", "B") — mesma semântica (bi-série=2, tri-série=3, sem descanso entre eles).
4. **Schema da tool** (`buildPlanTool`): campo opcional `combo_group: string` em cada item, com descrição explicando a semântica pro modelo.
5. **Inserção no banco** (`insertPlan`): depois de inserir os itens de uma rotina (com `.select('id')` para pegar os ids reais gerados), agrupa por `combo_group` e faz um `UPDATE` setando `combo_group_id` (id do primeiro membro) + `combo_type` (via a mesma lógica `comboTypeKey`, duplicada localmente no arquivo Deno já que edge functions não importam de `src/lib` de forma confiável).
6. Resumo enviado ao personal no chat menciona quantos combinados foram criados por rotina.

**Lição importante para o web:** se o backend web também usa "tool use" estruturado com um LLM para gerar treinos, o mesmo padrão se aplica — adicionar o campo `combo_group` ao schema + pós-processar o resultado antes de gravar. Se o web gerar treino de outro jeito (ex: formulário assistido, não LLM), a parte relevante é só a UI do toggle + a lógica de pós-processamento de agrupamento.

---

## 6. Padrões e decisões gerais (aplicáveis ao portar para o web)

- **Nunca inventar valores de enum/constraint** sem checar o banco primeiro (`SELECT pg_get_constraintdef` na constraint real).
- **Sempre checar `error` de updates em lote do Supabase** — falha silenciosa foi a causa raiz de um bug real nesta sessão.
- **Reaproveitar convenção de `combo_group_id` = id do primeiro item do grupo** (não criar tabela nova) — mais simples e já teve o schema pronto.
- **Separar visualmente "grupo automático" de "lista normal"** é a decisão de UX mais importante do combo: um card com borda + header colorido + numeração, nunca misturado inline com os itens soltos.
- **Modais de conteúdo longo**: preferir tela cheia com `flex:1` em cadeia simples (header fixo → conteúdo flex → rodapé fixo) em vez de cards centralizados com porcentagem de altura.
- Recursos "por toque" (seleção múltipla, agrupar) são mais robustos que gestos de arrastar em apps híbridos/RN — vale considerar isso como padrão default e só investir em drag-and-drop se o ambiente permitir testar de verdade.
