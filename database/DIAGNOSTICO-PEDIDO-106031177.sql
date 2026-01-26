-- =====================================================
-- DIAGNÓSTICO: Pedido 106031177 (Gabriel Arruda Cardoso)
-- =====================================================
-- Por que esse pedido não aparece no painel?
-- =====================================================

-- 1. VERIFICAR SE O PEDIDO EXISTE NO BANCO
SELECT 
    id,
    appmax_order_id,
    customer_name,
    customer_email,
    status,
    total_amount,
    payment_method,
    created_at,
    paid_at,
    updated_at,
    metadata
FROM public.sales
WHERE appmax_order_id = '106031177'
ORDER BY created_at DESC;

-- 2. VERIFICAR TODOS OS PEDIDOS DO GABRIEL
SELECT 
    id,
    appmax_order_id,
    customer_email,
    status,
    total_amount,
    created_at
FROM public.sales
WHERE customer_email ILIKE '%gabriel%acardoso%'
   OR customer_email ILIKE '%gabriel_acardoso@hotmail.com%'
ORDER BY created_at DESC;

-- 3. VERIFICAR WEBHOOKS RECEBIDOS DESSE PEDIDO
SELECT 
    id,
    endpoint,
    event_type,
    payload->>'order_id' as order_id,
    payload->>'appmax_order_id' as appmax_order_id,
    payload->>'status' as status,
    payload->>'customer_email' as customer_email,
    response_status,
    created_at
FROM public.webhooks_logs
WHERE payload->>'order_id' = '106031177'
   OR payload->>'appmax_order_id' = '106031177'
ORDER BY created_at DESC;

-- 4. VERIFICAR ÚLTIMOS WEBHOOKS RECEBIDOS (últimas 24h)
SELECT 
    id,
    endpoint,
    event_type,
    payload->>'order_id' as order_id,
    payload->>'status' as status,
    payload->>'customer_email' as customer_email,
    response_status,
    created_at
FROM public.webhooks_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 5. VERIFICAR CHECKOUT_ATTEMPTS (tentativas de checkout)
SELECT 
    id,
    appmax_order_id,
    customer_email,
    status,
    recovery_status,
    total_amount,
    payment_method,
    created_at,
    converted_at
FROM public.checkout_attempts
WHERE appmax_order_id = '106031177'
   OR customer_email ILIKE '%gabriel%acardoso%'
ORDER BY created_at DESC;

-- 6. CONTAR VENDAS POR STATUS
SELECT 
    status,
    COUNT(*) as total,
    SUM(total_amount) as valor_total
FROM public.sales
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY total DESC;

-- 7. VERIFICAR SE EXISTE NA VIEW DE FRAUD ANALYSIS
SELECT * FROM public.sales_fraud_analysis
WHERE customer_email ILIKE '%gabriel%'
LIMIT 5;

-- =====================================================
-- DIAGNÓSTICO ESPERADO
-- =====================================================
-- Se o pedido NÃO aparecer na query 1:
--    → O webhook NÃO foi recebido ou NÃO criou a venda
--    → Verifique a query 3 para ver se o webhook chegou
--
-- Se o pedido aparecer com status diferente de 'fraud_analysis':
--    → O pedido já foi aprovado/recusado
--    → Execute o comando abaixo para atualizar para teste
--
-- Se o webhook não aparecer na query 3:
--    → A Appmax NÃO está enviando webhooks
--    → Ou a URL do webhook está errada
-- =====================================================

-- 8. SOLUÇÃO: CRIAR MANUALMENTE O PEDIDO PARA TESTE
-- (Executar APENAS se o pedido não existir no banco)
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
    created_at,
    metadata
) VALUES (
    '106031177',
    'Gabriel Arruda Cardoso',
    'gabriel_acardoso@hotmail.com',
    NULL,
    36.00,
    36.00,
    0,
    'fraud_analysis', -- Status atual
    'credit_card',
    '2026-01-26 16:29:00'::timestamp,
    '{"source": "manual_test"}'::jsonb
)
ON CONFLICT (appmax_order_id) DO UPDATE
SET 
    status = 'fraud_analysis',
    updated_at = NOW()
RETURNING *;

-- 9. VERIFICAR SE APARECEU NO DASHBOARD
SELECT 
    id,
    appmax_order_id,
    customer_name,
    total_amount,
    hours_in_analysis,
    urgency_level,
    created_at
FROM sales_fraud_analysis
ORDER BY created_at DESC
LIMIT 10;
