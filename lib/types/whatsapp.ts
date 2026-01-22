// ================================================================
// Types para WhatsApp Inbox + Evolution API v2
// ================================================================

export interface WhatsAppContact {
  id: string
  remote_jid: string // Ex: 552199999999@s.whatsapp.net
  name?: string
  push_name?: string
  profile_picture_url?: string
  is_group: boolean
  is_online?: boolean
  last_seen_at?: string | null
  is_typing?: boolean
  typing_updated_at?: string | null
  
  // Última mensagem
  last_message_content?: string
  last_message_timestamp?: string
  last_message_from_me?: boolean
  unread_count: number
  
  created_at: string
  updated_at: string
}

export interface WhatsAppMessage {
  id: string
  message_id?: string // ID da Evolution API
  remote_jid: string
  
  // Conteúdo
  content?: string
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact'
  media_url?: string
  caption?: string
  
  // Metadata
  from_me: boolean
  timestamp: string
  status?: 'sent' | 'delivered' | 'read' | 'error'
  
  raw_payload?: any
  created_at: string
}

export interface WhatsAppConversation extends WhatsAppContact {
  total_messages: number
}

// ================================================================
// Evolution API v2 Payloads
// ================================================================

export interface EvolutionMessagePayload {
  event: 'messages.upsert' | 'messages.update'
  instance: string
  data: {
    key: {
      remoteJid: string
      fromMe: boolean
      id: string
      participant?: string  // Para mensagens de grupo
    }
    pushName?: string
    message: {
      conversation?: string
      imageMessage?: {
        url?: string
        caption?: string
        mimetype?: string
      }
      videoMessage?: {
        url?: string
        caption?: string
        mimetype?: string
      }
      audioMessage?: {
        url?: string
        mimetype?: string
      }
      documentMessage?: {
        url?: string
        caption?: string
        mimetype?: string
        fileName?: string
      }
      stickerMessage?: {
        url?: string
      }
      locationMessage?: {
        degreesLatitude?: number
        degreesLongitude?: number
      }
      contactMessage?: {
        displayName?: string
        vcard?: string
      }
      extendedTextMessage?: {
        text?: string
      }
    }
    messageType: string
    messageTimestamp: number
    status?: string
  }
}

export interface EvolutionContactPayload {
  remoteJid: string
  pushName?: string
  profilePictureUrl?: string
}

// Response do endpoint /chat/findMessages
export interface EvolutionFindMessagesResponse {
  messages: Array<{
    key: {
      remoteJid: string
      fromMe: boolean
      id: string
    }
    pushName?: string
    message: any
    messageType: string
    messageTimestamp: number
  }>
  hasMore: boolean
  nextCursor?: string
}

// ================================================================
// Helper Types
// ================================================================

export interface CreateMessageInput {
  message_id?: string
  remote_jid: string
  content?: string
  message_type: WhatsAppMessage['message_type']
  media_url?: string
  caption?: string
  from_me: boolean
  timestamp: string
  status?: WhatsAppMessage['status']
  raw_payload?: any
}

export interface UpdateContactInput {
  remote_jid: string
  name?: string
  push_name?: string
  profile_picture_url?: string
  is_group?: boolean
  is_online?: boolean
  last_seen_at?: string | null
  is_typing?: boolean
  typing_updated_at?: string | null
}
