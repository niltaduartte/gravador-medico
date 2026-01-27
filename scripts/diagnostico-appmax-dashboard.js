#!/usr/bin/env node

/**
 * 🔍 DIAGNÓSTICO: Por que o Dashboard não mostra dados da Appmax?
 * 
 * Este script verifica:
 * 1. Se há vendas da Appmax na tabela sales
 * 2. Se a função get_analytics_period está lendo os dados corretamente
 * 3. Se o campo payment_gateway está preenchido
 * 4. Se há problemas de filtro de data
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

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

async function main() {
  console.log('🔍 DIAGNÓSTICO: Dashboard Appmax\n')
  console.log('='.repeat(60))
  
  // 1. Verificar vendas totais
  console.log('\n1️⃣ TOTAL DE VENDAS NA TABELA SALES')
  console.log('-'.repeat(60))
  
  const { data: totalSales, error: totalError } = await supabase
    .from('sales')
    .select('id', { count: 'exact', head: true })
  
  if (totalError) {
    console.error('❌ Erro:', totalError)
  } else {
    console.log(`✅ Total de vendas: ${totalSales}`)
  }
  
  // 2. Verificar vendas por gateway
  console.log('\n2️⃣ VENDAS POR GATEWAY')
  console.log('-'.repeat(60))
  
  const { data: byGateway, error: gatewayError } = await supabase
    .from('sales')
    .select('payment_gateway, id')
  
  if (gatewayError) {
    console.error('❌ Erro:', gatewayError)
  } else {
    const gateways = {}
    byGateway?.forEach(sale => {
      const gateway = sale.payment_gateway || 'NULL/VAZIO'
      gateways[gateway] = (gateways[gateway] || 0) + 1
    })
    
    console.log('Contagem por gateway:')
    Object.entries(gateways).forEach(([gateway, count]) => {
      console.log(`  ${gateway}: ${count}`)
    })
  }
  
  // 3. Verificar vendas da Appmax especificamente
  console.log('\n3️⃣ VENDAS DA APPMAX (payment_gateway = "appmax")')
  console.log('-'.repeat(60))
  
  const { data: appmaxSales, error: appmaxError } = await supabase
    .from('sales')
    .select('*')
    .eq('payment_gateway', 'appmax')
    .order('created_at', { ascending: false })
    .limit(5)
  
  if (appmaxError) {
    console.error('❌ Erro:', appmaxError)
  } else {
    console.log(`✅ Vendas Appmax encontradas: ${appmaxSales?.length || 0}`)
    
    if (appmaxSales && appmaxSales.length > 0) {
      console.log('\n📋 Últimas 5 vendas Appmax:')
      appmaxSales.forEach((sale, index) => {
        console.log(`\n  ${index + 1}. ID: ${sale.id}`)
        console.log(`     Order ID: ${sale.appmax_order_id}`)
        console.log(`     Cliente: ${sale.customer_email}`)
        console.log(`     Valor: R$ ${sale.total_amount}`)
        console.log(`     Status: ${sale.status}`)
        console.log(`     Data: ${sale.created_at}`)
        console.log(`     Gateway: ${sale.payment_gateway}`)
      })
    }
  }
  
  // 4. Verificar se há vendas com appmax_order_id mas sem payment_gateway
  console.log('\n4️⃣ VENDAS COM appmax_order_id MAS SEM payment_gateway')
  console.log('-'.repeat(60))
  
  const { data: missingGateway, error: missingError } = await supabase
    .from('sales')
    .select('id, appmax_order_id, payment_gateway, customer_email, total_amount')
    .not('appmax_order_id', 'is', null)
    .or('payment_gateway.is.null,payment_gateway.neq.appmax')
    .limit(10)
  
  if (missingError) {
    console.error('❌ Erro:', missingError)
  } else {
    console.log(`⚠️  Vendas encontradas: ${missingGateway?.length || 0}`)
    
    if (missingGateway && missingGateway.length > 0) {
      console.log('\n🚨 PROBLEMA ENCONTRADO! Estas vendas têm appmax_order_id mas gateway incorreto:')
      missingGateway.forEach((sale, index) => {
        console.log(`\n  ${index + 1}. ID: ${sale.id}`)
        console.log(`     Order ID: ${sale.appmax_order_id}`)
        console.log(`     Gateway atual: ${sale.payment_gateway || 'NULL'}`)
        console.log(`     Cliente: ${sale.customer_email}`)
      })
    } else {
      console.log('✅ Todas as vendas com appmax_order_id têm payment_gateway = "appmax"')
    }
  }
  
  // 5. Testar a função get_analytics_period
  console.log('\n5️⃣ TESTAR FUNÇÃO get_analytics_period')
  console.log('-'.repeat(60))
  
  const endDate = new Date().toISOString()
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  
  console.log(`Período: ${startDate.split('T')[0]} até ${endDate.split('T')[0]}`)
  
  const { data: analytics, error: analyticsError } = await supabase
    .rpc('get_analytics_period', {
      start_date: startDate,
      end_date: endDate
    })
  
  if (analyticsError) {
    console.error('❌ Erro ao chamar get_analytics_period:', analyticsError)
  } else {
    console.log('\n✅ Função executada com sucesso:')
    console.log('Resultado:', JSON.stringify(analytics, null, 2))
  }
  
  // 6. Verificar schema da tabela sales
  console.log('\n6️⃣ VERIFICAR SCHEMA DA TABELA SALES')
  console.log('-'.repeat(60))
  
  // Buscar uma linha e ver os campos
  const { data: sampleSale } = await supabase
    .from('sales')
    .select('*')
    .limit(1)
    .single()
  
  if (sampleSale) {
    console.log('✅ Campos disponíveis na tabela sales:')
    console.log(Object.keys(sampleSale).join(', '))
    
    // Verificar se payment_gateway existe
    if ('payment_gateway' in sampleSale) {
      console.log('\n✅ Campo "payment_gateway" existe na tabela')
    } else {
      console.log('\n🚨 PROBLEMA: Campo "payment_gateway" NÃO existe na tabela!')
    }
  }
  
  // 7. Verificar logs de webhook
  console.log('\n7️⃣ ÚLTIMOS WEBHOOKS APPMAX RECEBIDOS')
  console.log('-'.repeat(60))
  
  const { data: webhooks, error: webhookError } = await supabase
    .from('webhooks_logs')
    .select('*')
    .eq('source', 'appmax')
    .order('created_at', { ascending: false })
    .limit(5)
  
  if (webhookError) {
    console.error('❌ Erro:', webhookError)
  } else {
    console.log(`✅ Webhooks encontrados: ${webhooks?.length || 0}`)
    
    if (webhooks && webhooks.length > 0) {
      webhooks.forEach((webhook, index) => {
        console.log(`\n  ${index + 1}. ID: ${webhook.id}`)
        console.log(`     Evento: ${webhook.event_type}`)
        console.log(`     Data: ${webhook.created_at}`)
        console.log(`     Sucesso: ${webhook.success ? '✅' : '❌'}`)
        if (webhook.error_message) {
          console.log(`     Erro: ${webhook.error_message}`)
        }
      })
    }
  }
  
  // 8. RECOMENDAÇÕES
  console.log('\n\n🎯 RECOMENDAÇÕES')
  console.log('='.repeat(60))
  
  if (missingGateway && missingGateway.length > 0) {
    console.log('\n🔧 AÇÃO NECESSÁRIA: Corrigir vendas com gateway incorreto')
    console.log('Execute o script de correção para atualizar o campo payment_gateway')
    console.log('\nComando:')
    console.log('  node scripts/fix-appmax-gateway.js')
  }
  
  const appmaxCount = appmaxSales?.length || 0
  if (appmaxCount === 0) {
    console.log('\n⚠️  ATENÇÃO: Nenhuma venda da Appmax encontrada!')
    console.log('Possíveis causas:')
    console.log('  1. Webhooks da Appmax não estão sendo recebidos')
    console.log('  2. Webhooks não estão salvando na tabela sales')
    console.log('  3. Campo payment_gateway não está sendo preenchido')
    console.log('\nVerifique:')
    console.log('  - Configuração do webhook na Appmax')
    console.log('  - Logs de webhook (seção 7 acima)')
    console.log('  - Arquivo lib/appmax-webhook.ts')
  }
  
  console.log('\n✅ Diagnóstico concluído!')
}

main().catch(console.error)
