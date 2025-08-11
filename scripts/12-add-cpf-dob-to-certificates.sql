ALTER TABLE issued_certificates
ADD COLUMN recipient_cpf TEXT,
ADD COLUMN recipient_dob DATE;

-- Opcional: Adiciona um índice para acelerar as buscas por CPF e Data de Nascimento.
-- Isso torna a verificação inicial mais rápida.
CREATE INDEX IF NOT EXISTS idx_issued_certificates_cpf_dob ON issued_certificates (recipient_cpf, recipient_dob);
