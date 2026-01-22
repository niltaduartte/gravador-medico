-- ================================================================
-- ATUALIZAR CAMPO from_me EM MENSAGENS EXISTENTES
-- ================================================================

-- IMPORTANTE: Este script tenta identificar mensagens enviadas pelo sistema
-- baseado em padrões comuns. Ajuste conforme necessário.

-- ================================================================
-- OPÇÃO 1: Se você tiver um padrão no message_id
-- ================================================================
-- Exemplo: message_ids de mensagens enviadas costumam ter um formato diferente
-- UPDATE whatsapp_messages 
-- SET from_me = true 
-- WHERE message_id LIKE 'BAE%' OR message_id LIKE '3EB%';

-- ================================================================
-- OPÇÃO 2: Se você tiver o remote_jid do seu sistema
-- ================================================================
-- Se mensagens enviadas tiverem algum padrão no remote_jid ou outro campo
-- UPDATE whatsapp_messages 
-- SET from_me = true 
-- WHERE <sua_condição>;

-- ================================================================
-- OPÇÃO 3: Marcar TODAS as mensagens como recebidas (padrão seguro)
-- ================================================================
-- Isso garante que apenas NOVAS mensagens do webhook virão com from_me correto
UPDATE whatsapp_messages 
SET from_me = false 
WHERE from_me IS NULL;

-- ================================================================
-- VERIFICAÇÃO: Contar mensagens por tipo
-- ================================================================
SELECT 
  CASE 
    WHEN from_me THEN 'Enviadas pelo sistema'
    ELSE 'Recebidas de clientes'
  END as tipo,
  COUNT(*) as total
FROM whatsapp_messages
GROUP BY from_me
ORDER BY from_me DESC;

-- ================================================================
-- TESTAR: Ver últimas 10 mensagens com detalhes
-- ================================================================
SELECT 
  id,
  remote_jid,
  SUBSTRING(content, 1, 50) as preview,
  from_me,
  timestamp,
  created_at
FROM whatsapp_messages
ORDER BY timestamp DESC
LIMIT 10;
