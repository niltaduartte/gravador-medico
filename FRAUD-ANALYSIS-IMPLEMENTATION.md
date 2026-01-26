# 🛡️ IMPLEMENTAÇÃO: Status de Análise Antifraude

**Data:** 26/01/2026  
**Status:** ✅ Implementado

---

## 📋 O Que Foi Feito

### 1. **Webhook Atualizado** (`lib/appmax-webhook.ts`)

Adicionado suporte ao status "Análise Antifraude" da Appmax:

```typescript
const EVENT_STATUS_MAP: Record<string, { status: string; failure_reason?: string }> = {
  // ... outros status
  
  // ✨ NOVO: Status de Análise Antifraude
  'analise antifraude': { status: 'fraud_analysis' },
  'análise antifraude': { status: 'fraud_analysis' },
  'order.fraud_analysis': { status: 'fraud_analysis' },
  'pendente': { status: 'fraud_analysis' } // Cartão pendente = análise antifraude
}
```

### 2. **Migration SQL** (`database/12-add-fraud-analysis-status.sql`)

- ✅ Comentário atualizado na coluna `status`
- ✅ Índice criado para consultas rápidas
- ✅ View `sales_fraud_analysis` para monitoramento
- ✅ Classificação por urgência (normal, warning, critical)

### 3. **Componente Dashboard** (`components/dashboard/FraudAnalysisCard.tsx`)

Card dedicado que mostra:
- 📊 Total de pedidos em análise
- 💰 Valor total em análise
- ⏱️ Tempo de cada pedido em análise
- 🚨 Alertas de urgência (12h+ = warning, 24h+ = critical)
- 🔄 **Atualização automática a cada 30 segundos**
- ⚡ **Supabase Realtime para updates instantâneos**

### 4. **Dashboard Atualizado** (`app/admin/dashboard/page.tsx`)

- ✅ Card de Análise Antifraude adicionado
- ✅ Atualização em tempo real configurada

---

## 🔍 Como Funciona

### Fluxo de Pedido com Cartão de Crédito

```
┌─────────────────────────────────────────────────────────┐
│  1. Cliente faz pedido com cartão de crédito           │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  2. Appmax recebe e envia para análise antifraude      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  3. Webhook dispara: "Análise Antifraude"              │
│     POST /api/webhook/appmax                           │
│     { status: "Análise Antifraude", ... }              │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  4. Sistema atualiza:                                  │
│     - sales.status = 'fraud_analysis'                  │
│     - Dashboard mostra em tempo real                   │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  5. Após aprovação:                                    │
│     - Webhook: "Pedido Aprovado"                       │
│     - Status muda para 'approved'                      │
│     - Card de análise remove o pedido                  │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Status Suportados pelo Sistema

| Status no Banco | Descrição | Webhook da Appmax |
|-----------------|-----------|-------------------|
| `pending` | Aguardando pagamento (PIX/Boleto) | "Pix Gerado", "Boleto Gerado" |
| **`fraud_analysis`** | **Em análise antifraude (Cartão)** | **"Análise Antifraude"** |
| `approved` | Aprovado | "Pedido Aprovado", "Pedido Autorizado" |
| `paid` | Pago | "Pedido Pago", "Pix Pago" |
| `refused` | Recusado | "Pagamento Recusado" |
| `cancelled` | Cancelado | "Pedido Cancelado" |
| `expired` | Expirado | "Pix Expirado", "Boleto Vencido" |
| `refunded` | Estornado | "Pedido Estornado" |
| `chargeback` | Chargeback | "Pedido Chargeback" |
| `completed` | Completo | - |

---

## 🧪 Como Testar

### Teste 1: Simular Webhook Manualmente

```bash
curl -X POST https://www.gravadormedico.com.br/api/webhook/appmax \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Análise Antifraude",
    "order_id": "12345678",
    "appmax_order_id": "12345678",
    "customer": {
      "name": "Gabriel Arruda Cardoso",
      "email": "gabriel_acardoso@hotmail.com",
      "phone": "11999999999"
    },
    "total_amount": 36.00,
    "payment_method": "credit_card",
    "status": "Análise Antifraude"
  }'
```

### Teste 2: Verificar no Dashboard

1. Acesse: `https://www.gravadormedico.com.br/admin/dashboard`
2. Procure o card "**Análise Antifraude**"
3. Deve mostrar o pedido recém-criado

### Teste 3: Verificar no Banco

```sql
-- Ver vendas em análise antifraude
SELECT * FROM sales_fraud_analysis;

-- Ver contagem por status
SELECT status, COUNT(*) as total 
FROM sales 
GROUP BY status;
```

---

## 🚀 Deploy

### Passo 1: Executar Migration SQL

Execute o arquivo `database/12-add-fraud-analysis-status.sql` no Supabase SQL Editor.

### Passo 2: Verificar Webhook na Appmax

1. Acesse: https://admin.appmax.com.br
2. Vá em **Configurações → Webhooks**
3. Verifique se a URL está configurada:
   ```
   https://www.gravadormedico.com.br/api/webhook/appmax
   ```
4. **IMPORTANTE:** Certifique-se de marcar o evento:
   - ✅ **Análise Antifraude**

### Passo 3: Testar em Produção

Faça um pedido real de teste com cartão de crédito e acompanhe no dashboard.

---

## 📊 Monitoramento

### View SQL Criada: `sales_fraud_analysis`

```sql
SELECT * FROM sales_fraud_analysis;
```

**Campos:**
- `hours_in_analysis`: Tempo em horas desde criação
- `urgency_level`: normal | warning (12h+) | critical (24h+)

---

## 🔧 Configurações de Realtime

### Atualização Automática

O dashboard possui **2 mecanismos** de atualização:

1. **Polling (30s):** A cada 30 segundos busca novos dados
2. **Supabase Realtime:** Updates instantâneos quando um pedido muda para `fraud_analysis`

### Como Funciona o Realtime

```typescript
const channel = supabase
  .channel('fraud-analysis-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'sales',
    filter: 'status=eq.fraud_analysis'
  }, () => {
    loadFraudAnalysisSales() // Recarrega dados
  })
  .subscribe()
```

---

## ⚠️ Importante

### Por que o Dashboard Não Estava Atualizando?

**ANTES:**
- ❌ Sem polling automático
- ❌ Sem Supabase Realtime
- ❌ Status "análise antifraude" não mapeado

**DEPOIS:**
- ✅ Polling a cada 30 segundos
- ✅ Supabase Realtime ativo
- ✅ Status mapeado corretamente
- ✅ Card dedicado no dashboard

---

## 📝 Próximos Passos

- [ ] Adicionar notificação push quando pedido entra em análise
- [ ] Criar alerta por email para pedidos com mais de 24h em análise
- [ ] Dashboard de métricas de antifraude (taxa de aprovação, tempo médio, etc.)
- [ ] Integração com WhatsApp para avisar equipe

---

## 🔗 Links Úteis

- [Documentação Appmax - Status de Pedido](https://help.appmax.com.br/pt-br/central-de-ajuda/status-de-pedido-na-appmax)
- [Dashboard Admin](https://www.gravadormedico.com.br/admin/dashboard)
- [Webhook Appmax](https://www.gravadormedico.com.br/api/webhook/appmax)

---

**Desenvolvido em:** 26/01/2026  
**Por:** GitHub Copilot + Helcio Mattos
