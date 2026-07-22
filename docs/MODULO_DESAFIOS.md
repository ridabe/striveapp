# Módulo: Desafios

> **Status**: ✅ Implementado e testado (Web) — ⏳ Pendente (Mobile)
> **Criado em**: 03/07/2026
> **Prioridade**: Média-Alta — engajamento, retenção e prova social entre alunos
> **Disponibilidade**: Controlada — habilitado por tenant via Admin Global; **bloqueado no plano Free**

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Identificação do Módulo](#2-identificação-do-módulo)
3. [Regras de Negócio](#3-regras-de-negócio)
4. [Schema do Banco de Dados](#4-schema-do-banco-de-dados)
5. [Storage — Capa do Desafio](#5-storage--capa-do-desafio)
6. [Server Actions](#6-server-actions)
7. [Fluxo do Personal (Web)](#7-fluxo-do-personal-web)
8. [Fluxo do Aluno (Web)](#8-fluxo-do-aluno-web)
9. [Arquivos Criados/Modificados (Web)](#9-arquivos-criadosmodificados-web)
10. [Integração com Sistema de Módulos](#10-integração-com-sistema-de-módulos)
11. [Bugs Encontrados e Corrigidos Durante o Desenvolvimento](#11-bugs-encontrados-e-corrigidos-durante-o-desenvolvimento)
12. [Limitações Conhecidas](#12-limitações-conhecidas)
13. [Notas para Implementação Mobile (Android)](#13-notas-para-implementação-mobile-android)

---

## 1. Visão Geral

O módulo **Desafios** permite que o personal trainer crie desafios com duração definida (ex.: "21 dias — Queima de Gordura") para seus alunos ou pessoas convidadas participarem. O personal define regras e premiações, monta um cronograma de dias com exercícios/leituras/arquivos/recados, acompanha o progresso diário de cada participante em tempo real, e ao final calcula e publica um ranking baseado na evolução de composição corporal (queda de % de gordura).

O fluxo completo cobre:
- Criação e configuração do desafio (com arte de capa opcional)
- Adição de participantes: alunos já cadastrados **ou** convite de pessoas novas (que se tornam alunos permanentes do personal, seguindo o mesmo fluxo de cadastro já existente)
- Cadastro de dados corporais iniciais e finais de cada participante
- Montagem de dias com itens (exercício, leitura/dica, arquivo, recado do dia)
- Liberação progressiva (um dia por vez) ou de uma vez (todos os dias juntos)
- Envio de mensagens/dicas diárias, visíveis só para os participantes
- Painel de acompanhamento com progresso percentual por participante
- Encerramento: preenchimento de dados finais → cálculo automático do ranking → publicação controlada aos alunos (com opção de ocultar os números)
- Pontuação no **ranking global do sistema** (gamificação) para tarefas do tipo exercício

O módulo reaproveita, sem duplicar lógica, os seguintes sistemas já existentes: cadastro/convite de aluno (`createStudent`), busca de exercícios (`searchExercises`), gamificação (`gamification_settings`/`gamification_events`), upload de imagem com Supabase Storage (padrão usado no logo do tenant), e o sistema de módulos por tenant (`system_modules`/`tenant_modules`).

---

## 2. Identificação do Módulo

| Campo | Valor |
|-------|-------|
| **Nome** | Desafios |
| **Slug** | `desafios` |
| **Categoria** | `acompanhamento` |
| **Ícone (web, catálogo)** | `Trophy` (lucide-react) |
| **Ícone (sidebar do aluno)** | `Flag` (para não conflitar visualmente com o ícone `Trophy` já usado pelo módulo de Ranking) |
| **Rota Personal** | `/dashboard/desafios` |
| **Rota Aluno** | `/student/desafios` |
| **Restrição de plano** | Bloqueado no plano `free` (checagem em `tenants.plan`) |

---

## 3. Regras de Negócio

Estas regras foram definidas ao longo do desenvolvimento e devem ser preservadas em qualquer nova implementação (incluindo mobile):

### 3.1 Métrica do ranking
O vencedor é determinado pela **maior queda em pontos percentuais de % de gordura corporal** (`initial_body_fat − final_body_fat`). Não é peso perdido nem % relativa — é a diferença absoluta em pontos percentuais. Participantes sem os dois valores preenchidos ficam **sem posição** no ranking (não entram no cálculo, mas continuam listados).

### 3.2 Liberação dos dias — sem automação por data
Existem dois modos, escolhidos na criação do desafio:
- **Progressiva**: o personal publica **um dia de cada vez**, manualmente, no seu próprio ritmo.
- **Tudo de uma vez**: o personal monta todos os dias e depois clica em **"Publicar Todos"** para liberar tudo de uma vez.

O campo `release_date` em `challenge_days` é **apenas informativo/planejamento** — não existe nenhum cron job ou automação que publique dias sozinha com base nessa data. A liberação real é sempre controlada pelo campo `status` (`draft`/`published`) de cada dia, alterado manualmente pelo personal.

### 3.3 Convite de novo participante
Ao adicionar um participante que ainda não é aluno, o personal usa o mesmo fluxo de convite já existente no sistema (nome + e-mail → cria conta com senha provisória → envia e-mail de boas-vindas via edge function `send-student-welcome`). **Após aceitar, essa pessoa vira aluno permanente do personal** e passa a ocupar uma vaga do plano de assinatura — o personal pode removê-la depois pela tela de gestão de alunos, se desejar. Isso é intencional: o módulo Desafios não cria um tipo de vínculo "temporário".

### 3.4 Edição do desafio
O personal pode editar nome, descrição, regras, premiações, duração e modo de liberação **a qualquer momento**, independente do status do desafio (rascunho, ativo, finalizado ou publicado). Não há restrição de edição.

### 3.5 Exclusão do desafio
O personal pode excluir o desafio em **qualquer status, exceto `active`**. Ou seja: pode excluir rascunhos, desafios finalizados (mesmo antes de publicar o resultado) e desafios já publicados. **Não pode excluir enquanto o desafio está em andamento** — precisa finalizá-lo primeiro. A exclusão é feita via `ON DELETE CASCADE`: remove automaticamente participantes, dias, itens, progresso e mensagens.

No botão de excluir, essa regra é comunicada via **estado desabilitado + tooltip** (não escondendo o botão), para que o personal sempre saiba que a opção existe e entenda a condição para usá-la.

### 3.6 Pontuação no ranking global (gamificação)
Quando um participante marca um item como concluído, isso é sempre registrado em `challenge_item_progress` (usado para o % de progresso do painel de acompanhamento). **Além disso**, se o item marcado for do tipo `exercise` **e** a gamificação estiver ativa (`gamification_settings.is_active`), é criado um `gamification_event` do tipo `challenge_task_completed`, valendo `gamification_settings.pts_exercise_completed` pontos — reaproveitando a configuração de pontos já existente, sem introduzir um valor novo. Itens de leitura, arquivo e recado **não** geram pontos no ranking global. Não existe função de "desmarcar" um item — isso foi uma decisão deliberada para evitar farm de pontos via marcar/desmarcar repetidamente (a constraint `UNIQUE(challenge_day_item_id, participant_id)` também impede duplicidade).

### 3.7 Publicação dos resultados
O encerramento tem duas etapas distintas:
1. **Finalizar desafio** (`status: active → finished`) — calcula e grava `result_rank`/`result_delta_pp` de cada participante. Nesse momento o resultado **ainda não é visível ao aluno**.
2. **Publicar resultados** (`status: finished → published`) — libera o ranking aos alunos. Nesse passo o personal escolhe, via toggle, se os números de peso/gordura de início e fim ficam visíveis aos alunos ou se eles só veem a posição no ranking (`show_results_to_students`).

### 3.8 Visibilidade da área do aluno
O item "Desafios" só aparece no menu do aluno quando ele participa de pelo menos um desafio com status `active` **ou** `published`. Quando não há nada relevante, o item de menu não aparece — mas veja a limitação documentada na [seção 12](#12-limitações-conhecidas) sobre o caso de ter os dois simultaneamente.

---

## 4. Schema do Banco de Dados

Migration: `supabase/migrations/20260703_challenges_module.sql` (tabelas) + `supabase/migrations/20260703_challenge_cover_image.sql` (capa, adicionada durante o desenvolvimento).

Todas as tabelas têm RLS habilitado, multi-tenant via `tenant_id`, com policies separadas para `personal` (CRUD completo no próprio tenant) e `student` (leitura restrita ao que ele participa/já foi publicado) e uma policy `service_role_all` de bypass total para uso administrativo.
Tabelas ja adicionadas nabase

### 4.1 `challenges`

| Coluna | Tipo | Nulo | Default | Descrição |
|--------|------|------|---------|-----------|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `tenant_id` | uuid | não | — | FK `tenants` |
| `created_by` | uuid | sim | — | FK `auth.users` (personal que criou) |
| `name` | text | não | — | Nome do desafio |
| `description` | text | sim | — | Descrição/meta |
| `rules` | text | sim | — | Regras do desafio |
| `prizes` | text | sim | — | Premiações |
| `duration_days` | integer | não | — | Duração em dias (informativo) |
| `release_mode` | text | não | `'progressive'` | `progressive` \| `all_at_once` |
| `status` | text | não | `'draft'` | `draft` \| `active` \| `finished` \| `published` |
| `start_date` | date | sim | — | Preenchido ao iniciar o desafio |
| `show_results_to_students` | boolean | não | `true` | Controla exibição de números no ranking |
| `results_published_at` | timestamptz | sim | — | Preenchido ao publicar |
| `cover_image_url` | text | sim | — | URL pública da capa (Storage) |
| `created_at` / `updated_at` | timestamptz | não | `now()` | — |

### 4.2 `challenge_participants`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id`, `tenant_id`, `challenge_id`, `student_id` | uuid | Identificação e vínculos (UNIQUE em `challenge_id, student_id`) |
| `initial_age` | integer | Idade no início |
| `initial_weight`, `initial_body_fat` | numeric | Peso e % gordura iniciais |
| `initial_arm`, `initial_chest`, `initial_waist`, `initial_hip`, `initial_thigh` | numeric | Medidas iniciais (opcionais) |
| `final_weight`, `final_body_fat` | numeric | Peso e % gordura finais |
| `final_arm`, `final_chest`, `final_waist`, `final_hip`, `final_thigh` | numeric | Medidas finais (opcionais) |
| `final_notes` | text | Considerações finais do personal sobre o participante |
| `result_rank` | integer | Posição calculada ao finalizar (null = fora do ranking) |
| `result_delta_pp` | numeric | Queda em pontos percentuais de gordura |
| `created_at` / `updated_at` | timestamptz | — |

> Segue o mesmo padrão de colunas planas (não jsonb) usado em `physical_assessments`, por consistência com o resto do banco.

### 4.3 `challenge_days`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id`, `tenant_id`, `challenge_id` | uuid | Identificação e vínculo |
| `day_number` | integer | Número do dia (UNIQUE com `challenge_id`) |
| `title` | text | Título opcional do dia |
| `release_date` | date | **Apenas informativo** — ver regra 3.2 |
| `status` | text | `draft` \| `published` |
| `created_at` / `updated_at` | timestamptz | — |

### 4.4 `challenge_day_items`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id`, `tenant_id`, `challenge_day_id` | uuid | Identificação e vínculo |
| `item_type` | text | `exercise` \| `reading` \| `file` \| `tip` |
| `title` | text | Título do item |
| `content` | text | Instruções/conteúdo (opcional) |
| `exercise_id` | uuid | FK `exercises`, só quando `item_type = 'exercise'` |
| `file_url` | text | URL do arquivo, só quando `item_type = 'file'` |
| `sort_order` | integer | Ordem de exibição dentro do dia |
| `combo_group_id` | uuid \| null | Agrupa 2+ itens `exercise` em uma Bi-Série/Tri-Série/Circuito — mesmo padrão de `workout_items.combo_group_id` |
| `combo_type` | text \| null | `biset` \| `triset` \| `circuit`, junto com `combo_group_id` |
| `created_at` / `updated_at` | timestamptz | — |

**Combinação de exercícios (Bi-Série/Tri-Série/Circuito):** desde a migration
`20260722_challenge_day_items_combo.sql`, o personal pode selecionar 2+ itens
`item_type = 'exercise'` de um mesmo dia e combiná-los, exatamente como já era
feito ao montar rotinas de treino comuns (`workout_items`). No web, isso vive em
`ChallengeDayItems.tsx` (reaproveita o `CombineModal` das rotinas) e nas actions
`groupChallengeDayItems`/`ungroupChallengeDayItems`/`reorderChallengeDayItems`
em `src/app/actions/challenges.ts`. No mobile, os handlers foram portados de
`app/(admin)/planos/[id].tsx` para `app/(admin)/desafios/[id].tsx`, reaproveitando
o helper `src/lib/comboExercises.ts` sem alterá-lo. Itens `reading`/`tip`/`file`
não podem ser combinados — só exercícios.

### 4.5 `challenge_item_progress`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id`, `tenant_id` | uuid | — |
| `challenge_day_item_id`, `participant_id` | uuid | FK — UNIQUE juntos (impede duplicidade/farm de pontos) |
| `completed_at` | timestamptz | Quando o aluno marcou como feito |

### 4.6 `challenge_messages`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id`, `tenant_id`, `challenge_id` | uuid | — |
| `message` | text | Conteúdo da dica/mensagem |
| `created_at` | timestamptz | — |

Visível apenas para quem participa do desafio correspondente (RLS via `challenge_participants`).

---

## 5. Storage — Capa do Desafio

**Bucket**: `challenge-covers` (público, limite de 5 MB, mimetypes `image/jpeg`, `image/png`, `image/webp`).

**Caminho do objeto**: `{tenant_id}/{challenge_id}.{ext}` (upsert — reenviar substitui o arquivo anterior).

**Dimensão recomendada**: **1200×630px (proporção 1,91:1)** — o mesmo padrão de preview de link em redes sociais (OG image), escolhido para que o personal consiga usar templates prontos (ex.: Canva) sem precisar de habilidade de design.

**Validação e adaptação**:
- Tamanho máximo 5 MB e mimetype validados no servidor (`uploadChallengeCover`).
- No cliente, antes do upload, a proporção da imagem é lida via `Image()` do navegador; se divergir mais de 15% do recomendado, um aviso é mostrado ao personal — **mas o upload não é bloqueado**.
- Em **toda exibição** (lista, detalhe, área do aluno), a capa é renderizada dentro de um contêiner de proporção fixa (`aspect-[1200/630]`) com `object-fit: cover`. Isso garante que o layout **nunca quebra**, independentemente do tamanho real da imagem enviada — o corte acontece visualmente, sem processamento server-side de imagem.
- Upload feito via `FormData` direto (sem signed URL), replicando o mesmo padrão já usado para o logo do tenant em `src/app/actions/branding.ts` — usa o cliente admin do Supabase (`createAdminClient()`), então **não depende de policies de RLS no Storage** (o bucket é público, o que já habilita leitura via URL direta sem necessidade de policy de SELECT redundante).

**Ações**: `uploadChallengeCover(challengeId, formData)` e `removeChallengeCover(challengeId)`, ambas em `src/app/actions/challenges.ts`. Constantes de dimensão/tamanho ficam em `src/lib/challenge-constants.ts` (ver [seção 11.2](#112-constantes-em-arquivo-use-server)).

---

## 6. Server Actions

Arquivo único: `src/app/actions/challenges.ts` (~1300 linhas). Todas seguem o padrão do projeto: `getCtx()`/`requirePersonalCtx()`/`requireStudentCtx()` para autenticação+tenant, retorno `{ error? }` ou `{ id?, error? }`, `revalidatePath` após mutações.

### 6.1 Desafio (CRUD e ciclo de vida)
- `getChallenges()` — lista com contagem de participantes
- `getChallenge(id)` — detalhe + participantes (com nome/e-mail do aluno)
- `createChallenge(input)` — cria em rascunho
- `updateChallenge(id, fields)` — edição, sem restrição de status
- `deleteChallenge(id)` — bloqueado apenas se `status === 'active'`
- `startChallenge(id)` — rascunho → ativo (exige ≥1 participante)
- `finishChallenge(id)` — calcula `result_rank`/`result_delta_pp` de todos os participantes e muda para `finished`
- `publishChallengeResults(id, showResultsToStudents)` — `finished` → `published`

### 6.2 Capa
- `uploadChallengeCover(challengeId, formData)`
- `removeChallengeCover(challengeId)`

### 6.3 Participantes
- `addExistingStudentAsParticipant(challengeId, studentId, initialData)`
- `inviteNewParticipant(challengeId, input, initialData)` — replica o fluxo de `createStudent` (não o reusa diretamente pois esse termina com `redirect()`)
- `removeParticipant(participantId, challengeId)`
- `updateParticipantInitialData(participantId, challengeId, data)`
- `updateParticipantFinalData(participantId, challengeId, data)`

### 6.4 Dias e Itens
- `getChallengeDays(challengeId)` — inclui nome do exercício via join
- `createChallengeDay` / `updateChallengeDay` / `deleteChallengeDay`
- `publishChallengeDay(dayId, challengeId)` — publica um dia
- `publishAllChallengeDays(challengeId)` — publica todos de uma vez
- `createChallengeDayItem` / `updateChallengeDayItem` / `deleteChallengeDayItem`

### 6.5 Mensagens
- `sendChallengeMessage(challengeId, message)` (personal)
- `getChallengeMessages(challengeId)` (personal)
- `getStudentChallengeMessages(challengeId)` (aluno)

### 6.6 Acompanhamento
- `getChallengeTracking(challengeId)` — % de conclusão por participante sobre itens já publicados

### 6.7 Área do aluno
- `getStudentActiveChallenge()` — desafio ativo mais recente do aluno logado, com dias/itens publicados e status de conclusão
- `markItemComplete(itemId)` — marca item como feito + gera ponto de gamificação se for exercício
- `getStudentChallengeResults(challengeId)` — ranking pós-publicação, respeitando `show_results_to_students`
- `getStudentLatestPublishedChallengeId()` — usado quando não há desafio ativo
- `hasVisibleStudentChallenge()` — usado pelo sidebar para decidir se mostra o item de menu

---

## 7. Fluxo do Personal (Web)

1. **Lista** (`/dashboard/desafios`): cards com capa (se houver), nome, status, contagem de participantes e duração. Botão "Novo Desafio". Bloqueado com tela de upsell se o tenant for plano Free.
2. **Criação** (`/dashboard/desafios/novo`): nome, descrição, duração, regras, premiações, modo de liberação. Cria em rascunho e redireciona ao detalhe.
3. **Detalhe** (`/dashboard/desafios/[id]`), seções (nesta ordem):
   - Cabeçalho: nome, status, botões **Editar** (sempre visível) e **Excluir** (sempre visível, desabilitado com tooltip quando ativo) + botão de ação conforme o status (**Iniciar Desafio** / **Finalizar Desafio** / **Publicar Resultados**)
   - **Capa do desafio**: upload/troca/remoção com aviso de proporção
   - Descrição/regras/premiações (se preenchidas)
   - **Participantes**: adicionar (aluno existente ou convite), dados iniciais, dados finais (via botão "Dados finais" quando ativo/finalizado), remover (só em rascunho)
   - **Dias do Desafio**: criar dia, expandir/ver itens, adicionar item (exercício com busca ao vivo / leitura / arquivo / recado), publicar dia individual ou publicar todos, excluir dia/item
   - **Acompanhamento** (a partir de ativo): barra de progresso por participante, colorida (verde/amarelo/vermelho), ordenada por progresso decrescente
   - **Dicas para os participantes**: campo de texto + histórico de mensagens enviadas

---

## 8. Fluxo do Aluno (Web)

O item **Desafios** aparece no menu lateral (ícone `Flag`) apenas quando o aluno participa de um desafio `active` ou `published`.

- **Desafio ativo**: capa, descrição/regras/premiações, dicas do personal (últimas 5), lista de dias publicados (mais recente primeiro) — cada dia expansível mostrando os itens com um botão de check para marcar como concluído (irreversível — não existe "desmarcar").
- **Resultados publicados**: capa, nome do desafio, ranking ordenado por posição, destacando a linha do próprio aluno ("Você"). Números de peso/gordura só aparecem se o personal optou por mostrá-los ao publicar.
- **Nenhum desafio**: estado vazio explicando que o desafio aparecerá quando o personal colocar o aluno em algum.

---

## 9. Arquivos Criados/Modificados (Web)

### Banco de dados
```
supabase/migrations/20260703_challenges_module.sql       # 6 tabelas + RLS + registro em system_modules
supabase/migrations/20260703_challenge_cover_image.sql   # coluna cover_image_url + bucket challenge-covers
src/types/database.ts                                     # regenerado (contém as novas tabelas)
```

### Server actions
```
src/app/actions/challenges.ts        # ~1300 linhas, todas as actions do módulo
src/lib/challenge-constants.ts       # constantes de dimensão/tamanho da capa (não pode viver em arquivo 'use server')
```

### UI — Personal
```
src/app/(dashboard)/dashboard/desafios/page.tsx                          # lista
src/app/(dashboard)/dashboard/desafios/novo/page.tsx                     # página de criação
src/app/(dashboard)/dashboard/desafios/novo/novo-desafio-form.tsx        # formulário de criação
src/app/(dashboard)/dashboard/desafios/[id]/page.tsx                     # orquestrador do detalhe (server component)
src/app/(dashboard)/dashboard/desafios/[id]/ChallengeDetailClient.tsx    # client component principal do detalhe
src/app/(dashboard)/dashboard/desafios/[id]/ChallengeCoverUpload.tsx     # upload/preview da capa
src/app/(dashboard)/dashboard/desafios/[id]/EditChallengeButton.tsx      # modal de edição
src/app/(dashboard)/dashboard/desafios/[id]/DeleteChallengeButton.tsx    # exclusão com confirmação e regra de status
src/app/(dashboard)/dashboard/desafios/[id]/AddParticipantButton.tsx     # modal aluno existente / convidar novo
src/app/(dashboard)/dashboard/desafios/[id]/FinalDataButton.tsx          # modal de dados finais por participante
src/app/(dashboard)/dashboard/desafios/[id]/FinishChallengeButton.tsx    # finalizar desafio (calcula ranking)
src/app/(dashboard)/dashboard/desafios/[id]/PublishResultsButton.tsx     # publicar resultados com toggle
src/app/(dashboard)/dashboard/desafios/[id]/ChallengeDaysSection.tsx     # lista de dias + itens
src/app/(dashboard)/dashboard/desafios/[id]/AddDayButton.tsx             # modal de novo dia
src/app/(dashboard)/dashboard/desafios/[id]/AddDayItemButton.tsx         # modal de novo item (com busca de exercício)
src/app/(dashboard)/dashboard/desafios/[id]/ChallengeTrackingSection.tsx # painel de acompanhamento
src/app/(dashboard)/dashboard/desafios/[id]/ChallengeMessagesSection.tsx # envio/listagem de dicas
```

### UI — Aluno
```
src/app/(student)/student/desafios/page.tsx                     # orquestrador (ativo / resultados / vazio)
src/app/(student)/student/desafios/StudentChallengeActiveView.tsx
src/app/(student)/student/desafios/StudentChallengeResultsView.tsx
```

### Navegação e módulos (arquivos existentes, modificados)
```
src/lib/modules-config.ts                     # rota + label do slug 'desafios'
src/components/layout/dashboard-sidebar.tsx   # ícone Trophy no ICON_MAP + grupo Acompanhamento
src/components/layout/student-sidebar.tsx     # item "Desafios" (ícone Flag) condicional
src/components/layout/student-mobile-nav.tsx  # repassa a flag hasChallenge
src/app/(student)/layout.tsx                  # busca hasVisibleStudentChallenge() e repassa aos navs
```

---

## 10. Integração com Sistema de Módulos

- Registrado em `system_modules` com `slug = 'desafios'`, `category = 'acompanhamento'`, `available = true` (via migration, `ON CONFLICT (slug) DO NOTHING`).
- Habilitação/desabilitação por tenant segue o fluxo padrão já existente: toggle global em `/admin/modulos` e por cliente em `/admin/clientes/[id]/modulos`, via `tenant_modules`.
- **Gate adicional específico deste módulo**: mesmo com o módulo habilitado no tenant, a página web verifica `tenants.plan` e bloqueia o acesso (com tela de upgrade) se o plano for `free`. Essa checagem está em `src/app/(dashboard)/dashboard/desafios/page.tsx` — **não** está refletida em `tenant_modules`, é uma checagem adicional feita na própria página.

---

## 11. Bugs Encontrados e Corrigidos Durante o Desenvolvimento

Registrados aqui para que a implementação mobile não repita os mesmos erros.

### 11.1 `.maybeSingle()` falha quando o aluno está em múltiplos desafios ativos
`getStudentActiveChallenge()` originalmente buscava o desafio ativo do aluno com `.maybeSingle()`. Como nada no schema impede um aluno de participar de **mais de um desafio ativo simultaneamente**, essa chamada falhava silenciosamente (retornava `null` sem erro) sempre que havia 2+ linhas. Só foi descoberto testando com uma conta de aluno real que já participava de outro desafio pré-existente. **Correção**: buscar todos e pegar o mais recente por `created_at`, em vez de assumir unicidade.

### 11.2 Constantes em arquivo `'use server'`
Arquivos com a diretiva `'use server'` no Next.js só podem exportar **funções assíncronas** — exportar `const` quebra o build com `Only async functions are allowed to be exported in a "use server" file`. As constantes de dimensão/tamanho da capa (`CHALLENGE_COVER_RECOMMENDED_WIDTH/HEIGHT`, `CHALLENGE_COVER_MAX_BYTES`) precisaram ser movidas para `src/lib/challenge-constants.ts` (arquivo comum, sem a diretiva), importado tanto pela action quanto pelo componente cliente.

### 11.3 UI de mensagens do personal ficou faltando por 3 etapas
As actions `sendChallengeMessage`/`getChallengeMessages` foram criadas cedo (server actions), mas a tela para o personal efetivamente enviar uma mensagem só foi construída depois, ao perceber a lacuna durante o teste da área do aluno. Lição: ao planejar em etapas, cada etapa "server actions" deveria ser pareada com sua "UI mínima utilizável" antes de avançar, para não acumular lacunas invisíveis.

### 11.4 Migração aplicada sem arquivo local correspondente
A migration da capa do desafio (coluna + bucket) foi aplicada diretamente no projeto Supabase remoto via ferramenta MCP, sem criar o arquivo `.sql` local em `supabase/migrations/`. Isso quebra a paridade entre o histórico de migrations local e o estado real do banco. Corrigido criando `20260703_challenge_cover_image.sql` retroativamente. **Lição**: toda alteração de schema aplicada via MCP precisa também gerar/atualizar o arquivo de migration local na mesma tarefa.

---

## 12. Limitações Conhecidas

**Desafio ativo + resultado publicado simultâneos**: se um aluno participa de um desafio `active` e, ao mesmo tempo, tem resultados de **outro** desafio recém-`published`, a área de desafios mostra **apenas o ativo** — a lógica de `page.tsx` prioriza `getStudentActiveChallenge()` e só verifica resultados publicados quando não há nenhum desafio ativo. É um caso de borda raro (múltiplos desafios simultâneos), mas real. Se o produto crescer nessa direção, considerar mostrar ambos ou uma lista de "desafios anteriores".

---

## 13. Notas para Implementação Mobile (Android)

### 13.1 Cliente Supabase e RLS
Todas as policies RLS já cobrem o acesso do app mobile automaticamente — não é necessário criar nenhuma lógica de permissão adicional no app, basta usar o client Supabase autenticado normalmente. As mesmas regras usadas na web (personal vê seu tenant; aluno vê o que participa) se aplicam identicamente.

### 13.2 Telas necessárias (aluno — prioridade para o mobile)

O mobile deve priorizar a **área do aluno** primeiro, já que é o uso diário/recorrente:

| Tela | Fonte de dados | Observações |
|------|-----------------|-------------|
| Item de menu "Desafios" | `hasVisibleStudentChallenge()` (ou query equivalente direta) | Só mostrar se retornar `true` |
| Desafio ativo | `getStudentActiveChallenge()` | Capa (`cover_image_url` — pode ser `null`), regras/prêmios, dias com itens e status de conclusão |
| Marcar item | `markItemComplete(itemId)` | Ação irreversível — não implementar "desmarcar" no mobile também, por consistência e para não abrir brecha de farm de pontos |
| Dicas do personal | via campo já embutido no retorno de `getStudentActiveChallenge` ou `getStudentChallengeMessages` | Mostrar em ordem cronológica reversa |
| Resultado publicado | `getStudentChallengeResults(challengeId)` | Respeitar `show_details` — se `false`, **não exibir** `initial_weight`/`final_weight`/`initial_body_fat`/`final_body_fat`/`delta_pp`, mesmo que venham nulos/undefined na resposta |

### 13.3 Telas do personal (mobile — se for priorizado depois)

Gestão completa de desafios é mais natural no painel web (criação de dias, upload de capa, textos longos de regras). Se o mobile for cobrir isso no futuro, replicar as mesmas actions listadas na [seção 6](#6-server-actions) e as mesmas regras da [seção 3](#3-regras-de-negócio) — especialmente a regra de exclusão bloqueada só quando `active` (3.5) e a ausência de automação por data na liberação de dias (3.2).

### 13.4 Upload de capa no mobile
Se o mobile permitir enviar a capa, seguir o mesmo bucket (`challenge-covers`) e a mesma validação (5 MB, jpg/png/webp). Recomendado usar a mesma dimensão de referência (1200×630px) na orientação ao usuário, e sempre renderizar a capa dentro de um contêiner de proporção fixa com corte (`aspectRatio: 1200/630` + `resizeMode: 'cover'` no React Native), para manter consistência visual com a web independente do tamanho real enviado.

### 13.5 Pontuação no ranking global
Nenhuma lógica de pontuação deve ser implementada no cliente mobile — a pontuação (`gamification_events`) é sempre inserida pela própria action `markItemComplete`, executada como parte da mesma chamada de marcar item concluído. O app mobile **não deve** chamar `gamification_events` diretamente.

### 13.6 Push notifications (sugestão, não implementado na web)
Não existe hoje nenhum sistema de push notification para novos dias liberados ou mensagens do personal — nem na web, nem planejado neste módulo. Se o mobile quiser adicionar isso, seria um item novo de escopo, não uma paridade com a web.
