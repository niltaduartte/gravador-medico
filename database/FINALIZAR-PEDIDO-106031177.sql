-- =====================================================
-- FINALIZAR PEDIDO 106031177
-- =====================================================
-- 1. Atualizar status para PAID
-- 2. Adicionar cupom DESCONTOGC (70% de desconto)
-- 3. Incrementar contador do cupom
-- 4. Deletar pedido de TESTE
-- =====================================================

-- PASSO 1: Atualizar pedido 106031177 (Gabriel Arruda Cardoso)
-- Status: fraud_analysis → paid
-- Cupom: DESCONTOGC (70% desconto)
UPDATE public.sales
SET 
    status = 'paid',
    coupon_code = 'DESCONTOGC',
    coupon_discount = ROUND((total_amount / 0.30) * 0.70, 2),  -- 70% do valor original
    updated_at = NOW(),
    paid_at = NOW(),
    metadata = jsonb_set(
        jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{manual_update}',
            jsonb_build_object(
                'updated_at', NOW()::text,
                'reason', 'appmax_approved_webhook_not_received',
                'old_status', 'fraud_analysis',
                'new_status', 'paid'
            )
        ),
        '{coupon_code}',
        to_jsonb('DESCONTOGC'::text)
    )
WHERE appmax_order_id = '106031177'
RETURNING 
    id,
    appmax_order_id,
    customer_name,
    status,
    total_amount,
    coupon_code,
    coupon_discount,
    updated_at;

-- PASSO 2: Incrementar contador do cupom DESCONTOGC
UPDATE public.coupons
SET usage_count = usage_count + 1
WHERE UPPER(code) = 'DESCONTOGC'
AND is_active = true
RETURNING code, usage_count, usage_limit;

-- PASSO 3: Deletar pedido de TESTE (Cliente Teste Antifraude)
DELETE FROM public.sales
WHERE customer_name = 'Cliente Teste Antifraude'
  AND customer_email = 'teste.antifraude@gravadormedico.com.br'
RETURNING appmax_order_id, customer_name, customer_email;

-- =====================================================
-- VERIFICAÇÕES
-- =====================================================

-- VERIFICAÇÃO 1: Pedido 106031177 atualizado
SELECT 
    appmax_order_id,
    customer_name,
    customer_email,
    status,
    total_amount,
    coupon_code,
    coupon_discount,
    ROUND((coupon_discount / (total_amount + coupon_discount)) * 100, 2) as desconto_percentual,
    payment_method,
    paid_at,
    created_at,
    updated_at
FROM public.sales 
WHERE appmax_order_id = '106031177';

-- VERIFICAÇÃO 2: NÃO aparece mais na view fraud_analysis
SELECT COUNT(*) as total_em_analise
FROM sales_fraud_analysis
WHERE appmax_order_id = '106031177';
-- Deve retornar 0

-- VERIFICAÇÃO 3: Status do cupom DESCONTOGC
SELECT 
    code,
    type,
    value,
    usage_count,
    usage_limit,
    is_active,
    description
FROM public.coupons
WHERE code = 'DESCONTOGC';

-- VERIFICAÇÃO 4: Confirmar que pedido de teste foi deletado
SELECT COUNT(*) as pedidos_teste_restantes
FROM public.sales
WHERE customer_name = 'Cliente Teste Antifraude';
-- Deve retornar 0

-- VERIFICAÇÃO 5: Últimas vendas pagas
SELECT 
    appmax_order_id,
    customer_name,
    status,
    total_amount,
    coupon_code,
    coupon_discount,
    updated_at
FROM public.sales
WHERE status = 'paid'
ORDER BY updated_at DESC
LIMIT 10;

-- =====================================================
-- RESULTADO ESPERADO
-- =====================================================
-- ✅ Pedido 106031177: status = paid, cupom = DESCONTOGC
-- ✅ Cupom DESCONTOGC: usage_count incrementado
-- ✅ Pedido de teste: DELETADO
-- ✅ Dashboard atualiza em 30 segundos via Realtime
-- ✅ CRM move lead para "won" automaticamente
-- =====================================================
