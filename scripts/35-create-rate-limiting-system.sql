-- Sistema de rate limiting no banco de dados
-- Tabela para controle de rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier VARCHAR(255) NOT NULL, -- IP ou user_id
  endpoint VARCHAR(100) NOT NULL,
  requests_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_identifier_endpoint 
ON rate_limits(identifier, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

-- Função para verificar rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier VARCHAR(255),
  p_endpoint VARCHAR(100),
  p_max_requests INTEGER DEFAULT 10,
  p_window_minutes INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  window_start TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Define o início da janela de tempo
  window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Limpa registros antigos
  DELETE FROM rate_limits 
  WHERE window_start < NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Verifica se existe registro para este identificador/endpoint
  SELECT requests_count INTO current_count
  FROM rate_limits
  WHERE identifier = p_identifier 
    AND endpoint = p_endpoint
    AND window_start > NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  
  IF current_count IS NULL THEN
    -- Primeiro request na janela
    INSERT INTO rate_limits (identifier, endpoint, requests_count, window_start)
    VALUES (p_identifier, p_endpoint, 1, NOW())
    ON CONFLICT (identifier, endpoint) 
    DO UPDATE SET 
      requests_count = 1,
      window_start = NOW(),
      updated_at = NOW();
    RETURN TRUE;
  ELSIF current_count < p_max_requests THEN
    -- Incrementa contador
    UPDATE rate_limits 
    SET requests_count = requests_count + 1,
        updated_at = NOW()
    WHERE identifier = p_identifier AND endpoint = p_endpoint;
    RETURN TRUE;
  ELSE
    -- Rate limit excedido
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Política RLS para rate_limits
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limits_service_only" ON rate_limits
  FOR ALL USING (false); -- Apenas via service role
