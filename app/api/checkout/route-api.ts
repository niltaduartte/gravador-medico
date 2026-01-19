import { NextRequest, NextResponse } from "next/server"
import { createAppmaxOrder } from "@/lib/appmax"

/**
 * INTEGRAÇÃO API OFICIAL APPMAX V3
 * 
 * Usa o endpoint: https://admin.appmax.com.br/api/v3/
 * 
 * Fluxo completo:
 * 1. Cria cliente na Appmax
 * 2. Cria pedido com produtos
 * 3. Processa pagamento (PIX ou Cartão)
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validação básica
    if (!body.email || !body.name) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    console.log('📦 Dados recebidos para API Appmax:', {
      name: body.name,
      email: body.email,
      phone: body.phone,
      cpf: body.cpf,
      orderBumps: body.orderBumps,
      paymentMethod: body.paymentMethod,
    })

    // Processa order bumps
    const orderBumps = []
    if (body.orderBumps && body.orderBumps.length > 0) {
      const PRODUCT_IDS = {
        bump1: process.env.APPMAX_ORDER_BUMP_1_ID || '32989468',
        bump2: process.env.APPMAX_ORDER_BUMP_2_ID || '32989503',
        bump3: process.env.APPMAX_ORDER_BUMP_3_ID || '32989520',
      }
      
      for (const bumpIndex of body.orderBumps) {
        if (bumpIndex === 0) {
          orderBumps.push({ product_id: PRODUCT_IDS.bump1, quantity: 1 })
        } else if (bumpIndex === 1) {
          orderBumps.push({ product_id: PRODUCT_IDS.bump2, quantity: 1 })
        } else if (bumpIndex === 2) {
          orderBumps.push({ product_id: PRODUCT_IDS.bump3, quantity: 1 })
        }
      }
    }

    // Cria o pedido na Appmax
    const appmaxOrder = await createAppmaxOrder({
      customer: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        cpf: body.cpf,
        // Endereço opcional para infoproduto
        address: body.address ? {
          zipcode: body.address.zipcode,
          street: body.address.street,
          number: body.address.number,
          complement: body.address.complement,
          neighborhood: body.address.neighborhood,
          city: body.address.city,
          state: body.address.state,
        } : undefined,
      },
      product_id: process.env.APPMAX_PRODUCT_ID || '32991339',
      quantity: 1,
      order_bumps: orderBumps,
      payment_method: body.paymentMethod === 'pix' ? 'pix' : 'credit_card',
      card_data: body.cardData ? {
        number: body.cardData.number,
        cvv: body.cardData.cvv,
        exp_month: body.cardData.expMonth,
        exp_year: body.cardData.expYear,
        holder_name: body.cardData.holderName,
        installments: body.cardData.installments || 1,
      } : undefined,
      utm_params: body.utmParams,
    })

    console.log('✅ Pedido criado na Appmax:', appmaxOrder)

    // TODO: Salvar no banco de dados (Supabase)
    // await saveOrderToDatabase({ ...body, appmaxOrderId: appmaxOrder.order_id })

    // Retorna resposta baseada no método de pagamento
    if (body.paymentMethod === 'pix') {
      return NextResponse.json({
        success: true,
        order_id: appmaxOrder.order_id,
        payment_method: 'pix',
        pix_qr_code: appmaxOrder.pix_qr_code,
        pix_qr_code_base64: appmaxOrder.pix_qr_code_base64,
        message: 'Pedido criado! Use o QR Code para pagar via PIX.',
      })
    } else {
      return NextResponse.json({
        success: true,
        order_id: appmaxOrder.order_id,
        payment_method: 'credit_card',
        status: appmaxOrder.status,
        message: appmaxOrder.status === 'approved' 
          ? 'Pagamento aprovado! Você receberá um email com os dados de acesso.'
          : 'Pagamento em processamento...',
      })
    }

  } catch (error: any) {
    console.error("❌ Erro no checkout:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Erro ao processar checkout",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
