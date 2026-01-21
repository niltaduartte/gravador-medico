# 🔧 Troubleshooting - Products Intelligence

## ❌ Erro: "column si.product_name does not exist"

### Causa
A tabela `sales_items` não existe ou não tem a coluna `product_name`.

### Solução

#### Opção 1: Verificar estrutura do banco
Execute no Supabase SQL Editor:

```sql
-- Verificar se a tabela existe
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('sales', 'sales_items', 'products');

-- Verificar colunas da sales_items
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'sales_items';
```

#### Opção 2: Executar schema base primeiro
Se as tabelas não existem, execute:

```
database/01-schema-completo.sql
```

Depois execute:

```
database/PRODUCTS-INTELLIGENCE.sql
```

#### Opção 3: Versão standalone (cria tudo)
Use este arquivo que cria toda a estrutura necessária:

```
database/PRODUCTS-INTELLIGENCE-STANDALONE.sql
```

---

## ❌ Erro: "table sales does not exist"

### Solução
Você precisa executar o schema principal primeiro:

```sql
-- Execute no Supabase
/database/01-schema-completo.sql
```

Depois:

```sql
/database/PRODUCTS-INTELLIGENCE.sql
```

---

## ❌ Erro: "function update_updated_at_column() does not exist"

### Solução
Execute antes do PRODUCTS-INTELLIGENCE.sql:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## ❌ Erro: "duplicate key value violates unique constraint"

### Solução
Limpar produtos duplicados:

```sql
DELETE FROM products 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM products 
    GROUP BY external_id
);
```

---

## ✅ Ordem Correta de Execução

### Setup Completo (Recomendado):

1. **Schema base:**
   ```
   database/01-schema-completo.sql
   ```

2. **Products Intelligence:**
   ```
   database/PRODUCTS-INTELLIGENCE.sql
   ```

3. **Testar:**
   ```sql
   SELECT * FROM discover_products_from_sales();
   ```

### Setup Rápido (Standalone):

1. **Apenas Products (cria tudo):**
   ```
   database/PRODUCTS-INTELLIGENCE-STANDALONE.sql
   ```

2. **Testar:**
   ```sql
   SELECT * FROM discover_products_from_sales();
   ```

---

## 🔍 Diagnóstico Rápido

Execute este SQL para ver o que está faltando:

```sql
-- Verificar tabelas
DO $$
DECLARE
    missing_tables TEXT := '';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') THEN
        missing_tables := missing_tables || 'sales, ';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_items') THEN
        missing_tables := missing_tables || 'sales_items, ';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        missing_tables := missing_tables || 'products, ';
    END IF;
    
    IF missing_tables = '' THEN
        RAISE NOTICE '✅ Todas as tabelas existem!';
    ELSE
        RAISE NOTICE '❌ Tabelas faltando: %', missing_tables;
        RAISE NOTICE '👉 Execute: database/01-schema-completo.sql';
    END IF;
END $$;
```

---

## 📊 Verificar Dados

```sql
-- Ver se tem vendas
SELECT COUNT(*) as total_sales FROM sales;

-- Ver se tem itens
SELECT COUNT(*) as total_items FROM sales_items;

-- Ver produtos descobertos
SELECT * FROM products WHERE category = 'auto-detected';

-- Ver performance
SELECT * FROM product_performance LIMIT 5;
```

---

## 🚀 Como Usar Depois do Setup

1. **Acessar interface:**
   ```
   http://localhost:3000/admin/products
   ```

2. **Clicar em "Sincronizar com Vendas"**

3. **Ver produtos descobertos automaticamente**

---

## 💡 Dica Pro

Se você tem dados de teste e quer limpar tudo:

```sql
-- ⚠️ CUIDADO: Apaga todos os produtos
TRUNCATE TABLE products CASCADE;

-- Resincronizar
SELECT * FROM discover_products_from_sales();
```

---

## 📞 Suporte

Se nenhuma solução funcionou:

1. Verifique os logs do Supabase
2. Confirme que você está usando PostgreSQL 14+
3. Verifique se o usuário tem permissões de CREATE TABLE/VIEW/FUNCTION
