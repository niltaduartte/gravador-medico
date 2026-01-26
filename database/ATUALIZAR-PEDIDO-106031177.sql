-- =====================================================
-- O PEDIDO JÁ EXISTE! Vamos apenas atualizar o status
-- =====================================================

-- PASSO 1: Ver o pedido atual e seu status
SELECT 
    id,
    appmax_order_id,
    customer_name,
    customer_email,
    status,
    total_amount,
    payment_method,
    created_at,
    paid_at
FROM public.sales 
WHERE appmax_order_id = '106031177';

-- PASSO 2: Atualizar para status fraud_analysis
UPDATE public.sales
SET 
    status = 'fraud_analysis',
    updated_at = NOW()
WHERE appmax_order_id = '106031177'
RETURNING 
    id,
    appmax_order_id,
    customer_name,
    status,
    total_amount,
    created_at;

-- PASSO 3: Verificar se aparece na view de análise antifraude
SELECT 
    id,
    appmax_order_id,
    customer_name,
    customer_email,
    total_amount,
    hours_in_analysis,
    urgency_level,
    created_at
FROM sales_fraud_analysis
WHERE appmax_order_id = '106031177';

-- PASSO 4: Ver TODOS os pedidos em análise antifraude
SELECT 
    appmax_order_id,
    customer_name,
    customer_email,
    total_amount,
    hours_in_analysis,
    urgency_level,
    created_at
FROM sales_fraud_analysis
ORDER BY created_at DESC;

-- =====================================================
-- PRONTO! Agora:
-- 1. Abra o dashboard: /admin/dashboard
-- 2. Procure o card "Análise Antifraude"  
-- 3. O pedido do Gabriel deve estar lá em até 30 segundos!
-- =====================================================
