const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://egsmraszqnmosmtjuzhx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc21yYXN6cW5tb3NtdGp1emh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ4NzcxMCwiZXhwIjoyMDg0MDYzNzEwfQ.wuM5GbYqaDTyf4T3fR62U1sWqZ06RJ3nXHk56I2VcAQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function resumoFinal() {
  console.log('\n📊 RESUMO FINAL - VERIFICAÇÃO COMPLETA\n');
  
  // 1. Vendas Mercado Pago
  console.log('🔵 MERCADO PAGO:');
  const { data: mpSales, error: errMP } = await supabase
    .from('sales')
    .select('*')
    .eq('payment_gateway', 'mercadopago')
    .order('created_at', { ascending: false });
  
  if (mpSales) {
    mpSales.forEach(sale => {
      const icon = sale.payment_method === 'pix' ? '💠' : 
                   sale.payment_method === 'credit_card' ? '💳' : '❓';
      console.log(`   ${icon} ${sale.customer_name} - R$ ${sale.amount || 0}`);
      console.log(`      Status: ${sale.status} | Order: ${sale.order_status} | Method: ${sale.payment_method || 'null'}`);
    });
  }
  
  // 2. Vendas Appmax com payment_method incorreto
  console.log('\n\n🟢 APPMAX - MÉTODOS DE PAGAMENTO:');
  const { data: appmaxSales, error: errAppmax } = await supabase
    .from('sales')
    .select('*')
    .eq('payment_gateway', 'appmax')
    .order('created_at', { ascending: false })
    .limit(15);
  
  if (appmaxSales) {
    let incorretos = 0;
    appmaxSales.forEach(sale => {
      const icon = sale.payment_method === 'pix' ? '💠' : 
                   sale.payment_method === 'credit_card' ? '💳' :
                   sale.payment_method === 'boleto' ? '📄' : '❓';
      console.log(`   ${icon} ${sale.customer_name} - R$ ${sale.amount || 0}`);
      console.log(`      Status: ${sale.status} | Method: ${sale.payment_method || 'null'}`);
      
      if (!sale.payment_method || sale.payment_method === 'unknown') {
        incorretos++;
      }
    });
    
    console.log(`\n   ⚠️  Métodos incorretos/null: ${incorretos} de ${appmaxSales.length}`);
  }
  
  // 3. Status resumido
  console.log('\n\n📈 ESTATÍSTICAS:');
  const { data: stats } = await supabase
    .from('sales')
    .select('payment_gateway, payment_method, status')
    .eq('payment_gateway', 'appmax');
  
  if (stats) {
    const byMethod = {};
    stats.forEach(s => {
      const method = s.payment_method || 'unknown';
      byMethod[method] = (byMethod[method] || 0) + 1;
    });
    
    console.log('\n   Métodos de pagamento Appmax:');
    Object.entries(byMethod).sort((a, b) => b[1] - a[1]).forEach(([method, count]) => {
      const icon = method === 'pix' ? '💠' : 
                   method === 'credit_card' ? '💳' :
                   method === 'boleto' ? '📄' : '❓';
      console.log(`      ${icon} ${method}: ${count}`);
    });
  }
  
  console.log('\n');
}

resumoFinal().catch(console.error);
