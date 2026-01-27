const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabaseUrl = 'https://egsmraszqnmosmtjuzhx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc21yYXN6cW5tb3NtdGp1emh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ4NzcxMCwiZXhwIjoyMDg0MDYzNzEwfQ.wuM5GbYqaDTyf4T3fR62U1sWqZ06RJ3nXHk56I2VcAQ';
const APPMAX_TOKEN = 'B6C99C65-4FAE30A5-BB3DFD79-CCEDE0B7';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analisarUnknown() {
  console.log('\n🔍 ANALISANDO VENDAS COM MÉTODO "UNKNOWN"\n');
  
  // Buscar vendas unknown
  const { data: unknownSales } = await supabase
    .from('sales')
    .select('*')
    .eq('payment_gateway', 'appmax')
    .eq('payment_method', 'unknown');
  
  if (!unknownSales || unknownSales.length === 0) {
    console.log('   ✅ Nenhuma venda unknown encontrada!');
    return;
  }
  
  console.log(`   Encontradas ${unknownSales.length} vendas com método unknown\n`);
  
  for (const sale of unknownSales) {
    const orderId = sale.appmax_order_id;
    
    console.log(`   📦 Pedido ${orderId} - ${sale.customer_name}`);
    
    // Buscar na API da Appmax
    try {
      const response = await fetch(
        `https://admin.appmax.com.br/api/v3/order/${orderId}`,
        {
          headers: {
            'access-token': APPMAX_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const result = await response.json();
      
      if (result.data) {
        const order = result.data;
        console.log(`      API Fields:`);
        console.log(`      - payment_type: ${order.payment_type || 'null'}`);
        console.log(`      - payment_method: ${order.payment_method || 'null'}`);
        console.log(`      - method: ${order.method || 'null'}`);
        console.log(`      - status: ${order.status}`);
        console.log(`      - total: R$ ${order.total || 0}`);
        
        // Se encontrou payment_type, atualizar
        if (order.payment_type) {
          const normalizedMethod = order.payment_type === 'CreditCard' ? 'credit_card' :
                                  order.payment_type === 'Pix' ? 'pix' :
                                  order.payment_type === 'Boleto' ? 'boleto' :
                                  order.payment_type.toLowerCase();
          
          console.log(`      ✅ Corrigindo para: ${normalizedMethod}`);
          
          await supabase
            .from('sales')
            .update({ payment_method: normalizedMethod })
            .eq('id', sale.id);
        } else {
          console.log(`      ❌ Sem payment_type na API - mantém unknown`);
        }
      }
      
      console.log('');
    } catch (error) {
      console.log(`      ❌ Erro: ${error.message}\n`);
    }
  }
}

analisarUnknown().catch(console.error);
