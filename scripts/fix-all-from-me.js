const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://egsmraszqnmosmtjuzhx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc21yYXN6cW5tb3NtdGp1emh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ4NzcxMCwiZXhwIjoyMDg0MDYzNzEwfQ.wuM5GbYqaDTyf4T3fR62U1sWqZ06RJ3nXHk56I2VcAQ'
);

async function fixAll() {
  console.log('🔧 Buscando TODAS as mensagens com raw_payload...');
  
  const { data: messages, error } = await supabase
    .from('whatsapp_messages')
    .select('id, content, from_me, raw_payload')
    .not('raw_payload', 'is', null);
  
  if (error) {
    console.log('Erro:', error);
    return;
  }
  
  console.log(`📊 Total de mensagens com payload: ${messages.length}`);
  
  let fixed = 0;
  let skipped = 0;
  let noFromMe = 0;
  
  for (const msg of messages) {
    const payloadFromMe = msg.raw_payload?.key?.fromMe;
    
    if (payloadFromMe === undefined || payloadFromMe === null) {
      noFromMe++;
      continue;
    }
    
    const correctValue = payloadFromMe === true || payloadFromMe === 'true';
    
    if (msg.from_me !== correctValue) {
      const { error: updateError } = await supabase
        .from('whatsapp_messages')
        .update({ from_me: correctValue })
        .eq('id', msg.id);
      
      if (!updateError) {
        fixed++;
        console.log(`✅ Corrigido: "${(msg.content || '').substring(0, 25)}..." de ${msg.from_me} para ${correctValue}`);
      }
    } else {
      skipped++;
    }
  }
  
  console.log(`\n=== RESULTADO ===`);
  console.log(`✅ Corrigidas: ${fixed}`);
  console.log(`⏭️ Já corretas: ${skipped}`);
  console.log(`❓ Sem fromMe no payload: ${noFromMe}`);
}

fixAll();
