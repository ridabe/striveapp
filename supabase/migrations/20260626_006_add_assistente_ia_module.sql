-- Expande o check constraint de category para incluir 'ia'
ALTER TABLE system_modules DROP CONSTRAINT IF EXISTS system_modules_category_check;
ALTER TABLE system_modules ADD CONSTRAINT system_modules_category_check
  CHECK (category = ANY (ARRAY[
    'treinos'::text, 'acompanhamento'::text, 'financeiro'::text,
    'comunicacao'::text, 'whitelabel'::text, 'futuro'::text, 'ia'::text
  ]));

-- Insere o módulo do Assistente IA
INSERT INTO system_modules (name, slug, description, category, icon, status, available, sort_order)
VALUES (
  'Assistente IA (Vita)',
  'assistente-ia',
  'Assistente inteligente com RAG: gera treinos, analisa evolução, sugere ajuste de carga, motiva alunos e responde dúvidas sobre exercícios.',
  'ia',
  'sparkles',
  'active',
  true,
  99
)
ON CONFLICT (slug) DO NOTHING;
