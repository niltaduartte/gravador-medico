-- ========================================
-- FIX: Incluir dados do Mercado Pago em Analytics
-- ========================================
-- Este script corrige as funções SQL para incluir vendas
-- processadas pelo Mercado Pago nas métricas do dashboard
-- Data: 27/01/2026
-- ========================================

-- =====================================================
-- 1. ATUALIZAR FUNÇÃO: get_analytics_period
-- =====================================================
-- Agora busca de SALES (dados reais) em vez de apenas checkout_attempts

CREATE OR REPLACE FUNCTION public.get_analytics_period(
    start_date TIMESTAMP DEFAULT NOW() - INTERVAL '30 days',
    end_date TIMESTAMP DEFAULT NOW()
)
RETURNS TABLE (
    unique_visitors BIGINT,
    total_sales BIGINT,
    total_revenue NUMERIC,
    conversion_rate NUMERIC,
    average_order_value NUMERIC
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH period_visits AS (
        SELECT
            COUNT(DISTINCT session_id) as unique_visitors
        FROM public.analytics_visits
        WHERE created_at BETWEEN start_date AND end_date
    ),
    period_sales AS (
        -- Busca vendas REAIS da tabela sales (inclui MP + AppMax)
        SELECT
            COUNT(*) as total_sales,
            COALESCE(SUM(total_amount), 0) as total_revenue
        FROM public.sales
        WHERE created_at BETWEEN start_date AND end_date
        AND order_status IN ('paid', 'provisioning', 'active')
    )
    SELECT
        pv.unique_visitors,
        ps.total_sales,
        ps.total_revenue,
        CASE 
            WHEN pv.unique_visitors > 0 
            THEN ROUND((ps.total_sales::numeric / pv.unique_visitors::numeric) * 100, 2)
            ELSE 0 
        END as conversion_rate,
        CASE 
            WHEN ps.total_sales > 0 
            THEN ROUND(ps.total_revenue / ps.total_sales, 2)
            ELSE 0 
        END as average_order_value
    FROM period_visits pv, period_sales ps;
END;
$$;

-- =====================================================
-- 2. CRIAR VIEW: sales_by_gateway
-- =====================================================
-- View para análise separada por gateway (MP vs AppMax)

CREATE OR REPLACE VIEW public.sales_by_gateway AS
SELECT 
    payment_gateway,
    COUNT(*) as total_sales,
    COUNT(*) FILTER (WHERE order_status IN ('paid', 'provisioning', 'active')) as successful_sales,
    SUM(total_amount) FILTER (WHERE order_status IN ('paid', 'provisioning', 'active')) as total_revenue,
    AVG(total_amount) FILTER (WHERE order_status IN ('paid', 'provisioning', 'active')) as avg_ticket,
    ROUND(
        COUNT(*) FILTER (WHERE order_status IN ('paid', 'provisioning', 'active'))::numeric / 
        NULLIF(COUNT(*)::numeric, 0) * 100, 
        2
    ) as approval_rate,
    COUNT(*) FILTER (WHERE fallback_used = true) as fallback_count,
    SUM(total_amount) FILTER (WHERE fallback_used = true) as fallback_revenue
FROM public.sales
WHERE payment_gateway IS NOT NULL
GROUP BY payment_gateway;

-- =====================================================
-- 3. CRIAR VIEW: payment_gateway_performance
-- =====================================================
-- Métricas detalhadas de performance por gateway

CREATE OR REPLACE VIEW public.payment_gateway_performance AS
SELECT 
    s.payment_gateway,
    DATE(s.created_at) as sale_date,
    COUNT(*) as attempts,
    COUNT(*) FILTER (WHERE s.order_status IN ('paid', 'provisioning', 'active')) as approvals,
    COUNT(*) FILTER (WHERE s.order_status = 'failed') as rejections,
    SUM(s.total_amount) FILTER (WHERE s.order_status IN ('paid', 'provisioning', 'active')) as revenue,
    AVG(s.total_amount) FILTER (WHERE s.order_status IN ('paid', 'provisioning', 'active')) as avg_ticket,
    ROUND(
        COUNT(*) FILTER (WHERE s.order_status IN ('paid', 'provisioning', 'active'))::numeric / 
        NULLIF(COUNT(*)::numeric, 0) * 100, 
        2
    ) as approval_rate
FROM public.sales s
WHERE s.payment_gateway IS NOT NULL
GROUP BY s.payment_gateway, DATE(s.created_at)
ORDER BY sale_date DESC, payment_gateway;

-- =====================================================
-- 4. CRIAR VIEW: cascata_analysis
-- =====================================================
-- Análise completa do sistema de cascata MP → AppMax

CREATE OR REPLACE VIEW public.cascata_analysis AS
WITH mp_attempts AS (
    -- Todas as tentativas no Mercado Pago
    SELECT 
        COUNT(*) as total_attempts,
        COUNT(*) FILTER (WHERE order_status IN ('paid', 'provisioning', 'active')) as approved,
        COUNT(*) FILTER (WHERE order_status = 'failed') as rejected,
        SUM(total_amount) FILTER (WHERE order_status IN ('paid', 'provisioning', 'active')) as revenue
    FROM public.sales
    WHERE payment_gateway = 'mercadopago'
),
fallback_rescues AS (
    -- Vendas resgatadas pelo fallback (AppMax após MP falhar)
    SELECT 
        COUNT(*) as rescued_count,
        SUM(total_amount) as rescued_revenue
    FROM public.sales
    WHERE fallback_used = true
    AND order_status IN ('paid', 'provisioning', 'active')
),
appmax_direct AS (
    -- Vendas diretas no AppMax (sem fallback)
    SELECT 
        COUNT(*) as direct_count,
        SUM(total_amount) as direct_revenue
    FROM public.sales
    WHERE payment_gateway = 'appmax'
    AND (fallback_used = false OR fallback_used IS NULL)
    AND order_status IN ('paid', 'provisioning', 'active')
)
SELECT 
    -- Mercado Pago
    mp.total_attempts as mp_total,
    mp.approved as mp_approved,
    mp.rejected as mp_rejected,
    mp.revenue as mp_revenue,
    ROUND((mp.approved::numeric / NULLIF(mp.total_attempts::numeric, 0)) * 100, 2) as mp_approval_rate,
    
    -- Cascata/Fallback
    fb.rescued_count,
    fb.rescued_revenue,
    ROUND((fb.rescued_count::numeric / NULLIF(mp.rejected::numeric, 0)) * 100, 2) as rescue_rate,
    
    -- AppMax direto
    ad.direct_count as appmax_direct,
    ad.direct_revenue as appmax_direct_revenue,
    
    -- Totais consolidados
    (mp.approved + fb.rescued_count + ad.direct_count) as total_sales,
    (mp.revenue + fb.rescued_revenue + ad.direct_revenue) as total_revenue
FROM mp_attempts mp, fallback_rescues fb, appmax_direct ad;

-- =====================================================
-- 5. CRIAR FUNÇÃO RPC: get_gateway_stats
-- =====================================================
-- Função para buscar estatísticas de gateway via RPC

CREATE OR REPLACE FUNCTION public.get_gateway_stats(
    start_date TIMESTAMP DEFAULT NOW() - INTERVAL '30 days',
    end_date TIMESTAMP DEFAULT NOW()
)
RETURNS TABLE (
    gateway TEXT,
    total_sales BIGINT,
    successful_sales BIGINT,
    total_revenue NUMERIC,
    avg_ticket NUMERIC,
    approval_rate NUMERIC,
    fallback_count BIGINT,
    fallback_revenue NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.payment_gateway as gateway,
        COUNT(*) as total_sales,
        COUNT(*) FILTER (WHERE s.order_status IN ('paid', 'provisioning', 'active')) as successful_sales,
        COALESCE(SUM(s.total_amount) FILTER (WHERE s.order_status IN ('paid', 'provisioning', 'active')), 0) as total_revenue,
        COALESCE(AVG(s.total_amount) FILTER (WHERE s.order_status IN ('paid', 'provisioning', 'active')), 0) as avg_ticket,
        ROUND(
            COALESCE(
                COUNT(*) FILTER (WHERE s.order_status IN ('paid', 'provisioning', 'active'))::numeric / 
                NULLIF(COUNT(*)::numeric, 0) * 100,
                0
            ),
            2
        ) as approval_rate,
        COUNT(*) FILTER (WHERE s.fallback_used = true) as fallback_count,
        COALESCE(SUM(s.total_amount) FILTER (WHERE s.fallback_used = true), 0) as fallback_revenue
    FROM public.sales s
    WHERE s.created_at BETWEEN start_date AND end_date
    AND s.payment_gateway IS NOT NULL
    GROUP BY s.payment_gateway;
END;
$$;

-- =====================================================
-- 6. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON VIEW public.sales_by_gateway IS 'Métricas agregadas por gateway de pagamento (Mercado Pago vs AppMax)';
COMMENT ON VIEW public.payment_gateway_performance IS 'Performance diária detalhada de cada gateway';
COMMENT ON VIEW public.cascata_analysis IS 'Análise completa do sistema de cascata e fallback MP → AppMax';
COMMENT ON FUNCTION public.get_gateway_stats IS 'Retorna estatísticas de gateways para período específico';

-- =====================================================
-- ✅ VERIFICAÇÃO
-- =====================================================

SELECT '✅ Funções e views atualizadas com sucesso!' as status;

-- Testar as queries
SELECT * FROM sales_by_gateway;
SELECT * FROM cascata_analysis;
SELECT * FROM get_analytics_period(NOW() - INTERVAL '30 days', NOW());
SELECT * FROM get_gateway_stats(NOW() - INTERVAL '7 days', NOW());
