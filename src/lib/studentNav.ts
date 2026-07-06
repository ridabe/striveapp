import { router } from 'expo-router';

/**
 * Volta para o hub de módulos do aluno (tela `alunos/[id]`) em vez de depender
 * do histórico de navegação.
 *
 * Por quê: os módulos do aluno (planos, avaliações, anamnese, frequência,
 * assistente de IA etc.) são registrados como rotas de nível raiz dentro do
 * `Tabs` navigator de `app/(admin)/_layout.tsx` (ocultas da tab bar via
 * `href: null`). Navegar até elas a partir de `alunos/[id]` troca o foco da
 * tab ativa; `router.back()` a partir daí não retorna de forma confiável
 * para o hub do aluno — em vez disso volta para a tab "Início" (dashboard).
 *
 * Use esta função em qualquer tela de módulo que possa ser aberta no escopo
 * de um aluno (ou seja, que receba `studentId` — ou equivalente — via params).
 * Quando não houver `studentId` (tela aberta fora do escopo de um aluno,
 * ex: lista geral de planos), cai de volta no comportamento padrão de
 * `router.back()`.
 */
export function backToStudentHub(studentId?: string | null) {
  if (studentId) {
    router.replace(`/(admin)/alunos/${studentId}` as any);
  } else {
    router.back();
  }
}
