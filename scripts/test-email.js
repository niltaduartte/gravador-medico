/**
 * 🧪 SCRIPT DE TESTE - ENVIO DE E-MAIL
 * 
 * Testa o envio de e-mail de boas-vindas através do webhook
 * do Mercado Pago ou AppMax
 * 
 * USO:
 * node scripts/test-email.js [email] [nome]
 * 
 * EXEMPLO:
 * node scripts/test-email.js seuemail@exemplo.com "João Silva"
 */

const email = process.argv[2] || 'teste@exemplo.com'
const nome = process.argv[3] || 'Cliente Teste'

// URL do webhook (ajuste para produção ou local)
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://www.gravadormedico.com.br/api/webhooks/mercadopago-v3'

async function testEmailViaMercadoPago() {
  console.log('\n🧪 TESTE DE E-MAIL - WEBHOOK MERCADO PAGO')
  console.log('=========================================\n')
  console.log(`📧 E-mail: ${email}`)
  console.log(`👤 Nome: ${nome}`)
  console.log(`🔗 Webhook: ${WEBHOOK_URL}\n`)

  try {
    // Simular payload do Mercado Pago
    const payload = {
      action: 'payment.updated',
      data: {
        id: `test_${Date.now()}`
      },
      type: 'payment'
    }

    console.log('📤 Enviando webhook simulado...\n')

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': 'test_signature',
        'x-request-id': `test_${Date.now()}`
      },
      body: JSON.stringify(payload)
    })

    const result = await response.json()

    console.log('📥 Resposta do webhook:')
    console.log(JSON.stringify(result, null, 2))
    console.log('\n✅ Status:', response.status)

    if (response.ok) {
      console.log('\n✅ Webhook processado com sucesso!')
      console.log('\n📋 PRÓXIMOS PASSOS:')
      console.log('   1. Verifique os logs da Vercel')
      console.log('   2. Consulte a tabela integration_logs no Supabase')
      console.log('   3. Verifique se o e-mail foi recebido')
      console.log('\n💡 DICA: Para ver os logs em tempo real:')
      console.log('   vercel logs --follow')
    } else {
      console.error('\n❌ Erro ao processar webhook')
    }

  } catch (error) {
    console.error('\n❌ Erro ao testar webhook:', error.message)
  }
}

async function testEmailViaAppMax() {
  console.log('\n🧪 TESTE DE E-MAIL - WEBHOOK APPMAX')
  console.log('=========================================\n')
  console.log(`📧 E-mail: ${email}`)
  console.log(`👤 Nome: ${nome}\n`)

  const APPMAX_URL = 'https://www.gravadormedico.com.br/api/webhooks/appmax'

  try {
    const payload = {
      event: 'order.approved',
      data: {
        order_id: `TEST_${Date.now()}`,
        customer_email: email,
        customer_name: nome,
        total_amount: 197,
        payment_method: 'credit_card',
        status: 'approved'
      }
    }

    console.log('📤 Enviando webhook simulado...\n')

    const response = await fetch(APPMAX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const result = await response.json()

    console.log('📥 Resposta do webhook:')
    console.log(JSON.stringify(result, null, 2))
    console.log('\n✅ Status:', response.status)

    if (response.ok) {
      console.log('\n✅ Webhook processado com sucesso!')
      console.log('\n📋 PRÓXIMOS PASSOS:')
      console.log('   1. Verifique os logs da Vercel')
      console.log('   2. Consulte a tabela integration_logs no Supabase')
      console.log('   3. Verifique se o e-mail foi recebido')
      console.log(`   4. Acesse o painel admin: https://www.gravadormedico.com.br/admin/lovable/users`)
      console.log('\n💡 DICA: Para ver os logs em tempo real:')
      console.log('   vercel logs --follow')
    } else {
      console.error('\n❌ Erro ao processar webhook')
    }

  } catch (error) {
    console.error('\n❌ Erro ao testar webhook:', error.message)
  }
}

// Menu de escolha
async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('\n🧪 TESTE DE E-MAIL - GRAVADOR MÉDICO')
    console.log('=====================================\n')
    console.log('USO:')
    console.log('  node scripts/test-email.js [email] [nome] [--appmax|--mp]\n')
    console.log('OPÇÕES:')
    console.log('  --appmax    Testar via webhook AppMax')
    console.log('  --mp        Testar via webhook Mercado Pago (padrão)')
    console.log('  --help, -h  Mostrar esta ajuda\n')
    console.log('EXEMPLOS:')
    console.log('  node scripts/test-email.js teste@email.com "João Silva"')
    console.log('  node scripts/test-email.js teste@email.com "João Silva" --appmax')
    return
  }

  if (args.includes('--appmax')) {
    await testEmailViaAppMax()
  } else {
    // Mercado Pago é o padrão
    await testEmailViaMercadoPago()
  }
}

main()
