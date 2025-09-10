-- Removendo subqueries dos índices e criando índices compatíveis com PostgreSQL
-- Adicionando índices estratégicos para otimizar queries do dashboard
-- Índices compostos para otimizar as queries mais frequentes do dashboard

-- Índice composto para otimizar queries de certificados por template e data
CREATE INDEX IF NOT EXISTS idx_issued_certificates_template_issued_at ON issued_certificates(template_id, issued_at DESC);

-- Índice para otimizar contagens por data (usado no dashboard)
CREATE INDEX IF NOT EXISTS idx_issued_certificates_issued_at_desc ON issued_certificates(issued_at DESC);

-- Índice para otimizar busca por templates do usuário
CREATE INDEX IF NOT EXISTS idx_certificate_templates_user_created ON certificate_templates(user_id, created_at DESC);

-- Índice para otimizar queries de templates por pasta
CREATE INDEX IF NOT EXISTS idx_certificate_templates_user_folder ON certificate_templates(user_id, folder_id);

-- Índice para otimizar busca de certificados por email
CREATE INDEX IF NOT EXISTS idx_issued_certificates_email_template ON issued_certificates(recipient_email, template_id);

-- Índice para otimizar joins entre issued_certificates e certificate_templates
CREATE INDEX IF NOT EXISTS idx_issued_certificates_template_date ON issued_certificates(template_id, issued_at DESC);

-- Índice para otimizar busca por número de certificado
CREATE INDEX IF NOT EXISTS idx_issued_certificates_number_unique ON issued_certificates(certificate_number) WHERE certificate_number IS NOT NULL;

-- Índice para otimizar queries de pastas por usuário
CREATE INDEX IF NOT EXISTS idx_folders_user_name ON folders(user_id, name);

-- Índice GIN para busca em dados JSON do recipient_data
CREATE INDEX IF NOT EXISTS idx_issued_certificates_recipient_gin ON issued_certificates USING gin(recipient_data);

-- Índice para otimizar contagem de certificados por template
CREATE INDEX IF NOT EXISTS idx_issued_certificates_template_count ON issued_certificates(template_id) INCLUDE (issued_at);
