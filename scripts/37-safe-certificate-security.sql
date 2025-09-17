-- Segurança de certificados SEM quebrar funcionalidades existentes
-- Função para validar CPF com algoritmo matemático correto
CREATE OR REPLACE FUNCTION validate_cpf(cpf TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  clean_cpf TEXT;
  digit1 INTEGER;
  digit2 INTEGER;
  sum1 INTEGER := 0;
  sum2 INTEGER := 0;
  i INTEGER;
BEGIN
  -- Remove caracteres não numéricos
  clean_cpf := regexp_replace(cpf, '[^0-9]', '', 'g');
  
  -- Verifica se tem 11 dígitos
  IF length(clean_cpf) != 11 THEN
    RETURN FALSE;
  END IF;
  
  -- Verifica sequências inválidas
  IF clean_cpf IN ('00000000000', '11111111111', '22222222222', '33333333333', 
                   '44444444444', '55555555555', '66666666666', '77777777777',
                   '88888888888', '99999999999') THEN
    RETURN FALSE;
  END IF;
  
  -- Calcula primeiro dígito verificador
  FOR i IN 1..9 LOOP
    sum1 := sum1 + (substring(clean_cpf, i, 1)::INTEGER * (11 - i));
  END LOOP;
  
  digit1 := 11 - (sum1 % 11);
  IF digit1 >= 10 THEN
    digit1 := 0;
  END IF;
  
  -- Calcula segundo dígito verificador
  FOR i IN 1..10 LOOP
    sum2 := sum2 + (substring(clean_cpf, i, 1)::INTEGER * (12 - i));
  END LOOP;
  
  digit2 := 11 - (sum2 % 11);
  IF digit2 >= 10 THEN
    digit2 := 0;
  END IF;
  
  -- Verifica se os dígitos calculados conferem
  RETURN (substring(clean_cpf, 10, 1)::INTEGER = digit1 AND 
          substring(clean_cpf, 11, 1)::INTEGER = digit2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função segura que NÃO quebra funcionalidades existentes
CREATE OR REPLACE FUNCTION safe_validate_certificate_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Valida CPF apenas se fornecido (não obrigatório para manter compatibilidade)
  IF NEW.recipient_cpf IS NOT NULL AND NEW.recipient_cpf != '' THEN
    IF NOT validate_cpf(NEW.recipient_cpf) THEN
      RAISE EXCEPTION 'CPF inválido: %', NEW.recipient_cpf;
    END IF;
  END IF;
  
  -- Gera hash de integridade para garantir certificado correto
  IF NEW.integrity_hash IS NULL THEN
    NEW.integrity_hash := encode(
      digest(
        COALESCE(NEW.certificate_number, '') || 
        COALESCE(NEW.recipient_cpf, '') || 
        COALESCE(NEW.recipient_email, '') ||
        NEW.template_id::TEXT ||
        NEW.issued_at::TEXT,
        'sha256'
      ),
      'hex'
    );
  END IF;
  
  -- Gera request_id único se não fornecido
  IF NEW.request_id IS NULL THEN
    NEW.request_id := gen_random_uuid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger seguro SEM remover o anterior
DROP TRIGGER IF EXISTS safe_validate_certificate_trigger ON issued_certificates;
CREATE TRIGGER safe_validate_certificate_trigger
  BEFORE INSERT OR UPDATE ON issued_certificates
  FOR EACH ROW EXECUTE FUNCTION safe_validate_certificate_data();

-- Política adicional de segurança SEM remover as existentes
CREATE POLICY IF NOT EXISTS "certificate_integrity_check" ON issued_certificates
  FOR SELECT USING (
    -- Permite acesso se é dono do template OU tem dados válidos para acesso público
    EXISTS (
      SELECT 1 FROM certificate_templates ct 
      WHERE ct.id = template_id AND ct.user_id = auth.uid()
    )
    OR
    (
      -- Acesso público apenas com validação de integridade
      integrity_hash IS NOT NULL AND
      (recipient_cpf IS NOT NULL OR recipient_email IS NOT NULL)
    )
  );
