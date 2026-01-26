// =====================================================
// SUPABASE EDGE FUNCTION: admin-user-manager
// =====================================================
// Para colar no Lovable (Remote Backend)
// Local: supabase/functions/admin-user-manager/index.ts
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-secret',
}

interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
}

interface ResetPasswordRequest {
  userId: string;
  newPassword: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // =====================================================
    // SEGURANÇA: Validar API Secret
    // =====================================================
    const apiSecret = req.headers.get('x-api-secret')
    const expectedSecret = 'webhook-appmax-2026-secure-key'

    if (apiSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized',
          message: 'Invalid API secret' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // =====================================================
    // INICIALIZAR SUPABASE ADMIN CLIENT
    // =====================================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const method = req.method
    const url = new URL(req.url)

    // =====================================================
    // GET: LISTAR USUÁRIOS
    // =====================================================
    if (method === 'GET') {
      console.log('🔍 Listando usuários...')

      // Buscar usuários do auth.users
      const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()

      if (authError) {
        throw authError
      }

      // Buscar dados complementares da tabela profiles
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('*')

      if (profilesError) {
        throw profilesError
      }

      // Combinar dados
      const users = authUsers.users.map(user => {
        const profile = profiles?.find(p => p.id === user.id)
        
        return {
          id: user.id,
          email: user.email,
          full_name: profile?.full_name || user.user_metadata?.full_name || 'N/A',
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          email_confirmed_at: user.email_confirmed_at,
          role: profile?.role || 'user',
          phone: user.phone || profile?.phone,
        }
      })

      return new Response(
        JSON.stringify({ 
          success: true, 
          users,
          total: users.length 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // =====================================================
    // POST: CRIAR NOVO USUÁRIO
    // =====================================================
    if (method === 'POST') {
      const body: CreateUserRequest = await req.json()
      const { email, password, full_name } = body

      // Validações
      if (!email || !password || !full_name) {
        return new Response(
          JSON.stringify({ 
            error: 'Validation Error',
            message: 'email, password e full_name são obrigatórios' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      console.log('👤 Criando usuário:', email)

      // Criar usuário com email já confirmado
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // ✅ CONFIRMA EMAIL AUTOMATICAMENTE
        user_metadata: {
          full_name
        }
      })

      if (createError) {
        console.error('❌ Erro ao criar usuário:', createError)
        return new Response(
          JSON.stringify({ 
            error: 'Create Error',
            message: createError.message 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Criar/Atualizar profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: newUser.user.id,
          full_name,
          email,
          role: 'user',
          updated_at: new Date().toISOString()
        })

      if (profileError) {
        console.error('⚠️ Erro ao criar profile (usuário criado):', profileError)
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          user: {
            id: newUser.user.id,
            email: newUser.user.email,
            full_name,
            created_at: newUser.user.created_at
          },
          message: 'Usuário criado com sucesso'
        }),
        { 
          status: 201, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // =====================================================
    // PATCH: RESETAR SENHA
    // =====================================================
    if (method === 'PATCH') {
      const body: ResetPasswordRequest = await req.json()
      const { userId, newPassword } = body

      // Validações
      if (!userId || !newPassword) {
        return new Response(
          JSON.stringify({ 
            error: 'Validation Error',
            message: 'userId e newPassword são obrigatórios' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      console.log('🔑 Resetando senha do usuário:', userId)

      // Atualizar senha
      const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      )

      if (updateError) {
        console.error('❌ Erro ao resetar senha:', updateError)
        return new Response(
          JSON.stringify({ 
            error: 'Update Error',
            message: updateError.message 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Senha resetada com sucesso',
          user: {
            id: data.user.id,
            email: data.user.email
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Método não suportado
    return new Response(
      JSON.stringify({ 
        error: 'Method Not Allowed',
        message: `Método ${method} não suportado` 
      }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('💥 Erro interno:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/* =====================================================
   COMO USAR NO LOVABLE:
   =====================================================

   1. No Lovable, vá em "Database" > "Edge Functions"
   2. Crie uma nova função chamada "admin-user-manager"
   3. Cole TODO este código acima
   4. Deploy a função
   5. A URL será: https://seu-projeto.supabase.co/functions/v1/admin-user-manager

   =====================================================
   TESTAR COM CURL:
   =====================================================

   # Listar usuários
   curl -X GET \
     https://seu-projeto.supabase.co/functions/v1/admin-user-manager \
     -H "x-api-secret: webhook-appmax-2026-secure-key"

   # Criar usuário
   curl -X POST \
     https://seu-projeto.supabase.co/functions/v1/admin-user-manager \
     -H "x-api-secret: webhook-appmax-2026-secure-key" \
     -H "Content-Type: application/json" \
     -d '{"email":"novo@exemplo.com","password":"Senha123!","full_name":"Novo Usuário"}'

   # Resetar senha
   curl -X PATCH \
     https://seu-projeto.supabase.co/functions/v1/admin-user-manager \
     -H "x-api-secret: webhook-appmax-2026-secure-key" \
     -H "Content-Type: application/json" \
     -d '{"userId":"uuid-do-usuario","newPassword":"NovaSenha123!"}'

   =====================================================
*/
