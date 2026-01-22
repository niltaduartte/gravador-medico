// ================================================================
// Página: WhatsApp Inbox (Dashboard)
// ================================================================
// Tela completa estilo WhatsApp Web com lista de conversas e chat
// ================================================================

'use client'

import { useEffect, useState, useRef } from 'react'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getWhatsAppConversations,
  getWhatsAppMessages,
  markConversationAsRead,
  getWhatsAppStats
} from '@/lib/whatsapp-db'
import type { WhatsAppConversation, WhatsAppMessage } from '@/lib/types/whatsapp'
import ChatLayout from '@/components/whatsapp/ChatLayout'
import ContactList from '@/components/whatsapp/ContactList'
import MessageBubble from '@/components/whatsapp/MessageBubble'
import { Send, Search, RefreshCw, MessageSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function WhatsAppInboxPage() {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [selectedRemoteJid, setSelectedRemoteJid] = useState<string | null>(null)
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [stats, setStats] = useState({ totalContacts: 0, totalMessages: 0, totalUnread: 0 })

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Carregar conversas
  useEffect(() => {
    loadConversations()
    loadStats()
  }, [])

  // Carregar mensagens quando selecionar conversa
  useEffect(() => {
    if (selectedRemoteJid) {
      loadMessages(selectedRemoteJid)
      markAsRead(selectedRemoteJid)
    }
  }, [selectedRemoteJid])

  // Auto-scroll para última mensagem
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Realtime: Escutar novas mensagens
  useEffect(() => {
    const channel = supabaseAdmin
      .channel('whatsapp-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages'
        },
        (payload) => {
          console.log('📩 Nova mensagem recebida:', payload.new)
          
          // Atualizar lista se for da conversa atual
          if (payload.new.remote_jid === selectedRemoteJid) {
            const incoming = payload.new as WhatsAppMessage
            setMessages((prev) => {
              const exists = prev.some(
                (msg) =>
                  msg.id === incoming.id ||
                  (incoming.message_id && msg.message_id === incoming.message_id)
              )
              if (exists) return prev
              return [...prev, incoming]
            })
          }
          
          // Recarregar conversas
          loadConversations()
          loadStats()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_messages'
        },
        (payload) => {
          const updatedMessage = payload.new as WhatsAppMessage

          if (updatedMessage.remote_jid === selectedRemoteJid) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === updatedMessage.id ||
                (updatedMessage.message_id && msg.message_id === updatedMessage.message_id)
                  ? { ...msg, ...updatedMessage }
                  : msg
              )
            )
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_contacts'
        },
        (payload) => {
          setConversations((prev) => {
            const updated = prev.map((conv) => {
              if (conv.remote_jid === (payload.new as any).remote_jid) {
                return { ...conv, ...payload.new } as WhatsAppConversation
              }
              return conv
            })

            return updated.sort((a, b) => {
              const dateA = a.last_message_timestamp ? new Date(a.last_message_timestamp).getTime() : 0
              const dateB = b.last_message_timestamp ? new Date(b.last_message_timestamp).getTime() : 0
              return dateB - dateA
            })
          })

        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_contacts'
        },
        (payload) => {
          setConversations((prev) => {
            const exists = prev.some(conv => conv.remote_jid === (payload.new as any).remote_jid)
            if (exists) return prev
            return [payload.new as WhatsAppConversation, ...prev]
          })
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [selectedRemoteJid])

  async function loadConversations() {
    try {
      const data = await getWhatsAppConversations()
      setConversations(data)
      setLoading(false)
    } catch (error) {
      console.error('❌ Erro ao carregar conversas:', error)
      setLoading(false)
    }
  }

  async function loadMessages(remoteJid: string) {
    setLoadingMessages(true)
    try {
      try {
        await fetch('/api/whatsapp/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync-conversation',
            remoteJid,
            messagesLimit: 200
          })
        })
      } catch (syncError) {
        console.warn('⚠️ Falha ao sincronizar conversa (não crítico):', syncError)
      }

      const data = await getWhatsAppMessages(remoteJid, 200)
      setMessages(data)
    } catch (error) {
      console.error('❌ Erro ao carregar mensagens:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  async function markAsRead(remoteJid: string) {
    try {
      await markConversationAsRead(remoteJid)
      // Atualizar localmente
      setConversations((prev) =>
        prev.map((c) =>
          c.remote_jid === remoteJid ? { ...c, unread_count: 0 } : c
        )
      )
      loadStats()
    } catch (error) {
      console.error('❌ Erro ao marcar como lida:', error)
    }
  }

  async function loadStats() {
    try {
      const data = await getWhatsAppStats()
      setStats(data)
    } catch (error) {
      console.error('❌ Erro ao carregar stats:', error)
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const selectedConversation = conversations.find(
    (c) => c.remote_jid === selectedRemoteJid
  )

  const typingWindowMs = 8000
  const typingActive =
    !!selectedConversation?.is_typing &&
    !!selectedConversation?.typing_updated_at &&
    Date.now() - new Date(selectedConversation.typing_updated_at).getTime() < typingWindowMs

  const presenceLabel = selectedConversation
    ? typingActive
      ? 'digitando...'
      : selectedConversation.is_online
      ? 'online'
      : selectedConversation.last_seen_at
      ? `visto por ultimo ${formatDistanceToNow(new Date(selectedConversation.last_seen_at), {
          addSuffix: true,
          locale: ptBR
        })}`
      : `${messages.length} mensagens`
    : ''

  const filteredConversations = conversations.filter((c) => {
    const name = c.name || c.push_name || c.remote_jid
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div className="h-[100dvh] overflow-hidden">
      <ChatLayout
        sidebar={
          <>
            {/* Header da sidebar */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="w-6 h-6" />
                  WhatsApp Inbox
                </h2>
                <button
                  onClick={async () => {
                    await loadConversations()
                    await loadStats()
                    if (selectedRemoteJid) {
                      await loadMessages(selectedRemoteJid)
                    }
                  }}
                  className="p-2 hover:bg-gray-200 rounded-full transition"
                  title="Atualizar"
                >
                  <RefreshCw className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Stats */}
              <div className="flex gap-4 text-xs text-gray-600 mb-3">
                <span>📞 {stats.totalContacts} conversas</span>
                <span>💬 {stats.totalMessages} msgs</span>
                {stats.totalUnread > 0 && (
                  <span className="font-bold text-green-600">
                    🔔 {stats.totalUnread} não lidas
                  </span>
                )}
              </div>

              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar conversa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Lista de conversas */}
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                <p>Carregando...</p>
              </div>
            ) : (
              <ContactList
                conversations={filteredConversations}
                selectedRemoteJid={selectedRemoteJid || undefined}
                onSelectConversation={setSelectedRemoteJid}
              />
            )}
          </>
        }
      >
        <div className="flex flex-col h-full min-h-0">
          {selectedConversation ? (
            <>
              {/* Header do chat */}
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  {selectedConversation.profile_picture_url ? (
                    <img
                      src={selectedConversation.profile_picture_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-bold">
                      {(selectedConversation.name?.[0] || '?').toUpperCase()}
                    </div>
                  )}
                  <div>
                <h3 className="font-semibold text-gray-900">
                  {selectedConversation.name ||
                    selectedConversation.push_name ||
                    selectedConversation.remote_jid}
                </h3>
                <p className="text-xs text-gray-500">
                  {presenceLabel}
                </p>
              </div>
            </div>
          </div>

              {/* Área de mensagens */}
              <div
                className="flex-1 min-h-0 overflow-y-auto p-6 bg-gray-50"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d1d5db' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }}
              >
                {loadingMessages ? (
                  <div className="text-center text-gray-500">
                    <p>Carregando mensagens...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-500">
                    <p>Nenhuma mensagem ainda</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <MessageBubble key={msg.id} message={msg} />
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input de mensagem (placeholder - não implementado envio) */}
              <div className="bg-gray-50 border-t border-gray-200 p-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Digite uma mensagem (envio não implementado)"
                    disabled
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                  <button
                    disabled
                    className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  💡 Recurso de envio de mensagens virá em versão futura
                </p>
              </div>
            </>
          ) : (
            // Estado vazio
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center text-gray-400">
                <MessageSquare className="w-24 h-24 mx-auto mb-4 opacity-20" />
                <h3 className="text-xl font-semibold mb-2">WhatsApp Inbox</h3>
                <p className="text-sm">
                  Selecione uma conversa para ver as mensagens
                </p>
              </div>
            </div>
          )}
        </div>
      </ChatLayout>
    </div>
  )
}
