# 🎯 RESUMO EXECUTIVO: Dashboard Appmax

**Data:** 27 de Janeiro de 2026  
**Analista:** GitHub Copilot  
**Status:** ⚠️ PROBLEMA IDENTIFICADO + SOLUÇÃO PRONTA

---

## ⚡ RESUMO RÁPIDO

**PROBLEMA:** Dashboard não mostra dados da Appmax  
**CAUSA:** Não há vendas da Appmax no banco de dados  
**IMPACTO:** Dashboard mostra apenas vendas do Mercado Pago (2 vendas)  
**SOLUÇÃO:** Verificar e configurar webhooks da Appmax

---

## 📊 SITUAÇÃO ATUAL

```
Total de vendas: 2
├─ Mercado Pago: 2 ✅
└─ Appmax: 0 ❌

Dashboard: ✅ Funcionando (mas sem dados da Appmax)
Função SQL: ✅ get_analytics_period OK
Campo payment_gateway: ✅ Existe na tabela
```

---

## 🔍 DIAGNÓSTICO REALIZADO

### ✅ O que está funcionando:
- [x] Tabela `sales` existe e está acessível
- [x] Campo `payment_gateway` existe na tabela
- [x] Campo `appmax_order_id` existe na tabela
- [x] Função `get_analytics_period` funciona corretamente
- [x] Dashboard exibe vendas do Mercado Pago
- [x] Estrutura do banco está correta

### ❌ O que NÃO está funcionando:
- [ ] Webhooks da Appmax não estão salvando vendas
- [ ] Não há registros com `payment_gateway = 'appmax'`
- [ ] Dashboard não tem dados da Appmax para exibir

---

## 🛠️ SOLUÇÃO (PASSO A PASSO)

### 📋 CHECKLIST DE AÇÕES

#### 1️⃣ **Verificar Configuração do Webhook (MAIS IMPORTANTE)**

```bash
# Verificar variáveis de ambiente
cat .env.local | grep APPMAX
```

**Deve ter:**
```bash
APPMAX_TOKEN=D2555D74-9B58764C-3F04CB59-14BF2F64
APPMAX_PRODUCT_ID=32880073
APPMAX_API_KEY=B6C99C65-4FAE30A5-BB3DFD79-CCEDE0B7
APPMAX_WEBHOOK_SECRET=seu-secret-aqui  # ⚠️ IMPORTANTE!
```

**Configurar na Appmax:**
1. Entrar no painel da Appmax
2. Ir em **Configurações > Webhooks**
3. Configurar URL: `https://seu-dominio.com/api/webhooks/appmax`
4. Configurar Secret (mesmo da variável de ambiente)

---

#### 2️⃣ **Testar Webhook Localmente**

```bash
# 1. Garantir que o servidor está rodando
npm run dev

# 2. Executar teste do webhook
node scripts/testar-webhook-appmax.js
```

**Resultado esperado:**
```
✅ TESTE PASSOU!
O webhook está funcionando corretamente.
Dashboard deve mostrar os dados da Appmax agora.
```

---

#### 3️⃣ **Fazer uma Compra de Teste**

1. Acesse o checkout: `http://localhost:3000/checkout`
2. Escolha **Cartão de Crédito** (vai para Appmax via cascata)
3. Use dados de teste:
   ```
   Número: 4111 1111 1111 1111
   CVV: 123
   Validade: 12/28
   ```
4. Finalize a compra
5. Verifique se aparece no dashboard

---

#### 4️⃣ **Verificar se Salvou no Banco**

```bash
# Executar diagnóstico novamente
node scripts/diagnostico-appmax-dashboard.js
```

**Deve mostrar:**
```
✅ Vendas Appmax encontradas: 1 (ou mais)
```

---

#### 5️⃣ **Sincronizar Vendas Antigas (se houver)**

Se já existem vendas na Appmax mas não no banco:

```bash
# Acessar o admin
http://localhost:3000/admin/dashboard

# Clicar no botão "Sincronizar Appmax"
```

Ou via API:
```bash
curl -X POST http://localhost:3000/api/admin/sync-appmax \
  -H "Content-Type: application/json"
```

---

## 📝 ARQUIVOS IMPORTANTES

### Scripts Criados:
- ✅ `/scripts/diagnostico-appmax-dashboard.js` - Diagnóstico completo
- ✅ `/scripts/testar-webhook-appmax.js` - Teste do webhook
- ✅ `/database/FIX-APPMAX-GATEWAY.sql` - Correção de dados

### Documentos Criados:
- ✅ `/DIAGNOSTICO-APPMAX-DASHBOARD.md` - Diagnóstico detalhado
- ✅ `/RESUMO-APPMAX-DASHBOARD.md` - Este documento

### Arquivos Relacionados:
- `/app/api/webhooks/appmax/route.ts` - Endpoint do webhook
- `/lib/appmax-webhook.ts` - Lógica de processamento (linhas 200-830)
- `/lib/dashboard-queries.ts` - Queries do dashboard
- `/database/FIX-DASHBOARD-COMPLETO.sql` - Função get_analytics_period

---

## 🎯 COMANDOS ÚTEIS

```bash
# Ver logs do servidor
npm run dev

# Testar webhook
node scripts/testar-webhook-appmax.js

# Diagnóstico completo
node scripts/diagnostico-appmax-dashboard.js

# Verificar vendas no banco
# (No Supabase SQL Editor)
SELECT * FROM sales WHERE payment_gateway = 'appmax';

# Ver analytics
# (No Supabase SQL Editor)
SELECT * FROM get_analytics_period(NOW() - INTERVAL '30 days', NOW());
```

---

## 🆘 TROUBLESHOOTING

### Problema: "Webhook rejeitado"
**Causa:** Assinatura inválida  
**Solução:** Verificar `APPMAX_WEBHOOK_SECRET` no .env.local

### Problema: "Servidor não acessível"
**Causa:** Next.js não está rodando  
**Solução:** Executar `npm run dev`

### Problema: "Webhook aceito mas não salva"
**Causa:** Erro na lógica de salvamento  
**Solução:** Verificar logs do servidor

### Problema: "Dashboard não atualiza"
**Causa:** Cache do navegador  
**Solução:** Dar F5 ou Ctrl+Shift+R

---

## ✅ VALIDAÇÃO FINAL

Após executar as ações acima, você deve ver:

### No Diagnóstico:
```bash
node scripts/diagnostico-appmax-dashboard.js

# Resultado esperado:
✅ Vendas Appmax encontradas: 1 (ou mais)
✅ Dashboard deve mostrar os dados da Appmax agora
```

### No Dashboard:
1. Acesse: `http://localhost:3000/admin/dashboard`
2. Veja as métricas atualizadas
3. Confira o gráfico mostrando vendas da Appmax
4. Verifique o card "Gateway Stats" (MP vs Appmax)

---

## 📞 SUPORTE

Se o problema persistir após seguir todos os passos:

1. **Verifique os logs do servidor:**
   - Terminal onde roda `npm run dev`
   - Procure por erros relacionados a "appmax" ou "webhook"

2. **Execute todos os scripts de diagnóstico:**
   ```bash
   node scripts/diagnostico-appmax-dashboard.js
   node scripts/testar-webhook-appmax.js
   ```

3. **Verifique a tabela de logs:**
   ```sql
   SELECT * FROM webhooks_logs 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

4. **Entre em contato com o suporte da Appmax:**
   - Verificar se o webhook está configurado
   - Pedir logs de envio do webhook
   - Confirmar URL e Secret

---

## 🎉 CONCLUSÃO

O dashboard está funcionando corretamente! O problema é que não há vendas da Appmax no banco de dados ainda.

**Próximo passo:** Configurar e testar o webhook da Appmax para que as vendas sejam registradas automaticamente.

---

**Documentos relacionados:**
- [Diagnóstico Completo](./DIAGNOSTICO-APPMAX-DASHBOARD.md)
- [Script SQL de Correção](./database/FIX-APPMAX-GATEWAY.sql)

**Scripts disponíveis:**
- `scripts/diagnostico-appmax-dashboard.js`
- `scripts/testar-webhook-appmax.js`

---

*Última atualização: 27/01/2026*
