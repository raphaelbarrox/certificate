-- AUDITORIA COMPLETA E ATUALIZAÇÃO DE CONFIGURAÇÕES DE EMAIL
-- Este script atualiza TODOS os templates com as configurações exatas solicitadas

BEGIN;

-- 1. AUDITORIA INICIAL - Verificar estado atual
SELECT 
    COUNT(*) as total_templates,
    COUNT(CASE WHEN form_design->'emailConfig'->>'enabled' = 'true' THEN 1 END) as emails_ativos,
    COUNT(CASE WHEN form_design->'emailConfig'->>'enabled' = 'false' OR form_design->'emailConfig'->>'enabled' IS NULL THEN 1 END) as emails_inativos
FROM certificate_templates;

-- 2. BACKUP DE SEGURANÇA antes das alterações
CREATE TABLE IF NOT EXISTS email_config_backup_final AS
SELECT 
    id,
    title,
    form_design->'emailConfig' as old_email_config,
    NOW() as backup_date
FROM certificate_templates;

-- 3. ATUALIZAÇÃO PRINCIPAL - Configurar TODOS os templates com as especificações exatas
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
                '"Certificadora Internacional Therapist"'::jsonb
            ),
            '{emailConfig,senderEmail}',
            '"contact@therapist.international"'::jsonb
        ),
        '{emailConfig,subject}',
        '"Parabéns! Seu certificado está pronto!"'::jsonb
    ),
    '{emailConfig,body}',
    '"<p><strong>🎉 Parabéns {{nome_completo}}!</strong></p><p>Seu certificado foi <strong>EMITIDO COM SUCESSO</strong> e já está disponível para download:</p><p><strong>📜 <a href=\"{{certificate_link}}\">CLIQUE AQUI PARA BAIXAR SEU CERTIFICADO</a></strong></p><p><strong>Número do Certificado:</strong> {{certificate_id}}<br><strong>Status:</strong> Verificado e Registrado ✅<br><strong>Validade:</strong> Permanente com QR Code funcional</p><p>---</p><p><strong>🏆 {{nome_completo}}, Você Deu o Primeiro Passo!</strong></p><p>Agora que você tem seu primeiro certificado com QR Code verificável, que tal <strong>multiplicar suas certificações</strong> e se tornar um dos profissionais mais qualificados do Brasil?</p><p>Profissionais com múltiplas certificações ganham em média <strong>340% mais</strong> que os com certificação única. É matemática simples: mais especializações = mais clientes = mais renda.</p><p>---</p><p><strong>🔥 OFERTA EXCLUSIVA PARA ALUNOS (VÁLIDA POR 48H)</strong></p><p>Como nosso aluno certificado, você tem acesso a condições que <strong>NUNCA</strong> oferecemos ao público geral:</p><p><strong>🎯 OFERTA PRINCIPAL - PACOTE MASTER 12 ESPECIALIZAÇÕES + 2 BÔNUS</strong></p><p>Torne-se especialista em <strong>14 áreas diferentes</strong> da psicanálise:<br>✅ Ansiedade (56 milhões de brasileiros precisam)<br>✅ Depressão (mercado de R$ 2 bilhões/ano)<br>✅ Vícios (demanda explosiva pós-pandemia)<br>✅ Traumas Familiares (70% da população afetada)<br>✅ Sexualidade (sessões de R$ 500+)<br>✅ Trabalho e Burnout (empresas pagam fortunas)<br>✅ Filhos (pais desesperados por ajuda)<br>✅ Traição (60% dos casamentos afetados)<br>✅ Medos e Fobias (tratamento rápido valorizado)<br>✅ Distúrbios Mentais (maior mercado de saúde)<br>✅ Prosperidade (novo nicho - R$ 1.000/sessão)<br>✅ Religião (92% dos brasileiros são religiosos)<br><strong>+ BÔNUS #1: TDAH</strong> (400% de aumento na procura)<br><strong>+ BÔNUS #2: Burnout Executivo</strong> (R$ 50k por programa corporativo)</p><p><strong>Valor normal:</strong> <s>R$ 35.000</s><br><strong>Para alunos certificados:</strong> R$ 297</p><p><strong>👉 <a href=\"https://therapist.university/ads-12-especializacoes-alunos-297/\">GARANTIR PACOTE COMPLETO POR R$ 297</a></strong></p><p>---</p><p><strong>💎 OUTRAS OPORTUNIDADES EXCLUSIVAS PARA ALUNOS</strong></p><p><strong>FORMAÇÃO COMPLETA EM PSICANÁLISE CLÍNICA</strong><br>840 horas certificadas + Registro Profissional + Crachá BLACK<br><s>R$ 2.897</s> → Alunos: R$ 97<br><a href=\"https://therapist.university/97-bolsa-de-estudos-curso-de-psicanalise-br/\">Ativar Formação Completa</a></p><p><strong>ESPECIALIZAÇÕES INDIVIDUAIS - R$ 39,90 cada:</strong></p><p>• <strong>NOVIDADE: Especialização em TDAH</strong> (Primeira do Brasil!)<br><a href=\"https://therapist.university/psicanalista-especialista-tdah/\">Garantir Especialização TDAH</a></p><p>• <strong>Especialização em Ansiedade</strong><br><a href=\"https://therapist.university/psicanalista-especialista-ansiedade/\">Garantir Especialização</a></p><p>• <strong>Especialização em Depressão</strong><br><a href=\"https://therapist.university/psicanalista-especialista-depressao/\">Garantir Especialização</a></p><p>• <strong>Especialização em Burnout</strong><br><a href=\"https://therapist.university/psicanalista-especialista-burnout/\">Garantir Especialização</a></p><p>• <strong>Especialização em Traumas Familiares</strong><br><a href=\"https://therapist.university/psicanalista-especialista-traumas-familiares/\">Garantir Especialização</a></p><p>• <strong>Especialização em Sexualidade</strong><br><a href=\"https://therapist.university/psicanalista-especialista-sexualidade/\">Garantir Especialização</a></p><p>• <strong>Especialização em Vícios</strong><br><a href=\"https://therapist.university/psicanalista-especialista-vicios/\">Garantir Especialização</a></p><p>• <strong>Especialização em Medos e Fobias</strong><br><a href=\"https://therapist.university/psicanalista-especialista-medos/\">Garantir Especialização</a></p><p>---</p><p><strong>📊 COMPARE E DECIDA COM INTELIGÊNCIA</strong></p><p><strong>Opção A:</strong> Comprar 14 especializações individualmente<br>14 × R$ 39,90 = R$ 558,60</p><p><strong>Opção B:</strong> Pacote completo com 14 especializações<br>Total: R$ 297 (com Crachás BLACK + Bônus + Futuras Grátis)</p><p><strong>Você economiza R$ 261,60 escolhendo o pacote!</strong></p><p>---</p><p><strong>⏰ POR QUE APENAS 48 HORAS?</strong></p><p>{{nome_completo}}, esta condição especial de aluno é <strong>temporária</strong>. Após 48 horas:</p><p>• Preços voltam ao normal (R$ 2.500 por especialização)<br>- Bônus TDAH e Burnout não estarão mais disponíveis<br>- Você perde R$ 34.703 em economia<br>- Próxima oportunidade: Nunca</p><p>---</p><p><strong>🚀 IMAGINE SEU FUTURO COM 14 CERTIFICAÇÕES</strong></p><p>Enquanto outros profissionais têm 1 ou 2 certificados genéricos...<br><strong>Você terá 14 especializações verificáveis com QR Code.</strong></p><p>Resultado garantido:<br>✅ Agenda lotada em 90 dias<br>✅ Honorários 5x maiores<br>✅ Referência regional em 6 meses<br>✅ Autoridade nacional em 1 ano</p><p>---</p><p><strong>🔒 GARANTIA TOTAL HOTMART</strong></p><p>Todos os cursos têm <strong>garantia incondicional de 7 dias</strong>. Se não gostar, a Hotmart devolve 100% do valor. Sem perguntas, sem burocracia.</p><p><strong>👉 <a href=\"https://therapist.university/ads-12-especializacoes-alunos-297/\">APROVEITAR CONDIÇÃO DE ALUNO AGORA</a></strong></p><p>---</p><p><strong>Continue crescendo e se destacando!</strong></p><p>Atenciosamente,<br><strong>Marina L.</strong><br>Diretora Acadêmica<br>Therapist University</p><p><strong>PS:</strong> Você já deu o primeiro passo emitindo seu certificado. Agora é hora de dar o próximo e se tornar um dos profissionais mais qualificados do Brasil. 14 certificações por R$ 297 é uma oportunidade que não se repetirá.</p><p><strong>PPS:</strong> Lembre-se: como aluno, você tem prioridade e preços exclusivos que o público geral NUNCA terá acesso. Use este privilégio sabiamente.</p>"'::jsonb
);

-- 4. AUDITORIA FINAL - Verificar se todas as atualizações foram aplicadas
SELECT 
    'AUDITORIA FINAL - RESULTADOS:' as status,
    COUNT(*) as total_templates,
    COUNT(CASE WHEN form_design->'emailConfig'->>'enabled' = 'true' THEN 1 END) as emails_ativados,
    COUNT(CASE WHEN form_design->'emailConfig'->>'senderName' = 'Certificadora Internacional Therapist' THEN 1 END) as nome_correto,
    COUNT(CASE WHEN form_design->'emailConfig'->>'senderEmail' = 'contact@therapist.international' THEN 1 END) as email_correto,
    COUNT(CASE WHEN form_design->'emailConfig'->>'subject' = 'Parabéns! Seu certificado está pronto!' THEN 1 END) as assunto_correto
FROM certificate_templates;

-- 5. VERIFICAÇÃO DE INTEGRIDADE - Mostrar alguns exemplos
SELECT 
    title,
    form_design->'emailConfig'->>'enabled' as email_ativo,
    form_design->'emailConfig'->>'senderName' as nome_remetente,
    form_design->'emailConfig'->>'senderEmail' as email_remetente,
    form_design->'emailConfig'->>'subject' as assunto,
    LENGTH(form_design->'emailConfig'->>'body') as tamanho_corpo_email
FROM certificate_templates 
LIMIT 5;

COMMIT;

-- RELATÓRIO FINAL
SELECT 
    '✅ CONFIGURAÇÃO COMPLETA!' as resultado,
    'Todos os templates foram atualizados com:' as detalhes,
    '• Toggle de email ATIVADO para todos' as item1,
    '• Nome: Certificadora Internacional Therapist' as item2,
    '• Email: contact@therapist.international' as item3,
    '• Assunto: Parabéns! Seu certificado está pronto!' as item4,
    '• Corpo: HTML completo com oferta promocional' as item5;
