-- DESABILITAR CONFIRMAÇÃO DE EMAIL PARA DESENVOLVIMENTO
-- Execute este script no Supabase SQL Editor

-- Desabilitar confirmação de email
UPDATE auth.config SET enable_email_confirmations = false;

-- Verificar se a configuração foi aplicada
SELECT 
  enable_signup,
  enable_email_confirmations,
  enable_email_change_confirmations
FROM auth.config;

-- Confirmar automaticamente usuários existentes que estão pendentes (opcional)
UPDATE auth.users 
SET email_confirmed_at = NOW(), 
    updated_at = NOW()
WHERE email_confirmed_at IS NULL;

-- Additional auth configuration
ALTER TABLE auth.users ALTER COLUMN email_confirmed_at SET DEFAULT NOW();
