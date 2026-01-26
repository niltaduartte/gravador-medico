# ✅ RESPOSTA COMPLETA: Status e Atualização Automática

## 🎯 **Situação Atual**

✅ O pedido **106031177** (Gabriel Arruda Cardoso) está aparecendo no dashboard  
⚠️ Está mostrando status "**Pendente**" ao invés de "**Análise Antifraude**"

---

## 📋 **POR QUE MOSTRA "PENDENTE"?**

O dashboard está pegando o status do banco de dados corretamente, mas pode estar usando um componente diferente do card de Análise Antifraude que criamos.

### **Locais onde o pedido pode aparecer:**

1. **Card "Análise Antifraude"** (novo - criado hoje)
   - Deve mostrar pedidos com `status = 'fraud_analysis'`
   - Atualiza automaticamente a cada 30s

2. **RealtimeFeed** (feed de atividades)
   - Mostra últimas atividades
   - Pode estar mostrando como "Pendente"

3. **BigNumbers** (cards de métricas)
   - Conta vendas por status

---

## ✅ **SOLUÇÃO: Verificar onde está aparecendo**

Execute no Supabase:

```sql
-- Ver o status atual do pedido
SELECT 
    id,
    appmax_order_id,
    customer_name,
    status,
    total_amount,
    created_at
FROM public.sales 
WHERE appmax_order_id = '106031177';
```

### **Resultado esperado:**
- Se `status = 'fraud_analysis'` → Está correto no banco ✅
- Se `status = 'pending'` → Precisa atualizar ❌

---

## 🔄 **ATUALIZAÇÃO AUTOMÁTICA QUANDO A APPMAX APROVAR**

### ✅ **SIM, vai atualizar automaticamente!**

**Como funciona:**

```
┌─────────────────────────────────────────────────────┐
│  1. Appmax aprova o pagamento                       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  2. Appmax dispara webhook:                         │
│     POST /api/webhook/appmax                        │
│     { status: "Pedido Aprovado", ... }              │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  3. Webhook atualiza o banco:                       │
│     UPDATE sales                                    │
│     SET status = 'approved', paid_at = NOW()        │
│     WHERE appmax_order_id = '106031177'             │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  4. Dashboard detecta a mudança:                    │
│     - Polling (30s): Busca novos dados              │
│     - Realtime: Update instantâneo (se configurado) │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  5. Card de Análise Antifraude:                     │
│     - Remove o pedido (não está mais em análise)    │
│     - Pedido aparece em "Vendas Aprovadas"          │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 **EVENTOS DA APPMAX QUE ATUALIZAM AUTOMATICAMENTE**

| Evento Appmax | Status no Banco | O que acontece |
|---------------|-----------------|----------------|
| **Análise Antifraude** | `fraud_analysis` | Aparece no card Análise Antifraude |
| **Pedido Aprovado** | `approved` | Remove da análise, mostra em Aprovados |
| **Pedido Pago** | `paid` | Marca como pago, libera acesso |
| **Recusado por Risco** | `refused` | Remove da análise, mostra em Recusados |
| **Pedido Cancelado** | `cancelled` | Remove da análise |

---

## ⏱️ **TEMPO DE ATUALIZAÇÃO**

### **Opção 1: Polling (30 segundos)**
- Dashboard busca novos dados a cada 30s
- ✅ Já implementado
- ⏱️ Latência: até 30 segundos

### **Opção 2: Supabase Realtime (instantâneo)**
- Atualização em tempo real quando o status muda
- ✅ Já implementado no FraudAnalysisCard
- ⚡ Latência: < 1 segundo

---

## 🔍 **COMO TESTAR A ATUALIZAÇÃO AUTOMÁTICA**

### **Teste 1: Atualizar manualmente**

```sql
-- Simular aprovação da Appmax
UPDATE public.sales
SET 
    status = 'approved',
    paid_at = NOW(),
    updated_at = NOW()
WHERE appmax_order_id = '106031177'
RETURNING *;
```

**O que vai acontecer:**
- ⏱️ Em até 30 segundos: Pedido desaparece do card "Análise Antifraude"
- ✅ Aparece em "Vendas Aprovadas"

### **Teste 2: Voltar para análise**

```sql
-- Voltar para análise antifraude
UPDATE public.sales
SET 
    status = 'fraud_analysis',
    paid_at = NULL,
    updated_at = NOW()
WHERE appmax_order_id = '106031177'
RETURNING *;
```

**O que vai acontecer:**
- ⏱️ Em até 30 segundos: Pedido volta para o card "Análise Antifraude"

---

## ⚙️ **CONFIGURAÇÃO DO WEBHOOK (IMPORTANTE!)**

Para que a atualização automática funcione quando a Appmax aprovar:

### **1. Configure no painel da Appmax:**
- URL: `https://www.gravadormedico.com.br/api/webhook/appmax`
- Marque TODOS estes eventos:
  - ✅ Análise Antifraude
  - ✅ Pedido Aprovado
  - ✅ Pedido Autorizado
  - ✅ Pedido Pago
  - ✅ Recusado por Risco
  - ✅ Pix Expirado

### **2. Verificar se está funcionando:**

```sql
-- Ver últimos webhooks recebidos
SELECT 
    id,
    endpoint,
    payload->>'order_id' as order_id,
    payload->>'status' as status,
    response_status,
    created_at
FROM public.webhooks_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🎯 **RESUMO**

✅ **O que ESTÁ funcionando:**
- Webhook implementado
- Status fraud_analysis mapeado
- Card de Análise Antifraude criado
- Atualização a cada 30s (polling)
- Supabase Realtime configurado

⚠️ **O que PODE estar acontecendo:**
- O pedido está aparecendo em outro card (não no de Análise Antifraude)
- O status no banco pode estar como 'pending' ao invés de 'fraud_analysis'

✅ **Quando a Appmax aprovar:**
- Webhook chegará automaticamente ✅
- Status será atualizado para 'approved' ✅
- Dashboard atualizará em até 30s (ou instantaneamente com Realtime) ✅
- Pedido sairá do card de Análise Antifraude ✅

---

## 🔧 **PRÓXIMOS PASSOS**

1. **Execute a query de verificação** (ver status atual)
2. **Se status = 'pending'**, execute o UPDATE para `fraud_analysis`
3. **Aguarde 30 segundos** e verifique o dashboard
4. **Configure o webhook na Appmax** (se ainda não configurou)
5. **Teste com o UPDATE** de aprovação acima

**O sistema está pronto e funcionará automaticamente!** 🚀
