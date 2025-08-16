-- Script para debugar problemas de login
-- Execute no Supabase SQL Editor para verificar usuários

-- Verificar usuários existentes
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at,
  raw_user_meta_data
FROM auth.users 
ORDER BY created_at DESC
LIMIT 10;

-- Verificar configurações de auth
SELECT 
  enable_signup,
  enable_email_confirmations,
  enable_email_change_confirmations
FROM auth.config;

-- Check auth config
SELECT * FROM auth.config WHERE parameter = 'MAILER_AUTOCONFIRM';

-- Se houver usuários com email não confirmado, confirme-os
UPDATE auth.users 
SET email_confirmed_at = NOW(), 
    updated_at = NOW()
WHERE email_confirmed_at IS NULL;

-- Verificar se a atualização funcionou
SELECT 
  email,
  email_confirmed_at,
  created_at
FROM auth.users 
WHERE email_confirmed_at IS NOT NULL
ORDER BY created_at DESC;
