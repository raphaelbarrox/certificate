-- Script para atualizar TODOS os templates com o novo corpo de email HTML padrão
-- Corrige problema de tamanho do índice BTREE

BEGIN;

-- Primeiro, remover o índice problemático que tem limitação de tamanho
DROP INDEX IF EXISTS idx_templates_email_config;

-- Definir o novo corpo de email HTML padrão (otimizado)
DO $$
DECLARE
    email_body_html TEXT := '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
  <div style="background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #2c3e50; margin: 0; font-size: 28px;">🎉 Parabéns!</h1>
      <p style="color: #7f8c8d; margin: 10px 0 0 0; font-size: 16px;">Seu certificado foi emitido com sucesso</p>
    </div>
    
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
      <h2 style="margin: 0 0 10px 0; font-size: 22px;">Olá, {{nome}}!</h2>
      <p style="margin: 0; font-size: 16px; opacity: 0.9;">Seu certificado está pronto para download. Clique no botão abaixo para acessá-lo.</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{certificate_link}}" style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);">
        📄 Baixar Certificado
      </a>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
      <h3 style="color: #495057; margin: 0 0 15px 0; font-size: 18px;">📋 Detalhes do Certificado</h3>
      <p style="margin: 5px 0; color: #6c757d;"><strong>Número:</strong> {{certificate_id}}</p>
      <p style="margin: 5px 0; color: #6c757d;"><strong>Data de Emissão:</strong> {{data_emissao}}</p>
    </div>
    
    <div style="border-top: 2px solid #e9ecef; padding-top: 25px; margin-top: 30px;">
      <div style="background: linear-gradient(135deg, #ff6b6b, #ee5a24); color: white; padding: 20px; border-radius: 8px; text-align: center;">
        <h3 style="margin: 0 0 15px 0; font-size: 20px;">🎁 OFERTA ESPECIAL!</h3>
        <p style="margin: 0 0 15px 0; font-size: 16px;">Aproveite nossa promoção exclusiva para novos cursos!</p>
        <p style="margin: 0 0 20px 0; font-size: 24px; font-weight: bold;">50% OFF</p>
        <a href="https://therapist.international/cursos" style="background-color: white; color: #ee5a24; padding: 12px 25px; text-decoration: none; border-radius: 20px; font-weight: bold; display: inline-block;">
          Ver Cursos Disponíveis
        </a>
      </div>
    </div>
    
    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
      <p style="color: #6c757d; margin: 0; font-size: 14px;">
        Atenciosamente,<br>
        <strong style="color: #495057;">Marina L. - Equipe Therapist International</strong>
      </p>
      <p style="color: #adb5bd; margin: 10px 0 0 0; font-size: 12px;">
        Este é um email automático, não responda a esta mensagem.
      </p>
    </div>
  </div>
</div>';
    
    template_count INTEGER := 0;
    updated_count INTEGER := 0;
BEGIN
    -- Contar templates existentes
    SELECT COUNT(*) INTO template_count FROM certificate_templates;
    RAISE NOTICE 'Total de templates encontrados: %', template_count;
    
    -- Atualizar TODOS os templates com o novo corpo de email e configurações padrão
    UPDATE certificate_templates 
    SET form_design = jsonb_set(
        jsonb_set(
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        COALESCE(form_design, '{}'::jsonb),
                        '{emailConfig,enabled}', 
                        'true'::jsonb
                    ),
                    '{emailConfig,senderName}', 
                    '"Marina L."'::jsonb
                ),
                '{emailConfig,senderEmail}', 
                '"certificados@therapist.international"'::jsonb
            ),
            '{emailConfig,subject}', 
            '"🎉 Seu certificado está pronto - Oferta especial 50% OFF!"'::jsonb
        ),
        '{emailConfig,body}', 
        to_jsonb(email_body_html)
    ),
    updated_at = NOW();
    
    -- Contar quantos foram atualizados
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Templates atualizados com sucesso: %', updated_count;
    
    -- Criar índice otimizado apenas para o campo enabled (menor)
    CREATE INDEX IF NOT EXISTS idx_templates_email_enabled 
    ON certificate_templates USING BTREE ((form_design->'emailConfig'->>'enabled'));
    
    -- Verificar se todos os templates têm email ativado
    SELECT COUNT(*) INTO template_count 
    FROM certificate_templates 
    WHERE form_design->'emailConfig'->>'enabled' = 'true';
    
    RAISE NOTICE 'Templates com email ativado: %', template_count;
    
    -- Auditoria final
    RAISE NOTICE '=== AUDITORIA COMPLETA ===';
    RAISE NOTICE 'Todos os templates foram atualizados com:';
    RAISE NOTICE '- Email ativado: SIM';
    RAISE NOTICE '- Remetente: Marina L.';
    RAISE NOTICE '- Assunto promocional: SIM';
    RAISE NOTICE '- Corpo HTML com oferta 50%% OFF: SIM';
    RAISE NOTICE '- Índice otimizado criado: SIM';
    
END $$;

COMMIT;
