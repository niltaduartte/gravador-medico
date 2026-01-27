# 🔄 SINCRONIZAR VENDAS ANTIGAS DA APPMAX

## 🎯 Objetivo

Importar todas as vendas históricas da Appmax para o banco de dados e exibir no dashboard.

---

## ⚡ MÉTODO 1: Pelo Dashboard (Recomendado)

### Passo a Passo:

1. **Acesse o Dashboard Admin:**
   ```
   http://localhost:3000/admin/dashboard
   ```

2. **Procure o botão "Importar Vendas Antigas":**
   - Está na seção superior do dashboard
   - Cor roxo/azul degradê

3. **Escolha o período:**
   - Últimos 30 dias
   - Últimos 60 dias
   - **Últimos 90 dias (padrão)** ← Recomendado
   - Últimos 6 meses
   - Último ano
   - Últimos 2 anos

4. **Clique em "Importar Vendas Antigas":**
   - Aguarde o processo (pode levar 10-30 segundos)
   - Verá uma mensagem de sucesso
   - A página recarregará automaticamente

5. **Veja os resultados:**
   - Dashboard atualizado com vendas da Appmax
   - Gráficos mostrando vendas de MP + Appmax
   - Métricas agregadas

---

## ⚡ MÉTODO 2: Via Script (Terminal)

### Passo a Passo:

1. **Garantir que o servidor está rodando:**
   ```bash
   npm run dev
   ```

2. **Executar o script de sincronização:**
   ```bash
   # Últimos 90 dias (padrão)
   node scripts/sincronizar-appmax.js

   # Ou especificar período customizado
   node scripts/sincronizar-appmax.js --days=60
   node scripts/sincronizar-appmax.js --days=180
   ```

3. **Ver resultado:**
   ```
   ✅ SINCRONIZAÇÃO CONCLUÍDA!
   Total de pedidos encontrados: 45
   ✅ Importados com sucesso: 45
   ❌ Falhas: 0
   ```

4. **Verificar no dashboard:**
   ```bash
   # Abrir no navegador
   http://localhost:3000/admin/dashboard
   ```

---

## 🔍 VERIFICAR RESULTADO

### Opção 1: Dashboard
```
1. Acesse: http://localhost:3000/admin/dashboard
2. Veja as métricas:
   - Faturamento Total (deve aumentar)
   - Total de Vendas (deve aumentar)
   - Gráfico mostrando vendas antigas
3. Veja o card "Gateway Stats":
   - Mercado Pago: X vendas
   - Appmax: Y vendas ✅
```

### Opção 2: Script de Diagnóstico
```bash
node scripts/diagnostico-appmax-dashboard.js
```

**Deve mostrar:**
```
✅ Vendas Appmax encontradas: 45 (ou mais)
✅ Dashboard deve mostrar os dados da Appmax agora
```

### Opção 3: SQL Direto (Supabase)
```sql
-- Ver vendas da Appmax
SELECT 
  COUNT(*) as total,
  SUM(total_amount) as receita_total,
  MIN(created_at) as primeira_venda,
  MAX(created_at) as ultima_venda
FROM sales 
WHERE payment_gateway = 'appmax';

-- Ver últimas 10 vendas
SELECT 
  id,
  appmax_order_id,
  customer_email,
  total_amount,
  status,
  created_at
FROM sales 
WHERE payment_gateway = 'appmax'
ORDER BY created_at DESC
LIMIT 10;
```

---

## ⚠️ TROUBLESHOOTING

### Problema: "APPMAX_TOKEN não configurado"

**Solução:**
```bash
# Verificar se está no .env.local
cat .env.local | grep APPMAX

# Deve ter:
APPMAX_TOKEN=B6C99C65-4FAE30A5-BB3DFD79-CCEDE0B7
# ou
APPMAX_API_KEY=B6C99C65-4FAE30A5-BB3DFD79-CCEDE0B7
```

### Problema: "Nenhuma venda encontrada"

**Possíveis causas:**
1. Não há vendas na Appmax no período selecionado
2. Token da API está incorreto
3. API da Appmax está fora do ar

**Solução:**
```bash
# 1. Verificar se há vendas no painel da Appmax
# 2. Testar com período maior (ex: 180 dias)
# 3. Verificar logs do servidor (terminal do npm run dev)
```

### Problema: "Algumas vendas falharam"

**Causa:** Dados incompletos ou formato incompatível

**Solução:**
- Veja os detalhes dos erros no card de resultado
- Vendas com email inválido ou dados essenciais faltando serão puladas
- As demais vendas serão importadas normalmente

### Problema: "Servidor não está acessível"

**Solução:**
```bash
# Iniciar o servidor
npm run dev

# Aguardar carregar completamente
# Depois executar a sincronização novamente
```

---

## 📊 O QUE ACONTECE NA SINCRONIZAÇÃO?

1. **Busca na API da Appmax:**
   - GET /api/v3/order
   - Filtra últimos X dias
   - Retorna todos os pedidos

2. **Para cada pedido:**
   - Extrai dados do cliente (email, nome, telefone, CPF)
   - Cria/atualiza registro na tabela `customers`
   - Extrai dados da venda (valor, status, método de pagamento)
   - Cria/atualiza registro na tabela `sales`
   - Define `payment_gateway = 'appmax'` ✅

3. **Evita duplicação:**
   - Usa `appmax_order_id` como chave única
   - Se o pedido já existe, atualiza os dados
   - Se não existe, cria novo registro

4. **Dashboard atualiza:**
   - Função SQL `get_analytics_period` busca todas as vendas
   - Agrega vendas do Mercado Pago + Appmax
   - Exibe métricas combinadas

---

## 🎉 RESULTADO ESPERADO

Após a sincronização bem-sucedida:

```
Dashboard em /admin/dashboard:
├─ 💰 Faturamento Total: R$ X.XXX,XX (MP + Appmax)
├─ 🛒 Total de Vendas: XXX (MP + Appmax)
├─ 👥 Clientes: XXX
├─ 📈 Taxa de Conversão: X.XX%
│
├─ 📊 Gráfico de Vendas:
│   ├─ Linha mostrando vendas diárias
│   └─ Inclui vendas antigas da Appmax ✅
│
└─ 🎯 Gateway Stats:
    ├─ Mercado Pago: X vendas (R$ XXX)
    └─ Appmax: Y vendas (R$ YYY) ✅
```

---

## 📝 COMANDOS ÚTEIS

```bash
# Sincronizar vendas antigas
node scripts/sincronizar-appmax.js

# Sincronizar período customizado
node scripts/sincronizar-appmax.js --days=180

# Verificar resultado
node scripts/diagnostico-appmax-dashboard.js

# Ver logs do servidor
npm run dev
# (Terminal mostrará logs da sincronização)

# Abrir dashboard
open http://localhost:3000/admin/dashboard
```

---

## 🆘 SUPORTE

Se precisar de ajuda:

1. **Verifique os logs:**
   - Terminal onde roda `npm run dev`
   - Procure por linhas com `[APPMAX]` ou `[SYNC]`

2. **Execute diagnóstico:**
   ```bash
   node scripts/diagnostico-appmax-dashboard.js
   ```

3. **Veja a documentação completa:**
   - [DIAGNOSTICO-APPMAX-DASHBOARD.md](./DIAGNOSTICO-APPMAX-DASHBOARD.md)
   - [RESUMO-APPMAX-DASHBOARD.md](./RESUMO-APPMAX-DASHBOARD.md)

---

**Pronto! Suas vendas antigas da Appmax agora aparecerão no dashboard!** 🎉
