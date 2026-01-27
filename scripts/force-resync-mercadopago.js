#!/usr/bin/env node

/**
 * Force Resync Mercado Pago
 * 
 * Deleta todas as vendas do Mercado Pago e reimporta os dados
 * Útil para corrigir dados incorretos após ajustes de mapeamento
 * 
 * Uso: node scripts/force-resync-mercadopago.js
 */

// Carregar variáveis de ambiente PRIMEIRO
require('dotenv').config({ path: '.env.local' })

const envAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const envSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔧 Verificando ambiente...')
console.log(`   SUPABASE_URL: ${envSupabaseUrl ? 'OK' : 'NÃO CONFIGURADO'}`)
console.log(`   SUPABASE_KEY: ${envSupabaseKey ? 'OK' : 'NÃO CONFIGURADO'}`)
console.log(`   MP_TOKEN: ${envAccessToken ? 'OK' : 'NÃO CONFIGURADO'}`)

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(envSupabaseUrl, envSupabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Status mapping
const STATUS_MAP = {
  'approved': 'paid',
  'authorized': 'approved',
  'pending': 'pending',
  'in_process': 'pending',
  'in_mediation': 'pending',
  'rejected': 'refused',
  'cancelled': 'cancelled',
  'refunded': 'refunded',
  'charged_back': 'chargeback'
}

function normalizeStatus(status) {
  if (!status) return 'pending'
  return STATUS_MAP[status.toLowerCase()] || status.toLowerCase()
}

function normalizePaymentMethod(method) {
  if (!method) return 'unknown'
  const normalized = method.toLowerCase()
  
  if (normalized === 'pix' || normalized.includes('pix')) return 'pix'
  if (normalized === 'credit_card' || normalized.includes('credit')) return 'credit_card'
  if (normalized === 'debit_card' || normalized.includes('debit')) return 'debit_card'
  if (normalized === 'bolbradesco' || normalized === 'ticket' || normalized.includes('boleto')) return 'boleto'
  if (normalized === 'account_money') return 'account_money'
  
  return normalized
}

async function fetchAllPayments(days = 90) {
  console.log(`\n📡 Buscando pagamentos dos últimos ${days} dias...`)
  
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  let allPayments = []
  let offset = 0
  const limit = 100
  let hasMore = true
  
  while (hasMore) {
    const url = new URL('https://api.mercadopago.com/v1/payments/search')
    url.searchParams.set('sort', 'date_created')
    url.searchParams.set('criteria', 'desc')
    url.searchParams.set('range', 'date_created')
    url.searchParams.set('begin_date', startDate.toISOString().split('T')[0] + 'T00:00:00.000-00:00')
    url.searchParams.set('end_date', new Date().toISOString().split('T')[0] + 'T23:59:59.999-00:00')
    url.searchParams.set('limit', limit.toString())
    url.searchParams.set('offset', offset.toString())
    
    console.log(`   📄 Página ${Math.floor(offset / limit) + 1} (offset: ${offset})...`)
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${envAccessToken}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erro da API MP:', errorText)
      throw new Error(`MP API error: ${response.status}`)
    }
    
    const data = await response.json()
    const results = data.results || []
    
    allPayments = allPayments.concat(results)
    console.log(`   ✅ ${results.length} pagamentos encontrados`)
    
    if (results.length < limit) {
      hasMore = false
    } else {
      offset += limit
    }
  }
  
  console.log(`\n📦 Total: ${allPayments.length} pagamentos encontrados\n`)
  return allPayments
}

async function deleteOldData() {
  console.log('🗑️ Deletando dados antigos do Mercado Pago...')
  
  const { error } = await supabase
    .from('sales')
    .delete()
    .eq('payment_gateway', 'mercadopago')
  
  if (error) {
    console.error('❌ Erro ao deletar:', error)
    throw error
  }
  
  console.log('✅ Dados antigos removidos\n')
}

async function syncPayment(payment) {
  try {
    const paymentId = payment.id.toString()
    
    // Extrair dados do pagador
    const payer = payment.payer || {}
    const customerEmail = payer.email || 'unknown@mercadopago.com'
    
    // Nome do cliente
    let customerName = 'Cliente MP'
    if (payer.first_name && payer.first_name.trim()) {
      customerName = `${payer.first_name} ${payer.last_name || ''}`.trim()
    } else if (customerEmail && customerEmail !== 'unknown@mercadopago.com') {
      customerName = customerEmail.split('@')[0]
    }
    
    const customerPhone = payer.phone?.number || null
    const customerCpf = payer.identification?.number || null
    
    // Valores
    const totalAmount = Number(payment.transaction_amount || 0)
    const status = normalizeStatus(payment.status)
    const paymentMethod = normalizePaymentMethod(payment.payment_method_id || payment.payment_type_id)
    const now = new Date().toISOString()
    
    // Criar/atualizar customer
    let customerId = null
    if (customerEmail && customerEmail !== 'unknown@mercadopago.com') {
      try {
        const { data: customerRow } = await supabase
          .from('customers')
          .upsert({
            email: customerEmail,
            name: customerName,
            phone: customerPhone,
            cpf: customerCpf
          }, {
            onConflict: 'email',
            ignoreDuplicates: false
          })
          .select('id')
          .single()
        
        customerId = customerRow?.id || null
      } catch (err) {
        // Ignorar erro de customer
      }
    }
    
    // Payload da venda
    const salePayload = {
      mercadopago_payment_id: paymentId,
      customer_id: customerId,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      total_amount: totalAmount,
      subtotal: totalAmount,
      order_status: status,
      status: status,
      payment_method: paymentMethod,
      payment_gateway: 'mercadopago',
      external_reference: payment.external_reference || null,
      created_at: payment.date_created || now,
      updated_at: now
    }
    
    const { error: insertError } = await supabase
      .from('sales')
      .insert(salePayload)
    
    if (insertError) {
      console.error(`❌ Erro ao inserir ${paymentId}:`, insertError.message)
      return { success: false, paymentId }
    }
    
    console.log(`📝 ${paymentId}: ${customerName} | R$ ${totalAmount} | ${paymentMethod} | ${status}`)
    return { success: true, paymentId }
    
  } catch (error) {
    console.error(`❌ Erro ao processar ${payment.id}:`, error.message)
    return { success: false, paymentId: payment.id.toString() }
  }
}

async function main() {
  console.log('🚀 FORCE RESYNC MERCADO PAGO')
  console.log('============================\n')
  
  // Verificar configuração
  if (!envAccessToken) {
    console.error('❌ MERCADOPAGO_ACCESS_TOKEN não configurado!')
    process.exit(1)
  }
  
  if (!envSupabaseUrl || !envSupabaseKey) {
    console.error('❌ Variáveis do Supabase não configuradas!')
    process.exit(1)
  }
  
  console.log('✅ Variáveis de ambiente OK\n')
  
  try {
    // 1. Deletar dados antigos
    await deleteOldData()
    
    // 2. Buscar todos os pagamentos (últimos 90 dias)
    const payments = await fetchAllPayments(90)
    
    if (payments.length === 0) {
      console.log('⚠️ Nenhum pagamento encontrado no Mercado Pago')
      process.exit(0)
    }
    
    // 3. Sincronizar cada pagamento
    console.log('📥 Importando pagamentos...\n')
    
    let success = 0
    let errors = 0
    
    for (const payment of payments) {
      const result = await syncPayment(payment)
      if (result.success) {
        success++
      } else {
        errors++
      }
    }
    
    console.log('\n============================')
    console.log(`✅ Concluído: ${success} sucesso, ${errors} falhas`)
    console.log('============================\n')
    
  } catch (error) {
    console.error('❌ Erro fatal:', error.message)
    process.exit(1)
  }
}

main()
