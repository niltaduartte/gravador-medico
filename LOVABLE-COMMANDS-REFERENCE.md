# 🛠️ COMANDOS ÚTEIS - INTEGRAÇÃO LOVABLE

Referência rápida de comandos para gerenciar a integração.

---

## 📦 INSTALAÇÃO

```bash
# Instalar Resend (se usar e-mail)
npm install resend

# Limpar cache do Next.js
rm -rf .next

# Reinstalar dependências
npm ci
```

---

## 🗄️ BANCO DE DADOS

### Executar Migration
```bash
# Via psql
psql "postgresql://user:pass@host:5432/database" -f database/11-integration-logs.sql

# Via Supabase CLI
supabase db push
```

### Queries Úteis

```sql
-- =====================================================
-- VER ÚLTIMOS LOGS
-- =====================================================
SELECT 
  created_at,
  action,
  status,
  recipient_email,
  error_message
FROM integration_logs
ORDER BY created_at DESC
LIMIT 20;

-- =====================================================
-- ESTATÍSTICAS POR AÇÃO
-- =====================================================
SELECT 
  action,
  status,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM integration_logs
GROUP BY action, status
ORDER BY action, status;

-- =====================================================
-- TAXA DE SUCESSO GERAL
-- =====================================================
SELECT 
  COUNT(*) as total_logs,
  COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count,
  ROUND(COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
FROM integration_logs;

-- =====================================================
-- LOGS COM ERRO (ÚLTIMAS 24H)
-- =====================================================
SELECT 
  created_at,
  action,
  recipient_email,
  error_message,
  details
FROM integration_logs
WHERE 
  status = 'error' 
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- =====================================================
-- LOGS DE UM USUÁRIO ESPECÍFICO
-- =====================================================
SELECT 
  created_at,
  action,
  status,
  error_message
FROM integration_logs
WHERE recipient_email = 'usuario@exemplo.com'
ORDER BY created_at DESC;

-- =====================================================
-- LIMPAR LOGS ANTIGOS (> 90 dias)
-- =====================================================
DELETE FROM integration_logs
WHERE created_at < NOW() - INTERVAL '90 days';

-- =====================================================
-- VERIFICAR USUÁRIOS CRIADOS (últimos 7 dias)
-- =====================================================
SELECT 
  DATE(created_at) as date,
  COUNT(*) as users_created
FROM integration_logs
WHERE 
  action = 'create_user_auto' 
  AND status = 'success'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- =====================================================
-- E-MAILS ENVIADOS COM SUCESSO
-- =====================================================
SELECT 
  recipient_email,
  created_at,
  details->>'email_type' as email_type
FROM integration_logs
WHERE 
  action = 'send_email' 
  AND status = 'success'
ORDER BY created_at DESC
LIMIT 50;
```

---

## 🌐 TESTAR EDGE FUNCTION

### Listar Usuários
```bash
curl -X GET \
  https://seu-projeto.supabase.co/functions/v1/admin-user-manager \
  -H "x-api-secret: webhook-appmax-2026-secure-key" \
  -H "Content-Type: application/json"
```

### Criar Usuário
```bash
curl -X POST \
  https://seu-projeto.supabase.co/functions/v1/admin-user-manager \
  -H "x-api-secret: webhook-appmax-2026-secure-key" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "novo@exemplo.com",
    "password": "SenhaForte123!",
    "full_name": "Novo Usuário"
  }'
```

### Resetar Senha
```bash
curl -X PATCH \
  https://seu-projeto.supabase.co/functions/v1/admin-user-manager \
  -H "x-api-secret: webhook-appmax-2026-secure-key" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "uuid-do-usuario",
    "newPassword": "NovaSenhaForte123!"
  }'
```

---

## 🔗 TESTAR WEBHOOK LOCAL

### Webhook de Aprovação (Sucesso)
```bash
curl -X POST http://localhost:3000/api/webhooks/appmax \
  -H "Content-Type: application/json" \
  -H "x-appmax-signature: sha256=$(echo -n '{"event":"order.approved","data":{"order_id":"TEST_$(date +%s)","customer_email":"teste@exemplo.com","customer_name":"Cliente Teste","total_amount":197,"payment_method":"credit_card"}}' | openssl dgst -sha256 -hmac 'SEU_WEBHOOK_SECRET' | cut -d ' ' -f2)" \
  -d "{
    \"event\": \"order.approved\",
    \"data\": {
      \"order_id\": \"TEST_$(date +%s)\",
      \"customer_email\": \"teste@exemplo.com\",
      \"customer_name\": \"Cliente Teste\",
      \"total_amount\": 197,
      \"payment_method\": \"credit_card\"
    }
  }"
```

### Webhook de Pagamento (PIX)
```bash
curl -X POST http://localhost:3000/api/webhooks/appmax \
  -H "Content-Type: application/json" \
  -d '{
    "event": "pix.paid",
    "data": {
      "order_id": "TEST_PIX_001",
      "customer_email": "pix@teste.com",
      "customer_name": "Cliente PIX",
      "total_amount": 197,
      "payment_method": "pix"
    }
  }'
```

### Webhook de Erro (Recusado)
```bash
curl -X POST http://localhost:3000/api/webhooks/appmax \
  -H "Content-Type: application/json" \
  -d '{
    "event": "order.rejected",
    "data": {
      "order_id": "TEST_REJECTED_001",
      "customer_email": "rejeitado@teste.com",
      "customer_name": "Cliente Rejeitado",
      "total_amount": 197,
      "payment_method": "credit_card",
      "status": "refused"
    }
  }'
```

---

## 📧 TESTAR ENVIO DE E-MAIL (Se Resend configurado)

### Teste Simples via Node.js
```javascript
// test-email.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

(async function() {
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'noreply@exemplo.com',
    to: 'seu-email@exemplo.com',
    subject: 'Teste de Integração Lovable',
    html: '<h1>✅ E-mail funcionando!</h1><p>Integração OK</p>'
  });

  if (error) {
    console.error('❌ Erro:', error);
  } else {
    console.log('✅ E-mail enviado:', data);
  }
})();
```

```bash
# Executar
node test-email.js
```

---

## 🔍 DEBUG

### Ver Logs do Servidor Next.js
```bash
# Modo desenvolvimento
npm run dev

# Com logs detalhados
DEBUG=* npm run dev

# Apenas erros
npm run dev 2>&1 | grep ERROR
```

### Ver Logs do Webhook em Tempo Real
```bash
# Terminal 1: Servidor rodando
npm run dev

# Terminal 2: Monitorar logs
tail -f .next/server/app/api/webhooks/appmax/route.js
```

### Inspecionar Requests
```bash
# Com httpie (mais legível)
http POST http://localhost:3000/api/webhooks/appmax \
  event=order.approved \
  data:='{"order_id":"TEST","customer_email":"test@test.com","total_amount":197}'

# Com curl verbose
curl -v -X POST http://localhost:3000/api/webhooks/appmax \
  -H "Content-Type: application/json" \
  -d '{"event":"order.approved","data":{"order_id":"TEST"}}'
```

---

## 🧪 TESTAR GERAÇÃO DE SENHA

```javascript
// test-password.js
function generateSecurePassword(length = 12) {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const symbols = '!@#$%&*'
  
  const allChars = lowercase + uppercase + numbers + symbols
  
  let password = ''
  
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]
  
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }
  
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

// Gerar 10 senhas de teste
for (let i = 0; i < 10; i++) {
  console.log(generateSecurePassword(12))
}
```

```bash
node test-password.js
```

---

## 📊 MONITORAMENTO AVANÇADO

### Dashboard de Métricas (SQL)
```sql
-- =====================================================
-- DASHBOARD COMPLETO
-- =====================================================
WITH stats AS (
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as success,
    COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
  FROM integration_logs
  WHERE created_at > NOW() - INTERVAL '24 hours'
),
by_action AS (
  SELECT 
    action,
    COUNT(*) as count,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count
  FROM integration_logs
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY action
)
SELECT 
  'ÚLTIMAS 24H' as period,
  s.total,
  s.success,
  s.errors,
  s.pending,
  ROUND(s.success * 100.0 / NULLIF(s.total, 0), 2) as success_rate
FROM stats s
UNION ALL
SELECT 
  'POR AÇÃO: ' || a.action,
  a.count,
  a.success_count,
  a.count - a.success_count,
  0,
  ROUND(a.success_count * 100.0 / NULLIF(a.count, 0), 2)
FROM by_action a;
```

### Alertas de Erro
```sql
-- =====================================================
-- ALERTAS: Mais de 5 erros na última hora
-- =====================================================
SELECT 
  COUNT(*) as error_count,
  CASE 
    WHEN COUNT(*) > 5 THEN '🚨 CRÍTICO'
    WHEN COUNT(*) > 2 THEN '⚠️ ATENÇÃO'
    ELSE '✅ OK'
  END as alert_level
FROM integration_logs
WHERE 
  status = 'error' 
  AND created_at > NOW() - INTERVAL '1 hour';
```

---

## 🔄 ROTINAS DE MANUTENÇÃO

### Limpeza Semanal
```sql
-- Arquivar logs antigos (> 90 dias)
WITH archived AS (
  SELECT * FROM integration_logs
  WHERE created_at < NOW() - INTERVAL '90 days'
)
-- INSERT INTO integration_logs_archive SELECT * FROM archived;
DELETE FROM integration_logs
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Vacuum e Analyze
```sql
-- Otimizar tabela
VACUUM ANALYZE integration_logs;
```

---

## 🚀 DEPLOY

### Build de Produção
```bash
# Build
npm run build

# Testar build local
npm start

# Deploy (Vercel)
vercel --prod

# Deploy (Docker)
docker build -t meu-app .
docker run -p 3000:3000 meu-app
```

---

## 📝 LOGS E DEBUGGING

### Habilitar Logs Verbose
```env
# .env.local
LOG_LEVEL=debug
DEBUG=appmax:*,lovable:*
```

### Ver Payloads Completos
```javascript
// Adicionar em lib/appmax-webhook.ts (temporário)
console.log('📦 Payload completo:', JSON.stringify(payload, null, 2))
```

---

## 🔐 SEGURANÇA

### Rotacionar API Secret
```bash
# 1. Gerar novo secret
openssl rand -hex 32

# 2. Atualizar em:
#    - services/lovable-integration.ts
#    - docs/lovable-edge-function.ts
#    - Redeploy Edge Function

# 3. Testar nova secret
curl -X GET \
  https://seu-projeto.supabase.co/functions/v1/admin-user-manager \
  -H "x-api-secret: SEU_NOVO_SECRET"
```

---

## 📞 SUPORTE

### Informações para Debug
```bash
# Versão do Node
node --version

# Versão do Next.js
npm list next

# Verificar ENV
env | grep LOVABLE
env | grep RESEND

# Listar rotas disponíveis
npm run dev -- --inspect
```

---

**💡 TIP:** Salve este arquivo nos seus favoritos para referência rápida!
