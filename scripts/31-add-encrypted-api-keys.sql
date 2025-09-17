-- Criando tabela segura para armazenar API keys criptografadas
CREATE TABLE IF NOT EXISTS email_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('resend', 'smtp')),
  encrypted_key TEXT NOT NULL,
  key_hash VARCHAR(64) NOT NULL, -- Para identificar a chave sem descriptografar
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, provider, key_hash)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_email_api_keys_user_provider ON email_api_keys(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_email_api_keys_active ON email_api_keys(is_active) WHERE is_active = true;

-- RLS para segurança
ALTER TABLE email_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own API keys" ON email_api_keys
  FOR ALL USING (auth.uid() = user_id);

-- Função para criptografar chaves (usando pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Função para hash da chave (para identificação)
CREATE OR REPLACE FUNCTION hash_api_key(key_text TEXT)
RETURNS VARCHAR(64) AS $$
BEGIN
  RETURN encode(digest(key_text, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;
