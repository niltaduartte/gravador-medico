#!/usr/bin/env node

/**
 * 🔄 SINCRONIZAÇÃO DIRETA: Vendas da Appmax
 * Executa sincronização sem passar pelo middleware de autenticação
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Carregar .env.local
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const value = match[2].trim().replace(/^["']|["']$/g, '')
    envVars[key] = value
  }
})

const APPMAX_API_URL = 'https://admin.appmax.com.br/api/v3'
const APPMAX_TOKEN = envVars.APPMAX_TOKEN || envVars.APPMAX_API_KEY
const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Mapas de status e métodos de pagamento (baseado nos status reais da Appmax)
const STATUS_MAP = {
  // Status da API Appmax (o que vem do backend)
  'integrado': 'approved',
  'aprovado': 'approved',
  'estornado': 'refunded',
  'cancelado': 'cancelled',
  
  // Status em português (da UI Appmax)
  'pagamento aprovado': 'approved',
  'pago': 'paid',
  'autorizado': 'approved',
  'pagamento pendente': 'pending',
  'pendente': 'pending',
  'expirado': 'expired',
  'recusado pelo banco': 'refused',
  'recusado': 'refused',
  'chargeback': 'chargeback',
  'analise antifraude': 'fraud_analysis',
  'análise antifraude': 'fraud_analysis',
  
  // Status em inglês (fallback)
  'expired': 'expired',
  'refused': 'refused',
  'refunded': 'refunded',
  'cancelled': 'cancelled',
  'approved': 'approved',
  'paid': 'paid',
  'pending': 'pending',
  'boleto vencido': 'expired',
  'pix expirado': 'expired'
}

function normalizeStatus(status) {
  if (!status) return 'pending'
  const normalized = status.toLowerCase().trim()
  return STATUS_MAP[normalized] || 'pending'
}

function normalizePaymentMethod(method) {
  if (!method) return 'unknown'
  const normalized = method.toLowerCase().trim()
  
  // Mapear tipos da Appmax
  if (normalized === 'creditcard') return 'credit_card'
  if (normalized === 'pix') return 'pix'
  if (normalized === 'boleto' || normalized === 'billet') return 'boleto'
  if (normalized === 'debitcard') return 'debit_card'
  
  // Fallbacks
  if (normalized.includes('pix')) return 'pix'
  if (normalized.includes('cartao') || normalized.includes('cartão') || normalized.includes('credit') || normalized.includes('card')) return 'credit_card'
  if (normalized.includes('boleto')) return 'boleto'
  
  return normalized
}

function getStatusLabel(status) {
  const labels = {
    'integrado': 'Pagamento Aprovado',
    'aprovado': 'Pagamento Aprovado',
    'pago': 'Pagamento Aprovado',
    'estornado': 'Estornado',
    'cancelado': 'Expirado',
    'pendente': 'Pagamento Pendente',
    'expired': 'Expirado',
    'refused': 'Recusado pelo banco',
    'paid': 'Pago',
    'approved': 'Pagamento Aprovado',
    'pending': 'Pagamento Pendente',
    'cancelled': 'Expirado',
    'refunded': 'Estornado'
  }
  
  return labels[status?.toLowerCase()] || status
}

async function fetchAppmaxOrders(days = 90) {
  console.log(`📡 Buscando pedidos da Appmax (últimos ${days} dias)...`)
  
  let allOrders = []
  let currentPage = 1
  let totalPages = 1
  
  // Buscar todas as páginas
  do {
    const url = new URL(`${APPMAX_API_URL}/order`)
    url.searchParams.set('limit', '100') // Aumentar para 100 por página
    url.searchParams.set('page', currentPage.toString())

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'access-token': APPMAX_TOKEN,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Appmax API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    // A resposta da Appmax tem estrutura: { data: { data: [...], total: X, last_page: Y } }
    if (data.data && Array.isArray(data.data.data)) {
      const orders = data.data.data
      allOrders = allOrders.concat(orders)
      
      totalPages = data.data.last_page || 1
      
      console.log(`� Página ${currentPage}/${totalPages}: ${orders.length} pedidos`)
      
      if (currentPage === 1) {
        console.log(`📊 Total de pedidos no sistema: ${data.data.total}`)
      }
      
      currentPage++
    } else {
      break
    }
  } while (currentPage <= totalPages)
  
  console.log(`✅ Total de pedidos buscados: ${allOrders.length}`)
  
  // Filtrar por data localmente
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  const filtered = allOrders.filter(order => {
    const orderDate = new Date(order.created_at || order.date || order.created)
    return orderDate >= startDate
  })
  
  console.log(`📅 Pedidos nos últimos ${days} dias: ${filtered.length}`)
  return filtered
}

async function fetchOrderDetails(orderId) {
  const url = `${APPMAX_API_URL}/order/${orderId}`
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'access-token': APPMAX_TOKEN,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.warn(`⚠️  Erro ao buscar detalhes do pedido ${orderId}: ${response.status}`)
      return null
    }

    const result = await response.json()
    return result.data || null
  } catch (error) {
    console.warn(`⚠️  Erro ao buscar detalhes do pedido ${orderId}:`, error.message)
    return null
  }
}

async function syncOrder(order, skipDetailsCheck = false) {
  try {
    const orderId = order.id?.toString()
    if (!orderId) {
      return { success: false, error: 'Missing order ID', orderId: 'unknown' }
    }

    // 🔄 USAR STATUS DA LISTAGEM (mais rápido, menos requisições)
    // Apenas buscar detalhes se skipDetailsCheck for false
    let currentOrderData = null
    if (!skipDetailsCheck) {
      currentOrderData = await fetchOrderDetails(orderId)
    }
    
    // Usar dados da listagem (já vem com status atualizado)
    const orderToProcess = currentOrderData || order
    const currentStatus = orderToProcess.status || order.status || order.order_status

    // Extrair dados
    const customer = orderToProcess.customer || order.customer || {}
    const customerEmail = customer.email || orderToProcess.email || order.email || null
    const customerName = customer.fullname || 
                        (customer.firstname && customer.lastname ? `${customer.firstname} ${customer.lastname}` : null) ||
                        customer.name || 
                        orderToProcess.customer_name || 
                        order.customer_name || 
                        'Cliente Appmax'
    const customerPhone = customer.telephone || customer.phone || orderToProcess.phone || order.phone || null
    const customerCpf = customer.document_number || customer.cpf || orderToProcess.cpf || order.cpf || null

    if (!customerEmail) {
      return { success: false, error: 'Missing customer email', orderId }
    }

    // Criar/atualizar customer
    let customerId = null
    try {
      const { data: customerRow, error: customerError } = await supabase
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

      if (!customerError) {
        customerId = customerRow?.id || null
      }
    } catch (error) {
      console.warn(`⚠️  Erro ao criar customer: ${error.message}`)
    }

    // Extrair valores (priorizar dados atualizados)
    const totalAmount = Number(orderToProcess.total || orderToProcess.total_amount || order.total || order.total_amount || order.amount || order.value || 0)
    const discount = Number(orderToProcess.discount || order.discount || 0)
    const subtotal = totalAmount + discount

    // Extrair status e método (USAR STATUS ATUAL e payment_type da Appmax)
    const status = normalizeStatus(currentStatus)
    const paymentMethod = normalizePaymentMethod(orderToProcess.payment_type || order.payment_type || orderToProcess.payment_method || order.payment_method)
    const statusLabel = getStatusLabel(currentStatus) // Label em português do status original
    
    // Mapear para order_status também (usado pela função get_analytics_period)
    const orderStatusMap = {
      'paid': 'paid',
      'approved': 'paid',  // Appmax usa 'approved' mas dashboard precisa de 'paid'
      'pending': 'pending',
      'cancelled': 'cancelled',
      'refunded': 'refunded',
      'chargeback': 'refunded',
      'fraud_analysis': 'pending',
      'expired': 'cancelled'
    }
    const orderStatus = orderStatusMap[status] || 'draft'

    // Extrair cupom
    const couponCode = order.coupon_code || order.discount_code || null
    const couponDiscount = couponCode ? discount : 0

    // Datas
    const now = new Date().toISOString()
    const createdAt = order.created_at || order.date || now

    // Criar/atualizar sale
    const salePayload = {
      appmax_order_id: orderId,
      payment_gateway: 'appmax', // ⚠️ IMPORTANTE!
      customer_id: customerId,
      customer_name: customerName || 'Cliente Appmax',
      customer_email: customerEmail,
      customer_phone: customerPhone,
      customer_cpf: customerCpf,
      total_amount: totalAmount,
      subtotal: subtotal,
      discount: discount,
      coupon_code: couponCode,
      coupon_discount: couponDiscount,
      status: status,
      order_status: orderStatus, // ✅ Adicionar order_status para o dashboard
      failure_reason: (status === 'cancelled' || status === 'refused' || status === 'expired') ? statusLabel : null, // Mostrar label do status original para cancelados
      payment_method: paymentMethod,
      created_at: createdAt,
      updated_at: now,
      metadata: {
        synced_from_appmax: true,
        synced_at: now,
        appmax_status_original: currentStatus, // Status atual da Appmax
        last_status_check: now,
        original_order: order
      }
    }

    const { data: saleRow, error: saleError } = await supabase
      .from('sales')
      .upsert(salePayload, { onConflict: 'appmax_order_id' })
      .select('id')
      .single()

    if (saleError) {
      return { success: false, error: saleError.message, orderId }
    }

    return { success: true, saleId: saleRow?.id, orderId, status }
  } catch (error) {
    return { success: false, error: error.message, orderId: order.id }
  }
}

async function main() {
  console.log('🔄 SINCRONIZAÇÃO DIRETA: Vendas Appmax\n')
  console.log('='.repeat(60))
  
  // Verificar configuração
  if (!APPMAX_TOKEN) {
    console.error('❌ APPMAX_TOKEN não configurado no .env.local!')
    process.exit(1)
  }
  
  console.log('✅ APPMAX_TOKEN:', APPMAX_TOKEN.slice(0, 10) + '...')
  console.log('✅ Supabase URL:', SUPABASE_URL)
  console.log('')
  
  // Parâmetros
  const args = process.argv.slice(2)
  const daysArg = args.find(arg => arg.startsWith('--days='))
  const days = daysArg ? parseInt(daysArg.split('=')[1]) : 90
  
  console.log(`📅 Período: últimos ${days} dias\n`)
  
  // Buscar pedidos
  console.log('1️⃣ BUSCAR PEDIDOS NA APPMAX')
  console.log('-'.repeat(60))
  const orders = await fetchAppmaxOrders(days)
  
  if (orders.length === 0) {
    console.log('\n⚠️  Nenhum pedido encontrado no período.')
    return
  }
  
  // Sincronizar
  console.log('\n2️⃣ IMPORTAR PEDIDOS COM STATUS ATUALIZADO')
  console.log('-'.repeat(60))
  console.log('⚡ Modo rápido: usando status da listagem (sem buscar detalhes individuais)')
  
  const results = []
  let processedCount = 0
  const statusCount = {}
  
  for (const order of orders) {
    const result = await syncOrder(order, true) // true = pular busca de detalhes
    results.push(result)
    processedCount++
    
    if (result.success) {
      statusCount[result.status] = (statusCount[result.status] || 0) + 1
      process.stdout.write(`✅ ${processedCount}/${orders.length} - ${result.status}\r`)
    } else {
      console.log(`\n❌ Pedido ${result.orderId}: ${result.error}`)
    }
  }
  
  console.log('\n')
  
  // Estatísticas
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  
  console.log('3️⃣ RESULTADO')
  console.log('-'.repeat(60))
  console.log(`✅ Importados com sucesso: ${successful}`)
  console.log(`❌ Falhas: ${failed}`)
  console.log(`📦 Total processado: ${orders.length}`)
  
  console.log('\n📊 STATUS DOS PEDIDOS:')
  Object.entries(statusCount).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
    const emoji = {
      'paid': '💰',
      'approved': '✅',
      'pending': '⏳',
      'cancelled': '❌',
      'refunded': '↩️',
      'refused': '🚫',
      'expired': '⌛',
      'fraud_analysis': '🔍',
      'chargeback': '⚠️'
    }[status] || '📝'
    console.log(`  ${emoji} ${status}: ${count}`)
  })
  
  if (failed > 0) {
    console.log('\n❌ PEDIDOS COM ERRO:')
    results.filter(r => !r.success).forEach(r => {
      console.log(`  • Pedido ${r.orderId}: ${r.error}`)
    })
  }
  
  console.log('\n✅ Sincronização concluída!')
  console.log('\n💡 Execute para verificar:')
  console.log('   node scripts/diagnostico-appmax-dashboard.js')
}

main().catch(error => {
  console.error('\n💥 ERRO:', error.message)
  process.exit(1)
})
