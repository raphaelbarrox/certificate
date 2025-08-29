-- CONFIGURAÇÃO DE EMAIL NO SUPABASE
-- Execute estes passos no painel do Supabase:

-- 1. Vá para Authentication > Settings
-- 2. Em "Email Auth", certifique-se que:
--    - "Enable email confirmations" está MARCADO (habilitado)
--    - "Enable email change confirmations" está marcado
--    - "Enable secure email change" está marcado

-- 3. Configure o provedor de email:
--    - Vá para Authentication > Settings > SMTP Settings
--    - Configure um provedor de email (Gmail, SendGrid, etc.)
--    - Ou use o provedor padrão do Supabase (limitado)

-- 4. Configure os templates de email:
--    - Vá para Authentication > Email Templates
--    - Personalize o template "Confirm signup"

-- 5. Configure a URL de redirecionamento:
--    - Em Authentication > URL Configuration
--    - Site URL: http://localhost:3000 (desenvolvimento)
--    - Redirect URLs: http://localhost:3000/auth/callback

-- ALTERNATIVA: Para desenvolvimento, você pode desabilitar confirmação de email
-- Execute apenas se quiser pular a verificação de email:
UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;
INSERT INTO auth.config (parameter, value) 
VALUES ('MAILER_AUTOCONFIRM', 'true')
ON CONFLICT (parameter) DO UPDATE SET value = 'true';

-- Para verificar as configurações atuais:
SELECT * FROM auth.config;
