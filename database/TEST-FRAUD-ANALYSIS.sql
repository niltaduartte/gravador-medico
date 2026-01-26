-- =====================================================
-- SCRIPT DE TESTE: Simular Pedido em Análise Antifraude
-- =====================================================
-- Use este script para testar o novo status
-- =====================================================

-- 1. Verificar se o pedido atual existe (Gabriel Arruda Cardoso)
SELECT 
    id,
    appmax_order_id,
    customer_name,
    customer_email,
    status,
    total_amount,
    payment_method,
    created_at
FROM public.sales
WHERE customer_email = 'gabriel_acardoso@hotmail.com'
AND appmax_order_id = '106031177'
ORDER BY created_at DESC
LIMIT 1;

-- 2. Atualizar para status de análise antifraude (TESTE)
UPDATE public.sales
SET 
    status = 'fraud_analysis',
    updated_at = NOW()
WHERE appmax_order_id = '106031177'
AND status != 'fraud_analysis';

-- 3. Verificar resultado
SELECT * FROM sales_fraud_analysis
WHERE customer_email = 'gabriel_acardoso@hotmail.com';

-- 4. Criar uma venda de teste em análise antifraude
INSERT INTO public.sales (
    appmax_order_id,
    customer_name,
    customer_email,
    customer_phone,
    total_amount,
    subtotal,
    discount,
    status,
    payment_method,
    created_at
) VALUES (
    'TEST_FRAUD_' || FLOOR(RANDOM() * 1000000)::TEXT,
    'Cliente Teste Antifraude',
    'teste.antifraude@gravadormedico.com.br',
    '11999887766',
    97.00,
    97.00,
    0,
    'fraud_analysis',
    'credit_card',
    NOW() - INTERVAL '2 hours' -- Criado há 2 horas
)
RETURNING *;

-- 5. Verificar todas as vendas em análise
SELECT 
    id,
    appmax_order_id,
    customer_name,
    total_amount,
    hours_in_analysis,
    urgency_level,
    created_at
FROM sales_fraud_analysis
ORDER BY created_at DESC;

-- 6. Simular aprovação (executar depois de testar o dashboard)
UPDATE public.sales
SET 
    status = 'approved',
    paid_at = NOW(),
    updated_at = NOW()
WHERE status = 'fraud_analysis'
AND customer_email = 'teste.antifraude@gravadormedico.com.br';

-- =====================================================
-- INSTRUÇÕES
-- =====================================================
-- 1. Execute o comando 2 para atualizar o pedido real
-- 2. Abra o dashboard: /admin/dashboard
-- 3. Verifique se o card "Análise Antifraude" aparece
-- 4. Aguarde 30s e veja a atualização automática
-- 5. Execute o comando 6 para aprovar e ver desaparecer
-- =====================================================
