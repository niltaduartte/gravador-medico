// ================================================================
// WhatsApp Database Functions (Supabase)
// ================================================================

import { supabaseAdmin } from './supabase'
import type {
  WhatsAppContact,
  WhatsAppMessage,
  WhatsAppConversation,
  CreateMessageInput,
  UpdateContactInput
} from './types/whatsapp'

// ================================================================
// CONTACTS
// ================================================================

/**
 * Busca todos os contatos/conversas ordenados pela última mensagem
 */
export async function getWhatsAppConversations(): Promise<WhatsAppConversation[]> {
  console.log('🔍 [getWhatsAppConversations] Buscando conversas...')
  
  const { data, error } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('*')
    .order('last_message_timestamp', { ascending: false, nullsFirst: false })

  console.log('🔍 [getWhatsAppConversations] Resultado:', {
    total: data?.length,
    hasError: !!error,
    error
  })

  if (!error) {
    return data || []
  }

  console.warn('⚠️ View whatsapp_conversations indisponível, usando whatsapp_contacts.', error)

  const { data: contacts, error: contactsError } = await supabaseAdmin
    .from('whatsapp_contacts')
    .select('*')
    .order('last_message_timestamp', { ascending: false, nullsFirst: false })

  if (contactsError) {
    console.error('❌ Erro ao buscar contatos:', contactsError)
    throw contactsError
  }

  return (contacts || []).map((contact) => ({
    ...contact,
    total_messages: 0
  }))
}

/**
 * Busca um contato específico por remoteJid
 */
export async function getWhatsAppContact(remoteJid: string): Promise<WhatsAppContact | null> {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_contacts')
    .select('*')
    .eq('remote_jid', remoteJid)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // Não encontrado
      return null
    }
    console.error('❌ Erro ao buscar contato:', error)
    throw error
  }

  return data
}

/**
 * Cria ou atualiza um contato
 */
export async function upsertWhatsAppContact(input: UpdateContactInput): Promise<WhatsAppContact> {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_contacts')
    .upsert(
      {
        remote_jid: input.remote_jid,
        name: input.name,
        push_name: input.push_name,
        profile_picture_url: input.profile_picture_url,
        is_group: input.is_group || false
      },
      {
        onConflict: 'remote_jid',
        ignoreDuplicates: false
      }
    )
    .select()
    .single()

  if (error) {
    console.error('❌ Erro ao upsert contato:', error)
    throw error
  }

  return data
}

/**
 * Marca todas as mensagens de um contato como lidas (zera unread_count)
 */
export async function markConversationAsRead(remoteJid: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('whatsapp_contacts')
    .update({ unread_count: 0 })
    .eq('remote_jid', remoteJid)

  if (error) {
    console.error('❌ Erro ao marcar conversa como lida:', error)
    throw error
  }
}

// ================================================================
// MESSAGES
// ================================================================

/**
 * Busca todas as mensagens de uma conversa
 */
export async function getWhatsAppMessages(
  remoteJid: string,
  limit = 100
): Promise<WhatsAppMessage[]> {
  console.log('🔍 [getWhatsAppMessages] Buscando mensagens para:', remoteJid)
  
  const { data, error } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('*')
    .eq('remote_jid', remoteJid)
    .order('timestamp', { ascending: false })
    .limit(limit)

  const ordered = (data || []).slice().reverse()

  console.log('🔍 [getWhatsAppMessages] Resultado:', {
    total: ordered.length,
    fromMe: ordered.filter(m => m.from_me).length,
    fromThem: ordered.filter(m => !m.from_me).length,
    error,
    firstMessage: ordered[0],
    lastMessage: ordered[ordered.length - 1]
  })

  if (error) {
    console.error('❌ Erro ao buscar mensagens:', error)
    throw error
  }

  return ordered
}

/**
 * Cria uma nova mensagem (ou atualiza se já existir pelo message_id)
 */
export async function upsertWhatsAppMessage(input: CreateMessageInput): Promise<WhatsAppMessage> {
  console.log('💾 [upsertWhatsAppMessage] Recebendo input:', {
    message_id: input.message_id,
    from_me: input.from_me,
    content: input.content?.substring(0, 50)
  })
  
  const { data, error } = await supabaseAdmin
    .from('whatsapp_messages')
    .upsert(
      {
        message_id: input.message_id,
        remote_jid: input.remote_jid,
        content: input.content,
        message_type: input.message_type,
        media_url: input.media_url,
        caption: input.caption,
        from_me: input.from_me,
        timestamp: input.timestamp,
        status: input.status,
        raw_payload: input.raw_payload
      },
      {
        onConflict: 'message_id',
        ignoreDuplicates: false
      }
    )
    .select()
    .single()

  if (error) {
    console.error('❌ Erro ao upsert mensagem:', error)
    throw error
  }

  console.log('💾 [upsertWhatsAppMessage] Mensagem salva no banco:', {
    id: data.id,
    from_me: data.from_me,
    message_id: data.message_id
  })

  return data
}

/**
 * Verifica se uma mensagem já existe
 */
export async function messageExists(messageId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('message_id', messageId)

  if (error) {
    console.error('❌ Erro ao verificar mensagem:', error)
    return false
  }

  return (count || 0) > 0
}

/**
 * Atualiza o status de uma mensagem (checks)
 */
export async function updateWhatsAppMessageStatus(
  messageId: string,
  status: WhatsAppMessage['status']
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('whatsapp_messages')
    .update({ status })
    .eq('message_id', messageId)

  if (error) {
    console.error('❌ Erro ao atualizar status da mensagem:', error)
    throw error
  }
}

/**
 * Atualiza presenca do contato (online, visto por ultimo, digitando)
 */
export async function updateWhatsAppContactPresence(input: {
  remote_jid: string
  is_online?: boolean
  last_seen_at?: string | null
  is_typing?: boolean
  typing_updated_at?: string | null
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('whatsapp_contacts')
    .upsert(
      {
        remote_jid: input.remote_jid,
        is_online: input.is_online,
        last_seen_at: input.last_seen_at,
        is_typing: input.is_typing,
        typing_updated_at: input.typing_updated_at
      },
      { onConflict: 'remote_jid', ignoreDuplicates: false }
    )

  if (error) {
    console.error('❌ Erro ao atualizar presenca do contato:', error)
    throw error
  }
}

/**
 * Busca as últimas N mensagens globais (todas as conversas)
 */
export async function getRecentMessages(limit = 50): Promise<WhatsAppMessage[]> {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('❌ Erro ao buscar mensagens recentes:', error)
    throw error
  }

  return data || []
}

// ================================================================
// BULK OPERATIONS (Para sync histórico)
// ================================================================

/**
 * Insere múltiplas mensagens de uma vez (para backfill)
 */
export async function bulkInsertMessages(messages: CreateMessageInput[]): Promise<number> {
  if (messages.length === 0) return 0

  const { data, error } = await supabaseAdmin
    .from('whatsapp_messages')
    .upsert(messages, {
      onConflict: 'message_id'
    })
    .select()

  if (error) {
    console.error('❌ Erro ao inserir mensagens em lote:', error)
    throw error
  }

  return data?.length || 0
}

/**
 * Retorna estatísticas do inbox
 */
export async function getWhatsAppStats() {
  const [contactsResult, messagesResult, unreadResult] = await Promise.all([
    supabaseAdmin
      .from('whatsapp_contacts')
      .select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('whatsapp_messages')
      .select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('whatsapp_contacts')
      .select('unread_count')
  ])

  const totalUnread = unreadResult.data?.reduce((sum, c) => sum + (c.unread_count || 0), 0) || 0

  return {
    totalContacts: contactsResult.count || 0,
    totalMessages: messagesResult.count || 0,
    totalUnread
  }
}
