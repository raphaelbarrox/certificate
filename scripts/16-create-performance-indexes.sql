-- Criando índices para otimizar performance das queries principais

-- Índices para certificate_templates (queries mais frequentes)
CREATE INDEX IF NOT EXISTS idx_certificate_templates_user_id 
ON certificate_templates(user_id);

CREATE INDEX IF NOT EXISTS idx_certificate_templates_folder_id 
ON certificate_templates(folder_id);

-- Índice composto para queries que filtram por user_id e folder_id juntos
CREATE INDEX IF NOT EXISTS idx_certificate_templates_user_folder 
ON certificate_templates(user_id, folder_id);

-- Índice para ordenação por created_at (usado em paginação)
CREATE INDEX IF NOT EXISTS idx_certificate_templates_created_at 
ON certificate_templates(created_at DESC);

-- Índice composto para queries completas com ordenação
CREATE INDEX IF NOT EXISTS idx_certificate_templates_user_folder_created 
ON certificate_templates(user_id, folder_id, created_at DESC);

-- Índices para folders
CREATE INDEX IF NOT EXISTS idx_folders_user_id 
ON folders(user_id);

CREATE INDEX IF NOT EXISTS idx_folders_user_created 
ON folders(user_id, created_at DESC);

-- Índices para template_folders (fallback table)
CREATE INDEX IF NOT EXISTS idx_template_folders_user_id 
ON template_folders(user_id);

CREATE INDEX IF NOT EXISTS idx_template_folders_user_created 
ON template_folders(user_id, created_at DESC);

-- Índices para issued_certificates
CREATE INDEX IF NOT EXISTS idx_issued_certificates_template_id 
ON issued_certificates(template_id);

CREATE INDEX IF NOT EXISTS idx_issued_certificates_email 
ON issued_certificates(recipient_email);

-- Índice para busca por número do certificado
CREATE INDEX IF NOT EXISTS idx_issued_certificates_number 
ON issued_certificates(certificate_number);

-- Índices para template_form_fields
CREATE INDEX IF NOT EXISTS idx_template_form_fields_template_id 
ON template_form_fields(template_id);

CREATE INDEX IF NOT EXISTS idx_template_form_fields_template_order 
ON template_form_fields(template_id, field_order);

-- Índices para user_tags
CREATE INDEX IF NOT EXISTS idx_user_tags_user_id 
ON user_tags(user_id);

CREATE INDEX IF NOT EXISTS idx_user_tags_user_type 
ON user_tags(user_id, tag_type);

-- Comentários sobre os índices criados
COMMENT ON INDEX idx_certificate_templates_user_folder_created IS 'Índice composto para queries principais de templates com ordenação';
COMMENT ON INDEX idx_folders_user_created IS 'Índice para listagem de folders por usuário ordenado por data';
