-- Corrigindo referência de 'name' para 'title' baseado no schema real
-- Script para migrar configurações de email de SMTP para Resend
-- ATENÇÃO: Este script afeta APENAS as configurações de email, não altera outras funcionalidades

-- Backup das configurações atuais antes da migração
CREATE TABLE IF NOT EXISTS email_migration_backup AS
SELECT 
  id,
  title,
  form_design->'emailConfig' as old_email_config,
  NOW() as backup_date
FROM certificate_templates 
WHERE form_design->'emailConfig' IS NOT NULL;

-- Atualizar APENAS as configurações de email nos templates existentes
-- Remove configurações SMTP e mantém apenas configurações essenciais para Resend
UPDATE certificate_templates 
SET form_design = jsonb_set(
  form_design,
  '{emailConfig}',
  jsonb_build_object(
    'enabled', COALESCE((form_design->'emailConfig'->>'enabled')::boolean, false),
    'senderName', COALESCE(form_design->'emailConfig'->>'senderName', ''),
    'senderEmail', COALESCE(form_design->'emailConfig'->>'senderEmail', ''),
    'subject', COALESCE(form_design->'emailConfig'->>'subject', 'Seu certificado está pronto!'),
    'body', COALESCE(
      form_design->'emailConfig'->>'body', 
      '<p>Olá {{nome_completo}},</p><p>Seu certificado foi emitido com sucesso. Clique no link abaixo para fazer o download:</p><p><a href="{{certificate_link}}">Baixar Certificado</a></p><p>Número do Certificado: {{certificate_id}}</p>'
    )
  )
)
WHERE form_design IS NOT NULL 
  AND form_design->'emailConfig' IS NOT NULL;

-- Adicionar configuração de email padrão para templates que não têm
UPDATE certificate_templates 
SET form_design = COALESCE(form_design, '{}'::jsonb) || jsonb_build_object(
  'emailConfig', jsonb_build_object(
    'enabled', false,
    'senderName', '',
    'senderEmail', '',
    'subject', 'Seu certificado está pronto!',
    'body', '<p>Olá {{nome_completo}},</p><p>Seu certificado foi emitido com sucesso. Clique no link abaixo para fazer o download:</p><p><a href="{{certificate_link}}">Baixar Certificado</a></p><p>Número do Certificado: {{certificate_id}}</p>'
  )
)
WHERE form_design IS NULL 
  OR form_design->'emailConfig' IS NULL;

-- Verificar resultados da migração (apenas configurações de email)
SELECT 
  id,
  title,
  form_design->'emailConfig'->>'enabled' as email_enabled,
  form_design->'emailConfig'->>'senderEmail' as sender_email,
  CASE 
    WHEN form_design->'emailConfig'->'smtp' IS NOT NULL THEN 'NEEDS_CLEANUP'
    ELSE 'MIGRATED_OK'
  END as migration_status
FROM certificate_templates
WHERE form_design IS NOT NULL
ORDER BY created_at DESC;
