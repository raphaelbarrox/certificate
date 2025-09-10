-- Script de otimização de performance - SEGURO para execução
-- Este script adiciona apenas índices essenciais sem conflitar com funções existentes

-- ========================================
-- ÍNDICES DE PERFORMANCE ESSENCIAIS
-- ========================================

-- Removido CONCURRENTLY para permitir execução em transação
-- Índice para ordenação por data de emissão (usado no dashboard)
CREATE INDEX IF NOT EXISTS idx_certificates_issued_at 
ON issued_certificates USING btree (issued_at DESC);

-- Índice para joins frequentes entre certificados e templates
CREATE INDEX IF NOT EXISTS idx_certificates_template_id_issued_at 
ON issued_certificates USING btree (template_id, issued_at DESC);

-- Índice para busca por número de certificado (verificação única)
CREATE INDEX IF NOT EXISTS idx_certificates_number_unique 
ON issued_certificates USING btree (certificate_number) 
WHERE certificate_number IS NOT NULL;

-- Índice para busca por email do destinatário
CREATE INDEX IF NOT EXISTS idx_certificates_recipient_email 
ON issued_certificates USING btree (recipient_email) 
WHERE recipient_email IS NOT NULL;

-- Índice composto para templates por usuário e pasta
CREATE INDEX IF NOT EXISTS idx_templates_user_folder_created 
ON certificate_templates USING btree (user_id, folder_id, created_at DESC);

-- Índice para templates ativos por usuário
CREATE INDEX IF NOT EXISTS idx_templates_user_active 
ON certificate_templates USING btree (user_id, is_active) 
WHERE is_active = true;

-- Índice para pastas por usuário
CREATE INDEX IF NOT EXISTS idx_folders_user_name 
ON folders USING btree (user_id, name);

-- Índice para consultas de templates por usuário
CREATE INDEX IF NOT EXISTS idx_templates_user_id 
ON certificate_templates USING btree (user_id);

-- ========================================
-- ESTATÍSTICAS ATUALIZADAS
-- ========================================

-- Atualizar estatísticas das tabelas para melhor planejamento de queries
ANALYZE issued_certificates;
ANALYZE certificate_templates;
ANALYZE folders;

-- ========================================
-- COMENTÁRIOS DE OTIMIZAÇÃO
-- ========================================

COMMENT ON INDEX idx_certificates_issued_at IS 'Otimiza ordenação por data de emissão no dashboard';
COMMENT ON INDEX idx_certificates_template_id_issued_at IS 'Otimiza joins entre certificados e templates';
COMMENT ON INDEX idx_certificates_number_unique IS 'Otimiza verificação de números únicos de certificado';
COMMENT ON INDEX idx_certificates_recipient_email IS 'Otimiza busca por email do destinatário';
COMMENT ON INDEX idx_templates_user_folder_created IS 'Otimiza listagem de templates por pasta';
COMMENT ON INDEX idx_templates_user_active IS 'Otimiza consultas de templates ativos';
COMMENT ON INDEX idx_folders_user_name IS 'Otimiza listagem de pastas por usuário';
COMMENT ON INDEX idx_templates_user_id IS 'Otimiza consultas de templates por usuário no dashboard';
