# 🚀 INTEGRAÇÃO LOVABLE - GUIA COMPLETO DE IMPLEMENTAÇÃO

## 📋 ÍNDICE
1. [Visão Geral](#visão-geral)
2. [Arquivos Criados](#arquivos-criados)
3. [Configuração do Lovable](#configuração-do-lovable)
4. [Configuração do Dashboard](#configuração-do-dashboard)
5. [Como Testar](#como-testar)
6. [Fluxo Automático](#fluxo-automático)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 VISÃO GERAL

Esta implementação transforma seu Dashboard em um **gerenciador SaaS completo**, com:

- ✅ **Criação automática de usuários** no Lovable após pagamento aprovado
- ✅ **Envio automático de e-mail** com login e senha
- ✅ **Painel administrativo** para gerenciar usuários
- ✅ **Logs completos** de todas as operações
- ✅ **Reset de senha** via interface
- ✅ **Auditoria completa** de integrações

---

## 📦 ARQUIVOS CRIADOS

### 1. **Banco de Dados**
```
database/11-integration-logs.sql
```
- Cria tabela `integration_logs`
- Função auxiliar `log_integration_action()`
- Políticas RLS de segurança

### 2. **Edge Function (Para o Lovable)**
```
docs/lovable-edge-function.ts
```
- Gerencia usuários remotos (GET/POST/PATCH)
- Segurança via `x-api-secret`
- Confirma email automaticamente

### 3. **Serviço de Integração**
```
services/lovable-integration.ts
```
- Comunica com Edge Function
- Registra logs automaticamente
- Gera senhas seguras

### 4. **Páginas do Dashboard**
```
app/admin/lovable/users/page.tsx
app/admin/lovable/emails/page.tsx
```
- Interface completa para gerenciar usuários
- Visualização de logs e auditoria

### 5. **Componentes UI**
```
components/ui/select.tsx (criado)
components/Sidebar.tsx (atualizado)
```
- Sidebar com nova seção "LOVABLE"
- Componente Select para filtros

### 6. **Webhook Atualizado**
```
lib/appmax-webhook.ts
```
- Cria usuário automaticamente na aprovação
- Envia e-mail com credenciais

---

## 🔧 CONFIGURAÇÃO DO LOVABLE

### Passo 1: Criar a Edge Function

1. Acesse seu projeto no **Lovable**
2. Vá em **Database** → **Edge Functions**
3. Clique em **"New Function"**
4. Nome: `admin-user-manager`
5. Cole TODO o conteúdo de `docs/lovable-edge-function.ts`
6. Clique em **Deploy**

### Passo 2: Obter a URL da Edge Function

Após deploy, você terá uma URL como:
```
https://seu-projeto.supabase.co/functions/v1/admin-user-manager
```

### Passo 3: Testar a Edge Function

```bash
# Testar listagem de usuários
curl -X GET \
  https://seu-projeto.supabase.co/functions/v1/admin-user-manager \
  -H "x-api-secret: webhook-appmax-2026-secure-key"

# Deve retornar: { "success": true, "users": [...], "total": X }
```

---

## ⚙️ CONFIGURAÇÃO DO DASHBOARD

### Passo 1: Rodar a Migration SQL

```bash
# No terminal do seu projeto
psql "sua-connection-string" -f database/11-integration-logs.sql

# OU via Supabase Dashboard:
# - Vá em SQL Editor
# - Cole o conteúdo do arquivo
# - Execute
```

### Passo 2: Configurar Variáveis de Ambiente

Adicione no `.env.local`:

```env
# =====================================================
# INTEGRAÇÃO LOVABLE
# =====================================================
NEXT_PUBLIC_LOVABLE_EDGE_FUNCTION_URL=https://seu-projeto.supabase.co/functions/v1/admin-user-manager
NEXT_PUBLIC_LOVABLE_APP_URL=https://seu-app.lovable.app

# =====================================================
# E-MAIL (RESEND)
# =====================================================
RESEND_API_KEY=re_seu_key_aqui
EMAIL_FROM=noreply@seudominio.com

# OU, se preferir SMTP:
# SMTP_HOST=smtp.seuservidor.com
# SMTP_PORT=587
# SMTP_USER=seu-usuario
# SMTP_PASS=sua-senha
```

### Passo 3: Instalar Dependências (se necessário)

```bash
# Se você usar Resend para envio de e-mail:
npm install resend

# Caso contrário, o sistema funcionará sem e-mail
# (apenas criará o usuário)
```

### Passo 4: Reiniciar o Servidor

```bash
npm run dev
```

---

## 🧪 COMO TESTAR

### Teste 1: Criar Usuário Manualmente

1. Acesse: `http://localhost:3000/admin/lovable/users`
2. Clique em **"Novo Usuário"**
3. Preencha:
   - Nome: `João Teste`
   - Email: `joao@teste.com`
   - Senha: Clique em **🎲 Gerar**
4. Clique em **"Criar Usuário"**
5. Verifique:
   - ✅ Toast de sucesso
   - ✅ Usuário aparece na tabela
   - ✅ Log registrado em `/admin/lovable/emails`

### Teste 2: Resetar Senha

1. Na mesma página, clique em **"Alterar Senha"** em qualquer usuário
2. Clique em **🎲 Gerar** para criar senha nova
3. Clique em **"Alterar Senha"**
4. Verifique o log em `/admin/lovable/emails`

### Teste 3: Fluxo Automático (Webhook)

1. Simule uma venda aprovada:

```bash
curl -X POST http://localhost:3000/api/webhooks/appmax \
  -H "Content-Type: application/json" \
  -H "x-appmax-signature: sha256=$(echo -n '{"event":"order.approved","data":{"order_id":"TEST123","customer_email":"cliente@teste.com","customer_name":"Cliente Teste","total_amount":197}}' | openssl dgst -sha256 -hmac 'seu-webhook-secret' | cut -d ' ' -f2)" \
  -d '{
    "event": "order.approved",
    "data": {
      "order_id": "TEST123",
      "customer_email": "cliente@teste.com",
      "customer_name": "Cliente Teste",
      "total_amount": 197,
      "payment_method": "credit_card"
    }
  }'
```

2. Verifique:
   - ✅ Venda criada em `sales`
   - ✅ Usuário criado no Lovable
   - ✅ E-mail enviado (se configurado)
   - ✅ Logs registrados

---

## 🔄 FLUXO AUTOMÁTICO

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO COMPLETO                            │
└─────────────────────────────────────────────────────────────┘

1. Cliente compra no checkout
   ↓
2. Appmax processa pagamento
   ↓
3. Appmax envia Webhook → `/api/webhooks/appmax`
   ↓
4. Sistema detecta status "approved" ou "paid"
   ↓
5. ✅ Cria venda na tabela `sales`
   ↓
6. 🚀 Gera senha segura (12 caracteres)
   ↓
7. 🔧 Chama Edge Function do Lovable
   └─> POST /admin-user-manager
       └─> Cria usuário com email já confirmado
   ↓
8. 📧 Envia e-mail com:
   ├─> Login (email do cliente)
   ├─> Senha gerada
   └─> Link de acesso
   ↓
9. 📝 Registra tudo em `integration_logs`
   ↓
10. ✅ Cliente recebe e-mail e pode fazer login
```

---

## 🐛 TROUBLESHOOTING

### Erro: "Cannot find module 'resend'"

**Solução:**
```bash
npm install resend
```

Ou remova o bloco de envio de e-mail do webhook se não quiser usar Resend.

---

### Erro: "x-api-secret inválido"

**Causa:** A Edge Function espera o header `x-api-secret: webhook-appmax-2026-secure-key`

**Solução:** Verifique se a URL e o secret estão corretos em:
- `services/lovable-integration.ts` (linha 8-9)
- `docs/lovable-edge-function.ts` (linha 34)

---

### Usuários não aparecem na lista

**Diagnóstico:**
1. Verifique se a Edge Function está deployada no Lovable
2. Teste a URL diretamente:
   ```bash
   curl -X GET \
     https://seu-projeto.supabase.co/functions/v1/admin-user-manager \
     -H "x-api-secret: webhook-appmax-2026-secure-key"
   ```
3. Verifique os logs em `/admin/lovable/emails`

---

### E-mail não é enviado

**Diagnóstico:**
1. Verifique se `RESEND_API_KEY` está configurado
2. Verifique se `EMAIL_FROM` é um domínio verificado no Resend
3. Confira os logs em `/admin/lovable/emails` → Filtre por `send_email`

**Alternativa:** Se não configurar e-mail, o sistema apenas cria o usuário (você pode enviar as credenciais manualmente depois).

---

### Webhook não cria usuário automaticamente

**Diagnóstico:**
1. Verifique se o webhook está recebendo eventos:
   ```bash
   # Ver logs do webhook
   tail -f .next/server/app/api/webhooks/appmax/route.js
   ```
2. Confira se o status é `approved` ou `paid`
3. Verifique os logs em `integration_logs`:
   ```sql
   SELECT * FROM integration_logs 
   WHERE action = 'create_user_auto' 
   ORDER BY created_at DESC LIMIT 10;
   ```

---

## 🎉 CONCLUSÃO

Parabéns! Você agora tem um sistema SaaS completo com:

- ✅ Criação automática de usuários
- ✅ Envio de credenciais por e-mail
- ✅ Painel administrativo profissional
- ✅ Auditoria completa de operações
- ✅ Gerenciamento de senhas
- ✅ Logs detalhados

**Próximos Passos:**
1. Personalize o template de e-mail
2. Configure seu domínio no Resend
3. Teste com vendas reais
4. Monitore os logs regularmente

---

## 📞 SUPORTE

Se tiver dúvidas:
1. Verifique os logs em `/admin/lovable/emails`
2. Consulte este guia
3. Revise as mensagens de erro no console

**Boa sorte com sua integração! 🚀**
