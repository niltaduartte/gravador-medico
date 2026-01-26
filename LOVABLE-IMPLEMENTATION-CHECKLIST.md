# ✅ CHECKLIST DE IMPLEMENTAÇÃO - INTEGRAÇÃO LOVABLE

Use este checklist para garantir que tudo está funcionando corretamente.

---

## 📋 FASE 1: PREPARAÇÃO

- [ ] Ler `LOVABLE-EXECUTIVE-SUMMARY.md`
- [ ] Ler `LOVABLE-INTEGRATION-GUIDE.md`
- [ ] Fazer backup do banco de dados
- [ ] Criar branch git para a integração
- [ ] Ter acesso ao painel do Lovable

---

## 📋 FASE 2: BANCO DE DADOS LOCAL

- [ ] Abrir Supabase SQL Editor
- [ ] Executar `database/11-integration-logs.sql`
- [ ] Verificar que tabela `integration_logs` foi criada:
  ```sql
  SELECT * FROM integration_logs LIMIT 1;
  ```
- [ ] Verificar que função existe:
  ```sql
  SELECT proname FROM pg_proc WHERE proname = 'log_integration_action';
  ```
- [ ] Testar inserção:
  ```sql
  SELECT log_integration_action('test', 'success', '{"test": true}'::jsonb);
  SELECT * FROM integration_logs ORDER BY created_at DESC LIMIT 1;
  ```

---

## 📋 FASE 3: LOVABLE - EDGE FUNCTION

- [ ] Acessar projeto no Lovable
- [ ] Ir em **Database** → **Edge Functions**
- [ ] Criar nova função: `admin-user-manager`
- [ ] Colar código de `docs/lovable-edge-function.ts`
- [ ] Fazer **Deploy**
- [ ] Copiar URL gerada (ex: `https://xyz.supabase.co/functions/v1/admin-user-manager`)
- [ ] Testar Edge Function:
  ```bash
  curl -X GET \
    https://sua-url/functions/v1/admin-user-manager \
    -H "x-api-secret: webhook-appmax-2026-secure-key"
  ```
- [ ] Verificar resposta: `{"success": true, "users": [...], "total": X}`

---

## 📋 FASE 4: VARIÁVEIS DE AMBIENTE

- [ ] Copiar `.env.lovable.example` para `.env.local`
- [ ] Preencher `NEXT_PUBLIC_LOVABLE_EDGE_FUNCTION_URL` (URL copiada acima)
- [ ] Preencher `NEXT_PUBLIC_LOVABLE_APP_URL` (URL do seu app Lovable)
- [ ] (Opcional) Configurar `RESEND_API_KEY` e `EMAIL_FROM`
- [ ] Salvar `.env.local`
- [ ] Verificar que `.env.local` está no `.gitignore`

---

## 📋 FASE 5: DEPENDÊNCIAS (SE USAR E-MAIL)

- [ ] Se configurou Resend, instalar:
  ```bash
  npm install resend
  ```
- [ ] Se usar SMTP, configurar variáveis SMTP no `.env.local`
- [ ] Se não usar e-mail, pular esta etapa (sistema só criará usuário)

---

## 📋 FASE 6: REINICIAR SERVIDOR

- [ ] Parar servidor Next.js (Ctrl+C)
- [ ] Limpar cache:
  ```bash
  rm -rf .next
  ```
- [ ] Iniciar novamente:
  ```bash
  npm run dev
  ```
- [ ] Verificar console por erros
- [ ] Verificar que servidor está rodando em `http://localhost:3000`

---

## 📋 FASE 7: TESTE MANUAL - INTERFACE

### Teste 1: Acessar Páginas
- [ ] Abrir `http://localhost:3000/admin/lovable/users`
- [ ] Verificar que página carrega sem erros
- [ ] Verificar que cards de estatísticas aparecem
- [ ] Abrir `http://localhost:3000/admin/lovable/emails`
- [ ] Verificar que página de logs carrega

### Teste 2: Criar Usuário Manualmente
- [ ] Ir em `/admin/lovable/users`
- [ ] Clicar em **"Novo Usuário"**
- [ ] Preencher:
  - Nome: `Teste Manual`
  - Email: `teste@manual.com`
- [ ] Clicar em **🎲 Gerar** (senha)
- [ ] Copiar senha gerada (📋)
- [ ] Clicar em **"Criar Usuário"**
- [ ] Verificar toast de sucesso: "✅ Usuário teste@manual.com criado com sucesso"
- [ ] Verificar que usuário aparece na tabela
- [ ] Anotar senha gerada: `_______________`

### Teste 3: Verificar Log de Criação
- [ ] Ir em `/admin/lovable/emails`
- [ ] Verificar que aparece log com:
  - Ação: "Criar Usuário"
  - Status: Badge verde "Sucesso"
  - Destinatário: `teste@manual.com`
- [ ] Clicar em **"Detalhes"**
- [ ] Verificar que modal mostra payload completo

### Teste 4: Reset de Senha
- [ ] Voltar em `/admin/lovable/users`
- [ ] Clicar em **"Alterar Senha"** no usuário `teste@manual.com`
- [ ] Clicar em **🎲 Gerar** (nova senha)
- [ ] Copiar nova senha (📋)
- [ ] Clicar em **"Alterar Senha"**
- [ ] Verificar toast de sucesso
- [ ] Anotar nova senha: `_______________`

### Teste 5: Verificar Log de Reset
- [ ] Ir em `/admin/lovable/emails`
- [ ] Filtrar por ação: "Reset Senha"
- [ ] Verificar que log aparece com status sucesso

---

## 📋 FASE 8: TESTE AUTOMÁTICO - WEBHOOK

### Preparação
- [ ] Anotar URL do webhook: `http://localhost:3000/api/webhooks/appmax`
- [ ] Anotar secret (se configurado): `_______________`

### Teste: Simular Aprovação
- [ ] Executar comando (substitua o secret):
  ```bash
  curl -X POST http://localhost:3000/api/webhooks/appmax \
    -H "Content-Type: application/json" \
    -H "x-appmax-signature: sha256=SEU_HASH_AQUI" \
    -d '{
      "event": "order.approved",
      "data": {
        "order_id": "WEBHOOK_TEST_001",
        "customer_email": "webhook@teste.com",
        "customer_name": "Cliente Webhook",
        "total_amount": 197,
        "payment_method": "credit_card"
      }
    }'
  ```
- [ ] Verificar resposta: `{"success": true, "status": "approved"}`

### Verificações
- [ ] Verificar que venda foi criada na tabela `sales`:
  ```sql
  SELECT * FROM sales WHERE appmax_order_id = 'WEBHOOK_TEST_001';
  ```
- [ ] Ir em `/admin/lovable/users`
- [ ] Verificar que usuário `webhook@teste.com` foi criado
- [ ] Se e-mail configurado, verificar que recebeu e-mail
- [ ] Ir em `/admin/lovable/emails`
- [ ] Verificar logs:
  - [ ] Log "create_user_auto" com status sucesso
  - [ ] Log "send_email" (se e-mail configurado)

---

## 📋 FASE 9: TESTE DE LOGIN NO LOVABLE

- [ ] Abrir URL do app Lovable (variável `NEXT_PUBLIC_LOVABLE_APP_URL`)
- [ ] Fazer login com:
  - Email: `teste@manual.com`
  - Senha: (anotar senha na Fase 7, Teste 2)
- [ ] Verificar que consegue fazer login
- [ ] Verificar que email está confirmado (não precisa verificar)

---

## 📋 FASE 10: MONITORAMENTO

### Logs SQL
- [ ] Abrir Supabase SQL Editor
- [ ] Executar queries de monitoramento:

```sql
-- Ver últimos 20 logs
SELECT 
  created_at,
  action,
  status,
  recipient_email,
  error_message
FROM integration_logs
ORDER BY created_at DESC
LIMIT 20;

-- Estatísticas por ação
SELECT 
  action,
  status,
  COUNT(*) as total
FROM integration_logs
GROUP BY action, status
ORDER BY action, status;

-- Taxa de sucesso
SELECT 
  COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*) as success_rate
FROM integration_logs;
```

### Dashboard
- [ ] Verificar cards de estatísticas em `/admin/lovable/users`
- [ ] Verificar cards de métricas em `/admin/lovable/emails`
- [ ] Aplicar filtros na página de logs
- [ ] Testar botão "Atualizar" (refresh)

---

## 📋 FASE 11: PRODUÇÃO (QUANDO PRONTO)

### Deploy
- [ ] Fazer commit das alterações
- [ ] Push para repositório
- [ ] Deploy no ambiente de produção (Vercel/etc)
- [ ] Executar migration SQL no banco de produção
- [ ] Configurar variáveis de ambiente no painel de produção
- [ ] Verificar que Edge Function do Lovable está deployada

### Webhook Appmax
- [ ] Acessar painel da Appmax
- [ ] Ir em Configurações → Webhooks
- [ ] Configurar URL: `https://seudominio.com/api/webhooks/appmax`
- [ ] Selecionar eventos:
  - [ ] `order.approved`
  - [ ] `order.paid`
- [ ] Salvar configuração
- [ ] Fazer venda de teste real
- [ ] Verificar que webhook foi disparado

### E-mail
- [ ] Se usar Resend, verificar domínio DNS configurado
- [ ] Enviar e-mail de teste
- [ ] Verificar caixa de spam
- [ ] Ajustar template se necessário

---

## 📋 FASE 12: DOCUMENTAÇÃO

- [ ] Documentar URL da Edge Function
- [ ] Documentar credenciais de teste
- [ ] Criar runbook para troubleshooting
- [ ] Treinar equipe de suporte (se aplicável)
- [ ] Adicionar alertas de monitoramento (opcional)

---

## 🎯 CHECKLIST FINAL

- [ ] ✅ Banco de dados configurado
- [ ] ✅ Edge Function deployada e testada
- [ ] ✅ Variáveis de ambiente configuradas
- [ ] ✅ Interface administrativa funcionando
- [ ] ✅ Criação manual de usuário OK
- [ ] ✅ Reset de senha OK
- [ ] ✅ Logs sendo registrados
- [ ] ✅ Webhook automático funcionando
- [ ] ✅ E-mail sendo enviado (ou configurado para skip)
- [ ] ✅ Login no Lovable funcionando
- [ ] ✅ Sistema em produção (quando pronto)

---

## 🚨 TROUBLESHOOTING RÁPIDO

### Erro ao criar usuário
1. Verificar Edge Function está deployada
2. Verificar URL em `.env.local`
3. Verificar API secret
4. Ver logs em `/admin/lovable/emails`

### E-mail não enviado
1. Verificar `RESEND_API_KEY`
2. Verificar domínio do `EMAIL_FROM`
3. Ver logs em `/admin/lovable/emails` → Filtrar por "send_email"

### Webhook não cria usuário
1. Ver logs do servidor Next.js
2. Ver logs em `integration_logs` (SQL)
3. Verificar status do pedido (deve ser "approved" ou "paid")

---

## ✅ PRONTO!

Se todos os itens estão marcados, sua integração está **100% funcional**!

**Parabéns! 🎉**

---

**Data de Conclusão:** ___/___/______  
**Responsável:** ___________________  
**Ambiente:** [ ] Desenvolvimento [ ] Produção
