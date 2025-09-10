-- Corrige a função get_dashboard_stats para incluir this_month_count
DROP FUNCTION IF EXISTS public.get_dashboard_stats CASCADE;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
    p_user_id UUID,
    p_today TEXT,
    p_yesterday TEXT,
    p_seven_days_ago TEXT
)
RETURNS TABLE(
    today_count BIGINT,
    yesterday_count BIGINT,
    last7days_count BIGINT,
    this_month_count BIGINT,
    total_certificates BIGINT,
    total_templates BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    today_date TIMESTAMP WITH TIME ZONE;
    yesterday_date TIMESTAMP WITH TIME ZONE;
    seven_days_ago_date TIMESTAMP WITH TIME ZONE;
    month_start_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Converte strings ISO para timestamps
    today_date := p_today::TIMESTAMP WITH TIME ZONE;
    yesterday_date := p_yesterday::TIMESTAMP WITH TIME ZONE;
    seven_days_ago_date := p_seven_days_ago::TIMESTAMP WITH TIME ZONE;
    
    -- Calcula o início do mês atual
    month_start_date := DATE_TRUNC('month', today_date);
    
    RETURN QUERY
    WITH user_certificates AS (
        SELECT ic.*
        FROM issued_certificates ic
        INNER JOIN certificate_templates ct ON ic.template_id = ct.id
        WHERE ct.user_id = p_user_id
    )
    SELECT 
        COUNT(*) FILTER (WHERE issued_at >= today_date) as today_count,
        COUNT(*) FILTER (WHERE issued_at >= yesterday_date AND issued_at < today_date) as yesterday_count,
        COUNT(*) FILTER (WHERE issued_at >= seven_days_ago_date) as last7days_count,
        -- Adiciona contagem do mês atual
        COUNT(*) FILTER (WHERE issued_at >= month_start_date) as this_month_count,
        COUNT(*) as total_certificates,
        (SELECT COUNT(*) FROM certificate_templates WHERE user_id = p_user_id) as total_templates
    FROM user_certificates;
END;
$$;

-- Concede permissões necessárias
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, TEXT, TEXT, TEXT) TO anon;

COMMENT ON FUNCTION public.get_dashboard_stats IS 'Função otimizada para estatísticas do dashboard - inclui contagem do mês atual';
