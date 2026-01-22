// ================================================================
// Página: Chat Interno entre Administradores
// ================================================================
// Layout similar ao WhatsApp com lista de conversas e mensagens
// ================================================================

'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import {
  getUserConversations,
  getConversationMessages,
  sendAdminChatMessage,
  markAdminChatAsRead,
  createOrGetDirectConversation,
  getAdminUsers
} from '@/lib/admin-chat-db'
import type { UserConversation, AdminChatMessage } from '@/lib/types/admin-chat'
import { Send, Search, Plus, Users, MessageCircle, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNotifications } from '@/components/NotificationProvider'
import { useSearchParams, useRouter } from 'next/navigation'

export default function AdminChatPage() {
  const router = useRouter()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<UserConversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AdminChatMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [adminUsers, setAdminUsers] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { addNotification } = useNotifications()
  const searchParams = useSearchParams()

  // Obter usuário atual
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error || !user) {
          console.error('Erro ao obter usuário:', error)
          setLoading(false) // 👈 IMPORTANTE: Desativa loading antes de redirecionar
          router.push('/admin/login')
          return
        }

        console.log('✅ Usuário autenticado:', user.id)
        setCurrentUserId(user.id)
      } catch (err) {
        console.error('Erro ao carregar usuário:', err)
        setLoading(false) // 👈 IMPORTANTE: Desativa loading antes de redirecionar
        router.push('/admin/login')
      }
    }

    loadUser()
  }, [router])

  // Auto-abrir conversa se vier da notificação
  useEffect(() => {
    const conversationParam = searchParams.get('conversation')
    if (conversationParam) {
      setSelectedConversationId(conversationParam)
    }
  }, [searchParams])

  // Carregar conversas
  useEffect(() => {
    if (currentUserId) {
      loadConversations()
    }
  }, [currentUserId])

  // Carregar mensagens quando selecionar conversa
  useEffect(() => {
    if (selectedConversationId && currentUserId) {
      loadMessages(selectedConversationId)
      markAsRead(selectedConversationId)
    }
  }, [selectedConversationId, currentUserId])

  // Auto-scroll para última mensagem
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // ================================================================
  // REALTIME: Escutar novas mensagens
  // ================================================================
  useEffect(() => {
    if (!currentUserId) return

    console.log('🔌 Conectando ao Realtime do Chat Interno...')

    const channel = supabaseAdmin
      .channel('admin-chat-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_chat_messages'
        },
        (payload) => {
          console.log('📩 Nova mensagem recebida:', payload.new)
          
          const newMessage = payload.new as AdminChatMessage

          // 🔔 Criar notificação se NÃO for minha mensagem
          if (newMessage.sender_id !== currentUserId) {
            addNotification({
              type: 'admin_chat_message',
              title: newMessage.sender_name || 'Admin',
              message: newMessage.content || '[Mídia]',
              metadata: {
                admin_chat_conversation_id: newMessage.conversation_id,
                profile_picture_url: newMessage.sender_avatar
              }
            })
          }

          // Se for da conversa atual, adicionar ao estado
          if (newMessage.conversation_id === selectedConversationId) {
            setMessages((prev) => {
              const exists = prev.some(msg => msg.id === newMessage.id)
              if (exists) return prev
              return [...prev, newMessage]
            })
            
            setTimeout(() => scrollToBottom(), 100)
          }

          // Atualizar lista de conversas
          loadConversations()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'admin_chat_conversations'
        },
        (payload) => {
          console.log('🔄 Conversa atualizada:', payload.new)
          loadConversations()
        }
      )
      .subscribe((status) => {
        console.log('📡 Status Realtime Chat:', status)
      })

    return () => {
      supabaseAdmin.removeChannel(channel)
    }
  }, [currentUserId, selectedConversationId, addNotification])

  const loadConversations = async () => {
    if (!currentUserId) return
    
    try {
      const data = await getUserConversations(currentUserId)
      setConversations(data)
      setLoading(false)
      setError(null)
    } catch (error: any) {
      console.error('❌ Erro ao carregar conversas:', error)
      setLoading(false)
      
      // Detectar se é erro de tabela não existente
      if (error?.message?.includes('relation') || error?.message?.includes('does not exist')) {
        setError('Banco de dados não configurado. Execute o SQL em database/10-admin-chat-schema.sql no Supabase.')
      } else {
        setError('Erro ao carregar conversas. Verifique o console.')
      }
    }
  }

  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true)
    const data = await getConversationMessages(conversationId)
    setMessages(data)
    setLoadingMessages(false)
  }

  const markAsRead = async (conversationId: string) => {
    if (!currentUserId) return
    await markAdminChatAsRead(conversationId, currentUserId)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversationId || !currentUserId) return

    const content = messageInput.trim()
    setMessageInput('')

    await sendAdminChatMessage({
      conversation_id: selectedConversationId,
      sender_id: currentUserId,
      content,
      message_type: 'text'
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleNewChat = async (otherUserId: string) => {
    if (!currentUserId) return

    const conversationId = await createOrGetDirectConversation(currentUserId, otherUserId)
    if (conversationId) {
      setSelectedConversationId(conversationId)
      setShowNewChatModal(false)
      loadConversations()
    }
  }

  const loadAdminUsers = async () => {
    const users = await getAdminUsers()
    setAdminUsers(users.filter(u => u.id !== currentUserId))
    setShowNewChatModal(true)
  }

  // Filtrar conversas por busca
  const filteredConversations = conversations.filter(conv => {
    const searchLower = searchQuery.toLowerCase()
    return (
      conv.name?.toLowerCase().includes(searchLower) ||
      conv.other_participant_name?.toLowerCase().includes(searchLower) ||
      conv.other_participant_email?.toLowerCase().includes(searchLower) ||
      conv.last_message_content?.toLowerCase().includes(searchLower)
    )
  })

  const selectedConversation = conversations.find(c => c.id === selectedConversationId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#111b21]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <div className="text-white">Carregando...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#111b21]">
        <div className="max-w-md p-6 bg-red-900/20 border border-red-700 rounded-lg text-center">
          <h3 className="text-red-500 font-bold text-lg mb-2">❌ Erro</h3>
          <p className="text-white text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
          >
            Recarregar Página
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#111b21]">
      {/* ================================================================
          SIDEBAR: Lista de Conversas
          ================================================================ */}
      <div className="w-[400px] bg-[#111b21] border-r border-gray-800 flex flex-col">
        {/* Header */}
        <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between border-b border-gray-800">
          <h1 className="text-white font-semibold text-lg flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Chat Interno
          </h1>
          <button
            onClick={loadAdminUsers}
            className="p-2 hover:bg-[#2a3942] rounded-full transition-colors"
            title="Nova conversa"
          >
            <Plus className="w-5 h-5 text-gray-300" />
          </button>
        </div>

        {/* Busca */}
        <div className="p-3 bg-[#111b21]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar conversas..."
              className="w-full bg-[#202c33] text-white pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884]"
            />
          </div>
        </div>

        {/* Lista de Conversas */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma conversa</p>
              <button
                onClick={loadAdminUsers}
                className="mt-4 text-[#00a884] text-sm hover:underline"
              >
                Iniciar nova conversa
              </button>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={conversation.id === selectedConversationId}
                onClick={() => setSelectedConversationId(conversation.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ================================================================
          MAIN: Área de Mensagens
          ================================================================ */}
      <div className="flex-1 flex flex-col bg-[#0b141a]">
        {!selectedConversation ? (
          // Estado vazio
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <MessageCircle className="w-20 h-20 mx-auto mb-4 opacity-20" />
              <h3 className="text-xl font-semibold mb-2">Chat Interno</h3>
              <p className="text-sm">Selecione uma conversa para começar</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header do Chat */}
            <div className="h-[60px] bg-[#202c33] px-4 flex items-center gap-3 border-b border-gray-800">
              {selectedConversation.other_participant_avatar ? (
                <img
                  src={selectedConversation.other_participant_avatar}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#6b7c85] flex items-center justify-center text-white font-semibold">
                  {selectedConversation.type === 'group' 
                    ? <Users className="w-5 h-5" />
                    : (selectedConversation.other_participant_name?.[0] || '?').toUpperCase()
                  }
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-white font-semibold">
                  {selectedConversation.type === 'group'
                    ? selectedConversation.name
                    : selectedConversation.other_participant_name || selectedConversation.other_participant_email
                  }
                </h2>
                {selectedConversation.type === 'direct' && selectedConversation.other_participant_email && (
                  <p className="text-xs text-gray-400">{selectedConversation.other_participant_email}</p>
                )}
              </div>
            </div>

            {/* Área de Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-500">Carregando mensagens...</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma mensagem ainda</p>
                    <p className="text-xs mt-1">Envie a primeira mensagem!</p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={message.sender_id === currentUserId}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de Mensagem */}
            <div className="p-4 bg-[#202c33] border-t border-gray-800">
              <div className="flex items-end gap-3">
                <div className="flex-1 bg-[#2a3942] rounded-lg px-4 py-2">
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Digite uma mensagem..."
                    rows={1}
                    className="w-full bg-transparent text-white text-[15px] resize-none focus:outline-none placeholder-gray-500 max-h-[100px]"
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="p-3 bg-[#00a884] hover:bg-[#06cf9c] rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ================================================================
          MODAL: Nova Conversa
          ================================================================ */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#202c33] rounded-lg w-[500px] max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-semibold">Nova Conversa</h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="p-1 hover:bg-[#2a3942] rounded-full"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Lista de Admins */}
            <div className="flex-1 overflow-y-auto p-2">
              {adminUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p className="text-sm">Nenhum outro administrador encontrado</p>
                </div>
              ) : (
                adminUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleNewChat(user.id)}
                    className="w-full p-3 hover:bg-[#2a3942] rounded-lg flex items-center gap-3 transition-colors"
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#6b7c85] flex items-center justify-center text-white font-semibold">
                        {(user.name?.[0] || user.email[0]).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium">{user.name || user.email}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ================================================================
// Componente: Item da Lista de Conversas
// ================================================================
function ConversationItem({
  conversation,
  isSelected,
  onClick
}: {
  conversation: UserConversation
  isSelected: boolean
  onClick: () => void
}) {
  const displayName = conversation.type === 'group'
    ? conversation.name
    : conversation.other_participant_name || conversation.other_participant_email || 'Admin'

  const lastMessageTime = conversation.last_message_timestamp
    ? formatDistanceToNow(new Date(conversation.last_message_timestamp), {
        addSuffix: false,
        locale: ptBR
      }).replace('cerca de ', '')
    : ''

  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-3 hover:bg-[#202c33] transition-colors text-left border-b border-gray-800 ${
        isSelected ? 'bg-[#2a3942]' : 'bg-[#111b21]'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 pt-1">
          {conversation.other_participant_avatar ? (
            <img
              src={conversation.other_participant_avatar}
              alt={displayName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#6b7c85] flex items-center justify-center text-white font-semibold text-lg">
              {conversation.type === 'group' 
                ? <Users className="w-5 h-5" />
                : (displayName?.[0]?.toUpperCase() || '?')
              }
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="font-medium text-white truncate text-[16px]">
              {displayName}
            </h3>
            {lastMessageTime && (
              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                {lastMessageTime}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400 truncate flex-1">
              {conversation.last_message_content || 'Sem mensagens'}
            </p>

            {conversation.unread_count > 0 && (
              <span className="ml-2 bg-[#00a884] text-white text-xs font-semibold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1.5 flex-shrink-0">
                {conversation.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ================================================================
// Componente: Bolha de Mensagem
// ================================================================
function MessageBubble({
  message,
  isOwn
}: {
  message: AdminChatMessage
  isOwn: boolean
}) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[65%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {!isOwn && message.sender_name && (
          <span className="text-xs text-gray-400 px-2">{message.sender_name}</span>
        )}
        <div
          className={`px-3 py-2 rounded-lg ${
            isOwn
              ? 'bg-[#005c4b] text-white rounded-br-sm'
              : 'bg-[#202c33] text-white rounded-bl-sm'
          }`}
        >
          <p className="text-[14.2px] leading-[19px] break-words whitespace-pre-wrap">
            {message.content}
          </p>
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[11px] text-gray-400">
              {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
