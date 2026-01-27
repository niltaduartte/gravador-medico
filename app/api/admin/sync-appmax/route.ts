import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidateAdminPages } from '@/lib/actions/revalidate'

/**
 * API de Sincronização Manual com Appmax
 * Busca pedidos históricos da Appmax e importa para o banco
 * 
 * Uso:
 * POST /api/admin/sync-appmax
 * Body: { days?: number, force?: boolean }
 * 
 * ✅ CACHE REVALIDATION: Após sincronizar, invalida o cache automaticamente
 */

const APPMAX_API_URL = 'https://admin.appmax.com.br/api/v3'
// Usar as variáveis corretas do .env.local
const APPMAX_TOKEN = process.env.APPMAX_TOKEN || process.env.APPMAX_API_KEY || ''

// Mapeamento de status da Appmax para nosso sistema
const STATUS_MAP: Record<string, string> = {
  'pago': 'paid',
  'aprovado': 'approved',
  'autorizado': 'approved',
  'integrado': 'paid',           // Status de pedido integrado/entregue
  'enviado': 'paid',             // Pedido enviado
  'entregue': 'paid',            // Pedido entregue
  'completed': 'paid',           // Pedido completo
  'pendente': 'pending',
  'pendente de pagamento': 'pending',
  'recusado': 'refused',
  'cancelado': 'cancelled',
  'estornado': 'refunded',       // ✅ APPMAX usa 'estornado'
  'refunded': 'refunded',
  'chargeback': 'chargeback',
  'analise antifraude': 'fraud_analysis',
  'análise antifraude': 'fraud_analysis',
  'expired': 'expired',
  'boleto vencido': 'expired',
  'pix expirado': 'expired'
}

function normalizeStatus(status?: string): string {
  if (!status) return 'pending'
  const normalized = status.toLowerCase().trim()
  return STATUS_MAP[normalized] || 'pending'
}

function normalizePaymentMethod(method?: string): string {
  if (!method) return 'unknown'
  const normalized = method.toLowerCase().trim()
  
  // Appmax payment_type values: CreditCard, Pix, Boleto, DebitCard
  if (normalized === 'creditcard' || normalized === 'credit_card') return 'credit_card'
  if (normalized === 'debitcard' || normalized === 'debit_card') return 'debit_card'
  if (normalized.includes('pix')) return 'pix'
  if (normalized.includes('boleto') || normalized.includes('billet')) return 'boleto'
  if (normalized.includes('cartao') || normalized.includes('cartão') || normalized.includes('credit')) return 'credit_card'
  if (normalized.includes('debito') || normalized.includes('débito') || normalized.includes('debit')) return 'debit_card'
  
  return normalized
}

async function fetchAppmaxOrders(days: number = 30): Promise<any[]> {
  let allOrders: any[] = []
  let currentPage = 1
  let hasMorePages = true
  
  console.log(`📡 [APPMAX] Token: ${APPMAX_TOKEN ? 'Configurado (***' + APPMAX_TOKEN.slice(-4) + ')' : 'NÃO CONFIGURADO'}`)

  while (hasMorePages) {
    const url = new URL(`${APPMAX_API_URL}/order`)
    url.searchParams.set('limit', '100') // Máximo por página
    url.searchParams.set('page', currentPage.toString())
    
    console.log(`📡 [APPMAX] Buscando página ${currentPage}... URL: ${url.toString()}`)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'access-token': APPMAX_TOKEN,
        'Content-Type': 'application/json'
      }
    })

    console.log(`📡 [APPMAX] Response status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [APPMAX] Erro da API:', errorText)
      throw new Error(`Appmax API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    // A API da Appmax retorna estrutura paginada:
    // { success: true, data: { total: 54, per_page: 10, data: [...] } }
    let pageOrders: any[] = []
    
    if (data.data && data.data.data && Array.isArray(data.data.data)) {
      // Formato paginado: data.data.data
      pageOrders = data.data.data
      const totalPages = data.data.last_page || 1
      console.log(`✅ [APPMAX] Página ${currentPage}/${totalPages} - ${pageOrders.length} pedidos`)
      
      // Verificar se há mais páginas
      hasMorePages = currentPage < totalPages
      currentPage++
    } else if (Array.isArray(data.data)) {
      // Formato legado: data.data é o array
      pageOrders = data.data
      hasMorePages = false
    } else {
      hasMorePages = false
    }
    
    allOrders = [...allOrders, ...pageOrders]
    
    // Safety: máximo 10 páginas para evitar loop infinito
    if (currentPage > 10) {
      console.warn('⚠️ [APPMAX] Limite de páginas atingido (10)')
      break
    }
  }
  
  console.log(`✅ [APPMAX] Total de pedidos carregados: ${allOrders.length}`)
  
  if (allOrders.length > 0) {
    const sample = allOrders[0]
    console.log(`✅ [APPMAX] Primeiro pedido (amostra):`, JSON.stringify({
      id: sample.id,
      status: sample.status,
      payment_type: sample.payment_type,
      payment_method: sample.payment_method,
      pix_expiration_date: sample.pix_expiration_date,
      customer: sample.customer ? {
        firstname: sample.customer.firstname,
        lastname: sample.customer.lastname,
        email: sample.customer.email,
        telephone: sample.customer.telephone
      } : 'NULL',
      total: sample.total_amount || sample.amount || sample.value
    }, null, 2))
  }
  
  // Filtrar localmente por data (últimos X dias)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  const filteredOrders = allOrders.filter((order: any) => {
    const orderDate = new Date(order.created_at || order.date)
    return orderDate >= startDate
  })
  
  console.log(`📅 [APPMAX] Data de corte: ${startDate.toISOString()}`)
  console.log(`📅 [APPMAX] Pedidos filtrados (últimos ${days} dias): ${filteredOrders.length}`)
  
  return filteredOrders
}

async function syncOrder(order: any) {
  try {
    const orderId = order.id?.toString()
    if (!orderId) {
      console.warn('⚠️ Order sem ID:', order)
      return { success: false, error: 'Missing order ID', orderId: 'unknown' }
    }

    console.log(`🔄 Sincronizando pedido ${orderId}...`)

    // Extrair dados do pedido - ESTRUTURA REAL DA APPMAX API
    const customer = order.customer || {}
    const customerEmail = customer.email || order.email || order.customer_email || null
    
    // Nome: Appmax usa firstname + lastname ou fullname
    let customerName = null
    if (customer.fullname) {
      customerName = customer.fullname
    } else if (customer.firstname && customer.lastname) {
      customerName = `${customer.firstname} ${customer.lastname}`.trim()
    } else if (customer.firstname) {
      customerName = customer.firstname
    } else if (customer.name) {
      customerName = customer.name
    } else if (order.company_name) {
      customerName = order.company_name
    }
    
    const customerPhone = customer.telephone || customer.phone || order.telephone || order.phone || null
    const customerCpf = customer.document_number || customer.cpf || order.company_cnpj || null
    
    console.log(`📋 [APPMAX] Pedido ${orderId}: Nome="${customerName}", Email="${customerEmail}", Valor=${order.total}`)

    if (!customerEmail) {
      console.warn(`⚠️ Pedido ${orderId} sem email`)
      return { success: false, error: 'Missing customer email', orderId }
    }

    // Buscar ou criar customer
    let customerId: string | null = null
    try {
      const { data: customerRow, error: customerError } = await supabaseAdmin
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
      console.warn('Erro ao upsert customer:', error)
    }

    // Extrair valores - APPMAX usa 'total' ou 'full_payment_amount'
    const totalAmount = Number(order.total || order.full_payment_amount || order.total_amount || order.amount || order.value || 0)
    const discount = Number(order.discount || 0)
    const subtotal = Number(order.total_products || totalAmount + discount)

    // Extrair método de pagamento - Appmax usa 'payment_type' não 'payment_method'
    const rawPaymentMethod = order.payment_type || order.payment_method || ''
    const paymentMethod = normalizePaymentMethod(rawPaymentMethod)
    
    // Extrair status com lógica especial para PIX expirado
    let status = normalizeStatus(order.status || order.order_status)
    
    // ✅ PIX EXPIRADO: Se for PIX e status for cancelado, verificar se expirou
    const isPix = paymentMethod === 'pix' || rawPaymentMethod.toLowerCase().includes('pix')
    const pixExpirationDate = order.pix_expiration_date || order.expiration_date || null
    
    if (isPix && status === 'cancelled' && pixExpirationDate) {
      const expDate = new Date(pixExpirationDate)
      if (expDate < new Date()) {
        status = 'expired' // PIX expirado = cinza, não cancelado
        console.log(`🔄 PIX ${orderId}: cancelado → expired (expirou em ${expDate.toISOString()})`)
      }
    }
    
    // Se for PIX cancelado sem data de expiração, assumir expirado
    if (isPix && status === 'cancelled' && !pixExpirationDate) {
      status = 'expired'
      console.log(`🔄 PIX ${orderId}: cancelado → expired (sem data de expiração)`)
    }

    // Extrair cupom (se tiver)
    const couponCode = order.coupon_code || order.discount_code || null
    const couponDiscount = couponCode ? discount : 0

    // Datas
    const now = new Date().toISOString()
    const createdAt = order.created_at || order.date || now

    // Criar/atualizar sale
    const salePayload: Record<string, any> = {
      appmax_order_id: orderId,
      payment_gateway: 'appmax', // ⚠️ IMPORTANTE: Define o gateway
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
      order_status: status,       // Campo correto usado pelo dashboard
      status: status,             // Backup para compatibilidade
      payment_method: paymentMethod,
      created_at: createdAt,
      updated_at: now,
      metadata: {
        synced_from_appmax: true,
        synced_at: now,
        original_order: order
      }
    }

    const { data: saleRow, error: saleError } = await supabaseAdmin
      .from('sales')
      .upsert(salePayload, { onConflict: 'appmax_order_id' })
      .select('id')
      .single()

    if (saleError) {
      console.error(`❌ Erro ao upsert pedido ${orderId}:`, saleError)
      return { success: false, error: saleError.message, orderId }
    }

    console.log(`✅ Pedido ${orderId} sincronizado com sucesso (${status})`)
    return { success: true, saleId: saleRow?.id, orderId, status }
  } catch (error: any) {
    console.error('Erro ao sincronizar pedido:', error)
    return { success: false, error: error.message }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Remover auth header - já validado no middleware
    
    if (!APPMAX_TOKEN) {
      console.error('❌ APPMAX_TOKEN não configurado')
      return NextResponse.json({ 
        error: 'APPMAX_TOKEN não configurado no .env.local' 
      }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const days = body.days || 45 // Últimos 45 dias por padrão (desde 15/01)
    const force = body.force || false

    console.log(`🔄 Iniciando sincronização dos últimos ${days} dias... (force=${force})`)

    // Se force=true, deletar dados antigos da Appmax para forçar re-inserção
    if (force) {
      console.log('🗑️ [FORCE] Removendo dados antigos da Appmax para re-sincronizar...')
      const { error: deleteError } = await supabaseAdmin
        .from('sales')
        .delete()
        .eq('payment_gateway', 'appmax')
      
      if (deleteError) {
        console.warn('⚠️ Erro ao deletar dados antigos:', deleteError.message)
      } else {
        console.log('✅ Registros antigos da Appmax removidos')
      }
    }

    // Buscar pedidos da Appmax
    const orders = await fetchAppmaxOrders(days)
    console.log(`📦 Encontrados ${orders.length} pedidos na Appmax`)

    // Sincronizar cada pedido
    const results = []
    for (const order of orders) {
      const result = await syncOrder(order)
      results.push(result)
      
      // Log de progresso
      if (results.length % 10 === 0) {
        console.log(`✅ Processados ${results.length}/${orders.length} pedidos`)
      }
    }

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`✅ Sincronização concluída: ${successful} sucesso, ${failed} falhas`)

    // 🔄 INVALIDAR CACHE DO DASHBOARD
    console.log('🔄 [APPMAX SYNC] Invalidando cache do dashboard...')
    await revalidateAdminPages()
    console.log('✅ [APPMAX SYNC] Cache invalidado - Dashboard atualizado!')

    return NextResponse.json({
      success: true,
      message: `Sincronização concluída. Dashboard atualizado automaticamente.`,
      stats: {
        total: orders.length,
        successful,
        failed,
        results: results.map(r => ({
          orderId: r.orderId,
          success: r.success,
          error: r.error
        }))
      }
    })

  } catch (error: any) {
    console.error('❌ Erro na sincronização:', error)
    return NextResponse.json({
      error: error.message || 'Erro ao sincronizar pedidos'
    }, { status: 500 })
  }
}
