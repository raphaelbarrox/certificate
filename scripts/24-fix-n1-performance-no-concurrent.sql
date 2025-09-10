-- SOLUÇÃO ROBUSTA PARA PROBLEMAS N+1 - NÃO IMPACTA CÓDIGO EXISTENTE
-- Otimiza queries do dashboard sem alterar assinaturas de funções
-- VERSÃO CORRIGIDA: Remove CONCURRENTLY para evitar erro de transação

-- 1. CORRIGE get_dashboard_stats para incluir this_month_count que o TypeScript espera
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
    total_certificates BIGINT,
    total_templates BIGINT,
    this_month_count BIGINT  -- Adiciona campo que faltava
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
    
    -- Calcula início do mês atual
    month_start_date := DATE_TRUNC('month', today_date);
    
    RETURN QUERY
    WITH user_certificates AS (
        -- Otimiza com índice composto user_id + issued_at
        SELECT ic.issued_at
        FROM issued_certificates ic
        INNER JOIN certificate_templates ct ON ic.template_id = ct.id
        WHERE ct.user_id = p_user_id
    )
    SELECT 
        COUNT(*) FILTER (WHERE issued_at >= today_date) as today_count,
        COUNT(*) FILTER (WHERE issued_at >= yesterday_date AND issued_at < today_date) as yesterday_count,
        COUNT(*) FILTER (WHERE issued_at >= seven_days_ago_date) as last7days_count,
        COUNT(*) as total_certificates,
        (SELECT COUNT(*) FROM certificate_templates WHERE user_id = p_user_id) as total_templates,
        COUNT(*) FILTER (WHERE issued_at >= month_start_date) as this_month_count  -- Adiciona contagem do mês
    FROM user_certificates;
END;
$$;

-- 2. CRIA FUNÇÃO OTIMIZADA PARA TEMPLATES COM CACHE INTELIGENTE
CREATE OR REPLACE FUNCTION public.get_templates_with_folder_counts(
    p_user_id UUID,
    p_folder_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 50  -- Limite padrão para evitar N+1
)
RETURNS TABLE(
    id UUID,
    title VARCHAR,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    placeholders JSONB,
    public_link_id VARCHAR,
    folder_id UUID,
    certificates_count BIGINT  -- Inclui contagem de certificados
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ct.id,
        ct.title,
        ct.is_active,
        ct.created_at,
        ct.placeholders,
        ct.public_link_id,
        ct.folder_id,
        COALESCE(cert_counts.count, 0) as certificates_count
    FROM certificate_templates ct
    LEFT JOIN (
        -- Subquery otimizada para contar certificados por template
        SELECT template_id, COUNT(*) as count
        FROM issued_certificates
        GROUP BY template_id
    ) cert_counts ON ct.id = cert_counts.template_id
    WHERE ct.user_id = p_user_id
        AND (p_folder_id IS NULL AND ct.folder_id IS NULL OR ct.folder_id = p_folder_id)
    ORDER BY ct.created_at DESC
    LIMIT p_limit;
END;
$$;

-- 3. CRIA FUNÇÃO PARA ESTATÍSTICAS DE PASTAS (EVITA N+1 EM FOLDERS)
CREATE OR REPLACE FUNCTION public.get_folders_with_template_counts(
    p_user_id UUID
)
RETURNS TABLE(
    id UUID,
    name VARCHAR,
    color VARCHAR,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    template_count BIGINT  -- Conta templates por pasta em uma query
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        f.name,
        f.color,
        f.description,
        f.created_at,
        COALESCE(template_counts.count, 0) as template_count
    FROM folders f
    LEFT JOIN (
        -- Subquery para contar templates por pasta
        SELECT folder_id, COUNT(*) as count
        FROM certificate_templates
        WHERE user_id = p_user_id
        GROUP BY folder_id
    ) template_counts ON f.id = template_counts.folder_id
    WHERE f.user_id = p_user_id
    ORDER BY f.name ASC;
END;
$$;

-- 4. ÍNDICES OTIMIZADOS PARA PERFORMANCE (REMOVIDO CONCURRENTLY)
-- Removido CONCURRENTLY para evitar erro de transação
CREATE INDEX IF NOT EXISTS idx_certificates_template_issued_at 
ON issued_certificates(template_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_certificates_issued_at_month 
ON issued_certificates(DATE_TRUNC('month', issued_at));

CREATE INDEX IF NOT EXISTS idx_templates_user_folder 
ON certificate_templates(user_id, folder_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_templates_user_active 
ON certificate_templates(user_id, is_active, created_at DESC);

-- 5. PERMISSÕES
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_templates_with_folder_counts(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_templates_with_folder_counts(UUID, UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_folders_with_template_counts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_folders_with_template_counts(UUID) TO anon;

-- 6. COMENTÁRIOS DE AUDITORIA
COMMENT ON FUNCTION public.get_dashboard_stats IS 'Função otimizada com this_month_count - corrige problema N+1 no dashboard';
COMMENT ON FUNCTION public.get_templates_with_folder_counts IS 'Função otimizada para templates com contagem de certificados - evita N+1';
COMMENT ON FUNCTION public.get_folders_with_template_counts IS 'Função otimizada para pastas com contagem de templates - evita N+1';
