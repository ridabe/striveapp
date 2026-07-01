# Graph Report - .  (2026-06-30)

## Corpus Check
- 14 files · ~1,378,566 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1106 nodes · 1992 edges · 118 communities (91 shown, 27 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.85)
- Token cost: 28,534 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Student Header Component & Related Screens|Student Header Component & Related Screens]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Student Physical Assessment Screen|Student Physical Assessment Screen]]
- [[_COMMUNITY_Student Ranking Screen|Student Ranking Screen]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Student Agenda Screen|Student Agenda Screen]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Student Meal Plans Screen|Student Meal Plans Screen]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Student Files Screen|Student Files Screen]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Student Feedback Screen|Student Feedback Screen]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Student Attendance Screen|Student Attendance Screen]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Student Anamnese Screen|Student Anamnese Screen]]
- [[_COMMUNITY_Student Finance Screen|Student Finance Screen]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Graphify Project Rule (CLAUDE.md)|Graphify Project Rule (CLAUDE.md)]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 109|Community 109]]
- [[_COMMUNITY_Community 110|Community 110]]
- [[_COMMUNITY_Community 111|Community 111]]
- [[_COMMUNITY_Community 112|Community 112]]
- [[_COMMUNITY_Community 113|Community 113]]
- [[_COMMUNITY_Community 116|Community 116]]

## God Nodes (most connected - your core abstractions)
1. `useThemeStore` - 79 edges
2. `useAuthStore` - 61 edges
3. `Colors` - 56 edges
4. `FontFamily` - 53 edges
5. `FontSize` - 50 edges
6. `supabase` - 44 edges
7. `useStudent()` - 25 edges
8. `useModulesStore` - 21 edges
9. `expo` - 19 edges
10. `muscleColor()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `AdminLayout()` --calls--> `useThemeStore`  [EXTRACTED]
  app/(admin)/_layout.tsx → src/stores/themeStore.ts
- `AdminAgendaScreen()` --calls--> `useAuthStore`  [EXTRACTED]
  app/(admin)/agenda.tsx → src/stores/authStore.ts
- `AdminAgendaScreen()` --calls--> `useThemeStore`  [EXTRACTED]
  app/(admin)/agenda.tsx → src/stores/themeStore.ts
- `StudentDetailScreen()` --calls--> `useThemeStore`  [EXTRACTED]
  app/(admin)/alunos/[id].tsx → src/stores/themeStore.ts
- `AlunosScreen()` --calls--> `useAuthStore`  [EXTRACTED]
  app/(admin)/alunos/index.tsx → src/stores/authStore.ts

## Import Cycles
- None detected.

## Communities (118 total, 27 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (47): calcAge(), fmtBirth(), getModuleLabel(), MEDAL, ModuleCounts, MONTH_NAMES, RankingInfo, s (+39 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (48): dependencies, expo, expo-av, expo-build-properties, expo-constants, expo-document-picker, expo-file-system, expo-font (+40 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (38): ExItem, fmtTime(), INTENSITIES, Phase, PlanExecutionScreen(), RestRing(), rt, s (+30 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (36): backgroundColor, foregroundImage, adaptiveIcon, minSdkVersion, package, permissions, versionCode, projectId (+28 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (32): Agenda de Hoje (Today's Schedule List), Alunos Recentes (Recent Students List), Ana Lima (student, Hipertrofia - Pernas, 92%), Play Store Screenshot: Onboarding - Treinos Personalizados, Bruno Melo (student, Funcional + Core, 78%), Carla Souza (student, Cardio & Mobilidade, 95%, avaliacao pendente), Carlos Trainer (Personal Trainer, logged-in user), "Começar Agora" CTA Button (+24 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (25): apiFetch(), buildBaseRecord(), fetchExercises(), IMPORT_LIMIT, main(), MAX_API_CALLS, PAGE_SIZE, REQUEST_DELAY_MS (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (27): Edge Function ai-assistant (index.ts), npm:@anthropic-ai/sdk@0.39.0, Supabase Edge Functions (Deno) backend, Edge Function embed-exercises (index.ts), Tabela exercise_embeddings (pgvector), Feature 1 — Gerar Treino pelo Objetivo, Feature 2 — Explicar Evolução do Aluno, Feature 3 — Sugerir Ajuste de Carga (+19 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (16): AlunosScreen(), Student, styles, BancoExerciciosScreen(), Exercise, s, GOAL_COLORS, GOALS (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (15): AnamneseField, AnamneseResponse, AnamneseScreen(), CATEGORY_ICONS, CATEGORY_LABELS, DEFAULT_CATEGORIES, fe, FIELD_TYPES (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (16): s, StoredMessage, StudentMini, IMAGES, MaxAvatar(), MaxAvatarProps, SIZES, styles (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (15): DAY_LABELS, DayCount, dv, fmtDate(), MONTHS, ProgressEntry, ProgressoScreen(), sl (+7 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (15): FEATURES, s, BAR_W, CATEGORY_COLOR, CATEGORY_ICON, DAY_LABELS, DAY_SHORT, ExtraWorkout (+7 more)

### Community 12 - "Community 12"
Cohesion: 0.16
Nodes (15): AssistenteIAScreen(), AssistenteIAChatScreen(), FEATURE_LABELS, PLAN_STEPS, s, StudentMini, Action, ACTIONS (+7 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (15): Assessment, AvaliacaoScreen(), BMIBar(), bmiCategory(), bmiSt, calcBMI(), det, fmtDate() (+7 more)

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (14): Student, ExpoSecureStoreAdapter, SelectedStudentState, useSelectedStudentStore, CompositeTypes, Constants, Database, DatabaseWithoutInternals (+6 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (10): bs, DAY_LABELS, DayCount, fmtDate(), ProgressEntry, ProgressoScreen(), s, WEEK_ORDER (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.23
Nodes (9): styles, AppUpdateAlert(), s, useAppVersion(), Radius, Spacing, FontFamily, FontSize (+1 more)

### Community 17 - "Community 17"
Cohesion: 0.23
Nodes (12): buildAnalyzePrompt(), buildSseResponse(), CORS_HEADERS, handleAnalyzeProgress(), buildSseResponse(), buildSuggestLoadPrompt(), CORS_HEADERS, handleSuggestLoad() (+4 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (8): AdminAgendaScreen(), AgendaEvent, DAY_NAMES_SHORT, es, EVENT_TYPES, MONTH_NAMES, s, TYPE_CONFIG

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (10): AdminDashboard(), DashboardStats, RecentStudent, s, MaxOnboardingModal(), Props, s, STEPS (+2 more)

### Community 20 - "Student Header Component & Related Screens"
Cohesion: 0.15
Nodes (7): INTENSITY_CONFIG, s, s, StudentMessage, s, StudentHeader(), StudentHeaderProps

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (15): App screenshot: Evolução - performance/progress chart screen, Play Store Feature Graphic (1024x500), Tagline: 'Evolução que você vê. Treinos personalizados. Acompanhe cada avanço.', App screenshot: Treino A - Peito e Tríceps (exercise list screen), Tablet Screenshot: Progresso (Evolução) Screen, STRIVE Personal (App Brand), Ana Lima (Aluna, Plano Premium, since Jan 2026), Carlos Trainer (Personal Trainer, logged-in user) (+7 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (9): ArquivosScreen(), categoryFromMime(), FileCategory, fileIcon(), formatSize(), SharedFile, Student, styles (+1 more)

### Community 23 - "Community 23"
Cohesion: 0.16
Nodes (11): AttRecord, det, FrequenciaScreen(), MONTHS, s, sl, Student, StudentDetailView() (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.20
Nodes (9): PRESET_COLORS, styles, BENEFITS, styles, StriveLogo(), StriveLogoProps, styles, ColorKey (+1 more)

### Community 25 - "Community 25"
Cohesion: 0.29
Nodes (8): Index(), RootLayout(), useAuth(), useModules(), useTenant(), AuthState, Profile, useAuthStore

### Community 26 - "Student Physical Assessment Screen"
Cohesion: 0.18
Nodes (11): Assessment, AvaliacaoScreen(), BMI_ZONES, BmiBar(), bmiS, bmiZone(), delta, fmtDate() (+3 more)

### Community 27 - "Student Ranking Screen"
Cohesion: 0.15
Nodes (12): Badge, BADGE_CONFIG, HOW_IT_WORKS, hw, MEDAL, MONTH_NAMES, motivationalMessage(), MyPoints (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.21
Nodes (13): AssessmentContext, calcAge(), fetchActivePlan(), fetchLatestAssessment(), fetchProgressSummary(), fetchRecentSessions(), fetchStudent(), fetchStudentContext() (+5 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (11): bioBtn, bioBtnText, dividerLine, dividerRow, dividerText, input, label, LoginScreen() (+3 more)

### Community 30 - "Student Agenda Screen"
Cohesion: 0.15
Nodes (7): AgendaEvent, DAY_NAMES, ec, MONTH_NAMES, s, TYPE_COLOR, TYPE_ICON

### Community 31 - "Community 31"
Cohesion: 0.35
Nodes (13): Brand Dark #2A2A45 - cor primária, bordas e divisores, Deep Space #0E0E1A - cor primária, background principal, Divider #4A4A6A - cor de suporte, divisores, Error Red #EF4444 - cor de suporte, estado de erro, Lime Dark #C8E600 - cor primária, Lime Volt #E8FF47 - cor primária, destaque e CTA, Midnight #1A1A2E - cor primária, superfície de cards, Success Green #22C55E - cor de suporte, estado de sucesso (+5 more)

### Community 32 - "Community 32"
Cohesion: 0.24
Nodes (12): buildPlanSummary(), buildPlanTool(), CORS_HEADERS, errorSse(), fetchAvailableExercises(), formatExerciseList(), GeneratedPlan, handleGeneratePlan() (+4 more)

### Community 33 - "Community 33"
Cohesion: 0.20
Nodes (10): CATEGORY_COLORS, ExtraItem, ExtraWorkout, s, Student, ExercisePickerModal(), ExerciseSummary, Props (+2 more)

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (7): FeedbackItem, FeedbacksScreen(), s, AppVersionRow, UpdateStatus, UseAppVersionResult, supabase

### Community 35 - "Community 35"
Cohesion: 0.20
Nodes (9): DraftFood, fmtMacro(), FoodItem, GOALS, Meal, MEAL_TYPES, Plan, PlanoAlimentarDetailScreen() (+1 more)

### Community 36 - "Student Meal Plans Screen"
Cohesion: 0.18
Nodes (7): FoodItem, GOAL_COLORS, Meal, MEAL_TYPE_LABEL, MealFood, Plan, s

### Community 37 - "Community 37"
Cohesion: 0.24
Nodes (8): Exercise, ExerciseDetailScreen(), s, MediaViewerModal(), Props, s, { width: W, height: H }, muscleColor()

### Community 38 - "Community 38"
Cohesion: 0.20
Nodes (7): EXTRA_CATEGORY_COLORS, PlanosScreen(), s, sp, StudentExtra, StudentPlan, WorkoutPlan

### Community 39 - "Student Files Screen"
Cohesion: 0.20
Nodes (4): FileCategory, s, SharedFile, TYPE_FILTERS

### Community 40 - "Community 40"
Cohesion: 0.27
Nodes (10): Botão 'Ajustar Carga', Botão 'Concluir Série', Exercício: Supino Reto com Barra, Registro de Carga Atual (kg) e Repetições por série, Rastreamento de séries (Série 1-4) com marcação de concluída, Timer circular de descanso (01:30) entre séries, Screenshot Play Store - Execução de Treino (Controle total durante o treino), Barra de navegação inferior: Treino, Histórico, Desempenho, Perfil (+2 more)

### Community 41 - "Community 41"
Cohesion: 0.29
Nodes (10): Supino Reto com Barra (exercise: Barbell Bench Press), Ajustar Carga secondary/outline button, Bottom navigation bar (Treino, Historico, Desempenho, Perfil), Concluir Serie primary button (yellow/lime, completes set), Exercise progress bar (3 de 6 exercicios), tela2_execucao.png - Workout Execution Screen (Rest Timer), Carga Atual (80kg) and Repeticoes (10 reps) stat cards, Rest timer circular countdown (01:30 Descanso) (+2 more)

### Community 42 - "Community 42"
Cohesion: 0.29
Nodes (8): fetchGif(), main(), MAX_API_CALLS, MAX_SESSION_BYTES, REQUEST_DELAY_MS, sleep(), supabase, uploadAndUpdate()

### Community 43 - "Community 43"
Cohesion: 0.20
Nodes (5): EMPTY, FormState, Props, s, STUDENT_GOALS

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (5): ExecucaoScreen(), INTENSITY_CONFIG, s, SessionSummary, StudentSummary

### Community 45 - "Community 45"
Cohesion: 0.22
Nodes (8): AssignedStudent, Plan, PlanDetailScreen(), Routine, s, Student, WorkoutItem, DAYS_OF_WEEK

### Community 46 - "Community 46"
Cohesion: 0.28
Nodes (8): ExGroup, ExItem, ExtraExecutionScreen(), fmtTime(), groupByCombo(), INTENSITIES, Phase, s

### Community 47 - "Community 47"
Cohesion: 0.33
Nodes (9): Assets do Max Strive — LEIA-ME, max-avatar-happy.png (variante comemorando), max-avatar.png (200x200, avatar principal), max-avatar-small.png (chat bubbles, 48x48), max-avatar-thinking.png (variante pensando), Max Strive (personagem/avatar), Claude Sonnet (Anthropic) — geração de linguagem natural, Persona Max Strive (assistente IA) (+1 more)

### Community 48 - "Community 48"
Cohesion: 0.33
Nodes (9): Tablet Screenshot - Execução de Treino (Leg Press), Exercício: Leg Press 45° (4x12, 80kg), Plano de Treino: Hipertrofia - Pernas (Dia 3/4), Lista de Próximos Exercícios, Cronômetro de Descanso entre Séries, Registro de Séries (Registro de Séries), Tela de Execução de Treino, Barra de Navegação Inferior (Início, Alunos, Progresso, Mais) (+1 more)

### Community 49 - "Community 49"
Cohesion: 0.39
Nodes (7): buildSseResponse(), CORS_HEADERS, handleChat(), formatRetrievedContext(), generateEmbedding(), RetrievedExercise, retrieveRelevantExercises()

### Community 50 - "Community 50"
Cohesion: 0.29
Nodes (7): ExtraWorkoutDetailScreen(), CATEGORY_COLOR, Extra, ExtraDetailScreen(), ExtraExercise, s, extraCategoryLabel()

### Community 51 - "Student Feedback Screen"
Cohesion: 0.25
Nodes (5): LABEL_COLORS, LABELS, s, WorkoutFeedback, WorkoutPlan

### Community 52 - "Community 52"
Cohesion: 0.32
Nodes (8): Play Store Screenshot: Minha Evolução (Progresso), Carga Média (kg) line chart over 4 weeks, Frequência Semanal bar chart (SEG-DOM workout completion), Minha Evolução Screen (Progress/Evolution tab), Próxima Meta goal progress bar (Completar 20 treinos em novembro, 75%), Summary stat cards: 7,2kg carga média aumentada, 18 treinos concluídos, 92% aderência semanal, Marketing headline: 'Acompanhe cada avanço em tempo real.', Bottom tab bar: Início, Treinos, Progresso, Perfil

### Community 53 - "Community 53"
Cohesion: 0.32
Nodes (8): Bottom Navigation Bar (Inicio, Treinos, Progresso, Perfil), Exercise List (Supino Reto com Barra, Crucifixo com Halteres, Triceps na Polia, Crossover na Polia, Desenvolvimento com Halteres, Paralelas), Greeting Header ('Bom dia, Lucas! Seu treino de hoje esta pronto.'), tela1_home.png - Home Screen Mockup, Button: 'Iniciar Treino' (Start Workout, primary CTA), Today's Workout Card ('Treino de Hoje - Treino A - Peito e Triceps'), Button: 'Ver Historico' (View History, secondary CTA), Weekly Progress Bar ('Semana: 3 de 5 treinos concluidos - 60%')

### Community 54 - "Community 54"
Cohesion: 0.32
Nodes (8): Barra de navegação inferior: Início, Treinos, Progresso (ativo), Nutrição, Perfil, Gráfico de linha 'Carga média (kg)' com filtro '4 semanas' mostrando progressão semanal: Sem1 64,3kg, Sem2 67,1kg, Sem3 70,5kg, Sem4 71,5kg, Tema visual dark com destaque em verde-limão (neon) usado em gráficos, ícones e elementos ativos, Seção 'Frequência Semanal' com barras diárias (SEG-DOM), legenda Treino concluído/Descanso, destaque em DOM (Hoje), Header 'Minha Evolução' com subtítulo 'Últimos 30 dias' e ícone de calendário, tela3_evolucao.png - Mockup Tela de Evolução/Progresso, Card 'Próxima Meta - Completar 20 treinos em novembro' com barra de progresso 75% concluído, Cards de resumo: Carga média aumentada (7,2 kg), Treinos concluídos (18 treinos), Aderência semanal (92%)

### Community 55 - "Community 55"
Cohesion: 0.25
Nodes (6): COUNT_TYPES, LOAD_TYPES, loadTypeLabel(), MUSCLE_COLORS, MuscleGroup, PLAN_GOALS

### Community 56 - "Community 56"
Cohesion: 0.39
Nodes (7): buildMotivationPrompt(), calcStreak(), CORS_HEADERS, fetchGamificationContext(), GamificationContext, handleMotivation(), sanitizeDirectStudentMessage()

### Community 57 - "Community 57"
Cohesion: 0.29
Nodes (4): CORS_HEADERS, errorResponse(), jsonResponse(), RequestBody

### Community 58 - "Community 58"
Cohesion: 0.29
Nodes (3): PerfilScreen(), Plan, styles

### Community 59 - "Community 59"
Cohesion: 0.29
Nodes (6): AdminRankingScreen(), BADGE_CONFIG, MONTH_NAMES, RankingEntry, s, Snapshot

### Community 60 - "Community 60"
Cohesion: 0.29
Nodes (6): CATEGORY_COLORS, CATEGORY_ICONS, ExtraWorkout, s, TreinosExtrasScreen(), EXTRA_CATEGORIES

### Community 61 - "Student Attendance Screen"
Cohesion: 0.38
Nodes (6): DAYS_HEADER, FrequenciaScreen(), getDaysInMonth(), getFirstDayOfWeek(), MONTHS, s

### Community 62 - "Community 62"
Cohesion: 0.29
Nodes (6): DAY_SHORT, Exercise, Plan, s, Section, GOAL_COLORS

### Community 63 - "Community 63"
Cohesion: 0.33
Nodes (7): tablet_01_dashboard.png - Dashboard do Personal Trainer (tablet), Agenda de Hoje (lista de treinos agendados), Alunos Recentes (lista com status de treino), Cards de resumo: Alunos ativos, Treinos hoje, Frequência média, Navegação inferior: Início, Alunos, Progresso, Mais, Persona: Personal Trainer 'Carlos' (usuário logado), Tela Dashboard (visão Personal Trainer)

### Community 64 - "Community 64"
Cohesion: 0.29
Nodes (7): Tablet Screenshot: Progresso (Evolução), Seção Medidas Corporais (Cintura, Quadril, Braço, Coxa), Seção Última Avaliação (IMC, BF%, VO2 Máx), Tela Progresso / Evolução, Navegação Inferior (Início, Alunos, Progresso, Mais), Ana Lima (Plano Premium), Gráfico Evolução do Peso (kg) Jan-Jun

### Community 65 - "Community 65"
Cohesion: 0.29
Nodes (6): compilerOptions, paths, strict, extends, include, @/*

### Community 66 - "Student Anamnese Screen"
Cohesion: 0.33
Nodes (3): AnamneseTemplate, Mode, s

### Community 67 - "Student Finance Screen"
Cohesion: 0.40
Nodes (4): FinanceiroScreen(), fmtCurrency(), s, STATUS_CONFIG

### Community 68 - "Community 68"
Cohesion: 0.47
Nodes (6): ds_spacing.png - Espaçamento e Estrutura (Strive Personal) design system spacing/grid/elevation reference, Escala de Espaçamento (xs 4px, sm 8px, md 12px, base 16px, lg 24px, xl 32px, 2xl 48px, 3xl 64px), Border Radius (sm 4px, md 8px, lg 12px, xl 16px, full/pill 9999px), Elevação/Camadas: Layer 0 #0E0E1A (Background), Layer 1 #1A1A2E (Cards), Layer 2 #2A2A45 (Modais), Layer 3 #3A3A5A (Tooltips), Grid Mobile: 4 colunas, margens 16px, gutters 8px, Grid Web: 12 colunas, margens 24px, gutters 16px

### Community 69 - "Community 69"
Cohesion: 0.40
Nodes (6): Primary CTA button 'Comecar Agora' (yellow, black text), Feature list (3 items with icons): Treinos personalizados pelo seu coach; Acompanhe sua evolucao em tempo real; Registre cargas e conquiste metas, Headline text 'Evolucao que voce ve.' with subtext 'Acompanhe cada treino, cada serie, cada avanco.', tela4_splash.png - Splash/Onboarding Screen Mockup (STRIVE PERSONAL), Secondary link 'Ja tenho conta. Fazer login', STRIVE PERSONAL logo (hexagon with glowing yellow bar-chart icon)

### Community 70 - "Community 70"
Cohesion: 0.40
Nodes (6): Stack Tecnológica (Expo 54, Supabase, NativeWind, Expo Router), Arquitetura e Stack (React Native/Expo 54, TS, Expo Router, NativeWind, Zustand), Build Android AAB Workflow, build job (EAS local), check-version job, EAS (Expo Application Services) build --local

### Community 71 - "Community 71"
Cohesion: 0.33
Nodes (3): CORS_HEADERS, Feature, RequestBody

### Community 72 - "Community 72"
Cohesion: 0.47
Nodes (4): buildMaxSystemPrompt(), formatContextSection(), MAX_BASE_PERSONA, StudentContext

### Community 73 - "Community 73"
Cohesion: 0.50
Nodes (4): Role global_admin (Admin Global), src/lib/modules.ts ASSISTENTE_IA slug, Tabela system_modules, Tabela tenant_modules

### Community 74 - "Community 74"
Cohesion: 0.50
Nodes (3): config, { getDefaultConfig }, { withNativeWind }

### Community 75 - "Graphify Project Rule (CLAUDE.md)"
Cohesion: 1.00
Nodes (3): Atualização automática via /graphify --update, Consulta ao Graphify antes de mudanças, Graphify Obrigatório (Regra do Projeto)

### Community 76 - "Community 76"
Cohesion: 0.67
Nodes (3): Design System (cores, tipografia, espaçamento), Arquitetura White-label (cor/logo dinâmicos por tenant), Implementação do Design System (src/theme)

## Ambiguous Edges - Review These
- `Supabase Edge Functions (Deno) backend` → `Integração com Supabase (Auth/RLS/Storage)`  [AMBIGUOUS]
  docs/SPEC_Mobile_StrivePersonal.md · relation: conceptually_related_to

## Knowledge Gaps
- **526 isolated node(s):** `name`, `slug`, `version`, `platforms`, `orientation` (+521 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Supabase Edge Functions (Deno) backend` and `Integração com Supabase (Auth/RLS/Storage)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `useThemeStore` connect `Community 7` to `Community 0`, `Community 2`, `Community 8`, `Community 10`, `Community 11`, `Community 13`, `Community 15`, `Community 16`, `Community 18`, `Community 19`, `Community 22`, `Community 23`, `Community 24`, `Community 25`, `Community 33`, `Community 34`, `Community 35`, `Community 37`, `Community 38`, `Community 43`, `Community 44`, `Community 45`, `Community 46`, `Community 50`, `Community 58`, `Community 59`, `Community 60`, `Community 62`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `expo` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `Colors` connect `Community 24` to `Community 0`, `Community 2`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 15`, `Community 16`, `Community 18`, `Community 19`, `Community 22`, `Community 23`, `Community 25`, `Community 29`, `Community 33`, `Community 34`, `Community 35`, `Community 37`, `Community 38`, `Community 43`, `Community 44`, `Community 45`, `Community 46`, `Community 50`, `Community 58`, `Community 59`, `Community 60`, `Community 62`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _527 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05576923076923077 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._