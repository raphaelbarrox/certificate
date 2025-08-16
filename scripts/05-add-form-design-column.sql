-- Add form_design column to certificate_templates if it doesn't exist
ALTER TABLE certificate_templates 
ADD COLUMN IF NOT EXISTS form_design JSONB DEFAULT '{}';

-- Update existing templates with empty form design
UPDATE certificate_templates 
SET form_design = '{"fields": []}' 
WHERE form_design IS NULL OR form_design = '{}';
