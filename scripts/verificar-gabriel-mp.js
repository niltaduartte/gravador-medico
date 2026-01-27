#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
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

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY)

;(async () => {
  console.log('\n🔍 VENDAS DO GABRIEL NO MERCADO PAGO:\n')
  
  const { data } = await supabase
    .from('sales')
    .select('*')
    .eq('payment_gateway', 'mercadopago')
    .ilike('customer_name', '%gabriel%')
    .order('created_at', { ascending: false })
    
  data.forEach((s, i) => {
    console.log(`${i+1}. ${s.customer_name}`)
    console.log(`   ID: ${s.id}`)
    console.log(`   Email: ${s.customer_email}`)
    console.log(`   Valor: R$ ${Number(s.total_amount || 0).toFixed(2)}`)
    console.log(`   Status: ${s.status}`)
    console.log(`   Order Status: ${s.order_status}`)
    console.log(`   Criado em: ${new Date(s.created_at).toLocaleString('pt-BR')}`)
    console.log('')
  })
  
  console.log(`\nTotal: ${data.length} vendas`)
})()
