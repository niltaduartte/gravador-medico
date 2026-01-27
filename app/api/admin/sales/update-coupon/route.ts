import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth-server'

export const runtime = 'nodejs'

/**
 * PATCH /api/admin/sales/update-coupon
 * Atualiza o cupom de uma venda pelo email do cliente
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })
  }

  try {
    const body = await request.json()
    const { email, coupon_code, sale_id } = body

    if (!coupon_code) {
      return NextResponse.json({ error: 'coupon_code é obrigatório' }, { status: 400 })
    }

    if (!email && !sale_id) {
      return NextResponse.json({ error: 'email ou sale_id é obrigatório' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('sales')
      .update({ coupon_code })

    if (sale_id) {
      query = query.eq('id', sale_id)
    } else {
      query = query.eq('customer_email', email)
    }

    const { data, error } = await query.select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
      sales: data
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/admin/sales/update-coupon
 * Atualiza múltiplos cupons de uma vez
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })
  }

  try {
    const body = await request.json()
    const { updates } = body // Array de { email, coupon_code }

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'updates deve ser um array' }, { status: 400 })
    }

    const results = []

    for (const update of updates) {
      const { email, coupon_code } = update
      
      if (!email || !coupon_code) continue

      const { data, error } = await supabaseAdmin
        .from('sales')
        .update({ coupon_code })
        .eq('customer_email', email)
        .select('id, customer_name, customer_email, coupon_code')

      if (error) {
        results.push({ email, error: error.message })
      } else {
        results.push({ email, coupon_code, updated: data?.length || 0 })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
