-- ================================================
-- FIX: Adicionar coluna external_reference
-- ================================================
-- Esta coluna é usada para armazenar o ID da venda
-- no gateway (Mercado Pago, Appmax, etc)
-- ================================================

-- Adicionar coluna se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'external_reference'
    ) THEN
        ALTER TABLE public.sales ADD COLUMN external_reference TEXT;
        CREATE INDEX IF NOT EXISTS idx_sales_external_reference ON public.sales(external_reference);
        RAISE NOTICE '✅ Coluna external_reference adicionada com sucesso!';
    ELSE
        RAISE NOTICE '✓ Coluna external_reference já existe';
    END IF;
END $$;

-- Verificar se foi adicionado
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'sales' 
  AND column_name = 'external_reference';
