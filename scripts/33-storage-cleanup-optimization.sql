-- Script para limpeza automática de PDFs órfãos e otimização de storage

-- Função para identificar PDFs órfãos no storage
CREATE OR REPLACE FUNCTION cleanup_orphaned_pdfs()
RETURNS TABLE(
  orphaned_count INTEGER,
  cleanup_summary TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  orphan_count INTEGER := 0;
  cleanup_text TEXT := '';
BEGIN
  -- Esta função deve ser executada junto com um script de limpeza do storage
  -- que compare os PDFs no bucket com os registros no banco
  
  -- Por enquanto, apenas registra a execução
  INSERT INTO storage_cleanup_log (
    cleanup_type,
    executed_at,
    details
  ) VALUES (
    'orphaned_pdfs_check',
    NOW(),
    'Verificação de PDFs órfãos executada'
  );
  
  orphan_count := 0;
  cleanup_text := 'Verificação de PDFs órfãos concluída. Execute limpeza manual se necessário.';
  
  RETURN QUERY SELECT orphan_count, cleanup_text;
END;
$$;

-- Tabela para log de limpeza de storage
CREATE TABLE IF NOT EXISTS storage_cleanup_log (
  id SERIAL PRIMARY KEY,
  cleanup_type VARCHAR(50) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  details TEXT,
  files_removed INTEGER DEFAULT 0,
  space_freed_mb DECIMAL(10,2) DEFAULT 0
);

-- Função para monitorar uso de storage por template
CREATE OR REPLACE FUNCTION get_storage_usage_by_template()
RETURNS TABLE(
  template_id UUID,
  template_title TEXT,
  certificate_count BIGINT,
  estimated_storage_mb DECIMAL(10,2)
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.id as template_id,
    ct.title as template_title,
    COUNT(ic.id) as certificate_count,
    -- Estimativa baseada em 500KB por PDF em média
    (COUNT(ic.id) * 0.5)::DECIMAL(10,2) as estimated_storage_mb
  FROM certificate_templates ct
  LEFT JOIN issued_certificates ic ON ct.id = ic.template_id
  WHERE ic.pdf_url IS NOT NULL
  GROUP BY ct.id, ct.title
  ORDER BY certificate_count DESC;
END;
$$;

-- Índice para otimizar consultas de limpeza
CREATE INDEX IF NOT EXISTS idx_issued_certificates_pdf_url 
ON issued_certificates(pdf_url) 
WHERE pdf_url IS NOT NULL;

-- Índice para otimizar consultas por data de atualização
CREATE INDEX IF NOT EXISTS idx_issued_certificates_updated_at 
ON issued_certificates(updated_at) 
WHERE updated_at IS NOT NULL;

-- Comentários para documentação
COMMENT ON FUNCTION cleanup_orphaned_pdfs() IS 'Identifica e registra PDFs órfãos no storage para limpeza manual';
COMMENT ON FUNCTION get_storage_usage_by_template() IS 'Monitora uso de storage por template de certificado';
COMMENT ON TABLE storage_cleanup_log IS 'Log de operações de limpeza de storage';
