-- Adiciona uma coluna para armazenar a URL pública do certificado em PDF gerado
ALTER TABLE public.issued_certificates
ADD COLUMN IF NOT EXISTS pdf_url TEXT;
