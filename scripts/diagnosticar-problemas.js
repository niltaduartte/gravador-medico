const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://egsmraszqnmosmtjuzhx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc21yYXN6cW5tb3NtdGp1emh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ4NzcxMCwiZXhwIjoyMDg0MDYzNzEwfQ.wuM5GbYqaDTyf4T3fR62U1sWqZ06RJ3nXHk56I2VcAQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosticar() {
  console.log('\n🔍 DIAGNÓSTICO DE PROBLEMAS\n');
  
  // 1. Vendas do Gabriel no Mercado Pago
  console.log('1️⃣ GABRIEL - MERCADO PAGO:');
  const { data: gabrielMP, error: errGabriel } = await supabase
    .from('sales')
    .select('*')
    .eq('payment_gateway', 'mercadopago')
    .ilike('customer_name', '%gabriel%');
  
  if (errGabriel) {
    console.error('❌ Erro:', errGabriel);
  } else if (gabrielMP && gabrielMP.length > 0) {
    gabrielMP.forEach(sale => {
      console.log(`\n   ID: ${sale.id}`);
      console.log(`   Nome: ${sale.customer_name}`);
      console.log(`   Valor: R$ ${sale.amount}`);
      console.log(`   Status: ${sale.status}`);
      console.log(`   Order Status: ${sale.order_status}`);
      console.log(`   Payment Method: ${sale.payment_method}`);
      console.log(`   Gateway: ${sale.payment_gateway}`);
      console.log(`   Created: ${sale.created_at}`);
    });
  } else {
    console.log('   ❌ Nenhuma venda encontrada');
  }
  
  // 2. Vendas do Helcio (todas)
  console.log('\n\n2️⃣ HELCIO - TODAS AS VENDAS:');
  const { data: helcioAll, error: errHelcio } = await supabase
    .from('sales')
    .select('*')
    .ilike('customer_name', '%helcio%')
    .order('created_at', { ascending: false });
  
  if (errHelcio) {
    console.error('❌ Erro:', errHelcio);
  } else if (helcioAll && helcioAll.length > 0) {
    helcioAll.forEach(sale => {
      console.log(`\n   ID: ${sale.id}`);
      console.log(`   Nome: ${sale.customer_name}`);
      console.log(`   Valor: R$ ${sale.amount}`);
      console.log(`   Status: ${sale.status}`);
      console.log(`   Order Status: ${sale.order_status}`);
      console.log(`   Payment Method: ${sale.payment_method}`);
      console.log(`   Gateway: ${sale.payment_gateway}`);
      console.log(`   Created: ${sale.created_at}`);
    });
  } else {
    console.log('   ❌ Nenhuma venda encontrada');
  }
  
  // 3. Buscar pedido específico do Helcio de R$ 202,80 na Appmax
  console.log('\n\n3️⃣ PEDIDO ESPECÍFICO - HELCIO R$ 202,80:');
  const { data: helcio202, error: err202 } = await supabase
    .from('sales')
    .select('*')
    .eq('payment_gateway', 'appmax')
    .ilike('customer_name', '%helcio%')
    .eq('amount', 202.80);
  
  if (err202) {
    console.error('❌ Erro:', err202);
  } else if (helcio202 && helcio202.length > 0) {
    console.log(`   ✅ Encontrado ${helcio202.length} pedido(s):`);
    helcio202.forEach(sale => {
      console.log(`\n   ID: ${sale.id}`);
      console.log(`   External ID: ${sale.external_id}`);
      console.log(`   Nome: ${sale.customer_name}`);
      console.log(`   Valor: R$ ${sale.amount}`);
      console.log(`   Status: ${sale.status}`);
      console.log(`   Order Status: ${sale.order_status}`);
      console.log(`   Payment Method: ${sale.payment_method}`);
      console.log(`   Gateway: ${sale.payment_gateway}`);
      console.log(`   Created: ${sale.created_at}`);
    });
  } else {
    console.log('   ❌ Nenhuma venda de R$ 202,80 encontrada');
  }
}

diagnosticar().catch(console.error);
