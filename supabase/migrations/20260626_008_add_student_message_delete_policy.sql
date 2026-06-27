-- Permite que o aluno remova mensagens da própria caixa de entrada.
CREATE POLICY "student_delete_messages" ON student_messages
  FOR DELETE
  TO authenticated
  USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );
