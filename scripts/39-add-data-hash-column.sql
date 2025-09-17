-- Adicionar coluna data_hash se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'issued_certificates' 
        AND column_name = 'data_hash'
    ) THEN
        ALTER TABLE issued_certificates ADD COLUMN data_hash TEXT;
        
        -- Criar índice para performance
        CREATE INDEX IF NOT EXISTS idx_issued_certificates_data_hash 
        ON issued_certificates(data_hash);
        
        -- Criar índice composto para busca eficiente
        CREATE INDEX IF NOT EXISTS idx_issued_certificates_lookup 
        ON issued_certificates(template_id, recipient_cpf, recipient_dob);
        
        COMMENT ON COLUMN issued_certificates.data_hash IS 'Hash SHA-256 dos dados para verificação de integridade';
    END IF;
END $$;
