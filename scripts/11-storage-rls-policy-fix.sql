-- Este script corrige o erro "row-level security policy" para o Supabase Storage.
-- Versão revisada para evitar o erro de permissão "must be owner of table objects".

-- A segurança a nível de linha (RLS) já deve estar ativa por padrão na tabela storage.objects.
-- Portanto, vamos diretamente criar as políticas de acesso necessárias.

-- 1. Cria uma política para permitir que qualquer pessoa (anônima ou autenticada)
-- faça UPLOAD (INSERT) de arquivos no bucket 'generated-certificates'.
-- Isto é necessário para que a geração pública de certificados consiga salvar o PDF.
CREATE POLICY "Permitir uploads públicos para generated-certificates"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK ( bucket_id = 'generated-certificates' );

-- 2. Cria uma política para permitir que qualquer pessoa (anônima ou autenticada)
-- visualize e baixe (SELECT) os arquivos no bucket 'generated-certificates'.
-- Isto é crucial para que os links de download dos PDFs funcionem publicamente.
CREATE POLICY "Permitir acesso público a generated-certificates"
ON storage.objects FOR SELECT
TO anon, authenticated
USING ( bucket_id = 'generated-certificates' );
