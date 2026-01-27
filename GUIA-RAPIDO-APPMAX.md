# 🚀 GUIA RÁPIDO: Resolver Dashboard Appmax

## 🎯 TL;DR (Muito Longo; Não Li)

**Problema:** Dashboard não mostra vendas da Appmax  
**Causa:** Webhooks não estão salvando no banco  
**Solução:** Configure o webhook da Appmax

---

## ⚡ SOLUÇÃO EM 3 PASSOS

### 1️⃣ Configurar Webhook na Appmax (5 min)

```
1. Entre no painel da Appmax
2. Vá em: Configurações > Webhooks
3. Adicione a URL:
   https://seu-dominio.com/api/webhooks/appmax
4. Configure o Secret (mesma do .env.local):
   APPMAX_WEBHOOK_SECRET=seu-secret-aqui
```

### 2️⃣ Testar Webhook (1 min)

```bash
npm run dev
node scripts/testar-webhook-appmax.js
```

**Deve aparecer:** ✅ TESTE PASSOU!

### 3️⃣ Verificar Dashboard (30 seg)

```
Acesse: http://localhost:3000/admin/dashboard
Deve mostrar dados da Appmax ✅
```

---

## 🔍 DIAGNÓSTICO RÁPIDO

Execute este comando:

```bash
node scripts/diagnostico-appmax-dashboard.js
```

**Se aparecer:**
- ❌ Vendas Appmax: 0 → Configure o webhook (passo 1)
- ✅ Vendas Appmax: > 0 → Tudo OK! 🎉

---

## 📊 FLUXO DO WEBHOOK

```
┌─────────────────┐
│  Cliente compra │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Appmax processa │
│   pagamento     │
└────────┬────────┘
         │
         ▼
┌──────────────────────┐
│ Appmax envia Webhook │◄── ⚠️ AQUI ESTÁ O PROBLEMA
│ POST /api/webhooks/  │    Webhook não está
│      appmax          │    configurado ou
└────────┬─────────────┘    não está chegando
         │
         ▼
┌──────────────────┐
│ Salva na tabela  │
│     sales        │
│ payment_gateway  │
│   = 'appmax'     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Dashboard exibe  │
│  dados Appmax    │
└──────────────────┘
```

---

## ✅ CHECKLIST

- [ ] **Variáveis de ambiente configuradas?**
  ```bash
  cat .env.local | grep APPMAX
  # Deve ter: APPMAX_TOKEN, APPMAX_API_KEY, APPMAX_WEBHOOK_SECRET
  ```

- [ ] **Servidor rodando?**
  ```bash
  npm run dev
  # Deve estar em http://localhost:3000
  ```

- [ ] **Webhook configurado na Appmax?**
  ```
  URL: https://seu-dominio.com/api/webhooks/appmax
  Secret: mesmo do .env.local
  ```

- [ ] **Teste do webhook passou?**
  ```bash
  node scripts/testar-webhook-appmax.js
  # Deve aparecer: ✅ TESTE PASSOU!
  ```

- [ ] **Há vendas no banco?**
  ```bash
  node scripts/diagnostico-appmax-dashboard.js
  # Vendas Appmax encontradas: > 0
  ```

---

## 🔧 COMANDOS DE EMERGÊNCIA

### Se nada funciona, execute estes comandos na ordem:

```bash
# 1. Verificar se servidor está rodando
curl http://localhost:3000/api/webhooks/appmax
# Deve retornar: {"status":"ok","endpoint":"/api/webhooks/appmax"}

# 2. Criar venda de teste manualmente
node scripts/testar-webhook-appmax.js

# 3. Verificar se salvou
node scripts/diagnostico-appmax-dashboard.js

# 4. Ver dashboard
# Acesse: http://localhost:3000/admin/dashboard
```

---

## 🆘 AINDA NÃO FUNCIONA?

### Verificar logs do servidor:

```bash
# No terminal onde roda npm run dev, procure por:
- "POST /api/webhooks/appmax" (webhook recebido)
- "✅" ou "❌" (sucesso ou erro)
- Mensagens de erro (stack trace)
```

### Verificar no Supabase:

```sql
-- Ver se há vendas
SELECT * FROM sales WHERE payment_gateway = 'appmax';

-- Ver analytics
SELECT * FROM get_analytics_period(NOW() - INTERVAL '30 days', NOW());
```

---

## 📞 CONTATOS

**Suporte Appmax:**
- Verificar configuração do webhook
- Pedir logs de envio
- Confirmar URL e Secret estão corretos

**Logs para enviar:**
1. Output de `node scripts/diagnostico-appmax-dashboard.js`
2. Logs do terminal (npm run dev)
3. Screenshot do painel de webhooks da Appmax

---

## 🎉 SUCESSO!

Quando tudo estiver funcionando, você verá:

```
Dashboard em /admin/dashboard:
├─ 💰 Faturamento Total (MP + Appmax)
├─ 📊 Gráfico com vendas de ambos
├─ 🎯 Gateway Stats
│   ├─ Mercado Pago: X vendas
│   └─ Appmax: Y vendas ✅
└─ 📈 Todas as métricas atualizadas
```

---

**Documentos completos:**
- [RESUMO-APPMAX-DASHBOARD.md](./RESUMO-APPMAX-DASHBOARD.md) - Guia completo
- [DIAGNOSTICO-APPMAX-DASHBOARD.md](./DIAGNOSTICO-APPMAX-DASHBOARD.md) - Análise técnica

**Scripts:**
- `scripts/diagnostico-appmax-dashboard.js` - Diagnóstico
- `scripts/testar-webhook-appmax.js` - Teste
