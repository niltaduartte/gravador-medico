# 📧 Guia de Configuração do Sistema de Emails

## ✅ O QUE FOI IMPLEMENTADO

### 1️⃣ **Templates de Email**
- ✅ `WelcomeEmail.tsx` - Email de boas-vindas com credenciais
- ✅ Design responsivo e profissional
- ✅ Detalhes do pedido incluídos
- ✅ CTA para login na plataforma

### 2️⃣ **Serviço de Email** (`lib/email.ts`)
- ✅ `sendWelcomeEmail()` - Envia credenciais após pagamento
- ✅ `sendPixPendingEmail()` - Envia QR Code PIX por email
- ✅ Tratamento de erros completo
- ✅ Logs detalhados

### 3️⃣ **Integração Automática**
- ✅ Provisioning worker envia email após criar usuário
- ✅ Envio automático quando pagamento aprovado
- ✅ Inclui senha gerada automaticamente

---

## 🚀 CONFIGURAÇÃO (3 PASSOS)

### PASSO 1: Criar Conta no Resend

1. Acesse: https://resend.com/signup
2. Crie sua conta (gratuito até 3.000 emails/mês)
3. Confirme seu email

### PASSO 2: Configurar Domínio

1. No painel Resend, vá em **Domains**
2. Adicione: `gravadormedico.com.br`
3. Copie os registros DNS fornecidos
4. Adicione no seu provedor de DNS:
   - **Tipo SPF**: `v=spf1 include:_spf.resend.com ~all`
   - **DKIM**: (copie do Resend)
   - **DMARC**: (copie do Resend)
5. Aguarde verificação (5-30 min)

### PASSO 3: Adicionar API Key no Vercel

1. No Resend, vá em **API Keys**
2. Clique em **Create API Key**
3. Nome: `Gravador Medico Production`
4. Permissões: **Send emails**
5. Copie a chave (começa com `re_...`)

6. No terminal, execute:

```bash
cd /Users/helciomattos/Desktop/GRAVADOR\ MEDICO
echo -n "COLE_SUA_CHAVE_AQUI" | vercel env add RESEND_API_KEY production
```

7. Faça redeploy:

```bash
vercel --prod
```

---

## 🧪 TESTAR O SISTEMA

### Teste 1: Email de Boas-Vindas

1. Faça uma compra de teste no site
2. Use PIX ou cartão de teste do Mercado Pago
3. Aguarde pagamento ser aprovado
4. Verifique seu email (pode demorar 1-2 minutos)

**O que deve chegar:**
- ✅ Email com título: "🎉 Bem-vindo ao Gravador Médico"
- ✅ Credenciais de acesso (email + senha)
- ✅ Botão para acessar plataforma
- ✅ Detalhes do pedido

### Teste 2: Email de PIX Pendente

1. Faça checkout com PIX
2. NÃO pague ainda
3. Verifique email

**O que deve chegar:**
- ✅ QR Code PIX
- ✅ Código Pix Copia e Cola
- ✅ Valor e número do pedido

---

## 📊 MONITORAMENTO

### Ver Logs de Email no Resend

1. Acesse: https://resend.com/emails
2. Veja todos os emails enviados
3. Status: Delivered / Bounced / Failed
4. Taxa de abertura e cliques

### Ver Logs no Vercel

```bash
vercel logs --prod
```

Procure por:
- `✅ Email enviado com sucesso`
- `❌ Erro ao enviar email`

---

## 🔧 CUSTOMIZAÇÃO

### Alterar Remetente

Em `lib/email.ts`, linha 20:

```typescript
from: 'Seu Nome <noreply@seudominio.com>',
```

### Alterar Template

Edite `emails/WelcomeEmail.tsx`:
- Cores, fonte, layout
- Adicionar mais informações
- Incluir links extras

### Adicionar Novos Tipos de Email

Crie nova função em `lib/email.ts`:

```typescript
export async function sendPasswordResetEmail(params) {
  // ...
}
```

---

## ❌ PROBLEMAS COMUNS

### Email não chega

1. **Verifique RESEND_API_KEY** no Vercel
2. **Confirme domínio** está verificado no Resend
3. **Verifique spam** na caixa de entrada
4. **Veja logs** no Resend Dashboard

### Email vai para spam

1. **Configure SPF, DKIM, DMARC** corretamente
2. **Aqueça o domínio** (envie poucos emails no início)
3. **Evite palavras spam** no assunto
4. **Peça para marcar como "Não é spam"**

### Erro: "Domain not verified"

1. Aguarde até 30 minutos após adicionar DNS
2. Verifique registros DNS no seu provedor
3. Use ferramenta: https://mxtoolbox.com/

---

## 📈 PRÓXIMOS PASSOS

- [ ] Configurar domínio no Resend
- [ ] Adicionar API key no Vercel
- [ ] Testar envio de email real
- [ ] Criar template de recuperação de senha
- [ ] Adicionar analytics de email
- [ ] Implementar tracking de abertura

---

## 💡 DICAS PRO

1. **Use domínio próprio** (não @gmail.com)
2. **Aqueça o IP** gradualmente
3. **Monitore taxa de bounce** (< 2%)
4. **Teste em vários clientes** (Gmail, Outlook, Apple Mail)
5. **Tenha botão "Ver no navegador"** para emails complexos

---

## 🎯 STATUS ATUAL

✅ **Sistema 100% pronto para produção!**

Só falta:
1. Configurar domínio no Resend (10 min)
2. Adicionar API key (2 min)
3. Testar (5 min)

**Total: ~15 minutos para estar 100% operacional!**

---

Precisa de ajuda? Me chame! 🚀
