#!/usr/bin/env node

/**
 * Atualiza nomes dos clientes do Mercado Pago
 * 
 * Cruza dados do MP com checkout_attempts para obter nomes reais
 * 
 * Uso: node scripts/update-mp-customer-names.js
 */

require('dotenv').config({ path: '.env.local' })

const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const envSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔧 Verificando ambiente...')
console.log(`   SUPABASE_URL: ${envSupabaseUrl ? 'OK' : 'NÃO CONFIGURADO'}`)
console.log(`   SUPABASE_KEY: ${envSupabaseKey ? 'OK' : 'NÃO CONFIGURADO'}`)

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(envSupabaseUrl, envSupabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function main() {
  console.log('\n🚀 ATUALIZAR NOMES DE CLIENTES MERCADO PAGO')
  console.log('=============================================\n')
  
  // 1. Buscar vendas do MP sem nome correto
  console.log('📡 Buscando vendas do Mercado Pago...')
  const { data: mpSales, error: salesError } = await supabase
    .from('sales')
    .select('id, customer_email, customer_name, mercadopago_payment_id, external_reference, created_at')
    .eq('payment_gateway', 'mercadopago')
  
  if (salesError) {
    console.error('❌ Erro ao buscar vendas:', salesError)
    process.exit(1)
  }
  
  console.log(`   Encontradas ${mpSales?.length || 0} vendas do MP\n`)
  
  if (!mpSales || mpSales.length === 0) {
    console.log('⚠️ Nenhuma venda do Mercado Pago encontrada')
    process.exit(0)
  }
  
  let updated = 0
  let notFound = 0
  
  for (const sale of mpSales) {
    // Se já tem nome válido, pular
    if (sale.customer_name && 
        !sale.customer_name.includes('Cliente MP') && 
        !sale.customer_name.includes('XXXX') &&
        !sale.customer_name.includes('unknown')) {
      console.log(`✓ ${sale.id}: Já tem nome: ${sale.customer_name}`)
      continue
    }
    
    let checkout = null
    
    // Tentar buscar pelo external_reference (gateway_order_id no checkout)
    if (sale.external_reference) {
      const { data: checkoutByRef } = await supabase
        .from('checkout_attempts')
        .select('customer_name, customer_email, customer_phone, customer_cpf')
        .eq('gateway_order_id', sale.external_reference)
        .maybeSingle()
      
      if (checkoutByRef) checkout = checkoutByRef
    }
    
    // Se não achou, tentar pelo email (se for válido)
    if (!checkout && sale.customer_email && 
        !sale.customer_email.includes('XXXX') && 
        !sale.customer_email.includes('unknown')) {
      const { data: checkoutByEmail } = await supabase
        .from('checkout_attempts')
        .select('customer_name, customer_email, customer_phone, customer_cpf')
        .eq('customer_email', sale.customer_email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (checkoutByEmail) checkout = checkoutByEmail
    }
    
    // Se ainda não achou, tentar pela data (30 minutos de tolerância)
    if (!checkout && sale.created_at) {
      const saleDate = new Date(sale.created_at)
      const before = new Date(saleDate.getTime() - 30 * 60 * 1000).toISOString()
      const after = new Date(saleDate.getTime() + 30 * 60 * 1000).toISOString()
      
      const { data: checkoutByDate } = await supabase
        .from('checkout_attempts')
        .select('customer_name, customer_email, customer_phone, customer_cpf, total_amount')
        .eq('payment_gateway', 'mercadopago')
        .gte('created_at', before)
        .lte('created_at', after)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (checkoutByDate) checkout = checkoutByDate
    }
    
    if (checkout && checkout.customer_name) {
      // Atualizar a venda com o nome correto
      const { error: updateError } = await supabase
        .from('sales')
        .update({ 
          customer_name: checkout.customer_name,
          customer_email: checkout.customer_email || sale.customer_email,
          customer_phone: checkout.customer_phone || sale.customer_phone,
        })
        .eq('id', sale.id)
      
      if (updateError) {
        console.error(`❌ Erro ao atualizar ${sale.id}:`, updateError.message)
      } else {
        console.log(`✅ ${sale.id}: ${sale.customer_name} → ${checkout.customer_name}`)
        updated++
      }
    } else {
      console.log(`❓ ${sale.id}: Não encontrado checkout para MP Payment ${sale.mercadopago_payment_id}`)
      notFound++
    }
  }
  
  console.log('\n=============================================')
  console.log(`✅ Atualizados: ${updated}`)
  console.log(`❓ Não encontrados: ${notFound}`)
  console.log('=============================================\n')
}

main().catch(err => {
  console.error('❌ Erro fatal:', err)
  process.exit(1)
})
