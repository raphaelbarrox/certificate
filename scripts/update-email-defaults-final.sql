-- Script para atualizar configurações de email padrão em todos os templates
-- Atualiza apenas o emailConfig dentro do form_design existente

DO $$
DECLARE
    template_record RECORD;
    updated_count INTEGER := 0;
    current_form_design JSONB;
    updated_form_design JSONB;
    default_email_body TEXT := '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
    <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c3e50; margin-bottom: 10px;">🎓 Certificado Emitido com Sucesso!</h1>
            <p style="color: #7f8c8d; font-size: 16px;">Parabéns pela sua conquista!</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <p style="color: #2c3e50; font-size: 16px; margin-bottom: 15px;">Olá <strong>{{nome}}</strong>,</p>
            <p style="color: #34495e; line-height: 1.6; margin-bottom: 15px;">
                Seu certificado foi emitido com sucesso e está pronto para download! 
                Este documento comprova sua participação e dedicação.
            </p>
            <p style="color: #34495e; line-height: 1.6;">
                <strong>Número do Certificado:</strong> {{certificate_id}}
            </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{certificate_link}}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      font-weight: bold; 
                      font-size: 16px; 
                      display: inline-block; 
                      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                      transition: transform 0.2s;">
                📥 Baixar Meu Certificado
            </a>
        </div>
        
        <div style="background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%); 
                    padding: 25px; 
                    border-radius: 10px; 
                    text-align: center; 
                    margin: 25px 0;">
            <h2 style="color: #2c3e50; margin-bottom: 15px; font-size: 24px;">🎉 OFERTA ESPECIAL LIMITADA!</h2>
            <p style="color: #2c3e50; font-size: 18px; margin-bottom: 15px;">
                <strong>Aproveite 70% OFF</strong> em nossos cursos avançados!
            </p>
            <p style="color: #34495e; margin-bottom: 20px; line-height: 1.6;">
                Como você acabou de conquistar seu certificado, temos uma oportunidade única para você continuar evoluindo profissionalmente.
            </p>
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 15px 0;">
                <p style="color: #e74c3c; font-size: 20px; font-weight: bold; margin-bottom: 5px;">
                    De R$ 497,00 por apenas
                </p>
                <p style="color: #27ae60; font-size: 32px; font-weight: bold; margin-bottom: 15px;">
                    R$ 147,00
                </p>
                <p style="color: #7f8c8d; font-size: 14px;">
                    ⏰ Oferta válida por apenas 24 horas!
                </p>
            </div>
            <a href="https://therapist.international/oferta-especial" 
               style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); 
                      color: white; 
                      padding: 15px 25px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      font-weight: bold; 
                      font-size: 16px; 
                      display: inline-block; 
                      box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
                      margin-top: 10px;">
                🚀 QUERO APROVEITAR A OFERTA!
            </a>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1;">
            <p style="color: #7f8c8d; font-size: 14px; margin-bottom: 10px;">
                Atenciosamente,<br>
                <strong>Certificadora Internacional Therapist</strong>
            </p>
            <p style="color: #bdc3c7; font-size: 12px;">
                Este é um email automático, não responda a esta mensagem.
            </p>
        </div>
    </div>
</div>';
BEGIN
    -- Loop através de todos os templates
    FOR template_record IN 
        SELECT id, title, form_design 
        FROM certificate_templates 
        ORDER BY created_at DESC
    LOOP
        -- Pega o form_design atual
        current_form_design := COALESCE(template_record.form_design, '{}'::jsonb);
        
        -- Atualiza apenas o emailConfig dentro do form_design existente
        updated_form_design := jsonb_set(
            current_form_design,
            '{emailConfig}',
            jsonb_build_object(
                'enabled', true,
                'senderName', 'Certificadora Internacional Therapist',
                'senderEmail', 'contact@therapist.international',
                'subject', '🎓 Seu Certificado está Pronto! + Oferta Especial 70% OFF',
                'body', default_email_body
            )
        );
        
        -- Atualiza o template
        UPDATE certificate_templates 
        SET 
            form_design = updated_form_design,
            updated_at = NOW()
        WHERE id = template_record.id;
        
        updated_count := updated_count + 1;
        
        RAISE NOTICE 'Template atualizado: % (ID: %)', template_record.title, template_record.id;
    END LOOP;
    
    -- Relatório final
    RAISE NOTICE '=== AUDITORIA COMPLETA ===';
    RAISE NOTICE 'Total de templates atualizados: %', updated_count;
    RAISE NOTICE 'Configurações aplicadas:';
    RAISE NOTICE '- Email ativado: SIM';
    RAISE NOTICE '- Remetente: Certificadora Internacional Therapist';
    RAISE NOTICE '- Email: contact@therapist.international';
    RAISE NOTICE '- Assunto: 🎓 Seu Certificado está Pronto! + Oferta Especial 70% OFF';
    RAISE NOTICE '- Corpo: HTML promocional completo com oferta 70% OFF';
    RAISE NOTICE '=========================';
    
    -- Verificação final
    PERFORM (
        SELECT COUNT(*) 
        FROM certificate_templates 
        WHERE form_design->'emailConfig'->>'enabled' = 'true'
    );
    
    RAISE NOTICE 'Verificação: % templates com email ativado', 
        (SELECT COUNT(*) FROM certificate_templates WHERE form_design->'emailConfig'->>'enabled' = 'true');
        
END $$;

-- Consulta de verificação final
SELECT 
    id,
    title,
    form_design->'emailConfig'->>'enabled' as email_enabled,
    form_design->'emailConfig'->>'senderName' as sender_name,
    form_design->'emailConfig'->>'senderEmail' as sender_email,
    form_design->'emailConfig'->>'subject' as email_subject,
    LENGTH(form_design->'emailConfig'->>'body') as body_length
FROM certificate_templates
ORDER BY created_at DESC;
