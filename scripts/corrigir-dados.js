const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://egsmraszqnmosmtjuzhx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc21yYXN6cW5tb3NtdGp1emh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ4NzcxMCwiZXhwIjoyMDg0MDYzNzEwfQ.wuM5GbYqaDTyf4T3fR62U1sWqZ06RJ3nXHk56I2VcAQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function corrigir() {
  console.log('\n🔧 CORRIGINDO DADOS\n');
  
  // 1. Corrigir Gabriel - status pending para approved
  console.log('1️⃣ Corrigindo Gabriel (Mercado Pago) - pending → approved:');
  const { data: gabrielUpdate, error: errGabriel } = await supabase
    .from('sales')
    .update({ status: 'approved' })
    .eq('id', '08121e43-b435-432e-aa12-6cab0e2edd63')
    .select();
  
  if (errGabriel) {
    console.error('   ❌ Erro:', errGabriel);
  } else {
    console.log('   ✅ Corrigido! Status: approved, Order Status: paid');
  }
  
  // 2. Corrigir Helcio MP - payment_method null para pix
  console.log('\n2️⃣ Corrigindo Helcio (Mercado Pago) - payment_method null → pix:');
  const { data: helcioUpdate, error: errHelcio } = await supabase
    .from('sales')
    .update({ payment_method: 'pix' })
    .eq('id', 'ee723caa-f68b-4672-ab89-441df0fdcf4c')
    .select();
  
  if (errHelcio) {
    console.error('   ❌ Erro:', errHelcio);
  } else {
    console.log('   ✅ Corrigido! Payment Method: pix');
  }
  
  console.log('\n✅ Correções concluídas!\n');
}

corrigir().catch(console.error);
