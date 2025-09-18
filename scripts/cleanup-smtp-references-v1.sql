-- Corrigindo referência de 'name' para 'title' baseado no schema real
-- Script para limpar APENAS referências antigas ao sistema SMTP
-- SEGURO: Remove apenas campos SMTP, mantém todas as outras configurações intactas

-- Backup antes da limpeza
CREATE TABLE IF NOT EXISTS smtp_cleanup_backup AS
SELECT 
  id,
  title,
  form_design->'smtp' as old_smtp_config,
  form_design->'emailConfig'->'smtp' as old_email_smtp_config,
  NOW() as backup_date
FROM certificate_templates 
WHERE form_design->'smtp' IS NOT NULL 
   OR form_design->'emailConfig'->'smtp' IS NOT NULL;

-- Remover APENAS configurações SMTP antigas dos templates (nível raiz)
UPDATE certificate_templates 
SET form_design = form_design - 'smtp'
WHERE form_design->'smtp' IS NOT NULL;

-- Remover APENAS configurações SMTP antigas do emailConfig
UPDATE certificate_templates 
SET form_design = jsonb_set(
  form_design,
  '{emailConfig}',
  (form_design->'emailConfig') - 'smtp' - 'smtpHost' - 'smtpPort' - 'smtpUser' - 'smtpPass' - 'smtpSecure'
)
WHERE form_design->'emailConfig' IS NOT NULL
  AND (
    form_design->'emailConfig'->'smtp' IS NOT NULL OR
    form_design->'emailConfig'->'smtpHost' IS NOT NULL OR
    form_design->'emailConfig'->'smtpPort' IS NOT NULL OR
    form_design->'emailConfig'->'smtpUser' IS NOT NULL OR
    form_design->'emailConfig'->'smtpPass' IS NOT NULL OR
    form_design->'emailConfig'->'smtpSecure' IS NOT NULL
  );

-- Verificar limpeza (apenas campos SMTP removidos)
SELECT 
  id,
  title,
  CASE 
    WHEN form_design->'smtp' IS NOT NULL THEN 'STILL_HAS_ROOT_SMTP'
    WHEN form_design->'emailConfig'->'smtp' IS NOT NULL THEN 'STILL_HAS_EMAIL_SMTP'
    WHEN form_design->'emailConfig'->'smtpHost' IS NOT NULL THEN 'STILL_HAS_SMTP_FIELDS'
    ELSE 'CLEANED_OK'
  END as cleanup_status,
  form_design->'emailConfig'->>'enabled' as email_still_enabled,
  form_design->'emailConfig'->>'senderEmail' as sender_email_preserved
FROM certificate_templates
WHERE form_design IS NOT NULL
ORDER BY created_at DESC;
