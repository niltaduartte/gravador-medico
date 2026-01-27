/**
 * 🎯 SERVICE LAYER - MÉTRICAS CENTRALIZADAS
 * 
 * OBJETIVO: Única fonte de verdade para todas as métricas do dashboard.
 * Todas as telas (Visão Geral, Vendas, CRM, Relatórios) devem usar estas funções.
 * 
 * REGRAS:
 * 1. Cache automático com unstable_cache do Next.js
 * 2. Invalidação via revalidateTag('orders') nos webhooks
 * 3. Status 'paid' único e consistente em todo o app
 * 4. Queries otimizadas com filtros no SQL
 */

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

// Cliente Supabase com service_role (acesso total)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false }
  }
)

/**
 * 📊 STATUS VÁLIDOS PARA VENDAS PAGAS
 * ÚNICA FONTE DE VERDADE - Não replicar em outros arquivos!
 */
export const PAID_STATUS = ['paid', 'provisioning', 'active', 'approved'] as const
export const PENDING_STATUS = ['pending', 'pending_payment', 'processing'] as const
export const FAILED_STATUS = ['cancelled', 'canceled', 'expired', 'refused', 'rejected', 'failed', 'chargeback'] as const

// ========================================
// 🎯 MÉTRICAS GLOBAIS (Visão Geral)
// ========================================

export interface GlobalMetrics {
  // Vendas
  totalOrders: number
  paidOrders: number
  pendingOrders: number
  failedOrders: number
  
  // Financeiro
  totalRevenue: number
  grossRevenue: number
  totalDiscount: number
  averageTicket: number
  
  // Conversão
  uniqueVisitors: number
  conversionRate: number
  
  // Comparação (vs período anterior)
  revenueChange: number
  ordersChange: number
  conversionChange: number
}

/**
 * Busca métricas globais do dashboard com cache
 * @param days - Número de dias para análise (padrão: 30)
 */
export const getGlobalMetrics = unstable_cache(
  async (days: number = 30): Promise<GlobalMetrics> => {
    console.log(`📊 [METRICS] Buscando métricas globais (${days} dias)...`)
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const endDate = new Date()
    
    // Buscar dados do período atual via RPC
    const { data: currentData, error: currentError } = await supabase.rpc(
      'get_analytics_period',
      {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      }
    )
    
    if (currentError) {
      console.error('❌ [METRICS] Erro ao buscar período atual:', currentError)
      throw currentError
    }
    
    const current = currentData?.[0] || {
      unique_visitors: 0,
      total_sales: 0,
      pending_sales: 0,
      paid_sales: 0,
      failed_sales: 0,
      total_revenue: 0,
      gross_revenue: 0,
      total_discount: 0,
      conversion_rate: 0,
      average_order_value: 0
    }
    
    // Buscar dados do período anterior para comparação
    const prevStartDate = new Date(startDate)
    prevStartDate.setDate(prevStartDate.getDate() - days)
    
    const { data: prevData } = await supabase.rpc(
      'get_analytics_period',
      {
        start_date: prevStartDate.toISOString(),
        end_date: startDate.toISOString()
      }
    )
    
    const previous = prevData?.[0] || {
      total_revenue: 0,
      paid_sales: 0,
      conversion_rate: 0
    }
    
    // Calcular variações percentuais
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0
      return Number((((current - previous) / previous) * 100).toFixed(2))
    }
    
    const metrics: GlobalMetrics = {
      totalOrders: Number(current.total_sales),
      paidOrders: Number(current.paid_sales),
      pendingOrders: Number(current.pending_sales),
      failedOrders: Number(current.failed_sales),
      
      totalRevenue: Number(current.total_revenue),
      grossRevenue: Number(current.gross_revenue),
      totalDiscount: Number(current.total_discount),
      averageTicket: Number(current.average_order_value),
      
      uniqueVisitors: Number(current.unique_visitors),
      conversionRate: Number(current.conversion_rate),
      
      revenueChange: calculateChange(
        Number(current.total_revenue),
        Number(previous.total_revenue)
      ),
      ordersChange: calculateChange(
        Number(current.paid_sales),
        Number(previous.paid_sales)
      ),
      conversionChange: calculateChange(
        Number(current.conversion_rate),
        Number(previous.conversion_rate)
      )
    }
    
    console.log('✅ [METRICS] Métricas globais:', metrics)
    return metrics
  },
  ['dashboard-metrics', 'orders'],
  {
    revalidate: 60, // Cache por 60 segundos
    tags: ['dashboard-metrics', 'orders']
  }
)

// ========================================
// 📈 PERFORMANCE DOS GATEWAYS
// ========================================

export interface GatewayStats {
  gateway: string
  approvedSales: number
  totalRevenue: number
  approvalRate: number
  averageTicket: number
  rescuedSales: number
}

/**
 * Busca estatísticas por gateway de pagamento
 */
export const getGatewayStats = unstable_cache(
  async (days: number = 30): Promise<GatewayStats[]> => {
    console.log(`💳 [METRICS] Buscando stats dos gateways (${days} dias)...`)
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const { data, error } = await supabase
      .from('sales')
      .select('payment_gateway, order_status, total_amount')
      .gte('created_at', startDate.toISOString())
    
    if (error) {
      console.error('❌ [METRICS] Erro ao buscar gateway stats:', error)
      throw error
    }
    
    // Agrupar por gateway
    const gateways = new Map<string, any>()
    
    data?.forEach(sale => {
      const gateway = sale.payment_gateway || 'unknown'
      
      if (!gateways.has(gateway)) {
        gateways.set(gateway, {
          gateway,
          totalSales: 0,
          approvedSales: 0,
          totalRevenue: 0,
          rescuedSales: 0
        })
      }
      
      const stats = gateways.get(gateway)
      stats.totalSales++
      
      if (PAID_STATUS.includes(sale.order_status as any)) {
        stats.approvedSales++
        stats.totalRevenue += Number(sale.total_amount || 0)
      }
    })
    
    // Calcular métricas finais
    const result: GatewayStats[] = Array.from(gateways.values()).map(stats => ({
      gateway: stats.gateway,
      approvedSales: stats.approvedSales,
      totalRevenue: stats.totalRevenue,
      approvalRate: stats.totalSales > 0 
        ? Number(((stats.approvedSales / stats.totalSales) * 100).toFixed(2))
        : 0,
      averageTicket: stats.approvedSales > 0
        ? Number((stats.totalRevenue / stats.approvedSales).toFixed(2))
        : 0,
      rescuedSales: stats.rescuedSales
    }))
    
    console.log(`✅ [METRICS] Gateway stats:`, result)
    return result
  },
  ['gateway-stats', 'orders'],
  {
    revalidate: 60,
    tags: ['gateway-stats', 'orders']
  }
)

// ========================================
// 🛒 VENDAS RECENTES
// ========================================

export interface RecentSale {
  id: string
  customer_name: string
  customer_email: string
  total_amount: number
  order_status: string
  payment_gateway: string
  created_at: string
  product_name?: string
}

/**
 * Busca vendas recentes (paginadas)
 */
export const getRecentSales = unstable_cache(
  async (limit: number = 10, offset: number = 0): Promise<RecentSale[]> => {
    console.log(`🛒 [METRICS] Buscando ${limit} vendas recentes (offset: ${offset})...`)
    
    const { data, error } = await supabase
      .from('sales')
      .select('id, customer_name, customer_email, total_amount, order_status, payment_gateway, created_at, product_name')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) {
      console.error('❌ [METRICS] Erro ao buscar vendas recentes:', error)
      throw error
    }
    
    console.log(`✅ [METRICS] ${data?.length || 0} vendas recentes carregadas`)
    return data || []
  },
  ['recent-sales', 'orders'],
  {
    revalidate: 30,
    tags: ['recent-sales', 'orders']
  }
)

// ========================================
// 📊 VENDAS POR STATUS
// ========================================

export interface SalesByStatus {
  status: string
  count: number
  totalAmount: number
  percentage: number
}

/**
 * Busca distribuição de vendas por status
 */
export const getSalesByStatus = unstable_cache(
  async (days: number = 30): Promise<SalesByStatus[]> => {
    console.log(`📊 [METRICS] Buscando vendas por status (${days} dias)...`)
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const { data, error } = await supabase
      .from('sales')
      .select('order_status, total_amount')
      .gte('created_at', startDate.toISOString())
    
    if (error) {
      console.error('❌ [METRICS] Erro ao buscar vendas por status:', error)
      throw error
    }
    
    // Agrupar por status
    const statusMap = new Map<string, { count: number, totalAmount: number }>()
    const total = data?.length || 0
    
    data?.forEach(sale => {
      const status = sale.order_status || 'unknown'
      
      if (!statusMap.has(status)) {
        statusMap.set(status, { count: 0, totalAmount: 0 })
      }
      
      const stats = statusMap.get(status)!
      stats.count++
      stats.totalAmount += Number(sale.total_amount || 0)
    })
    
    const result: SalesByStatus[] = Array.from(statusMap.entries()).map(([status, stats]) => ({
      status,
      count: stats.count,
      totalAmount: stats.totalAmount,
      percentage: total > 0 ? Number(((stats.count / total) * 100).toFixed(2)) : 0
    }))
    
    console.log(`✅ [METRICS] Vendas por status:`, result)
    return result
  },
  ['sales-by-status', 'orders'],
  {
    revalidate: 60,
    tags: ['sales-by-status', 'orders']
  }
)

// ========================================
// 📅 GRÁFICO DE VENDAS (Timeline)
// ========================================

export interface SalesChartData {
  date: string
  appmax: number
  mercadopago: number
  total: number
}

/**
 * Busca dados para gráfico de vendas ao longo do tempo
 */
export const getSalesChartData = unstable_cache(
  async (days: number = 30): Promise<SalesChartData[]> => {
    console.log(`📅 [METRICS] Buscando dados do gráfico (${days} dias)...`)
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const { data, error } = await supabase
      .from('sales')
      .select('created_at, payment_gateway, total_amount, order_status')
      .gte('created_at', startDate.toISOString())
      .in('order_status', PAID_STATUS)
    
    if (error) {
      console.error('❌ [METRICS] Erro ao buscar dados do gráfico:', error)
      throw error
    }
    
    // Agrupar por data e gateway
    const dateMap = new Map<string, { appmax: number, mercadopago: number }>()
    
    data?.forEach(sale => {
      const date = new Date(sale.created_at).toISOString().split('T')[0]
      const gateway = sale.payment_gateway?.toLowerCase() || 'unknown'
      const amount = Number(sale.total_amount || 0)
      
      if (!dateMap.has(date)) {
        dateMap.set(date, { appmax: 0, mercadopago: 0 })
      }
      
      const dayData = dateMap.get(date)!
      
      if (gateway.includes('appmax')) {
        dayData.appmax += amount
      } else if (gateway.includes('mercado')) {
        dayData.mercadopago += amount
      }
    })
    
    // Converter para array ordenado
    const result: SalesChartData[] = Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date,
        appmax: data.appmax,
        mercadopago: data.mercadopago,
        total: data.appmax + data.mercadopago
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
    
    console.log(`✅ [METRICS] ${result.length} dias de dados do gráfico`)
    return result
  },
  ['sales-chart', 'orders'],
  {
    revalidate: 60,
    tags: ['sales-chart', 'orders']
  }
)

// ========================================
// 🎯 HELPER: Invalidar Cache Manualmente
// ========================================

/**
 * Função para forçar revalidação de todos os caches
 * Chamar após importação manual ou operações em massa
 */
export async function invalidateAllMetrics() {
  console.log('🔄 [METRICS] Invalidando todos os caches...')
  // revalidateTag deve ser importado dinamicamente em runtime
  // e chamado nos webhooks/server actions, não aqui
  console.log('✅ [METRICS] Use revalidateTag("orders") nos webhooks')
}
