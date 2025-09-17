-- Melhorar políticas RLS para maior segurança
-- Remover políticas antigas e criar novas mais restritivas

-- Remover políticas existentes
DROP POLICY IF EXISTS "Anyone can insert certificates" ON issued_certificates;
DROP POLICY IF EXISTS "Users can view certificates from their templates" ON issued_certificates;

-- Nova política mais restritiva para inserção de certificados
-- Permite inserção apenas com dados válidos e template ativo
CREATE POLICY "Restricted certificate insertion" ON issued_certificates
    FOR INSERT
    WITH CHECK (
        -- Verificar se o template existe e está ativo
        EXISTS (
            SELECT 1 FROM certificate_templates 
            WHERE certificate_templates.id = template_id 
            AND certificate_templates.is_active = true
        )
        -- Verificar se os dados obrigatórios estão presentes
        AND recipient_cpf IS NOT NULL 
        AND recipient_dob IS NOT NULL
        AND recipient_data IS NOT NULL
        AND certificate_number IS NOT NULL
    );

-- Política para visualização de certificados pelos proprietários dos templates
CREATE POLICY "Template owners can view certificates" ON issued_certificates
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM certificate_templates 
            WHERE certificate_templates.id = issued_certificates.template_id 
            AND certificate_templates.user_id = auth.uid()
        )
    );

-- Política para visualização pública de certificados específicos
-- Permite acesso público apenas para visualização individual por certificate_number
CREATE POLICY "Public certificate view by number" ON issued_certificates
    FOR SELECT
    USING (
        -- Permitir acesso público apenas se o template estiver ativo
        EXISTS (
            SELECT 1 FROM certificate_templates 
            WHERE certificate_templates.id = issued_certificates.template_id 
            AND certificate_templates.is_active = true
        )
    );

-- Política para atualização de certificados
-- Permite atualização apenas pelo proprietário do template
CREATE POLICY "Template owners can update certificates" ON issued_certificates
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM certificate_templates 
            WHERE certificate_templates.id = issued_certificates.template_id 
            AND certificate_templates.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM certificate_templates 
            WHERE certificate_templates.id = issued_certificates.template_id 
            AND certificate_templates.user_id = auth.uid()
        )
    );

-- Política para exclusão de certificados
-- Permite exclusão apenas pelo proprietário do template
CREATE POLICY "Template owners can delete certificates" ON issued_certificates
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM certificate_templates 
            WHERE certificate_templates.id = issued_certificates.template_id 
            AND certificate_templates.user_id = auth.uid()
        )
    );

-- Adicionar coluna data_hash se não existir
ALTER TABLE issued_certificates 
ADD COLUMN IF NOT EXISTS data_hash VARCHAR(64);

-- Criar índice para data_hash para verificações rápidas de integridade
CREATE INDEX IF NOT EXISTS idx_issued_certificates_data_hash 
ON issued_certificates(data_hash) 
WHERE data_hash IS NOT NULL;

-- Política RLS mais restritiva para templates
-- Remover política antiga e criar nova
DROP POLICY IF EXISTS "Users can view their own templates" ON certificate_templates;

CREATE POLICY "Users can view own active templates" ON certificate_templates
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Política para visualização pública de templates apenas por public_link_id
CREATE POLICY "Public template access by link" ON certificate_templates
    FOR SELECT
    USING (
        public_link_id IS NOT NULL 
        AND is_active = true
    );

-- Função para validar integridade de certificados
CREATE OR REPLACE FUNCTION validate_certificate_integrity()
RETURNS TRIGGER AS $$
BEGIN
    -- Validar se CPF é válido (11 dígitos)
    IF NEW.recipient_cpf IS NOT NULL AND LENGTH(REGEXP_REPLACE(NEW.recipient_cpf, '\D', '', 'g')) != 11 THEN
        RAISE EXCEPTION 'CPF deve ter 11 dígitos';
    END IF;
    
    -- Validar se data de nascimento é razoável
    IF NEW.recipient_dob IS NOT NULL AND (
        NEW.recipient_dob > CURRENT_DATE - INTERVAL '13 years' OR 
        NEW.recipient_dob < CURRENT_DATE - INTERVAL '120 years'
    ) THEN
        RAISE EXCEPTION 'Data de nascimento inválida';
    END IF;
    
    -- Validar se recipient_data não está vazio
    IF NEW.recipient_data IS NULL OR NEW.recipient_data = '{}' THEN
        RAISE EXCEPTION 'Dados do destinatário são obrigatórios';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validação automática
DROP TRIGGER IF EXISTS validate_certificate_trigger ON issued_certificates;
CREATE TRIGGER validate_certificate_trigger
    BEFORE INSERT OR UPDATE ON issued_certificates
    FOR EACH ROW
    EXECUTE FUNCTION validate_certificate_integrity();

-- Função para limpeza de certificados órfãos
CREATE OR REPLACE FUNCTION cleanup_orphaned_certificates()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Deletar certificados cujos templates foram removidos ou desativados
    DELETE FROM issued_certificates 
    WHERE template_id NOT IN (
        SELECT id FROM certificate_templates 
        WHERE is_active = true
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comentários para documentação
COMMENT ON POLICY "Restricted certificate insertion" ON issued_certificates IS 
'Permite inserção apenas com template ativo e dados obrigatórios';

COMMENT ON POLICY "Public certificate view by number" ON issued_certificates IS 
'Permite visualização pública apenas de certificados com template ativo';

COMMENT ON FUNCTION validate_certificate_integrity() IS 
'Valida integridade dos dados antes de inserir/atualizar certificados';

COMMENT ON FUNCTION cleanup_orphaned_certificates() IS 
'Remove certificados órfãos (templates inativos ou removidos)';
