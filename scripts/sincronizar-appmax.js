#!/usr/bin/env node

/**
 * 🔄 SINCRONIZAÇÃO: Vendas Antigas da Appmax
 * 
 * Este script busca todas as vendas históricas da Appmax
 * e importa para o banco de dados local
 */

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

const SYNC_URL = 'http://localhost:3000/api/admin/sync-appmax'

async function syncAppmaxSales(days = 90) {
  console.log('🔄 SINCRONIZAÇÃO: Vendas Antigas da Appmax\n')
  console.log('='.repeat(60))
  
  // 1. Verificar se o servidor está rodando
  console.log('\n1️⃣ VERIFICAR SE O SERVIDOR ESTÁ RODANDO')
  console.log('-'.repeat(60))
  
  try {
    const response = await fetch('http://localhost:3000/api/webhooks/appmax', {
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
  
  // 2. Verificar variáveis de ambiente
  console.log('\n2️⃣ VERIFICAR VARIÁVEIS DE AMBIENTE')
  console.log('-'.repeat(60))
  
  const hasToken = envVars.APPMAX_TOKEN || envVars.APPMAX_API_KEY
  if (hasToken) {
    console.log('✅ APPMAX_TOKEN configurado:', hasToken.slice(0, 10) + '...')
  } else {
    console.error('❌ APPMAX_TOKEN não configurado no .env.local!')
    console.log('\n💡 Adicione no .env.local:')
    console.log('APPMAX_TOKEN=seu-token-aqui')
    process.exit(1)
  }
  
  // 3. Buscar vendas antigas
  console.log(`\n3️⃣ SINCRONIZAR VENDAS DOS ÚLTIMOS ${days} DIAS`)
  console.log('-'.repeat(60))
  console.log(`⏳ Buscando pedidos na Appmax...`)
  console.log(`📡 Endpoint: ${SYNC_URL}`)
  
  try {
    const response = await fetch(SYNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ days, force: true })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      console.error('❌ Erro na sincronização:', data.error || response.statusText)
      console.log('\n💡 Verifique:')
      console.log('  1. Se o APPMAX_TOKEN está correto')
      console.log('  2. Se a API da Appmax está acessível')
      console.log('  3. Os logs do servidor (terminal do npm run dev)')
      return
    }
    
    console.log('\n✅ SINCRONIZAÇÃO CONCLUÍDA!')
    console.log('-'.repeat(60))
    console.log(`Total de pedidos encontrados: ${data.stats?.total || 0}`)
    console.log(`✅ Importados com sucesso: ${data.stats?.successful || 0}`)
    console.log(`❌ Falhas: ${data.stats?.failed || 0}`)
    
    if (data.stats?.results && data.stats.results.length > 0) {
      console.log('\n📋 DETALHES DOS PEDIDOS:')
      console.log('-'.repeat(60))
      
      // Mostrar apenas os primeiros 10 pedidos
      const results = data.stats.results.slice(0, 10)
      results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌'
        console.log(`${status} Pedido ${result.orderId}`)
        if (result.error) {
          console.log(`   Erro: ${result.error}`)
        }
      })
      
      if (data.stats.results.length > 10) {
        console.log(`\n... e mais ${data.stats.results.length - 10} pedidos`)
      }
    }
    
    // 4. Verificar no banco
    console.log('\n4️⃣ VERIFICAR DADOS NO BANCO')
    console.log('-'.repeat(60))
    console.log('Execute este comando para verificar:')
    console.log('  node scripts/diagnostico-appmax-dashboard.js')
    
  } catch (error) {
    console.error('❌ Erro ao sincronizar:', error.message)
    console.log('\n💡 Verifique:')
    console.log('  1. Se o servidor está rodando (npm run dev)')
    console.log('  2. Se o endpoint /api/admin/sync-appmax existe')
    console.log('  3. Os logs do servidor')
  }
  
  console.log('\n✅ Processo concluído!')
}

// Processar argumentos da linha de comando
const args = process.argv.slice(2)
const daysArg = args.find(arg => arg.startsWith('--days='))
const days = daysArg ? parseInt(daysArg.split('=')[1]) : 90

console.log('📅 Período de sincronização:', days, 'dias')
console.log('💡 Para mudar o período: node scripts/sincronizar-appmax.js --days=60\n')

syncAppmaxSales(days).catch(error => {
  console.error('\n💥 ERRO CRÍTICO:', error)
  process.exit(1)
})
