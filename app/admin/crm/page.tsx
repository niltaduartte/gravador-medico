"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
  Users,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  MessageSquare,
  Plus,
  Search,
  Filter,
  ChevronRight,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
} from 'lucide-react'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Etapas do funil de vendas
const FUNIL_STAGES = [
  {
    id: 'lead',
    name: 'Novo Lead',
    color: 'bg-blue-500',
    borderColor: 'border-blue-500',
    icon: Users,
    description: 'Cliente entrou no site/checkout'
  },
  {
    id: 'contact',
    name: 'Primeiro Contato',
    color: 'bg-purple-500',
    borderColor: 'border-purple-500',
    icon: Mail,
    description: 'Envio de email/mensagem inicial'
  },
  {
    id: 'qualification',
    name: 'Qualificação',
    color: 'bg-yellow-500',
    borderColor: 'border-yellow-500',
    icon: MessageSquare,
    description: 'Entendendo necessidades'
  },
  {
    id: 'proposal',
    name: 'Proposta Enviada',
    color: 'bg-orange-500',
    borderColor: 'border-orange-500',
    icon: DollarSign,
    description: 'Aguardando decisão'
  },
  {
    id: 'negotiation',
    name: 'Negociação',
    color: 'bg-pink-500',
    borderColor: 'border-pink-500',
    icon: TrendingUp,
    description: 'Ajustes e follow-up'
  },
  {
    id: 'won',
    name: 'Venda Fechada',
    color: 'bg-green-500',
    borderColor: 'border-green-500',
    icon: CheckCircle,
    description: 'Cliente convertido! 🎉'
  },
  {
    id: 'lost',
    name: 'Perdido',
    color: 'bg-red-500',
    borderColor: 'border-red-500',
    icon: AlertCircle,
    description: 'Não converteu'
  },
]

interface Lead {
  id: string
  name: string
  email: string
  phone?: string
  stage: string
  value?: number
  source: string
  notes?: string
  last_contact?: string
  next_followup?: string
  created_at: string
  updated_at: string
}

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showNewLeadModal, setShowNewLeadModal] = useState(false)
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [filterType, setFilterType] = useState<'quick' | 'custom'>('quick')
  const [period, setPeriod] = useState(30)

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
      loadLeads()
    }
  }, [startDate, endDate])

  useEffect(() => {
    // Realtime para novas vendas
    const channel = supabase
      .channel('sales-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, (payload: any) => {
        console.log('🆕 Nova venda detectada, criando lead...')
        createLeadFromSale(payload.new)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadLeads = async () => {
    try {
      setLoading(true)
      
      console.log('📊 Carregando leads do CRM...')

      const start = startOfDay(new Date(startDate))
      const end = endOfDay(new Date(endDate))
      
      // 1. Buscar todas as vendas no período
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false })

      if (salesError) {
        console.error('❌ Erro ao buscar vendas:', salesError)
      }

      // 2. Buscar todos os carrinhos abandonados no período
      const { data: carts, error: cartsError } = await supabase
        .from('abandoned_carts')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false })

      if (cartsError) {
        console.error('❌ Erro ao buscar carrinhos:', cartsError)
      }

      console.log('✅ Vendas encontradas:', sales?.length || 0)
      console.log('✅ Carrinhos encontrados:', carts?.length || 0)

      const leadsFromSales: Lead[] = sales?.map(sale => ({
        id: `sale-${sale.id}`,
        name: sale.customer_name || 'Cliente',
        email: sale.customer_email,
        phone: sale.customer_phone,
        stage: sale.status === 'approved' || sale.status === 'paid' ? 'won' : 
               sale.status === 'pending' ? 'proposal' :
               sale.status === 'processing' ? 'negotiation' :
               'lead',
        value: Number(sale.total_amount) || 0,
        source: 'Checkout - Venda',
        created_at: sale.created_at,
        updated_at: sale.updated_at || sale.created_at,
      })) || []

      const leadsFromCarts: Lead[] = carts?.map(cart => ({
        id: `cart-${cart.id}`,
        name: cart.customer_name || 'Cliente',
        email: cart.customer_email,
        phone: cart.customer_phone,
        stage: cart.status === 'abandoned' ? 'lead' : 
               cart.status === 'recovered' ? 'won' : 'contact',
        value: Number(cart.total_value) || 0,
        source: 'Checkout - Carrinho Abandonado',
        notes: `Abandonou em: ${cart.checkout_step || 'início'}`,
        created_at: cart.created_at,
        updated_at: cart.updated_at || cart.created_at,
      })) || []

      // Combinar todos os leads
      const allLeads = [...leadsFromSales, ...leadsFromCarts]
      
      console.log('✅ Total de leads:', allLeads.length)
      
      setLeads(allLeads)
    } catch (error) {
      console.error('Erro ao carregar leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const createLeadFromSale = async (sale: any) => {
    const newLead: Lead = {
      id: sale.id,
      name: sale.customer_name || 'Cliente',
      email: sale.customer_email,
      phone: sale.customer_phone,
      stage: 'lead',
      value: sale.total_amount,
      source: 'Checkout',
      created_at: sale.created_at,
      updated_at: sale.updated_at,
    }
    
    setLeads(prev => [newLead, ...prev])
  }

  const moveLeadToStage = async (leadId: string, newStage: string) => {
    try {
      // Atualizar localmente
      setLeads(prev => prev.map(lead => 
        lead.id === leadId ? { ...lead, stage: newStage, updated_at: new Date().toISOString() } : lead
      ))

      // TODO: Aqui você criaria uma tabela 'crm_leads' no Supabase
      // Por enquanto, vamos apenas atualizar o estado local
      console.log(`✅ Lead ${leadId} movido para ${newStage}`)
    } catch (error) {
      console.error('Erro ao mover lead:', error)
    }
  }

  const handleDragStart = (lead: Lead) => {
    setDraggedLead(lead)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (stage: string) => {
    if (draggedLead) {
      moveLeadToStage(draggedLead.id, stage)
      setDraggedLead(null)
    }
  }

  const filteredLeads = leads.filter(lead => 
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getLeadsByStage = (stageId: string) => {
    return filteredLeads.filter(lead => lead.stage === stageId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 font-medium">Carregando CRM...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">CRM - Funil de Vendas</h1>
          <p className="text-gray-400 mt-1">Gestão completa de leads e follow-up</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            onClick={() => setShowNewLeadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl hover:shadow-lg hover:shadow-brand-500/30 transition-all font-semibold"
          >
            <Plus className="w-5 h-5" />
            Novo Lead
          </button>
        </div>
      </div>

      {/* Filtros de Data */}
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

      {/* Métricas Rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Leads</p>
              <p className="text-2xl font-black text-white">{leads.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Convertidos</p>
              <p className="text-2xl font-black text-white">{getLeadsByStage('won').length}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Em Andamento</p>
              <p className="text-2xl font-black text-white">
                {leads.filter(l => !['won', 'lost'].includes(l.stage)).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Valor Total</p>
              <p className="text-2xl font-black text-white">
                R$ {leads.reduce((sum, l) => sum + (l.value || 0), 0).toFixed(0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
          {FUNIL_STAGES.map((stage) => {
            const stageLeads = getLeadsByStage(stage.id)
            const StageIcon = stage.icon

            return (
              <div
                key={stage.id}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(stage.id)}
                className="flex-shrink-0 w-80"
              >
                {/* Column Header */}
                <div className={`${stage.color} rounded-t-xl p-4 text-white`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StageIcon className="w-5 h-5" />
                      <h3 className="font-bold text-lg">{stage.name}</h3>
                    </div>
                    <span className="px-2 py-1 bg-white/20 rounded-full text-sm font-bold">
                      {stageLeads.length}
                    </span>
                  </div>
                  <p className="text-sm text-white/80">{stage.description}</p>
                </div>

                {/* Cards Container */}
                <div className={`bg-gray-800/30 backdrop-blur-sm rounded-b-xl border-2 border-t-0 ${stage.borderColor} p-3 min-h-[400px] space-y-3`}>
                  <AnimatePresence>
                    {stageLeads.map((lead) => (
                      <motion.div
                        key={lead.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        draggable
                        onDragStart={() => handleDragStart(lead)}
                        onClick={() => setSelectedLead(lead)}
                        className="bg-gray-900 rounded-xl p-4 border border-gray-700 hover:border-brand-500 cursor-pointer transition-all hover:shadow-lg"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-bold text-white text-sm">{lead.name}</h4>
                          {lead.value && (
                            <span className="text-brand-400 font-bold text-sm">
                              R$ {lead.value.toFixed(0)}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 text-xs text-gray-400">
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{lead.email}</span>
                          </div>
                          {lead.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-3 h-3" />
                              <span>{lead.phone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            <span>{format(new Date(lead.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <span className="inline-block px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
                            {lead.source}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {stageLeads.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      Nenhum lead nesta etapa
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal de Detalhes do Lead */}
      <AnimatePresence>
        {selectedLead && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedLead(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl p-6 max-w-2xl w-full border-2 border-gray-700 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-white">Detalhes do Lead</h2>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Nome</label>
                  <p className="text-white font-bold">{selectedLead.name}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Email</label>
                  <p className="text-white">{selectedLead.email}</p>
                </div>

                {selectedLead.phone && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-1">Telefone</label>
                    <p className="text-white">{selectedLead.phone}</p>
                  </div>
                )}

                {selectedLead.value && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-1">Valor</label>
                    <p className="text-brand-400 font-black text-2xl">R$ {selectedLead.value.toFixed(2)}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Origem</label>
                  <p className="text-white">{selectedLead.source}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-1">Data de Entrada</label>
                  <p className="text-white">
                    {format(new Date(selectedLead.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Mover para:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {FUNIL_STAGES.map((stage) => {
                      const StageIcon = stage.icon
                      return (
                        <button
                          key={stage.id}
                          onClick={() => {
                            moveLeadToStage(selectedLead.id, stage.id)
                            setSelectedLead(null)
                          }}
                          className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-white transition-all ${
                            selectedLead.stage === stage.id
                              ? `${stage.color} shadow-lg`
                              : 'bg-gray-800 hover:bg-gray-700'
                          }`}
                        >
                          <StageIcon className="w-4 h-4" />
                          <span className="text-sm">{stage.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <button
                    onClick={() => setSelectedLead(null)}
                    className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-semibold transition-all"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
