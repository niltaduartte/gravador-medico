'use client'

import { useState, useEffect } from 'react'
import { Zap, TrendingUp, DollarSign, CheckCircle, XCircle, Target } from 'lucide-react'
import { motion } from 'framer-motion'
import Image from 'next/image'

interface GatewayStats {
  gateway: string
  total_sales: number
  successful_sales: number
  total_revenue: number
  avg_ticket: number
  approval_rate: number
  fallback_count: number
  fallback_revenue: number
}

interface CascataAnalysis {
  mp_total: number
  mp_approved: number
  mp_rejected: number
  mp_revenue: number
  mp_approval_rate: number
  rescued_count: number
  rescued_revenue: number
  rescue_rate: number
  appmax_direct: number
  appmax_direct_revenue: number
  total_sales: number
  total_revenue: number
}

interface GatewayStatsProps {
  startDate?: string
  endDate?: string
  days?: number
}

export default function GatewayStatsCard({ startDate, endDate, days = 30 }: GatewayStatsProps) {
  const [stats, setStats] = useState<GatewayStats[]>([])
  const [cascata, setCascata] = useState<CascataAnalysis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [startDate, endDate, days])

  const loadStats = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (startDate) params.set('start', startDate)
      if (endDate) params.set('end', endDate)
      if (days) params.set('days', String(days))

      const [statsRes, cascataRes] = await Promise.all([
        fetch(`/api/admin/gateway-stats?${params.toString()}`, { credentials: 'include' }),
        fetch('/api/admin/cascata-analysis', { credentials: 'include' })
      ])

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData.stats || [])
      }

      if (cascataRes.ok) {
        const cascataData = await cascataRes.json()
        setCascata(cascataData.cascata || null)
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas de gateway:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const mpStats = stats.find(s => s.gateway === 'mercadopago')
  const appmaxStats = stats.find(s => s.gateway === 'appmax')

  if (loading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-48 mb-4"></div>
        <div className="space-y-3">
          <div className="h-20 bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-brand-400" />
          Performance dos Gateways
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Mercado Pago */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-600/10 to-blue-500/5 border border-blue-500/20 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Image 
              src="/logo-mercadopago-blanco.png" 
              alt="Mercado Pago" 
              width={100} 
              height={40}
              className="object-contain brightness-0 invert"
            />
          </div>
          
          {mpStats ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Vendas Aprovadas</span>
                <span className="text-lg font-bold text-white">{mpStats.successful_sales}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Receita</span>
                <span className="text-lg font-bold text-green-400">{formatCurrency(mpStats.total_revenue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Taxa de Aprovação</span>
                <span className="text-sm font-semibold text-blue-300">{mpStats.approval_rate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Ticket Médio</span>
                <span className="text-sm font-semibold text-gray-300">{formatCurrency(mpStats.avg_ticket)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Nenhuma venda no período</p>
          )}
        </motion.div>

        {/* AppMax */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-purple-600/10 to-purple-500/5 border border-purple-500/20 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Image 
              src="/appmax-logo.png" 
              alt="Appmax" 
              width={100} 
              height={40}
              className="object-contain brightness-0 invert"
            />
          </div>
          
          {appmaxStats ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Vendas Aprovadas</span>
                <span className="text-lg font-bold text-white">{appmaxStats.successful_sales}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Receita</span>
                <span className="text-lg font-bold text-green-400">{formatCurrency(appmaxStats.total_revenue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Taxa de Aprovação</span>
                <span className="text-sm font-semibold text-purple-300">{appmaxStats.approval_rate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Vendas Resgatadas</span>
                <span className="text-sm font-semibold text-yellow-400">{appmaxStats.fallback_count}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Nenhuma venda no período</p>
          )}
        </motion.div>
      </div>

      {/* Cascata Info */}
      {cascata && cascata.rescued_count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-yellow-600/10 to-orange-600/10 border border-yellow-500/20 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-300">Sistema de Cascata</span>
          </div>
          <div className="text-xs text-gray-400 mb-2">
            {cascata.rescued_count} vendas ({formatCurrency(cascata.rescued_revenue)}) foram resgatadas pelo AppMax após recusa do Mercado Pago
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-yellow-400 to-orange-400 h-2 rounded-full transition-all"
                style={{ width: `${cascata.rescue_rate}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-yellow-400">{cascata.rescue_rate?.toFixed(1)}%</span>
          </div>
        </motion.div>
      )}
    </div>
  )
}
