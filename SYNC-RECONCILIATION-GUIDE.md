# 🚀 SISTEMA DE SINCRONIZAÇÃO E RECONCILIAÇÃO

## ✅ O QUE FOI IMPLEMENTADO

### 1. **API de Reconciliação Automática** (`/api/cron/sync-transactions`)

**Função:** Verifica pedidos pendentes e corrige divergências automaticamente.

**Como Funciona:**
1. Busca pedidos com status `pending`, `pending_payment` ou `processing` (últimas 24h)
2. Consulta status real na API do Mercado Pago e Appmax
3. Se houver divergência (ex: banco diz "pending" mas MP diz "approved"):
   - Atualiza o status no banco
   - Registra log da correção
   - **Se mudou para "paid": Executa provisionamento (entrega do produto)**
   - Invalida cache do dashboard

**Segurança:** Protegido por `CRON_SECRET` no header `Authorization`

**Como Configurar no Vercel:**

```bash
# 1. Adicionar variável de ambiente
CRON_SECRET=seu-token-secreto-aqui-123456789

# 2. Criar Cron Job na Vercel (vercel.json já configurado)
# O cron roda automaticamente a cada 6 horas

# 3. Testar manualmente:
curl -X GET https://seu-dominio.vercel.app/api/cron/sync-transactions \
  -H "Authorization: Bearer seu-token-secreto-aqui-123456789"
```

**Retorno:**
```json
{
  "success": true,
  "processed": 15,
  "updated": 3,
  "details": [
    {
      "orderId": "abc123",
      "oldStatus": "pending",
      "newStatus": "paid",
      "gateway": "mercadopago",
      "fixed": true,
      "provisioned": true
    }
  ],
  "timestamp": "2026-01-27T10:30:00Z"
}
```

---

### 2. **APIs de Sincronização Paginadas**

#### **GET /api/sync/mercadopago?offset=0&limit=50**

**Função:** Importa histórico do Mercado Pago em lotes de 50 pagamentos.

**Parâmetros:**
- `offset` (number): Posição inicial (0, 50, 100, etc.)
- `limit` (number): Quantidade por lote (padrão: 50)

**Retorno:**
```json
{
  "success": true,
  "processed": 50,
  "created": 30,
  "updated": 20,
  "errors": 0,
  "has_more": true,
  "next_offset": 50,
  "total": 2500
}
```

**Características:**
- ✅ UPSERT automático (não duplica vendas)
- ✅ Usa `external_id` como chave única
- ✅ Mapeia status corretamente (approved → paid)
- ✅ Importa últimos 90 dias

---

#### **GET /api/sync/appmax?page=1&limit=50**

**Função:** Importa histórico da Appmax em lotes de 50 pedidos.

**Parâmetros:**
- `page` (number): Número da página (1, 2, 3, etc.)
- `limit` (number): Quantidade por lote (padrão: 50)

**Retorno:**
```json
{
  "success": true,
  "processed": 50,
  "created": 25,
  "updated": 25,
  "errors": 0,
  "has_more": true,
  "next_page": 2
}
```

**Características:**
- ✅ UPSERT automático (não duplica vendas)
- ✅ Usa `appmax_order_id` como chave única
- ✅ Mapeia status corretamente
- ✅ Importa TODO o histórico

---

### 3. **SyncManager Component** (Frontend)

**Localização:** `components/dashboard/SyncManager.tsx`

**Função:** Gerencia sincronização em lotes com loop recursivo.

**Features:**
- ✅ **Loop Recursivo Automático**: Busca lote → Aguarda 1s → Busca próximo lote
- ✅ **Progresso em Tempo Real**: "Processando lote 3... (150 vendas)"
- ✅ **Barra de Progresso Visual**: 0% → 100%
- ✅ **Estatísticas Detalhadas**: Processadas, Criadas, Atualizadas
- ✅ **Retry Automático**: Tenta 2x em caso de erro
- ✅ **Rate Limiting**: 1 segundo entre lotes (evita ban da API)
- ✅ **Toast de Feedback**: Sucesso ou erro

**Como Usar no Dashboard:**

```tsx
// app/admin/dashboard/page.tsx

import { SyncManager } from '@/components/dashboard/SyncManager'

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Outros componentes */}
      
      <SyncManager />
      
      {/* BigNumbers, Gráficos, etc */}
    </div>
  )
}
```

**Experiência do Usuário:**

1. Usuário clica em "Iniciar Sincronização" (Mercado Pago ou Appmax)
2. Botão fica desabilitado com spinner "Sincronizando..."
3. Progress bar começa a subir: 0% → 5% → 10%...
4. Texto atualiza: "Processando lote 1... (50 vendas)"
5. Números sobem em tempo real: "150 Processadas | 90 Criadas | 60 Atualizadas"
6. Quando termina: "✅ Sincronização concluída! Total: 2500 vendas"
7. Toast: "Mercado Pago sincronizado! 2500 vendas importadas"
8. Cache invalidado automaticamente → Dashboard atualiza

---

### 4. **ReconciliationButton Component**

**Localização:** `components/dashboard/ReconciliationButton.tsx`

**Função:** Botão para disparar reconciliação manual.

**Como Usar:**

```tsx
// app/admin/dashboard/page.tsx

import { ReconciliationButton } from '@/components/dashboard/ReconciliationButton'

export default function Dashboard() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>Dashboard</h1>
        
        {/* Botão de Reconciliação */}
        <ReconciliationButton />
      </div>
      
      {/* Resto do dashboard */}
    </div>
  )
}
```

**Quando Usar:**
- Cliente reclama que não recebeu acesso
- Suspeita de webhook perdido
- Após resolver problema técnico (downtime)
- Quiser verificar se há vendas pagas não processadas

---

## 📋 VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```bash
# API Tokens
MERCADOPAGO_ACCESS_TOKEN=seu-token-mp
APPMAX_TOKEN=seu-token-appmax

# Cron Secret (gere um UUID aleatório)
CRON_SECRET=abc123xyz-seu-secret-aqui-456789

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# (Opcional) Para teste manual no client-side
NEXT_PUBLIC_CRON_SECRET=mesmo-valor-do-CRON_SECRET
```

---

## 🔄 CONFIGURAR CRON JOB NA VERCEL

**Opção 1: vercel.json (Automático)**

Adicione ao `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-transactions",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Explicação: `0 */6 * * *` = Roda a cada 6 horas

**Opção 2: Plataforma Externa (Cron-Job.org)**

1. Acesse: https://cron-job.org
2. Criar novo job:
   - URL: `https://seu-dominio.vercel.app/api/cron/sync-transactions`
   - Method: GET
   - Headers: `Authorization: Bearer SEU_CRON_SECRET`
   - Schedule: `0 */6 * * *` (a cada 6 horas)

---

## 🧪 COMO TESTAR

### 1. **Testar APIs Paginadas**

```bash
# Mercado Pago - Primeiro lote
curl "http://localhost:3000/api/sync/mercadopago?offset=0&limit=10"

# Appmax - Primeira página
curl "http://localhost:3000/api/sync/appmax?page=1&limit=10"
```

### 2. **Testar Reconciliação**

```bash
# Local
curl -X GET http://localhost:3000/api/cron/sync-transactions \
  -H "Authorization: Bearer dev-secret"

# Produção
curl -X GET https://seu-dominio.vercel.app/api/cron/sync-transactions \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

### 3. **Testar Frontend**

```bash
# Rodar dev server
npm run dev

# Abrir http://localhost:3000/admin/dashboard
# Clicar em "Iniciar Sincronização" nos cards
# Observar progresso em tempo real
```

---

## 🎯 CENÁRIOS DE USO

### **Cenário 1: Importação Inicial (Database Vazio)**

**Problema:** Acabou de configurar o sistema. Precisa importar TODO o histórico.

**Solução:**
1. Abrir dashboard
2. Clicar em "Iniciar Sincronização" no card Mercado Pago
3. Aguardar conclusão (pode levar 5-10 minutos para milhares de vendas)
4. Clicar em "Iniciar Sincronização" no card Appmax
5. Dashboard atualiza automaticamente

**Resultado:** TODO o histórico importado sem timeout!

---

### **Cenário 2: Webhook Perdido**

**Problema:** Cliente comprou mas não recebeu acesso (webhook falhou).

**Solução:**
1. Clicar no botão "Reconciliar Pendentes"
2. Sistema verifica todos os pedidos pendentes nas APIs
3. Encontra que o pagamento foi aprovado
4. Atualiza status para "paid"
5. **Executa provisionamento automaticamente**
6. Cliente recebe acesso

**Resultado:** Problema resolvido em segundos!

---

### **Cenário 3: Manutenção Preventiva (Cron Automático)**

**Problema:** Quer garantir que nenhuma venda seja perdida.

**Solução:**
1. Configurar cron job na Vercel (a cada 6 horas)
2. Sistema verifica automaticamente se há divergências
3. Corrige sozinho, sem intervenção manual
4. Envia notificação se houver correções

**Resultado:** Sistema self-healing! Zero preocupação.

---

## 📊 MONITORAMENTO

### **Logs a Observar:**

```bash
# Ver logs no Vercel
vercel logs --follow

# Buscar por reconciliação
vercel logs | grep RECONCILIATION

# Buscar por sync
vercel logs | grep "SYNC MP"
```

### **Métricas Importantes:**

- **Processed**: Quantos pedidos foram verificados
- **Updated**: Quantos foram corrigidos
- **Provisioned**: Quantos receberam acesso automaticamente

---

## ⚠️ TROUBLESHOOTING

### **"Unauthorized" na API de reconciliação**

**Causa:** CRON_SECRET incorreto ou ausente

**Solução:**
```bash
# Verificar no Vercel Dashboard → Settings → Environment Variables
# CRON_SECRET deve existir

# Se não existir, criar:
vercel env add CRON_SECRET
```

### **Sync trava em "Processando lote X..."**

**Causa:** API do gateway retornou erro 500 ou timeout

**Solução:**
- Aguardar 2 minutos (retry automático)
- Se persistir, clicar novamente (continuará de onde parou)

### **"has_more: false" mas ainda faltam vendas**

**Causa:** API do gateway limitou resultados

**Solução:**
- Appmax: Ajustar filtro de data
- Mercado Pago: Aumentar range de busca

---

## 🎉 BENEFÍCIOS

- ✅ **Zero Timeout**: Importa milhares de vendas sem estourar limite
- ✅ **Self-Healing**: Corrige divergências automaticamente
- ✅ **Transparente**: Progresso em tempo real, usuário sabe o que está acontecendo
- ✅ **Resiliente**: Retry automático, rate limiting, tratamento de erros
- ✅ **Auditável**: Todos os logs registrados em `webhook_logs`
- ✅ **Provisionamento Garantido**: Se webhook falhar, cron corrige e entrega acesso
- ✅ **UX Excelente**: Feedback visual, toasts, estatísticas

---

**Criado por:** Backend Specialist + Fullstack Architect  
**Data:** 27 de janeiro de 2026  
**Stack:** Next.js 16 (App Router) + Supabase + Vercel Cron
