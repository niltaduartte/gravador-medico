# 💬 Chat Interno - Guia Rápido

## 🚀 Como Usar

### 1️⃣ Executar SQL (PRIMEIRA VEZ)

**IMPORTANTE**: Antes de usar o chat pela primeira vez, execute o SQL:

1. Acesse: https://supabase.com/dashboard/project/egsmraszqnmosmtjuzhx/sql/new
2. Abra o arquivo: `database/10-admin-chat-schema.sql`
3. Copie TODO o conteúdo
4. Cole no SQL Editor do Supabase
5. Clique em **"Run"**
6. Aguarde: `Success. No rows returned`

✅ Pronto! Agora o chat está configurado.

---

### 2️⃣ Acessar o Chat

- **Pelo Menu**: Clique no ícone 💬 "Chat Interno" no DockSidebar (menu lateral)
- **URL Direta**: `/admin/chat`

---

### 3️⃣ Iniciar Nova Conversa

1. Clique no botão **"+"** (Plus) no canto superior direito
2. Aparecerá uma lista de administradores
3. Clique no admin que deseja conversar
4. Uma conversa direta será criada (ou aberta se já existir)

---

### 4️⃣ Enviar Mensagem

- **Digite** no campo de texto
- **Enter** = Envia
- **Shift + Enter** = Nova linha
- **Botão de Enviar** = ✈️ (canto direito)

---

### 5️⃣ Receber Mensagens

**As mensagens chegam em TEMPO REAL!**

Quando um admin te enviar mensagem, você verá:

1. 🔔 **Toast** no canto superior direito ("Nova mensagem")
2. 🔴 **Badge vermelho** no sininho do menu
3. 💬 **Mensagem aparece automaticamente** se o chat estiver aberto
4. 🔢 **Contador de não lidas** aumenta na lista de conversas

**Para ler**:
- Clique na conversa (contador zera automaticamente)
- Ou clique em "Ver" no toast
- Ou clique no sininho → item da notificação

---

### 6️⃣ Buscar Conversas

- Use o campo **"Buscar conversas..."** no topo da sidebar
- Busca por:
  - Nome do admin
  - Email
  - Conteúdo de mensagens

---

## 🎨 Interface

### Layout

```
┌───────────────────────────────────────────────────────┐
│ 💬 Chat Interno                           [+]         │
├──────────────────┬────────────────────────────────────┤
│ [Buscar...]      │ João Silva (joao@example.com)      │
│                  │ ────────────────────────────────    │
│ João Silva    2  │                                     │
│ Oi, tudo bem?    │  ┌──────────────┐                  │
│ 5 min atrás      │  │ Oi, João!    │                  │
│                  │  └──────────────┘ 10:30             │
│ Maria Santos     │                                     │
│ Preciso falar... │      ┌──────────────────────┐      │
│ Ontem            │      │ Tudo certo sim!      │      │
│                  │      │ Como posso ajudar?   │      │
│ [+ Nova]         │      └──────────────────────┘      │
│                  │                           10:31     │
│                  │ ────────────────────────────────    │
│                  │ [Digite mensagem...]        [✈️]    │
└──────────────────┴────────────────────────────────────┘
```

### Cores (WhatsApp Dark Theme)

- **Background**: Preto/Cinza escuro (`#111b21`)
- **Mensagens Enviadas**: Verde escuro (`#005c4b`)
- **Mensagens Recebidas**: Cinza (`#202c33`)
- **Accent**: Verde WhatsApp (`#00a884`)
- **Badge Não Lidas**: Verde (`#00a884`)

---

## ⚡ Recursos

### ✅ Mensagens em Tempo Real
- **Realtime WebSocket** com Supabase
- Mensagens chegam instantaneamente
- Sem necessidade de refresh

### ✅ Notificações Inteligentes
- Toast quando recebe mensagem
- Badge no sininho
- Notificação do navegador (se permitir)
- Deep linking (clique vai direto pro chat)

### ✅ Contador de Não Lidas
- Aparece ao lado do nome da conversa
- Badge verde com número
- Zera automaticamente ao abrir o chat

### ✅ Timestamps Inteligentes
- **Agora mesmo**: "alguns segundos"
- **Recente**: "5 minutos atrás"
- **Hoje**: "2 horas atrás"
- **Antigo**: "Ontem", "2 dias atrás"

### ✅ Auto-Scroll
- Rola automaticamente para última mensagem
- Smooth scroll quando mensagem chega

### ✅ Avatar Inteligente
- **Com foto**: Mostra avatar do admin
- **Sem foto**: Mostra inicial do nome em círculo colorido

---

## 🔧 Funcionalidades Técnicas

### Database
- **3 Tabelas**: conversations, participants, messages
- **2 Triggers**: Auto-atualiza timestamps e unread_count
- **2 Funções SQL**: Criar conversa e marcar como lida
- **1 VIEW**: Dados completos das conversas

### Realtime
- **3 Canais**: INSERT messages, UPDATE conversations, UPDATE participants
- **Auto-reconnect**: Reconecta automaticamente se cair
- **Logs no Console**: Veja `📡 Status Realtime Chat: SUBSCRIBED`

### Performance
- **Denormalizado**: Última mensagem salva direto na conversa
- **Índices**: Queries otimizadas com índices
- **Soft Delete**: Mensagens deletadas não aparecem

---

## 🧪 Testar com 2 Usuários

1. **Abra 2 navegadores** (ou anônimo + normal)
2. **Faça login** com 2 admins diferentes
3. **Admin 1**: Crie conversa com Admin 2
4. **Admin 1**: Envie mensagem
5. **Admin 2**: Veja chegar em tempo real (sem refresh!)
6. **Admin 2**: Responda
7. **Admin 1**: Veja chegar automaticamente

✅ Deve funcionar instantaneamente!

---

## 📊 Exemplo de Fluxo

### Cenário: João envia mensagem para Maria

```
1. João digita: "Oi Maria, tudo bem?"
2. Clica Enter (ou botão Enviar)
   ↓
3. INSERT em admin_chat_messages
   ↓
4. Trigger 1: Atualiza conversations.updated_at
   Trigger 2: Incrementa Maria.unread_count
   ↓
5. Supabase Realtime notifica todos os clientes
   ↓
6. Frontend de Maria detecta INSERT
   ↓
7. addNotification() é chamado:
   - Toast aparece: "João Silva: Oi Maria, tudo bem?"
   - Badge do sininho: +1
   - Browser notification
   ↓
8. Maria clica em "Ver"
   ↓
9. Redireciona: /admin/chat?conversation=uuid-123
   ↓
10. Chat abre automaticamente
11. mark_admin_chat_as_read() é chamado
12. unread_count volta pra 0
```

---

## 🐛 Troubleshooting

### Mensagens não chegam em tempo real?

1. **Abra Console (F12)**
2. Procure por: `📡 Status Realtime Chat: SUBSCRIBED`
3. Se não aparecer:
   - Verifique se executou o SQL
   - Verifique conexão com internet
   - Recarregue a página

### Contador de não lidas não atualiza?

1. **Verifique Trigger**: `increment_admin_chat_unread`
2. **Console**: Procure por erros SQL
3. **Teste manual**: Execute no Supabase:
   ```sql
   SELECT * FROM admin_chat_participants WHERE user_id = 'seu-user-id';
   ```

### Avatar não aparece?

- Verifique se há `avatar_url` na tabela `users`
- Se não, mostrará inicial do nome (funciona normal)

### Toast não aparece?

1. Verifique se `<Toaster />` está em `app/layout.tsx`
2. Verifique se `<NotificationProvider>` está envolvendo o app
3. Console: Procure por erros de importação

---

## 🔐 Segurança

- ✅ **Autenticação**: Verifica `supabase.auth.getUser()`
- ✅ **Redirect**: Se não autenticado, vai pra `/login`
- ✅ **RLS**: Políticas no Supabase (configurar se necessário)
- ✅ **Validação**: Não envia mensagens vazias

---

## 📈 Melhorias Futuras

- [ ] **Upload de Imagens**: Enviar fotos no chat
- [ ] **Upload de Arquivos**: PDF, DOCX, etc
- [ ] **Grupos**: Conversas com 3+ admins
- [ ] **Busca de Mensagens**: Buscar dentro das conversas
- [ ] **Reações**: Emoji reactions (👍, ❤️, etc)
- [ ] **Mensagens de Voz**: Áudio no chat
- [ ] **Status Online**: Ver quem está online
- [ ] **Digitando...**: Indicador quando outro está digitando

---

## 💡 Dicas

✅ **Atalho Enter**: Acostume-se! Enter envia, Shift+Enter quebra linha  
✅ **Badge do Sininho**: Sempre visível em todo o dashboard  
✅ **Deep Linking**: Copie a URL com `?conversation=` para compartilhar  
✅ **Auto-Scroll**: Mensagens novas rolam automaticamente  
✅ **Busca Rápida**: Use a busca na sidebar, é instantânea  

---

## 📞 Suporte

Se tiver problemas:
1. Verifique logs do console (F12)
2. Verifique se SQL foi executado
3. Teste Realtime: `📡 Status Realtime Chat: SUBSCRIBED`
4. Verifique erros TypeScript no terminal dev

---

**Aproveite o Chat Interno! 💬✨**
