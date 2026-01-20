'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { BarChart3, Users, TrendingUp, Eye, MousePointerClick } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface AnalyticsData {
  totalVisits: number
  uniqueSessions: number
  conversionRate: number
  totalSales: number
  abandonedCarts: number
  topPages: Array<{ page: string; visits: number }>
  trafficSources: Array<{ source: string; count: number }>
  dailyVisits: Array<{ date: string; visits: number; sales: number }>
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState(7) // últimos 7 dias

  useEffect(() => {
    loadAnalytics()
  }, [dateRange])

  async function loadAnalytics() {
    try {
      setLoading(true)
      const startDate = startOfDay(subDays(new Date(), dateRange))
      const endDate = endOfDay(new Date())

      // 1. Total de visitas e sessões únicas
      const { data: visits, error: visitsError } = await supabase
        .from('analytics_visits')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (visitsError) throw visitsError

      const uniqueSessions = new Set(visits?.map(v => v.session_id) || []).size

      // 2. Total de vendas no período
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .eq('status', 'approved')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (salesError) throw salesError

      // 3. Carrinhos abandonados
      const { data: abandoned, error: abandonedError } = await supabase
        .from('abandoned_carts')
        .select('*')
        .eq('status', 'abandoned')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (abandonedError) throw abandonedError

      // 4. Páginas mais visitadas
      const pageCount = (visits || []).reduce((acc, visit) => {
        const page = visit.page_path || '/'
        acc[page] = (acc[page] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const topPages = Object.entries(pageCount)
        .map(([page, visits]) => ({ page, visits: visits as number }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 5)

      // 5. Fontes de tráfego
      const sourceCount = (visits || []).reduce((acc, visit) => {
        const source = visit.utm_source || visit.referrer || 'direto'
        acc[source] = (acc[source] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const trafficSources = Object.entries(sourceCount)
        .map(([source, count]) => ({ source, count: count as number }))
        .sort((a, b) => b.count - a.count)

      // 6. Visitas e vendas por dia
      const dailyData: Record<string, { visits: number; sales: number }> = {}

      for (let i = 0; i < dateRange; i++) {
        const date = format(subDays(new Date(), dateRange - i - 1), 'dd/MM')
        dailyData[date] = { visits: 0, sales: 0 }
      }

      visits?.forEach(visit => {
        const date = format(new Date(visit.created_at), 'dd/MM')
        if (dailyData[date]) {
          dailyData[date].visits++
        }
      })

      sales?.forEach(sale => {
        const date = format(new Date(sale.created_at), 'dd/MM')
        if (dailyData[date]) {
          dailyData[date].sales++
        }
      })

      const dailyVisits = Object.entries(dailyData).map(([date, data]) => ({
        date,
        visits: data.visits,
        sales: data.sales
      }))

      setData({
        totalVisits: visits?.length || 0,
        uniqueSessions,
        conversionRate: visits?.length ? ((sales?.length || 0) / visits.length) * 100 : 0,
        totalSales: sales?.length || 0,
        abandonedCarts: abandoned?.length || 0,
        topPages,
        trafficSources,
        dailyVisits
      })
    } catch (error) {
      console.error('Erro ao carregar analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">Visão geral do desempenho do site</p>
        </div>
        
        <select
          value={dateRange}
          onChange={(e) => setDateRange(Number(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={14}>Últimos 14 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      {/* Cards de métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-violet-100 rounded-lg">
              <Eye className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total de Visitas</p>
              <p className="text-2xl font-bold text-gray-900">{data?.totalVisits || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Sessões Únicas</p>
              <p className="text-2xl font-bold text-gray-900">{data?.uniqueSessions || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Taxa de Conversão</p>
              <p className="text-2xl font-bold text-gray-900">
                {data?.conversionRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <MousePointerClick className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Vendas</p>
              <p className="text-2xl font-bold text-gray-900">{data?.totalSales || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Gráfico de visitas e vendas por dia */}
      <Card className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Visitas e Vendas ao Longo do Tempo
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data?.dailyVisits || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="visits" stroke="#8b5cf6" name="Visitas" strokeWidth={2} />
            <Line type="monotone" dataKey="sales" stroke="#10b981" name="Vendas" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Páginas mais visitadas */}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Páginas Mais Visitadas</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.topPages || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="page" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="visits" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Fontes de tráfego */}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Fontes de Tráfego</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data?.trafficSources || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.source}: ${(entry.percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {data?.trafficSources.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Card de carrinhos abandonados */}
      <Card className="p-6 bg-red-50 border-red-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-red-900">⚠️ Carrinhos Abandonados</h3>
            <p className="text-red-700 mt-1">
              {data?.abandonedCarts || 0} carrinhos foram abandonados neste período
            </p>
          </div>
          <a
            href="/dashboard/abandoned-carts"
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Ver Carrinhos
          </a>
        </div>
      </Card>
    </div>
  )
}
