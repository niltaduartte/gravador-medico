const fetch = require('node-fetch');

const SUPABASE_URL = 'https://egsmraszqnmosmtjuzhx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc21yYXN6cW5tb3NtdGp1emh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ4NzcxMCwiZXhwIjoyMDg0MDYzNzEwfQ.wuM5GbYqaDTyf4T3fR62U1sWqZ06RJ3nXHk56I2VcAQ';

async function verificarMetricas() {
  console.log('🔍 Verificando métricas atuais do dashboard...\n');
  
  try {
    // Testar a função atual
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_analytics_period`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString()
      })
    });

    const data = await response.json();
    
    console.log('📊 Resposta da API:');
    console.log(JSON.stringify(data, null, 2));
    
    if (Array.isArray(data) && data.length > 0) {
      const metrics = data[0];
      console.log('\n✅ Campos disponíveis:');
      console.log('   - unique_visitors:', metrics.unique_visitors);
      console.log('   - total_sales:', metrics.total_sales);
      console.log('   - paid_sales:', metrics.paid_sales);
      console.log('   - total_revenue:', metrics.total_revenue);
      console.log('   - conversion_rate:', metrics.conversion_rate);
      console.log('   - average_order_value:', metrics.average_order_value);
      
      console.log('\n❌ Campos que FALTAM (por isso não aparecem os quadros):');
      console.log('   - gross_revenue:', metrics.gross_revenue || 'UNDEFINED');
      console.log('   - total_discount:', metrics.total_discount || 'UNDEFINED');
      console.log('   - failed_sales:', metrics.failed_sales || 'UNDEFINED');
      
      if (!metrics.gross_revenue && !metrics.total_discount && !metrics.failed_sales) {
        console.log('\n⚠️  AÇÃO NECESSÁRIA:');
        console.log('   Você precisa executar o SQL do arquivo SQL-LIMPO.sql');
        console.log('   no Supabase para adicionar esses campos!');
        console.log('\n📍 Link: https://supabase.com/dashboard/project/egsmraszqnmosmtjuzhx/sql');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

verificarMetricas();
