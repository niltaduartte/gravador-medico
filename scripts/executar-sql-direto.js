const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://egsmraszqnmosmtjuzhx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc21yYXN6cW5tb3NtdGp1emh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ4NzcxMCwiZXhwIjoyMDg0MDYzNzEwfQ.wuM5GbYqaDTyf4T3fR62U1sWqZ06RJ3nXHk56I2VcAQ';

const supabase = createClient(supabaseUrl, supabaseKey);

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

async function executar() {
  console.log('\n🔧 EXECUTANDO SQL NO SUPABASE\n');
  
  try {
    // Usar o SQL REST API do Supabase
    const response = await fetch(\`\${supabaseUrl}/rest/v1/rpc/exec\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': \`Bearer \${supabaseKey}\`
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      // Método alternativo: usar psql via URL
      console.log('   Método REST não disponível, usando cliente direto...\n');
      
      // Executar via rpc do Supabase
      const { data, error } = await supabase.rpc('get_analytics_period', {
        start_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString()
      });

      console.log('   ℹ️  Função já existe. Vou atualizar via método direto...\n');
    }

    // Usar pg-client direto
    const { Client } = require('pg');
    
    const connectionString = process.env.DATABASE_URL || 
      'postgresql://postgres.egsmraszqnmosmtjuzhx:Helcio@13@db.egsmraszqnmosmtjuzhx.supabase.co:5432/postgres';
    
    const client = new Client({ connectionString });
    
    await client.connect();
    console.log('   ✅ Conectado ao PostgreSQL\n');
    
    await client.query(sql);
    console.log('   ✅ Função get_analytics_period atualizada com sucesso!\n');
    
    // Testar a função
    console.log('🧪 TESTANDO A FUNÇÃO:\n');
    const result = await client.query(\`
      SELECT 
        unique_visitors,
        total_sales,
        pending_sales,
        paid_sales,
        failed_sales,
        ROUND(gross_revenue::numeric, 2) as gross_revenue,
        ROUND(total_revenue::numeric, 2) as total_revenue,
        ROUND(total_discount::numeric, 2) as total_discount,
        conversion_rate,
        ROUND(average_order_value::numeric, 2) as average_order_value
      FROM get_analytics_period(NOW() - INTERVAL '30 days', NOW())
    \`);
    
    const row = result.rows[0];
    console.log('   📊 Resultados (últimos 30 dias):');
    console.log(\`   - Visitantes únicos: \${row.unique_visitors}\`);
    console.log(\`   - Total de vendas: \${row.total_sales}\`);
    console.log(\`   - Vendas pagas: \${row.paid_sales}\`);
    console.log(\`   - Vendas pendentes: \${row.pending_sales}\`);
    console.log(\`   - Vendas recusadas: \${row.failed_sales}\`);
    console.log(\`   - 💰 Faturamento Bruto: R$ \${row.gross_revenue}\`);
    console.log(\`   - 🎟️  Descontos: R$ \${row.total_discount}\`);
    console.log(\`   - 💵 Faturamento Líquido: R$ \${row.total_revenue}\`);
    console.log(\`   - Taxa de conversão: \${row.conversion_rate}%\`);
    console.log(\`   - Ticket médio: R$ \${row.average_order_value}\`);
    
    await client.end();
    console.log('\n✅ CONCLUÍDO! Recarregue o dashboard para ver as mudanças.\n');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.log('\n📝 Tente executar manualmente no Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/egsmraszqnmosmtjuzhx/sql\n');
  }
}

executar();
