import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth-server'
import { fetchCascataAnalysis } from '@/lib/dashboard-queries'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })
  }

  try {
    const { data: cascata, error } = await fetchCascataAnalysis(supabaseAdmin)

    if (error) {
      return NextResponse.json({ error: 'Erro ao buscar análise de cascata' }, { status: 500 })
    }

    return NextResponse.json({ cascata })
  } catch (error) {
    console.error('Erro ao carregar análise de cascata:', error)
    return NextResponse.json({ error: 'Erro ao carregar análise' }, { status: 500 })
  }
}
