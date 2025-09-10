-- Criando funções SQL otimizadas para cache consolidado

-- Função para obter estatísticas consolidadas com cache otimizado
CREATE OR REPLACE FUNCTION get_dashboard_stats_cached(
  p_user_id UUID,
  p_today TIMESTAMP WITH TIME ZONE,
  p_yesterday TIMESTAMP WITH TIME ZONE,
  p_seven_days_ago TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  today_count BIGINT,
  yesterday_count BIGINT,
  last7days_count BIGINT,
  total_certificates BIGINT,
  total_templates BIGINT,
  this_month_count BIGINT
) 
LANGUAGE plpgsql
STABLE -- Marca como STABLE para permitir cache mais agressivo
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE DATE(ic.issued_at) = DATE(p_today)) as today_count,
      COUNT(*) FILTER (WHERE DATE(ic.issued_at) = DATE(p_yesterday)) as yesterday_count,
      COUNT(*) FILTER (WHERE ic.issued_at >= p_seven_days_ago) as last7days_count,
      COUNT(*) as total_certificates,
      COUNT(*) FILTER (WHERE DATE_TRUNC('month', ic.issued_at) = DATE_TRUNC('month', p_today)) as this_month_count
    FROM issued_certificates ic
    INNER JOIN certificate_templates ct ON ic.template_id = ct.id
    WHERE ct.user_id = p_user_id
  ),
  template_stats AS (
    SELECT COUNT(*) as total_templates
    FROM certificate_templates
    WHERE user_id = p_user_id
  )
  SELECT 
    s.today_count,
    s.yesterday_count,
    s.last7days_count,
    s.total_certificates,
    ts.total_templates,
    s.this_month_count
  FROM stats s
  CROSS JOIN template_stats ts;
END;
$$;

-- Função para busca otimizada de certificados com cache
CREATE OR REPLACE FUNCTION search_certificates_cached(
  p_user_id UUID,
  p_search_term TEXT DEFAULT NULL,
  p_template_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  certificate_number TEXT,
  recipient_data JSONB,
  recipient_email TEXT,
  issued_at TIMESTAMP WITH TIME ZONE,
  template_id UUID,
  template_title TEXT,
  total_count BIGINT
) 
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  search_query TEXT;
BEGIN
  -- Construir query dinâmica baseada nos parâmetros
  search_query := '
    WITH filtered_certificates AS (
      SELECT 
        ic.id,
        ic.certificate_number,
        ic.recipient_data,
        ic.recipient_email,
        ic.issued_at,
        ic.template_id,
        ct.title as template_title,
        COUNT(*) OVER() as total_count
      FROM issued_certificates ic
      INNER JOIN certificate_templates ct ON ic.template_id = ct.id
      WHERE ct.user_id = $1';

  -- Adicionar filtro por template se especificado
  IF p_template_id IS NOT NULL THEN
    search_query := search_query || ' AND ic.template_id = $4';
  END IF;

  -- Adicionar filtro de busca se especificado
  IF p_search_term IS NOT NULL AND LENGTH(TRIM(p_search_term)) > 0 THEN
    search_query := search_query || ' AND (
      ic.certificate_number ILIKE $5 OR
      ic.recipient_email ILIKE $5 OR
      ic.recipient_data->>''name'' ILIKE $5 OR
      ic.recipient_data->>''nome_completo'' ILIKE $5
    )';
  END IF;

  search_query := search_query || '
      ORDER BY ic.issued_at DESC
      LIMIT $2 OFFSET $3
    )
    SELECT * FROM filtered_certificates';

  -- Executar query dinâmica
  IF p_template_id IS NOT NULL AND p_search_term IS NOT NULL THEN
    RETURN QUERY EXECUTE search_query 
    USING p_user_id, p_limit, p_offset, p_template_id, '%' || p_search_term || '%';
  ELSIF p_template_id IS NOT NULL THEN
    RETURN QUERY EXECUTE search_query 
    USING p_user_id, p_limit, p_offset, p_template_id;
  ELSIF p_search_term IS NOT NULL THEN
    RETURN QUERY EXECUTE search_query 
    USING p_user_id, p_limit, p_offset, NULL, '%' || p_search_term || '%';
  ELSE
    RETURN QUERY EXECUTE search_query 
    USING p_user_id, p_limit, p_offset;
  END IF;
END;
$$;

-- Índices otimizados para cache (complementando os índices anteriores)
CREATE INDEX IF NOT EXISTS idx_certificates_cache_lookup 
ON issued_certificates (template_id, issued_at DESC, recipient_email);

CREATE INDEX IF NOT EXISTS idx_templates_cache_lookup 
ON certificate_templates (user_id, folder_id, created_at DESC, is_active);

-- Comentários para documentação
COMMENT ON FUNCTION get_dashboard_stats_cached IS 'Função otimizada para cache de estatísticas do dashboard';
COMMENT ON FUNCTION search_certificates_cached IS 'Função otimizada para busca de certificados com cache';
