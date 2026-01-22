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

  if (error) {
    console.error('❌ Erro ao buscar conversas:', error)
    throw error
  }

  return data || []
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
    .order('timestamp', { ascending: true })
    .limit(limit)

  console.log('🔍 [getWhatsAppMessages] Resultado:', {
    total: data?.length,
    fromMe: data?.filter(m => m.from_me).length,
    fromThem: data?.filter(m => !m.from_me).length,
    error,
    firstMessage: data?.[0],
    lastMessage: data?.[data.length - 1]
  })

  if (error) {
    console.error('❌ Erro ao buscar mensagens:', error)
    throw error
  }

  return data || []
}

/**
 * Cria uma nova mensagem (ou atualiza se já existir pelo message_id)
 */
export async function upsertWhatsAppMessage(input: CreateMessageInput): Promise<WhatsAppMessage> {
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
      onConflict: 'message_id',
      ignoreDuplicates: true
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
