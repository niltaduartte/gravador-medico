-- =====================================================
-- VERIFICAR ESTRUTURA DA TABELA webhooks_logs
-- =====================================================

-- Ver todas as colunas da tabela
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'webhooks_logs'
ORDER BY ordinal_position;

-- Ver um exemplo de registro
SELECT *
FROM public.webhooks_logs
LIMIT 1;
