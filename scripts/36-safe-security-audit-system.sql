-- Sistema de auditoria seguro SEM quebrar funcionalidades existentes
-- Tabela de logs de auditoria para rastrear operações críticas
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

-- Tabela para eventos de segurança
CREATE TABLE IF NOT EXISTS security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'low',
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar colunas de segurança SEM quebrar estrutura existente
ALTER TABLE issued_certificates 
ADD COLUMN IF NOT EXISTS integrity_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS request_id UUID,
ADD COLUMN IF NOT EXISTS validation_token VARCHAR(128);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_integrity ON issued_certificates(integrity_hash);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_request_id ON issued_certificates(request_id);

-- Políticas RLS para novas tabelas (apenas service role)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_service_only" ON audit_logs FOR ALL USING (false);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "security_events_service_only" ON security_events FOR ALL USING (false);

-- Função para limpeza automática de logs antigos
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM security_events WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
