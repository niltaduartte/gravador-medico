/**
 * 🔄 API DE SYNC PAGINADA - APPMAX
 * 
 * OBJETIVO: Importar histórico completo da Appmax usando paginação
 * controlada pelo frontend (evita timeout da Vercel)
 * 
 * ROTA: GET /api/sync/appmax?page=1&limit=50
 * 
 * RETORNO: { processed: number, has_more: boolean, next_page: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const APPMAX_TOKEN = process.env.APPMAX_TOKEN

interface AppmaxOrder {
  id: number
  customer: {
    email: string
    name: string
    phone?: string
  }
  product: {
    name: string
  }
  status: string
  amount: number
  payment_method: string
  created_at: string
  updated_at: string
}

/**
 * Mapeia status da Appmax para nosso sistema
 */
function mapAppmaxStatus(statusText: string): string {
  const status = statusText.toLowerCase()
  
  if (status.includes('aprovado') || status.includes('pago') || status.includes('integrado')) {
    return 'paid'
  } else if (status.includes('pendente')) {
    return 'pending'
  } else if (status.includes('cancelado') || status.includes('recusado') || status.includes('expirado')) {
    return 'cancelled'
  } else if (status.includes('estornado') || status.includes('chargeback')) {
    return 'refunded'
  }
  
  return 'pending'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    console.log(`📡 [SYNC APPMAX] Fetching orders: page=${page}, limit=${limit}`)

    if (!APPMAX_TOKEN) {
      throw new Error('APPMAX_TOKEN não configurado')
    }

    // 📊 Buscar pedidos da Appmax
    const url = new URL('https://admin.appmax.com.br/api/v3/order')
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String((page - 1) * limit))

    const response = await fetch(url.toString(), {
      headers: {
        'access-token': APPMAX_TOKEN,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Appmax API error: ${response.status}`)
    }

    const data = await response.json()
    
    // A API da Appmax retorna data.data que pode ser array ou número
    let orders: AppmaxOrder[] = []
    
    if (Array.isArray(data.data)) {
      orders = data.data
    } else if (data.data && typeof data.data === 'object' && data.data.orders) {
      orders = data.data.orders
    }

    console.log(`✅ [SYNC APPMAX] Fetched ${orders.length} orders`)

    // 💾 Fazer UPSERT no banco
    let processed = 0
    let created = 0
    let updated = 0
    let errors = 0

    for (const order of orders) {
      try {
        const saleData = {
          appmax_order_id: String(order.id),
          payment_gateway: 'appmax',
          order_status: mapAppmaxStatus(order.status),
          total_amount: order.amount,
          customer_email: order.customer.email,
          customer_name: order.customer.name,
          customer_phone: order.customer.phone,
          product_name: order.product.name,
          payment_method: order.payment_method,
          created_at: order.created_at,
          updated_at: new Date().toISOString()
        }

        // UPSERT usando appmax_order_id como chave única
        const { data: existingSale } = await supabaseAdmin
          .from('sales')
          .select('id')
          .eq('appmax_order_id', String(order.id))
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
        console.error(`❌ [SYNC APPMAX] Error processing order ${order.id}:`, error.message)
        errors++
      }
    }

    // 🔢 Calcular se há mais páginas
    // Se recebemos menos que o limit, não há mais páginas
    const hasMore = orders.length === limit
    const nextPage = hasMore ? page + 1 : page

    const result = {
      success: true,
      processed,
      created,
      updated,
      errors,
      has_more: hasMore,
      next_page: nextPage,
      current_page: page,
      current_batch: orders.length
    }

    console.log('✅ [SYNC APPMAX] Batch completed:', result)

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('❌ [SYNC APPMAX] Fatal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        processed: 0,
        has_more: false,
        next_page: 1
      },
      { status: 500 }
    )
  }
}
