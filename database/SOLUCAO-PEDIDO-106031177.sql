-- =====================================================
-- SOLUÇÃO CORRIGIDA: Criar pedido 106031177 no banco
-- =====================================================
-- Correção: Adaptado para estrutura real da tabela webhooks_logs
-- =====================================================

-- PASSO 1: Criar o pedido manualmente (EXECUTE ESTE PRIMEIRO!)
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
    updated_at
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
    NOW()
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

-- PASSO 5: Verificar estrutura da tabela webhooks_logs
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'webhooks_logs' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- PASSO 6: Verificar se ALGUM webhook foi recebido (últimas 24h)
SELECT 
    id,
    endpoint,
    payload,
    response_status,
    created_at
FROM public.webhooks_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- PASSO 7: Contar webhooks recebidos hoje
SELECT 
    endpoint,
    COUNT(*) as total,
    MAX(created_at) as ultimo_webhook
FROM public.webhooks_logs
WHERE created_at >= CURRENT_DATE
GROUP BY endpoint
ORDER BY total DESC;

-- PASSO 8: Ver últimos webhooks da Appmax
SELECT 
    id,
    endpoint,
    payload->>'order_id' as order_id,
    payload->>'appmax_order_id' as appmax_order_id,
    payload->>'status' as status,
    payload->>'customer_email' as customer_email,
    response_status,
    created_at
FROM public.webhooks_logs
WHERE endpoint LIKE '%appmax%'
ORDER BY created_at DESC
LIMIT 10;

-- PASSO 9: Procurar webhooks do pedido 106031177 especificamente
SELECT 
    id,
    endpoint,
    payload,
    response_status,
    created_at
FROM public.webhooks_logs
WHERE payload::text LIKE '%106031177%'
ORDER BY created_at DESC;

-- =====================================================
-- CRIAR CUSTOMER (Opcional)
-- =====================================================

-- PASSO 10: Verificar se customer existe
SELECT id, email, name, total_orders 
FROM public.customers 
WHERE email = 'gabriel_acardoso@hotmail.com';

-- PASSO 11: Criar customer se não existir
INSERT INTO public.customers (
    email,
    name,
    total_orders,
    total_spent
) VALUES (
    'gabriel_acardoso@hotmail.com',
    'Gabriel Arruda Cardoso',
    1,
    36.00
)
ON CONFLICT (email) DO UPDATE
SET 
    name = EXCLUDED.name,
    total_orders = customers.total_orders + 1,
    total_spent = customers.total_spent + 36.00,
    updated_at = NOW()
RETURNING id, email, name, total_orders, total_spent;

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================

-- PASSO 12: Status geral das vendas (últimas 24h)
SELECT 
    status,
    COUNT(*) as total,
    SUM(total_amount) as valor_total
FROM public.sales
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY total DESC;

-- PASSO 13: Últimas vendas criadas
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
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- INSTRUÇÕES DE USO
-- =====================================================
-- 
-- 1. Execute PASSO 1: Criar o pedido ✅
-- 2. Execute PASSO 2: Verificar se criou ✅
-- 3. Execute PASSO 3: Ver na view fraud_analysis ✅
-- 4. Execute PASSO 4: Ver todos em análise ✅
-- 5. Abra o dashboard: /admin/dashboard
-- 6. Aguarde 30 segundos
-- 7. O pedido deve aparecer no card "Análise Antifraude"
-- 
-- Para diagnóstico de webhooks:
-- 8. Execute PASSO 6: Ver webhooks recebidos
-- 9. Execute PASSO 7: Contar webhooks por endpoint
-- 10. Execute PASSO 8: Ver webhooks da Appmax
-- 
-- =====================================================
