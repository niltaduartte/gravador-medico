-- =====================================================
-- FORÇAR ATUALIZAÇÃO: Pedido 106031177 → PAGO
-- =====================================================
-- A Appmax atualizou para "Pago", mas o webhook não chegou
-- Vamos atualizar manualmente no banco
-- =====================================================

-- PASSO 1: Atualizar status para 'paid'
UPDATE public.sales
SET 
    status = 'paid',
    updated_at = NOW(),
    metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{manual_update}',
        jsonb_build_object(
            'updated_at', NOW()::text,
            'reason', 'appmax_approved_but_webhook_not_received',
            'old_status', 'fraud_analysis',
            'new_status', 'paid'
        )
    )
WHERE appmax_order_id = '106031177'
RETURNING 
    id,
    appmax_order_id,
    customer_name,
    status,
    total_amount,
    updated_at;

-- PASSO 2: Verificar a atualização
SELECT 
    id,
    appmax_order_id,
    customer_name,
    customer_email,
    status,
    total_amount,
    payment_method,
    created_at,
    updated_at
FROM public.sales 
WHERE appmax_order_id = '106031177';

-- PASSO 3: Verificar que NÃO aparece mais na view fraud_analysis
SELECT COUNT(*) as total_in_fraud_analysis
FROM sales_fraud_analysis
WHERE appmax_order_id = '106031177';
-- Deve retornar 0

-- PASSO 4: Ver todos os pedidos pagos recentemente
SELECT 
    appmax_order_id,
    customer_name,
    status,
    total_amount,
    updated_at
FROM public.sales
WHERE status = 'paid'
ORDER BY updated_at DESC
LIMIT 10;

-- =====================================================
-- RESULTADO ESPERADO
-- =====================================================
-- ✅ Status atualizado para 'paid'
-- ✅ Pedido SAI do card "Análise Antifraude"
-- ✅ Dashboard atualiza em até 30 segundos via Realtime
-- ✅ CRM recebe atualização e move lead para "won" automaticamente
-- =====================================================
