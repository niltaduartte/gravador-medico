# 🚀 EXECUTAR SQL NO SUPABASE - GUIA RÁPIDO

## ✅ LAYOUT DO DASHBOARD JÁ ESTÁ MELHORADO!

O código já foi atualizado e está funcionando. Agora só falta atualizar a função SQL.

---

## 📝 PASSO A PASSO

### 1. Abra o Supabase SQL Editor
👉 **Link direto:** https://supabase.com/dashboard/project/egsmraszqnmosmtjuzhx/sql

### 2. Cole este SQL:

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
            COUNT(*) FILTER (WHERE order_status IN ('pending', 'pending_payment', 'processing')) as pending_sales,
            COUNT(*) FILTER (WHERE order_status IN ('paid', 'provisioning', 'active', 'approved')) as paid_sales,
            COUNT(*) FILTER (WHERE order_status IN ('cancelled', 'canceled', 'expired', 'refused', 'rejected', 'failed', 'chargeback')) as failed_sales,
            COALESCE(SUM(total_amount) FILTER (WHERE order_status IN ('paid', 'provisioning', 'active', 'approved')), 0) as paid_revenue,
            COALESCE(SUM(subtotal) FILTER (WHERE order_status IN ('paid', 'provisioning', 'active', 'approved')), 0) as gross_revenue,
            COALESCE(SUM(discount) FILTER (WHERE order_status IN ('paid', 'provisioning', 'active', 'approved')), 0) as total_discount
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

### 3. Clique em "RUN" (ou Ctrl+Enter)

### 4. Teste a função:

\`\`\`sql
SELECT * FROM get_analytics_period(NOW() - INTERVAL '30 days', NOW());
\`\`\`

Você deve ver os novos campos:
- ✅ `failed_sales` - Pagamentos recusados
- ✅ `gross_revenue` - Faturamento bruto
- ✅ `total_discount` - Total de descontos

### 5. Recarregue o Dashboard

Acesse: http://localhost:3000/admin/dashboard

---

## 🎯 O QUE VAI MUDAR?

### ANTES:
```
Faturamento Bruto: R$ 72,40
```

### DEPOIS:
```
┌─────────────────────────────────────────┐
│ Faturamento Bruto     │ R$ 82,40        │
│ Descontos             │ -R$ 10,00       │
│ Faturamento Líquido   │ R$ 72,40        │
└─────────────────────────────────────────┘

❌ Pagamentos Recusados: 1 venda
   Cancelados, expirados, recusados pelo banco
```

---

## 📊 RESUMO DAS MELHORIAS

✅ **Layout melhorado** - Seção de sincronização destacada
✅ **Faturamento real** - Mostra bruto, desconto e líquido  
✅ **Pagamentos recusados** - Conta TODOS os tipos de falha
✅ **Botões funcionam** - Sync MP e Appmax estão operacionais

---

## 💡 SE DER ERRO

Caso apareça erro ao executar o SQL, pode ser que precise dropar a função antiga primeiro:

\`\`\`sql
DROP FUNCTION IF EXISTS public.get_analytics_period CASCADE;
\`\`\`

Depois execute o CREATE OR REPLACE novamente.

