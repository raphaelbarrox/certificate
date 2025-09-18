-- Remove campos antigos de email que estão causando confusão
-- Remove colunas obsoletas do sistema SMTP antigo
ALTER TABLE certificate_templates 
DROP COLUMN IF EXISTS email_config_enabled,
DROP COLUMN IF EXISTS smtp_config,
DROP COLUMN IF EXISTS email_body,
DROP COLUMN IF EXISTS email_subject;

-- Garante que form_design sempre tenha uma estrutura padrão
-- Atualiza templates que não têm emailConfig definido
UPDATE certificate_templates 
SET form_design = COALESCE(form_design, '{}'::jsonb) || 
  jsonb_build_object(
    'emailConfig', 
    jsonb_build_object(
      'enabled', false,
      'senderName', '',
      'senderEmail', '',
      'subject', 'Seu certificado está pronto!',
      'body', '<p>Olá {{nome_completo}},</p><p>Seu certificado foi emitido com sucesso. Clique no link abaixo para fazer o download:</p><p><a href="{{certificate_link}}">Baixar Certificado</a></p><p>Número do Certificado: {{certificate_id}}</p>'
    )
  )
WHERE form_design IS NULL 
   OR NOT (form_design ? 'emailConfig');

-- Corrigido índice GIN para usar JSONB ao invés de texto extraído
-- Cria índice para melhorar performance na consulta do emailConfig
CREATE INDEX IF NOT EXISTS idx_certificate_templates_email_config 
ON certificate_templates USING GIN ((form_design->'emailConfig'));

-- Adicionado índice B-tree para consultas específicas do campo enabled
-- Índice adicional para consultas rápidas do campo enabled
CREATE INDEX IF NOT EXISTS idx_certificate_templates_email_enabled 
ON certificate_templates ((form_design->'emailConfig'->>'enabled'));

-- Adiciona comentário para documentar a estrutura
COMMENT ON COLUMN certificate_templates.form_design IS 'JSONB contendo configurações do formulário incluindo emailConfig com campos: enabled, senderName, senderEmail, subject, body';
