-- =====================================================
-- CORREÇÃO: get_analytics_period
-- =====================================================
-- Problemas corrigidos:
-- 1. Faturamento bruto agora usa subtotal (antes do desconto)
-- 2. Pagamentos recusados agora incluem: cancelled, expired, refused, rejected, failed
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_analytics_period(
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    unique_visitors BIGINT,
    total_sales BIGINT,
    pending_sales BIGINT,
    paid_sales BIGINT,
    failed_sales BIGINT,
    total_revenue NUMERIC,
    gross_revenue NUMERIC,
    total_discount NUMERIC,
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
        -- Busca TODAS as vendas da tabela sales (inclui MP + AppMax)
        SELECT
            COUNT(*) as total_sales,
            
            -- Vendas pendentes (aguardando pagamento)
            COUNT(*) FILTER (
                WHERE order_status IN ('pending', 'pending_payment', 'processing')
            ) as pending_sales,
            
            -- Vendas pagas/aprovadas
            COUNT(*) FILTER (
                WHERE order_status IN ('paid', 'provisioning', 'active', 'approved')
            ) as paid_sales,
            
            -- Vendas recusadas/canceladas/expiradas
            COUNT(*) FILTER (
                WHERE order_status IN ('cancelled', 'canceled', 'expired', 'refused', 'rejected', 'failed', 'chargeback')
            ) as failed_sales,
            
            -- Faturamento líquido (valor que realmente entrou - após desconto)
            COALESCE(
                SUM(total_amount) FILTER (
                    WHERE order_status IN ('paid', 'provisioning', 'active', 'approved')
                ), 
                0
            ) as paid_revenue,
            
            -- Faturamento bruto (antes do desconto)
            COALESCE(
                SUM(subtotal) FILTER (
                    WHERE order_status IN ('paid', 'provisioning', 'active', 'approved')
                ), 
                0
            ) as gross_revenue,
            
            -- Total de descontos aplicados
            COALESCE(
                SUM(discount) FILTER (
                    WHERE order_status IN ('paid', 'provisioning', 'active', 'approved')
                ), 
                0
            ) as total_discount
            
        FROM public.sales
        WHERE created_at BETWEEN start_date AND end_date
    )
    SELECT
        pv.unique_visitors,
        ps.total_sales,
        ps.pending_sales,
        ps.paid_sales,
        ps.failed_sales,
        ps.paid_revenue as total_revenue,
        ps.gross_revenue,
        ps.total_discount,
        CASE 
            WHEN pv.unique_visitors > 0 
            THEN ROUND((ps.paid_sales::numeric / pv.unique_visitors::numeric) * 100, 2)
            ELSE 0 
        END as conversion_rate,
        CASE 
            WHEN ps.paid_sales > 0 
            THEN ROUND(ps.paid_revenue / ps.paid_sales, 2)
            ELSE 0 
        END as average_order_value
    FROM period_visits pv, period_sales ps;
END;
$$;

COMMENT ON FUNCTION public.get_analytics_period IS 'Retorna métricas do dashboard incluindo faturamento bruto, líquido e pagamentos recusados';

-- =====================================================
-- TESTE
-- =====================================================
SELECT 
    '📊 Teste: Últimos 30 dias' as teste,
    unique_visitors,
    total_sales,
    pending_sales,
    paid_sales,
    failed_sales,
    CONCAT('R$ ', ROUND(gross_revenue, 2)) as faturamento_bruto,
    CONCAT('R$ ', ROUND(total_revenue, 2)) as faturamento_liquido,
    CONCAT('R$ ', ROUND(total_discount, 2)) as descontos_aplicados,
    CONCAT(conversion_rate, '%') as taxa_conversao,
    CONCAT('R$ ', ROUND(average_order_value, 2)) as ticket_medio
FROM get_analytics_period(NOW() - INTERVAL '30 days', NOW());
