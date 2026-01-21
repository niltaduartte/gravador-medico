-- =============================================
-- PRODUCTS INTELLIGENCE - STANDALONE VERSION
-- =============================================
-- Versão que cria todas as dependências necessárias
-- Use este se você ainda não executou 01-schema-completo.sql
-- =============================================

-- 1️⃣ CRIAR TABELAS BASE (se não existirem)
-- =============================================

-- Tabela de clientes (simplificada)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de produtos (base)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    external_id TEXT,
    name TEXT NOT NULL,
    price NUMERIC(10,2) DEFAULT 0,
    category TEXT DEFAULT 'subscription',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de vendas
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id),
    appmax_order_id TEXT UNIQUE,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    total_amount NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL,
    payment_method TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de itens de venda
CREATE TABLE IF NOT EXISTS public.sales_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id),
    product_sku TEXT,
    product_name TEXT NOT NULL,
    product_type TEXT,
    price NUMERIC(10,2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    discount NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2️⃣ ADICIONAR COLUNAS EXTRAS EM PRODUCTS
-- =============================================
DO $$
BEGIN
    -- Adicionar colunas se não existirem
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'description') THEN
        ALTER TABLE public.products ADD COLUMN description TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'image_url') THEN
        ALTER TABLE public.products ADD COLUMN image_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'plan_type') THEN
        ALTER TABLE public.products ADD COLUMN plan_type TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_featured') THEN
        ALTER TABLE public.products ADD COLUMN is_featured BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'checkout_url') THEN
        ALTER TABLE public.products ADD COLUMN checkout_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'metadata') THEN
        ALTER TABLE public.products ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 3️⃣ VIEW DE PERFORMANCE DE PRODUTOS
-- =============================================
CREATE OR REPLACE VIEW public.product_performance AS
WITH sales_items_data AS (
    SELECT 
        s.id as sale_id,
        s.created_at,
        s.status,
        si.product_name,
        si.price,
        si.quantity,
        s.customer_email
    FROM 
        public.sales s
        INNER JOIN public.sales_items si ON si.sale_id = s.id
    WHERE 
        s.created_at > (now() - interval '30 days')
),
product_stats AS (
    SELECT 
        product_name,
        COUNT(DISTINCT sale_id) FILTER (WHERE status IN ('paid', 'approved')) as total_sales,
        COUNT(DISTINCT customer_email) FILTER (WHERE status IN ('paid', 'approved')) as unique_customers,
        SUM(price * COALESCE(quantity, 1)) FILTER (WHERE status IN ('paid', 'approved')) as total_revenue,
        AVG(price) FILTER (WHERE status IN ('paid', 'approved')) as avg_price,
        COUNT(DISTINCT sale_id) FILTER (WHERE status = 'refunded') as total_refunds,
        SUM(price * COALESCE(quantity, 1)) FILTER (WHERE status = 'refunded') as refunded_revenue,
        COUNT(DISTINCT sale_id) FILTER (WHERE status = 'failed') as failed_attempts,
        MAX(created_at) FILTER (WHERE status IN ('paid', 'approved')) as last_sale_at
    FROM 
        sales_items_data
    GROUP BY 
        product_name
)
SELECT 
    product_name,
    total_sales,
    unique_customers,
    total_revenue,
    avg_price,
    total_refunds,
    refunded_revenue,
    failed_attempts,
    last_sale_at,
    CASE 
        WHEN total_sales > 0 
        THEN ROUND((total_refunds::numeric / total_sales::numeric) * 100, 2)
        ELSE 0 
    END as refund_rate,
    CASE 
        WHEN (total_sales + failed_attempts) > 0 
        THEN ROUND((total_sales::numeric / (total_sales + failed_attempts)::numeric) * 100, 2)
        ELSE 0 
    END as conversion_rate,
    LEAST(100, GREATEST(0, 
        100 
        - (CASE WHEN total_sales > 0 THEN (total_refunds::numeric / total_sales::numeric) * 50 ELSE 0 END)
        - (CASE WHEN (total_sales + failed_attempts) > 0 THEN (failed_attempts::numeric / (total_sales + failed_attempts)::numeric) * 30 ELSE 0 END)
    ))::int as health_score
FROM 
    product_stats
ORDER BY 
    total_revenue DESC NULLS LAST;

-- 4️⃣ FUNÇÃO DE AUTO-DISCOVERY
-- =============================================
CREATE OR REPLACE FUNCTION discover_products_from_sales()
RETURNS TABLE (
    discovered_count int,
    products_created jsonb
) AS $$
DECLARE
    product_record RECORD;
    created_products jsonb := '[]'::jsonb;
    counter int := 0;
BEGIN
    FOR product_record IN
        SELECT DISTINCT
            si.product_name as name,
            AVG(si.price)::numeric as price,
            si.product_sku as external_id
        FROM 
            public.sales_items si
        WHERE 
            si.product_name IS NOT NULL
        GROUP BY
            si.product_name, si.product_sku
    LOOP
        INSERT INTO public.products (name, price, external_id, category)
        VALUES (
            product_record.name,
            product_record.price,
            COALESCE(product_record.external_id, 'sku-' || md5(product_record.name)),
            'auto-detected'
        )
        ON CONFLICT (external_id) 
        DO UPDATE SET 
            price = EXCLUDED.price,
            updated_at = NOW()
        RETURNING name, price INTO product_record;
        
        created_products := created_products || jsonb_build_object(
            'name', product_record.name,
            'price', product_record.price
        );
        
        counter := counter + 1;
    END LOOP;
    
    RETURN QUERY SELECT counter, created_products;
END;
$$ LANGUAGE plpgsql;

-- 5️⃣ CONSTRAINT UNIQUE
-- =============================================
DO $$ 
BEGIN
    ALTER TABLE public.products ADD CONSTRAINT products_external_id_key UNIQUE (external_id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN 
        RAISE NOTICE 'Constraint já existe ou erro: %', SQLERRM;
END $$;

-- 6️⃣ ÍNDICES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_products_external_id ON public.products(external_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sales_items_sale_id ON public.sales_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_product_name ON public.sales_items(product_name);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);

-- 7️⃣ RLS
-- =============================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active products" ON public.products;
CREATE POLICY "Public read active products" 
ON public.products FOR SELECT 
USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated read all products" ON public.products;
CREATE POLICY "Authenticated read all products" 
ON public.products FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Service role manage products" ON public.products;
CREATE POLICY "Service role manage products" 
ON public.products FOR ALL 
TO service_role 
USING (true);

-- 8️⃣ FUNÇÃO UPDATE TIMESTAMP
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9️⃣ TRIGGER
-- =============================================
DROP TRIGGER IF EXISTS trigger_products_updated_at ON public.products;
CREATE TRIGGER trigger_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 🔟 VERIFICAÇÃO
-- =============================================
SELECT 
    'Setup completo!' as status,
    (SELECT COUNT(*) FROM public.products) as total_products,
    (SELECT COUNT(*) FROM public.product_performance) as products_with_performance;

-- ✅ PRONTO!
-- Execute SELECT * FROM discover_products_from_sales(); para sincronizar
