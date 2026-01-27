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
  console.log('🔍 Buscando estrutura de pedidos da Appmax...\n')
  
  const response = await fetch(`${APPMAX_API_URL}/order?limit=2&page=1`, {
    headers: {
      'access-token': APPMAX_TOKEN,
      'Content-Type': 'application/json'
    }
  })
  
  const result = await response.json()
  const orders = result.data?.data || []
  
  if (orders.length > 0) {
    console.log('📦 ESTRUTURA DE UM PEDIDO:\n')
    console.log(JSON.stringify(orders[0], null, 2))
    
    console.log('\n\n🔍 CAMPOS DE CLIENTE DISPONÍVEIS:\n')
    const order = orders[0]
    console.log('order.customer_name:', order.customer_name)
    console.log('order.customer?.name:', order.customer?.name)
    console.log('order.customers?.[0]?.name:', order.customers?.[0]?.name)
    console.log('order.name:', order.name)
    console.log('order.client_name:', order.client_name)
    
    console.log('\n📧 CAMPOS DE EMAIL:\n')
    console.log('order.customer_email:', order.customer_email)
    console.log('order.customer?.email:', order.customer?.email)
    console.log('order.customers?.[0]?.email:', order.customers?.[0]?.email)
    console.log('order.email:', order.email)
  }
})()
