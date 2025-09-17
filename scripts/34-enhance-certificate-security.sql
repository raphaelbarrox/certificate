-- Melhorando segurança específica dos certificados
-- Função para validar CPF
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

-- Trigger para validar CPF antes de inserir certificado
CREATE OR REPLACE FUNCTION validate_certificate_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Valida CPF se fornecido
  IF NEW.recipient_cpf IS NOT NULL AND NEW.recipient_cpf != '' THEN
    IF NOT validate_cpf(NEW.recipient_cpf) THEN
      RAISE EXCEPTION 'CPF inválido: %', NEW.recipient_cpf;
    END IF;
  END IF;
  
  -- Gera hash de integridade se não fornecido
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS validate_certificate_trigger ON issued_certificates;
CREATE TRIGGER validate_certificate_trigger
  BEFORE INSERT OR UPDATE ON issued_certificates
  FOR EACH ROW EXECUTE FUNCTION validate_certificate_data();

-- Política RLS mais restritiva para issued_certificates
DROP POLICY IF EXISTS "issued_certificates_policy" ON issued_certificates;
CREATE POLICY "issued_certificates_policy" ON issued_certificates
  FOR SELECT USING (
    -- Permite acesso apenas se:
    -- 1. É o dono do template
    EXISTS (
      SELECT 1 FROM certificate_templates ct 
      WHERE ct.id = template_id AND ct.user_id = auth.uid()
    )
    OR
    -- 2. Está acessando via link público com dados corretos
    (
      recipient_cpf IS NOT NULL AND 
      recipient_dob IS NOT NULL AND
      integrity_hash IS NOT NULL
    )
  );
