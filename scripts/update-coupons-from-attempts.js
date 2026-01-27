#!/usr/bin/env node
/**
 * 🎟️ ATUALIZAR CUPONS NAS VENDAS
 * 
 * Este script busca os cupons usados nos checkout_attempts
 * e atualiza as vendas correspondentes
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function updateCoupons() {
  console.log('🎟️ Atualizando cupons nas vendas...\n')

  // 1. Buscar todas as vendas sem cupom
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id, customer_email, customer_name, total_amount, coupon_code, discount')
    .is('coupon_code', null)
    .order('created_at', { ascending: false })

  if (salesError) {
    console.error('❌ Erro ao buscar vendas:', salesError.message)
    return
  }

  console.log(`📋 Vendas sem cupom: ${sales.length}`)

  // 2. Buscar checkout_attempts com cupom
  const { data: attempts, error: attemptsError } = await supabase
    .from('checkout_attempts')
    .select('id, customer_email, discount_code, cart_value, created_at')
    .not('discount_code', 'is', null)
    .order('created_at', { ascending: false })

  if (attemptsError) {
    console.error('❌ Erro ao buscar checkout_attempts:', attemptsError.message)
    return
  }

  console.log(`📋 Checkout attempts com cupom: ${attempts.length}`)

  // 3. Tentar casar vendas com attempts pelo email
  let updated = 0
  for (const sale of sales) {
    // Procurar attempt com mesmo email e cupom
    const matchingAttempt = attempts.find(a => 
      a.customer_email && 
      sale.customer_email && 
      a.customer_email.toLowerCase() === sale.customer_email.toLowerCase() &&
      a.discount_code
    )

    if (matchingAttempt) {
      console.log(`\n🔗 Match encontrado:`)
      console.log(`   Venda: ${sale.customer_name} (${sale.customer_email})`)
      console.log(`   Cupom: ${matchingAttempt.discount_code}`)

      // Atualizar a venda com o cupom
      const { error: updateError } = await supabase
        .from('sales')
        .update({
          coupon_code: matchingAttempt.discount_code,
        })
        .eq('id', sale.id)

      if (updateError) {
        console.log(`   ❌ Erro ao atualizar: ${updateError.message}`)
      } else {
        console.log(`   ✅ Cupom atualizado!`)
        updated++
      }
    }
  }

  console.log(`\n✅ Total atualizado: ${updated} vendas`)

  // 4. Verificar vendas com cupom após atualização
  const { data: salesWithCoupons } = await supabase
    .from('sales')
    .select('customer_name, coupon_code, total_amount, payment_gateway')
    .not('coupon_code', 'is', null)

  console.log('\n📊 VENDAS COM CUPOM:')
  salesWithCoupons?.forEach(s => {
    console.log(`   ${s.customer_name?.substring(0, 25).padEnd(25)} | 🎟️ ${s.coupon_code?.padEnd(15)} | R$ ${s.total_amount?.toFixed(2)} | ${s.payment_gateway}`)
  })
}

updateCoupons().catch(console.error)
