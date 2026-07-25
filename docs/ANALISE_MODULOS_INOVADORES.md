# Análise Competitiva e Propostas de Módulos Inovadores — StrivePersonal

**Data:** 2026-07-25
**Objetivo:** identificar um (ou mais) módulo que diferencie o StrivePersonal de todos os concorrentes do segmento e que seja de uso diário real para o personal trainer.

---

## 1. O que o StrivePersonal já tem hoje

Fonte: tabela `system_modules` (Supabase `strive`) + `docs/onboarding-popup-modulos.md`.

| Categoria | Módulos ativos |
|---|---|
| **Treinos** | `banco-de-exercicios`, `planos-de-treino`, `treinos-extras`, `execucao-do-treino` (timer, registro de carga, bi/tri-série) |
| **Acompanhamento** | `anamnese`, `avaliacoes-fisicas`, `meu-progresso`, `frequencia`, `feedbacks`, `desafios`, `planos-alimentares` |
| **Financeiro** | `faturas`, `estoque` |
| **Comunicação** | `arquivos`, `notificacoes`, `minha-agenda`, `biblioteca_conteudo` (artes prontas editáveis no Canva) |
| **IA** | `assistente-ia` — Max Strive, com RAG (pgvector), gera treino, explica evolução, sugere ajuste de carga, mensagem motivacional, chat Q&A |
| **White-label** | `white-label` — nome, cor, logo, redes do personal |
| **Coming soon** | `chat`, `wearables`, `marketplace` |

**Leitura:** a cobertura funcional já é ampla — inclusive superior à média do mercado brasileiro em três pontos (plano alimentar nativo, IA com RAG, e a biblioteca de conteúdo de marketing). O problema não é *falta de módulo*; é que **todos os módulos atuais são da mesma natureza: registro e consulta de dados**. Ninguém no produto hoje toma decisão pelo personal.

---

## 2. Benchmark do segmento

### Brasil

| Player | Forte | Não tem |
|---|---|---|
| **MFIT Personal** | Anamnese, avaliação física, prescrição, feedback, cobrança, ~1.800 vídeos, MFIT IA para prescrever treino. Em 2026 lançou a **Área de Retenção de Alunos** (sinais de desistência) | Plano alimentar nativo |
| **Tecnofit Personal** | Gratuito para começar, 600 exercícios, avaliação completa, financeiro, perfil público para captar alunos, gestão de espaço/turmas | Nutrição, IA de geração de treino, biblioteca menor |
| **Outros (TreinoAI, VibeFit, MillBody, Conecta)** | Nichados em IA de prescrição ou previsão de cancelamento | Plataforma completa |

### Exterior (referência de teto)

| Player | Forte |
|---|---|
| **Trainerize (ABC)** | Treino + nutrição + **hábitos** + app com marca própria + **video review** para conferência de execução à distância |
| **Everfit** | AI workout builder, nutrição, **hábitos**, automações de jornada do aluno |
| **TrueCoach** | Simples, forte em vídeo; sem IA, sem nutrição, sem app com marca |

### Conclusão do benchmark

O que **já é commodity** (não diferencia mais): prescrição de treino, biblioteca de exercícios com vídeo, avaliação física, anamnese, financeiro, feedback, e — a partir de 2026 — até *IA que gera treino* e *dashboard de risco de evasão*.

O que **ninguém do segmento brasileiro tem**:

1. Treino que **se adapta sozinho** ao estado do aluno no dia (autorregulação por RPE/prontidão).
2. Retenção **prescritiva** (não só o alerta — a ação pronta para executar).
3. **Relatório de evolução automático** que prova o valor do serviço ao aluno.
4. Conferência de **execução por vídeo com análise automática**.
5. Módulo de **hábitos** (existe fora do Brasil, não aqui).

---

## 3. A tese

O personal perde aluno por **churn silencioso** — o aluno reduz a frequência, desanima e some sem cancelar formalmente. E a causa nº 1 de desmotivação apontada no mercado é **treino genérico**: o aluno recebe a mesma planilha independentemente de ter dormido 4h, estar com dor ou estar num pico de forma.

Os concorrentes atacam o **sintoma** (dashboard de risco). O StrivePersonal pode atacar a **causa**: fazer o treino responder ao aluno todo dia, e transformar essa adaptação em prova visível de cuidado individual.

Isso também é estrategicamente esperto: gera um dado proprietário (histórico de prontidão × RPE × carga × resultado) que alimenta o Max Strive e que nenhum concorrente consegue copiar sem antes acumular meses de coleta.

---

## 4. Propostas de módulos — ranqueadas

### 🥇 #1 — `treino-adaptativo` · "Autorregulação Inteligente"

**O módulo carro-chefe. Nenhum concorrente do segmento tem.**

**Como funciona no dia a dia:**

1. **Check-in de prontidão (15 segundos):** antes de iniciar o treino, o aluno responde 3 toques — sono, dor muscular, energia. Gera um *Readiness Score* (0–100).
2. **Ajuste automático da sessão:** o app recalcula a sessão do dia dentro dos limites que o personal definiu:
   - Readiness alto → sugere +2,5% a +5% de carga ou +1 série no exercício principal.
   - Readiness baixo → reduz volume, corta séries acessórias, mantém o padrão de movimento.
   - Dor localizada reportada → sugere substituição do exercício por outro do mesmo grupo muscular do banco do personal.
3. **RPE/RIR na execução:** ao fechar a série, o aluno marca o esforço (escala visual 1–10 ou "quantas sobraram no tanque"). O sistema compara com o RPE-alvo prescrito e ajusta a próxima série **na hora**.
4. **Guardrails do personal:** o personal define por aluno/plano — teto de ajuste (ex.: ±10%), exercícios que nunca podem ser alterados, se o ajuste é automático ou precisa de aprovação dele.
5. **Digest para o personal:** notificação só quando importa — "João está 3 sessões seguidas com readiness < 40" ou "Ana bateu RPE 7 num peso prescrito para RPE 9 — hora de progredir a carga".

**Por que é matador:** resolve a dor real do aluno que treina sozinho ("essa carga está certa hoje?") e a dor do personal ("não consigo estar em 40 academias ao mesmo tempo"). É ciência do treino consolidada (autorregulação por RPE/RIR), hoje presente só em software de alto rendimento (TrainHeroic, Vitruve, Bridge) — nunca em app de personal brasileiro.

**Esforço técnico:** **médio-baixo.** É lógica + dados, sem hardware, sem visão computacional.
- DB: `readiness_checkins`, `set_logs.rpe`, `set_logs.rir`, `adaptation_rules` (por tenant/plano/aluno), `session_adaptations` (auditoria do que foi mudado e por quê).
- Motor de regras determinístico (não precisa de LLM no caminho crítico — mais barato e previsível). O Max entra só para *explicar* o ajuste em linguagem natural.
- Reaproveita 100% do módulo `execucao-do-treino` que já existe.

**Ganho colateral:** cada sessão vira dado estruturado de qualidade — combustível para o Max Strive e base do módulo #2.

---

### 🥈 #2 — `radar-de-retencao` · "Risco + Ação, não só alerta"

MFIT lançou o dashboard de retenção em 2026. **Dashboard não é diferencial — é relatório de defunto.** A diferença aqui é que o módulo não para no alerta.

**Como funciona:**

1. **Score de risco por aluno**, calculado com sinais que o StrivePersonal *já coleta*: queda de frequência vs. baseline do próprio aluno, nota média de feedback caindo, estagnação de carga, fatura em atraso, inatividade no app, readiness em queda (vindo do módulo #1).
2. **Semáforo na lista de alunos** — verde / amarelo / vermelho, com o motivo em uma frase ("frequência caiu 60% nas últimas 2 semanas").
3. **A parte que ninguém tem — a ação pronta:** para cada aluno em risco, o Max gera automaticamente uma intervenção sugerida, e o personal executa com **um toque**:
   - mensagem de retomada personalizada (já escrita, com o contexto do aluno) para enviar via WhatsApp/push;
   - um treino curto de reentrada (20 min) já montado;
   - convite para um `desafio` existente;
   - proposta de reagendamento na `minha-agenda`.
4. **Fila diária "Seus 3 alunos de hoje":** o personal abre o painel e tem no máximo 3 ações do dia. Isso transforma retenção de projeto em rotina.

**Esforço técnico:** **baixo-médio.** Todos os dados já existem no banco. Precisa de: view/materialized view de sinais, job diário (pg_cron ou edge function agendada), tabela `retention_actions`, e um prompt novo no `ai-assistant`.

**ROI:** é o módulo que se paga sozinho na conversa comercial — "esse módulo segura 1 aluno por mês, ele já pagou a assinatura".

---

### 🥉 #3 — `relatorio-de-evolucao` · "A prova do seu trabalho"

**O aluno cancela porque não enxerga o resultado, não porque ele não existe.**

**Como funciona:** todo mês (ou ao fim de um ciclo de treino), o sistema gera automaticamente um relatório com a marca do personal (white-label já existe) reunindo:

- volume total levantado, evolução de carga por exercício principal, PRs batidos no período;
- frequência e maior streak;
- comparativo de medidas e fotos de avaliação lado a lado;
- adesão ao plano alimentar;
- **narrativa escrita pelo Max**: "Ricardo, em julho você levantou 12% mais volume que em junho e bateu 3 recordes pessoais no agachamento. Sua constância nas quartas ainda é o ponto fraco — é onde vamos focar em agosto."
- envio em PDF/imagem, com uma versão **compartilhável no Instagram** (encaixa direto na `biblioteca_conteudo` → vira marketing orgânico do personal).

**Esforço técnico:** **baixo.** Consulta agregada + template + geração de PDF/imagem + agendamento. Zero risco técnico.

**Por que importa:** é o único módulo da lista que faz o **aluno** virar canal de aquisição do personal.

---

### 🎯 #4 — `max-vision` · Análise de execução por vídeo (a aposta de marketing)

O aluno grava uma série pelo celular; o app extrai os pontos articulares (pose estimation on-device — MediaPipe/MoveNet), calcula ângulos, amplitude de movimento, tempo sob tensão e simetria; o Max redige o feedback técnico e **o personal valida/edita antes de enviar**.

- Trainerize tem *video review*, mas 100% manual. Nenhum player brasileiro tem análise automática.
- É o recurso de maior impacto em demonstração e captação ("o app confere sua execução").

**Esforço técnico:** **alto** — e o risco não é a IA, é o ambiente: iluminação de academia, ângulo de câmera, oclusão por outras pessoas. **Recomendação: não começar por aqui.** Fazer depois do #1, e começar por **1 ou 2 exercícios** (agachamento e supino), com o personal sempre no circuito de validação. Nunca posicionar como diagnóstico automático — posicionar como "o Max prepara a análise, o personal assina".

---

### #5 — `habitos` (complemento barato)

Água, passos, sono, proteína, cardio — checkboxes diários com streak. Existe no Trainerize e no Everfit, **não existe no Brasil**. Esforço muito baixo, reaproveita a mecânica de `desafios` e `frequencia`, e alimenta o readiness do módulo #1 e o score do #2.

Não é revolucionário sozinho — mas é o cimento entre os três primeiros módulos.

---

## 5. Recomendação final

**Construir o #1 como flagship, com o #2 e o #3 como camada de valor imediata.** Os três formam um ciclo fechado que nenhum concorrente tem inteiro:

```
Check-in de prontidão  →  treino se adapta  →  dado rico de RPE/carga/adesão
        ↑                                                  ↓
  aluno permanece  ←  relatório prova o resultado  ←  radar detecta risco e prescreve ação
```

**Posicionamento comercial sugerido:** *"O único app em que o treino se ajusta ao aluno todo dia — e que avisa você antes do aluno sumir."*

**Ordem sugerida de execução:**

| Fase | Módulo | Esforço | Por quê nessa ordem |
|---|---|---|---|
| 1 | `treino-adaptativo` (readiness + RPE + ajuste) | Médio-baixo | É o diferencial e gera o dado que os outros consomem |
| 2 | `relatorio-de-evolucao` | Baixo | Entrega valor visível rápido, usa dado que já existe |
| 3 | `radar-de-retencao` | Baixo-médio | Fica muito mais forte com o dado de readiness já rodando |
| 4 | `habitos` | Baixo | Complemento, amplia sinais do radar |
| 5 | `max-vision` | Alto | Aposta de marca, depois da base sólida |

**Sobre `wearables` (já em coming_soon):** vale reposicionar como *feature do módulo #1*, não como módulo independente. Sono e HRV do relógio alimentam o Readiness Score automaticamente — o check-in de 3 toques vira zero toque. É a evolução natural, não um produto separado.

---

## 6. Pontos de atenção

- **Responsabilidade profissional:** o ajuste automático precisa ser sempre *dentro dos limites definidos pelo personal*, com auditoria (`session_adaptations`) do que mudou e por quê. O personal é o profissional responsável — o sistema é ferramenta, nunca prescritor autônomo. Isso também é o argumento de venda: "você continua no comando, o app só executa sua regra quando você não está lá".
- **Não usar LLM no caminho crítico do ajuste:** motor de regras determinístico decide; o Max só explica. Mais barato, mais rápido, mais auditável.
- **Fricção do check-in é o maior risco de adoção do #1.** Se passar de 15 segundos, o aluno abandona. Testar com 3 perguntas, ícones grandes, sem texto livre.
- **Validar antes de construir:** as propostas acima vêm de análise de mercado e do código atual, não de entrevista com os personais usuários do Strive. Vale rodar a hipótese com 5–10 personais da base antes de comprometer a fase 1.

---

## Fontes

- [MFIT Personal — atualizações 2026 (Área de Retenção)](https://blog.mfitpersonal.com.br/mfit-personal-atualizacoes-app-2026/)
- [Tecnofit Personal — soluções](https://www.tecnofit.com.br/solucoes-tecnofit-personal/)
- [Melhor App para Personal Trainer em 2026 — TreinoAI](https://www.treinoai.com.br/academy/blog/melhor-app-para-personal-trainer-2026)
- [Comparativo Personal/Nutricionista 2026 — VibeFit](https://appvibefit.com/blog/melhor-app-personal-trainer-2026)
- [Everfit vs Trainerize vs TrueCoach (2026)](https://blog.everfit.io/everfit-vs-trainerize-vs-truecoach)
- [Como prever cancelamento de alunos com IA — Conecta Fitness](https://blog.conecta.fitness/como-prever-cancelamento-alunos-ia-personal-trainer/)
- [Treinos genéricos e evasão — FitFlow Pro](https://www.fitflowpro.com.br/blog/treinos-genericos-estao-fazendo-sua-academia-perder-alunos)
- [Human Pose Estimation em fitness — MobiDev](https://mobidev.biz/blog/human-pose-estimation-technology-guide)
