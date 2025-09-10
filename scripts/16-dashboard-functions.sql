-- Adicionando função para buscar certificados recentes com paginação otimizada
-- Criando funções SQL otimizadas para o dashboard
-- Função para buscar estatísticas do dashboard em uma única query

CREATE OR REPLACE FUNCTION get_dashboard_stats(
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
  total_templates BIGINT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH user_certificates AS (
    SELECT ic.*
    FROM issued_certificates ic
    INNER JOIN certificate_templates ct ON ic.template_id = ct.id
    WHERE ct.user_id = p_user_id
  )
  SELECT 
    COUNT(*) FILTER (WHERE issued_at >= p_today) as today_count,
    COUNT(*) FILTER (WHERE issued_at >= p_yesterday AND issued_at < p_today) as yesterday_count,
    COUNT(*) FILTER (WHERE issued_at >= p_seven_days_ago) as last7days_count,
    COUNT(*) as total_certificates,
    (SELECT COUNT(*) FROM certificate_templates WHERE user_id = p_user_id) as total_templates
  FROM user_certificates;
END;
$$;

-- Função para dados do gráfico
CREATE OR REPLACE FUNCTION get_chart_data(
  p_user_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  date DATE,
  count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(ic.issued_at) as date,
    COUNT(*) as count
  FROM issued_certificates ic
  INNER JOIN certificate_templates ct ON ic.template_id = ct.id
  WHERE ct.user_id = p_user_id
    AND ic.issued_at >= p_start_date
    AND ic.issued_at <= p_end_date
  GROUP BY DATE(ic.issued_at)
  ORDER BY date;
END;
$$;

-- Nova função para buscar certificados recentes com dados do template em uma query
CREATE OR REPLACE FUNCTION get_recent_certificates(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  certificate_id UUID,
  certificate_number VARCHAR(255),
  recipient_email VARCHAR(255),
  recipient_name TEXT,
  template_title VARCHAR(255),
  issued_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ic.id as certificate_id,
    ic.certificate_number,
    ic.recipient_email,
    ic.recipient_data->>'name' as recipient_name,
    ct.title as template_title,
    ic.issued_at
  FROM issued_certificates ic
  INNER JOIN certificate_templates ct ON ic.template_id = ct.id
  WHERE ct.user_id = p_user_id
  ORDER BY ic.issued_at DESC
  LIMIT p_limit;
END;
$$;

-- Função para buscar templates com contagem de certificados
CREATE OR REPLACE FUNCTION get_templates_with_counts(
  p_user_id UUID,
  p_folder_id UUID DEFAULT NULL
)
RETURNS TABLE (
  template_id UUID,
  title VARCHAR(255),
  thumbnail TEXT,
  folder_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  certificates_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.id as template_id,
    ct.title,
    ct.thumbnail,
    ct.folder_id,
    ct.created_at,
    COUNT(ic.id) as certificates_count
  FROM certificate_templates ct
  LEFT JOIN issued_certificates ic ON ct.id = ic.template_id
  WHERE ct.user_id = p_user_id
    AND (p_folder_id IS NULL OR ct.folder_id = p_folder_id)
  GROUP BY ct.id, ct.title, ct.thumbnail, ct.folder_id, ct.created_at
  ORDER BY ct.created_at DESC;
END;
$$;

-- Conceder permissões para as funções
GRANT EXECUTE ON FUNCTION get_dashboard_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_chart_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_certificates TO authenticated;
GRANT EXECUTE ON FUNCTION get_templates_with_counts TO authenticated;
