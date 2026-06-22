# Product Requirements Document (PRD) - Strive Personal Mobile

## 1. Visão Geral do Produto
O aplicativo mobile Strive Personal é a interface nativa do aluno para a plataforma Strive Personal. Enquanto o personal trainer gerencia seus alunos, treinos e finanças via painel web, o aluno utiliza o app mobile para acessar sua rotina de exercícios, registrar progresso, responder anamneses e interagir com seu treinador. O app deve refletir a identidade visual do personal trainer (white-label) e manter paridade funcional com a atual Área do Aluno na web.

## 2. Objetivos
- Fornecer uma experiência mobile nativa e fluida para os alunos.
- Garantir a aplicação do Design System unificado (cores, tipografia, espaçamento).
- Manter a mesma base de dados (Supabase) e regras de negócio do projeto web.
- Implementar a arquitetura white-label, onde a cor primária e logo do tenant são aplicadas dinamicamente.

## 3. Escopo Funcional

### 3.1. Autenticação e White-label
- **Login:** O aluno faz login com e-mail e senha. O app deve identificar o `tenant_id` associado ao perfil do aluno.
- **Customização:** Após o login, o app carrega a cor primária e o nome/logo do negócio (tenant) e aplica na interface (ex: botões, headers, splash screen).

### 3.2. Navegação Principal (Bottom Navigation)
A navegação deve seguir o padrão mobile com as seguintes abas:
- **Início:** Dashboard resumido com saudação, streak de treinos, plano ativo e atalhos rápidos.
- **Treinos:** Lista de planos de treino ativos e acesso à execução.
- **Progresso:** Registro e histórico de peso e fotos.
- **Perfil/Mais:** Acesso a módulos secundários (Frequência, Anamnese, Avaliação, Financeiro, Feedback, Nutrição, Agenda) e configurações da conta.

### 3.3. Módulos do Aluno
- **Início (Home):** Exibe o nome do aluno, nome do personal, streak atual (dias seguidos de treino) e o plano ativo em destaque.
- **Meus Treinos & Execução:** 
  - Listagem dos planos ativos.
  - Tela de preview do treino (lista de exercícios, séries, repetições, carga).
  - Modo de execução (timer de descanso, marcação de séries concluídas, ajuste de carga).
- **Treinos Extras:** Acesso a treinos avulsos não vinculados ao plano principal.
- **Meu Progresso:** Adição de novas entradas (peso, fotos, notas) e visualização do histórico. Limite de upload de 5 fotos (máx 5MB cada).
- **Frequência:** Calendário visualizando os dias treinados (check-ins automáticos baseados nas sessões concluídas).
- **Anamnese:** Formulário para o aluno preencher seu histórico de saúde e objetivos.
- **Avaliação Física:** Visualização do histórico de avaliações (peso, medidas, % de gordura, fotos) inseridas pelo personal.
- **Feedback:** Avaliação do treino após a conclusão (nota de 1 a 5 estrelas e comentários).
- **Financeiro:** Visualização de faturas (pendentes, pagas, vencidas).

## 4. Design System e Interface
O aplicativo seguirá estritamente o Design System estabelecido:
- **Cores:** 
  - Fundo Principal: `#0E0E1A` (Deep Space)
  - Superfície de Cards: `#1A1A2E` (Midnight)
  - Bordas/Divisores: `#2A2A45` (Brand Dark)
  - Destaque/CTA: Dinâmico (Cor do Tenant, default `#E8FF47` Lime Volt)
  - Textos: `#FFFFFF` (Principal), `#B0B0C3` (Secundário)
- **Tipografia:**
  - Títulos/Display: Syncopate (Bold)
  - Corpo/Body: DM Sans (Regular, Medium, Bold)
- **Espaçamento e Grid:** Baseado na escala de 4px (xs) a 64px (3xl). Border radius padrão de 12px (lg) para cards e 16px (xl) para modais.
- **Telas de Referência:** Home, Execução de Treino e Evolução.

## 5. Regras de Negócio e Restrições
- **Acesso Exclusivo:** O aplicativo mobile é exclusivo para usuários com a role `student`. Administradores (`personal`) acessam apenas via web.
- **Isolamento de Dados (RLS):** Todas as consultas ao Supabase devem respeitar as políticas de Row Level Security já configuradas, garantindo que o aluno veja apenas seus próprios dados.
- **Upload de Arquivos:** Fotos de progresso devem ser validadas (tamanho máximo e formato) antes do upload para o Supabase Storage.

## 6. Stack Tecnológica
- **Framework:** React Native com Expo (versão 54).
- **Backend/BaaS:** Supabase (Auth, Database PostgreSQL, Storage, Functions).
- **Estilização:** Tailwind CSS (via NativeWind) ou StyleSheet seguindo as variáveis do Design System.
- **Navegação:** Expo Router.
