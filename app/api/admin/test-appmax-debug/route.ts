import { NextRequest, NextResponse } from 'next/server'

/**
 * Debug COMPLETO da integração Appmax
 */

const APPMAX_API_TOKEN = process.env.APPMAX_API_TOKEN || ''

export async function GET(request: NextRequest) {
  try {
    const results: any[] = []

    // Informações da chave
    const tokenInfo = {
      exists: !!APPMAX_API_TOKEN,
      length: APPMAX_API_TOKEN.length,
      last4: APPMAX_API_TOKEN.slice(-4),
      first4: APPMAX_API_TOKEN.slice(0, 4),
      hasSpaces: APPMAX_API_TOKEN.includes(' '),
      hasLineBreaks: APPMAX_API_TOKEN.includes('\n') || APPMAX_API_TOKEN.includes('\r'),
      format: /^[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/.test(APPMAX_API_TOKEN) ? 'UUID válido' : 'Formato não reconhecido'
    }

    results.push({ test: 'Token Info', result: tokenInfo })

    // Teste 1: GET /order (v3) com Bearer
    try {
      const url = 'https://admin.appmax.com.br/api/v3/order?limit=1&offset=0'
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${APPMAX_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
      results.push({
        test: 'GET /v3/order com Bearer',
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: data
      })
    } catch (e: any) {
      results.push({
        test: 'GET /v3/order com Bearer',
        error: e.message
      })
    }

    // Teste 2: GET /order (v3) sem Bearer (só token)
    try {
      const url = 'https://admin.appmax.com.br/api/v3/order?limit=1&offset=0'
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': APPMAX_API_TOKEN,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
      const data = await response.json()
      results.push({
        test: 'GET /v3/order SEM Bearer (token direto)',
        status: response.status,
        body: data
      })
    } catch (e: any) {
      results.push({
        test: 'GET /v3/order SEM Bearer',
        error: e.message
      })
    }

    // Teste 3: GET /order (v3) com header X-API-Key
    try {
      const url = 'https://admin.appmax.com.br/api/v3/order?limit=1&offset=0'
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': APPMAX_API_TOKEN,
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()
      results.push({
        test: 'GET /v3/order com X-API-Key',
        status: response.status,
        body: data
      })
    } catch (e: any) {
      results.push({
        test: 'GET /v3/order com X-API-Key',
        error: e.message
      })
    }

    // Teste 4: GET /order (v3) com token na query string
    try {
      const url = `https://admin.appmax.com.br/api/v3/order?limit=1&offset=0&token=${APPMAX_API_TOKEN}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()
      results.push({
        test: 'GET /v3/order com token na query string',
        status: response.status,
        body: data
      })
    } catch (e: any) {
      results.push({
        test: 'GET /v3/order com token na query',
        error: e.message
      })
    }

    // Teste 5: Endpoint de health/status (se existir)
    try {
      const url = 'https://admin.appmax.com.br/api/v3/status'
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${APPMAX_API_TOKEN}`
        }
      })
      const data = await response.json()
      results.push({
        test: 'GET /v3/status (health check)',
        status: response.status,
        body: data
      })
    } catch (e: any) {
      results.push({
        test: 'GET /v3/status',
        error: e.message
      })
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      results
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
