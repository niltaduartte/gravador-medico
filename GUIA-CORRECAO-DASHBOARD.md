# 📊 CORREÇÕES NO DASHBOARD - GUIA COMPLETO

## 🎯 Problemas Identificados e Soluções

### 1. **Botões de Sincronização** ✅
**Status:** Funcionam perfeitamente
- **Sync MP**: Sincroniza vendas do Mercado Pago dos últimos 30 dias
- **Importar Vendas Antigas**: Sincroniza vendas da Appmax (90 dias padrão, configurável)

**Melhorias sugeridas no layout:**
- Tornar os botões mais visíveis
- Adicionar feedback visual melhor
- Mostrar última sincronização

---

### 2. **Faturamento Bruto** ❌ CORRIGIR
**Problema:** O dashboard está mostrando `total_amount` (valor com desconto já aplicado)

**Solução:** Usar o campo `subtotal` (valor antes do desconto)

**Como funciona:**
```
Subtotal (Bruto):  R$ 100,00  ← Valor antes do desconto
Desconto:          R$  10,00  ← Cupom/promoção
Total (Líquido):   R$  90,00  ← Valor que realmente entrou
```

---

### 3. **Pagamentos Recusados** ❌ CORRIGIR
**Problema:** Só estava contando vendas com status `cancelled`

**Solução:** Incluir TODOS os status de falha:
- `cancelled` / `canceled` - Cancelado pelo cliente/sistema
- `expired` - Pagamento expirado (PIX vencido, boleto vencido)
- `refused` - Recusado pelo banco
- `rejected` - Rejeitado pelo antifraude
- `failed` - Falha no processamento
- `chargeback` - Estorno/contestação

---

## 🔧 CORREÇÃO NA FUNÇÃO SQL

Execute este SQL no Supabase SQL Editor:
**Link:** https://supabase.com/dashboard/project/egsmraszqnmosmtjuzhx/sql

\`\`\`sql
CREATE OR REPLACE FUNCTION public.get_analytics_period(
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    unique_visitors BIGINT,
    total_sales BIGINT,
    pending_sales BIGINT,
    paid_sales BIGINT,
    failed_sales BIGINT,
    total_revenue NUMERIC,
    gross_revenue NUMERIC,
    total_discount NUMERIC,
    conversion_rate NUMERIC,
    average_order_value NUMERIC
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH period_visits AS (
        SELECT
            COUNT(DISTINCT session_id) as unique_visitors
        FROM public.analytics_visits
        WHERE created_at BETWEEN start_date AND end_date
    ),
    period_sales AS (
        SELECT
            COUNT(*) as total_sales,
            
            -- Vendas pendentes
            COUNT(*) FILTER (
                WHERE order_status IN ('pending', 'pending_payment', 'processing')
            ) as pending_sales,
            
            -- Vendas pagas/aprovadas
            COUNT(*) FILTER (
                WHERE order_status IN ('paid', 'provisioning', 'active', 'approved')
            ) as paid_sales,
            
            -- Vendas recusadas/canceladas/expiradas ✅ CORRIGIDO
            COUNT(*) FILTER (
                WHERE order_status IN ('cancelled', 'canceled', 'expired', 'refused', 'rejected', 'failed', 'chargeback')
            ) as failed_sales,
            
            -- Faturamento líquido (valor que entrou após desconto)
            COALESCE(
                SUM(total_amount) FILTER (
                    WHERE order_status IN ('paid', 'provisioning', 'active', 'approved')
                ), 
                0
            ) as paid_revenue,
            
            -- Faturamento bruto (antes do desconto) ✅ CORRIGIDO
            COALESCE(
                SUM(subtotal) FILTER (
                    WHERE order_status IN ('paid', 'provisioning', 'active', 'approved')
                ), 
                0
            ) as gross_revenue,
            
            -- Total de descontos aplicados ✅ NOVO
            COALESCE(
                SUM(discount) FILTER (
                    WHERE order_status IN ('paid', 'provisioning', 'active', 'approved')
                ), 
                0
            ) as total_discount
            
        FROM public.sales
        WHERE created_at BETWEEN start_date AND end_date
    )
    SELECT
        pv.unique_visitors,
        ps.total_sales,
        ps.pending_sales,
        ps.paid_sales,
        ps.failed_sales,
        ps.paid_revenue as total_revenue,
        ps.gross_revenue,
        ps.total_discount,
        CASE 
            WHEN pv.unique_visitors > 0 
            THEN ROUND((ps.paid_sales::numeric / pv.unique_visitors::numeric) * 100, 2)
            ELSE 0 
        END as conversion_rate,
        CASE 
            WHEN ps.paid_sales > 0 
            THEN ROUND(ps.paid_revenue / ps.paid_sales, 2)
            ELSE 0 
        END as average_order_value
    FROM period_visits pv, period_sales ps;
END;
$$;
\`\`\`

---

## 🧪 TESTAR A FUNÇÃO

Após executar o SQL acima, teste com:

\`\`\`sql
SELECT 
    '📊 Teste: Últimos 30 dias' as teste,
    unique_visitors,
    total_sales,
    pending_sales,
    paid_sales,
    failed_sales,
    CONCAT('R$ ', ROUND(gross_revenue, 2)) as faturamento_bruto,
    CONCAT('R$ ', ROUND(total_revenue, 2)) as faturamento_liquido,
    CONCAT('R$ ', ROUND(total_discount, 2)) as descontos,
    CONCAT(conversion_rate, '%') as taxa_conversao
FROM get_analytics_period(NOW() - INTERVAL '30 days', NOW());
\`\`\`

---

## 📊 LAYOUT MELHORADO - VISÃO GERAL

### Antes:
```
[Sync MP]  [📅 Últimos 90 dias (padrão)]  [Importar Vendas Antigas]
```

### Depois (Sugestão):
```
┌─────────────────────────────────────────────────────────────┐
│  🔄 SINCRONIZAÇÃO                                            │
├─────────────────────────────────────────────────────────────┤
│  [🔵 Mercado Pago]  [🟢 Appmax - 90 dias ▼]                 │
│  Última sync: 2 min atrás                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ PRÓXIMOS PASSOS

1. **Execute o SQL acima no Supabase**
2. **Recarregue o dashboard** (os novos campos aparecerão automaticamente)
3. **Verifique:**
   - Faturamento Bruto agora mostra subtotal correto
   - Pagamentos Recusados incluem todos os tipos de falha

---

## 📝 OBSERVAÇÕES IMPORTANTES

- Os campos `gross_revenue` e `total_discount` são **novos**
- O código TypeScript já está preparado para recebê-los
- A função SQL é retrocompatível (não quebra queries antigas)
- Vendas com valor R$ 0,00 não afetarão os cálculos

