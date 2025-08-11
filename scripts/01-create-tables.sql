-- Create users table (if not exists)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create certificate_templates table
CREATE TABLE IF NOT EXISTS certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  template_data JSONB NOT NULL DEFAULT '{}',
  placeholders JSONB NOT NULL DEFAULT '[]',
  form_design JSONB DEFAULT '{}',
  thumbnail TEXT,
  public_link_id VARCHAR(255) UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create issued_certificates table
CREATE TABLE IF NOT EXISTS issued_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES certificate_templates(id) ON DELETE CASCADE,
  certificate_number VARCHAR(255) UNIQUE NOT NULL,
  recipient_data JSONB NOT NULL DEFAULT '{}',
  recipient_email VARCHAR(255),
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_certificate_templates_user_id ON certificate_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificate_templates_public_link_id ON certificate_templates(public_link_id);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_template_id ON issued_certificates(template_id);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_certificate_number ON issued_certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_recipient_email ON issued_certificates(recipient_email);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE certificate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE issued_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own templates" ON certificate_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own templates" ON certificate_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" ON certificate_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" ON certificate_templates
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view certificates from their templates" ON issued_certificates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM certificate_templates 
      WHERE certificate_templates.id = issued_certificates.template_id 
      AND certificate_templates.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert certificates" ON issued_certificates
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own folders" ON folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders" ON folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders" ON folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders" ON folders
  FOR DELETE USING (auth.uid() = user_id);
