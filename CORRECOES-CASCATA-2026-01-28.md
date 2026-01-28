# 🔧 Correções na Cascata de Pagamentos - 28/01/2026

## ❌ Problema Identificado

A mensagem "Pagamento recusado por todos os gateways" aparecia, mas:
1. **Mercado Pago** era tentado primeiro ✅
2. **AppMax** nunca era tentado como fallback ❌

### Causa Raiz

O frontend (`app/checkout/page.tsx`) não enviava os dados necessários (`appmax_data`) para o backend processar o pagamento via AppMax como fallback.

```typescript
// ANTES: Frontend só enviava token do MP
payload.mpToken = token.id
// Faltava: appmax_data para o fallback
```

O backend (`app/api/checkout/enterprise/route.ts`) verificava:
```typescript
if (appmax_data) {
  // Só tentava AppMax se appmax_data existisse
  // Como nunca era enviado, AppMax nunca era tentado!
}
```

## ✅ Correções Aplicadas

### 1. Frontend - `app/checkout/page.tsx`

Agora envia os dados do cartão para o AppMax processar como fallback:

```typescript
// DEPOIS: Frontend envia dados para ambos os gateways
payload.mpToken = token.id
payload.installments = cardData.installments

// 🆕 CASCATA: Dados do cartão para AppMax como fallback
payload.appmax_data = {
  payment_method: 'credit_card',
  card_data: {
    number: cardData.number.replace(/\s/g, ''),
    holder_name: cardData.holderName || formData.name,
    exp_month: cardData.expMonth,
    exp_year: cardData.expYear.length === 2 ? `20${cardData.expYear}` : cardData.expYear,
    cvv: cardData.cvv,
    installments: cardData.installments || 1,
  },
  order_bumps: selectedBumpProducts,
}
```

### 2. Backend - `app/api/checkout/enterprise/route.ts`

- Adicionado import da função `createAppmaxOrder` do `lib/appmax.ts`
- Corrigido para usar a função oficial da integração AppMax
- Corrigidos os campos de retorno para usar o tipo `AppmaxOrderResponse`

## 🔄 Fluxo da Cascata (Corrigido)

```
┌─────────────────────────────────────┐
│  1. Cliente preenche dados e cartão │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. Frontend tokeniza com MP        │
│     + Prepara dados para AppMax     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. POST /api/checkout/enterprise   │
│     - mpToken (para MP)             │
│     - appmax_data (para fallback)   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. Backend: Tenta Mercado Pago     │
│     - Usa token tokenizado          │
│     - Se APROVADO → ✅ Sucesso MP   │
│     - Se RECUSADO → Vai para 5      │
└──────────────┬──────────────────────┘
               │ (se MP recusou)
               ▼
┌─────────────────────────────────────┐
│  5. Backend: Tenta AppMax (NOVO!)   │
│     - Usa dados do cartão           │
│     - Se APROVADO → ✅ Resgatado!   │
│     - Se RECUSADO → ❌ Ambos falham │
└─────────────────────────────────────┘
```

## 📊 Como Verificar nos Logs

Quando a cascata funcionar, você verá nos logs:

```
🏢 [ENTERPRISE] Iniciando checkout...
💳 [1/2] Tentando Mercado Pago...
📊 Mercado Pago: rejected (1234ms)
💳 [2/2] Tentando AppMax (fallback)...
📊 AppMax response: success=true (987ms)
✅ [RESCUED] AppMax aprovou (venda resgatada)!
```

## ⚠️ Importante

- O AppMax precisa dos **dados brutos do cartão**, não do token do MP
- Por isso enviamos `appmax_data` separadamente
- Isso é seguro porque a comunicação é via HTTPS
- Os dados nunca são armazenados no banco de dados

## 🧪 Para Testar

1. Faça um checkout com um cartão de teste que seja **recusado pelo MP**
2. Verifique se o AppMax é tentado como fallback
3. Confira nos logs se aparece "Tentando AppMax (fallback)..."

## 📁 Arquivos Modificados

1. `/app/checkout/page.tsx` - Adicionado envio de `appmax_data`
2. `/app/api/checkout/enterprise/route.ts` - Corrigida integração com AppMax
