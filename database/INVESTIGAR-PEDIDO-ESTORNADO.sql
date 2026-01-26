-- =====================================================
-- INVESTIGAR PEDIDO ESTORNADO DE 23/01
-- =====================================================

-- PASSO 1: Buscar TODOS os pedidos de 23/01/2026
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
WHERE created_at >= '2026-01-23 00:00:00'
  AND created_at < '2026-01-24 00:00:00'
ORDER BY created_at DESC;

-- PASSO 2: Buscar pedidos com status 'refunded'
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
WHERE status = 'refunded'
ORDER BY created_at DESC
LIMIT 20;

-- PASSO 3: Buscar pedidos estornados nos últimos 7 dias
SELECT 
    id,
    appmax_order_id,
    customer_name,
    customer_email,
    status,
    total_amount,
    created_at,
    updated_at
FROM public.sales
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND status = 'refunded'
ORDER BY created_at DESC;

-- PASSO 4: Contar todos os pedidos por status dos últimos 7 dias
SELECT 
    status,
    COUNT(*) as total,
    MIN(created_at) as primeiro_pedido,
    MAX(created_at) as ultimo_pedido
FROM public.sales
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY status
ORDER BY total DESC;

-- PASSO 5: Ver TODOS os pedidos dos últimos 7 dias (completo)
SELECT 
    id,
    appmax_order_id,
    customer_name,
    customer_email,
    status,
    total_amount,
    payment_method,
    TO_CHAR(created_at, 'DD/MM/YYYY HH24:MI:SS') as data_criacao,
    TO_CHAR(updated_at, 'DD/MM/YYYY HH24:MI:SS') as data_atualizacao
FROM public.sales
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- PASSO 6: Buscar webhooks recebidos em 23/01
SELECT 
    id,
    payload->>'order_id' as order_id,
    payload->>'status' as status,
    payload->>'customer_email' as customer_email,
    created_at
FROM public.webhooks_logs
WHERE created_at >= '2026-01-23 00:00:00'
  AND created_at < '2026-01-24 00:00:00'
ORDER BY created_at DESC;

-- =====================================================
-- DIAGNÓSTICO
-- =====================================================
-- Se PASSO 1 retornar vazio: Pedido não foi criado no banco
-- Se PASSO 2 retornar vazio: Nenhum pedido com status 'refunded'
-- Se PASSO 6 retornar vazio: Webhook não chegou
-- 
-- Possíveis causas:
-- 1. Webhook nunca foi enviado pela Appmax
-- 2. Status está com nome diferente (ex: 'estornado', 'chargeback')
-- 3. Pedido foi criado mas com status diferente
-- =====================================================
