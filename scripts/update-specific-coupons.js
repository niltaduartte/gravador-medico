#!/usr/bin/env node
/**
 * Atualizar cupons específicos nas vendas
 */

require('dotenv').config({ path: '.env.local' });

const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const envSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔧 Verificando ambiente...')
console.log(`   SUPABASE_URL: ${envSupabaseUrl ? 'OK' : 'NÃO CONFIGURADO'}`)
console.log(`   SUPABASE_KEY: ${envSupabaseKey ? 'OK' : 'NÃO CONFIGURADO'}`)

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(envSupabaseUrl, envSupabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updateCoupons() {
  console.log('\n🎟️ ATUALIZAR CUPONS NAS VENDAS')
  console.log('================================\n')

  // Atualizações específicas
  const updates = [
    { email: 'gabriel_acardoso@hotmail.com', coupon: 'DESCONTOGC' },
    { email: 'GABRIEL_ACARDOSO@HOTMAIL.COM', coupon: 'DESCONTOGC' },
  ];

  // Também buscar emails do Helcio para ADMGM
  const { data: helcioSales } = await supabase
    .from('sales')
    .select('id, customer_email, customer_name')
    .ilike('customer_name', '%helcio%');

  console.log('Vendas do Helcio encontradas:');
  helcioSales?.forEach(s => {
    console.log(`  - ${s.customer_name} | ${s.customer_email}`);
    updates.push({ email: s.customer_email, coupon: 'ADMGM' });
  });

  // Buscar também vendas do Gabriel que podem ter usado ADMGM
  const { data: gabrielSales } = await supabase
    .from('sales')
    .select('id, customer_email, customer_name, total_amount')
    .ilike('customer_email', '%gabriel%');

  console.log('\nVendas do Gabriel encontradas:');
  gabrielSales?.forEach(s => {
    console.log(`  - ${s.customer_name} | ${s.customer_email} | R$ ${s.total_amount}`);
  });

  console.log('\n--- APLICANDO ATUALIZAÇÕES ---\n');

  for (const u of updates) {
    const { data, error } = await supabase
      .from('sales')
      .update({ coupon_code: u.coupon })
      .ilike('customer_email', u.email)
      .select('id, customer_name, customer_email, coupon_code');

    if (error) {
      console.log(`❌ Erro ${u.email}:`, error.message);
    } else if (data && data.length > 0) {
      data.forEach(s => {
        console.log(`✅ ${s.customer_name} (${s.customer_email}) -> 🎟️ ${s.coupon_code}`);
      });
    } else {
      console.log(`⚠️ ${u.email}: Nenhuma venda encontrada`);
    }
  }

  // Verificar resultado final
  console.log('\n--- VENDAS COM CUPOM ---\n');
  const { data: salesWithCoupons } = await supabase
    .from('sales')
    .select('customer_name, customer_email, coupon_code, total_amount, payment_gateway')
    .not('coupon_code', 'is', null);

  if (salesWithCoupons && salesWithCoupons.length > 0) {
    salesWithCoupons.forEach(s => {
      console.log(`  ${s.customer_name?.substring(0, 25).padEnd(25)} | 🎟️ ${(s.coupon_code || '').padEnd(12)} | R$ ${s.total_amount?.toFixed(2)} | ${s.payment_gateway}`);
    });
  } else {
    console.log('  Nenhuma venda com cupom encontrada');
  }

  console.log('\n✅ Script finalizado');
}

updateCoupons().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
