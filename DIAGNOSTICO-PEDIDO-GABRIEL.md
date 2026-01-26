# 🔍 DIAGNÓSTICO: Por que o pedido 106031177 não aparece no painel?

## 📋 Informações do Pedido

- **ID:** 106031177
- **Cliente:** Gabriel Arruda Cardoso
- **Email:** gabriel_acardoso@hotmail.com
- **Valor:** R$ 36,00
- **Status na Appmax:** Análise Antifraude (há 46 minutos)
- **Método:** Cartão de Crédito

---

## 🚨 Possíveis Causas

### 1. **Webhook NÃO foi recebido**
   - ✅ A Appmax ainda não enviou o webhook
   - ✅ O webhook foi enviado, mas falhou
   - ✅ A URL do webhook está incorreta

### 2. **Pedido foi criado, mas com status diferente**
   - ✅ O pedido está com status `pending` ao invés de `fraud_analysis`
   - ✅ O pedido já foi aprovado automaticamente

### 3. **Tabela `sales_fraud_analysis` não foi criada**
   - ✅ A migration SQL não foi executada
   - ✅ A view não existe no banco

---

## 🔧 SOLUÇÃO PASSO A PASSO

### **Passo 1: Execute o diagnóstico no Supabase**

Abra o **Supabase SQL Editor** e execute:

```sql
-- Arquivo: database/DIAGNOSTICO-PEDIDO-106031177.sql

-- Query 1: Verificar se o pedido existe
SELECT * FROM public.sales WHERE appmax_order_id = '106031177';
```

**Resultados possíveis:**

#### ❌ **Se retornar VAZIO:**
→ O webhook **NÃO foi recebido**

**SOLUÇÃO:**
1. Execute a **Query 8** do arquivo de diagnóstico para criar o pedido manualmente
2. Verifique se o webhook está configurado na Appmax

#### ✅ **Se retornar o pedido:**
→ Verifique o **status** retornado

**Se status = `pending` ou `approved`:**
- Execute a Query 8 para atualizar para `fraud_analysis`

**Se status = `fraud_analysis`:**
- O pedido está correto, mas pode não aparecer por outro motivo

---

### **Passo 2: Execute a Migration SQL**

Execute no **Supabase SQL Editor**:

```sql
-- Arquivo: database/12-add-fraud-analysis-status.sql
-- (Execute TODO o conteúdo do arquivo)
```

Isso criará:
- ✅ Comentário na coluna `status`
- ✅ Índice otimizado
- ✅ View `sales_fraud_analysis`

---

### **Passo 3: Criar o pedido manualmente (se não existir)**

Execute no **Supabase SQL Editor**:

```sql
-- Query 8 do DIAGNOSTICO-PEDIDO-106031177.sql

INSERT INTO public.sales (
    appmax_order_id,
    customer_name,
    customer_email,
    total_amount,
    subtotal,
    discount,
    status,
    payment_method,
    created_at
) VALUES (
    '106031177',
    'Gabriel Arruda Cardoso',
    'gabriel_acardoso@hotmail.com',
    36.00,
    36.00,
    0,
    'fraud_analysis',
    'credit_card',
    '2026-01-26 16:29:00'::timestamp
)
ON CONFLICT (appmax_order_id) DO UPDATE
SET 
    status = 'fraud_analysis',
    updated_at = NOW()
RETURNING *;
```

---

### **Passo 4: Verificar se apareceu**

Execute no **Supabase SQL Editor**:

```sql
-- Query 9 do DIAGNOSTICO-PEDIDO-106031177.sql

SELECT * FROM sales_fraud_analysis
ORDER BY created_at DESC
LIMIT 10;
```

**Deve retornar:**
```
| id | appmax_order_id | customer_name           | total_amount | hours_in_analysis | urgency_level |
|----|-----------------|-------------------------|--------------|-------------------|---------------|
| XX | 106031177       | Gabriel Arruda Cardoso  | 36.00        | 0.7               | normal        |
```

---

### **Passo 5: Atualizar o Dashboard**

Abra o dashboard:
```
https://www.gravadormedico.com.br/admin/dashboard
```

Procure o card **"Análise Antifraude"** - o pedido deve aparecer lá!

Se não aparecer:
1. Aguarde 30 segundos (atualização automática)
2. Pressione F5 (recarregar página)
3. Verifique o console do navegador (F12) para erros

---

## 🔍 Checklist de Verificação

Execute cada query do `DIAGNOSTICO-PEDIDO-106031177.sql`:

- [ ] **Query 1:** Pedido existe na tabela `sales`?
- [ ] **Query 2:** Pedidos do Gabriel no banco?
- [ ] **Query 3:** Webhooks desse pedido foram recebidos?
- [ ] **Query 4:** Últimos webhooks recebidos (24h)?
- [ ] **Query 5:** Checkout attempts desse pedido?
- [ ] **Query 6:** Contagem de vendas por status?
- [ ] **Query 7:** Pedido existe na view `sales_fraud_analysis`?
- [ ] **Query 8:** Criar/atualizar pedido manualmente ✅
- [ ] **Query 9:** Verificar se apareceu na view?

---

## 🎯 Resultado Esperado

Após executar o diagnóstico e a solução:

### No Banco de Dados:
```sql
SELECT * FROM sales_fraud_analysis;
```
→ Deve mostrar o pedido 106031177

### No Dashboard:
- ✅ Card "Análise Antifraude" visível
- ✅ Pedido de Gabriel listado
- ✅ Valor: R$ 36,00
- ✅ Tempo em análise: ~1h
- ✅ Status: "normal" ou "warning"

---

## 🚀 Por Que Isso Aconteceu?

**Motivos mais prováveis:**

1. **Webhook não configurado corretamente na Appmax**
   - A URL pode estar errada
   - O evento "Análise Antifraude" não está marcado

2. **Sistema foi atualizado DEPOIS do pedido**
   - O pedido foi criado ANTES da implementação do novo status
   - Por isso não foi capturado

3. **Webhook falhou**
   - Erro de rede
   - Timeout
   - Autenticação falhou

---

## 📝 Próximos Passos

Depois de resolver:

1. ✅ **Configure o webhook na Appmax:**
   - URL: `https://www.gravadormedico.com.br/api/webhook/appmax`
   - Marque: ✅ "Análise Antifraude"

2. ✅ **Faça um novo pedido de teste**
   - Use um cartão de teste da Appmax
   - Aguarde o webhook chegar automaticamente

3. ✅ **Monitore os logs de webhook:**
   ```sql
   SELECT * FROM webhooks_logs 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

---

**Arquivo criado:** `database/DIAGNOSTICO-PEDIDO-106031177.sql`  
**Execute todas as queries** para identificar o problema específico!
