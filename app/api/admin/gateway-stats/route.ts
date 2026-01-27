import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth-server'
import { fetchGatewayStats } from '@/lib/dashboard-queries'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start') || undefined
    const end = searchParams.get('end') || undefined
    const daysParam = Number.parseInt(searchParams.get('days') || '', 10)
    const days = Number.isFinite(daysParam) ? daysParam : undefined

    const rangeOptions = {
      start,
      end,
      days
    }

    const { data: stats, error } = await fetchGatewayStats(supabaseAdmin, rangeOptions)

    if (error) {
      return NextResponse.json({ error: 'Erro ao buscar estatísticas de gateway' }, { status: 500 })
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Erro ao carregar gateway stats:', error)
    return NextResponse.json({ error: 'Erro ao carregar estatísticas' }, { status: 500 })
  }
}
