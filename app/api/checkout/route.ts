import { NextRequest, NextResponse } from "next/server"

/**
 * SOLUÇÃO HÍBRIDA: Coleta dados no checkout customizado e redireciona para Appmax
 * 
 * Como a API da Appmax não está acessível diretamente, usamos a URL do checkout
 * hospedado da Appmax com os dados pré-preenchidos via query params
 */

const APPMAX_CHECKOUT_BASE = "https://gravadormedico1768482029857.carrinho.app/one-checkout/ocmdf"
const PRODUCT_IDS = {
  main: process.env.APPMAX_PRODUCT_ID || '32991339',
  bump1: process.env.APPMAX_ORDER_BUMP_1_ID || '32989468',
  bump2: process.env.APPMAX_ORDER_BUMP_2_ID || '32989503',
  bump3: process.env.APPMAX_ORDER_BUMP_3_ID || '32989520',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validação básica
    if (!body.email || !body.name) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    // Limpa e formata CPF (remove tudo que não for número)
    const cleanCpf = body.cpf ? body.cpf.replace(/\D/g, '') : ''
    
    // Limpa e formata telefone
    const cleanPhone = body.phone ? body.phone.replace(/\D/g, '') : ''

    console.log('📦 Dados recebidos:', {
      name: body.name,
      email: body.email,
      phone: cleanPhone,
      cpf: cleanCpf,
      orderBumps: body.orderBumps,
      paymentMethod: body.paymentMethod,
    })

    // Validação do CPF (deve ter 11 dígitos)
    if (cleanCpf && cleanCpf.length !== 11) {
      console.error('❌ CPF inválido:', cleanCpf)
      return NextResponse.json({ 
        error: "CPF inválido. Deve conter 11 dígitos." 
      }, { status: 400 })
    }

    // TODO: Salvar lead no seu banco de dados aqui (Supabase)
    // await saveLeadToDatabase({ email: body.email, name: body.name })

    // Monta a URL do checkout Appmax com dados pré-preenchidos
    const checkoutUrl = new URL(`${APPMAX_CHECKOUT_BASE}/${PRODUCT_IDS.main}`)
    
    // Adiciona parâmetros do cliente (SEM formatação, apenas números)
    checkoutUrl.searchParams.set('name', body.name)
    checkoutUrl.searchParams.set('email', body.email)
    if (cleanPhone) checkoutUrl.searchParams.set('phone', cleanPhone)
    if (cleanCpf) checkoutUrl.searchParams.set('cpf', cleanCpf)

    // Adiciona UTM params se tiver
    if (body.utmParams) {
      Object.entries(body.utmParams).forEach(([key, value]) => {
        if (value) checkoutUrl.searchParams.set(key, value as string)
      })
    }

    // Determina qual produto usar como base
    let finalUrl = checkoutUrl.toString()
    
    // SEMPRE usa o produto principal (32880073)
    // Os order bumps serão adicionados no checkout da Appmax se configurado lá
    // A Appmax não permite passar múltiplos produtos via URL, então enviamos o principal
    // e o usuário vê os bumps no checkout hospedado da Appmax
    
    console.log('📦 Order bumps selecionados:', body.orderBumps)
    
    // Mantém a URL do produto principal
    // Se você quiser testar com um bump específico, descomente abaixo:
    /*
    if (body.orderBumps && body.orderBumps.length > 0) {
      const firstBump = body.orderBumps[0]
      const bumpId = firstBump === 0 ? PRODUCT_IDS.bump1 : 
                     firstBump === 1 ? PRODUCT_IDS.bump2 : 
                     PRODUCT_IDS.bump3
      
      const bumpUrl = new URL(`${APPMAX_CHECKOUT_BASE}/${bumpId}`)
      bumpUrl.searchParams.set('name', body.name)
      bumpUrl.searchParams.set('email', body.email)
      if (body.phone) bumpUrl.searchParams.set('phone', body.phone)
      if (body.cpf) bumpUrl.searchParams.set('cpf', body.cpf)
      
      finalUrl = bumpUrl.toString()
    }
    */

    console.log('🔗 URL de redirecionamento:', finalUrl)
    console.log('📊 Parâmetros enviados para Appmax:', {
      product_id: PRODUCT_IDS.main,
      name: body.name,
      email: body.email,
      phone: cleanPhone,
      cpf: cleanCpf,
      has_utm: !!body.utmParams,
    })

    // Retorna URL para redirecionar o cliente
    return NextResponse.json({
      success: true,
      redirectUrl: finalUrl,
      message: 'Redirecionando para finalizar pagamento...',
    })

  } catch (error: any) {
    console.error("Erro no checkout:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao processar checkout" },
      { status: 500 }
    )
  }
}
