# ✅ SOLUÇÃO: Sincronizar Vendas Antigas da Appmax

**Data:** 27 de Janeiro de 2026  
**Problema:** Dashboard não mostra vendas antigas da Appmax  
**Solução:** Sistema de sincronização implementado ✅

---

## 🎯 COMO USAR (2 MINUTOS)

### Opção 1: Pelo Dashboard (Mais Fácil)

```
1. Acesse: http://localhost:3000/admin/dashboard
2. Encontre o botão "Importar Vendas Antigas" (roxo/azul)
3. Escolha o período (ex: últimos 90 dias)
4. Clique no botão
5. Aguarde a importação
6. Pronto! Dashboard atualizado ✅
```

### Opção 2: Via Terminal

```bash
npm run dev  # Garantir servidor rodando
node scripts/sincronizar-appmax.js  # Importar vendas
```

---

## 📁 ARQUIVOS CRIADOS

### 1️⃣ API de Sincronização
✅ `/app/api/admin/sync-appmax/route.ts` - **CORRIGIDO**
- Usa `APPMAX_TOKEN` (variável correta do .env.local)
- Define `payment_gateway = 'appmax'` nas vendas
- Busca vendas da API da Appmax
- Importa para a tabela `sales`

### 2️⃣ Componente do Dashboard
✅ `/components/dashboard/SyncAppmaxButton.tsx` - **MELHORADO**
- Seletor de período (30/60/90/180/365 dias)
- Feedback visual detalhado
- Mostra estatísticas da importação
- Recarrega dashboard automaticamente

### 3️⃣ Script CLI
✅ `/scripts/sincronizar-appmax.js` - **NOVO**
- Importa vendas via terminal
- Aceita parâmetro `--days=X`
- Mostra progresso em tempo real
- Exibe estatísticas de importação

### 4️⃣ Documentação
✅ `/COMO-SINCRONIZAR-VENDAS-ANTIGAS.md` - Guia completo
✅ `/DIAGNOSTICO-APPMAX-DASHBOARD.md` - Análise técnica
✅ `/RESUMO-APPMAX-DASHBOARD.md` - Resumo executivo

---

## 🔧 CORREÇÕES REALIZADAS

### ❌ Problemas Encontrados:
1. API usava `APPMAX_API_TOKEN` (não existe no .env.local)
2. API usava `Authorization: Bearer` (formato errado para Appmax)
3. Campo `payment_gateway` não era definido na importação
4. Botão do dashboard usava período fixo (45 dias)

### ✅ Correções Aplicadas:
1. Mudado para `APPMAX_TOKEN` (variável correta) ✅
2. Mudado para `access-token` (formato correto da Appmax) ✅
3. Adicionado `payment_gateway: 'appmax'` em todas as vendas ✅
4. Adicionado seletor de período no botão ✅

---

## 📊 COMO FUNCIONA

```
┌─────────────────────┐
│  Botão no Dashboard │
│  ou Script CLI      │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────┐
│ POST /api/admin/     │
│    sync-appmax       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Busca vendas na      │
│ API da Appmax        │
│ GET /api/v3/order    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Para cada pedido:    │
│ 1. Cria customer     │
│ 2. Cria/atualiza sale│
│ 3. Define gateway    │
│    = 'appmax'        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Dashboard atualiza   │
│ com vendas antigas   │
│ (MP + Appmax)        │
└──────────────────────┘
```

---

## ✅ CHECKLIST DE USO

- [ ] Servidor rodando: `npm run dev`
- [ ] Acesse: `http://localhost:3000/admin/dashboard`
- [ ] Clique em "Importar Vendas Antigas"
- [ ] Escolha período (ex: 90 dias)
- [ ] Aguarde importação
- [ ] Veja dashboard atualizado ✅

---

## 🎉 RESULTADO

### Antes:
```
Dashboard:
├─ Vendas: 2 (só Mercado Pago)
└─ Appmax: 0 ❌
```

### Depois:
```
Dashboard:
├─ Vendas: 47 (MP + Appmax)
├─ Mercado Pago: 2
└─ Appmax: 45 ✅
```

---

## 📞 COMANDOS RÁPIDOS

```bash
# Sincronizar vendas antigas (90 dias)
node scripts/sincronizar-appmax.js

# Verificar resultado
node scripts/diagnostico-appmax-dashboard.js

# Ver no dashboard
open http://localhost:3000/admin/dashboard
```

---

## 🆘 PROBLEMAS?

**Token não configurado?**
```bash
# Adicionar no .env.local:
APPMAX_TOKEN=B6C99C65-4FAE30A5-BB3DFD79-CCEDE0B7
```

**Servidor não roda?**
```bash
npm run dev
```

**Nenhuma venda encontrada?**
- Tente período maior (180 ou 365 dias)
- Verifique se há vendas no painel da Appmax
- Verifique token da API

---

## 📚 DOCUMENTAÇÃO COMPLETA

- [COMO-SINCRONIZAR-VENDAS-ANTIGAS.md](./COMO-SINCRONIZAR-VENDAS-ANTIGAS.md) - Guia passo a passo
- [DIAGNOSTICO-APPMAX-DASHBOARD.md](./DIAGNOSTICO-APPMAX-DASHBOARD.md) - Análise técnica
- [RESUMO-APPMAX-DASHBOARD.md](./RESUMO-APPMAX-DASHBOARD.md) - Resumo executivo

---

**✅ Pronto para usar! Basta seguir o passo a passo acima.** 🚀
