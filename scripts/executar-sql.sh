#!/bin/bash

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 EXECUTANDO SQL NO SUPABASE${NC}\n"

# Ler o SQL
SQL_FILE="database/FIX-ANALYTICS-PERIOD.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Arquivo $SQL_FILE não encontrado${NC}"
    exit 1
fi

# Extrair apenas a parte CREATE OR REPLACE FUNCTION
SQL=$(cat "$SQL_FILE" | sed -n '/CREATE OR REPLACE FUNCTION/,/^\$\$;/p')

echo -e "${BLUE}📝 Executando via Supabase API...${NC}\n"

# Usar curl para executar SQL via API REST do Supabase
RESPONSE=$(curl -s -X POST \
  'https://egsmraszqnmosmtjuzhx.supabase.co/rest/v1/rpc/exec_sql' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc21yYXN6cW5tb3NtdGp1emh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ4NzcxMCwiZXhwIjoyMDg0MDYzNzEwfQ.wuM5GbYqaDTyf4T3fR62U1sWqZ06RJ3nXHk56I2VcAQ" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc21yYXN6cW5tb3NtdGp1emh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ4NzcxMCwiZXhwIjoyMDg0MDYzNzEwfQ.wuM5GbYqaDTyf4T3fR62U1sWqZ06RJ3nXHk56I2VcAQ" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL" | jq -Rs .)}")

echo "$RESPONSE"

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ SQL executado com sucesso!${NC}"
    echo -e "\n${BLUE}🧪 Testando a função...${NC}\n"
    
    # Testar a função
    curl -s -X POST \
      'https://egsmraszqnmosmtjuzhx.supabase.co/rest/v1/rpc/get_analytics_period' \
      -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc21yYXN6cW5tb3NtdGp1emh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ4NzcxMCwiZXhwIjoyMDg0MDYzNzEwfQ.wuM5GbYqaDTyf4T3fR62U1sWqZ06RJ3nXHk56I2VcAQ" \
      -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc21yYXN6cW5tb3NtdGp1emh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ4NzcxMCwiZXhwIjoyMDg0MDYzNzEwfQ.wuM5GbYqaDTyf4T3fR62U1sWqZ06RJ3nXHk56I2VcAQ" \
      -H "Content-Type: application/json" | jq '.'
    
    echo -e "\n${GREEN}✅ CONCLUÍDO! Recarregue o dashboard.${NC}\n"
else
    echo -e "\n${RED}❌ Erro ao executar SQL${NC}"
    echo -e "\n${BLUE}📝 Execute manualmente em:${NC}"
    echo -e "   https://supabase.com/dashboard/project/egsmraszqnmosmtjuzhx/sql\n"
fi
