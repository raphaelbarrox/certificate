-- Adicionar coluna updated_at para rastrear atualizações de certificados
ALTER TABLE issued_certificates 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Criar índice para melhorar performance de consultas por data de atualização
CREATE INDEX IF NOT EXISTS idx_issued_certificates_updated_at 
ON issued_certificates(updated_at);

-- Atualizar registros existentes com a data de criação
UPDATE issued_certificates 
SET updated_at = issued_at 
WHERE updated_at IS NULL;
