const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://egsmraszqnmosmtjuzhx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc21yYXN6cW5tb3NtdGp1emh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ4NzcxMCwiZXhwIjoyMDg0MDYzNzEwfQ.wuM5GbYqaDTyf4T3fR62U1sWqZ06RJ3nXHk56I2VcAQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testar() {
  console.log('\n🧪 TESTANDO FUNÇÃO get_analytics_period\n');
  
  const { data, error } = await supabase.rpc('get_analytics_period', {
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date().toISOString()
  });
  
  if (error) {
    console.error('❌ Erro:', error);
  } else {
    const result = Array.isArray(data) ? data[0] : data;
    console.log('📊 Resultado:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n📋 Campos disponíveis:');
    Object.keys(result).forEach(key => {
      console.log(`   - ${key}: ${result[key]}`);
    });
    
    if (result.gross_revenue !== undefined) {
      console.log('\n✅ FUNÇÃO ATUALIZADA COM SUCESSO!');
      console.log(`   💰 Faturamento Bruto: R$ ${result.gross_revenue}`);
      console.log(`   🎟️  Descontos: R$ ${result.total_discount}`);
      console.log(`   💵 Faturamento Líquido: R$ ${result.total_revenue}`);
      console.log(`   ❌ Vendas Recusadas: ${result.failed_sales}`);
    } else {
      console.log('\n⚠️  FUNÇÃO ANTIGA - Precisa atualizar!');
      console.log('   Execute o SQL manualmente no Supabase SQL Editor:');
      console.log('   https://supabase.com/dashboard/project/egsmraszqnmosmtjuzhx/sql');
    }
  }
}

testar();
