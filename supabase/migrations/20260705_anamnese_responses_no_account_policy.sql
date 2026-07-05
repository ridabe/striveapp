-- Aluno sem conta de acesso (user_id null) não tem como compartilhar anamnese
-- entre tenants — mantém escopado por tenant_id, igual ao comportamento antigo,
-- pra não ficar inacessível pro próprio personal depois que a policy antiga
-- (baseada só em tenant_id) foi substituída pelas policies baseadas em user_id.
CREATE POLICY "anamnese_responses_personal_no_account" ON anamnese_responses
  FOR ALL
  TO authenticated
  USING (
    get_my_role() = 'personal'
    AND user_id IS NULL
    AND tenant_id = get_my_tenant_id()
  )
  WITH CHECK (
    get_my_role() = 'personal'
    AND user_id IS NULL
    AND tenant_id = get_my_tenant_id()
  );

-- Deixa explícito o WITH CHECK da policy de personal com conta (antes dependia
-- do fallback implícito do Postgres pra USING, mais seguro deixar claro).
DROP POLICY IF EXISTS "anamnese_responses_personal" ON anamnese_responses;
CREATE POLICY "anamnese_responses_personal" ON anamnese_responses
  FOR ALL
  TO authenticated
  USING (
    get_my_role() = 'personal'
    AND EXISTS (
      SELECT 1 FROM students s
      WHERE s.user_id = anamnese_responses.user_id
        AND s.tenant_id = get_my_tenant_id()
    )
  )
  WITH CHECK (
    get_my_role() = 'personal'
    AND EXISTS (
      SELECT 1 FROM students s
      WHERE s.user_id = anamnese_responses.user_id
        AND s.tenant_id = get_my_tenant_id()
    )
  );
