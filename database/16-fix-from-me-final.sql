-- ================================================================
-- CORRECAO AUTOMATICA: Ajustar from_me usando raw_payload.key.fromMe
-- ================================================================
-- Evita usar prefixos de message_id (nao confiavel)
-- ================================================================

-- 1. Ver situacao ANTES
SELECT 
  'ANTES DA CORRECAO' as status,
  from_me,
  COUNT(*) as total
FROM whatsapp_messages
GROUP BY from_me
ORDER BY from_me DESC;

-- 2. CORRECAO PRINCIPAL - usar raw_payload.key.fromMe quando disponivel
UPDATE whatsapp_messages
SET from_me = CASE
  WHEN lower(raw_payload->'key'->>'fromMe') IN ('true', '1', 't') THEN true
  WHEN lower(raw_payload->'key'->>'fromMe') IN ('false', '0', 'f') THEN false
  ELSE from_me
END
WHERE raw_payload ? 'key'
  AND (raw_payload->'key'->>'fromMe') IS NOT NULL;

-- 3. Atualizar ultimo status nas conversas (opcional)
UPDATE whatsapp_contacts c
SET last_message_from_me = m.from_me,
    last_message_content = COALESCE(m.content, m.caption, '[Midia]'),
    last_message_timestamp = m.timestamp
FROM LATERAL (
  SELECT from_me, content, caption, timestamp
  FROM whatsapp_messages
  WHERE remote_jid = c.remote_jid
  ORDER BY timestamp DESC
  LIMIT 1
) m;

-- 4. Ver situacao DEPOIS
SELECT 
  'DEPOIS DA CORRECAO' as status,
  from_me,
  COUNT(*) as total
FROM whatsapp_messages
GROUP BY from_me
ORDER BY from_me DESC;

-- 5. Ver ultimas 30 mensagens
SELECT 
  LEFT(message_id, 20) as msg_id,
  LEFT(content, 40) as conteudo,
  from_me,
  to_char(timestamp, 'DD/MM HH24:MI') as quando
FROM whatsapp_messages
ORDER BY timestamp DESC
LIMIT 30;

-- 6. Diagnostico: mensagens sem fromMe no raw_payload
SELECT 
  'SEM raw_payload.key.fromMe' as analise,
  COUNT(*) as total
FROM whatsapp_messages
WHERE raw_payload->'key'->>'fromMe' IS NULL;
