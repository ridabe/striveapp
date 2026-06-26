import type { StudentContext } from '../retrieval/student-context.ts';

const MAX_BASE_PERSONA = `
Você é Max Strive, assistente especialista de personal training do app Strive Personal.

IDENTIDADE:
- Você tem formação em educação física e especialização em fisiologia do exercício
- Seu nome é Max Strive — combine confiança de campeão com a seriedade de um profissional
- Você representa o personal trainer que auxiliara outros Personais — fale como parceiro de confiança, não como robô

TOM E ESTILO:
- Direto e objetivo: o aluno está no app para treinar, não para ler parágrafos e o personal dele precisara de ajuda para montar seus treinos
- Encorajador, mas honesto — não elogie sem razão, não esconda problemas reais
- Use português brasileiro natural; gírias leves do universo fitness são bem-vindas
- Respostas curtas (até 4 parágrafos). Se precisar de mais, use tópicos
- Nomes próprios sempre: use o nome do aluno e do Personal na primeira frase

EXPERTISE:
- Prescrição de treino por objetivo (hipertrofia, emagrecimento, força, condicionamento)
- Periodização e sobrecarga progressiva
- Técnica de execução e substituição de exercícios
- Nutrição esportiva básica
- Recuperação, sono e gestão de fadiga

REGRAS INVIOLÁVEIS:
- Nunca invente dados que não estejam no contexto fornecido
- Para lesões, dores ou sintomas médicos: "Isso merece atenção presencial de um profissional de saúde"
- Nunca substitua consulta médica ou fisioterapêutica
- Se o Personal pedir algo fora do escopo de treino/saúde, redirecione gentilmente
`.trim();

export function buildMaxSystemPrompt(ctx: StudentContext, personalName: string): string {
  return `${MAX_BASE_PERSONA}\n\n---\n\n${formatContextSection(ctx, personalName)}`;
}

function formatContextSection(ctx: StudentContext, personalName: string): string {
  const lines: string[] = [
    `CONSULTA ATUAL — o Personal ${personalName} está pedindo sua análise sobre o seguinte aluno:`,
  ];

  // Perfil básico
  lines.push(`\nPERFIL:`);
  lines.push(`- Nome: ${ctx.student.name}`);
  if (ctx.student.age)  lines.push(`- Idade: ${ctx.student.age} anos`);
  if (ctx.student.goal) lines.push(`- Objetivo: ${ctx.student.goal}`);

  // Avaliação física
  if (ctx.latestAssessment) {
    const a = ctx.latestAssessment;
    lines.push(`\nAVALIAÇÃO FÍSICA (${a.assessedAt}):`);
    if (a.weight)    lines.push(`- Peso: ${a.weight} kg`);
    if (a.height)    lines.push(`- Altura: ${a.height} cm`);
    if (a.bmi)       lines.push(`- IMC: ${a.bmi}`);
    if (a.bodyFat)   lines.push(`- Gordura corporal: ${a.bodyFat}%`);
    if (a.notes)     lines.push(`- Obs: ${a.notes}`);
  }

  // Plano de treino ativo
  if (ctx.activePlan) {
    const p = ctx.activePlan;
    lines.push(`\nPLANO DE TREINO ATIVO: "${p.name}"`);
    if (p.goal) lines.push(`- Objetivo do plano: ${p.goal}`);
    for (const routine of p.routines) {
      lines.push(`\n  ${routine.name}:`);
      for (const item of routine.items) {
        const load = item.load ? ` | ${item.load}` : '';
        const rest = item.restSeconds ? ` | descanso ${item.restSeconds}s` : '';
        lines.push(`    • ${item.exerciseName} — ${item.sets}x${item.reps}${load}${rest}`);
      }
    }
  } else {
    lines.push(`\nPLANO DE TREINO: nenhum plano ativo no momento`);
  }

  // Histórico recente de sessões
  if (ctx.recentSessions.length > 0) {
    lines.push(`\nÚLTIMAS SESSÕES (${ctx.recentSessions.length}):`);
    for (const s of ctx.recentSessions.slice(0, 5)) {
      const dur   = s.durationMinutes ? ` | ${s.durationMinutes} min` : '';
      const int   = s.intensity ? ` | intensidade: ${s.intensity}` : '';
      const kcal  = s.caloriesActive ? ` | ${s.caloriesActive} kcal` : '';
      lines.push(`- ${s.date}: ${s.routineName ?? 'Treino livre'}${dur}${int}${kcal}`);
    }
    lines.push(`- Frequência últimos 30 dias: ${ctx.progressSummary.sessionsLast30Days} treinos`);
  } else {
    lines.push(`\nHISTÓRICO: nenhuma sessão registrada ainda`);
  }

  // Evolução de peso
  if (ctx.progressSummary.currentWeight) {
    lines.push(`\nEVOLUÇÃO DE PESO:`);
    lines.push(`- Peso atual: ${ctx.progressSummary.currentWeight} kg`);
    if (ctx.progressSummary.weightChangeLast30Days !== null) {
      const delta = ctx.progressSummary.weightChangeLast30Days;
      const sinal = delta > 0 ? `+${delta}` : `${delta}`;
      lines.push(`- Variação últimos 30 dias: ${sinal} kg`);
    }
  }

  return lines.join('\n');
}
