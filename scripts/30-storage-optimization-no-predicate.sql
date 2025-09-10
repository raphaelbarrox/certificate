-- Função para monitorar performance de storage e cache
CREATE OR REPLACE FUNCTION get_storage_performance_stats()
RETURNS TABLE (
  metric_name TEXT,
  metric_value NUMERIC,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'total_certificates'::TEXT,
    COUNT(*)::NUMERIC,
    'Total de certificados emitidos'::TEXT
  FROM issued_certificates
  
  UNION ALL
  
  SELECT 
    'certificates_with_pdf'::TEXT,
    COUNT(*)::NUMERIC,
    'Certificados com PDF gerado'::TEXT
  FROM issued_certificates 
  WHERE pdf_url IS NOT NULL
  
  UNION ALL
  
  SELECT 
    'avg_generation_time_estimate'::TEXT,
    EXTRACT(EPOCH FROM (MAX(issued_at) - MIN(issued_at))) / NULLIF(COUNT(*), 0)::NUMERIC,
    'Tempo médio estimado entre gerações (segundos)'::TEXT
  FROM issued_certificates
  WHERE issued_at >= CURRENT_DATE - INTERVAL '1 day'
  
  UNION ALL
  
  SELECT 
    'certificates_last_24h'::TEXT,
    COUNT(*)::NUMERIC,
    'Certificados geradas nas últimas 24h'::TEXT
  FROM issued_certificates
  WHERE issued_at >= CURRENT_DATE - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Removido completamente o índice com predicado WHERE que causava erro
-- Índice simples para otimizar consultas de performance
CREATE INDEX IF NOT EXISTS idx_issued_certificates_performance_simple 
ON issued_certificates (issued_at DESC, pdf_url);

-- Índice básico sem predicado para evitar erros de função IMMUTABLE
CREATE INDEX IF NOT EXISTS idx_issued_certificates_date_only 
ON issued_certificates (issued_at DESC);

-- Comentários para documentação
COMMENT ON FUNCTION get_storage_performance_stats() IS 'Monitora métricas de performance do sistema de storage e geração de certificados';
