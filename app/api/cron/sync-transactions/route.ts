/**
 * 🔄 CRON JOB - RECONCILIAÇÃO DE PAGAMENTOS
 * 
 * OBJETIVO: Verificar pedidos pendentes e corrigir divergências entre
 * o banco local e as APIs do Mercado Pago / Appmax.
 * 
 * SEGURANÇA: Protegido por CRON_SECRET no header Authorization
 * 
 * ROTA: GET /api/cron/sync-transactions
 * 
 * CHAMADA:
 * curl -X GET https://seu-dominio/api/cron/sync-transactions \
 *   -H "Authorization: Bearer SEU_CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

const MERCADOPAGO_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN
const APPMAX_TOKEN = process.env.APPMAX_TOKEN
const CRON_SECRET = process.env.CRON_SECRET

interface ReconciliationResult {
  orderId: string
  oldStatus: string
  newStatus: string
  gateway: string
  fixed: boolean
  provisioned: boolean
}

/**
 * Verifica status de um pagamento no Mercado Pago
 */
async function checkMercadoPagoStatus(gatewayId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${gatewayId}`,
      {
        headers: {
          'Authorization': `Bearer ${MERCADOPAGO_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.error(`[RECONCILIATION] MP API error: ${response.status}`)
      return null
    }

    const payment = await response.json()
    
    // Mapear status do MP para nosso sistema
    const statusMap: Record<string, string> = {
      'approved': 'paid',
      'authorized': 'paid',
      'pending': 'pending',
      'in_process': 'pending',
      'rejected': 'cancelled',
      'cancelled': 'cancelled',
      'refunded': 'refunded',
      'charged_back': 'chargeback'
    }

    return statusMap[payment.status] || null
  } catch (error) {
    console.error('[RECONCILIATION] MP check error:', error)
    return null
  }
}

/**
 * Verifica status de um pedido na Appmax
 */
async function checkAppmaxStatus(orderId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://admin.appmax.com.br/api/v3/order/${orderId}`,
      {
        headers: {
          'access-token': APPMAX_TOKEN!,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.error(`[RECONCILIATION] Appmax API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    const order = data.data

    // Mapear status da Appmax para nosso sistema
    const statusText = order.status?.toLowerCase() || ''
    
    if (statusText.includes('aprovado') || statusText.includes('pago') || statusText.includes('integrado')) {
      return 'paid'
    } else if (statusText.includes('pendente')) {
      return 'pending'
    } else if (statusText.includes('cancelado') || statusText.includes('recusado') || statusText.includes('expirado')) {
      return 'cancelled'
    } else if (statusText.includes('estornado') || statusText.includes('chargeback')) {
      return 'refunded'
    }

    return null
  } catch (error) {
    console.error('[RECONCILIATION] Appmax check error:', error)
    return null
  }
}

/**
 * Executa provisionamento (entrega) do produto ao cliente
 */
async function executeProvisioning(orderId: string): Promise<boolean> {
  try {
    // Buscar dados do pedido
    const { data: sale, error } = await supabaseAdmin
      .from('sales')
      .select('customer_email, product_name, lovable_user_id')
      .eq('id', orderId)
      .single()

    if (error || !sale) {
      console.error('[PROVISIONING] Sale not found:', orderId)
      return false
    }

    // Se já tem usuário Lovable criado, considerar provisionado
    if (sale.lovable_user_id) {
      console.log('[PROVISIONING] Already provisioned:', orderId)
      return true
    }

    // Aqui você pode adicionar lógica de provisionamento
    // Por exemplo: criar usuário Lovable, enviar email de acesso, etc.
    console.log('[PROVISIONING] Executing for:', orderId)
    
    // TODO: Implementar lógica de provisionamento real
    // await createLovableUser(sale.customer_email, sale.product_name)
    
    return true
  } catch (error) {
    console.error('[PROVISIONING] Error:', error)
    return false
  }
}

/**
 * Rota principal de reconciliação
 */
export async function GET(request: NextRequest) {
  // 🔐 SEGURANÇA: Verificar CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!CRON_SECRET || token !== CRON_SECRET) {
    console.error('[RECONCILIATION] Unauthorized access attempt')
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  console.log('🔄 [RECONCILIATION] Starting reconciliation process...')

  try {
    // 📊 Buscar pedidos pendentes das últimas 24 horas
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    const { data: pendingOrders, error } = await supabaseAdmin
      .from('sales')
      .select('id, appmax_order_id, external_id, order_status, payment_gateway, customer_email, created_at')
      .in('order_status', ['pending', 'pending_payment', 'processing'])
      .gte('created_at', twentyFourHoursAgo.toISOString())

    if (error) {
      console.error('[RECONCILIATION] Database error:', error)
      throw error
    }

    console.log(`📋 [RECONCILIATION] Found ${pendingOrders?.length || 0} pending orders`)

    const results: ReconciliationResult[] = []
    let processed = 0
    let updated = 0

    // 🔍 Iterar sobre cada pedido pendente
    for (const order of pendingOrders || []) {
      processed++
      
      let newStatus: string | null = null
      const gateway = order.payment_gateway?.toLowerCase() || ''

      // Verificar no Mercado Pago
      if (gateway.includes('mercado') && order.external_id) {
        console.log(`🔍 [RECONCILIATION] Checking MP: ${order.external_id}`)
        newStatus = await checkMercadoPagoStatus(order.external_id)
      }
      // Verificar na Appmax
      else if (gateway.includes('appmax') && order.appmax_order_id) {
        console.log(`🔍 [RECONCILIATION] Checking Appmax: ${order.appmax_order_id}`)
        newStatus = await checkAppmaxStatus(order.appmax_order_id)
      }

      // 🔧 Se houver mudança de status, atualizar
      if (newStatus && newStatus !== order.order_status) {
        console.log(`✅ [RECONCILIATION] Status mismatch found!`)
        console.log(`   Order: ${order.id}`)
        console.log(`   Old: ${order.order_status} → New: ${newStatus}`)

        // Atualizar tabela sales
        const { error: updateError } = await supabaseAdmin
          .from('sales')
          .update({
            order_status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id)

        if (updateError) {
          console.error('[RECONCILIATION] Update error:', updateError)
          continue
        }

        // Registrar log da reconciliação
        await supabaseAdmin
          .from('webhook_logs')
          .insert({
            event_type: 'reconciliation.fix',
            gateway: order.payment_gateway,
            payment_id: order.external_id || order.appmax_order_id,
            raw_body: JSON.stringify({
              old_status: order.order_status,
              new_status: newStatus,
              reconciled_at: new Date().toISOString()
            }),
            processed: true,
            created_at: new Date().toISOString()
          })

        updated++

        // 🚀 CRÍTICO: Se mudou para 'paid', executar provisionamento
        let provisioned = false
        if (newStatus === 'paid') {
          console.log(`🚀 [RECONCILIATION] Executing provisioning for: ${order.id}`)
          provisioned = await executeProvisioning(order.id)
        }

        results.push({
          orderId: order.id,
          oldStatus: order.order_status,
          newStatus,
          gateway: order.payment_gateway || 'unknown',
          fixed: true,
          provisioned
        })
      }
    }

    // 🔄 Invalidar cache se houve atualizações
    if (updated > 0) {
      console.log('🔄 [RECONCILIATION] Revalidating cache...')
      revalidatePath('/admin/dashboard', 'page')
      revalidatePath('/admin/sales', 'page')
      revalidatePath('/admin', 'layout')
    }

    const response = {
      success: true,
      processed,
      updated,
      details: results,
      timestamp: new Date().toISOString()
    }

    console.log('✅ [RECONCILIATION] Process completed:', response)

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('❌ [RECONCILIATION] Fatal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
