-- Script para ativar email por padrão em templates existentes e garantir campos obrigatórios
BEGIN;

-- Atualizar todos os templates existentes para ter email ativado por padrão
UPDATE certificate_templates 
SET form_design = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(form_design, '{}'::jsonb),
        '{emailConfig,enabled}', 
        'true'::jsonb
      ),
      '{emailConfig,senderName}', 
      '"Sistema de Certificados"'::jsonb
    ),
    '{emailConfig,senderEmail}', 
    '"certificados@therapist.international"'::jsonb
  ),
  '{emailConfig,subject}', 
  '"Seu certificado está pronto!"'::jsonb
)
WHERE form_design IS NULL 
   OR form_design->'emailConfig' IS NULL 
   OR form_design->'emailConfig'->>'enabled' IS NULL
   OR form_design->'emailConfig'->>'senderEmail' = ''
   OR form_design->'emailConfig'->>'senderName' = '';

-- Garantir que templates com emailConfig incompleto sejam corrigidos
UPDATE certificate_templates 
SET form_design = jsonb_set(
  form_design,
  '{emailConfig,body}', 
  '"<p>Olá {{nome}},</p><p>Seu certificado foi emitido com sucesso. Clique no link abaixo para fazer o download:</p><p><a href=\"{{certificate_link}}\" style=\"background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;\">Baixar Certificado</a></p><p>Número do Certificado: {{certificate_id}}</p><p>Atenciosamente,<br>Equipe de Certificados</p>"'::jsonb
)
WHERE form_design->'emailConfig'->>'body' IS NULL 
   OR form_design->'emailConfig'->>'body' = ''
   OR form_design->'emailConfig'->>'body' LIKE '%{{nome_completo}}%';

-- Removido índice GIN problemático e criado índice B-tree simples
CREATE INDEX IF NOT EXISTS idx_templates_email_config 
ON certificate_templates USING BTREE ((form_design->'emailConfig'));

-- Log das alterações
DO $$
DECLARE
    template_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO template_count 
    FROM certificate_templates 
    WHERE form_design->'emailConfig'->>'enabled' = 'true';
    
    RAISE NOTICE 'Email ativado em % templates', template_count;
END $$;

COMMIT;
