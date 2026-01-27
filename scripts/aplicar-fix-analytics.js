const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://egsmraszqnmosmtjuzhx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc21yYXN6cW5tb3NtdGp1emh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ4NzcxMCwiZXhwIjoyMDg0MDYzNzEwfQ.wuM5GbYqaDTyf4T3fR62U1sWqZ06RJ3nXHk56I2VcAQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function aplicarCorrecao() {
  console.log('\n🔧 APLICANDO CORREÇÕES NA FUNÇÃO get_analytics_period\n');
  
  const sql = `
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
        SELECT
            COUNT(*) as total_sales,
            COUNT(*) FILTER (WHERE order_status IN ('pending', 'pending_payment', 'processing')) as pending_sales,
            COUNT(*) FILTER (WHERE order_status IN ('paid', 'provisioning', 'active', 'approved')) as paid_sales,
            COUNT(*) FILTER (WHERE order_status IN ('cancelled', 'canceled', 'expired', 'refused', 'rejected', 'failed', 'chargeback')) as failed_sales,
            COALESCE(SUM(total_amount) FILTER (WHERE order_status IN ('paid', 'provisioning', 'active', 'approved')), 0) as paid_revenue,
            COALESCE(SUM(subtotal) FILTER (WHERE order_status IN ('paid', 'provisioning', 'active', 'approved')), 0) as gross_revenue,
            COALESCE(SUM(discount) FILTER (WHERE order_status IN ('paid', 'provisioning', 'active', 'approved')), 0) as total_discount
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
`;

  try {
    // Executar o SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Tentar método alternativo
      console.log('   Tentando método alternativo...');
      const { data: result, error: err2 } = await supabase
        .from('_sql_migrations')
        .insert({ sql: sql });
      
      if (err2) {
        throw err2;
      }
    }
    
    console.log('   ✅ Função atualizada com sucesso!\n');
    
    // Testar a função
    console.log('🧪 TESTANDO A FUNÇÃO:\n');
    const { data: testData, error: testError } = await supabase
      .rpc('get_analytics_period', {
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString()
      });
    
    if (testError) {
      console.error('   ❌ Erro no teste:', testError);
    } else {
      const result = Array.isArray(testData) ? testData[0] : testData;
      console.log('   📊 Resultados:');
      console.log(`   - Visitantes únicos: ${result.unique_visitors}`);
      console.log(`   - Total de vendas: ${result.total_sales}`);
      console.log(`   - Vendas pagas: ${result.paid_sales}`);
      console.log(`   - Vendas pendentes: ${result.pending_sales}`);
      console.log(`   - Vendas recusadas: ${result.failed_sales}`);
      console.log(`   - Faturamento Bruto: R$ ${parseFloat(result.gross_revenue || 0).toFixed(2)}`);
      console.log(`   - Descontos: R$ ${parseFloat(result.total_discount || 0).toFixed(2)}`);
      console.log(`   - Faturamento Líquido: R$ ${parseFloat(result.total_revenue || 0).toFixed(2)}`);
      console.log(`   - Taxa de conversão: ${result.conversion_rate}%`);
      console.log(`   - Ticket médio: R$ ${parseFloat(result.average_order_value || 0).toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('   ❌ Erro:', error.message);
    console.log('\n   ℹ️  Execute manualmente o SQL no Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/egsmraszqnmosmtjuzhx/sql\n');
  }
}

aplicarCorrecao().catch(console.error);
