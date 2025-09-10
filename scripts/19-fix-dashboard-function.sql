-- Script para corrigir a função get_dashboard_stats duplicada
-- Remove a função existente e recria com a assinatura correta

-- Remove todas as versões da função get_dashboard_stats
DROP FUNCTION IF EXISTS public.get_dashboard_stats;
DROP FUNCTION IF EXISTS public.get_dashboard_stats(date, date, uuid, date);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(timestamp, timestamp, uuid, timestamp);

-- Recria a função com a assinatura correta
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
    p_seven_days_ago date,
    p_today date,
    p_user_id uuid,
    p_yesterday date
)
RETURNS TABLE(
    total_certificates bigint,
    total_templates bigint,
    certificates_this_week bigint,
    certificates_yesterday bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        -- Total de certificados do usuário
        (SELECT COUNT(*) FROM issued_certificates ic 
         JOIN certificate_templates ct ON ic.template_id = ct.id 
         WHERE ct.user_id = p_user_id)::bigint as total_certificates,
        
        -- Total de templates do usuário
        (SELECT COUNT(*) FROM certificate_templates 
         WHERE user_id = p_user_id)::bigint as total_templates,
        
        -- Certificados emitidos nos últimos 7 dias
        (SELECT COUNT(*) FROM issued_certificates ic 
         JOIN certificate_templates ct ON ic.template_id = ct.id 
         WHERE ct.user_id = p_user_id 
         AND ic.issued_at >= p_seven_days_ago 
         AND ic.issued_at <= p_today)::bigint as certificates_this_week,
        
        -- Certificados emitidos ontem
        (SELECT COUNT(*) FROM issued_certificates ic 
         JOIN certificate_templates ct ON ic.template_id = ct.id 
         WHERE ct.user_id = p_user_id 
         AND DATE(ic.issued_at) = p_yesterday)::bigint as certificates_yesterday;
END;
$$;

-- Concede permissões necessárias
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(date, date, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(date, date, uuid, date) TO anon;
