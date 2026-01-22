// ================================================================
// WhatsApp Sync Service - Buscar Histórico da Evolution API
// ================================================================
// Consome o endpoint /chat/findMessages para popular banco de dados
// com conversas antigas (backfill)
// ================================================================

import type { CreateMessageInput } from './types/whatsapp'
import { bulkInsertMessages, upsertWhatsAppContact } from './whatsapp-db'

interface EvolutionSyncConfig {
  apiUrl: string // Ex: https://sua-evolution-api.com
  apiKey: string
  instanceName: string
}

function normalizeRemoteJid(remoteJid: string, remoteJidAlt?: string | null) {
  if (remoteJid?.endsWith('@lid') && remoteJidAlt) {
    return remoteJidAlt
  }

  return remoteJid
}

/**
 * Busca mensagens de uma conversa específica
 */
export async function syncConversationHistory(
  config: EvolutionSyncConfig,
  remoteJid: string,
  limit = 100
): Promise<number> {
  try {
    console.log(`🔄 Sincronizando histórico de ${remoteJid}...`)

    const url = `${config.apiUrl}/chat/findMessages/${config.instanceName}`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey
      },
      body: JSON.stringify({
        where: {
          key: {
            remoteJid
          }
        },
        limit
      })
    })

    if (!response.ok) {
      throw new Error(`Evolution API retornou ${response.status}: ${await response.text()}`)
    }

    const data = await response.json()
    const rawMessages = Array.isArray(data.messages)
      ? data.messages
      : (data.messages?.records || [])

    console.log(`📥 Encontradas ${rawMessages.length} mensagens`)

    if (rawMessages.length === 0) {
      return 0
    }

    // Converter para o formato do banco
    const messagesToInsert: CreateMessageInput[] = rawMessages.map((msg: any) => {
      const { content, media_url, caption, type } = extractMessageContent(
        msg.message,
        msg.messageType
      )
      const fromMeValue = msg.key?.fromMe
      const fromMeBoolean =
        fromMeValue === true ||
        fromMeValue === 'true' ||
        fromMeValue === 1 ||
        fromMeValue === '1'
      const normalizedRemoteJid = normalizeRemoteJid(
        msg.key.remoteJid,
        msg.key.remoteJidAlt
      )

      return {
        message_id: msg.key.id,
        remote_jid: normalizedRemoteJid,
        content,
        message_type: type,
        media_url,
        caption,
        from_me: fromMeBoolean,
        timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
        raw_payload: msg
      }
    })

    // Inserir em lote
    const inserted = await bulkInsertMessages(messagesToInsert)

    console.log(`✅ ${inserted} mensagens sincronizadas para ${remoteJid}`)

    return inserted

  } catch (error) {
    console.error(`❌ Erro ao sincronizar ${remoteJid}:`, error)
    throw error
  }
}

/**
 * Busca todas as conversas (chats) da instância
 */
export async function getAllChats(config: EvolutionSyncConfig) {
  try {
    const url = `${config.apiUrl}/chat/findChats/${config.instanceName}`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': config.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      throw new Error(`Evolution API retornou ${response.status}`)
    }

    const data = await response.json()
    return Array.isArray(data) ? data : (data?.records || [])

  } catch (error) {
    console.error('❌ Erro ao buscar chats:', error)
    throw error
  }
}

/**
 * Sincroniza TODAS as conversas da instância (backfill completo)
 */
export async function syncAllConversations(
  config: EvolutionSyncConfig,
  messagesPerChat = 100
): Promise<{ totalChats: number; totalMessages: number }> {
  try {
    console.log('🚀 Iniciando sincronização completa...')

    // 1. Buscar todas as conversas
    const chats = await getAllChats(config)
    console.log(`📋 Encontrados ${chats.length} chats`)
    const normalizedChats = new Map<string, any>()

    chats.forEach((chat: any) => {
      const normalizedRemoteJid = normalizeRemoteJid(
        chat.remoteJid,
        chat.lastMessage?.key?.remoteJidAlt
      )
      if (!normalizedChats.has(normalizedRemoteJid)) {
        normalizedChats.set(normalizedRemoteJid, chat)
      }
    })

    let totalMessages = 0

    // 2. Sincronizar cada conversa
    for (const [remoteJid, chat] of normalizedChats.entries()) {

      // Criar/atualizar contato
      await upsertWhatsAppContact({
        remote_jid: remoteJid,
        name: chat.name || chat.pushName,
        push_name: chat.pushName,
        profile_picture_url: chat.profilePicUrl || chat.profilePictureUrl,
        is_group: remoteJid.includes('@g.us')
      })

      // Sincronizar mensagens
      try {
        const syncedMessages = await syncConversationHistory(
          config,
          remoteJid,
          messagesPerChat
        )
        totalMessages += syncedMessages

        // Aguardar um pouco para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`⚠️ Falha ao sincronizar ${remoteJid}:`, error)
        // Continuar com próximo chat
      }
    }

    console.log('✅ Sincronização completa finalizada!')
    console.log(`📊 Total: ${chats.length} chats, ${totalMessages} mensagens`)

    return {
      totalChats: chats.length,
      totalMessages
    }

  } catch (error) {
    console.error('❌ Erro na sincronização completa:', error)
    throw error
  }
}

/**
 * Helper para extrair conteúdo (mesmo do webhook)
 */
function extractMessageContent(message: any, messageType: string) {
  let content: string | undefined
  let media_url: string | undefined
  let caption: string | undefined
  let type: CreateMessageInput['message_type'] = 'text'

  if (message.conversation) {
    content = message.conversation
    type = 'text'
  } else if (message.extendedTextMessage?.text) {
    content = message.extendedTextMessage.text
    type = 'text'
  } else if (message.imageMessage) {
    media_url = message.imageMessage.url
    caption = message.imageMessage.caption
    content = caption || '[Imagem]'
    type = 'image'
  } else if (message.videoMessage) {
    media_url = message.videoMessage.url
    caption = message.videoMessage.caption
    content = caption || '[Vídeo]'
    type = 'video'
  } else if (message.audioMessage) {
    media_url = message.audioMessage.url
    content = '[Áudio]'
    type = 'audio'
  } else if (message.documentMessage) {
    media_url = message.documentMessage.url
    caption = message.documentMessage.caption
    content = message.documentMessage.fileName || '[Documento]'
    type = 'document'
  } else if (message.stickerMessage) {
    media_url = message.stickerMessage.url
    content = '[Sticker]'
    type = 'sticker'
  } else if (message.locationMessage) {
    content = `📍 Localização`
    type = 'location'
  } else if (message.contactMessage) {
    content = `👤 Contato: ${message.contactMessage.displayName || 'Sem nome'}`
    type = 'contact'
  } else {
    content = `[${messageType}]`
  }

  return { content, media_url, caption, type }
}

/**
 * Busca foto de perfil de um contato
 */
export async function getProfilePicture(
  config: EvolutionSyncConfig,
  remoteJid: string
): Promise<string | null> {
  try {
    const url = `${config.apiUrl}/chat/getProfilePicUrl/${config.instanceName}`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey
      },
      body: JSON.stringify({
        number: remoteJid.replace('@s.whatsapp.net', '')
      })
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.profilePictureUrl || null

  } catch (error) {
    console.error('⚠️ Erro ao buscar foto de perfil:', error)
    return null
  }
}
