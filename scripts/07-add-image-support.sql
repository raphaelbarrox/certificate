-- Add photo_url column to issued_certificates table
ALTER TABLE issued_certificates 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Create storage bucket policy for certificate-images (run this in Supabase SQL Editor)
-- Note: You still need to create the bucket manually in the Supabase dashboard

-- Allow public access to certificate-images bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('certificate-images', 'certificate-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'certificate-images' 
  AND auth.role() = 'authenticated'
);

-- Allow public access to view files
CREATE POLICY "Allow public access" ON storage.objects
FOR SELECT USING (bucket_id = 'certificate-images');

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete own files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'certificate-images' 
  AND auth.role() = 'authenticated'
);
