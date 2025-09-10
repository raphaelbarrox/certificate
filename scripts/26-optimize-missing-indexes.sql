-- SOLUÇÃO ROBUSTA PARA ÍNDICES FALTANTES/INADEQUADOS
-- Otimiza buscas por email, filtros por data, buscas JSON e paginação
-- NÃO IMPACTA CÓDIGO EXISTENTE - apenas melhora performance

-- ========================================
-- 1. ÍNDICES PARA BUSCA POR EMAIL
-- ========================================

-- Índice otimizado para buscas case-insensitive em recipient_email
-- Suporta tanto ILIKE quanto = (igualdade exata)
CREATE INDEX IF NOT EXISTS idx_certificates_recipient_email_lower 
ON issued_certificates USING btree (LOWER(recipient_email))
WHERE recipient_email IS NOT NULL;

-- Índice para buscas exatas em recipient_email (mais rápido que LOWER)
CREATE INDEX IF NOT EXISTS idx_certificates_recipient_email_exact 
ON issued_certificates USING btree (recipient_email)
WHERE recipient_email IS NOT NULL;

-- ========================================
-- 2. ÍNDICES COMPOSTOS PARA FILTROS POR DATA
-- ========================================

-- Índice composto para joins com templates + ordenação por data
-- Otimiza: WHERE template_id = X ORDER BY issued_at DESC
CREATE INDEX IF NOT EXISTS idx_certificates_template_issued_desc 
ON issued_certificates USING btree (template_id, issued_at DESC);

-- Índice para filtros de usuário + data (via join com templates)
-- Otimiza queries do dashboard que filtram por user_id via template
CREATE INDEX IF NOT EXISTS idx_templates_user_certificates_join 
ON certificate_templates USING btree (user_id, id);

-- Índice para estatísticas por período
-- Otimiza: COUNT(*) FILTER (WHERE issued_at >= date)
CREATE INDEX IF NOT EXISTS idx_certificates_issued_at_stats 
ON issued_certificates USING btree (issued_at)
WHERE issued_at IS NOT NULL;

-- ========================================
-- 3. ÍNDICES GIN PARA BUSCAS EM JSON
-- ========================================

-- Índice GIN otimizado para buscas em campos específicos do recipient_data
-- Suporta: recipient_data->>'name', recipient_data->>'cpf', etc.
CREATE INDEX IF NOT EXISTS idx_certificates_recipient_data_gin_ops 
ON issued_certificates USING gin (recipient_data jsonb_ops);

-- Índice GIN para path operations (mais eficiente para buscas específicas)
-- Suporta: recipient_data @> '{"name": "valor"}'
CREATE INDEX IF NOT EXISTS idx_certificates_recipient_data_gin_path 
ON issued_certificates USING gin (recipient_data jsonb_path_ops);

-- Índices funcionais para campos JSON mais buscados
-- Otimiza: WHERE recipient_data->>'name' ILIKE '%termo%'
CREATE INDEX IF NOT EXISTS idx_certificates_recipient_name_lower 
ON issued_certificates USING btree (LOWER(recipient_data->>'name'))
WHERE recipient_data->>'name' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_certificates_recipient_cpf 
ON issued_certificates USING btree ((recipient_data->>'cpf'))
WHERE recipient_data->>'cpf' IS NOT NULL;

-- ========================================
-- 4. ÍNDICES PARA PAGINAÇÃO OTIMIZADA
-- ========================================

-- Índice composto para cursor-based pagination
-- Otimiza: ORDER BY issued_at DESC, id para paginação estável
CREATE INDEX IF NOT EXISTS idx_certificates_pagination_cursor 
ON issued_certificates USING btree (issued_at DESC, id);

-- Índice para paginação por template específico
-- Otimiza: WHERE template_id = X ORDER BY issued_at DESC, id
CREATE INDEX IF NOT EXISTS idx_certificates_template_pagination 
ON issued_certificates USING btree (template_id, issued_at DESC, id);

-- Índice para contagem rápida por template (evita COUNT(*) lento)
CREATE INDEX IF NOT EXISTS idx_certificates_template_count 
ON issued_certificates USING btree (template_id)
INCLUDE (id, issued_at);

-- ========================================
-- 5. ÍNDICES PARA SEARCH API OTIMIZADA
-- ========================================

-- Índice composto para a API de busca que usa múltiplos campos
-- Otimiza: WHERE (certificate_number ILIKE OR recipient_email ILIKE OR ...)
CREATE INDEX IF NOT EXISTS idx_certificates_search_composite 
ON issued_certificates USING btree (certificate_number, recipient_email, issued_at DESC);

-- Índice para certificate_number (usado em verificações únicas)
CREATE INDEX IF NOT EXISTS idx_certificates_number_search 
ON issued_certificates USING btree (LOWER(certificate_number))
WHERE certificate_number IS NOT NULL;

-- ========================================
-- 6. ÍNDICES PARA DASHBOARD PERFORMANCE
-- ========================================

-- Índice para estatísticas do dashboard (evita table scan)
-- Otimiza: COUNT(*) com filtros de data
CREATE INDEX IF NOT EXISTS idx_certificates_dashboard_stats 
ON issued_certificates USING btree (template_id, issued_at)
INCLUDE (id);

-- Índice para chart data (últimos 7 dias)
-- Otimiza: GROUP BY DATE(issued_at) com filtros
CREATE INDEX IF NOT EXISTS idx_certificates_chart_data 
ON issued_certificates USING btree (issued_at, template_id);

-- ========================================
-- 7. OTIMIZAÇÕES DE STORAGE
-- ========================================

-- Configura fill factor para índices com muitas inserções
-- Reduz fragmentação em índices que crescem constantemente
ALTER INDEX IF EXISTS idx_certificates_issued_at_stats SET (fillfactor = 90);
ALTER INDEX IF EXISTS idx_certificates_template_issued_desc SET (fillfactor = 90);
ALTER INDEX IF EXISTS idx_certificates_pagination_cursor SET (fillfactor = 90);

-- ========================================
-- 8. ESTATÍSTICAS E ANÁLISE
-- ========================================

-- Atualiza estatísticas para melhor planejamento de queries
ANALYZE issued_certificates;
ANALYZE certificate_templates;

-- ========================================
-- 9. COMENTÁRIOS DE AUDITORIA
-- ========================================

COMMENT ON INDEX idx_certificates_recipient_email_lower IS 'Otimiza buscas case-insensitive por email (ILIKE)';
COMMENT ON INDEX idx_certificates_recipient_email_exact IS 'Otimiza buscas exatas por email (=)';
COMMENT ON INDEX idx_certificates_template_issued_desc IS 'Otimiza joins com templates + ordenação por data';
COMMENT ON INDEX idx_certificates_recipient_data_gin_ops IS 'Otimiza buscas gerais em campos JSON';
COMMENT ON INDEX idx_certificates_recipient_data_gin_path IS 'Otimiza buscas específicas em JSON (@>)';
COMMENT ON INDEX idx_certificates_recipient_name_lower IS 'Otimiza buscas case-insensitive por nome';
COMMENT ON INDEX idx_certificates_recipient_cpf IS 'Otimiza buscas por CPF';
COMMENT ON INDEX idx_certificates_pagination_cursor IS 'Otimiza paginação cursor-based estável';
COMMENT ON INDEX idx_certificates_template_pagination IS 'Otimiza paginação por template específico';
COMMENT ON INDEX idx_certificates_search_composite IS 'Otimiza API de busca multi-campo';
COMMENT ON INDEX idx_certificates_dashboard_stats IS 'Otimiza estatísticas do dashboard';
COMMENT ON INDEX idx_certificates_chart_data IS 'Otimiza dados do gráfico (últimos 7 dias)';

-- ========================================
-- 10. VERIFICAÇÃO DE PERFORMANCE
-- ========================================

-- Query para verificar uso dos índices (executar após deploy)
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- WHERE tablename = 'issued_certificates' 
-- ORDER BY idx_scan DESC;
