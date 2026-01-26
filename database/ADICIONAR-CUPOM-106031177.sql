-- =====================================================
-- ADICIONAR CUPOM AO PEDIDO 106031177
-- =====================================================
-- O cupom usado não foi registrado no webhook
-- Vamos adicionar manualmente
-- =====================================================

-- PASSO 1: Ver qual cupom foi usado (se souber o código, substitua abaixo)
-- Exemplo: se o cupom foi "ADMGM" ou "DESCONTOGC"

-- PASSO 2: Atualizar o pedido com o cupom
-- ⚠️ IMPORTANTE: Substitua 'NOME_DO_CUPOM' pelo código real do cupom usado

UPDATE public.sales
SET 
    coupon_code = 'NOME_DO_CUPOM',  -- ← SUBSTITUA AQUI
    coupon_discount = 0.00,          -- ← Valor do desconto (se souber)
    updated_at = NOW(),
    metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{coupon_code}',
        to_jsonb('NOME_DO_CUPOM'::text)  -- ← SUBSTITUA AQUI TAMBÉM
    )
WHERE appmax_order_id = '106031177'
RETURNING 
    id,
    appmax_order_id,
    customer_name,
    coupon_code,
    coupon_discount,
    total_amount;

-- PASSO 3: Incrementar contador do cupom (se o pedido está pago)
UPDATE public.coupons
SET usage_count = usage_count + 1
WHERE UPPER(code) = UPPER('NOME_DO_CUPOM')  -- ← SUBSTITUA AQUI
AND is_active = true;

-- PASSO 4: Verificar a atualização
SELECT 
    id,
    appmax_order_id,
    customer_name,
    customer_email,
    status,
    total_amount,
    coupon_code,
    coupon_discount,
    updated_at
FROM public.sales 
WHERE appmax_order_id = '106031177';

-- PASSO 5: Ver contagem do cupom
SELECT 
    code,
    usage_count,
    usage_limit,
    is_active
FROM public.coupons
WHERE UPPER(code) = UPPER('NOME_DO_CUPOM');  -- ← SUBSTITUA AQUI

-- =====================================================
-- EXEMPLOS DE CUPONS COMUNS
-- =====================================================
-- Se o cupom foi ADMGM (R$ 35 de desconto fixo):
/*
UPDATE public.sales
SET 
    coupon_code = 'ADMGM',
    coupon_discount = 35.00,
    updated_at = NOW()
WHERE appmax_order_id = '106031177';
*/

-- Se o cupom foi DESCONTOGC (70% de desconto):
/*
UPDATE public.sales
SET 
    coupon_code = 'DESCONTOGC',
    coupon_discount = (total_amount * 0.70),
    updated_at = NOW()
WHERE appmax_order_id = '106031177';
*/

-- =====================================================
-- RESULTADO ESPERADO
-- =====================================================
-- ✅ Cupom registrado no pedido
-- ✅ Dashboard mostra cupom na lista de vendas
-- ✅ Contador do cupom incrementado
-- =====================================================
