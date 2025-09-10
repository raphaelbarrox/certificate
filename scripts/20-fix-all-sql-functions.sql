-- Script definitivo para corrigir todas as funções SQL do dashboard
-- Remove todas as versões conflitantes e recria com assinaturas corretas

-- 1. Remove todas as versões existentes das funções
DROP FUNCTION IF EXISTS public.get_dashboard_stats CASCADE;
DROP FUNCTION IF EXISTS public.get_chart_data CASCADE;
DROP FUNCTION IF EXISTS public.get_recent_certificates CASCADE;
DROP FUNCTION IF EXISTS public.get_templates_with_counts CASCADE;

-- 2. Recria get_dashboard_stats com a assinatura EXATA que o TypeScript espera
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
BEGIN
    -- Converte strings ISO para timestamps
    today_date := p_today::TIMESTAMP WITH TIME ZONE;
    yesterday_date := p_yesterday::TIMESTAMP WITH TIME ZONE;
    seven_days_ago_date := p_seven_days_ago::TIMESTAMP WITH TIME ZONE;
    
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
        COUNT(*) as total_certificates,
        (SELECT COUNT(*) FROM certificate_templates WHERE user_id = p_user_id) as total_templates
    FROM user_certificates;
END;
$$;

-- 3. Recria get_chart_data com a assinatura EXATA que o TypeScript espera
CREATE OR REPLACE FUNCTION public.get_chart_data(
    p_user_id UUID,
    p_start_date TEXT,
    p_end_date TEXT
)
RETURNS TABLE(
    date DATE,
    count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    start_date TIMESTAMP WITH TIME ZONE;
    end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Converte strings ISO para timestamps
    start_date := p_start_date::TIMESTAMP WITH TIME ZONE;
    end_date := p_end_date::TIMESTAMP WITH TIME ZONE;
    
    RETURN QUERY
    SELECT 
        DATE(ic.issued_at) as date,
        COUNT(*) as count
    FROM issued_certificates ic
    INNER JOIN certificate_templates ct ON ic.template_id = ct.id
    WHERE ct.user_id = p_user_id
        AND ic.issued_at >= start_date
        AND ic.issued_at <= end_date
    GROUP BY DATE(ic.issued_at)
    ORDER BY date;
END;
$$;

-- 4. Concede permissões necessárias
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_chart_data(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chart_data(UUID, TEXT, TEXT) TO anon;

-- 5. Comentários para auditoria
COMMENT ON FUNCTION public.get_dashboard_stats IS 'Função otimizada para estatísticas do dashboard - corrigida para compatibilidade TypeScript';
COMMENT ON FUNCTION public.get_chart_data IS 'Função otimizada para dados do gráfico - corrigida para compatibilidade TypeScript';
