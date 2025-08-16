-- Allow authenticated users to update files in 'generated-certificates'
-- This is necessary for the "edit certificate" functionality to overwrite the old PDF.
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'generated-certificates' );

-- Allow authenticated users to delete files in 'generated-certificates'
-- This is good practice to allow cleanup if needed and supports the update operation.
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'generated-certificates' );
