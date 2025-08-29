-- Este script corrige o erro de RLS ao editar certificados via link público.
-- O problema é que usuários anônimos (que editam via link público) precisam
-- poder fazer UPDATE nos arquivos do storage para substituir o PDF antigo.

-- Remove a política anterior que só permitia UPDATE para usuários autenticados
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;

-- Cria uma nova política que permite UPDATE tanto para usuários anônimos quanto autenticados
-- no bucket 'generated-certificates'. Isso é necessário para a funcionalidade de edição
-- de certificados via link público funcionar corretamente.
CREATE POLICY "Allow public updates for generated-certificates"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING ( bucket_id = 'generated-certificates' );

-- Também atualiza a política de DELETE para incluir usuários anônimos
-- (caso seja necessário para limpeza de arquivos antigos)
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

CREATE POLICY "Allow public deletes for generated-certificates"
ON storage.objects FOR DELETE
TO anon, authenticated
USING ( bucket_id = 'generated-certificates' );
