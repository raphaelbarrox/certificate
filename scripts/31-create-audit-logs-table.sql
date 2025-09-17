-- Criar tabela de logs de auditoria para rastreamento de segurança
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'warning')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance em consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);

-- RLS para proteger logs de auditoria
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Política para permitir apenas inserção de logs (não leitura/edição)
CREATE POLICY "Allow insert audit logs" ON audit_logs
    FOR INSERT
    WITH CHECK (true);

-- Política para admin ler logs (se necessário)
CREATE POLICY "Admin read audit logs" ON audit_logs
    FOR SELECT
    USING (false); -- Desabilitado por padrão, habilitar apenas para admins específicos

-- Função para limpeza automática de logs antigos (opcional)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
