import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from './supabase'
import { sendPurchaseEvent } from './meta-capi'
import { 
  createLovableUser, 
  generateSecurePassword 
} from '@/services/lovable-integration'

interface AppmaxWebhookResult {
  response: NextResponse
}

const EVENT_STATUS_MAP: Record<string, { status: string; failure_reason?: string }> = {
  // Eventos da API
  'order.approved': { status: 'approved' },
  'order.paid': { status: 'paid' },
  'order.pending': { status: 'pending' },
  'order.rejected': { status: 'refused', failure_reason: 'Pedido recusado' },
  'order.cancelled': { status: 'cancelled', failure_reason: 'Pedido cancelado' },
  'order.refunded': { status: 'refunded', failure_reason: 'Estornado' },
  'pix.generated': { status: 'pending' },
  'pix.paid': { status: 'paid' },
  'pix.expired': { status: 'expired', failure_reason: 'PIX expirado' },
  // Eventos Appmax (normalizados)
  'pedido aprovado': { status: 'approved' },
  'pedido autorizado': { status: 'approved' },
  'pedido pago': { status: 'paid' },
  'pedido pendente de integracao': { status: 'pending' },
  'pedido integrado': { status: 'approved' },
  'pedido autorizado com atraso (60min)': { status: 'approved', failure_reason: 'Autorizado com atraso (60min)' },
  'pagamento nao autorizado': { status: 'refused', failure_reason: 'Pagamento nao autorizado' },
  'pagamento nao autorizado com atraso (60min)': { status: 'refused', failure_reason: 'Pagamento nao autorizado (60min)' },
  'boleto gerado': { status: 'pending' },
  'pedido com boleto vencido': { status: 'expired', failure_reason: 'Boleto vencido' },
  'pix gerado': { status: 'pending' },
  'pix pago': { status: 'paid' },
  'pix expirado': { status: 'expired', failure_reason: 'PIX expirado' },
  'pedido estornado': { status: 'refunded', failure_reason: 'Estornado' },
  'pedido chargeback em tratamento': { status: 'chargeback', failure_reason: 'Chargeback em analise' },
  'pedido chargeback ganho': { status: 'approved' },
  'upsell pago': { status: 'paid' },
  // Status de Análise Antifraude (NOVO)
  'analise antifraude': { status: 'fraud_analysis' },
  'análise antifraude': { status: 'fraud_analysis' },
  'order.fraud_analysis': { status: 'fraud_analysis' },
  'pendente': { status: 'fraud_analysis' } // Cartão de crédito pendente = análise antifraude
}

const SUCCESS_STATUSES = new Set(['approved', 'paid', 'completed'])
const FAILED_STATUSES = new Set(['refused', 'rejected', 'cancelled', 'expired', 'failed', 'chargeback'])
const PENDING_STATUSES = new Set(['pending', 'fraud_analysis']) // NOVO: Inclui análise antifraude

const STATUS_ALIASES: Record<string, { status: string; failure_reason?: string }> = {
  approved: { status: 'approved' },
  paid: { status: 'paid' },
  completed: { status: 'completed' },
  aprovado: { status: 'approved' },
  pago: { status: 'paid' },
  autorizado: { status: 'approved' },
  pending: { status: 'pending' },
  pendente: { status: 'pending' },
  processing: { status: 'pending' },
  // Análise Antifraude (NOVO)
  fraud_analysis: { status: 'fraud_analysis' },
  analyzing_fraud: { status: 'fraud_analysis' },
  'analise antifraude': { status: 'fraud_analysis' },
  'análise antifraude': { status: 'fraud_analysis' },
  // Falhas
  refused: { status: 'refused', failure_reason: 'Pagamento recusado' },
  rejected: { status: 'refused', failure_reason: 'Pagamento recusado' },
  failed: { status: 'refused', failure_reason: 'Pagamento recusado' },
  'nao autorizado': { status: 'refused', failure_reason: 'Pagamento nao autorizado' },
  payment_not_authorized: { status: 'refused', failure_reason: 'Pagamento nao autorizado' },
  cancelled: { status: 'cancelled', failure_reason: 'Pedido cancelado' },
  canceled: { status: 'cancelled', failure_reason: 'Pedido cancelado' },
  cancelado: { status: 'cancelled', failure_reason: 'Pedido cancelado' },
  expired: { status: 'expired', failure_reason: 'Expirado' },
  expirado: { status: 'expired', failure_reason: 'Expirado' },
  'boleto vencido': { status: 'expired', failure_reason: 'Boleto vencido' },
  'pix expirado': { status: 'expired', failure_reason: 'PIX expirado' },
  refunded: { status: 'refunded', failure_reason: 'Estornado' },
  estornado: { status: 'refunded', failure_reason: 'Estornado' },
  chargeback: { status: 'chargeback', failure_reason: 'Chargeback' }
}

function normalizeEventName(value?: string) {
  if (!value) return ''
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function normalizeSignature(signature: string) {
  return signature.startsWith('sha256=') ? signature.slice(7) : signature
}

function safeCompareSignature(a: string, b: string) {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) {
    return false
  }
  return crypto.timingSafeEqual(aBuf, bBuf)
}

function resolveStatus(event?: string, status?: string) {
  const normalizedEvent = normalizeEventName(event)
  if (normalizedEvent && EVENT_STATUS_MAP[normalizedEvent]) {
    return EVENT_STATUS_MAP[normalizedEvent]
  }

  if (!status) {
    return null
  }

  const normalized = normalizeEventName(status)
  if (STATUS_ALIASES[normalized]) {
    return STATUS_ALIASES[normalized]
  }

  return { status: normalized }
}

function extractEventType(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null
  return (
    payload.event ||
    payload.type ||
    payload?.event_type ||
    payload?.data?.event ||
    payload?.data?.type ||
    payload?.data?.event_type ||
    null
  )
}

async function logWebhook(params: {
  endpoint: string
  payload: any
  response_status: number
  processing_time_ms: number
  event_type?: string | null
  ip_address?: string | null
  user_agent?: string | null
  error?: string
}) {
  try {
    const now = new Date().toISOString()
    const resolvedEventType = params.event_type || extractEventType(params.payload)
    const baseObject =
      params.payload && typeof params.payload === 'object'
        ? params.payload
        : { raw: params.payload }
    const enrichedPayload = {
      ...baseObject,
      _meta: {
        endpoint: params.endpoint,
        response_status: params.response_status,
        processing_time_ms: params.processing_time_ms,
        error: params.error || null,
        logged_at: now
      }
    }

    const basePayload: Record<string, any> = {
      source: 'appmax',
      event_type: resolvedEventType,
      ip_address: params.ip_address || null,
      user_agent: params.user_agent || null,
      payload: enrichedPayload,
      processed: true,
      success: params.response_status < 400,
      error_message: params.error || null,
      processed_at: now
    }

    let { error } = await supabaseAdmin.from('webhooks_logs').insert(basePayload)

    if (error) {
      const compactPayload: Record<string, any> = {
        payload: enrichedPayload
      }
      if (resolvedEventType) {
        compactPayload.event_type = resolvedEventType
      }
      compactPayload.source = 'appmax'
      compactPayload.processed = true
      compactPayload.success = params.response_status < 400
      if (params.error) {
        compactPayload.error_message = params.error
      }
      compactPayload.processed_at = now

      const fallback = await supabaseAdmin.from('webhooks_logs').insert(compactPayload)
      error = fallback.error
    }

    if (error) {
      await supabaseAdmin.from('webhooks_logs').insert({
        payload: enrichedPayload
      })
    }
  } catch (error) {
    console.warn('⚠️ Falha ao registrar webhook:', error)
  }
}

async function updateCheckoutAttempt(params: {
  orderId?: string | null
  customerEmail?: string | null
  customerName?: string | null
  totalAmount: number
  paymentMethod?: string | null
  status: string
  saleId?: string | null
  failureReason?: string | null
}) {
  const now = new Date().toISOString()
  const isSuccess = SUCCESS_STATUSES.has(params.status)
  const isFailed = FAILED_STATUSES.has(params.status)

  const updateData: Record<string, any> = {
    status: params.status,
    failure_reason: params.failureReason || null,
    total_amount: params.totalAmount,
    payment_method: params.paymentMethod || null,
    recovery_status: isSuccess ? 'recovered' : isFailed ? 'abandoned' : 'pending',
    converted_at: isSuccess ? now : null,
    abandoned_at: isFailed ? now : null,
    sale_id: params.saleId || null,
    metadata: {
      appmax_order_id: params.orderId || null,
      failure_reason: params.failureReason || null,
      updated_by: 'webhook'
    },
    updated_at: now
  }

  let updated = false

  const runUpdate = async (filters: { appmax_order_id?: string; customer_email?: string }) => {
    let query = supabaseAdmin.from('checkout_attempts').update(updateData)

    if (filters.appmax_order_id) {
      query = query.eq('appmax_order_id', filters.appmax_order_id)
    }
    if (filters.customer_email) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      query = query.eq('customer_email', filters.customer_email).in('status', ['pending', 'abandoned']).gte('created_at', since)
    }

    let { data, error } = await query.select('id')

    if (error && (error.message?.includes('total_amount') || error.message?.includes('failure_reason'))) {
      const fallbackData = { ...updateData }
      if (error.message?.includes('total_amount')) {
        delete fallbackData.total_amount
      }
      if (error.message?.includes('failure_reason')) {
        delete fallbackData.failure_reason
      }

      let fallbackQuery = supabaseAdmin.from('checkout_attempts').update(fallbackData)
      if (filters.appmax_order_id) {
        fallbackQuery = fallbackQuery.eq('appmax_order_id', filters.appmax_order_id)
      }
      if (filters.customer_email) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        fallbackQuery = fallbackQuery.eq('customer_email', filters.customer_email).in('status', ['pending', 'abandoned']).gte('created_at', since)
      }

      const fallbackResult = await fallbackQuery.select('id')
      data = fallbackResult.data
      error = fallbackResult.error
    }

    return { data, error }
  }

  if (params.orderId) {
    const { data, error } = await runUpdate({ appmax_order_id: params.orderId })
    if (!error && data?.length) {
      updated = true
    } else if (error && !error.message?.includes('appmax_order_id')) {
      console.warn('⚠️ Erro ao atualizar checkout_attempts por order_id:', error)
    }
  }

  if (!updated && params.customerEmail) {
    const { data, error } = await runUpdate({ customer_email: params.customerEmail })
    if (!error && data?.length) {
      updated = true
    } else if (error) {
      console.warn('⚠️ Erro ao atualizar checkout_attempts por email:', error)
    }
  }

  if (!updated && params.customerEmail) {
    const insertData: Record<string, any> = {
      session_id: params.orderId ? `order_${params.orderId}` : `webhook_${Date.now()}`,
      customer_email: params.customerEmail,
      customer_name: params.customerName || null,
      cart_items: [],
      cart_total: params.totalAmount,
      total_amount: params.totalAmount,
      appmax_order_id: params.orderId || null,
      payment_method: params.paymentMethod || null,
      status: params.status,
      failure_reason: params.failureReason || null,
      recovery_status: isSuccess ? 'recovered' : isFailed ? 'abandoned' : 'pending',
      converted_at: isSuccess ? now : null,
      abandoned_at: isFailed ? now : null,
      metadata: {
        appmax_order_id: params.orderId || null,
        failure_reason: params.failureReason || null,
        created_by: 'webhook'
      }
    }

    let { error } = await supabaseAdmin.from('checkout_attempts').insert(insertData)
    if (error && (
      error.message?.includes('total_amount') ||
      error.message?.includes('appmax_order_id') ||
      error.message?.includes('failure_reason')
    )) {
      const fallbackData = { ...insertData }
      if (error.message?.includes('total_amount')) {
        delete fallbackData.total_amount
      }
      if (error.message?.includes('appmax_order_id')) {
        delete fallbackData.appmax_order_id
      }
      if (error.message?.includes('failure_reason')) {
        delete fallbackData.failure_reason
      }

      const fallbackResult = await supabaseAdmin.from('checkout_attempts').insert(fallbackData)
      error = fallbackResult.error
    }
    if (error) {
      console.warn('⚠️ Erro ao inserir checkout_attempts via webhook:', error)
    }
  }
}

export async function handleAppmaxWebhook(request: NextRequest, endpoint: string): Promise<AppmaxWebhookResult> {
  const startTime = Date.now()
  const secret = process.env.APPMAX_WEBHOOK_SECRET
  const signatureHeader = request.headers.get('x-appmax-signature') || ''
  const timestampHeader = request.headers.get('x-appmax-timestamp')
  const userAgent = request.headers.get('user-agent') || null
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  const rawBody = await request.text()

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch (error) {
    await logWebhook({
      endpoint,
      payload: rawBody,
      response_status: 400,
      processing_time_ms: Date.now() - startTime,
      ip_address: ipAddress,
      user_agent: userAgent,
      error: 'Payload inválido'
    })

    return { response: NextResponse.json({ error: 'Payload inválido' }, { status: 400 }) }
  }

  const eventName = extractEventType(payload)

  if (secret) {
    if (!signatureHeader) {
      await logWebhook({
        endpoint,
        payload,
        response_status: 401,
        processing_time_ms: Date.now() - startTime,
        event_type: eventName,
        ip_address: ipAddress,
        user_agent: userAgent,
        error: 'Assinatura ausente'
      })
      return { response: NextResponse.json({ error: 'Assinatura ausente' }, { status: 401 }) }
    }

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    const provided = normalizeSignature(signatureHeader)

    if (!safeCompareSignature(expected, provided)) {
      await logWebhook({
        endpoint,
        payload,
        response_status: 401,
        processing_time_ms: Date.now() - startTime,
        event_type: eventName,
        ip_address: ipAddress,
        user_agent: userAgent,
        error: 'Assinatura inválida'
      })
      return { response: NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 }) }
    }

    if (timestampHeader) {
      const timestampMs = Number(timestampHeader)
      const parsed = Number.isNaN(timestampMs) ? Date.parse(timestampHeader) : timestampMs * (timestampMs < 1e12 ? 1000 : 1)
      if (!Number.isNaN(parsed) && Math.abs(Date.now() - parsed) > 5 * 60 * 1000) {
        await logWebhook({
          endpoint,
          payload,
          response_status: 401,
          processing_time_ms: Date.now() - startTime,
          event_type: eventName,
          ip_address: ipAddress,
          user_agent: userAgent,
          error: 'Timestamp inválido'
        })
        return { response: NextResponse.json({ error: 'Timestamp inválido' }, { status: 401 }) }
      }
    }
  } else {
    console.warn('⚠️ APPMAX_WEBHOOK_SECRET não configurado - assinatura não validada')
  }

  if (eventName === 'test' && process.env.NODE_ENV !== 'production') {
    await logWebhook({
      endpoint,
      payload,
      response_status: 200,
      processing_time_ms: Date.now() - startTime,
      event_type: eventName,
      ip_address: ipAddress,
      user_agent: userAgent
    })
    return { response: NextResponse.json({ success: true, message: 'Teste recebido' }) }
  }

  const data = payload.data || payload
  const mapping = resolveStatus(eventName ?? undefined, data?.status || payload?.status)

  if (!mapping) {
    await logWebhook({
      endpoint,
      payload,
      response_status: 200,
      processing_time_ms: Date.now() - startTime,
      event_type: eventName,
      ip_address: ipAddress,
      user_agent: userAgent
    })
    return { response: NextResponse.json({ success: true, message: 'Evento ignorado' }) }
  }

  const status = mapping.status
  const failureReason = mapping.failure_reason

  const orderId = data.order_id || data.appmax_order_id || data.order?.id || payload.order_id || payload.appmax_order_id
  const customer = data.customer || payload.customer || {}
  const customerEmail = data.customer_email || payload.customer_email || customer.email || payload.email || null
  const customerName = data.customer_name || payload.customer_name || customer.name || (customerEmail ? customerEmail.split('@')[0] : null)
  const customerPhone = data.customer_phone || payload.customer_phone || customer.phone || null
  const customerCpf = data.customer_cpf || payload.customer_cpf || customer.cpf || null
  const totalAmount = Number(
    data.total_amount ||
    data.amount ||
    data.total ||
    payload.total_amount ||
    payload.amount ||
    0
  )
  const paymentMethod = data.payment_method || payload.payment_method || null

  await logWebhook({
    endpoint,
    payload,
    response_status: 200,
    processing_time_ms: Date.now() - startTime,
    event_type: eventName,
    ip_address: ipAddress,
    user_agent: userAgent
  })

  if (!orderId || !customerEmail) {
    return { response: NextResponse.json({ success: true, message: 'Dados insuficientes' }) }
  }

  let customerId: string | null = null

  try {
    const { data: customerRow, error: customerError } = await supabaseAdmin
      .from('customers')
      .upsert({
        email: customerEmail,
        name: customerName,
        phone: customerPhone,
        cpf: customerCpf
      }, {
        onConflict: 'email',
        ignoreDuplicates: false
      })
      .select('id')
      .single()

    if (!customerError) {
      customerId = customerRow?.id || null
    }
  } catch (error) {
    console.warn('⚠️ Erro ao upsert customer:', error)
  }

  let saleId: string | null = null
  try {
    const now = new Date().toISOString()
    
    // 🎯 BUSCAR CUPOM DO CHECKOUT_ATTEMPTS (nosso sistema)
    let couponCode: string | null = null
    let couponDiscount: number = 0
    
    try {
      const { data: checkoutAttempt } = await supabaseAdmin
        .from('checkout_attempts')
        .select('metadata')
        .eq('appmax_order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (checkoutAttempt?.metadata) {
        couponCode = checkoutAttempt.metadata.coupon_code || null
        couponDiscount = checkoutAttempt.metadata.coupon_discount || 0
      }
    } catch (error) {
      console.warn('⚠️ Não foi possível buscar cupom do checkout_attempts:', error)
    }
    
    // Fallback: tentar extrair do payload do webhook (caso Appmax envie)
    if (!couponCode) {
      const metadata = data.metadata || payload.metadata || {}
      couponCode = 
        data.coupon_code || 
        payload.coupon_code || 
        data.coupon || 
        payload.coupon ||
        metadata.coupon_code || 
        metadata.coupon ||
        null
      
      couponDiscount = 
        data.coupon_discount || 
        payload.coupon_discount || 
        data.discount_amount ||
        payload.discount_amount ||
        metadata.coupon_discount || 
        0
    }
    
    const salePayload: Record<string, any> = {
      appmax_order_id: orderId,
      customer_id: customerId,
      customer_name: customerName || 'Cliente Appmax',
      customer_email: customerEmail,
      customer_phone: customerPhone,
      customer_cpf: customerCpf,
      total_amount: totalAmount,
      subtotal: totalAmount,
      discount: couponDiscount,
      coupon_code: couponCode,
      coupon_discount: couponDiscount,
      status,
      failure_reason: failureReason || null,
      payment_method: paymentMethod,
      updated_at: now
    }

    let { data: saleRow, error: saleError } = await supabaseAdmin
      .from('sales')
      .upsert(salePayload, { onConflict: 'appmax_order_id' })
      .select('id')
      .single()

    if (saleError && saleError.message?.includes('failure_reason')) {
      const fallbackPayload = { ...salePayload }
      delete fallbackPayload.failure_reason
      const fallbackResult = await supabaseAdmin
        .from('sales')
        .upsert(fallbackPayload, { onConflict: 'appmax_order_id' })
        .select('id')
        .single()
      saleRow = fallbackResult.data
      saleError = fallbackResult.error
    }

    if (!saleError) {
      saleId = saleRow?.id || null
    }
  } catch (error) {
    console.warn('⚠️ Erro ao upsert venda:', error)
  }

  await updateCheckoutAttempt({
    orderId,
    customerEmail,
    customerName,
    totalAmount,
    paymentMethod,
    status,
    saleId,
    failureReason
  })

  if (FAILED_STATUSES.has(status) && customerEmail) {
    try {
      await supabaseAdmin
        .from('abandoned_carts')
        .update({
          status: 'abandoned',
          updated_at: new Date().toISOString()
        })
        .eq('customer_email', customerEmail)
        .eq('status', 'recovered')
    } catch (error) {
      console.warn('⚠️ Erro ao atualizar carrinho abandonado:', error)
    }
  }

  if (SUCCESS_STATUSES.has(status)) {
    await sendPurchaseEvent({
      orderId,
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
      customerName: customerName || undefined,
      totalAmount,
      currency: 'BRL'
    })

    // =====================================================
    // 🚀 INTEGRAÇÃO LOVABLE: Criar Usuário Automaticamente
    // =====================================================
    if (customerEmail && customerName) {
      try {
        console.log('🔧 Iniciando criação automática de usuário Lovable para:', customerEmail)
        
        // Gerar senha segura
        const temporaryPassword = generateSecurePassword(12)
        
        // Criar usuário no Lovable
        const lovableResult = await createLovableUser({
          email: customerEmail,
          password: temporaryPassword,
          full_name: customerName
        })

        if (lovableResult.success) {
          console.log('✅ Usuário Lovable criado com sucesso:', customerEmail)

          // Registrar log de sucesso
          await supabaseAdmin.from('integration_logs').insert({
            action: 'create_user_auto',
            status: 'success',
            recipient_email: customerEmail,
            user_id: lovableResult.user?.id,
            details: {
              source: 'webhook_appmax',
              order_id: orderId,
              full_name: customerName
            }
          })

          // 📧 ENVIAR E-MAIL DE BOAS-VINDAS COM CREDENCIAIS
          try {
            // TODO: Substituir pelo seu template de email real
            const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bem-vindo ao Voice Pen!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #2563eb;">🎉 Bem-vindo ao Voice Pen!</h1>
    
    <p>Olá <strong>${customerName}</strong>,</p>
    
    <p>Sua compra foi aprovada com sucesso! Sua conta já está ativa e pronta para uso.</p>
    
    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h2 style="margin-top: 0; color: #1f2937;">🔑 Suas Credenciais de Acesso</h2>
      <p style="margin: 10px 0;"><strong>Login:</strong> ${customerEmail}</p>
      <p style="margin: 10px 0;"><strong>Senha:</strong> <code style="background: #fff; padding: 5px 10px; border-radius: 4px; font-size: 16px;">${temporaryPassword}</code></p>
      <p style="margin: 10px 0;"><strong>Link de Acesso:</strong> <a href="${process.env.NEXT_PUBLIC_LOVABLE_APP_URL || 'https://seu-app.lovable.app'}" style="color: #2563eb;">Clique aqui para acessar</a></p>
    </div>
    
    <p style="background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0;">
      ⚠️ <strong>Importante:</strong> Por segurança, recomendamos que você altere sua senha no primeiro acesso.
    </p>
    
    <p>Se tiver alguma dúvida, nossa equipe de suporte está à disposição!</p>
    
    <p>Atenciosamente,<br>
    <strong>Equipe Voice Pen</strong></p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    <p style="font-size: 12px; color: #6b7280;">Este é um e-mail automático. Por favor, não responda.</p>
  </div>
</body>
</html>
            `

            // OPÇÃO 1: Enviar via Resend (se configurado)
            if (process.env.RESEND_API_KEY) {
              const Resend = require('resend').Resend
              const resendClient = new Resend(process.env.RESEND_API_KEY)
              
              await resendClient.emails.send({
                from: process.env.EMAIL_FROM || 'noreply@voicepen.com',
                to: customerEmail,
                subject: '🎉 Bem-vindo ao Voice Pen - Suas Credenciais de Acesso',
                html: emailBody
              })

              console.log('📧 E-mail enviado via Resend para:', customerEmail)
            } 
            // OPÇÃO 2: Enviar via SMTP (alternativa)
            else if (process.env.SMTP_HOST) {
              // Implementar SMTP aqui se necessário
              console.log('📧 SMTP configurado - implemente o envio aqui')
            } else {
              console.warn('⚠️ Nenhum serviço de e-mail configurado (RESEND_API_KEY ou SMTP_HOST)')
            }

            // Registrar log do e-mail
            await supabaseAdmin.from('integration_logs').insert({
              action: 'send_email',
              status: 'success',
              recipient_email: customerEmail,
              details: {
                email_type: 'welcome_credentials',
                order_id: orderId,
                sent_at: new Date().toISOString()
              }
            })

          } catch (emailError: any) {
            console.error('❌ Erro ao enviar e-mail:', emailError)
            
            // Registrar erro do e-mail
            await supabaseAdmin.from('integration_logs').insert({
              action: 'send_email',
              status: 'error',
              recipient_email: customerEmail,
              error_message: emailError.message,
              details: {
                email_type: 'welcome_credentials',
                order_id: orderId
              }
            })
          }

        } else {
          console.error('❌ Erro ao criar usuário Lovable:', lovableResult.error)
          
          // Registrar erro
          await supabaseAdmin.from('integration_logs').insert({
            action: 'create_user_auto',
            status: 'error',
            recipient_email: customerEmail,
            error_message: lovableResult.error || 'Erro desconhecido',
            details: {
              source: 'webhook_appmax',
              order_id: orderId,
              full_name: customerName
            }
          })
        }

      } catch (integrationError: any) {
        console.error('💥 Erro crítico na integração Lovable:', integrationError)
        
        // Registrar erro crítico
        await supabaseAdmin.from('integration_logs').insert({
          action: 'create_user_auto',
          status: 'error',
          recipient_email: customerEmail,
          error_message: integrationError.message || 'Erro crítico',
          details: {
            source: 'webhook_appmax',
            order_id: orderId,
            error_stack: integrationError.stack
          }
        })
      }
    }
  }

  return { response: NextResponse.json({ success: true, status }) }
}
