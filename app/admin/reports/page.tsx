"use client"

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  Filter,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface ReportData {
  totalRevenue: number
  totalOrders: number
  totalCustomers: number
  averageTicket: number
  conversionRate: number
  topProducts: Array<{ name: string; revenue: number; quantity: number }>
  dailyRevenue: Array<{ date: string; revenue: number; orders: number }>
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30) // dias
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [filterType, setFilterType] = useState<'quick' | 'custom'>('quick')

  // Função para definir período rápido
  const setQuickPeriod = (days: number) => {
    setFilterType('quick')
    setPeriod(days)
    const end = new Date()
    const start = days === 0 ? startOfDay(end) : subDays(end, days) // 0 = hoje
    setStartDate(format(start, 'yyyy-MM-dd'))
    setEndDate(format(end, 'yyyy-MM-dd'))
  }

  useEffect(() => {
    // Inicializar com últimos 30 dias
    setQuickPeriod(30)
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      generateReport()
    }
  }, [startDate, endDate])

  const generateReport = async () => {
    try {
      setLoading(true)

      const start = startOfDay(new Date(startDate))
      const end = endOfDay(new Date(endDate))

      console.log('🔍 Gerando relatório:', { 
        start: start.toISOString(), 
        end: end.toISOString(),
        startDate,
        endDate 
      })

      // Buscar vendas do período (SEM sales_items por enquanto)
      const { data: sales, error } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true })

      if (error) {
        console.error('❌ Erro ao buscar vendas:', error)
        setLoading(false)
        return
      }

      console.log('✅ Total de vendas no período:', sales?.length || 0)
      console.log('📦 Exemplo de venda:', sales?.[0])
      console.log('📦 Status das vendas:', sales?.map(s => s.status))

      // Filtrar apenas aprovadas (paid já é mapeado para approved no webhook)
      const approvedSales = sales?.filter((s) => 
        s.status === 'approved'
      ) || []

      console.log('✅ Vendas aprovadas:', approvedSales.length)

      // Calcular métricas
      const totalRevenue = approvedSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0)
      const totalOrders = approvedSales.length
      const uniqueEmails = new Set(approvedSales.map((s) => s.customer_email).filter(Boolean))
      const totalCustomers = uniqueEmails.size
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0
      const conversionRate = sales && sales.length > 0 ? (totalOrders / sales.length) * 100 : 0

      console.log('💰 Métricas calculadas:', {
        totalRevenue,
        totalOrders,
        totalCustomers,
        averageTicket,
        conversionRate
      })

      // Top produtos (simplificado - sem sales_items por enquanto)
      const topProducts = [
        { 
          name: 'Método Gravador Médico', 
          revenue: totalRevenue, 
          quantity: totalOrders 
        }
      ]

      // Receita diária
      const dailyMap = new Map<string, { revenue: number; orders: number }>()

      approvedSales.forEach((sale) => {
        const date = format(new Date(sale.created_at), 'dd/MM')
        const existing = dailyMap.get(date)

        if (existing) {
          existing.revenue += Number(sale.total_amount || 0)
          existing.orders += 1
        } else {
          dailyMap.set(date, {
            revenue: Number(sale.total_amount),
            orders: 1,
          })
        }
      })

      const dailyRevenue = Array.from(dailyMap.entries()).map(([date, stats]) => ({
        date,
        ...stats,
      }))

      setData({
        totalRevenue,
        totalOrders,
        totalCustomers,
        averageTicket,
        conversionRate,
        topProducts,
        dailyRevenue,
      })
    } catch (error) {
      console.error('Erro ao gerar relatório:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportReport = () => {
    if (!data) return

    const reportText = `
RELATÓRIO DE VENDAS
Período: ${format(new Date(startDate), 'dd/MM/yyyy')} - ${format(new Date(endDate), 'dd/MM/yyyy')}
Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}

============================================
RESUMO EXECUTIVO
============================================

Faturamento Total: R$ ${data.totalRevenue.toFixed(2)}
Total de Pedidos: ${data.totalOrders}
Clientes Únicos: ${data.totalCustomers}
Ticket Médio: R$ ${data.averageTicket.toFixed(2)}
Taxa de Conversão: ${data.conversionRate.toFixed(2)}%

============================================
TOP 5 PRODUTOS
============================================

${data.topProducts
  .map(
    (p, i) =>
      `${i + 1}. ${p.name}
   Receita: R$ ${p.revenue.toFixed(2)}
   Unidades: ${p.quantity}`
  )
  .join('\n\n')}

============================================
RECEITA DIÁRIA
============================================

${data.dailyRevenue
  .map((d) => `${d.date}: R$ ${d.revenue.toFixed(2)} (${d.orders} pedidos)`)
  .join('\n')}

---
Relatório gerado automaticamente pelo Gravador Médico
    `.trim()

    const blob = new Blob([reportText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-vendas-${format(new Date(), 'dd-MM-yyyy')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 font-medium">Gerando relatório...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Nenhum dado disponível</h3>
          <p className="text-gray-400">Ajuste o período ou aguarde vendas</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Relatórios</h1>
          <p className="text-gray-400 mt-1">Análises detalhadas de vendas</p>
        </div>
        <button
          onClick={exportReport}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl hover:shadow-lg hover:shadow-brand-500/30 transition-all"
        >
          <Download className="w-4 h-4" />
          Exportar Relatório
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-700/50">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-400 mb-2">Período Rápido</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setQuickPeriod(0)}
                className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                  period === 0 && filterType === 'quick'
                    ? 'bg-brand-500 text-white shadow-lg'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Hoje
              </button>
              {[7, 14, 30, 60, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setQuickPeriod(days)}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                    period === days && filterType === 'quick'
                      ? 'bg-brand-500 text-white shadow-lg'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {days} dias
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Personalizado - Início</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setFilterType('custom')
                  setStartDate(e.target.value)
                }}
                className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Personalizado - Fim</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setFilterType('custom')
                  setEndDate(e.target.value)
                }}
                className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-700/50"
        >
          <DollarSign className="w-8 h-8 text-green-400 mb-3" />
          <h3 className="text-gray-400 text-sm font-semibold mb-1">Faturamento</h3>
          <p className="text-2xl font-black text-white">
            R$ {data.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-700/50"
        >
          <ShoppingCart className="w-8 h-8 text-blue-400 mb-3" />
          <h3 className="text-gray-400 text-sm font-semibold mb-1">Pedidos</h3>
          <p className="text-2xl font-black text-white">{data.totalOrders}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-700/50"
        >
          <Users className="w-8 h-8 text-purple-400 mb-3" />
          <h3 className="text-gray-400 text-sm font-semibold mb-1">Clientes</h3>
          <p className="text-2xl font-black text-white">{data.totalCustomers}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-700/50"
        >
          <TrendingUp className="w-8 h-8 text-orange-400 mb-3" />
          <h3 className="text-gray-400 text-sm font-semibold mb-1">Ticket Médio</h3>
          <p className="text-2xl font-black text-white">
            R$ {data.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-700/50"
        >
          <TrendingUp className="w-8 h-8 text-green-400 mb-3" />
          <h3 className="text-gray-400 text-sm font-semibold mb-1">Conversão</h3>
          <p className="text-2xl font-black text-white">{data.conversionRate.toFixed(1)}%</p>
        </motion.div>
      </div>

      {/* Gráfico de Receita Diária */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-6">Evolução de Receita e Pedidos</h3>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={data.dailyRevenue}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '12px',
                color: '#fff',
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#10b981"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorRevenue)"
              name="Receita (R$)"
            />
            <Area
              type="monotone"
              dataKey="orders"
              stroke="#3b82f6"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorOrders)"
              name="Pedidos"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top Produtos */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-6">Top 5 Produtos</h3>
        <div className="space-y-4">
          {data.topProducts.map((product, index) => (
            <div key={product.name} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white">{product.name}</div>
                <div className="text-sm text-gray-400">{product.quantity} unidades vendidas</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-green-400">
                  R$ {product.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-gray-400">
                  {((product.revenue / data.totalRevenue) * 100).toFixed(1)}% do total
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
