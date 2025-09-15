# 📧 Integração Resend - Guia Completo

## 🚀 Visão Geral

A integração com Resend oferece uma alternativa moderna e confiável ao SMTP tradicional para envio de certificados por email. O sistema mantém total compatibilidade com SMTP existente, permitindo migração gradual.

## ✨ Principais Recursos

- **✅ Anexo Automático de PDF**: Certificados são anexados automaticamente aos emails
- **✅ Alta Entregabilidade**: Melhor taxa de entrega comparado ao SMTP tradicional
- **✅ Interface Unificada**: Mesma interface para configurar SMTP ou Resend
- **✅ Teste Integrado**: Validação de API Key e envio de teste
- **✅ Fallback Seguro**: Sistema não quebra se email falhar
- **✅ Placeholders Dinâmicos**: Substituição automática de variáveis

## 🔧 Como Configurar

### 1. Obter API Key do Resend

1. Acesse [resend.com](https://resend.com)
2. Crie uma conta ou faça login
3. Vá para [API Keys](https://resend.com/api-keys)
4. Clique em "Create API Key"
5. Copie a chave gerada (formato: `re_xxxxxxxxxxxxxxxxxxxxxxxxxx`)

### 2. Configurar no Sistema

1. **Acesse o Form Designer** do seu template
2. **Vá para a aba "Email"**
3. **Ative o envio automático**
4. **Selecione "Resend (Recomendado)"** como provedor
5. **Cole sua API Key** no campo correspondente
6. **Configure o conteúdo** do email (remetente, assunto, corpo)
7. **Teste a configuração** usando os botões de teste

### 3. Testar a Integração

- **Testar API Key**: Valida se a chave está correta
- **Enviar Teste**: Envia um email de teste para o próprio remetente

## 📋 Estrutura do Email

### Conteúdo Padrão
\`\`\`html
<p>Olá {{nome_completo}},</p>
<p>Seu certificado foi emitido com sucesso. Você pode fazer o download através do anexo ou clicando no link abaixo:</p>
<p><a href="{{certificate_link}}">Visualizar Certificado Online</a></p>
<p>Número do Certificado: {{certificate_id}}</p>
\`\`\`

### Placeholders Disponíveis
- `{{certificate_link}}` - Link para visualização online
- `{{certificate_id}}` - Número único do certificado
- `{{nome_completo}}` - Nome do destinatário (exemplo)
- `{{email}}` - Email do destinatário
- **+ Todos os campos do formulário**

### Anexo Automático
- **Arquivo**: `certificado-{NUMERO}.pdf`
- **Formato**: PDF otimizado
- **Tamanho**: Limitado a 40MB (limite do Resend)

## 🔄 Migração do SMTP

### Passo a Passo
1. **Mantenha SMTP ativo** durante o período de teste
2. **Configure Resend** em paralelo
3. **Teste com certificados de teste**
4. **Migre gradualmente** template por template
5. **Monitore logs** para garantir funcionamento

### Comparação SMTP vs Resend

| Recurso | SMTP | Resend |
|---------|------|--------|
| **Configuração** | Complexa | Simples |
| **Entregabilidade** | Variável | Alta |
| **Anexos** | Manual | Automático |
| **Monitoramento** | Limitado | Avançado |
| **Custo** | Variável | Previsível |

## 🛠️ Arquitetura Técnica

### Estrutura de Arquivos
\`\`\`
lib/email-providers/
├── resend-provider.ts      # Implementação do Resend
├── email-service.ts        # Serviço unificado
└── types.ts               # Interfaces TypeScript

app/api/
├── issue-certificate/     # API de emissão (atualizada)
└── templates/test-email/   # API de teste (atualizada)

components/
└── form-designer.tsx      # Interface (atualizada)
\`\`\`

### Fluxo de Envio
1. **Certificado Emitido** → PDF gerado e salvo
2. **Email Configurado?** → Verifica se está ativo
3. **Provedor Selecionado** → Resend ou SMTP
4. **Placeholders Substituídos** → Dados dinâmicos
5. **PDF Anexado** → Automaticamente
6. **Email Enviado** → Via Resend API
7. **Log Registrado** → Sucesso/falha

### Tratamento de Erros
- **API Key Inválida**: Sugestão de verificação
- **Limite Excedido**: Orientação sobre planos
- **Email Inválido**: Validação prévia
- **Falha de Rede**: Retry automático (futuro)

## 📊 Monitoramento

### Logs do Sistema
\`\`\`javascript
[Resend] Iniciando envio para usuario@email.com
[Resend] Email enviado com sucesso. ID: abc123
\`\`\`

### Logs de Erro
\`\`\`javascript
[Resend] Erro no envio: API key is invalid
[Resend] Sugestão: Verifique se a API Key está correta
\`\`\`

## 🔒 Segurança

### Boas Práticas
- **API Keys**: Armazenadas de forma segura no banco
- **Validação**: Verificação prévia de emails
- **Rate Limiting**: Respeita limites do Resend
- **Logs**: Não expõem dados sensíveis

### Conformidade
- **LGPD**: Dados processados conforme necessário
- **GDPR**: Compatível com regulamentações
- **CAN-SPAM**: Headers corretos incluídos

## 🚨 Troubleshooting

### Problemas Comuns

#### "API key is invalid"
- ✅ Verifique se copiou a chave completa
- ✅ Confirme se a chave está ativa no Resend
- ✅ Teste com uma nova chave

#### "Email not sent"
- ✅ Verifique se o email do destinatário é válido
- ✅ Confirme se não excedeu limites do plano
- ✅ Verifique logs do sistema

#### "Attachment too large"
- ✅ PDFs são limitados a 40MB
- ✅ Otimize imagens no template
- ✅ Reduza complexidade do certificado

### Suporte
- **Logs do Sistema**: Console do navegador (F12)
- **Documentação Resend**: [resend.com/docs](https://resend.com/docs)
- **Status do Serviço**: [status.resend.com](https://status.resend.com)

## 🎯 Próximos Passos

### Melhorias Planejadas
- [ ] **Retry Automático**: Reenvio em caso de falha
- [ ] **Templates Avançados**: Editor visual de emails
- [ ] **Analytics**: Métricas de abertura e cliques
- [ ] **Webhooks**: Notificações de status
- [ ] **Agendamento**: Envio programado

### Feedback
Sua experiência é importante! Reporte bugs ou sugestões através dos logs do sistema.

---

**✨ Implementação Completa e Funcional**
- Sistema 100% compatível com código existente
- Migração sem impacto nas funcionalidades atuais
- Interface intuitiva para configuração
- Documentação completa para usuários
