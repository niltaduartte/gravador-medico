// ================================================================
// WEBHOOK: Evolution API v2 - MESSAGES_UPSERT
// ================================================================
// Endpoint: POST /api/webhooks/whatsapp
// Recebe eventos de mensagens da Evolution API e salva no banco
// ================================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  upsertWhatsAppMessage,
  upsertWhatsAppContact,
  messageExists,
  updateWhatsAppMessageStatus,
  updateWhatsAppContactPresence
} from '@/lib/whatsapp-db'
import type { EvolutionMessagePayload, CreateMessageInput } from '@/lib/types/whatsapp'

// ================================================================
// Mapear status da Evolution API para nosso schema
// ================================================================
function mapEvolutionStatus(evolutionStatus?: string): 'sent' | 'delivered' | 'read' | 'error' | undefined {
  if (!evolutionStatus) return undefined
  
  const status = evolutionStatus.toUpperCase()
  
  if (status === 'PENDING' || status === 'SENT') return 'sent'
  if (status === 'SERVER_ACK' || status === 'DELIVERY_ACK') return 'delivered'
  if (status === 'READ' || status === 'PLAYED') return 'read'
  if (status === 'ERROR' || status === 'FAILED') return 'error'
  
  return 'sent' // default
}

function normalizeRemoteJid(remoteJid: string, remoteJidAlt?: string | null) {
  if (remoteJid?.endsWith('@lid') && remoteJidAlt) {
    return remoteJidAlt
  }

  return remoteJid
}

function normalizeFromMeValue(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function shouldForwardToN8n(payload: EvolutionMessagePayload) {
  const eventName = (payload as any)?.event?.toLowerCase()
  if (eventName !== 'messages.upsert' && eventName !== 'messages_upsert') return false
  const fromMeValue = (payload as any)?.data?.key?.fromMe
  if (fromMeValue === undefined || fromMeValue === null) return false
  return !normalizeFromMeValue(fromMeValue)
}

async function forwardToN8n(payload: EvolutionMessagePayload) {
  const n8nUrl =
    process.env.N8N_WEBHOOK_URL ||
    'https://n8n-production-3342.up.railway.app/webhook/whatsapp'

  if (!n8nUrl) return

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.warn(`⚠️ [N8N] Forward falhou (HTTP ${response.status})`)
    } else {
      console.log('✅ [N8N] Forward enviado com sucesso')
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('⏱️ [N8N] Timeout ao encaminhar webhook')
    } else {
      console.warn('⚠️ [N8N] Erro ao encaminhar webhook:', error)
    }
  }
}

function extractMessageStatusUpdate(payload: any) {
  const data = payload?.data
  const directKey = data?.key
  const arrayKey = Array.isArray(data) ? data[0]?.key : null
  const nestedKey = data?.message?.key || data?.messageKey || data?.keys?.[0]
  const key = directKey || arrayKey || nestedKey

  const rawStatus =
    data?.status ||
    data?.update?.status ||
    data?.updates?.[0]?.status ||
    data?.statuses?.[0]?.status ||
    null

  const rawMessageId =
    key?.id ||
    data?.keyId ||
    data?.messageId ||
    data?.id ||
    null

  const remoteJid = normalizeRemoteJid(
    key?.remoteJid || data?.remoteJid || data?.jid || '',
    key?.remoteJidAlt || data?.remoteJidAlt || null
  )

  return {
    messageId: rawMessageId,
    status: rawStatus,
    remoteJid: remoteJid || null
  }
}

function extractPresenceUpdate(payload: any) {
  const data = payload?.data || {}
  const presences = data?.presences
  let remoteJid =
    data?.remoteJid ||
    data?.id ||
    data?.jid ||
    data?.key?.remoteJid ||
    null

  let presence = data?.presence || null

  if (!presence && presences && typeof presences === 'object') {
    const keys = Object.keys(presences)
    if (!remoteJid && keys.length > 0) {
      remoteJid = keys[0]
    }
    presence = presences[remoteJid || keys[0]]
  }

  const presenceState =
    presence?.lastKnownPresence ||
    presence?.presence ||
    presence?.state ||
    data?.presence ||
    data?.state ||
    null

  const lastSeenValue =
    presence?.lastSeen ||
    presence?.lastSeenTimestamp ||
    data?.lastSeen ||
    data?.lastSeenTimestamp ||
    null

  let lastSeenAt: string | undefined
  if (typeof lastSeenValue === 'number') {
    const ts = lastSeenValue < 1e12 ? lastSeenValue * 1000 : lastSeenValue
    lastSeenAt = new Date(ts).toISOString()
  } else if (typeof lastSeenValue === 'string') {
    const parsed = Date.parse(lastSeenValue)
    if (!Number.isNaN(parsed)) {
      lastSeenAt = new Date(parsed).toISOString()
    }
  }

  const presenceValue = typeof presenceState === 'string' ? presenceState.toLowerCase() : ''
  const isTyping =
    presenceValue === 'composing' ||
    presenceValue === 'recording' ||
    presenceValue === 'typing'
  const isOnline = isTyping || presenceValue === 'available' || presenceValue === 'online'

  return {
    remoteJid,
    isTyping,
    isOnline,
    lastSeenAt
  }
}

/**
 * Busca a foto de perfil do contato usando endpoint correto Evolution v2
 * 
 * ESTRATÉGIA DEFINITIVA (confirmada via fetchInstances):
 * 1. Tenta extrair do próprio payload da mensagem
 * 2. Usa POST /chat/findContacts/{instance} com body {number: xxx} (CONFIRMADO FUNCIONANDO)
 * 3. BUSCA O CONTATO ESPECÍFICO no array (não pega o primeiro)
 * 4. Se falhar, retorna null e NÃO TRAVA o processo
 * 
 * IMPORTANTE: 
 * - Body usa apenas o número (sem @s.whatsapp.net)
 * - Resposta é ARRAY - precisa encontrar o contato correto por remoteJid
 * - Campo da foto: "profilePicUrl" ou "profilePictureUrl"
 * - Mensagem SEMPRE será salva, mesmo sem foto
 */
async function fetchProfilePicture(
  remoteJid: string, 
  participant: string | undefined,
  messagePayload?: any
): Promise<string | null> {
  // Wrapper try-catch global para garantir que NUNCA trava
  try {
    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL
    const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY
    const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
      console.warn('⚠️ [DEBUG FOTO] Variáveis de ambiente não configuradas - salvando sem foto')
      return null
    }

    // ================================================================
    // ESTRATÉGIA 1: Verificar se a foto já vem no payload da mensagem
    // ================================================================
    if (messagePayload) {
      const photoFromPayload = 
        messagePayload.profilePictureUrl ||
        messagePayload.profilePicUrl ||
        messagePayload.picture ||
        messagePayload.imgUrl ||
        (messagePayload.pushName && messagePayload.profilePicture) ||
        null

      if (photoFromPayload) {
        console.log(`✅ [DEBUG FOTO] Encontrada no payload: ${photoFromPayload}`)
        return photoFromPayload
      }
    }

    // ================================================================
    // ESTRATÉGIA 2: POST /chat/findContacts (VALIDADO via terminal)
    // Body: {"number": "5521988960217"} (apenas número, sem @s.whatsapp.net)
    // Response: Array com campo profilePicUrl
    // CORREÇÃO: Identifica remetente correto (grupo usa participant)
    // ================================================================
    
    // 🎯 IDENTIFICAR REMETENTE CORRETO
    // Se for grupo (@g.us), usar participant
    // Se for privado (@s.whatsapp.net), usar remoteJid
    const isGroup = remoteJid.includes('@g.us')
    const actualSenderJid = isGroup && participant ? participant : remoteJid
    const phoneNumber = actualSenderJid.split('@')[0]
    
    const url = `${EVOLUTION_API_URL}/chat/findContacts/${EVOLUTION_INSTANCE_NAME}`
    const requestBody = { number: phoneNumber }
    
    console.log(`📸 Buscando foto: ${phoneNumber} (${isGroup ? 'grupo' : 'privado'})`)
    
    // Timeout de 5 segundos para não travar o webhook
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`❌ Erro ao buscar foto (HTTP ${response.status})`)
      return null
    }

    const data = await response.json()
    const contacts = Array.isArray(data) ? data : (data ? [data] : [])
    
    if (contacts.length === 0) {
      console.log(`⚠️ Nenhum contato retornado para ${phoneNumber}`)
      return null
    }
    
    // 🎯 BUSCAR CONTATO ESPECÍFICO (não pegar o primeiro!)
    const targetContact = contacts.find(c => c.remoteJid === actualSenderJid)
    
    if (!targetContact) {
      console.log(`⚠️ Contato ${actualSenderJid} não encontrado no array`)
      return null
    }
    
    const photoUrl = 
      targetContact.profilePicUrl ||
      targetContact.profilePictureUrl || 
      targetContact.picture ||
      targetContact.imgUrl ||
      null

    if (photoUrl && typeof photoUrl === 'string') {
      console.log(`✅ Foto encontrada: ${photoUrl.substring(0, 60)}...`)
      return photoUrl
    }

    return null
    
  } catch (error) {
    // CRÍTICO: Mesmo com erro, retorna null para não travar o webhook
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('⏱️ [DEBUG FOTO] Timeout ao buscar foto - continuando sem foto')
    } else {
      console.error('❌ [DEBUG FOTO] Erro ao buscar (não crítico - continuando):', error)
    }
    return null
  }
}

/**
 * Extrai conteúdo e tipo da mensagem do payload da Evolution API
 */
function extractMessageContent(message: any, messageType: string) {
  let content: string | undefined
  let media_url: string | undefined
  let caption: string | undefined
  let type: CreateMessageInput['message_type'] = 'text'

  // Texto simples
  if (message.conversation) {
    content = message.conversation
    type = 'text'
  }
  // Texto estendido (resposta, etc)
  else if (message.extendedTextMessage?.text) {
    content = message.extendedTextMessage.text
    type = 'text'
  }
  // Imagem
  else if (message.imageMessage) {
    media_url = message.imageMessage.url
    caption = message.imageMessage.caption
    content = caption || '[Imagem]'
    type = 'image'
  }
  // Vídeo
  else if (message.videoMessage) {
    media_url = message.videoMessage.url
    caption = message.videoMessage.caption
    content = caption || '[Vídeo]'
    type = 'video'
  }
  // Áudio
  else if (message.audioMessage) {
    media_url = message.audioMessage.url
    content = '[Áudio]'
    type = 'audio'
  }
  // Documento
  else if (message.documentMessage) {
    media_url = message.documentMessage.url
    caption = message.documentMessage.caption
    content = message.documentMessage.fileName || '[Documento]'
    type = 'document'
  }
  // Sticker
  else if (message.stickerMessage) {
    media_url = message.stickerMessage.url
    content = '[Sticker]'
    type = 'sticker'
  }
  // Localização
  else if (message.locationMessage) {
    content = `📍 Localização: ${message.locationMessage.degreesLatitude}, ${message.locationMessage.degreesLongitude}`
    type = 'location'
  }
  // Contato
  else if (message.contactMessage) {
    content = `👤 Contato: ${message.contactMessage.displayName || 'Sem nome'}`
    type = 'contact'
  }
  // Tipo desconhecido
  else {
    content = `[${messageType}]`
  }

  return { content, media_url, caption, type }
}

export async function POST(request: NextRequest) {
  try {
    const payload: EvolutionMessagePayload = await request.json()
    const eventName = (payload as any)?.event?.toLowerCase?.() || ''
    const dataKey = (payload as any)?.data?.key
    const dataMessageType = (payload as any)?.data?.messageType

    console.log('📥 Webhook recebido:', {
      event: payload.event,
      instance: payload.instance,
      remoteJid: dataKey?.remoteJid,
      fromMe: dataKey?.fromMe,
      messageType: dataMessageType,
      fullKey: dataKey
    })
    
    console.log('🔍 [DEBUG from_me] Valor recebido:', dataKey?.fromMe, typeof dataKey?.fromMe)

    // Atualizar status de mensagens (checks)
    if (eventName === 'messages.update' || eventName === 'messages_update') {
      const update = extractMessageStatusUpdate(payload)
      if (!update.messageId || !update.status) {
        return NextResponse.json({
          success: true,
          message: 'Atualizacao de status ignorada (dados insuficientes)'
        })
      }

      const mappedStatus = mapEvolutionStatus(update.status)
      if (!mappedStatus) {
        return NextResponse.json({
          success: true,
          message: 'Atualizacao de status ignorada (status invalido)'
        })
      }

      await updateWhatsAppMessageStatus(update.messageId, mappedStatus)

      return NextResponse.json({
        success: true,
        message: 'Status atualizado com sucesso'
      })
    }

    // Atualizar presenca (online, visto por ultimo, digitando)
    if (eventName === 'presence.update' || eventName === 'presence_update') {
      const presence = extractPresenceUpdate(payload)
      if (!presence.remoteJid) {
        return NextResponse.json({
          success: true,
          message: 'Presenca ignorada (remoteJid ausente)'
        })
      }

      const now = new Date().toISOString()
      await updateWhatsAppContactPresence({
        remote_jid: presence.remoteJid,
        is_online: presence.isOnline,
        last_seen_at: presence.lastSeenAt || now,
        is_typing: presence.isTyping,
        typing_updated_at: presence.isTyping ? now : null
      })

      return NextResponse.json({
        success: true,
        message: 'Presenca atualizada com sucesso'
      })
    }

    // Ignorar eventos que não são de mensagens
    if (eventName !== 'messages.upsert' && eventName !== 'messages_upsert') {
      return NextResponse.json({ 
        success: true, 
        message: 'Evento ignorado (não é messages.upsert)' 
      })
    }

    const { key, message, messageType, messageTimestamp, pushName, status } = payload.data
    const normalizedRemoteJid = normalizeRemoteJid(
      key.remoteJid,
      (key as any).remoteJidAlt
    )

    // Verificar se mensagem já existe (evitar duplicatas)
    const exists = await messageExists(key.id)
    if (exists) {
      console.log('⚠️ Mensagem já existe:', key.id)
      return NextResponse.json({ 
        success: true, 
        message: 'Mensagem já existe' 
      })
    }

    // Extrair conteúdo da mensagem
    const { content, media_url, caption, type } = extractMessageContent(message, messageType)

    // ================================================================
    // PASSO 1: Buscar foto de perfil (NÃO CRÍTICO - nunca trava)
    // Usa endpoint /chat/findContacts confirmado via teste curl
    // IMPORTANTE: Passa participant para identificar remetente em grupos
    // ================================================================
    const profilePictureUrl = await fetchProfilePicture(
      normalizedRemoteJid, 
      key.participant,  // Para mensagens de grupo
      payload.data
    )
    
    if (profilePictureUrl) {
      console.log(`✅ Foto obtida: ${profilePictureUrl.substring(0, 50)}...`)
    }

    // ================================================================
    // PASSO 2: UPSERT do contato PRIMEIRO (resolver FK constraint)
    // GARANTIA: Sempre salva o contato, mesmo sem foto
    // ================================================================
    try {
      await upsertWhatsAppContact({
        remote_jid: normalizedRemoteJid,
        push_name: pushName || undefined,
        profile_picture_url: profilePictureUrl || undefined,
        is_group: normalizedRemoteJid.includes('@g.us')
      })
      console.log(`✅ Contato salvo: ${normalizedRemoteJid}`)
    } catch (contactError) {
      console.error('❌ Erro ao salvar contato:', contactError)
      throw contactError
    }

    // ================================================================
    // PASSO 3: INSERT da mensagem (agora o FK existe)
    // ================================================================
    
    // 🔧 CORREÇÃO: Garantir que from_me seja boolean (pode vir como string ou outro tipo)
    const fromMeValue = (payload.data.key as any).fromMe
    const fromMeBoolean = fromMeValue === true || fromMeValue === 'true' || fromMeValue === 1
    
    console.log('🔍 [DEBUG CONVERSÃO] from_me original:', fromMeValue, typeof fromMeValue)
    console.log('🔍 [DEBUG CONVERSÃO] from_me convertido:', fromMeBoolean, typeof fromMeBoolean)
    
    const mappedStatus = mapEvolutionStatus(status) ?? (fromMeBoolean ? 'sent' : undefined)

    const messageInput: CreateMessageInput = {
      message_id: key.id,
      remote_jid: normalizedRemoteJid,
      content,
      message_type: type,
      media_url,
      caption,
      from_me: fromMeBoolean,
      timestamp: new Date(messageTimestamp * 1000).toISOString(),
      status: mappedStatus,
      raw_payload: payload.data
    }
    
    console.log('🔍 [DEBUG SAVE] Salvando mensagem com from_me:', messageInput.from_me, typeof messageInput.from_me)

    const savedMessage = await upsertWhatsAppMessage(messageInput)
    console.log(`✅ Mensagem salva: ${savedMessage.id}, from_me final: ${savedMessage.from_me}`)

    if (shouldForwardToN8n(payload)) {
      void forwardToN8n(payload)
    }

    return NextResponse.json({
      success: true,
      message: 'Mensagem processada com sucesso',
      messageId: savedMessage.id,
      hasProfilePicture: !!profilePictureUrl
    })

  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

// Permitir GET para health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    webhook: 'whatsapp-evolution-api-v2',
    timestamp: new Date().toISOString()
  })
}
