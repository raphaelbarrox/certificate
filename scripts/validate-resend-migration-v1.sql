-- Corrigindo referência de 'name' para 'title' baseado no schema real
-- Script para validar a migração para Resend
-- Verifica se todos os templates foram migrados corretamente e estão prontos para usar Resend

-- Relatório de status da migração
SELECT 
  'MIGRATION_SUMMARY' as report_type,
  COUNT(*) as total_templates,
  COUNT(CASE WHEN form_design->'emailConfig'->>'enabled' = 'true' THEN 1 END) as email_enabled_count,
  COUNT(CASE WHEN form_design->'emailConfig'->>'senderEmail' LIKE '%@therapist.international' THEN 1 END) as valid_domain_count,
  COUNT(CASE WHEN form_design->'smtp' IS NOT NULL THEN 1 END) as old_smtp_remaining,
  COUNT(CASE WHEN form_design->'emailConfig'->'smtp' IS NOT NULL THEN 1 END) as old_email_smtp_remaining,
  -- Adicionando verificação de configurações essenciais
  COUNT(CASE WHEN form_design->'emailConfig'->>'enabled' = 'true' 
                AND form_design->'emailConfig'->>'senderEmail' != '' 
                AND form_design->'emailConfig'->>'senderName' != '' 
                AND form_design->'emailConfig'->>'subject' != '' 
                THEN 1 END) as fully_configured_count
FROM certificate_templates
WHERE form_design IS NOT NULL;

-- Templates com email habilitado e prontos para Resend
SELECT 
  'RESEND_READY_TEMPLATES' as report_type,
  id,
  title, -- Corrigido de 'name' para 'title'
  form_design->'emailConfig'->>'senderName' as sender_name,
  form_design->'emailConfig'->>'senderEmail' as sender_email,
  form_design->'emailConfig'->>'subject' as email_subject,
  CASE 
    WHEN form_design->'emailConfig'->>'senderEmail' LIKE '%@therapist.international' THEN 'VALID_DOMAIN'
    WHEN form_design->'emailConfig'->>'senderEmail' = '' THEN 'EMPTY_EMAIL'
    ELSE 'INVALID_DOMAIN'
  END as domain_status,
  -- Verificando se tem todas as configurações necessárias
  CASE 
    WHEN form_design->'emailConfig'->>'senderName' != '' 
         AND form_design->'emailConfig'->>'senderEmail' LIKE '%@therapist.international'
         AND form_design->'emailConfig'->>'subject' != ''
         AND form_design->'emailConfig'->>'body' != '' THEN 'READY_FOR_RESEND'
    ELSE 'NEEDS_CONFIGURATION'
  END as resend_readiness
FROM certificate_templates
WHERE form_design->'emailConfig'->>'enabled' = 'true'
ORDER BY created_at DESC;

-- Relatório específico de problemas que impedem uso do Resend
SELECT 
  'RESEND_BLOCKERS' as report_type,
  id,
  title, -- Corrigido de 'name' para 'title'
  CASE 
    WHEN form_design->'emailConfig'->>'enabled' = 'true' AND form_design->'emailConfig'->>'senderEmail' = '' THEN 'MISSING_SENDER_EMAIL'
    WHEN form_design->'emailConfig'->>'enabled' = 'true' AND form_design->'emailConfig'->>'senderName' = '' THEN 'MISSING_SENDER_NAME'
    WHEN form_design->'emailConfig'->>'enabled' = 'true' AND NOT (form_design->'emailConfig'->>'senderEmail' LIKE '%@therapist.international') THEN 'INVALID_DOMAIN_MUST_BE_THERAPIST_INTERNATIONAL'
    WHEN form_design->'emailConfig'->>'enabled' = 'true' AND form_design->'emailConfig'->>'subject' = '' THEN 'MISSING_SUBJECT'
    WHEN form_design->'emailConfig' IS NULL THEN 'MISSING_EMAIL_CONFIG'
    WHEN form_design->'smtp' IS NOT NULL THEN 'OLD_SMTP_CONFIG_FOUND'
    WHEN form_design->'emailConfig'->'smtp' IS NOT NULL THEN 'OLD_EMAIL_SMTP_CONFIG_FOUND'
    ELSE 'NO_ISSUES'
  END as blocker_type,
  form_design->'emailConfig'->>'senderEmail' as current_email
FROM certificate_templates
WHERE form_design IS NOT NULL
  AND (
    (form_design->'emailConfig'->>'enabled' = 'true' AND form_design->'emailConfig'->>'senderEmail' = '') OR
    (form_design->'emailConfig'->>'enabled' = 'true' AND form_design->'emailConfig'->>'senderName' = '') OR
    (form_design->'emailConfig'->>'enabled' = 'true' AND NOT (form_design->'emailConfig'->>'senderEmail' LIKE '%@therapist.international')) OR
    (form_design->'emailConfig'->>'enabled' = 'true' AND form_design->'emailConfig'->>'subject' = '') OR
    form_design->'emailConfig' IS NULL OR
    form_design->'smtp' IS NOT NULL OR
    form_design->'emailConfig'->'smtp' IS NOT NULL
  )
ORDER BY created_at DESC;

-- Verificação final de limpeza SMTP
SELECT 
  'SMTP_CLEANUP_STATUS' as report_type,
  CASE 
    WHEN COUNT(*) = 0 THEN 'ALL_SMTP_REFERENCES_REMOVED'
    ELSE 'SMTP_REFERENCES_STILL_EXIST'
  END as cleanup_status,
  COUNT(*) as remaining_smtp_references
FROM certificate_templates
WHERE form_design->'smtp' IS NOT NULL 
   OR form_design->'emailConfig'->'smtp' IS NOT NULL
   OR form_design->'emailConfig'->'smtpHost' IS NOT NULL
   OR form_design->'emailConfig'->'smtpPort' IS NOT NULL
   OR form_design->'emailConfig'->'smtpUser' IS NOT NULL
   OR form_design->'emailConfig'->'smtpPass' IS NOT NULL;

-- Relatório final de sucesso da migração
SELECT 
  'MIGRATION_SUCCESS_REPORT' as report_type,
  CASE 
    WHEN (SELECT COUNT(*) FROM certificate_templates WHERE form_design->'smtp' IS NOT NULL OR form_design->'emailConfig'->'smtp' IS NOT NULL) = 0
         AND (SELECT COUNT(*) FROM certificate_templates WHERE form_design->'emailConfig' IS NOT NULL) > 0
    THEN 'MIGRATION_SUCCESSFUL_READY_FOR_RESEND'
    ELSE 'MIGRATION_INCOMPLETE_NEEDS_ATTENTION'
  END as final_status,
  NOW() as validation_timestamp;
