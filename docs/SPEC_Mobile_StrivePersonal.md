# Spec Driven Development (SDD) - Strive Personal Mobile

## 1. Introdução
Este documento define as especificações técnicas para o desenvolvimento do aplicativo mobile Strive Personal. A abordagem Spec Driven Development assegura que a arquitetura, os componentes e as integrações sejam planejados antes da implementação, garantindo paridade com a aplicação web existente e o uso eficiente do Supabase.

## 2. Arquitetura e Stack
A aplicação mobile será construída utilizando tecnologias modernas e compatíveis com o ecossistema existente:
- **Framework Base:** React Native gerido pelo Expo (versão 54).
- **Linguagem:** TypeScript para tipagem estática e segurança.
- **Roteamento:** Expo Router, permitindo navegação baseada em arquivos (file-based routing) similar ao Next.js utilizado na web.
- **Estilização:** NativeWind para utilizar classes utilitárias do Tailwind CSS, facilitando a replicação do Design System.
- **Backend as a Service (BaaS):** Supabase SDK (`@supabase/supabase-js`) para autenticação, banco de dados e storage.
- **Gerenciamento de Estado Local:** Zustand ou React Context API para estados globais (ex: tema, dados do usuário).

## 3. Estrutura de Diretórios (Proposta)
O projeto mobile deverá ser inicializado em um repositório separado, mas a estrutura de pastas seguirá um padrão claro:

```
strive-personal-mobile/
├── app/                  # Rotas da aplicação (Expo Router)
│   ├── (auth)/           # Telas de login e recuperação de senha
│   ├── (tabs)/           # Navegação principal (Bottom Tabs)
│   │   ├── index.tsx     # Home
│   │   ├── treinos.tsx
│   │   ├── progresso.tsx
│   │   └── perfil.tsx
│   └── _layout.tsx       # Layout raiz e provedores de contexto
├── src/
│   ├── components/       # Componentes de UI reutilizáveis (botões, cards)
│   ├── hooks/            # Custom hooks (ex: useAuth, useTenant)
│   ├── lib/              # Configurações de bibliotecas (Supabase client)
│   ├── services/         # Funções de acesso a dados (APIs)
│   ├── theme/            # Variáveis do Design System (cores, fontes)
│   └── types/            # Tipagens TypeScript geradas pelo Supabase
├── assets/               # Imagens, fontes e ícones
├── app.json              # Configurações do Expo
└── package.json
```

## 4. Integração com Supabase
O aplicativo consumirá o mesmo projeto Supabase da aplicação web. As seguintes integrações são críticas:

### 4.1. Autenticação
O fluxo de autenticação utilizará o método de email e senha. É necessário configurar o armazenamento seguro da sessão utilizando bibliotecas como `expo-secure-store` para persistir o token do Supabase.

### 4.2. Acesso a Dados e RLS
As tabelas principais (`students`, `workout_plans`, `attendance`, `student_progress`) já possuem políticas de Row Level Security (RLS) configuradas. O aplicativo fará requisições autenticadas, e o Supabase garantirá que o aluno acesse apenas seus próprios dados. As funções de serviço (`src/services`) devem mapear as queries utilizadas nas *Server Actions* da web para o client SDK no mobile.

### 4.3. Upload de Arquivos (Storage)
O módulo de progresso permite o upload de fotos. O aplicativo deverá utilizar a API de câmera/galeria do Expo (`expo-image-picker`) para capturar imagens, validá-las localmente (tamanho máximo de 5MB e formatos suportados) e enviá-las para o bucket `progress-photos` do Supabase.

## 5. Implementação do Design System
O Design System deve ser centralizado no diretório `src/theme`. As cores primárias, que variam de acordo com o tenant (white-label), devem ser aplicadas dinamicamente.

- **Cores Fixas:** Deep Space (`#0E0E1A`), Midnight (`#1A1A2E`), Textos (`#FFFFFF`, `#B0B0C3`).
- **Cor Dinâmica:** O `primary_color` do tenant será buscado após o login e armazenado no estado global, sendo injetado nos componentes via props ou contexto de tema.
- **Fontes:** As fontes `Syncopate` e `DM Sans` devem ser carregadas no carregamento inicial do app (Splash Screen) utilizando `expo-font`.

## 6. Fluxos Críticos a Desenvolver
1. **Fluxo de Login e Inicialização:** Autenticar usuário -> Buscar perfil e `tenant_id` -> Buscar dados do tenant (cor, logo) -> Redirecionar para a Home.
2. **Execução de Treino:** A tela de execução deve gerenciar estados complexos, como o timer de descanso, o registro de carga por série e a marcação de conclusão, garantindo que os dados sejam salvos no Supabase ao finalizar a sessão.
3. **Sincronização de Progresso:** Garantir que o upload de fotos de progresso trate adequadamente falhas de rede e forneça feedback visual (progress bar) ao usuário.

## 7. Estratégia de Testes
- **Testes Unitários:** Utilizar Jest para testar funções de cálculo (ex: IMC) e validações de formulário.
- **Testes de Componentes:** Utilizar React Native Testing Library para verificar a renderização correta de componentes de UI.
- **Testes E2E (Opcional):** Configurar Detox para testar os fluxos críticos de login e execução de treino em emuladores.
