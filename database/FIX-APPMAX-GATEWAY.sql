-- ===============================================
-- 🔧 CORREÇÃO: Payment Gateway para vendas Appmax
-- ===============================================
-- 
-- Este script corrige vendas que têm appmax_order_id
-- mas não têm payment_gateway = 'appmax'
--
-- Execute este script no Supabase SQL Editor
-- ===============================================

-- 1. Verificar vendas com problema
SELECT 
  id,
  appmax_order_id,
  payment_gateway,
  customer_email,
  total_amount,
  created_at
FROM sales
WHERE appmax_order_id IS NOT NULL
  AND (payment_gateway IS NULL OR payment_gateway != 'appmax')
ORDER BY created_at DESC;

-- 2. Corrigir payment_gateway para vendas com appmax_order_id
UPDATE sales
SET 
  payment_gateway = 'appmax',
  updated_at = NOW()
WHERE appmax_order_id IS NOT NULL
  AND (payment_gateway IS NULL OR payment_gateway != 'appmax');

-- 3. Verificar resultado
SELECT 
  payment_gateway,
  COUNT(*) as total
FROM sales
WHERE appmax_order_id IS NOT NULL
GROUP BY payment_gateway;

-- 4. Verificar se agora o dashboard pega os dados
SELECT * FROM get_analytics_period(
  NOW() - INTERVAL '30 days',
  NOW()
);

-- ===============================================
-- ✅ RESULTADO ESPERADO:
-- - Todas as vendas com appmax_order_id devem ter payment_gateway = 'appmax'
-- - get_analytics_period deve mostrar total_sales > 0
-- ===============================================
