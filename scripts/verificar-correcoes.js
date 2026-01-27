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
  console.log('\n✅ VENDAS APPMAX ATUALIZADAS:\n')
  
  const { data } = await supabase
    .from('sales')
    .select('customer_name, payment_method, status, failure_reason')
    .eq('payment_gateway', 'appmax')
    .limit(15)
    .order('created_at', { ascending: false })
    
  data.forEach((s, i) => {
    const emoji = {
      'pix': '💠',
      'credit_card': '💳',
      'boleto': '📄'
    }[s.payment_method] || '❓'
    
    console.log(`${i+1}. ${s.customer_name}`)
    console.log(`   ${emoji} Método: ${s.payment_method}`)
    console.log(`   Status: ${s.status}`)
    console.log(`   Motivo: ${s.failure_reason || 'N/A'}`)
    console.log('')
  })
})()
