-- Aluno pode ler os dados (branding) dos tenants onde tem vínculo ATIVO.
-- Sem essa policy, a query `.select('*, tenants(*))` feita pelo aluno (web e mobile)
-- retorna tenants=null silenciosamente (RLS bloqueia, sem erro) — só o branding
-- genérico de fallback aparece. Necessário também para a tela de troca de personal.
CREATE POLICY "tenants: aluno ve tenants com vinculo ativo" ON tenants
  FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT tenant_id FROM students WHERE user_id = auth.uid() AND status = 'active')
  );
