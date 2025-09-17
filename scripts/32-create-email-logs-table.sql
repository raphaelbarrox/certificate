-- Criar tabela para armazenar logs de email
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID REFERENCES certificate_templates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'certificate_issued', 'test_email', 'error', 'debug'
    status VARCHAR(20) NOT NULL, -- 'success', 'error', 'pending', 'info'
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_email_logs_template_id ON email_logs(template_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- RLS (Row Level Security)
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem apenas seus próprios logs
CREATE POLICY "Users can view their own email logs" ON email_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Política para inserir logs (sistema pode inserir)
CREATE POLICY "System can insert email logs" ON email_logs
    FOR INSERT WITH CHECK (true);

-- Função para limpar logs antigos (opcional)
CREATE OR REPLACE FUNCTION cleanup_old_email_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM email_logs 
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Comentários
COMMENT ON TABLE email_logs IS 'Logs de todas as operações de email do sistema';
COMMENT ON COLUMN email_logs.type IS 'Tipo do log: certificate_issued, test_email, error, debug';
COMMENT ON COLUMN email_logs.status IS 'Status da operação: success, error, pending, info';
COMMENT ON COLUMN email_logs.details IS 'Detalhes adicionais em JSON (recipient, certificateId, error, etc.)';
