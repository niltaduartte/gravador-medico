"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Image from 'next/image'
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Download,
  Filter,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Target,
} from "lucide-react"
import { supabase } from "@/lib/supabase"

interface PaymentStats {
  // Geral
  total_sales: number
  total_revenue: number
  conversion_rate: number
  
  // Mercado Pago
  mp_sales: number
  mp_revenue: number
  mp_success_rate: number
  mp_avg_ticket: number
  
  // AppMax
  appmax_sales: number
  appmax_revenue: number
  appmax_success_rate: number
  appmax_avg_ticket: number
  
  // Cascata
  fallback_sales: number
  fallback_rate: number
  rescued_revenue: number
  rescue_rate: number
}

interface PaymentAttempt {
  id: number
  sale_id: number
  gateway: string
  status: string
  error_code: string | null
  error_message: string | null
  created_at: string
  sale?: {
    customer_name: string
    customer_email: string
    amount: number
    order_status: string
    fallback_used: boolean
  }
}

export default function PaymentsAdminPage() {
  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [attempts, setAttempts] = useState<PaymentAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "mercadopago" | "appmax" | "cascata">("overview")
  const [dateFilter, setDateFilter] = useState("7d") // 24h, 7d, 30d, all

  useEffect(() => {
    loadData()
  }, [dateFilter])

  const loadData = async () => {
    try {
      setLoading(true)

      // Calcula data de início baseado no filtro
      const now = new Date()
      let startDate = new Date()
      
      switch (dateFilter) {
        case "24h":
          startDate.setHours(now.getHours() - 24)
          break
        case "7d":
          startDate.setDate(now.getDate() - 7)
          break
        case "30d":
          startDate.setDate(now.getDate() - 30)
          break
        case "all":
          startDate = new Date(0) // Desde sempre
          break
      }

      // Busca estatísticas agregadas diretamente de sales (fonte principal)
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', startDate.toISOString())

      if (salesError) throw salesError

      // Busca tentativas de pagamento (sem join que pode falhar)
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('payment_attempts')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(50)

      // Ignora erro de attempts, não é crítico
      if (attemptsError) {
        console.warn('Aviso: Não foi possível carregar payment_attempts:', attemptsError.message)
      }

      // Calcula estatísticas usando total_amount (ou amount como fallback)
      const total_sales = salesData?.length || 0
      const paid_sales = salesData?.filter(s => s.order_status === 'paid' || s.order_status === 'provisioning' || s.order_status === 'active' || s.order_status === 'approved') || []
      const total_revenue = paid_sales.reduce((sum, s) => sum + (s.total_amount || s.amount || 0), 0)
      
      const mp_sales = paid_sales.filter(s => s.payment_gateway === 'mercadopago' && !s.fallback_used)
      const appmax_sales = paid_sales.filter(s => s.payment_gateway === 'appmax')
      const fallback_sales = paid_sales.filter(s => s.fallback_used)

      const calculatedStats: PaymentStats = {
        total_sales: paid_sales.length,
        total_revenue,
        conversion_rate: total_sales > 0 ? (paid_sales.length / total_sales) * 100 : 0,
        
        mp_sales: mp_sales.length,
        mp_revenue: mp_sales.reduce((sum, s) => sum + (s.total_amount || s.amount || 0), 0),
        mp_success_rate: total_sales > 0 ? (mp_sales.length / total_sales) * 100 : 0,
        mp_avg_ticket: mp_sales.length > 0 ? mp_sales.reduce((sum, s) => sum + (s.total_amount || s.amount || 0), 0) / mp_sales.length : 0,
        
        appmax_sales: appmax_sales.length,
        appmax_revenue: appmax_sales.reduce((sum, s) => sum + (s.total_amount || s.amount || 0), 0),
        appmax_success_rate: total_sales > 0 ? (appmax_sales.length / total_sales) * 100 : 0,
        appmax_avg_ticket: appmax_sales.length > 0 ? appmax_sales.reduce((sum, s) => sum + (s.total_amount || s.amount || 0), 0) / appmax_sales.length : 0,
        
        fallback_sales: fallback_sales.length,
        fallback_rate: paid_sales.length > 0 ? (fallback_sales.length / paid_sales.length) * 100 : 0,
        rescued_revenue: fallback_sales.reduce((sum, s) => sum + (s.total_amount || s.amount || 0), 0),
        rescue_rate: mp_sales.length > 0 ? (fallback_sales.length / mp_sales.length) * 100 : 0,
      }

      // Formata attempts com dados de sales (se disponível)
      const formattedAttempts = (attemptsData || []).map(attempt => {
        // Tenta encontrar a venda correspondente pelo order_id
        const relatedSale = salesData?.find(s => s.id === attempt.order_id || s.appmax_order_id === attempt.order_id)
        return {
          ...attempt,
          gateway: attempt.provider,
          sale: relatedSale ? {
            customer_name: relatedSale.customer_name,
            customer_email: relatedSale.customer_email,
            amount: relatedSale.total_amount || relatedSale.amount,
            order_status: relatedSale.order_status,
            fallback_used: relatedSale.fallback_used
          } : undefined
        }
      })

      setStats(calculatedStats)
      setAttempts(formattedAttempts)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'paid':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />
      case 'failed':
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <Activity className="w-5 h-5 text-gray-500" />
    }
  }

  const getGatewayBadge = (gateway: string, fallback: boolean) => {
    if (gateway === 'mercadopago' && !fallback) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex items-center gap-1">
          <Image 
            src="/logo-mercadopago-blanco.png" 
            alt="Mercado Pago" 
            width={60} 
            height={24}
            className="object-contain"
          />
        </span>
      )
    } else if (gateway === 'appmax' || fallback) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 flex items-center gap-1">
          <Image 
            src="/appmax-logo.png" 
            alt="Appmax" 
            width={48} 
            height={20}
            className="object-contain"
          />
          {fallback && '(Resgate)'}
        </span>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-black text-white mb-2">
                💳 Gateway de Pagamentos
              </h1>
              <p className="text-gray-400">
                Análise completa da cascata Mercado Pago → AppMax
              </p>
            </div>
            
            {/* Filtro de Data */}
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white text-sm font-medium focus:ring-2 focus:ring-brand-500"
              >
                <option value="24h">Últimas 24h</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="all">Todo período</option>
              </select>
              <button
                onClick={loadData}
                className="p-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {[
              { id: "overview", label: "Visão Geral", icon: Activity },
              { id: "mercadopago", label: "Mercado Pago", icon: CreditCard },
              { id: "appmax", label: "AppMax", icon: Zap },
              { id: "cascata", label: "Análise Cascata", icon: Target },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "bg-brand-600 text-white shadow-lg"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Visão Geral */}
        {activeTab === "overview" && stats && (
          <div className="space-y-6">
            {/* Cards de Métricas Gerais */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl p-6 shadow-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm font-medium">Total de Vendas</span>
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-3xl font-black text-gray-900">{stats.total_sales}</div>
                <div className="text-sm text-green-600 flex items-center gap-1 mt-1">
                  <ArrowUpRight className="w-4 h-4" />
                  {stats.conversion_rate.toFixed(1)}% conversão
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-xl p-6 shadow-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm font-medium">Receita Total</span>
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-3xl font-black text-gray-900">
                  {formatCurrency(stats.total_revenue)}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Ticket: {formatCurrency(stats.total_sales > 0 ? stats.total_revenue / stats.total_sales : 0)}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 shadow-lg text-white"
              >
                <div className="flex items-center justify-between mb-2">
                  <Image 
                    src="/logo-mercadopago-blanco.png" 
                    alt="Mercado Pago" 
                    width={120} 
                    height={48}
                    className="object-contain brightness-0 invert"
                  />
                </div>
                <div className="text-3xl font-black">{stats.mp_sales}</div>
                <div className="text-sm text-blue-100 mt-1">
                  {formatCurrency(stats.mp_revenue)}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 shadow-lg text-white"
              >
                <div className="flex items-center justify-between mb-2">
                  <Image 
                    src="/appmax-logo.png" 
                    alt="Appmax" 
                    width={120} 
                    height={48}
                    className="object-contain brightness-0 invert"
                  />
                </div>
                <div className="text-3xl font-black">{stats.appmax_sales}</div>
                <div className="text-sm text-purple-100 mt-1">
                  {formatCurrency(stats.appmax_revenue)}
                </div>
              </motion.div>
            </div>

            {/* Tabela de Tentativas Recentes */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Tentativas Recentes
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Gateway</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Cliente</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Valor</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Data</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((attempt) => (
                      <tr key={attempt.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(attempt.status)}
                            <span className="text-sm capitalize">{attempt.status}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {getGatewayBadge(attempt.gateway, attempt.sale?.fallback_used || false)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{attempt.sale?.customer_name}</div>
                            <div className="text-gray-500">{attempt.sale?.customer_email}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-semibold text-gray-900">
                            {formatCurrency(attempt.sale?.amount || 0)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-600">
                            {new Date(attempt.created_at).toLocaleString('pt-BR')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {attempt.error_message && (
                            <span className="text-xs text-red-600 max-w-xs truncate block">
                              {attempt.error_message}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab Mercado Pago */}
        {activeTab === "mercadopago" && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 shadow-lg text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-100 text-sm font-medium">Vendas Diretas</span>
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div className="text-4xl font-black mb-1">{stats.mp_sales}</div>
                <div className="text-sm text-blue-100">
                  Taxa de sucesso: {stats.mp_success_rate.toFixed(1)}%
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm font-medium">Receita MP</span>
                  <DollarSign className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-3xl font-black text-gray-900">
                  {formatCurrency(stats.mp_revenue)}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {((stats.mp_revenue / stats.total_revenue) * 100).toFixed(1)}% do total
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm font-medium">Ticket Médio</span>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-3xl font-black text-gray-900">
                  {formatCurrency(stats.mp_avg_ticket)}
                </div>
                <div className="text-sm text-green-600 mt-1">
                  Gateway principal
                </div>
              </div>
            </div>

            {/* Lista de transações MP */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Transações Mercado Pago</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Cliente</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Valor</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts
                      .filter(a => a.gateway === 'mercadopago' && !a.sale?.fallback_used)
                      .map((attempt) => (
                        <tr key={attempt.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(attempt.status)}
                              <span className="text-sm capitalize">{attempt.status}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">{attempt.sale?.customer_name}</div>
                              <div className="text-gray-500">{attempt.sale?.customer_email}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm font-semibold text-gray-900">
                              {formatCurrency(attempt.sale?.amount || 0)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-600">
                              {new Date(attempt.created_at).toLocaleString('pt-BR')}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab AppMax */}
        {activeTab === "appmax" && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 shadow-lg text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-100 text-sm font-medium">Vendas AppMax</span>
                  <Zap className="w-5 h-5" />
                </div>
                <div className="text-4xl font-black mb-1">{stats.appmax_sales}</div>
                <div className="text-sm text-purple-100">
                  {stats.fallback_sales} via resgate ({stats.fallback_rate.toFixed(1)}%)
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm font-medium">Receita AppMax</span>
                  <DollarSign className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-3xl font-black text-gray-900">
                  {formatCurrency(stats.appmax_revenue)}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {((stats.appmax_revenue / stats.total_revenue) * 100).toFixed(1)}% do total
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm font-medium">Ticket Médio</span>
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-3xl font-black text-gray-900">
                  {formatCurrency(stats.appmax_avg_ticket)}
                </div>
                <div className="text-sm text-purple-600 mt-1">
                  Gateway de backup
                </div>
              </div>
            </div>

            {/* Lista de transações AppMax */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Transações AppMax</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Tipo</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Cliente</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Valor</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts
                      .filter(a => a.gateway === 'appmax' || a.sale?.fallback_used)
                      .map((attempt) => (
                        <tr key={attempt.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(attempt.status)}
                              <span className="text-sm capitalize">{attempt.status}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {attempt.sale?.fallback_used ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Resgate
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Direto
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">{attempt.sale?.customer_name}</div>
                              <div className="text-gray-500">{attempt.sale?.customer_email}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm font-semibold text-gray-900">
                              {formatCurrency(attempt.sale?.amount || 0)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-600">
                              {new Date(attempt.created_at).toLocaleString('pt-BR')}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab Análise de Cascata */}
        {activeTab === "cascata" && stats && (
          <div className="space-y-6">
            {/* Métricas de Resgate */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 shadow-lg text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-100 text-sm font-medium">Vendas Resgatadas</span>
                  <Target className="w-5 h-5" />
                </div>
                <div className="text-4xl font-black mb-1">{stats.fallback_sales}</div>
                <div className="text-sm text-green-100">
                  {stats.fallback_rate.toFixed(1)}% das vendas pagas
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm font-medium">Receita Resgatada</span>
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-3xl font-black text-gray-900">
                  {formatCurrency(stats.rescued_revenue)}
                </div>
                <div className="text-sm text-green-600 mt-1">
                  💰 Lucro adicional
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm font-medium">Taxa de Resgate</span>
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-3xl font-black text-gray-900">
                  {stats.rescue_rate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Das tentativas MP
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm font-medium">Conversão Total</span>
                  <Activity className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-3xl font-black text-gray-900">
                  {stats.conversion_rate.toFixed(1)}%
                </div>
                <div className="text-sm text-purple-600 mt-1">
                  Com cascata ativa
                </div>
              </div>
            </div>

            {/* Análise Visual */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Fluxo da Cascata</h2>
              
              <div className="space-y-4">
                {/* Mercado Pago */}
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-32 text-right">
                    <span className="text-sm font-semibold text-gray-700">Mercado Pago</span>
                  </div>
                  <div className="flex-1">
                    <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm"
                        style={{ width: `${stats.mp_success_rate}%` }}
                      >
                        {stats.mp_sales} vendas ({stats.mp_success_rate.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-32">
                    <span className="text-sm font-bold text-blue-600">
                      {formatCurrency(stats.mp_revenue)}
                    </span>
                  </div>
                </div>

                {/* Resgate AppMax */}
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-32 text-right">
                    <span className="text-sm font-semibold text-gray-700">Resgate AppMax</span>
                  </div>
                  <div className="flex-1">
                    <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm"
                        style={{ width: `${stats.fallback_rate}%` }}
                      >
                        {stats.fallback_sales} vendas ({stats.fallback_rate.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-32">
                    <span className="text-sm font-bold text-purple-600">
                      {formatCurrency(stats.rescued_revenue)}
                    </span>
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-center gap-4 pt-4 border-t-2 border-gray-200">
                  <div className="flex-shrink-0 w-32 text-right">
                    <span className="text-sm font-bold text-gray-900">TOTAL PAGO</span>
                  </div>
                  <div className="flex-1">
                    <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-sm"
                        style={{ width: '100%' }}
                      >
                        {stats.total_sales} vendas (100%)
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-32">
                    <span className="text-sm font-bold text-green-600">
                      {formatCurrency(stats.total_revenue)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Insights */}
              <div className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">💡 Insights da Cascata</h3>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>
                        • <strong>{stats.fallback_sales} vendas</strong> seriam perdidas sem o AppMax (
                        {formatCurrency(stats.rescued_revenue)} em receita)
                      </li>
                      <li>
                        • Taxa de resgate de <strong>{stats.rescue_rate.toFixed(1)}%</strong> mostra que {stats.rescue_rate > 10 ? 'muitas' : 'algumas'} transações MP são rejeitadas
                      </li>
                      <li>
                        • {stats.mp_success_rate > 80 
                          ? '✅ Mercado Pago está performando muito bem como gateway principal'
                          : '⚠️ Considere revisar configurações do Mercado Pago'}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
