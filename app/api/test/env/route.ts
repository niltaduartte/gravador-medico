import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const token = process.env.APPMAX_API_TOKEN
    
    return NextResponse.json({
      APPMAX_API_TOKEN: token ? `✅ Configurado (${token.substring(0, 8)}...)` : '❌ NÃO configurado',
      APPMAX_PRODUCT_ID: process.env.APPMAX_PRODUCT_ID || '❌ NÃO configurado',
      APPMAX_ORDER_BUMP_1_ID: process.env.APPMAX_ORDER_BUMP_1_ID || '❌ NÃO configurado',
      APPMAX_ORDER_BUMP_2_ID: process.env.APPMAX_ORDER_BUMP_2_ID || '❌ NÃO configurado',
      APPMAX_ORDER_BUMP_3_ID: process.env.APPMAX_ORDER_BUMP_3_ID || '❌ NÃO configurado',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
