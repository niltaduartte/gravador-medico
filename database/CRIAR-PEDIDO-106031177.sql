-- =====================================================
-- SOLUÇÃO IMEDIATA: Criar pedido 106031177 no banco
-- =====================================================
-- O pedido não existe no banco porque o webhook não chegou
-- Vamos criar manualmente e investigar o problema
-- =====================================================

-- PASSO 1: Criar o pedido manualmente
INSERT INTO public.sales (
    appmax_order_id,
    customer_name,
    customer_email,
    total_amount,
    subtotal,
    discount,
    status,
    payment_method,
    created_at,
    updated_at,
    metadata
) VALUES (
    '106031177',
    'Gabriel Arruda Cardoso',
    'gabriel_acardoso@hotmail.com',
    36.00,
    36.00,
    0.00,
    'fraud_analysis',
    'credit_card',
    '2026-01-26 16:29:00'::timestamp,
    NOW(),
    '{"source": "manual_creation", "reason": "webhook_not_received"}'::jsonb
)
RETURNING 
    id,
    appmax_order_id,
    customer_name,
    customer_email,
    status,
    total_amount,
    created_at;

-- PASSO 2: Verificar se foi criado
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
WHERE appmax_order_id = '106031177';

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

-- PASSO 4: Ver TODOS os pedidos em análise (para confirmar)
SELECT 
    appmax_order_id,
    customer_name,
    total_amount,
    hours_in_analysis,
    urgency_level
FROM sales_fraud_analysis
ORDER BY created_at DESC;

-- =====================================================
-- DIAGNÓSTICO: Por que o webhook não chegou?
-- =====================================================

-- PASSO 5: Verificar se ALGUM webhook foi recebido hoje
SELECT 
    id,
    endpoint,
    event_type,
    payload->>'order_id' as order_id,
    payload->>'status' as status,
    response_status,
    created_at
FROM public.webhooks_logs
WHERE created_at >= CURRENT_DATE
ORDER BY created_at DESC
LIMIT 20;

-- PASSO 6: Verificar últimos webhooks da Appmax
SELECT 
    id,
    endpoint,
    event_type,
    payload->>'order_id' as order_id,
    payload->>'customer_email' as customer_email,
    payload->>'status' as status,
    response_status,
    created_at
FROM public.webhooks_logs
WHERE endpoint LIKE '%appmax%'
ORDER BY created_at DESC
LIMIT 10;

-- PASSO 7: Contar webhooks por endpoint
SELECT 
    endpoint,
    COUNT(*) as total_webhooks,
    MAX(created_at) as ultimo_webhook
FROM public.webhooks_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY endpoint
ORDER BY total_webhooks DESC;

-- =====================================================
-- POSSÍVEIS CAUSAS DO PROBLEMA
-- =====================================================
-- 
-- ❌ Se PASSO 5 retornar VAZIO:
--    → NENHUM webhook está sendo recebido
--    → A URL do webhook na Appmax está ERRADA
--    → Ou não está configurada
--
-- ❌ Se PASSO 6 retornar VAZIO:
--    → Os webhooks da Appmax não estão chegando
--    → Verifique a configuração no painel da Appmax
--
-- ✅ Se PASSO 5 retornar dados:
--    → Webhooks estão funcionando
--    → Mas o webhook desse pedido específico não chegou
--    → Pode ser um atraso da Appmax
--
-- =====================================================

-- PASSO 8: Criar customer se não existir (opcional)
INSERT INTO public.customers (
    email,
    name,
    phone
) VALUES (
    'gabriel_acardoso@hotmail.com',
    'Gabriel Arruda Cardoso',
    NULL
)
ON CONFLICT (email) DO UPDATE
SET 
    name = EXCLUDED.name,
    updated_at = NOW()
RETURNING id, email, name;

-- =====================================================
-- RESULTADO ESPERADO
-- =====================================================
-- Após executar o PASSO 1:
-- ✅ Pedido criado no banco com status 'fraud_analysis'
-- ✅ Aparece na view sales_fraud_analysis
-- ✅ Vai aparecer no dashboard em até 30 segundos
-- 
-- Próximos passos:
-- 1. Abra o dashboard: /admin/dashboard
-- 2. Procure o card "Análise Antifraude"
-- 3. O pedido do Gabriel deve estar lá
-- =====================================================
