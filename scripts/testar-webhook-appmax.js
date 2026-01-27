#!/usr/bin/env node

/**
 * 🧪 TESTE: Webhook Appmax
 * 
 * Este script testa se o webhook da Appmax está funcionando corretamente
 * ao enviar um evento de teste e verificar se é salvo no banco
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// Carregar .env.local manualmente
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const value = match[2].trim().replace(/^["']|["']$/g, '')
    envVars[key] = value
  }
})

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
)

const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/appmax'
const WEBHOOK_SECRET = envVars.APPMAX_WEBHOOK_SECRET || ''

async function testWebhook() {
  console.log('🧪 TESTE: Webhook Appmax\n')
  console.log('='.repeat(60))
  
  // 1. Verificar se o servidor está rodando
  console.log('\n1️⃣ VERIFICAR SE O SERVIDOR ESTÁ RODANDO')
  console.log('-'.repeat(60))
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'GET'
    })
    const data = await response.json()
    console.log('✅ Servidor está online:', data)
  } catch (error) {
    console.error('❌ Servidor NÃO está acessível!')
    console.error('Erro:', error.message)
    console.log('\n💡 Execute: npm run dev')
    process.exit(1)
  }
  
  // 2. Criar payload de teste
  console.log('\n2️⃣ CRIAR PAYLOAD DE TESTE')
  console.log('-'.repeat(60))
  
  const testPayload = {
    event: 'order.approved',
    data: {
      order_id: `TEST_${Date.now()}`,
      customer_email: 'teste.webhook@appmax.com',
      customer_name: 'Cliente Teste Webhook',
      customer_phone: '11999887766',
      total_amount: 197.00,
      payment_method: 'credit_card',
      status: 'paid'
    }
  }
  
  console.log('Payload criado:')
  console.log(JSON.stringify(testPayload, null, 2))
  
  // 3. Gerar assinatura
  console.log('\n3️⃣ GERAR ASSINATURA DO WEBHOOK')
  console.log('-'.repeat(60))
  
  if (!WEBHOOK_SECRET) {
    console.warn('⚠️  APPMAX_WEBHOOK_SECRET não configurado!')
    console.log('O webhook vai aceitar sem validação (apenas em dev)')
  } else {
    console.log('✅ Secret configurado:', WEBHOOK_SECRET.slice(0, 10) + '...')
  }
  
  const rawBody = JSON.stringify(testPayload)
  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET || 'test-secret')
    .update(rawBody)
    .digest('hex')
  
  console.log('Assinatura gerada:', signature.slice(0, 20) + '...')
  
  // 4. Contar vendas antes
  console.log('\n4️⃣ CONTAR VENDAS ANTES DO TESTE')
  console.log('-'.repeat(60))
  
  const { data: beforeSales } = await supabase
    .from('sales')
    .select('id', { count: 'exact', head: true })
    .eq('payment_gateway', 'appmax')
  
  console.log(`Vendas Appmax ANTES: ${beforeSales || 0}`)
  
  // 5. Enviar webhook
  console.log('\n5️⃣ ENVIAR WEBHOOK DE TESTE')
  console.log('-'.repeat(60))
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-appmax-signature': `sha256=${signature}`,
        'x-appmax-timestamp': String(Math.floor(Date.now() / 1000))
      },
      body: rawBody
    })
    
    const responseData = await response.json()
    console.log('Status:', response.status)
    console.log('Resposta:', JSON.stringify(responseData, null, 2))
    
    if (response.ok) {
      console.log('✅ Webhook aceito com sucesso!')
    } else {
      console.error('❌ Webhook rejeitado!')
      return
    }
  } catch (error) {
    console.error('❌ Erro ao enviar webhook:', error.message)
    return
  }
  
  // 6. Aguardar processamento
  console.log('\n⏳ Aguardando processamento (2 segundos)...')
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // 7. Verificar se foi salvo
  console.log('\n6️⃣ VERIFICAR SE FOI SALVO NO BANCO')
  console.log('-'.repeat(60))
  
  const { data: afterSales } = await supabase
    .from('sales')
    .select('id', { count: 'exact', head: true })
    .eq('payment_gateway', 'appmax')
  
  console.log(`Vendas Appmax DEPOIS: ${afterSales || 0}`)
  
  const { data: testSale } = await supabase
    .from('sales')
    .select('*')
    .eq('customer_email', 'teste.webhook@appmax.com')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  if (testSale) {
    console.log('\n✅ VENDA DE TESTE ENCONTRADA!')
    console.log('ID:', testSale.id)
    console.log('Order ID:', testSale.appmax_order_id)
    console.log('Cliente:', testSale.customer_email)
    console.log('Valor:', testSale.total_amount)
    console.log('Gateway:', testSale.payment_gateway)
    console.log('Status:', testSale.status)
    console.log('Criado em:', testSale.created_at)
  } else {
    console.log('\n❌ VENDA DE TESTE NÃO ENCONTRADA!')
    console.log('O webhook foi aceito mas não salvou no banco.')
    console.log('\n🔍 Possíveis causas:')
    console.log('  1. Erro no código de salvamento (lib/appmax-webhook.ts)')
    console.log('  2. Validação falhando silenciosamente')
    console.log('  3. Dados insuficientes no payload')
    console.log('\n💡 Verifique os logs do servidor (terminal onde roda npm run dev)')
  }
  
  // 8. Testar função do dashboard
  console.log('\n7️⃣ TESTAR FUNÇÃO DO DASHBOARD')
  console.log('-'.repeat(60))
  
  const endDate = new Date().toISOString()
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  
  const { data: analytics, error: analyticsError } = await supabase
    .rpc('get_analytics_period', {
      start_date: startDate,
      end_date: endDate
    })
  
  if (analyticsError) {
    console.error('❌ Erro ao buscar analytics:', analyticsError)
  } else {
    console.log('✅ Analytics atualizados:')
    console.log(JSON.stringify(analytics, null, 2))
  }
  
  // 9. Resultado final
  console.log('\n\n🎯 RESULTADO FINAL')
  console.log('='.repeat(60))
  
  if (testSale && afterSales > beforeSales) {
    console.log('✅ TESTE PASSOU!')
    console.log('O webhook está funcionando corretamente.')
    console.log('\n📊 Dashboard deve mostrar os dados da Appmax agora.')
    console.log('Acesse: http://localhost:3000/admin/dashboard')
  } else if (!testSale) {
    console.log('❌ TESTE FALHOU!')
    console.log('O webhook foi aceito mas não salvou no banco.')
    console.log('\n🔧 Ações necessárias:')
    console.log('  1. Verificar logs do servidor (terminal do npm run dev)')
    console.log('  2. Verificar código em: lib/appmax-webhook.ts')
    console.log('  3. Verificar se campos estão corretos na tabela sales')
    console.log('  4. Tentar novamente: node scripts/testar-webhook-appmax.js')
  }
  
  console.log('\n✅ Teste concluído!')
}

main().catch(console.error)

async function main() {
  try {
    await testWebhook()
  } catch (error) {
    console.error('\n💥 ERRO CRÍTICO:', error)
    process.exit(1)
  }
}
