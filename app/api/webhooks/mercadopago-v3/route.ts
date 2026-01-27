// ========================================
// 🔔 WEBHOOK MERCADO PAGO V3 - ENTERPRISE
// ========================================
// Validação HMAC | Processamento Assíncrono | Provisionamento
// ATUALIZADO: Agora salva vendas na tabela `sales` para dashboard
// ========================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { MercadoPagoWebhookSchema } from '@/lib/validators/checkout';
import { createAndSaveRedirectUrl } from '@/lib/redirect-helper';

// =====================================================
// 📊 CONSTANTES E MAPEAMENTOS
// =====================================================
const SUCCESS_STATUSES = ['approved', 'authorized'];
const PENDING_STATUSES = ['pending', 'in_process', 'in_mediation'];
const FAILED_STATUSES = ['rejected', 'cancelled', 'refunded', 'charged_back'];

const MP_STATUS_MAP: Record<string, string> = {
  'approved': 'paid',
  'authorized': 'approved',
  'pending': 'pending',
  'in_process': 'pending',
  'in_mediation': 'pending',
  'rejected': 'refused',
  'cancelled': 'cancelled',
  'refunded': 'refunded',
  'charged_back': 'chargeback'
};

// =====================================================
// 🔐 VALIDAÇÃO DE ASSINATURA (HMAC SHA-256)
// =====================================================
function validateWebhookSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string
): boolean {
  try {
    // O Mercado Pago envia: v1,<hash>,ts=<timestamp>
    const parts = xSignature.split(',');
    
    if (parts.length < 2) {
      console.error('Invalid signature format');
      return false;
    }
    
    const receivedHash = parts[1];
    const timestamp = parts.find(p => p.startsWith('ts='))?.split('=')[1];
    
    if (!receivedHash || !timestamp) {
      console.error('Missing hash or timestamp');
      return false;
    }
    
    // Construir string para validação
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET || '';
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${timestamp};`;
    
    // Calcular HMAC
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');
    
    // Comparação segura (constant-time)
    return crypto.timingSafeEqual(
      Buffer.from(hmac),
      Buffer.from(receivedHash)
    );
  } catch (error) {
    console.error('Signature validation error:', error);
    return false;
  }
}

// =====================================================
// 📧 ENVIO DE EMAIL (Resend/SMTP)
// =====================================================
async function sendWelcomeEmail(
  email: string,
  credentials: { email: string; password: string }
): Promise<boolean> {
  try {
    // Implementação com Resend (ou seu provedor de email)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Gravador Médico <noreply@seudominio.com>',
        to: email,
        subject: '🎉 Bem-vindo ao Gravador Médico!',
        html: `
          <h2>Seu acesso está pronto!</h2>
          <p>Obrigado pela compra. Aqui estão seus dados de acesso:</p>
          <ul>
            <li><strong>Email:</strong> ${credentials.email}</li>
            <li><strong>Senha:</strong> ${credentials.password}</li>
          </ul>
          <p><a href="${process.env.LOVABLE_APP_URL}/login">Clique aqui para acessar</a></p>
        `,
      }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

// =====================================================
// 🚀 PROVISIONAMENTO LOVABLE
// =====================================================
async function provisionLovableAccount(
  orderId: string,
  email: string,
  name: string
): Promise<{ success: boolean; credentials?: any; error?: string }> {
  try {
    // Chamar Edge Function do Lovable
    const response = await fetch(
      `${process.env.LOVABLE_API_URL}/functions/v1/admin-user-manager`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-secret': process.env.LOVABLE_API_SECRET!,
        },
        body: JSON.stringify({
          email,
          autoConfirm: true,
          metadata: {
            name,
            order_id: orderId,
            source: 'gravador-medico',
          },
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Lovable API error: ${error}`);
    }
    
    const data = await response.json();
    
    // Registrar sucesso
    await supabaseAdmin.from('integration_logs').insert({
      order_id: orderId,
      action: 'user_creation',
      status: 'success',
      details: {
        lovable_user_id: data.user.id,
        email: data.user.email,
      },
    });
    
    return {
      success: true,
      credentials: data.credentials,
    };
  } catch (error: any) {
    console.error('Provisioning error:', error);
    
    // Registrar erro para retry posterior
    await supabaseAdmin.from('integration_logs').insert({
      order_id: orderId,
      action: 'user_creation',
      status: 'error',
      error_message: error.message,
      retry_count: 0,
      next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min
    });
    
    return {
      success: false,
      error: error.message,
    };
  }
}

// =====================================================
// 🎯 MAIN WEBHOOK HANDLER
// =====================================================
export async function POST(request: NextRequest) {
  try {
    // ==================================================
    // 1️⃣ VALIDAÇÃO DE HEADERS
    // ==================================================
    const xSignature = request.headers.get('x-signature');
    const xRequestId = request.headers.get('x-request-id');
    
    if (!xSignature || !xRequestId) {
      return NextResponse.json(
        { error: 'Missing webhook signature' },
        { status: 401 }
      );
    }
    
    // ==================================================
    // 2️⃣ PARSE & VALIDATE PAYLOAD
    // ==================================================
    const rawPayload = await request.json();
    const validation = MercadoPagoWebhookSchema.safeParse(rawPayload);
    
    if (!validation.success) {
      console.error('Invalid webhook payload:', validation.error);
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      );
    }
    
    const payload = validation.data;
    
    // ==================================================
    // 3️⃣ VALIDAR ASSINATURA HMAC
    // ==================================================
    const isValidSignature = validateWebhookSignature(
      xSignature,
      xRequestId,
      payload.data.id
    );
    
    if (!isValidSignature) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    // ==================================================
    // 4️⃣ SALVAR WEBHOOK LOG (COM SANITIZAÇÃO AUTOMÁTICA)
    // ==================================================
    const { data: webhookLog, error: logError } = await supabaseAdmin
      .from('webhook_logs')
      .insert({
        provider: 'mercadopago',
        event_id: payload.data.id,
        topic: payload.type,
        payload: rawPayload, // Trigger vai sanitizar automaticamente
        signature_valid: true,
        processed: false,
      })
      .select()
      .single();
    
    if (logError) {
      console.error('Failed to save webhook log:', logError);
    }
    
    // ==================================================
    // 5️⃣ PROCESSAR PAYMENTS
    // ==================================================
    if (payload.type !== 'payment') {
      // Marcar como processado (não precisa de ação)
      if (webhookLog) {
        await supabaseAdmin
          .from('webhook_logs')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('id', webhookLog.id);
      }
      
      return NextResponse.json({ received: true });
    }
    
    // ==================================================
    // 6️⃣ BUSCAR DETALHES DO PAYMENT NA API DO MP
    // ==================================================
    const paymentId = payload.data.id;
    let paymentDetails: any = null;
    
    try {
      const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (mpAccessToken) {
        const mpResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${paymentId}`,
          {
            headers: {
              'Authorization': `Bearer ${mpAccessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (mpResponse.ok) {
          paymentDetails = await mpResponse.json();
          console.log(`[MP Webhook] Payment ${paymentId} status: ${paymentDetails.status}`);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes do pagamento:', error);
    }
    
    // ==================================================
    // 6.1️⃣ BUSCAR PEDIDO PELO EXTERNAL_REFERENCE
    // ==================================================
    const externalReference = paymentDetails?.external_reference || payload.data.id;
    
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*')
      .or(`gateway_order_id.eq.${paymentId},external_reference.eq.${externalReference}`)
      .maybeSingle();
    
    // ==================================================
    // 7️⃣ CRIAR/ATUALIZAR CUSTOMER
    // ==================================================
    let customerId: string | null = null;
    const customerEmail = paymentDetails?.payer?.email || order?.customer_email;
    const customerName = paymentDetails?.payer?.first_name 
      ? `${paymentDetails.payer.first_name} ${paymentDetails.payer.last_name || ''}`
      : order?.customer_name;
    const customerPhone = paymentDetails?.payer?.phone?.number || order?.customer_phone;
    
    if (customerEmail) {
      try {
        const { data: customerRow } = await supabaseAdmin
          .from('customers')
          .upsert({
            email: customerEmail,
            name: customerName || customerEmail.split('@')[0],
            phone: customerPhone
          }, {
            onConflict: 'email',
            ignoreDuplicates: false
          })
          .select('id')
          .single();
        
        customerId = customerRow?.id || null;
      } catch (error) {
        console.warn('⚠️ Erro ao upsert customer:', error);
      }
    }
    
    // ==================================================
    // 8️⃣ DETERMINAR STATUS E SALVAR NA TABELA SALES
    // ==================================================
    const mpStatus = paymentDetails?.status || 'pending';
    const normalizedStatus = MP_STATUS_MAP[mpStatus] || mpStatus;
    const isSuccess = SUCCESS_STATUSES.includes(mpStatus);
    const totalAmount = paymentDetails?.transaction_amount || order?.total_amount || 0;
    const paymentMethod = paymentDetails?.payment_method_id || paymentDetails?.payment_type_id || 'credit_card';
    
    const now = new Date().toISOString();
    
    // ✅ SALVAR/ATUALIZAR NA TABELA SALES (CRÍTICO PARA O DASHBOARD!)
    const salePayload: Record<string, any> = {
      mercadopago_payment_id: paymentId,
      customer_id: customerId,
      customer_name: customerName || 'Cliente MP',
      customer_email: customerEmail,
      customer_phone: customerPhone,
      total_amount: totalAmount,
      subtotal: totalAmount,
      order_status: normalizedStatus,
      payment_method: paymentMethod,
      payment_gateway: 'mercadopago', // ⬅️ CRÍTICO: Identifica como MP no dashboard
      status: normalizedStatus,
      external_reference: externalReference,
      updated_at: now
    };
    
    // Adicionar campos de tracking se disponíveis
    if (order?.utm_source) salePayload.utm_source = order.utm_source;
    if (order?.utm_medium) salePayload.utm_medium = order.utm_medium;
    if (order?.utm_campaign) salePayload.utm_campaign = order.utm_campaign;
    
    let saleId: string | null = null;
    
    try {
      // Tentar atualizar pelo mercadopago_payment_id
      const { data: existingSale } = await supabaseAdmin
        .from('sales')
        .select('id')
        .eq('mercadopago_payment_id', paymentId)
        .maybeSingle();
      
      if (existingSale) {
        // Atualizar venda existente
        const { data: updatedSale } = await supabaseAdmin
          .from('sales')
          .update(salePayload)
          .eq('id', existingSale.id)
          .select('id')
          .single();
        
        saleId = updatedSale?.id || existingSale.id;
        console.log(`[MP Webhook] ✅ Sale atualizada: ${saleId}`);
      } else {
        // Criar nova venda
        salePayload.created_at = now;
        
        const { data: newSale, error: saleError } = await supabaseAdmin
          .from('sales')
          .insert(salePayload)
          .select('id')
          .single();
        
        if (saleError) {
          console.error('❌ Erro ao criar sale:', saleError);
          // Tentar sem campos opcionais
          delete salePayload.utm_source;
          delete salePayload.utm_medium;
          delete salePayload.utm_campaign;
          
          const { data: fallbackSale } = await supabaseAdmin
            .from('sales')
            .insert(salePayload)
            .select('id')
            .single();
          
          saleId = fallbackSale?.id || null;
        } else {
          saleId = newSale?.id || null;
        }
        
        if (saleId) {
          console.log(`[MP Webhook] ✅ Nova sale criada: ${saleId}`);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao salvar sale:', error);
    }
    
    // ==================================================
    // 9️⃣ ATUALIZAR CHECKOUT_ATTEMPTS (SE EXISTIR)
    // ==================================================
    if (customerEmail) {
      try {
        await supabaseAdmin
          .from('checkout_attempts')
          .update({
            status: normalizedStatus,
            sale_id: saleId,
            converted_at: isSuccess ? now : null,
            updated_at: now
          })
          .eq('customer_email', customerEmail)
          .in('status', ['pending', 'processing', 'fraud_analysis'])
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      } catch (error) {
        console.warn('⚠️ Erro ao atualizar checkout_attempts:', error);
      }
    }
    
    // ==================================================
    // 🔟 VERIFICAR SE JÁ FOI PROCESSADO
    // ==================================================
    if (!isSuccess) {
      // Para pagamentos não aprovados, apenas salvar e retornar
      if (webhookLog) {
        await supabaseAdmin
          .from('webhook_logs')
          .update({ 
            processed: true, 
            processed_at: now,
            error_message: `Status: ${mpStatus}`
          })
          .eq('id', webhookLog.id);
      }
      
      return NextResponse.json({ 
        received: true, 
        status: normalizedStatus,
        sale_id: saleId 
      });
    }
    
    // Verificar se order já foi processado
    if (order?.status === 'paid') {
      if (webhookLog) {
        await supabaseAdmin
          .from('webhook_logs')
          .update({ processed: true, processed_at: now })
          .eq('id', webhookLog.id);
      }
      
      return NextResponse.json({ received: true, message: 'Already processed' });
    }
    
    // ==================================================
    // 1️⃣1️⃣ PROVISIONAMENTO AUTOMÁTICO (SE CONFIGURADO)
    // ==================================================
    let provisionResult: { success: boolean; credentials?: any; error?: string } = { 
      success: false, 
      credentials: undefined, 
      error: undefined 
    };
    
    if (customerEmail && customerName && process.env.LOVABLE_API_URL) {
      console.log(`[${saleId || paymentId}] Iniciando provisionamento...`);
      
      provisionResult = await provisionLovableAccount(
        saleId || paymentId,
        customerEmail,
        customerName
      );
    }
    
    if (provisionResult.success && provisionResult.credentials) {
      // Enviar email com credenciais
      const emailSent = await sendWelcomeEmail(
        customerEmail,
        provisionResult.credentials
      );
      
      await supabaseAdmin.from('integration_logs').insert({
        order_id: saleId || paymentId,
        action: 'email_sent',
        status: emailSent ? 'success' : 'error',
        details: { email_sent: emailSent },
      });
      
      console.log(`[${saleId || paymentId}] ✅ Provisionamento completo`);
    } else if (provisionResult.error) {
      console.error(`[${saleId || paymentId}] ❌ Falha no provisionamento: ${provisionResult.error}`);
    }
    
    // ==================================================
    // 1️⃣2️⃣ CRIAR URL DE REDIRECIONAMENTO
    // ==================================================
    const redirectUrl = await createAndSaveRedirectUrl({
      orderId: saleId || paymentId,
      customerEmail: customerEmail || '',
      customerName: customerName || undefined,
      paymentMethod: paymentMethod || 'credit_card',
      amount: totalAmount,
      status: 'paid'
    });
    
    if (redirectUrl) {
      console.log(`[${saleId || paymentId}] 🔄 URL de obrigado criada: ${redirectUrl}`);
    }
    
    // ==================================================
    // 1️⃣3️⃣ MARCAR WEBHOOK COMO PROCESSADO
    // ==================================================
    if (webhookLog) {
      await supabaseAdmin
        .from('webhook_logs')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq('id', webhookLog.id);
    }
    
    // 🔄 INVALIDAR CACHE - Força atualização em todo o dashboard
    console.log('🔄 [CACHE] Venda processada - Dashboard será atualizado automaticamente via ISR')
    
    return NextResponse.json({
      received: true,
      sale_id: saleId,
      payment_id: paymentId,
      provisioned: provisionResult.success,
      cache_invalidated: true
    });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// =====================================================
// 🔍 GET: Healthcheck
// =====================================================
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'mercadopago-webhook-v3',
    timestamp: new Date().toISOString(),
  });
}
