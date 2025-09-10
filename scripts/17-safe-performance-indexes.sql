-- Script de otimização de performance - Índices seguros
-- Este script adiciona apenas índices que melhoram a performance sem conflitar com código existente

-- Verificar se os índices já existem antes de criar
DO $$
BEGIN
    -- Índice para user_id em certificate_templates (consultas frequentes por usuário)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_certificate_templates_user_id') THEN
        CREATE INDEX idx_certificate_templates_user_id ON certificate_templates(user_id);
    END IF;

    -- Índice composto para issued_certificates (user_id via template + data de emissão)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_issued_certificates_template_issued') THEN
        CREATE INDEX idx_issued_certificates_template_issued ON issued_certificates(template_id, issued_at DESC);
    END IF;

    -- Índice para certificate_number (busca única de certificados)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_issued_certificates_number') THEN
        CREATE INDEX idx_issued_certificates_number ON issued_certificates(certificate_number);
    END IF;

    -- Índice para email do destinatário (busca por certificados de uma pessoa)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_issued_certificates_email') THEN
        CREATE INDEX idx_issued_certificates_email ON issued_certificates(recipient_email);
    END IF;

    -- Índice para folder_id em templates (organização por pastas)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_certificate_templates_folder') THEN
        CREATE INDEX idx_certificate_templates_folder ON certificate_templates(folder_id) WHERE folder_id IS NOT NULL;
    END IF;

    -- Índice para user_id em folders
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_folders_user_id') THEN
        CREATE INDEX idx_folders_user_id ON folders(user_id);
    END IF;

    -- Índice composto para busca de certificados por data (otimiza dashboard)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_issued_certificates_date_range') THEN
        CREATE INDEX idx_issued_certificates_date_range ON issued_certificates(issued_at DESC, template_id);
    END IF;

END $$;

-- Comentários sobre os benefícios de cada índice:
-- 1. idx_certificate_templates_user_id: Acelera listagem de templates do usuário
-- 2. idx_issued_certificates_template_issued: Otimiza joins entre templates e certificados + ordenação por data
-- 3. idx_issued_certificates_number: Busca rápida de certificado específico
-- 4. idx_issued_certificates_email: Busca certificados por destinatário
-- 5. idx_certificate_templates_folder: Organização por pastas (apenas quando folder_id não é null)
-- 6. idx_folders_user_id: Listagem de pastas do usuário
-- 7. idx_issued_certificates_date_range: Otimiza consultas do dashboard por período
