# Melhorias e Ajustes — 25/06/2026
## Aplicáveis ao Sistema Web (painel admin + portal do aluno)

> Este documento lista todas as mudanças realizadas no app mobile nesta data que **têm equivalente direto no sistema web**, incluindo alterações de banco de dados (compartilhado entre mobile e web), correções de lógica de negócio, novas funcionalidades e regras de segurança.

---

## 1. ALTERAÇÕES DE BANCO DE DADOS (obrigatórias — compartilhado)

Todas as alterações abaixo já foram aplicadas no banco de produção (`lodetzmtsymvnjffmvat`).
O web **já se beneficia** das mudanças de função e política, mas pode precisar ajustar as queries.

### 1.1 Nova coluna: `workout_sessions.distance_meters`
```sql
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS distance_meters integer;
```
- **Para que serve**: armazena a distância percorrida capturada pelo smartwatch durante o treino.
- **Ação web**: adicionar campo ao formulário/exibição de sessões de treino (se houver).

### 1.2 Nova coluna: `monthly_points.tenant_id`
```sql
ALTER TABLE monthly_points ADD COLUMN IF NOT EXISTS tenant_id uuid
  REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX idx_monthly_points_tenant ON monthly_points(tenant_id, year, month, total_points DESC);
```
- **Para que serve**: permite futuras consultas por studio, embora o ranking seja global.
- **Backfill executado**: todos os registros existentes receberam o `tenant_id` correto.
- **Ação web**: incluir `tenant_id` ao inserir/atualizar pontos no ranking.

### 1.3 Nova coluna: `tenants.cref`
```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cref text;
```
- **Para que serve**: número de registro CREF do personal trainer (ex: `012345-G/SP`).
- **Ação web**: exibir no painel do personal e no portal do aluno (abaixo do nome do studio).

### 1.4 Nova função PostgreSQL: `award_workout_points`
```sql
-- Função SECURITY DEFINER — chamada via RPC ao salvar um treino
-- Calcula e faz upsert em monthly_points respeitando:
--   min_session_duration_secs (agora 60s), max_pts_per_session,
--   pts_workout_completed, pts_exercise_completed, pts_workout_100_percent,
--   pts_per_minute_active
SELECT award_workout_points(
  p_student_id       => '<uuid>',
  p_duration_secs    => 1800,   -- duração real em segundos
  p_exercises_count  => 6,      -- exercícios concluídos
  p_all_done         => true    -- completou 100% dos exercícios?
);
-- Retorna: { "awarded": 95, "month": 6, "year": 2026 }
-- Ou:      { "skipped": true, "reason": "session_too_short" }
```
- **Para que serve**: pontuação do ranking é calculada de forma atômica no banco.
- **Ação web**: **chamar este RPC** após salvar qualquer sessão de treino concluída. Não calcular pontos no frontend.

### 1.5 Configuração: `gamification_settings.min_session_duration_secs` = 60
```sql
UPDATE gamification_settings SET min_session_duration_secs = 60;
```
- **Antes**: 300 segundos (5 minutos). Treinos de teste nunca geravam pontos.
- **Agora**: 60 segundos (1 minuto). Sessões curtas também pontuam.
- **Ação web**: verificar se o web respeita esse valor ao validar sessões.

### 1.6 Nova Edge Function: `reset-student-password`
```
POST /functions/v1/reset-student-password
Authorization: Bearer <token_do_personal>
Body: { "student_id": "<uuid>" }
```
- **Para que serve**: permite ao personal gerar nova senha provisória para um aluno sem precisar do painel global.
- **Segurança**: valida que o aluno pertence ao mesmo `tenant_id` do personal autenticado.
- **Ação web**: adicionar botão "Resetar senha" na tela de gestão de alunos do painel admin web.

### 1.7 Políticas RLS no bucket `progress-photos`
```sql
-- Leitura pública
CREATE POLICY "progress_photos_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'progress-photos');

-- Aluno faz upload apenas na própria pasta ({tenant_id}/{student_id}/)
CREATE POLICY "progress_photos_student_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'progress-photos' AND auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM students s WHERE s.user_id = auth.uid()
                AND (storage.foldername(name))[2] = s.id::text)
  );

-- Aluno e personal podem deletar fotos
CREATE POLICY "progress_photos_student_delete" ...
CREATE POLICY "progress_photos_personal_delete" ...
```
- **Para que serve**: o bucket não tinha políticas → qualquer upload retornava 403 Unauthorized.
- **Ação web**: o upload de fotos de progresso do aluno agora funciona. Verificar se o web usa a mesma estrutura de path `{tenant_id}/{student_id}/{uuid}.{ext}`.

---

## 2. CORREÇÕES DE LÓGICA DE NEGÓCIO (aplicar no web)

### 2.1 Campo `sex` em avaliações físicas — valor incorreto
**Problema**: A tela enviava `'male'`/`'female'` mas a constraint do banco exige `'M'`/`'F'`.

```
CHECK ((sex = ANY (ARRAY['M'::text, 'F'::text])))
```

**Correção**: mapear na camada de apresentação:
- Ao salvar: `'Masculino'` → `'M'`, `'Feminino'` → `'F'`
- Ao exibir: `'M'` → `'Masculino'`, `'F'` → `'Feminino'`

**Ação web**: verificar formulário de avaliação física (`physical_assessments`).

---

### 2.2 Contagem de planos de treino do aluno — tabela errada
**Problema**: a query contava registros em `workout_plans.student_id` (campo quase sempre NULL).

**Correção**: usar a tabela de junção correta:
```sql
-- ERRADO
SELECT count(*) FROM workout_plans WHERE student_id = '<uuid>'

-- CORRETO
SELECT count(*) FROM student_plan_assignments WHERE student_id = '<uuid>'
```

**Ação web**: corrigir qualquer lugar que mostre contagem de planos por aluno.

---

### 2.3 Anamnese — campos booleanos exibindo `"false"` em vez de `"Não"`
**Problema**: respostas booleanas são salvas como strings `"true"`/`"false"`, mas a exibição não fazia a conversão.

**Correção**: ao renderizar respostas da anamnese:
```javascript
function formatFieldValue(value) {
  if (value === 'true')  return 'Sim';
  if (value === 'false') return 'Não';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  // ... demais tipos
}
```

**Ação web**: aplicar na visualização de respostas de anamnese (tela do personal e do aluno).

---

### 2.4 Anamnese — categorias e tipos de campo com constraint violation
**Problema**: o painel admin enviava categorias que não existem no banco.

**Constraint do banco:**
```sql
-- Categorias válidas
CHECK (category = ANY (ARRAY['saude','historico','objetivos','habitos','alimentacao','outros']))

-- Tipos de campo válidos
CHECK (field_type = ANY (ARRAY['text','textarea','boolean','select','number']))
```

**Ação web**:
- Substituir seletores de categoria para usar SOMENTE os valores acima (com labels em PT-BR para exibição).
- Remover opções `'date'`, `'radio'`, `'checkbox'` do seletor de tipo de campo.
- Exibir labels humanizados: `saude` → "Saúde", `historico` → "Histórico", etc.

**Mapeamento de labels:**
```javascript
const CATEGORY_LABELS = {
  saude:       'Saúde',
  historico:   'Histórico',
  objetivos:   'Objetivos',
  habitos:     'Hábitos',
  alimentacao: 'Alimentação',
  outros:      'Outros',
};
```

---

### 2.5 Ranking — não filtrar por tenant (competição global)
**Problema**: ranking estava filtrando apenas alunos do mesmo studio.

**Regra de negócio**: o ranking é **global** — todos os alunos de todos os studios competem entre si.

**Correção na query do ranking:**
```sql
-- CORRETO: buscar todos os alunos do mês, sem filtro de tenant
SELECT student_id, total_points, workouts_completed, students(full_name)
FROM monthly_points
WHERE month = <mes> AND year = <ano>
ORDER BY total_points DESC, workouts_completed DESC;
```

**Exceção — visão do personal**: o painel do personal pode ter um filtro opcional "apenas meus alunos", mas a listagem padrão deve ser global.

---

### 2.6 Ranking — sem restrição de módulo/plano
**Problema**: a tela de ranking exigia o módulo `'gamificacao-ranking'` ativo para exibir.

**Regra de negócio**: o ranking é padrão do sistema para todos, sem necessidade de módulo habilitado.

**Ação web**: remover qualquer guarda de módulo na rota de ranking. Manter apenas a verificação de `gamification_settings.is_active`.

---

## 3. NOVAS FUNCIONALIDADES (implementar no web)

### 3.1 Campo CREF no perfil do personal

**O que é**: número de registro profissional (ex: `012345-G/SP`) exibido abaixo do nome do studio para os alunos.

**Formato**: `XXXXXX-G/UF` onde G = categoria e UF = estado.

**Implementar no web**:
1. Painel admin → Dados do Studio → adicionar campo "Nº de Registro (CREF)"
2. Portal do aluno → exibir próximo ao logo/nome do studio

---

### 3.2 Contagem de pontos do ranking ao finalizar treino

**Fluxo obrigatório**: sempre que uma sessão de treino for salva como concluída, chamar o RPC `award_workout_points`:

```javascript
// Após salvar workout_session
const { data } = await supabase.rpc('award_workout_points', {
  p_student_id:      studentId,
  p_duration_secs:   durationSeconds,
  p_exercises_count: completedExercisesCount,
  p_all_done:        allExercisesDone,   // boolean: 100% concluído?
});
// data.awarded = pontos concluídos nesta sessão
// data.skipped = true se sessão muito curta (<60s) ou gamificação inativa
```

**Ação web**: verificar se o web chama isso ao registrar treinos pelo painel. Se não, adicionar após o INSERT em `workout_sessions`.

---

### 3.3 Reset de senha de aluno pelo personal

**Fluxo**: personal pode gerar nova senha provisória para aluno sem precisar do admin global.

**API**: `POST /functions/v1/reset-student-password` com `{ student_id }` e token do personal.

**Ação web**: adicionar botão "Gerar nova senha" na tela de detalhes do aluno no painel web.

---

### 3.4 Objetivo do aluno — opções predefinidas

**Antes**: campo texto livre.

**Agora**: seleção entre opções predefinidas com campo aberto somente para "Outros".

**Opções disponíveis** (alinhar com `GOAL_COLORS` do sistema):
```
Hipertrofia | Emagrecimento | Resistência | Força | Condicionamento | Reabilitação | Outros
```

**Ação web**: converter campo de texto livre para select/radio com opção "Outros" + campo adicional.

---

### 3.5 Máscaras de entrada

**Aplicar nos formulários web**:

| Campo | Formato | Observação |
|---|---|---|
| Telefone | `(XX) XXXXX-XXXX` | 11 dígitos; com 10 dígitos: `(XX) XXXX-XXXX` |
| Data de nascimento | `DD/MM/AAAA` | Converter para `YYYY-MM-DD` ao salvar |
| Data de eventos (agenda) | `DD/MM/AAAA` | Idem |
| CREF | livre + validação | Sugerir formato `XXXXXX-G/UF` |

---

### 3.6 Planos de treino filtrados por aluno

**Novo comportamento**: ao acessar a área de treinos a partir da ficha de um aluno, exibir apenas os planos atribuídos a ele.

**Query de planos do aluno**:
```sql
-- Planos regulares
SELECT wp.*, spa.status AS assignment_status
FROM student_plan_assignments spa
JOIN workout_plans wp ON wp.id = spa.plan_id
WHERE spa.student_id = '<uuid>';

-- Treinos extras atribuídos
SELECT * FROM extra_workouts
WHERE student_id = '<uuid>' AND is_template = false;
```

**Ação web**: na ficha do aluno, o card/link de "Planos de Treino" deve levar para view filtrada, não para a lista geral.

---

### 3.7 Upload de fotos de progresso — correção de método

**Problema anterior**: uploads falhavam com erro 403 por ausência de políticas RLS no bucket.

**Políticas agora criadas** (ver seção 1.7). O web deve usar:
- Path: `{tenant_id}/{student_id}/{uuid}.{extensao}`
- Método: `POST` para novo upload
- Headers: `Authorization: Bearer <token>`, `apikey: <anon_key>`

**Verificar no web**: se usa o Supabase JS client (`supabase.storage.from('progress-photos').upload(path, file)`), já funciona. Se usa fetch manual, verificar path e headers.

---

### 3.8 Visualização de dados de saúde do wearable nas sessões

**Novos campos em `workout_sessions`** (já existiam, agora sendo populados):
- `heart_rate_avg`, `heart_rate_max`, `heart_rate_min`
- `calories_active`
- `spo2_avg`
- `steps`
- `distance_meters` (novo)
- `wearable_device` (nome do app origem: "Samsung Health", "Garmin Connect", etc.)

**Ação web**: exibir esses dados no histórico de treinos e no progresso do aluno (quando disponíveis).

---

## 4. NÃO APLICÁVEL AO WEB (exclusivo mobile)

Os itens abaixo são específicos da plataforma mobile e não têm equivalente no sistema web:

- Redesign da tela de execução de treino (one-exercise-at-a-time com chips de série)
- Timer de descanso inline com anel circular
- Popup de conclusão de treino
- Som de beep ao fim da pausa (expo-av WAV gerado em JS)
- Vibração/haptic ao fim da pausa (expo-haptics)
- Notificações locais para alerta no smartwatch (expo-notifications)
- Integração Health Connect (Android) para leitura de dados do smartwatch
- Detecção de Samsung Health / Garmin via `metadata.dataOrigin.packageName`
- Sanfona de exercícios com LayoutAnimation
- Máscaras de input campo a campo (React Native TextInput)
- Anamnese pendente como banner no home (push in-app)
- Atualizações em tempo real via Supabase Realtime no home do aluno
- Redesign do home do personal (hero card, mini stats)
- Redesign da tela de evolução do aluno (gráficos customizados sem lib externa)

---

## 5. CHECKLIST DE VERIFICAÇÃO PARA O WEB

```
[ ] Formulário de nova avaliação física → campo sex enviando 'M'/'F' (não 'male'/'female')
[ ] Contagem de planos do aluno → usando student_plan_assignments
[ ] Anamnese → categorias usando valores do banco (saude, historico, etc.)
[ ] Anamnese → field_type sem 'date', 'radio', 'checkbox'
[ ] Anamnese → exibição de booleanos mostrando Sim/Não (não true/false)
[ ] Salvar sessão de treino → chamar RPC award_workout_points
[ ] Ranking → consulta sem filtro de tenant_id (competição global)
[ ] Ranking → sem guard de módulo
[ ] CREF → campo no perfil do personal e exibição no portal do aluno
[ ] Upload de fotos → path {tenant_id}/{student_id}/{uuid}.{ext}
[ ] Objetivo do aluno → select com opções predefinidas + campo "Outros"
[ ] Reset de senha → botão usando edge function reset-student-password
[ ] Histórico de treinos → exibir campos de wearable (distance_meters, wearable_device, etc.)
[ ] Data de nascimento → salvar em YYYY-MM-DD, exibir em DD/MM/AAAA
[ ] Telefone → exibir formatado como (XX) XXXXX-XXXX
```

---

## 6. QUERIES ÚTEIS PARA VALIDAÇÃO

```sql
-- Verificar pontuação atual do ranking
SELECT mp.student_id, s.full_name, mp.total_points, mp.workouts_completed, mp.tenant_id
FROM monthly_points mp JOIN students s ON s.id = mp.student_id
WHERE mp.month = EXTRACT(MONTH FROM NOW()) AND mp.year = EXTRACT(YEAR FROM NOW())
ORDER BY mp.total_points DESC;

-- Verificar configuração de gamificação
SELECT is_active, pts_workout_completed, min_session_duration_secs, max_pts_per_session
FROM gamification_settings;

-- Verificar CREF cadastrado
SELECT id, business_name, cref FROM tenants WHERE cref IS NOT NULL;

-- Verificar categorias de anamnese existentes
SELECT DISTINCT category FROM anamnese_templates ORDER BY category;

-- Testar função de pontuação
SELECT award_workout_points(
  p_student_id := '<student_uuid>',
  p_duration_secs := 120,
  p_exercises_count := 5,
  p_all_done := true
);
```

---

*Gerado em 25/06/2026 | Projeto: Strive Personal App | Banco: lodetzmtsymvnjffmvat (Supabase)*
