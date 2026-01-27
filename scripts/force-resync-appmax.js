#!/usr/bin/env node
/**
 * Script para forçar re-sincronização dos dados da Appmax
 * Deleta todos os registros da Appmax e re-importa com dados corretos
 * 
 * Uso: node scripts/force-resync-appmax.js
 */

require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPMAX_TOKEN = process.env.APPMAX_TOKEN

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltam variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!APPMAX_TOKEN) {
  console.error('❌ Falta APPMAX_TOKEN')
  process.exit(1)
}

const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const STATUS_MAP = {
  'pago': 'paid',
  'aprovado': 'approved',
  'autorizado': 'approved',
  'integrado': 'paid',
  'enviado': 'paid',
  'entregue': 'paid',
  'completed': 'paid',
  'pendente': 'pending',
  'pendente de pagamento': 'pending',
  'recusado': 'refused',
  'cancelado': 'cancelled',
  'estornado': 'refunded',
  'refunded': 'refunded',
  'chargeback': 'chargeback',
  'expired': 'expired'
}

function normalizeStatus(status) {
  if (!status) return 'pending'
  const normalized = status.toLowerCase().trim()
  return STATUS_MAP[normalized] || 'pending'
}

function normalizePaymentMethod(method) {
  if (!method) return 'unknown'
  const normalized = method.toLowerCase().trim()
  if (normalized === 'creditcard' || normalized === 'credit_card') return 'credit_card'
  if (normalized === 'debitcard' || normalized === 'debit_card') return 'debit_card'
  if (normalized.includes('pix')) return 'pix'
  if (normalized.includes('boleto') || normalized.includes('billet')) return 'boleto'
  return normalized
}

async function fetchAllAppmaxOrders() {
  let allOrders = []
  let currentPage = 1
  let hasMore = true

  while (hasMore && currentPage <= 10) {
    console.log(`📡 Buscando página ${currentPage}...`)
    
    const url = `https://admin.appmax.com.br/api/v3/order?limit=100&page=${currentPage}`
    const response = await fetch(url, {
      headers: { 'access-token': APPMAX_TOKEN }
    })

    if (!response.ok) {
      throw new Error(`Appmax API error: ${response.status}`)
    }

    const data = await response.json()
    const pageOrders = data?.data?.data || []
    const lastPage = data?.data?.last_page || 1

    allOrders = [...allOrders, ...pageOrders]
    console.log(`  ✅ ${pageOrders.length} pedidos na página ${currentPage}/${lastPage}`)

    hasMore = currentPage < lastPage
    currentPage++
  }

  console.log(`📦 Total: ${allOrders.length} pedidos encontrados`)
  return allOrders
}

async function syncOrder(order) {
  const orderId = order.id?.toString()
  if (!orderId) return null

  const customer = order.customer || {}
  const customerEmail = customer.email || order.email
  
  // Nome: usar fullname ou firstname+lastname
  let customerName = customer.fullname
  if (!customerName && customer.firstname) {
    customerName = `${customer.firstname} ${customer.lastname || ''}`.trim()
  }
  if (!customerName) {
    customerName = order.company_name || 'Cliente Appmax'
  }

  if (!customerEmail) {
    console.warn(`  ⚠️ Pedido ${orderId} sem email, pulando...`)
    return null
  }

  // Valores - usar order.total
  const totalAmount = Number(order.total || order.full_payment_amount || 0)
  const discount = Number(order.discount || 0)
  const subtotal = Number(order.total_products || totalAmount + discount)

  // Método de pagamento - usar payment_type
  const paymentMethod = normalizePaymentMethod(order.payment_type)

  // Status
  let status = normalizeStatus(order.status)
  
  // PIX cancelado = expired
  const isPix = paymentMethod === 'pix' || (order.payment_type || '').toLowerCase().includes('pix')
  if (isPix && status === 'cancelled') {
    status = 'expired'
  }

  const customerPhone = customer.telephone || customer.phone || null
  const customerCpf = customer.document_number || null

  const payload = {
    appmax_order_id: orderId,
    payment_gateway: 'appmax',
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    customer_cpf: customerCpf,
    total_amount: totalAmount,
    subtotal: subtotal,
    discount: discount,
    order_status: status,
    status: status,
    payment_method: paymentMethod,
    created_at: order.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  console.log(`  📝 ${orderId}: ${customerName} | R$ ${totalAmount} | ${paymentMethod} | ${status}`)

  const { error } = await supabase
    .from('sales')
    .upsert(payload, { onConflict: 'appmax_order_id' })

  if (error) {
    console.error(`  ❌ Erro: ${error.message}`)
    return null
  }

  return payload
}

async function main() {
  console.log('🚀 FORCE RESYNC APPMAX')
  console.log('='.repeat(50))

  // 1. Deletar dados antigos
  console.log('\n🗑️ Deletando dados antigos da Appmax...')
  const { error: deleteError } = await supabase
    .from('sales')
    .delete()
    .eq('payment_gateway', 'appmax')

  if (deleteError) {
    console.error('❌ Erro ao deletar:', deleteError.message)
  } else {
    console.log('✅ Dados antigos removidos')
  }

  // 2. Buscar todos os pedidos
  console.log('\n📡 Buscando pedidos da Appmax...')
  const orders = await fetchAllAppmaxOrders()

  // 3. Sincronizar cada pedido
  console.log('\n🔄 Sincronizando pedidos...')
  let success = 0
  let failed = 0

  for (const order of orders) {
    const result = await syncOrder(order)
    if (result) success++
    else failed++
  }

  console.log('\n' + '='.repeat(50))
  console.log(`✅ Concluído: ${success} sucesso, ${failed} falhas`)
  console.log('🔄 Atualize a página de vendas para ver os novos dados!')
}

main().catch(console.error)
