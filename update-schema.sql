-- Add template_instructions column to templates table
ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS template_instructions JSONB DEFAULT '{}';

-- Update the existing templates to include template_instructions
UPDATE templates 
SET template_instructions = '{"general_rules": ["Follow template format exactly", "Convert phrases to sentences"], "template_format": "Standard report format"}'
WHERE template_instructions IS NULL OR template_instructions = '{}';