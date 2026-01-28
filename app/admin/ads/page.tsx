'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { getAdsInsights, calculateAdsMetrics, getCampaignsStatus, CampaignInsight, AdsMetrics } from '@/lib/meta-marketing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, MousePointerClick, Eye, Users, TrendingUp, AlertCircle, 
  RefreshCw, Megaphone, Target, BarChart3, Zap, Filter, ArrowUpDown,
  PlayCircle, ExternalLink, ShoppingCart, Facebook
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Formatar moeda BRL
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// Formatar número com separador de milhar
const formatNumber = (value: number) => {
  return new Intl.NumberFormat('pt-BR').format(Math.round(value));
};

// Formatar percentual
const formatPercent = (value: number) => {
  return `${value.toFixed(2)}%`;
};

// Glass Card Component (igual ao Analytics)
const GlassCard = ({ children, className = '', gradient = false }: { children: React.ReactNode; className?: string; gradient?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-800/40 to-gray-900/60 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/20 hover:shadow-blue-500/10 hover:border-blue-500/20 transition-all duration-500 ${gradient ? 'before:absolute before:inset-0 before:bg-gradient-to-br before:from-blue-500/10 before:to-transparent before:pointer-events-none' : ''} ${className}`}
  >
    {children}
  </motion.div>
);

// Animated Number Component
const AnimatedNumber = ({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) => (
  <AnimatePresence mode="wait">
    <motion.span 
      key={value} 
      initial={{ opacity: 0, y: -20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: 20 }} 
      className="tabular-nums"
    >
      {prefix}{value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' : value >= 1000 ? (value / 1000).toFixed(1) + 'K' : value.toFixed(value < 10 ? 2 : 0)}{suffix}
    </motion.span>
  </AnimatePresence>
);

// Badge de status da campanha
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    ACTIVE: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Ativa' },
    PAUSED: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pausada' },
    DELETED: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Excluída' },
    ARCHIVED: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Arquivada' },
    CAMPAIGN_PAUSED: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pausada' },
    IN_PROCESS: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Processando' },
    WITH_ISSUES: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Com Problemas' },
    UNKNOWN: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Desconhecido' },
  };

  const config = statusConfig[status] || statusConfig.UNKNOWN;
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

// Opções de período (compatíveis com Facebook Ads API date_preset)
const periodOptions = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last_7d', label: 'Últimos 7 dias' },
  { value: 'last_14d', label: 'Últimos 14 dias' },
  { value: 'last_30d', label: 'Últimos 30 dias' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
  { value: 'maximum', label: 'Todo período' },
];

// Opções de filtro por status
const statusFilterOptions = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Ativas' },
  { value: 'paused', label: 'Pausadas' },
  { value: 'archived', label: 'Arquivadas' },
];

// Opções de ordenação
const sortOptions = [
  { value: 'spend_desc', label: 'Maior gasto' },
  { value: 'spend_asc', label: 'Menor gasto' },
  { value: 'date_desc', label: 'Mais recentes' },
  { value: 'date_asc', label: 'Mais antigas' },
  { value: 'clicks_desc', label: 'Mais cliques' },
  { value: 'ctr_desc', label: 'Melhor CTR' },
];

export default function AdsPage() {
  const [metrics, setMetrics] = useState<AdsMetrics | null>(null);
  const [allCampaigns, setAllCampaigns] = useState<CampaignInsight[]>([]);
  const [statusMap, setStatusMap] = useState<Map<string, string>>(new Map());
  const [createdTimeMap, setCreatedTimeMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState('last_7d');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');

  const fetchData = useCallback(async (showRefresh = false, period = selectedPeriod) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [campaignsRes, statusRes] = await Promise.all([
        fetch(`/api/ads/insights?period=${period}`),
        fetch('/api/ads/status')
      ]);
      
      const campaigns = await campaignsRes.json();
      const status = await statusRes.json();
      
      const calculatedMetrics = calculateAdsMetrics(Array.isArray(campaigns) ? campaigns : []);
      setMetrics(calculatedMetrics);
      
      const statusMapTemp = new Map<string, string>();
      const createdTimeMapTemp = new Map<string, string>();
      if (Array.isArray(status)) {
        status.forEach((s: any) => {
          statusMapTemp.set(s.id, s.effective_status || s.status);
          if (s.created_time) {
            createdTimeMapTemp.set(s.id, s.created_time);
          }
        });
      }
      setStatusMap(statusMapTemp);
      setCreatedTimeMap(createdTimeMapTemp);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro ao carregar dados de anúncios:', error);
      setMetrics({
        totalSpend: 0,
        totalClicks: 0,
        totalImpressions: 0,
        totalReach: 0,
        avgCpc: 0,
        avgCtr: 0,
        totalVideoViews: 0,
        totalOutboundClicks: 0,
        totalPurchases: 0,
        totalPurchaseValue: 0,
        roas: 0,
        cpa: 0,
        campaigns: []
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchData(false, selectedPeriod);
  }, [selectedPeriod]);

  useEffect(() => {
    // Atualizar a cada 5 minutos
    const interval = setInterval(() => fetchData(), 300000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filtrar e ordenar campanhas
  const filteredAndSortedCampaigns = useMemo(() => {
    if (!metrics?.campaigns) return [];
    
    let result = [...metrics.campaigns];
    
    // Filtrar por status
    if (statusFilter !== 'all') {
      result = result.filter(campaign => {
        const campaignStatus = statusMap.get(campaign.campaign_id || '') || 'UNKNOWN';
        const normalizedStatus = campaignStatus.toUpperCase();
        
        switch (statusFilter) {
          case 'active':
            return normalizedStatus === 'ACTIVE';
          case 'paused':
            return normalizedStatus === 'PAUSED';
          case 'archived':
            return normalizedStatus === 'ARCHIVED';
          default:
            return true;
        }
      });
    }
    
    // Ordenar
    result.sort((a, b) => {
      switch (sortBy) {
        case 'spend_desc':
          return Number(b.spend || 0) - Number(a.spend || 0);
        case 'spend_asc':
          return Number(a.spend || 0) - Number(b.spend || 0);
        case 'date_desc': {
          // Usar created_time se disponível, senão usar date_start
          const dateA = createdTimeMap.get(a.campaign_id || '') || a.date_start || '';
          const dateB = createdTimeMap.get(b.campaign_id || '') || b.date_start || '';
          return dateB.localeCompare(dateA);
        }
        case 'date_asc': {
          const dateA = createdTimeMap.get(a.campaign_id || '') || a.date_start || '';
          const dateB = createdTimeMap.get(b.campaign_id || '') || b.date_start || '';
          return dateA.localeCompare(dateB);
        }
        case 'clicks_desc':
          return Number(b.clicks || 0) - Number(a.clicks || 0);
        case 'ctr_desc':
          return Number(b.ctr || 0) - Number(a.ctr || 0);
        default:
          return Number(b.spend || 0) - Number(a.spend || 0);
      }
    });
    
    return result;
  }, [metrics?.campaigns, statusFilter, sortBy, statusMap, createdTimeMap]);

  const kpiCards = [
    { 
      title: 'Investimento Total', 
      value: metrics?.totalSpend || 0, 
      icon: DollarSign, 
      color: 'from-green-500 to-emerald-600',
      format: 'currency'
    },
    { 
      title: 'ROAS', 
      value: metrics?.roas || 0, 
      icon: TrendingUp, 
      color: 'from-purple-500 to-violet-600',
      format: 'roas'
    },
    { 
      title: 'CPA', 
      value: metrics?.cpa || 0, 
      icon: ShoppingCart, 
      color: 'from-pink-500 to-rose-600',
      format: 'currency'
    },
    { 
      title: 'CTR Médio', 
      value: metrics?.avgCtr || 0, 
      icon: Target, 
      color: 'from-orange-500 to-amber-600',
      format: 'percent'
    },
  ];

  const funnelCards = [
    { 
      title: 'Impressões', 
      value: metrics?.totalImpressions || 0, 
      icon: Eye, 
      color: 'text-gray-400',
      description: 'Vezes que apareceu'
    },
    { 
      title: 'Cliques no Link', 
      value: metrics?.totalClicks || 0, 
      icon: MousePointerClick, 
      color: 'text-blue-400',
      description: 'Interessados'
    },
    { 
      title: 'Cliques de Saída', 
      value: metrics?.totalOutboundClicks || 0, 
      icon: ExternalLink, 
      color: 'text-cyan-400',
      description: 'Saíram do FB'
    },
    { 
      title: 'CPC Médio', 
      value: metrics?.avgCpc || 0, 
      icon: DollarSign, 
      color: 'text-green-400',
      description: 'Custo por clique',
      isCurrency: true
    },
  ];

  const engagementCards = [
    { 
      title: 'Alcance', 
      value: metrics?.totalReach || 0, 
      icon: Users, 
      color: 'text-indigo-400'
    },
    { 
      title: 'Video Views', 
      value: metrics?.totalVideoViews || 0, 
      icon: PlayCircle, 
      color: 'text-red-400'
    },
    { 
      title: 'Compras', 
      value: metrics?.totalPurchases || 0, 
      icon: ShoppingCart, 
      color: 'text-emerald-400'
    },
    { 
      title: 'Valor em Vendas', 
      value: metrics?.totalPurchaseValue || 0, 
      icon: DollarSign, 
      color: 'text-yellow-400',
      isCurrency: true
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between mb-8"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25">
            <Facebook className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Meta Ads</h1>
            <p className="text-gray-400 mt-1">
              Performance das campanhas ({periodOptions.find(p => p.value === selectedPeriod)?.label})
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
          {/* Seletor de Período */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
            style={{ backgroundImage: 'none' }}
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value} className="bg-gray-800 text-white">
                {option.label}
              </option>
            ))}
          </select>

          {/* Filtro por Status */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
              style={{ backgroundImage: 'none' }}
            >
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-gray-800 text-white">
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Ordenação */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-4 w-4 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
              style={{ backgroundImage: 'none' }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-gray-800 text-white">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <span className="text-sm text-gray-500 hidden md:block">
            Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
          </span>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </motion.div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <GlassCard key={i} className="p-6">
              <Skeleton className="h-4 w-24 bg-white/10 mb-4" />
              <Skeleton className="h-8 w-32 bg-white/10" />
            </GlassCard>
          ))
        ) : (
          kpiCards.map((kpi, index) => (
            <GlassCard key={kpi.title} gradient className="p-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-400">{kpi.title}</span>
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${kpi.color} shadow-lg`}>
                    <kpi.icon className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white">
                  {kpi.format === 'currency' && formatCurrency(kpi.value)}
                  {kpi.format === 'number' && formatNumber(kpi.value)}
                  {kpi.format === 'percent' && formatPercent(kpi.value)}
                  {kpi.format === 'roas' && `${kpi.value.toFixed(2)}x`}
                </div>
              </motion.div>
            </GlassCard>
          ))
        )}
      </div>

      {/* Funil de Tráfego */}
      <GlassCard className="mb-6 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Facebook className="h-5 w-5 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Funil de Tráfego</h2>
          <Badge className="bg-blue-500/10 text-blue-300 border border-blue-500/30">
            Meta Ads
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/5">
                <Skeleton className="h-4 w-20 bg-white/10 mb-2" />
                <Skeleton className="h-6 w-16 bg-white/10" />
              </div>
            ))
          ) : (
            funnelCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                  <span className="text-sm text-gray-400">{card.title}</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {card.isCurrency ? formatCurrency(card.value) : formatNumber(card.value)}
                </div>
                {card.description && (
                  <span className="text-xs text-gray-500">{card.description}</span>
                )}
              </motion.div>
            ))
          )}
        </div>
      </GlassCard>

      {/* Engagement Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <GlassCard key={i} className="p-4">
              <Skeleton className="h-4 w-24 bg-white/10 mb-4" />
              <Skeleton className="h-8 w-32 bg-white/10" />
            </GlassCard>
          ))
        ) : (
          engagementCards.map((card, index) => (
            <GlassCard key={card.title} className="p-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-medium text-gray-400">{card.title}</span>
                  <div className="text-xl font-bold text-white mt-1">
                    {card.isCurrency ? formatCurrency(card.value) : formatNumber(card.value)}
                  </div>
                </div>
                <card.icon className={`h-8 w-8 ${card.color}`} />
              </motion.div>
            </GlassCard>
          ))
        )}
      </div>

      {/* Campaigns Table */}
      <GlassCard className="overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Campanhas</h2>
            <span className="text-sm text-gray-500">
              {filteredAndSortedCampaigns.length} de {metrics?.campaigns.length || 0} campanhas
            </span>
          </div>
        </div>
        
        <div className="p-6">
          {loading ? (
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-6 w-48 bg-white/10" />
                  <Skeleton className="h-6 w-20 bg-white/10" />
                  <Skeleton className="h-6 w-24 bg-white/10" />
                  <Skeleton className="h-6 w-16 bg-white/10" />
                </div>
              ))}
            </div>
          ) : filteredAndSortedCampaigns.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="p-4 rounded-full bg-gray-800/50 mb-6">
                <AlertCircle className="h-12 w-12 text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {metrics?.campaigns.length === 0 
                  ? (selectedPeriod === 'today' ? 'Dados de hoje ainda não disponíveis' : 'Nenhuma campanha encontrada')
                  : `Nenhuma campanha ${statusFilterOptions.find(o => o.value === statusFilter)?.label.toLowerCase() || ''} encontrada`}
              </h3>
              <p className="text-gray-400 max-w-md mb-6">
                {metrics?.campaigns.length === 0 
                  ? (selectedPeriod === 'today' 
                    ? 'O Facebook pode levar até 24 horas para processar os dados do dia atual. Tente selecionar "Ontem" ou "Últimos 7 dias" para ver dados mais recentes.'
                    : 'Não há dados de campanhas para o período selecionado. Verifique se você tem campanhas ativas no Gerenciador de Anúncios do Facebook.')
                  : 'Tente alterar os filtros para ver mais campanhas.'}
              </p>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Zap className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-blue-300">
                  {metrics?.campaigns.length === 0 
                    ? (selectedPeriod === 'today' ? 'Selecione "Ontem" para ver os dados mais recentes' : 'Crie sua primeira campanha no Meta Ads Manager')
                    : `${metrics?.campaigns.length} campanhas disponíveis no total`}
                </span>
              </div>
            </motion.div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Campanha</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Gasto</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Cliques</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">CPC</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">CTR</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Impressões</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedCampaigns.map((campaign, index) => {
                    const status = campaign.campaign_id 
                      ? statusMap.get(campaign.campaign_id) || 'UNKNOWN'
                      : 'UNKNOWN';
                    
                    return (
                      <motion.tr 
                        key={campaign.campaign_id || index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <span className="font-medium text-white">{campaign.campaign_name}</span>
                        </td>
                        <td className="py-4 px-4">
                          <StatusBadge status={status} />
                        </td>
                        <td className="py-4 px-4 text-right font-medium text-green-400">
                          {formatCurrency(Number(campaign.spend || 0))}
                        </td>
                        <td className="py-4 px-4 text-right text-white">
                          {formatNumber(Number(campaign.clicks || 0))}
                        </td>
                        <td className="py-4 px-4 text-right text-orange-400">
                          {formatCurrency(Number(campaign.cpc || 0))}
                        </td>
                        <td className="py-4 px-4 text-right text-purple-400">
                          {formatPercent(Number(campaign.ctr || 0))}
                        </td>
                        <td className="py-4 px-4 text-right text-gray-400">
                          {formatNumber(Number(campaign.impressions || 0))}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
