-- Criando sistema completo de auditoria e segurança
-- Tabela de logs de auditoria para rastrear todas as operações críticas
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para rastrear tentativas de acesso suspeitas
CREATE TABLE IF NOT EXISTS security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'low',
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar coluna de hash de integridade na tabela issued_certificates
ALTER TABLE issued_certificates 
ADD COLUMN IF NOT EXISTS integrity_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS request_id UUID,
ADD COLUMN IF NOT EXISTS validation_token VARCHAR(128);

-- Índices para performance das consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_integrity ON issued_certificates(integrity_hash);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_request_id ON issued_certificates(request_id);

-- Políticas RLS para audit_logs (apenas admins podem ver)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_admin_only" ON audit_logs
  FOR ALL USING (false); -- Por enquanto, apenas via service role

-- Políticas RLS para security_events
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "security_events_admin_only" ON security_events
  FOR ALL USING (false); -- Por enquanto, apenas via service role

-- Função para limpar logs antigos (manter apenas 90 dias)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM security_events WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
