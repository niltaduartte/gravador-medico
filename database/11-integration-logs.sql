-- =====================================================
-- TABELA DE AUDITORIA PARA INTEGRAÇÃO LOVABLE
-- =====================================================
-- Criado em: 26 de Janeiro de 2026
-- Objetivo: Registrar todas as ações da integração com o sistema externo
-- =====================================================

-- Criar tabela de logs
CREATE TABLE IF NOT EXISTS public.integration_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    action VARCHAR(100) NOT NULL, -- 'create_user', 'send_email', 'reset_password', etc
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'pending')),
    details JSONB DEFAULT '{}'::jsonb, -- Dados adicionais flexíveis
    recipient_email VARCHAR(255), -- Email do destinatário (quando aplicável)
    user_id UUID, -- ID do usuário relacionado (quando aplicável)
    error_message TEXT, -- Mensagem de erro detalhada
    http_status_code INTEGER, -- Código HTTP da requisição
    request_payload JSONB, -- Payload enviado
    response_payload JSONB -- Resposta recebida
);

-- Criar índices para performance
CREATE INDEX idx_integration_logs_created_at ON public.integration_logs(created_at DESC);
CREATE INDEX idx_integration_logs_action ON public.integration_logs(action);
CREATE INDEX idx_integration_logs_status ON public.integration_logs(status);
CREATE INDEX idx_integration_logs_recipient_email ON public.integration_logs(recipient_email);
CREATE INDEX idx_integration_logs_user_id ON public.integration_logs(user_id);

-- Comentários para documentação
COMMENT ON TABLE public.integration_logs IS 'Auditoria completa de todas as operações da integração com Lovable';
COMMENT ON COLUMN public.integration_logs.action IS 'Tipo de ação executada (create_user, send_email, reset_password, etc)';
COMMENT ON COLUMN public.integration_logs.status IS 'Status da operação (success, error, pending)';
COMMENT ON COLUMN public.integration_logs.details IS 'Dados adicionais em formato JSON flexível';
COMMENT ON COLUMN public.integration_logs.recipient_email IS 'Email do destinatário quando aplicável';

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- Política: Apenas admins podem ler os logs
CREATE POLICY "Admin pode ler logs"
    ON public.integration_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Política: Sistema pode inserir logs (via service_role)
CREATE POLICY "Sistema pode inserir logs"
    ON public.integration_logs
    FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- FUNÇÃO AUXILIAR: Registrar Log
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_integration_action(
    p_action VARCHAR,
    p_status VARCHAR,
    p_details JSONB DEFAULT '{}'::jsonb,
    p_recipient_email VARCHAR DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_http_status_code INTEGER DEFAULT NULL,
    p_request_payload JSONB DEFAULT NULL,
    p_response_payload JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.integration_logs (
        action,
        status,
        details,
        recipient_email,
        user_id,
        error_message,
        http_status_code,
        request_payload,
        response_payload
    )
    VALUES (
        p_action,
        p_status,
        p_details,
        p_recipient_email,
        p_user_id,
        p_error_message,
        p_http_status_code,
        p_request_payload,
        p_response_payload
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

-- =====================================================
-- TESTE: Inserir um log de exemplo
-- =====================================================
SELECT public.log_integration_action(
    'test_action',
    'success',
    '{"message": "Sistema de logs funcionando"}'::jsonb,
    'teste@exemplo.com'
);

-- Verificar
SELECT 
    id,
    created_at,
    action,
    status,
    recipient_email,
    details
FROM public.integration_logs
ORDER BY created_at DESC
LIMIT 5;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
