# 🔍 DIAGNÓSTICO: Dashboard não recebe dados da Appmax

**Data:** 27 de Janeiro de 2026  
**Status:** ❌ PROBLEMA IDENTIFICADO

---

## 📊 SITUAÇÃO ATUAL

### Dados Encontrados:
- ✅ **Total de vendas na tabela `sales`:** 2 vendas
- ❌ **Vendas da Appmax:** 0 vendas
- ✅ **Vendas do Mercado Pago:** 2 vendas
- ✅ **Campo `payment_gateway` existe:** Sim, está presente na tabela
- ✅ **Função `get_analytics_period` funciona:** Sim, retorna dados corretamente

### Resultado da Função `get_analytics_period`:
```json
{
  "unique_visitors": 45,
  "total_sales": 2,
  "pending_sales": 0,
  "paid_sales": 2,
  "total_revenue": 21.6,
  "conversion_rate": 4.44,
  "average_order_value": 10.8
}
```

---

## ❌ PROBLEMA IDENTIFICADO

**O dashboard está funcionando corretamente, MAS não há vendas da Appmax no banco de dados.**

### Campos Verificados na Tabela `sales`:
- `id`, `customer_id`, `total_amount`, `status`, `created_at`, `updated_at`
- `appmax_order_id` ✅ (campo existe)
- `payment_gateway` ✅ (campo existe)
- `customer_name`, `customer_email`, `customer_phone`, `customer_cpf`
- `subtotal`, `discount`, `payment_method`, `coupon_code`, `coupon_discount`
- `utm_source`, `utm_campaign`, `utm_medium`, `ip_address`
- `paid_at`, `metadata`, `failure_reason`, `idempotency_key`
- `order_status`, `fallback_used`, `amount`, `mercadopago_payment_id`, `payment_details`

---

## 🔎 POSSÍVEIS CAUSAS

### 1. **Webhooks da Appmax não estão sendo recebidos**
**Verificar:**
- [ ] URL do webhook configurada na Appmax
- [ ] Endpoint correto: `/api/webhooks/appmax` ou `/api/webhooks/appmax-v2`
- [ ] Secret configurado: `APPMAX_WEBHOOK_SECRET`
- [ ] API Key válida: `APPMAX_API_KEY`

### 2. **Webhooks estão falhando ao salvar**
**Verificar:**
- [ ] Logs de erro no terminal/console
- [ ] Tabela `webhooks_logs` (se existir)
- [ ] Erros de validação no arquivo `lib/appmax-webhook.ts`

### 3. **Não há vendas reais da Appmax ainda**
**Verificar:**
- [ ] Testar manualmente uma compra via Appmax
- [ ] Ver se o checkout está direcionando para a Appmax corretamente
- [ ] Verificar se o sistema de cascata está funcionando

---

## 🛠️ AÇÕES CORRETIVAS

### ✅ **Ação 1: Verificar configuração do webhook na Appmax**

1. Entre no painel da Appmax
2. Vá em **Configurações > Webhooks**
3. Verifique se a URL está configurada:
   - **Produção:** `https://seu-dominio.com/api/webhooks/appmax`
   - **Local:** `https://localhost:3000/api/webhooks/appmax` (com ngrok/localtunnel)

4. Verifique o **Secret** configurado:
   ```bash
   APPMAX_WEBHOOK_SECRET=seu-secret-aqui
   ```

### ✅ **Ação 2: Testar webhook manualmente**

Execute este comando para testar:

```bash
curl -X POST http://localhost:3000/api/webhooks/appmax \
  -H "Content-Type: application/json" \
  -H "x-appmax-signature: sha256=$(echo -n '{"event":"order.approved","data":{"order_id":"TEST123","customer_email":"teste@teste.com","customer_name":"Teste","total_amount":197}}' | openssl dgst -sha256 -hmac 'seu-secret' | cut -d ' ' -f2)" \
  -d '{
    "event": "order.approved",
    "data": {
      "order_id": "TEST123",
      "customer_email": "teste@teste.com",
      "customer_name": "Cliente Teste",
      "total_amount": 197
    }
  }'
```

### ✅ **Ação 3: Criar venda de teste**

Execute este SQL no Supabase para criar uma venda de teste da Appmax:

```sql
INSERT INTO sales (
  appmax_order_id,
  customer_name,
  customer_email,
  customer_phone,
  total_amount,
  subtotal,
  status,
  payment_method,
  payment_gateway,
  created_at
) VALUES (
  'TEST_APPMAX_001',
  'Cliente Teste Appmax',
  'teste@appmax.com',
  '11999999999',
  197.00,
  197.00,
  'paid',
  'credit_card',
  'appmax',
  NOW()
);
```

Depois, recarregue o dashboard e veja se aparece.

### ✅ **Ação 4: Verificar logs do sistema**

1. **Ver logs do webhook:**
```bash
# No terminal onde o Next.js está rodando
# Procure por linhas com "appmax", "webhook", "POST /api/webhooks"
```

2. **Verificar tabela de logs (se existir):**
```sql
SELECT * FROM webhooks_logs 
WHERE payload::text LIKE '%appmax%'
ORDER BY created_at DESC 
LIMIT 10;
```

### ✅ **Ação 5: Sincronizar vendas da Appmax**

Se já existem vendas na Appmax mas não no banco:

1. Use o botão de sincronização no dashboard admin: `/admin/dashboard`
2. Ou execute manualmente:

```bash
curl -X POST http://localhost:3000/api/admin/sync-appmax \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=seu-token-admin"
```

---

## 🎯 PRÓXIMOS PASSOS

1. **Verificar configuração do webhook na Appmax** ✅
2. **Testar webhook manualmente** ✅
3. **Criar venda de teste** (opcional) ✅
4. **Verificar logs do sistema** ✅
5. **Fazer uma compra real de teste via Appmax** ✅
6. **Sincronizar vendas antigas (se houver)** ✅

---

## 📝 NOTAS TÉCNICAS

### Como o webhook da Appmax funciona:

1. **Cliente faz compra** → Sistema gera pedido
2. **Appmax processa pagamento** → Cartão aprovado/recusado
3. **Appmax envia webhook** → `POST /api/webhooks/appmax`
4. **Nosso sistema recebe** → Valida assinatura
5. **Salva na tabela `sales`** → Com `payment_gateway = 'appmax'`
6. **Dashboard exibe** → Dados são agregados pela função SQL

### Arquivo responsável pelo webhook:
- **Rota:** `/app/api/webhooks/appmax/route.ts`
- **Handler:** `/lib/appmax-webhook.ts` (linha 200-830)
- **Tabelas afetadas:**
  - `sales` (venda principal)
  - `checkout_attempts` (tentativa de compra)
  - `customers` (cliente)
  - `webhooks_logs` (log do webhook)

### Campos importantes na tabela `sales`:
```typescript
{
  appmax_order_id: string,      // ID do pedido na Appmax
  payment_gateway: 'appmax',     // ⚠️ DEVE SER 'appmax'
  customer_email: string,
  total_amount: number,
  status: 'paid' | 'approved' | 'pending' | 'refused',
  created_at: timestamp
}
```

---

## ✅ VALIDAÇÃO

Após realizar as ações acima, execute novamente o diagnóstico:

```bash
node scripts/diagnostico-appmax-dashboard.js
```

Você deve ver:
- ✅ Vendas Appmax encontradas: **> 0**
- ✅ Dashboard mostrando dados da Appmax

---

## 🆘 SUPORTE

Se o problema persistir:

1. **Verifique as variáveis de ambiente:**
   ```bash
   APPMAX_TOKEN=D2555D74-9B58764C-3F04CB59-14BF2F64
   APPMAX_PRODUCT_ID=32880073
   APPMAX_API_KEY=B6C99C65-4FAE30A5-BB3DFD79-CCEDE0B7
   APPMAX_WEBHOOK_SECRET=seu-secret-aqui
   ```

2. **Teste o endpoint do webhook:**
   ```bash
   curl http://localhost:3000/api/webhooks/appmax
   # Deve retornar: {"status":"ok","endpoint":"/api/webhooks/appmax"}
   ```

3. **Verifique se o Next.js está rodando:**
   ```bash
   npm run dev
   # Deve estar acessível em http://localhost:3000
   ```

---

**Fim do diagnóstico** ✅
