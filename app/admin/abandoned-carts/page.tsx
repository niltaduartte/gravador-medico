'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { ShoppingCart, Mail, Phone, DollarSign, Calendar, MessageCircle, CheckCircle, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface AbandonedCart {
  id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_cpf: string
  step: string
  status: string
  product_id: string
  order_bumps: any[]
  discount_code: string
  cart_value: number
  utm_source: string
  utm_medium: string
  utm_campaign: string
  session_id: string
  recovered_at: string | null
  recovered_order_id: string | null
  created_at: string
  updated_at: string
}

export default function AbandonedCartsPage() {
  const [carts, setCarts] = useState<AbandonedCart[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'abandoned' | 'recovered'>('abandoned')

  useEffect(() => {
    loadCarts()
  }, [filter])

  async function loadCarts() {
    try {
      setLoading(true)
      
      let query = supabase
        .from('abandoned_carts')
        .select('*')
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error

      setCarts(data || [])
    } catch (error) {
      console.error('Erro ao carregar carrinhos:', error)
    } finally {
      setLoading(false)
    }
  }

  function formatPhone(phone: string) {
    if (!phone) return ''
    // Remove tudo que não é número
    const cleaned = phone.replace(/\D/g, '')
    // Formata (XX) XXXXX-XXXX
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  function sendWhatsApp(cart: AbandonedCart) {
    const phone = cart.customer_phone.replace(/\D/g, '')
    const name = cart.customer_name || 'Olá'
    const value = cart.cart_value ? `R$ ${cart.cart_value.toFixed(2)}` : ''
    
    const message = encodeURIComponent(
      `Olá ${name}! 👋\n\n` +
      `Notamos que você estava prestes a garantir o *Gravador Médico* por ${value}.\n\n` +
      `Ainda tem alguma dúvida? Estou aqui para ajudar! 😊\n\n` +
      `Aproveite e finalize sua compra agora: https://seusite.com/checkout`
    )

    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank')
  }

  function sendEmail(cart: AbandonedCart) {
    const subject = encodeURIComponent('Seu carrinho está te esperando! 🛒')
    const body = encodeURIComponent(
      `Olá ${cart.customer_name || ''}!\n\n` +
      `Notamos que você não finalizou sua compra do Gravador Médico.\n\n` +
      `Ainda está com dúvidas? Podemos ajudar!\n\n` +
      `Clique aqui para finalizar: https://seusite.com/checkout`
    )

    window.location.href = `mailto:${cart.customer_email}?subject=${subject}&body=${body}`
  }

  const stats = {
    total: carts.length,
    abandoned: carts.filter(c => c.status === 'abandoned').length,
    recovered: carts.filter(c => c.status === 'recovered').length,
    totalValue: carts.reduce((sum, c) => sum + (c.cart_value || 0), 0),
    lostRevenue: carts.filter(c => c.status === 'abandoned').reduce((sum, c) => sum + (c.cart_value || 0), 0)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Carrinhos Abandonados</h1>
        <p className="text-gray-600 mt-1">Recupere vendas e entre em contato com clientes</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Carrinhos Abandonados</p>
              <p className="text-2xl font-bold text-gray-900">{stats.abandoned}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Carrinhos Recuperados</p>
              <p className="text-2xl font-bold text-gray-900">{stats.recovered}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Receita Perdida</p>
              <p className="text-2xl font-bold text-gray-900">
                R$ {stats.lostRevenue.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('abandoned')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'abandoned'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Abandonados ({stats.abandoned})
        </button>
        <button
          onClick={() => setFilter('recovered')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'recovered'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Recuperados ({stats.recovered})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'all'
              ? 'bg-violet-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Todos ({stats.total})
        </button>
      </div>

      {/* Lista de carrinhos */}
      <div className="space-y-4">
        {carts.length === 0 ? (
          <Card className="p-12 text-center">
            <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Nenhum carrinho {filter === 'all' ? '' : filter === 'abandoned' ? 'abandonado' : 'recuperado'} encontrado</p>
          </Card>
        ) : (
          carts.map(cart => (
            <Card key={cart.id} className={`p-6 ${cart.status === 'recovered' ? 'bg-green-50 border-green-200' : ''}`}>
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1 space-y-3">
                  {/* Nome e Status */}
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-gray-900">
                      {cart.customer_name || 'Nome não informado'}
                    </h3>
                    {cart.status === 'recovered' ? (
                      <span className="px-3 py-1 bg-green-600 text-white text-xs rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Recuperado
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-red-600 text-white text-xs rounded-full flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Abandonado
                      </span>
                    )}
                  </div>

                  {/* Contatos */}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    {cart.customer_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {cart.customer_email}
                      </div>
                    )}
                    {cart.customer_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {formatPhone(cart.customer_phone)}
                      </div>
                    )}
                  </div>

                  {/* Info adicional */}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-semibold">R$ {cart.cart_value?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(cart.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                    {cart.discount_code && (
                      <div className="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs font-medium">
                        Cupom: {cart.discount_code}
                      </div>
                    )}
                    {cart.utm_source && (
                      <div className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        Origem: {cart.utm_source}
                      </div>
                    )}
                  </div>

                  {/* Bumps selecionados */}
                  {cart.order_bumps && cart.order_bumps.length > 0 && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Order Bumps:</span>{' '}
                      {cart.order_bumps.map((b: any) => b.name).join(', ')}
                    </div>
                  )}

                  {/* Info de recuperação */}
                  {cart.status === 'recovered' && cart.recovered_at && (
                    <div className="text-sm text-green-700">
                      ✅ Recuperado em {format(new Date(cart.recovered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {cart.recovered_order_id && ` • Pedido: ${cart.recovered_order_id}`}
                    </div>
                  )}
                </div>

                {/* Ações */}
                {cart.status === 'abandoned' && (
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    <button
                      onClick={() => sendWhatsApp(cart)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp
                    </button>
                    <button
                      onClick={() => sendEmail(cart)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      E-mail
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
