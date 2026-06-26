# Módulo: Assistente IA do Personal

> **Status**: Planejamento  
> **Criado em**: 26/06/2026  
> **Prioridade**: Alta — gera valor imediato para personal trainers na gestão dos seus alunos  
> **Disponibilidade**: Controlada — liberada por tenant via painel Admin Global (web)

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [A Persona: Quem é o Assistente](#2-a-persona-quem-é-o-assistente)
3. [As 5 Funcionalidades](#3-as-5-funcionalidades)
4. [Arquitetura Técnica](#4-arquitetura-técnica)
5. [Schema do Banco de Dados](#5-schema-do-banco-de-dados)
6. [Edge Functions](#6-edge-functions)
7. [Componentes de UI](#7-componentes-de-ui)
8. [Controle de Acesso — Admin Global](#8-controle-de-acesso--admin-global)
9. [Checklist de Implementação (Etapas)](#9-checklist-de-implementação-etapas)
10. [Decisões Técnicas e Trade-offs](#10-decisões-técnicas-e-trade-offs)

---

## 1. Visão Geral

O **Assistente IA do Personal** é um módulo de inteligência artificial embutido no painel do personal trainer que funciona como um **consultor especialista em treinamento**. O Personal seleciona um aluno e consulta o Max para obter análises, gerar treinos e sugestões baseadas nos dados reais daquele aluno.

O Max é sempre acionado manualmente pelo Personal — nunca age de forma automática ou agendada. Alunos não têm acesso direto ao assistente.

O assistente usa:
- **Claude Sonnet** (Anthropic) para geração de linguagem natural
- **RAG (Retrieval-Augmented Generation)** com pgvector para Q&A sobre exercícios
- **LangChain.js** como framework de orquestração
- **Supabase Edge Functions** (Deno) como backend — funciona para web e mobile sem duplicação

### Por que não está disponível para todos

O módulo tem custo por chamada de API (tokens Claude + embeddings OpenAI). Por isso:
- **Não é ativado por padrão** em nenhum tenant
- O **Admin Global** (role `global_admin`) habilita manualmente por tenant via painel web
- Futuramente poderá ser vinculado a planos específicos (ex: só plano `premium`)

---

## 2. A Persona: Quem é o Assistente

A experiência de usuário depende de o assistente ter **identidade própria** — não ser apenas um chatbot genérico. Isso aumenta engajamento, identificação e confiança do aluno.

### Nome: **Max Strive**

> Nome forte, confiante e profissional. "Max" remete a máximo potencial; "Strive" é o nome do app e reforça a identidade da plataforma. Transmite seriedade de especialista com personalidade acessível.

### Personalidade

| Traço | Descrição |
|-------|-----------|
| **Tom** | Direto, encorajador, sem ser condescendente |
| **Expertise** | Fala como personal trainer experiente e certificado |
| **Empático** | Reconhece dificuldades, celebra conquistas com autenticidade |
| **Focado** | Respostas objetivas, sem enrolação — o aluno está no app para treinar |
| **Motivador** | Usa dados reais do aluno para motivação genuína, não genérica |
| **Linguagem** | Português brasileiro natural, gírias leves do universo fitness são bem-vindas |

### Exemplo de resposta do Max Strive

> "Oi João! Analisando seu histórico, você completou 8 dos últimos 10 treinos — isso é consistência de elite 💪 No supino você foi de 40kg para 55kg em 2 meses. Minha sugestão: na próxima semana tenta 57,5kg nas 3 primeiras séries e mantém 55kg nas últimas. Seu músculo está pedindo mais."

### Avatar / Rosto

O Max Strive precisa de uma representação visual para aparecer no app. Opções:

| Opção | Descrição | Complexidade |
|-------|-----------|--------------|
| **A — Ilustração vetorial** | Avatar estilo flat design, neutro/moderno, sem raça definida. Armazenado em `/assets/ai/max-avatar.png`. Versões: padrão, feliz, pensando | Baixa — design único |
| **B — Foto IA (DALL-E / Midjourney)** | Foto realista de personal trainer jovem, profissional, sorridente. Gera mais identificação humana | Média — aprovação do design |
| **C — Animação Lottie** | Avatar animado quando "pensando" ou "falando". Mais premium | Alta |

**Recomendação**: começar com **Opção A** (ilustração vetorial flat) + adicionar animação Lottie na Fase 5 se o módulo tiver boa adoção.

### Assets a criar

```
assets/
└── ai/
    ├── max-avatar.png          # Avatar principal (200x200px, fundo transparente)
    ├── max-avatar-thinking.png # Variante "pensando" (durante streaming)
    ├── max-avatar-happy.png    # Variante "comemorando" (mensagens de parabéns)
    └── max-avatar-small.png    # Versão compacta para chat bubbles (48x48px)
```

### System prompt base do Max Strive

```
Você é Max Strive, assistente de personal training especialista do app Strive Personal.
Você tem profundo conhecimento em fisiologia do exercício, periodização, nutrição esportiva
e motivação. Você conhece os dados completos do aluno que está te consultando.

Regras de comportamento:
- Responda sempre em português brasileiro
- Seja direto e objetivo — o aluno está no app para treinar, não para ler parágrafos
- Use os dados reais do aluno para personalizar cada resposta
- Nunca invente dados que não foram fornecidos no contexto
- Para sugestões de carga ou treino, justifique brevemente com base nos dados
- Celebre conquistas com autenticidade, não com frases genéricas
- Em caso de dúvida sobre saúde/lesão, oriente a consultar um profissional presencialmente
- Você representa o personal trainer do aluno — aja como um parceiro de confiança
```

---

## 3. As 5 Funcionalidades

### Feature 1 — Gerar Treino pelo Objetivo

**Quem usa**: Personal trainer  
**Trigger**: Botão "Gerar treino com IA" ao criar/editar plano de um aluno  
**Input necessário**: student_id (aluno selecionado pelo Personal); contexto vem automaticamente do perfil

**Fluxo**:
1. Edge function busca: `students.goal`, `physical_assessments` (mais recente), `anamnese_responses`
2. Claude recebe contexto + instrução de retornar JSON estruturado
3. Resposta validada e inserida nas tabelas `workout_plans` → `workout_routines` → `workout_items`
4. Personal revisa antes de ativar para o aluno

**Output esperado**: Plano de treino completo pronto para edição, sem precisar criar do zero.

---

### Feature 2 — Explicar Evolução do Aluno

**Quem usa**: Personal trainer  
**Trigger**: Botão "Analisar evolução com Max" na ficha do aluno  
**Input necessário**: student_id (aluno selecionado), período (padrão: últimos 30 dias)

**Fluxo**:
1. Edge function busca: últimas 20 `workout_sessions` com `session_exercises`, `student_progress` (peso), `physical_assessments`, `monthly_points`, posição no `current_ranking`
2. Claude gera análise narrativa em PT-BR com pontos fortes, áreas de melhoria e tendências
3. Resposta salva em `ai_messages` para reutilização (cache por 24h)

**Output esperado**: Parágrafo de análise honesto e específico, sem frases genéricas.

---

### Feature 3 — Sugerir Ajuste de Carga

**Quem usa**: Personal trainer (painel admin) ao revisar treinos  
**Trigger**: Botão "Sugerir ajuste de carga" na tela do aluno  
**Input necessário**: student_id, opcionalmente exercise_id específico

**Fluxo**:
1. Edge function busca: `workout_session_exercises` agrupado por `exercise_id` (últimas 8 ocorrências de cada), carga atual em `workout_items`
2. Claude aplica princípio de sobrecarga progressiva: analisa estabilidade da carga, reps completados, feedback dado
3. Retorna tabela de sugestões por exercício: carga atual → carga sugerida + justificativa

**Output esperado**: Lista de exercícios com sugestão concreta de progressão.

---

### Feature 4 — Mensagem Motivacional

**Quem usa**: Personal trainer  
**Trigger**: Botão "Gerar mensagem motivacional" na ficha do aluno — sempre acionado manualmente  
**Input necessário**: student_id

**Fluxo**:
1. Edge function busca: última sessão, streak atual, posição no ranking, último badge, peso recente
2. Claude gera uma mensagem de até 3 linhas escrita em segunda pessoa (como se o Personal estivesse falando com o aluno)
3. Texto exibido no painel — Personal copia e envia ao aluno pelo canal que preferir (chat interno, WhatsApp, etc.)
4. Salvo em `ai_messages` como histórico

**Output esperado**: Texto pronto para o Personal enviar; personalizado com dados reais, sem frases genéricas.

---

### Feature 5 — Chat Q&A sobre Ficha e Exercícios (RAG)

**Quem usa**: Personal trainer  
**Trigger**: Campo de chat na ficha do aluno — Personal digita uma dúvida sobre o aluno selecionado  
**Input necessário**: student_id + mensagem em linguagem natural

**Fluxo**:
1. Edge function busca contexto direto: plano ativo do aluno com todos os exercícios e cargas
2. **RAG**: pergunta do usuário → embedding (OpenAI) → similarity search em `exercise_embeddings` → recupera top-5 exercícios mais relevantes
3. Claude recebe: contexto da ficha + documentos recuperados + histórico das últimas 6 mensagens
4. Resposta em streaming (SSE) exibida no chat
5. Conversa salva em `ai_conversations` + `ai_messages`

**Output esperado**: Resposta conversacional que pode ser sobre qualquer aspecto do treino.

---

## 4. Arquitetura Técnica

```
Cliente (Web + Mobile)
  ├── app/(admin)/alunos/[id]/assistente.tsx  ← Painel Max na ficha do aluno (todas as features)
  ├── app/(admin)/alunos/[id]/assistente-chat.tsx  ← Chat Q&A histórico (Feature 5)
  └── src/components/ai/                     ← Componentes reutilizáveis
          ├── MaxAvatar.tsx
          ├── MaxQuickActions.tsx
          ├── MaxChatMessage.tsx
          └── MaxStreamingText.tsx

Edge Functions (Supabase / Deno)
  ├── supabase/functions/ai-assistant/
  │   ├── index.ts                    ← Handler principal, roteamento por feature
  │   ├── features/
  │   │   ├── generate-plan.ts        ← Feature 1
  │   │   ├── analyze-progress.ts     ← Feature 2
  │   │   ├── suggest-load.ts         ← Feature 3
  │   │   ├── motivation.ts           ← Feature 4
  │   │   └── chat.ts                 ← Feature 5
  │   ├── retrieval/
  │   │   ├── student-context.ts      ← Agrega dados do aluno do DB
  │   │   ├── workout-context.ts      ← Histórico de cargas
  │   │   └── rag-retrieval.ts        ← Busca vetorial pgvector
  │   └── prompts/
  │       ├── max-system-prompt.ts   ← Persona base do Max Strive
  │       └── feature-prompts.ts      ← Instruções por feature
  └── supabase/functions/embed-exercises/
      └── index.ts                    ← Indexador de exercícios no pgvector

Banco de Dados (Supabase + pgvector)
  ├── exercise_embeddings             ← NOVA: vetores dos exercícios
  ├── ai_conversations                ← NOVA: sessões de chat
  └── ai_messages                     ← NOVA: mensagens com metadados
```

### Fluxo de uma requisição (Feature 5 — Chat)

```
[Aluno digita pergunta]
      ↓
POST /functions/v1/ai-assistant
  { feature: 'chat', student_id, message: "quanto peso posso colocar no supino?" }
      ↓
[Edge Function]
  1. Valida JWT → extrai tenant_id
  2. Verifica módulo ASSISTENTE_IA habilitado para o tenant
  3. student-context.ts → busca plano ativo, exercises da ficha
  4. rag-retrieval.ts → embedding da pergunta → match_exercises() → top-5 docs
  5. Monta prompt: [system: max] + [contexto aluno] + [docs RAG] + [histórico 6 msgs]
  6. Claude Sonnet stream → SSE
      ↓
[Cliente recebe stream]
  StreamingText anima a resposta em tempo real
      ↓
[Ao finalizar]
  Salva em ai_messages (user + assistant)
```

---

## 5. Schema do Banco de Dados

### Migrations a criar (em ordem)

#### 001 — Habilitar pgvector
```sql
-- supabase/migrations/YYYYMMDD_001_enable_pgvector.sql
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 002 — Tabela ai_conversations
```sql
-- supabase/migrations/YYYYMMDD_002_ai_conversations.sql
CREATE TABLE ai_conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL CHECK (feature_type IN (
    'chat', 'generate_plan', 'analyze_progress', 'suggest_load', 'motivation'
  )),
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_student ON ai_conversations(student_id, created_at DESC);
CREATE INDEX idx_ai_conversations_tenant  ON ai_conversations(tenant_id);

-- RLS
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- Aluno vê apenas suas próprias conversas
CREATE POLICY "student_own_conversations" ON ai_conversations
  FOR ALL USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

-- Personal vê conversas do seu tenant
CREATE POLICY "personal_tenant_conversations" ON ai_conversations
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'personal'
  );
```

#### 003 — Tabela ai_messages
```sql
-- supabase/migrations/YYYYMMDD_003_ai_messages.sql
CREATE TABLE ai_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',
  -- metadata: { tokens_input, tokens_output, model, feature_type, cached }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id, created_at ASC);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- Herda acesso via conversation
CREATE POLICY "messages_via_conversation" ON ai_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM ai_conversations
      WHERE student_id IN (
        SELECT id FROM students WHERE user_id = auth.uid()
      )
      OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );
```

#### 004 — Tabela exercise_embeddings
```sql
-- supabase/migrations/YYYYMMDD_004_exercise_embeddings.sql
CREATE TABLE exercise_embeddings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  -- tenant_id NULL = embedding global (exercício is_global = true)
  content     TEXT NOT NULL,  -- texto que foi embeddado
  embedding   VECTOR(1536) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(exercise_id, tenant_id)
);

-- Índice HNSW para busca de similaridade eficiente
CREATE INDEX idx_exercise_embeddings_hnsw
  ON exercise_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE exercise_embeddings ENABLE ROW LEVEL SECURITY;

-- Leitura livre para usuários autenticados (dados de fitness são não-sensíveis)
CREATE POLICY "authenticated_read" ON exercise_embeddings
  FOR SELECT TO authenticated USING (
    tenant_id IS NULL  -- globais
    OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );
```

#### 005 — Função SQL de busca vetorial
```sql
-- supabase/migrations/YYYYMMDD_005_match_exercises_function.sql
CREATE OR REPLACE FUNCTION match_exercises(
  query_embedding VECTOR(1536),
  p_tenant_id     UUID,
  match_threshold FLOAT DEFAULT 0.75,
  match_count     INT   DEFAULT 5
)
RETURNS TABLE (
  exercise_id UUID,
  content     TEXT,
  similarity  FLOAT
)
LANGUAGE SQL STABLE AS $$
  SELECT
    ee.exercise_id,
    ee.content,
    1 - (ee.embedding <=> query_embedding) AS similarity
  FROM exercise_embeddings ee
  WHERE
    (ee.tenant_id = p_tenant_id OR ee.tenant_id IS NULL)
    AND 1 - (ee.embedding <=> query_embedding) > match_threshold
  ORDER BY ee.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

#### 006 — Módulo ASSISTENTE_IA no sistema
```sql
-- supabase/migrations/YYYYMMDD_006_add_assistente_ia_module.sql
INSERT INTO system_modules (slug, name, description, is_premium)
VALUES (
  'assistente-ia',
  'Assistente IA (Max Strive)',
  'Assistente inteligente com RAG: gera treinos, analisa evolução, sugere ajuste de carga, motiva alunos e responde dúvidas sobre exercícios.',
  true  -- só planos que o Admin Global liberar
)
ON CONFLICT (slug) DO NOTHING;
```

> **Nota**: O slug `'assistente-ia'` deve ser adicionado ao arquivo `src/lib/modules.ts`:
> ```typescript
> ASSISTENTE_IA: 'assistente-ia',
> ```

---

## 6. Edge Functions

### 6.1 `ai-assistant` — Função principal

**Arquivo**: `supabase/functions/ai-assistant/index.ts`

**Request**:
```typescript
POST /functions/v1/ai-assistant
Headers: { Authorization: "Bearer <jwt>" }
Body: {
  feature: 'chat' | 'generate_plan' | 'analyze_progress' | 'suggest_load' | 'motivation',
  student_id: string,
  message?: string,          // para feature 'chat'
  conversation_id?: string,  // para continuar chat existente
  period_days?: number,      // para analyze_progress (padrão: 30)
  exercise_id?: string,      // para suggest_load (opcional: exercício específico)
}
```

**Response**: `text/event-stream` (Server-Sent Events para streaming)

**Dependências (Deno imports)**:
```typescript
import { Anthropic } from "npm:@anthropic-ai/sdk@0.39.0";
// LangChain para RAG (apenas na feature 'chat'):
import { OpenAIEmbeddings } from "npm:@langchain/openai@0.3.0";
import { SupabaseVectorStore } from "npm:@langchain/community@0.3.0/vectorstores/supabase";
```

**Variáveis de ambiente necessárias** (configurar no Supabase Dashboard):
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...          # somente para embeddings
```

### 6.2 `embed-exercises` — Indexador

**Arquivo**: `supabase/functions/embed-exercises/index.ts`

**Propósito**: Gera ou atualiza embeddings de exercícios no pgvector.

**Como invocar**:
- Manualmente (via chamada HTTP autenticada com role `global_admin`)
- Futuramente: trigger Postgres ao inserir/atualizar exercício

**Request**:
```typescript
POST /functions/v1/embed-exercises
Headers: { Authorization: "Bearer <service_role_key>" }
Body: {
  exercise_ids?: string[],  // se vazio, re-embeda todos os exercícios sem embedding
  force?: boolean,          // re-embeda mesmo se já existir
}
```

**Texto que será embeddado por exercício**:
```
{nome}: {muscle_group}, músculos secundários: {secondary_muscles}.
Tipo de carga: {load_type}. Tipo de contagem: {count_type}.
Instruções: {instructions}.
```

---

## 7. Componentes de UI

### Estrutura de arquivos novos

```
src/components/ai/
├── MaxAvatar.tsx           # Avatar com variantes (default, thinking, happy)
├── MaxQuickActions.tsx     # Os 5 botões de ação rápida
├── MaxChatMessage.tsx      # Bolha de mensagem (user/assistant)
├── MaxStreamingText.tsx    # Animação de texto em streaming
└── MaxCard.tsx             # Card compacto (para usar na home do aluno)

app/(student)/assistente/
├── _layout.tsx              # Stack layout
├── index.tsx                # Tela principal: avatar + quick actions + últimas conversas
└── chat.tsx                 # Tela de chat (Feature 5)
```

### `app/(admin)/alunos/[id]/assistente.tsx` — Painel Max na ficha do aluno

O Personal acessa o Max a partir da ficha de um aluno específico. Layout sugerido:

```
┌─────────────────────────────────────────┐
│  [← Voltar]   João Silva — Max Strive   │
│                                         │
│     ╭──────────╮                        │
│     │  👤 Max  │  "Olá, [Personal]!     │
│     │ (avatar) │  Consultando sobre     │
│     ╰──────────╯  João. O que precisa?" │
│                                         │
│  ╔═══════════════════════════════════╗  │
│  ║  🏋️  Gerar treino para este aluno ║  │
│  ╚═══════════════════════════════════╝  │
│  ╔═══════════════════════════════════╗  │
│  ║  📈 Analisar evolução             ║  │
│  ╚═══════════════════════════════════╝  │
│  ╔═══════════════════════════════════╗  │
│  ║  ⚖️  Sugerir ajuste de carga      ║  │
│  ╚═══════════════════════════════════╝  │
│  ╔═══════════════════════════════════╗  │
│  ║  💬 Gerar mensagem motivacional   ║  │
│  ╚═══════════════════════════════════╝  │
│  ╔═══════════════════════════════════╗  │
│  ║  🔍 Perguntar sobre treino/exerc. ║  │
│  ╚═══════════════════════════════════╝  │
│                                         │
│  Consultas anteriores                   │
│  ┌───────────────────────────────────┐  │
│  │ Análise de evolução — há 2 dias   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Integração na navegação do Personal

Adicionar botão "Consultar Max" na ficha do aluno em `app/(admin)/alunos/[id].tsx`:

```tsx
const showAssistente = has(MODULE.ASSISTENTE_IA);

{showAssistente && (
  <Pressable onPress={() => router.push(`/admin/alunos/${studentId}/assistente`)}>
    <Ionicons name="sparkles" size={20} />
    <Text>Consultar Max</Text>
  </Pressable>
)}

---

## 8. Controle de Acesso — Admin Global

### Contexto

O role `global_admin` existe no sistema (`app_role` enum) mas não tem painel dedicado no app mobile. O controle de liberação do módulo de IA **precisa ser feito no painel web**.

### O que precisa ser criado no Web

Uma nova seção no painel web para `global_admin`:

**URL**: `/admin-global/tenants` ou nova aba em gerenciamento de tenants

**Funcionalidade**:
1. Listar todos os tenants com status atual do módulo `assistente-ia`
2. Toggle para habilitar/desabilitar por tenant
3. Opcionalmente: configurar limite de tokens/mês por tenant

**Implementação web**:
```typescript
// Habilitar módulo para um tenant específico
const enableAssistenteIA = async (tenantId: string) => {
  // Busca o module_id do 'assistente-ia'
  const { data: module } = await supabase
    .from('system_modules')
    .select('id')
    .eq('slug', 'assistente-ia')
    .single();

  // Insere em tenant_modules
  await supabase
    .from('tenant_modules')
    .upsert({
      tenant_id: tenantId,
      module_id: module.id,
      is_enabled: true,
    });
};
```

### RLS na Edge Function

A edge function `ai-assistant` deve verificar o módulo antes de processar:

```typescript
// No início da edge function, após validar JWT:
const { data: moduleEnabled } = await supabase
  .from('tenant_modules')
  .select('is_enabled')
  .eq('tenant_id', tenantId)
  .eq('module_id', ASSISTENTE_IA_MODULE_ID)
  .single();

if (!moduleEnabled?.is_enabled) {
  return new Response(
    JSON.stringify({ error: 'Módulo Assistente IA não está habilitado para este studio.' }),
    { status: 403 }
  );
}
```

---

## 9. Checklist de Implementação (Etapas)

Use este checklist para rastrear o progresso. Marque `[x]` ao concluir cada item.

---

### FASE 1 — Fundação do Banco ✅ CONCLUÍDA em 26/06/2026

**Banco de Dados**
- [x] Habilitar extensão `pgvector` no projeto Supabase (v0.8.0 instalada em `extensions`)
- [x] Criar migration `001_enable_pgvector.sql` e aplicar
- [x] Criar migration `002_ai_conversations.sql` (tabela + índices + RLS)
- [x] Criar migration `003_ai_messages.sql` (tabela + índice + RLS)
- [x] Criar migration `004_exercise_embeddings.sql` (tabela + índice HNSW + RLS)
- [x] Criar migration `005_match_exercises_function.sql` (função SQL de busca vetorial)
- [x] Criar migration `006_add_assistente_ia_module.sql` (INSERT em system_modules + novo category 'ia')
- [ ] Regenerar `src/types/database.ts` após migrations ⚠️ **pendente — fazer via `supabase gen types`**

**Configuração**
- [ ] Adicionar `ANTHROPIC_API_KEY` nas variáveis de ambiente do Supabase (Dashboard → Settings → Edge Functions)
- [ ] Adicionar `OPENAI_API_KEY` nas variáveis de ambiente do Supabase
- [x] Adicionar `ASSISTENTE_IA: 'assistente-ia'` em `src/lib/modules.ts`

---

### FASE 2 — Persona e Context Retrieval ✅ CONCLUÍDA em 26/06/2026

**Persona (Assets)**
- [ ] Criar / contratar design do avatar Max Strive (200x200px PNG, fundo transparente) ⚠️ **pendente — tarefa de design**
- [ ] Criar variante `max-avatar-thinking.png`
- [ ] Criar variante `max-avatar-happy.png`
- [ ] Criar variante `max-avatar-small.png` (48x48px)
- [x] Pasta `assets/ai/` criada com `LEIA-ME.md` descrevendo os assets necessários

**Edge Function — Estrutura base**
- [x] Criar pasta `supabase/functions/ai-assistant/`
- [x] Implementar `index.ts`: roteamento por feature, validação JWT, verificação de módulo, streaming SSE
- [x] Implementar `prompts/max-system-prompt.ts`: persona completa do Max Strive + formatação do contexto
- [x] Implementar `retrieval/student-context.ts`: agrega perfil, plano ativo, últimas 10 sessões, avaliação física, progresso de peso
- [ ] Testar endpoint com `curl` ou Postman retornando contexto correto ⚠️ **pendente — requer módulo habilitado no tenant**

---

### FASE 3 — Features 1, 2, 3 e 4 (Semana 2-3)

**Feature 1 — Gerar Treino**
- [ ] Implementar `features/generate-plan.ts`
- [ ] Criar prompt estruturado que retorna JSON válido de `workout_plan`
- [ ] Validar e parsear JSON da resposta do Claude
- [ ] Implementar inserção nas tabelas `workout_plans` → `workout_routines` → `workout_items`
- [ ] Testar com aluno real (revisão manual antes de ativar)

**Feature 2 — Analisar Evolução**
- [ ] Implementar `features/analyze-progress.ts`
- [ ] Implementar `retrieval/progress-context.ts` (sessões, peso, pontos, ranking)
- [ ] Configurar streaming SSE na resposta
- [ ] Testar análise com aluno que tem histórico real

**Feature 3 — Sugerir Carga**
- [ ] Implementar `features/suggest-load.ts`
- [ ] Implementar `retrieval/workout-context.ts` (cargas históricas por exercício)
- [ ] Validar lógica de progressão (não sugerir salto excessivo)
- [ ] Testar com exercícios de carga variável

**Feature 4 — Mensagem Motivacional (manual)**
- [ ] Implementar `features/motivation.ts`
- [ ] Exibir texto gerado no painel — Personal copia e envia ao aluno pelo canal preferido
- [ ] Testar mensagem gerada com diferentes perfis de aluno

---

### FASE 4 — RAG + Feature 5 ✅ CONCLUÍDA em 26/06/2026

**Indexação de Exercícios**
- [x] Criar `supabase/functions/embed-exercises/index.ts`
- [x] Implementar geração de embedding com `text-embedding-3-small` (OpenAI) em lotes de 20
- [x] Implementar upsert em `exercise_embeddings` (UNIQUE exercise_id + tenant_id)
- [ ] Executar indexação inicial dos exercícios globais ⚠️ **pendente — chamar endpoint uma vez após deploy**
- [ ] Executar indexação dos exercícios customizados por tenant ⚠️ **pendente — passar tenant_id no body**

**Feature 5 — Chat com RAG**
- [x] Implementar `retrieval/rag-retrieval.ts` (embedding da query → `match_exercises()` → top-5)
- [x] Implementar `features/chat.ts` com RAG + memória de conversa (últimas 6 trocas)
- [x] Salvar conversa em `ai_messages` (user + assistant) com `rag_used` no metadata
- [x] Degradação graciosa: RAG falhar não quebra o chat
- [ ] Testar perguntas sobre exercícios: técnica, substituições, músculos trabalhados ⚠️ **pendente — requer embeddings indexados**

---

### FASE 5 — Interface Mobile/Web (Semana 4-5)

**Componentes**
- [ ] Criar `src/components/ai/MaxAvatar.tsx` (exibe asset com variante por estado)
- [ ] Criar `src/components/ai/MaxQuickActions.tsx` (5 botões de ação rápida)
- [ ] Criar `src/components/ai/MaxChatMessage.tsx` (bolha user/assistant)
- [ ] Criar `src/components/ai/MaxStreamingText.tsx` (animação de texto chegando)

**Telas do Personal**
- [ ] Criar `app/(admin)/alunos/[id]/assistente.tsx` (painel Max: avatar + 5 quick actions)
- [ ] Criar `app/(admin)/alunos/[id]/assistente-chat.tsx` (chat histórico — Feature 5)
- [ ] Adicionar botão "Consultar Max" na ficha do aluno `app/(admin)/alunos/[id].tsx` (condicionado ao módulo)
- [ ] Feature 1 (gerar treino) também acessível no fluxo de criação de plano

---

### FASE 6 — Admin Global Web (Semana 5)

**Painel Web — Admin Global**
- [ ] Criar/identificar página de gerenciamento de tenants no painel web
- [ ] Adicionar coluna "Assistente IA" na listagem de tenants
- [ ] Implementar toggle de habilitação por tenant (`tenant_modules`)
- [ ] Implementar consulta de uso (quantidade de conversas, mensagens) por tenant

---

### FASE 7 — Polimento e Segurança (Semana 5-6)

**Controles**
- [ ] Rate limiting: máximo de N chamadas por tenant por dia (configurável)
- [ ] Tracking de tokens: salvar `tokens_input`, `tokens_output` em `ai_messages.metadata`
- [ ] Implementar cache de análise de evolução (validade 24h, evitar chamadas repetidas)
- [ ] Adicionar timeout de 30s na edge function (fallback gracioso)

**Qualidade**
- [ ] Testar todas as 5 features com dados de produção (aluno real)
- [ ] Validar que RLS impede aluno A de ver conversas do aluno B
- [ ] Validar que personal só vê dados do seu próprio tenant
- [ ] Testar feature flag: aluno sem módulo habilitado não vê tab no app

---

## 10. Decisões Técnicas e Trade-offs

### Modelo de IA

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Modelo de geração | Claude Sonnet 4.6 | Excelente PT-BR, custo-benefício, streaming nativo |
| Modelo de embedding | OpenAI text-embedding-3-small | Anthropic não tem API de embeddings; 1536 dims, ~$0.02/1M tokens |
| Framework | LangChain.js | Suporte Deno, integração Supabase Vector Store, RAG chain pronto |

### Por que RAG só na Feature 5

Features 1-4 trabalham com dados estruturados conhecidos (queries SQL diretas). RAG é necessário apenas para a busca semântica sobre exercícios (perguntas abertas como "qual exercício substitui X?"). Usar RAG em tudo seria mais lento e caro sem ganho de qualidade.

### Custo estimado por uso

| Operação | Tokens | Custo estimado |
|----------|--------|----------------|
| Gerar treino | ~3k tokens | ~$0.01 |
| Analisar evolução | ~4k tokens | ~$0.014 |
| Sugerir carga | ~2k tokens | ~$0.007 |
| Mensagem motivacional | ~500 tokens | ~$0.0017 |
| Chat Q&A | ~2-3k tokens | ~$0.007-0.01 |

Estimativa: 100 interações/dia por tenant ativo → **~$1/dia** em custos de API.

### Persona "Max Strive" — Possibilidades futuras

- [ ] Nome customizável por tenant (o personal define como se chama o assistente)
- [ ] Avatar customizável (personal faz upload da foto do seu assistente)
- [ ] Tom configurável (mais técnico, mais descontraído)
- [ ] Integração com voz (Text-to-Speech para mensagens motivacionais em áudio)
