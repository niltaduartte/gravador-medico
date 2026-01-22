-- ================================================================
-- ADD: Presenca WhatsApp (online, visto por ultimo, digitando)
-- ================================================================

ALTER TABLE whatsapp_contacts
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

ALTER TABLE whatsapp_contacts
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

ALTER TABLE whatsapp_contacts
  ADD COLUMN IF NOT EXISTS is_typing BOOLEAN DEFAULT FALSE;

ALTER TABLE whatsapp_contacts
  ADD COLUMN IF NOT EXISTS typing_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_online
  ON whatsapp_contacts(is_online, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_typing
  ON whatsapp_contacts(is_typing)
  WHERE is_typing = true;

COMMENT ON COLUMN whatsapp_contacts.is_online IS 'Contato esta online no WhatsApp';
COMMENT ON COLUMN whatsapp_contacts.last_seen_at IS 'Ultima vez visto online';
COMMENT ON COLUMN whatsapp_contacts.is_typing IS 'Contato esta digitando';
COMMENT ON COLUMN whatsapp_contacts.typing_updated_at IS 'Ultima atualizacao do status digitando';

-- Atualizar view para expor presenca
DROP VIEW IF EXISTS whatsapp_conversations CASCADE;

CREATE OR REPLACE VIEW whatsapp_conversations AS
SELECT 
  c.id,
  c.remote_jid,
  c.name,
  c.push_name,
  c.profile_picture_url,
  c.is_group,
  c.last_message_content,
  c.last_message_timestamp,
  c.last_message_from_me,
  c.unread_count,
  c.updated_at,
  (
    SELECT COUNT(*) 
    FROM whatsapp_messages m 
    WHERE m.remote_jid = c.remote_jid
  ) as total_messages,
  (
    SELECT COUNT(*) 
    FROM whatsapp_messages m 
    WHERE m.remote_jid = c.remote_jid 
    AND m.from_me = false
  ) as received_messages,
  (
    SELECT COUNT(*) 
    FROM whatsapp_messages m 
    WHERE m.remote_jid = c.remote_jid 
    AND m.from_me = true
  ) as sent_messages,
  c.is_online,
  c.last_seen_at,
  c.is_typing,
  c.typing_updated_at
FROM whatsapp_contacts c
ORDER BY c.last_message_timestamp DESC NULLS LAST;
