const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://egsmraszqnmosmtjuzhx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc21yYXN6cW5tb3NtdGp1emh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ4NzcxMCwiZXhwIjoyMDg0MDYzNzEwfQ.wuM5GbYqaDTyf4T3fR62U1sWqZ06RJ3nXHk56I2VcAQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarPedidos202() {
  console.log('\n🔍 VERIFICANDO PEDIDOS DE R$ 202,80\n');
  
  const pedidosAppmax = [
    { id: '105549256', payment_type: 'Pix', status: 'cancelado' },
    { id: '105549502', payment_type: 'Pix', status: 'cancelado' },
    { id: '105549962', payment_type: 'unknown', status: 'pendente' },
    { id: '105550168', payment_type: 'unknown', status: 'pendente' },
    { id: '105550385', payment_type: 'CreditCard', status: 'cancelado' }
  ];
  
  for (const pedido of pedidosAppmax) {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('payment_gateway', 'appmax')
      .eq('appmax_order_id', pedido.id);
    
    if (error) {
      console.error(`   ❌ Erro ao buscar ${pedido.id}:`, error);
    } else if (data && data.length > 0) {
      console.log(`   ✅ ${pedido.id} (${pedido.payment_type}) - JÁ NO BANCO`);
      console.log(`      Status BD: ${data[0].status} | Payment Method: ${data[0].payment_method}`);
    } else {
      console.log(`   ❌ ${pedido.id} (${pedido.payment_type}) - FALTANDO NO BANCO`);
    }
  }
}

verificarPedidos202().catch(console.error);
