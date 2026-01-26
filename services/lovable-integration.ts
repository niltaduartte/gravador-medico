// =====================================================
// SERVIÇO DE INTEGRAÇÃO COM LOVABLE
// =====================================================
// Gerencia toda comunicação com a Edge Function remota
// =====================================================

import { createClient } from '@supabase/supabase-js'

const LOVABLE_EDGE_FUNCTION_URL = process.env.NEXT_PUBLIC_LOVABLE_EDGE_FUNCTION_URL || 
  'https://seu-projeto-lovable.supabase.co/functions/v1/admin-user-manager'

const API_SECRET = 'webhook-appmax-2026-secure-key'

// Cliente Supabase local para logs
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// =====================================================
// TIPOS
// =====================================================

export interface LovableUser {
  id: string
  email: string
  full_name: string
  created_at: string
  last_sign_in_at?: string
  email_confirmed_at?: string
  role?: string
  phone?: string
}

export interface CreateUserPayload {
  email: string
  password: string
  full_name: string
}

export interface ResetPasswordPayload {
  userId: string
  newPassword: string
}

export interface IntegrationLog {
  id?: string
  created_at?: string
  action: string
  status: 'success' | 'error' | 'pending'
  details?: Record<string, any>
  recipient_email?: string
  user_id?: string
  error_message?: string
  http_status_code?: number
  request_payload?: Record<string, any>
  response_payload?: Record<string, any>
}

// =====================================================
// FUNÇÃO AUXILIAR: Registrar Log no Banco Local
// =====================================================

async function logAction(log: IntegrationLog): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('integration_logs')
      .insert(log)
      .select('id')
      .single()

    if (error) {
      console.error('❌ Erro ao registrar log:', error)
      return null
    }

    return data.id
  } catch (error) {
    console.error('💥 Erro ao registrar log:', error)
    return null
  }
}

// =====================================================
// LISTAR USUÁRIOS
// =====================================================

export async function listLovableUsers(): Promise<{
  success: boolean
  users?: LovableUser[]
  error?: string
}> {
  const startTime = Date.now()
  
  try {
    console.log('🔍 Buscando usuários do Lovable...')

    const response = await fetch(LOVABLE_EDGE_FUNCTION_URL, {
      method: 'GET',
      headers: {
        'x-api-secret': API_SECRET,
        'Content-Type': 'application/json',
      },
    })

    const duration = Date.now() - startTime
    const data = await response.json()

    // Log da ação
    await logAction({
      action: 'list_users',
      status: response.ok ? 'success' : 'error',
      details: { duration, total_users: data.users?.length || 0 },
      http_status_code: response.status,
      response_payload: data,
    })

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao listar usuários')
    }

    return {
      success: true,
      users: data.users,
    }
  } catch (error: any) {
    console.error('❌ Erro ao listar usuários:', error)

    await logAction({
      action: 'list_users',
      status: 'error',
      error_message: error.message,
      details: { duration: Date.now() - startTime },
    })

    return {
      success: false,
      error: error.message,
    }
  }
}

// =====================================================
// CRIAR USUÁRIO
// =====================================================

export async function createLovableUser(payload: CreateUserPayload): Promise<{
  success: boolean
  user?: LovableUser
  error?: string
}> {
  const startTime = Date.now()

  try {
    console.log('👤 Criando usuário no Lovable:', payload.email)

    const response = await fetch(LOVABLE_EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'x-api-secret': API_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const duration = Date.now() - startTime
    const data = await response.json()

    // Log da ação
    await logAction({
      action: 'create_user',
      status: response.ok ? 'success' : 'error',
      recipient_email: payload.email,
      user_id: data.user?.id,
      details: { duration, full_name: payload.full_name },
      http_status_code: response.status,
      request_payload: { email: payload.email, full_name: payload.full_name }, // Não loga senha
      response_payload: data,
    })

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao criar usuário')
    }

    return {
      success: true,
      user: data.user,
    }
  } catch (error: any) {
    console.error('❌ Erro ao criar usuário:', error)

    await logAction({
      action: 'create_user',
      status: 'error',
      recipient_email: payload.email,
      error_message: error.message,
      details: { duration: Date.now() - startTime },
    })

    return {
      success: false,
      error: error.message,
    }
  }
}

// =====================================================
// RESETAR SENHA
// =====================================================

export async function resetLovableUserPassword(payload: ResetPasswordPayload): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  const startTime = Date.now()

  try {
    console.log('🔑 Resetando senha do usuário:', payload.userId)

    const response = await fetch(LOVABLE_EDGE_FUNCTION_URL, {
      method: 'PATCH',
      headers: {
        'x-api-secret': API_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const duration = Date.now() - startTime
    const data = await response.json()

    // Log da ação
    await logAction({
      action: 'reset_password',
      status: response.ok ? 'success' : 'error',
      user_id: payload.userId,
      details: { duration },
      http_status_code: response.status,
      request_payload: { userId: payload.userId }, // Não loga senha
      response_payload: data,
    })

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao resetar senha')
    }

    return {
      success: true,
      message: data.message,
    }
  } catch (error: any) {
    console.error('❌ Erro ao resetar senha:', error)

    await logAction({
      action: 'reset_password',
      status: 'error',
      user_id: payload.userId,
      error_message: error.message,
      details: { duration: Date.now() - startTime },
    })

    return {
      success: false,
      error: error.message,
    }
  }
}

// =====================================================
// BUSCAR LOGS (Para tela de auditoria)
// =====================================================

export async function getIntegrationLogs(filters?: {
  action?: string
  status?: string
  limit?: number
}): Promise<{
  success: boolean
  logs?: IntegrationLog[]
  error?: string
}> {
  try {
    let query = supabase
      .from('integration_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(filters?.limit || 100)

    if (filters?.action) {
      query = query.eq('action', filters.action)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return {
      success: true,
      logs: data,
    }
  } catch (error: any) {
    console.error('❌ Erro ao buscar logs:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

// =====================================================
// GERAR SENHA SEGURA
// =====================================================

export function generateSecurePassword(length = 12): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const symbols = '!@#$%&*'
  
  const allChars = lowercase + uppercase + numbers + symbols
  
  let password = ''
  
  // Garantir pelo menos um de cada tipo
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]
  
  // Preencher o restante
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }
  
  // Embaralhar
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}
