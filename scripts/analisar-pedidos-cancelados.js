#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Carregar .env.local
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

const APPMAX_API_URL = 'https://admin.appmax.com.br/api/v3'
const APPMAX_TOKEN = envVars.APPMAX_TOKEN

;(async () => {
  console.log('🔍 Analisando pedidos cancelados da Appmax...\n')
  
  const response = await fetch(`${APPMAX_API_URL}/order?limit=10&page=1`, {
    headers: {
      'access-token': APPMAX_TOKEN,
      'Content-Type': 'application/json'
    }
  })
  
  const result = await response.json()
  const orders = result.data?.data || []
  
  console.log('📊 AMOSTRA DE PEDIDOS:\n')
  
  orders.forEach((order, i) => {
    console.log(`${i+1}. Pedido #${order.id}`)
    console.log(`   Status: ${order.status}`)
    console.log(`   Tipo Pagamento: ${order.payment_type}`)
    console.log(`   Mensagem: ${order.issuer_message || 'N/A'}`)
    console.log(`   PIX Expirado: ${order.pix_expiration_date || 'N/A'}`)
    console.log(`   Boleto Vencido: ${order.billet_date_overdue || 'N/A'}`)
    console.log('')
  })
})()
