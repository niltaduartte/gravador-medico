'use client'

import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, CreditCard, Users, ShoppingBag } from 'lucide-react'

interface BigNumberProps {
  title: string
  value: string
  delta: number
  deltaText: string
  icon: React.ReactNode
  loading?: boolean
}

function BigNumberCard({ title, value, delta, deltaText, icon, loading }: BigNumberProps) {
  const isPositive = delta > 0
  const isNeutral = delta === 0

  if (loading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-gray-700 rounded w-24"></div>
          <div className="h-8 w-8 bg-gray-700 rounded-lg"></div>
        </div>
        <div className="h-8 bg-gray-700 rounded w-32 mb-2"></div>
        <div className="h-3 bg-gray-700 rounded w-20"></div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6 hover:border-gray-600 transition-all">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-400">{title}</span>
        <div className="p-2 bg-brand-500/10 rounded-lg text-brand-400">
          {icon}
        </div>
      </div>
      
      <div className="mb-2">
        <h3 className="text-3xl font-bold text-white">{value}</h3>
      </div>
      
      <div className="flex items-center gap-1.5">
        {!isNeutral && delta !== undefined && delta !== null && (
          <div className={`flex items-center gap-0.5 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span className="text-sm font-semibold">
              {isPositive ? '+' : ''}{Math.abs(delta).toFixed(1)}%
            </span>
          </div>
        )}
        <span className="text-sm text-gray-500">{deltaText}</span>
      </div>
    </div>
  )
}

interface BigNumbersProps {
  metrics: {
    revenue: number
    gross_revenue?: number
    total_discount?: number
    failed_sales?: number
    paid_sales?: number
    pending_sales?: number
    sales: number
    unique_visitors?: number
    conversion_rate: number
    average_order_value: number
    revenue_change: number
    aov_change: number
    visitors_change: number
    time_change: number
    sales_change?: number
  }
  loading?: boolean
  periodLabel?: string
}

export default function BigNumbers({ metrics, loading, periodLabel }: BigNumbersProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1).replace('.', ',')}%`
  }

  const periodText = periodLabel || 'últimos 30 dias'

  // Previne erro se metrics estiver null
  if (!metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <BigNumberCard title="Faturamento Bruto" value="R$ 0" delta={0} deltaText="vs últimos 30 dias" icon={<DollarSign className="w-5 h-5" />} loading={true} />
        <BigNumberCard title="Ticket Médio (AOV)" value="R$ 0" delta={0} deltaText="vs período anterior" icon={<ShoppingCart className="w-5 h-5" />} loading={true} />
        <BigNumberCard title="Taxa de Conversão" value="0.0%" delta={0} deltaText="visitantes → vendas" icon={<CreditCard className="w-5 h-5" />} loading={true} />
        <BigNumberCard title="Visitantes (últimos 30 dias)" value="0" delta={0} deltaText="vs período anterior" icon={<Users className="w-5 h-5" />} loading={true} />
        <BigNumberCard title="Total de Vendas (últimos 30 dias)" value="0" delta={0} deltaText="vs período anterior" icon={<ShoppingBag className="w-5 h-5" />} loading={true} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Faturamento com detalhes */}
      {metrics.gross_revenue !== undefined && metrics.revenue > 0 && (
        <div className="bg-gradient-to-br from-brand-500/10 to-brand-600/5 rounded-xl border border-brand-500/20 p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs font-medium text-gray-400 mb-1">Faturamento Bruto</div>
              <div className="text-xl font-bold text-white">{formatCurrency(metrics.gross_revenue || metrics.revenue || 0)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-400 mb-1">Descontos</div>
              <div className="text-xl font-bold text-red-400">-{formatCurrency(metrics.total_discount || 0)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-400 mb-1">Faturamento Líquido</div>
              <div className="text-xl font-bold text-brand-400">{formatCurrency(metrics.revenue || 0)}</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Resumo de Vendas por Status */}
      {(metrics.paid_sales !== undefined || metrics.pending_sales !== undefined || metrics.failed_sales !== undefined) && metrics.sales > 0 && (
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            {metrics.paid_sales !== undefined && (
              <div>
                <div className="text-xs font-medium text-gray-400 mb-1">Vendas Pagas</div>
                <div className="text-xl font-bold text-green-400">{metrics.paid_sales}</div>
                <div className="text-xs text-gray-500 mt-1">{formatCurrency((metrics.revenue || 0))}</div>
              </div>
            )}
            {metrics.pending_sales !== undefined && (
              <div>
                <div className="text-xs font-medium text-gray-400 mb-1">Pendentes</div>
                <div className="text-xl font-bold text-yellow-400">{metrics.pending_sales}</div>
                <div className="text-xs text-gray-500 mt-1">Aguardando pagamento</div>
              </div>
            )}
            {metrics.failed_sales !== undefined && (
              <div>
                <div className="text-xs font-medium text-gray-400 mb-1">Recusadas</div>
                <div className="text-xl font-bold text-red-400">{metrics.failed_sales}</div>
                <div className="text-xs text-gray-500 mt-1">Canceladas/Expiradas</div>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <BigNumberCard
          title={metrics.gross_revenue ? "Faturamento Líquido" : "Faturamento Bruto"}
          value={formatCurrency(metrics.revenue || 0)}
          delta={metrics.revenue_change || 0}
          deltaText="vs período anterior"
          icon={<DollarSign className="w-5 h-5" />}
          loading={loading}
        />
        
        <BigNumberCard
          title="Ticket Médio (AOV)"
          value={formatCurrency(metrics.average_order_value || 0)}
          delta={metrics.aov_change || 0}
          deltaText="vs período anterior"
          icon={<ShoppingCart className="w-5 h-5" />}
          loading={loading}
        />
        
        <BigNumberCard
          title="Taxa de Conversão"
          value={formatPercent(metrics.conversion_rate || 0)}
          delta={metrics.visitors_change || 0}
          deltaText="visitantes → vendas"
          icon={<CreditCard className="w-5 h-5" />}
          loading={loading}
        />

        <BigNumberCard
          title={`Visitantes (${periodText})`}
          value={metrics.unique_visitors?.toString() || '0'}
          delta={metrics.visitors_change || 0}
          deltaText="vs período anterior"
          icon={<Users className="w-5 h-5" />}
          loading={loading}
        />

        <BigNumberCard
          title={`Total de Vendas (${periodText})`}
          value={metrics.sales?.toString() || '0'}
          delta={metrics.sales_change ?? metrics.time_change ?? 0}
          deltaText="vs período anterior"
          icon={<ShoppingBag className="w-5 h-5" />}
          loading={loading}
        />
      </div>
      
      {/* Pagamentos Recusados (se disponível) */}
      {metrics.failed_sales !== undefined && metrics.failed_sales > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-red-400">Pagamentos Recusados</div>
              <div className="text-xs text-gray-400 mt-1">Cancelados, expirados, recusados pelo banco</div>
            </div>
            <div className="text-3xl font-bold text-red-400">{metrics.failed_sales}</div>
          </div>
        </div>
      )}
    </div>
  )
}
