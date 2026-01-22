// ================================================================
// Message Bubble - Balão de mensagem (estilo WhatsApp)
// ================================================================

'use client'

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { WhatsAppMessage } from '@/lib/types/whatsapp'
import { CheckCheck, Check, Clock } from 'lucide-react'

interface MessageBubbleProps {
  message: WhatsAppMessage
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const rawFromMeValue = message?.raw_payload?.key?.fromMe as
    | boolean
    | string
    | number
    | undefined
    | null

  const rawFromMeNormalized =
    rawFromMeValue === true ||
    rawFromMeValue === 'true' ||
    rawFromMeValue === 1 ||
    rawFromMeValue === '1'

  const fromMeValue = message.from_me as unknown as boolean | string | number
  const fromMeNormalized =
    fromMeValue === true ||
    fromMeValue === 'true' ||
    fromMeValue === 1 ||
    fromMeValue === '1'

  const hasRawFromMe = rawFromMeValue !== undefined && rawFromMeValue !== null
  const isFromMe = hasRawFromMe ? rawFromMeNormalized : fromMeNormalized

  return (
    <div
      className={`flex mb-2 ${isFromMe ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[65%] px-2 py-1.5 rounded-md shadow-sm ${
          isFromMe
            ? 'bg-[#005c4b] text-white rounded-br-sm'
            : 'bg-[#202c33] text-white rounded-bl-sm'
        }`}
      >
        {/* Mídia (se houver) */}
        {message.media_url && (
          <MessageMedia
            type={message.message_type}
            url={message.media_url}
            caption={message.caption}
          />
        )}

        {/* Conteúdo de texto */}
        {message.content && (
          <p className="text-[14.2px] whitespace-pre-wrap break-words leading-[19px]">
            {message.content}
          </p>
        )}

        {/* Timestamp + Status */}
        <div className="flex items-center justify-end gap-1 mt-1">
          <span
            className={`text-[11px] ${
              isFromMe ? 'text-gray-300' : 'text-gray-400'
            }`}
          >
            {format(new Date(message.timestamp), 'HH:mm', { locale: ptBR })}
          </span>

          {isFromMe && <MessageStatus status={message.status} />}
        </div>
      </div>
    </div>
  )
}

/**
 * Renderiza mídia (imagem, vídeo, etc)
 */
function MessageMedia({
  type,
  url,
  caption
}: {
  type: WhatsAppMessage['message_type']
  url: string
  caption?: string
}) {
  if (type === 'image') {
    return (
      <div className="mb-2">
        <img
          src={url}
          alt={caption || 'Imagem'}
          className="rounded-lg max-w-full h-auto"
        />
      </div>
    )
  }

  if (type === 'video') {
    return (
      <div className="mb-2">
        <video controls className="rounded-lg max-w-full">
          <source src={url} />
        </video>
      </div>
    )
  }

  if (type === 'audio') {
    return (
      <div className="mb-2">
        <audio controls className="w-full">
          <source src={url} />
        </audio>
      </div>
    )
  }

  if (type === 'document') {
    return (
      <div className="mb-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm underline"
        >
          📄 {caption || 'Documento'}
        </a>
      </div>
    )
  }

  if (type === 'sticker') {
    return (
      <div className="mb-2">
        <img
          src={url}
          alt="Sticker"
          className="w-32 h-32 object-contain"
        />
      </div>
    )
  }

  return null
}

/**
 * Ícone de status da mensagem (enviada, entregue, lida)
 */
function MessageStatus({ status }: { status?: WhatsAppMessage['status'] }) {
  if (status === 'read') {
    return <CheckCheck className="w-4 h-4 text-[#53bdeb]" />
  }

  if (status === 'delivered') {
    return <CheckCheck className="w-4 h-4 text-gray-300" />
  }

  if (status === 'sent') {
    return <Check className="w-4 h-4 text-gray-300" />
  }

  // Pendente
  return <Clock className="w-4 h-4 text-gray-400" />
}
