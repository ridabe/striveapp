import type { StudentContext } from '../retrieval/student-context.ts';

const MAX_BASE_PERSONA = `
Você é Max Strive, assistente especialista de personal training do app Strive Personal.

- Fale em portugues do Brasil, de forma objetiva e profissional.
- Priorize respostas curtas, praticas e com numeros reais do contexto.
- Use o nome do aluno e do personal na primeira frase quando isso ajudar.
- Nunca invente dados nem extrapole alem do contexto fornecido.
- Dor, lesao ou sintoma clinico: orientar avaliacao presencial de profissional de saude.
- Escopo: treino, execucao, progressao de carga, recuperacao e orientacoes fitness basicas.
`.trim();

export function buildMaxSystemPrompt(ctx: StudentContext, personalName: string): string {
  return `${MAX_BASE_PERSONA}\n\n---\n\n${formatContextSection(ctx, personalName)}`;
}

/**
 * Monta um contexto compacto do aluno para reduzir custo recorrente de input.
 */
function formatContextSection(ctx: StudentContext, personalName: string): string {
  const lines: string[] = [];

  lines.push(`CASO ATUAL`);
  lines.push(`- Personal: ${personalName}`);
  lines.push(`- Aluno: ${ctx.student.name}${ctx.student.age ? ` | ${ctx.student.age} anos` : ''}${ctx.student.goal ? ` | objetivo: ${ctx.student.goal}` : ''}`);

  if (ctx.latestAssessment) {
    const a = ctx.latestAssessment;
    lines.push(`- Avaliacao: ${joinCompactParts([
      a.assessedAt || null,
      a.weight ? `${a.weight} kg` : null,
      a.height ? `${a.height} cm` : null,
      a.bmi ? `IMC ${a.bmi}` : null,
      a.bodyFat ? `GC ${a.bodyFat}%` : null,
      a.notes ? `obs: ${truncate(a.notes, 120)}` : null,
    ])}`);
  }

  if (ctx.activePlan) {
    const p = ctx.activePlan;
    lines.push(`- Plano ativo: ${p.name}${p.goal ? ` | ${p.goal}` : ''}`);
    for (const routine of p.routines.slice(0, 4)) {
      const items = routine.items.slice(0, 4).map((item) => {
        const prescription = joinCompactParts([
          item.sets && item.reps ? `${item.sets}x${item.reps}` : null,
          item.load,
          item.restSeconds ? `${item.restSeconds}s descanso` : null,
        ]);
        return prescription
          ? `${item.exerciseName} (${prescription})`
          : item.exerciseName;
      });
      const hiddenCount = Math.max(0, routine.items.length - 4);
      lines.push(`- Rotina ${routine.name}: ${items.join('; ')}${hiddenCount ? `; +${hiddenCount} exercicios` : ''}`);
    }
  } else {
    lines.push(`- Plano ativo: nenhum`);
  }

  if (ctx.recentSessions.length > 0) {
    lines.push(`- Sessoes recentes:`);
    for (const s of ctx.recentSessions.slice(0, 3)) {
      lines.push(`  - ${joinCompactParts([
        s.date,
        s.routineName ?? 'Treino livre',
        s.durationMinutes ? `${s.durationMinutes} min` : null,
        s.intensity ? `intensidade ${s.intensity}` : null,
        s.caloriesActive ? `${s.caloriesActive} kcal` : null,
      ])}`);
    }
    lines.push(`- Frequencia 30d: ${ctx.progressSummary.sessionsLast30Days} treinos`);
  } else {
    lines.push(`- Sessoes recentes: nenhuma`);
  }

  lines.push(`- Peso: ${joinCompactParts([
    ctx.progressSummary.currentWeight ? `${ctx.progressSummary.currentWeight} kg atual` : null,
    ctx.progressSummary.weightChangeLast30Days !== null
      ? `variacao 30d ${formatDelta(ctx.progressSummary.weightChangeLast30Days)} kg`
      : null,
  ]) || 'sem dados'}`);

  return lines.join('\n');
}

/**
 * Junta segmentos textuais removendo valores vazios para gerar linhas compactas.
 */
function joinCompactParts(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' | ');
}

/**
 * Limita textos livres longos para evitar inflar o system prompt.
 */
function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

/**
 * Formata variacoes numericas preservando o sinal positivo quando necessario.
 */
function formatDelta(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
