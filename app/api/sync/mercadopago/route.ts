/**
 * 🔄 API DE SYNC PAGINADA - MERCADO PAGO
 * 
 * OBJETIVO: Importar histórico completo do Mercado Pago usando paginação
 * controlada pelo frontend (evita timeout da Vercel)
 * 
 * ROTA: GET /api/sync/mercadopago?offset=0&limit=50
 * 
 * RETORNO: { processed: number, has_more: boolean, next_offset: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const MERCADOPAGO_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN

interface MercadoPagoPayment {
  id: number
  status: string
  status_detail: string
  transaction_amount: number
  date_created: string
  date_approved?: string
  payer: {
    email: string
    first_name?: string
    last_name?: string
  }
  additional_info?: {
    items?: Array<{ title?: string }>
  }
  payment_method_id: string
}

/**
 * Mapeia status do Mercado Pago para nosso sistema
 */
function mapMercadoPagoStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'approved': 'paid',
    'authorized': 'paid',
    'pending': 'pending',
    'in_process': 'pending',
    'in_mediation': 'pending',
    'rejected': 'cancelled',
    'cancelled': 'cancelled',
    'refunded': 'refunded',
    'charged_back': 'chargeback'
  }
  return statusMap[status] || 'pending'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const offset = parseInt(searchParams.get('offset') || '0')
    const limit = parseInt(searchParams.get('limit') || '50')

    console.log(`📡 [SYNC MP] Fetching payments: offset=${offset}, limit=${limit}`)

    if (!MERCADOPAGO_TOKEN) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado')
    }

    // 📊 Buscar pagamentos do Mercado Pago (últimos 90 dias)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)

    const url = new URL('https://api.mercadopago.com/v1/payments/search')
    url.searchParams.set('sort', 'date_created')
    url.searchParams.set('criteria', 'desc')
    url.searchParams.set('range', 'date_created')
    url.searchParams.set('begin_date', startDate.toISOString())
    url.searchParams.set('end_date', new Date().toISOString())
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${MERCADOPAGO_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Mercado Pago API error: ${response.status}`)
    }

    const data = await response.json()
    const payments: MercadoPagoPayment[] = data.results || []
    const totalResults = data.paging?.total || 0

    console.log(`✅ [SYNC MP] Fetched ${payments.length} payments (Total: ${totalResults})`)

    // 💾 Fazer UPSERT no banco (atualiza se existe, cria se não existe)
    let processed = 0
    let created = 0
    let updated = 0
    let errors = 0

    for (const payment of payments) {
      try {
        const saleData = {
          external_id: String(payment.id),
          payment_gateway: 'mercadopago',
          order_status: mapMercadoPagoStatus(payment.status),
          total_amount: payment.transaction_amount,
          customer_email: payment.payer.email,
          customer_name: `${payment.payer.first_name || ''} ${payment.payer.last_name || ''}`.trim() || payment.payer.email,
          product_name: payment.additional_info?.items?.[0]?.title || 'Produto',
          payment_method: payment.payment_method_id,
          created_at: payment.date_created,
          updated_at: new Date().toISOString()
        }

        // UPSERT usando external_id como chave única
        const { data: existingSale } = await supabaseAdmin
          .from('sales')
          .select('id')
          .eq('external_id', String(payment.id))
          .single()

        if (existingSale) {
          // Atualizar
          const { error } = await supabaseAdmin
            .from('sales')
            .update(saleData)
            .eq('id', existingSale.id)

          if (error) throw error
          updated++
        } else {
          // Criar
          const { error } = await supabaseAdmin
            .from('sales')
            .insert(saleData)

          if (error) throw error
          created++
        }

        processed++
      } catch (error: any) {
        console.error(`❌ [SYNC MP] Error processing payment ${payment.id}:`, error.message)
        errors++
      }
    }

    // 🔢 Calcular se há mais páginas
    const hasMore = (offset + limit) < totalResults
    const nextOffset = hasMore ? offset + limit : offset

    const result = {
      success: true,
      processed,
      created,
      updated,
      errors,
      has_more: hasMore,
      next_offset: nextOffset,
      total: totalResults,
      current_batch: payments.length
    }

    console.log('✅ [SYNC MP] Batch completed:', result)

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('❌ [SYNC MP] Fatal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        processed: 0,
        has_more: false,
        next_offset: 0
      },
      { status: 500 }
    )
  }
}
