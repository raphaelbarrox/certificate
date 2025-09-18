-- Script para atualizar configurações de email padrão em todos os templates
-- Corrige erro de sintaxe RAISE e atualiza apenas o emailConfig dentro do form_design existente

DO $$
DECLARE
    template_record RECORD;
    updated_count INTEGER := 0;
    current_form_design JSONB;
    updated_form_design JSONB;
    default_email_body TEXT := '<p>Olá {{nome_completo}},</p><p>Seu certificado foi emitido com sucesso. Clique no link abaixo para fazer o download:</p><p><a href="{{certificate_link}}">Baixar Certificado</a></p><p>Número do Certificado: {{certificate_id}}</p>';
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
                'subject', 'Seu Certificado foi Emitido com Sucesso',
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
        
        -- Corrigido sintaxe RAISE com parâmetros corretos
        RAISE NOTICE 'Template atualizado: % (ID: %)', template_record.title, template_record.id;
    END LOOP;
    
    -- Relatório final com sintaxe correta
    RAISE NOTICE '=== AUDITORIA COMPLETA ===';
    RAISE NOTICE 'Total de templates atualizados: %', updated_count;
    RAISE NOTICE 'Configurações aplicadas:';
    RAISE NOTICE '- Email ativado: SIM';
    RAISE NOTICE '- Remetente: Certificadora Internacional Therapist';
    RAISE NOTICE '- Email: contact@therapist.international';
    RAISE NOTICE '- Corpo: HTML simples conforme solicitado';
    RAISE NOTICE '=========================';
    
    -- Verificação final
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
