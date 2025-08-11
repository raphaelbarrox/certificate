-- Add thumbnail_url column to certificate_templates table
ALTER TABLE certificate_templates 
ADD COLUMN thumbnail_url TEXT;

-- Create storage bucket for template thumbnails if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('templates', 'templates', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the templates bucket
CREATE POLICY "Users can upload their own template thumbnails" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'templates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own template thumbnails" ON storage.objects
FOR SELECT USING (bucket_id = 'templates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own template thumbnails" ON storage.objects
FOR UPDATE USING (bucket_id = 'templates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own template thumbnails" ON storage.objects
FOR DELETE USING (bucket_id = 'templates' AND auth.uid()::text = (storage.foldername(name))[1]);
