# 🔧 SOLUÇÃO: Dashboard Vazio - Dados Não Aparecem

## 🔍 DIAGNÓSTICO COMPLETO

### **Problema Identificado:**
```
✅ Banco de dados: VAZIO (0 vendas)
✅ API Mercado Pago: 2 vendas (mas foram PULADAS porque já existiam)
✅ API Appmax: 0 vendas encontradas
✅ Função SQL: CORRETA (get_analytics_period está funcionando)
```

**Conclusão:** A tabela `sales` está vazia ou foi truncada. Por isso:
- Dashboard mostra **R$ 0** e **0 vendas**
- Gráficos não aparecem
- "Visão Geral" e "Vendas" mostram valores diferentes (cache diferente)

---

## 🚨 POR QUE OS DADOS NÃO FORAM IMPORTADOS?

### **Log da Sincronização:**
```json
{
  "total": 2,
  "created": 0,
  "updated": 0,
  "skipped": 2,  ← PULADAS!
  "errors": 0
}
```

**Motivo:** As vendas já existiam no banco (baseado no `external_id` ou `appmax_order_id`), então foram **puladas (skipped)** para evitar duplicatas. Mas agora o banco está vazio, então elas precisam ser reimportadas.

---

## ✅ SOLUÇÃO: Reimportar Vendas do ZERO

### **Passo 1: Limpar a Tabela Sales (Resetar)**

Execute no **Supabase SQL Editor**:

```sql
-- Backup primeiro (opcional mas recomendado)
CREATE TABLE sales_backup AS SELECT * FROM sales;

-- Limpar tabela completamente
TRUNCATE TABLE sales RESTART IDENTITY CASCADE;

-- Verificar se está vazia
SELECT COUNT(*) FROM sales;  -- Deve retornar 0
```

---

### **Passo 2: Forçar Reimportação (Desabilitar Skip)**

**Opção A: Via Dashboard (Recomendado)**

1. Abra o dashboard: `http://localhost:3000/admin/dashboard`
2. Procure pelos botões de sincronização
3. Clique em **"Sincronizar Mercado Pago"**
4. Aguarde a importação
5. Clique em **"Sincronizar Appmax"**
6. Aguarde a importação

**Opção B: Via API Manual**

```bash
# Sincronizar Mercado Pago
curl -X POST 'http://localhost:3000/api/admin/sync-mercadopago' \
  -H 'Cookie: auth_token=SEU_TOKEN_AQUI' \
  -H 'Content-Type: application/json'

# Sincronizar Appmax
curl -X POST 'http://localhost:3000/api/admin/sync-appmax' \
  -H 'Cookie: auth_token=SEU_TOKEN_AQUI' \
  -H 'Content-Type: application/json'
```

---

### **Passo 3: Verificar Importação**

```bash
# Ver quantas vendas foram importadas
curl -s 'https://egsmraszqnmosmtjuzhx.supabase.co/rest/v1/sales?select=count' \
  -H "apikey: SUA_APIKEY" | jq '.'

# Ver detalhes das vendas
curl -s 'https://egsmraszqnmosmtjuzhx.supabase.co/rest/v1/sales?select=id,order_status,total_amount,payment_gateway&order=created_at.desc&limit=10' \
  -H "apikey: SUA_APIKEY" | jq '.'
```

**Resultado Esperado:**
```json
[
  {
    "id": "uuid-123",
    "order_status": "paid",  ← Status DEVE estar preenchido
    "total_amount": 47,
    "payment_gateway": "mercadopago"
  }
]
```

---

## 🔍 PROBLEMA: Appmax Retorna 0 Vendas

### **Log do Sistema:**
```
✅ [APPMAX] Total de pedidos retornados: 0
✅ [APPMAX] Tipo de data.data: object, é array? false
📅 [APPMAX] Pedidos filtrados (últimos 90 dias): 0
```

**Possíveis Causas:**

1. **Token Appmax Expirado:**
   - Verifique em `.env.local` se o `APPMAX_TOKEN` está atualizado
   - Teste o token manualmente:
   ```bash
   curl 'https://admin.appmax.com.br/api/v3/order?limit=10' \
     -H "Authorization: Bearer SEU_APPMAX_TOKEN"
   ```

2. **Estrutura da API Mudou:**
   - A API retornou `data.data` como **object** em vez de **array**
   - Pode ser que os dados estejam em `data.orders` ou `data.content`
   
   **Solução Temporária:** Verificar resposta manualmente e ajustar código

3. **Sem Pedidos nos Últimos 90 Dias:**
   - Se não houver vendas recentes, aumente o range:
   ```typescript
   // Em app/api/admin/sync-appmax/route.ts
   const cutoffDate = new Date()
   cutoffDate.setDate(cutoffDate.getDate() - 180)  // 180 dias em vez de 90
   ```

---

## 🔧 SE AINDA NÃO FUNCIONAR: Debug Profundo

### **1. Verificar Função SQL:**

```sql
-- Testar a função diretamente
SELECT * FROM get_analytics_period(
  NOW() - INTERVAL '30 days',
  NOW()
);
```

**Resultado Esperado:**
```
unique_visitors | total_sales | paid_sales | failed_sales | total_revenue | ...
----------------|-------------|------------|--------------|---------------|----
       10       |      4      |     2      |      2       |    94.00      | ...
```

Se retornar **todos zeros**, a função está correta mas a tabela `sales` está vazia.

---

### **2. Verificar Cache do Next.js:**

O Next.js usa cache agressivo. Se os dados foram atualizados mas o dashboard ainda mostra zero, limpe o cache:

```bash
# Parar o servidor
Ctrl+C

# Limpar cache do Next.js
rm -rf .next

# Reiniciar
npm run dev
```

---

### **3. Verificar Browser Cache:**

```bash
# No Chrome/Edge:
1. Abrir DevTools (F12)
2. Application → Clear Storage
3. Clear site data
4. Recarregar página (Cmd+Shift+R / Ctrl+Shift+R)
```

---

## 📊 ENTENDENDO OS STATUS

A função SQL `get_analytics_period` usa estes status:

```sql
-- VENDAS PAGAS (contam na receita):
'paid', 'provisioning', 'active', 'approved'

-- VENDAS PENDENTES (não contam):
'pending', 'pending_payment', 'processing'

-- VENDAS FALHADAS (não contam):
'cancelled', 'canceled', 'expired', 'refused', 'rejected', 'failed', 'chargeback'
```

**Importante:** Se as vendas no banco tiverem status diferente (ex: `completed`, `success`), elas **NÃO SERÃO CONTADAS**.

---

## 🎯 SOLUÇÃO RÁPIDA (TL;DR)

```bash
# 1. Limpar banco
echo "TRUNCATE TABLE sales RESTART IDENTITY CASCADE;" | \
  psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# 2. Reimportar vendas
curl -X POST 'http://localhost:3000/api/admin/sync-mercadopago' \
  -H 'Cookie: auth_token=...'

curl -X POST 'http://localhost:3000/api/admin/sync-appmax' \
  -H 'Cookie: auth_token=...'

# 3. Limpar cache
rm -rf .next && npm run dev

# 4. Recarregar dashboard
open http://localhost:3000/admin/dashboard
```

---

## 📝 CHECKLIST DE VERIFICAÇÃO

- [ ] Tabela `sales` tem vendas? (SELECT COUNT(*) FROM sales)
- [ ] Vendas têm `order_status` preenchido?
- [ ] Status está na lista de "paid"? ('paid', 'active', 'approved')
- [ ] Vendas têm `created_at` dentro do período do filtro?
- [ ] Cache do Next.js foi limpo? (rm -rf .next)
- [ ] Browser cache foi limpo? (Cmd+Shift+R)
- [ ] Função SQL retorna dados? (SELECT * FROM get_analytics_period(...))
- [ ] Token Appmax está válido?
- [ ] Token Mercado Pago está válido?

---

## 🔄 PRÓXIMOS PASSOS

Depois que reimportar:

1. **Verificar Dashboard:**
   - "Visão Geral" deve mostrar valores corretos
   - Gráficos devem aparecer
   - "Vendas" deve listar as importadas

2. **Verificar /admin/sales:**
   - Deve listar todas as vendas
   - Valores devem bater com "Visão Geral"

3. **Verificar Performance dos Gateways:**
   - Deve separar Mercado Pago e Appmax
   - Valores devem somar o total da "Visão Geral"

Se tudo funcionar, os dados estarão **unificados** e **consistentes** em todo o painel.

---

**Status:** ✅ Diagnóstico completo | ⏳ Aguardando reimportação  
**Data:** 27 de janeiro de 2026
