-- Script específico para otimizar performance de certificados
-- Focado em reduzir uso de recursos Supabase e melhorar velocidade

-- Índice otimizado para busca em recipient_data (JSON)
CREATE INDEX IF NOT EXISTS idx_certificates_recipient_data_gin 
ON issued_certificates USING gin(recipient_data jsonb_path_ops);

-- Índice para otimizar contagem rápida de certificados por usuário
CREATE INDEX IF NOT EXISTS idx_certificates_user_count 
ON issued_certificates(template_id) 
INCLUDE (issued_at, recipient_email);

-- Índice para otimizar queries de paginação
CREATE INDEX IF NOT EXISTS idx_certificates_pagination 
ON issued_certificates(template_id, issued_at DESC, id);

-- Função otimizada para busca rápida de certificados
CREATE OR REPLACE FUNCTION get_certificates_optimized(
  p_user_id UUID,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 10,
  p_search_term TEXT DEFAULT NULL,
  p_template_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  certificate_number TEXT,
  recipient_data JSONB,
  recipient_email TEXT,
  issued_at TIMESTAMPTZ,
  template_title TEXT,
  total_count BIGINT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  offset_val INTEGER;
BEGIN
  offset_val := (p_page - 1) * p_page_size;
  
  RETURN QUERY
  WITH filtered_certificates AS (
    SELECT 
      ic.id,
      ic.certificate_number,
      ic.recipient_data,
      ic.recipient_email,
      ic.issued_at,
      ct.title as template_title,
      COUNT(*) OVER() as total_count
    FROM issued_certificates ic
    INNER JOIN certificate_templates ct ON ic.template_id = ct.id
    WHERE ct.user_id = p_user_id
      AND (p_template_id IS NULL OR ic.template_id = p_template_id)
      AND (
        p_search_term IS NULL OR
        ic.certificate_number ILIKE '%' || p_search_term || '%' OR
        ic.recipient_email ILIKE '%' || p_search_term || '%' OR
        ic.recipient_data->>'name' ILIKE '%' || p_search_term || '%' OR
        ic.recipient_data->>'nome_completo' ILIKE '%' || p_search_term || '%'
      )
    ORDER BY ic.issued_at DESC
    LIMIT p_page_size OFFSET offset_val
  )
  SELECT * FROM filtered_certificates;
END;
$$;

-- Atualizar estatísticas para melhor planejamento de queries
ANALYZE issued_certificates;
ANALYZE certificate_templates;
