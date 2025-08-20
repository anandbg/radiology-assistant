-- Seed data for development
-- Insert default organization
INSERT OR IGNORE INTO organizations (id, name, slug, created_at) VALUES 
  (1, 'Demo Hospital', 'demo-hospital', CURRENT_TIMESTAMP);

-- Insert default subscription plans
INSERT OR IGNORE INTO plans (id, stripe_price_id, name, description, monthly_credits, price_cents, overage_per_credit_cents) VALUES 
  (1, 'price_basic', 'Basic Plan', 'Perfect for individual radiographers', 1000, 2900, 3),
  (2, 'price_pro', 'Pro Plan', 'For busy radiology departments', 5000, 12900, 2),
  (3, 'price_team', 'Team Plan', 'For large hospitals and clinics', 20000, 39900, 1);

-- Insert demo user profile
INSERT OR IGNORE INTO profiles (id, user_id, org_id, email, name, role, created_at) VALUES 
  (1, 'demo-user-123', 1, 'demo@demohospital.com', 'Dr. Sarah Wilson', 'admin', CURRENT_TIMESTAMP);

-- Insert default report templates
INSERT OR IGNORE INTO templates (id, org_id, name, version, instructions, output_schema, retrieval_config, visibility, created_by, created_at) VALUES 
  (1, 1, 'Chest X-ray Report', 1, 
   'Generate a structured chest X-ray report based on the provided clinical information and imaging findings. Include impression, findings, and recommendations following standard radiological format.',
   '{"type": "object", "properties": {"patient_info": {"type": "object", "properties": {"age": {"type": "string"}, "sex": {"type": "string"}}}, "clinical_history": {"type": "string"}, "technique": {"type": "string"}, "findings": {"type": "object", "properties": {"heart": {"type": "string"}, "lungs": {"type": "string"}, "pleura": {"type": "string"}, "bones": {"type": "string"}}}, "impression": {"type": "string"}, "recommendations": {"type": "string"}}}',
   '{"enabled": true, "sources": ["nice_guidelines", "chest_xray_atlas"], "max_chunks": 5}',
   'org', 1, CURRENT_TIMESTAMP),
   
  (2, 1, 'CT Head Report', 1,
   'Generate a structured CT head report based on clinical information and imaging findings. Follow standard neuroimaging reporting format with systematic review of brain structures.',
   '{"type": "object", "properties": {"patient_info": {"type": "object", "properties": {"age": {"type": "string"}, "sex": {"type": "string"}}}, "clinical_history": {"type": "string"}, "technique": {"type": "string"}, "findings": {"type": "object", "properties": {"brain_parenchyma": {"type": "string"}, "ventricles": {"type": "string"}, "cisterns": {"type": "string"}, "skull": {"type": "string"}}}, "impression": {"type": "string"}, "recommendations": {"type": "string"}}}',
   '{"enabled": true, "sources": ["nice_guidelines", "ct_head_protocols"], "max_chunks": 5}',
   'org', 1, CURRENT_TIMESTAMP),
   
  (3, 1, 'Abdominal X-ray Report', 1,
   'Generate a structured abdominal X-ray report based on clinical presentation and imaging findings. Include systematic review of bowel gas pattern, organ shadows, and bone structures.',
   '{"type": "object", "properties": {"patient_info": {"type": "object", "properties": {"age": {"type": "string"}, "sex": {"type": "string"}}}, "clinical_history": {"type": "string"}, "technique": {"type": "string"}, "findings": {"type": "object", "properties": {"bowel_gas": {"type": "string"}, "organ_shadows": {"type": "string"}, "bones": {"type": "string"}, "soft_tissues": {"type": "string"}}}, "impression": {"type": "string"}, "recommendations": {"type": "string"}}}',
   '{"enabled": true, "sources": ["nice_guidelines", "abdominal_imaging"], "max_chunks": 5}',
   'org', 1, CURRENT_TIMESTAMP);

-- Insert user-template permissions
INSERT OR IGNORE INTO user_templates (user_id, template_id, role) VALUES 
  (1, 1, 'admin'),
  (1, 2, 'admin'),
  (1, 3, 'admin');

-- Set default template for demo user
UPDATE profiles SET default_template_id = 1 WHERE id = 1;

-- Insert sample knowledge documents
INSERT OR IGNORE INTO documents (id, org_id, source_type, title, url, sha256, mime_type, language, content_length, created_at) VALUES 
  (1, 1, 'url', 'NICE Guidelines - Chest X-ray Interpretation', 'https://www.nice.org.uk/guidance/chest-xray', 'abc123hash', 'text/html', 'en', 15000, CURRENT_TIMESTAMP),
  (2, 1, 'url', 'RCR Guidelines - CT Head Imaging', 'https://www.rcr.ac.uk/ct-head-guidelines', 'def456hash', 'text/html', 'en', 12000, CURRENT_TIMESTAMP);

-- Insert sample document chunks
INSERT OR IGNORE INTO chunks (id, doc_id, chunk_index, text, token_count, metadata_json) VALUES 
  (1, 1, 0, 'Chest X-ray interpretation should follow a systematic approach: First assess image quality and patient positioning...', 250, '{"section": "introduction", "page": 1}'),
  (2, 1, 1, 'Heart size assessment: The cardiothoracic ratio should be measured on a well-centered PA chest radiograph...', 280, '{"section": "cardiac_assessment", "page": 2}'),
  (3, 2, 0, 'CT head examination indications include acute trauma, suspected intracranial pathology, and neurological deficit assessment...', 300, '{"section": "indications", "page": 1}');

-- Insert sample credit balance for demo organization
INSERT OR IGNORE INTO credit_balances (org_id, period_start, period_end, credits_granted, credits_used) VALUES 
  (1, '2024-01-01 00:00:00', '2024-01-31 23:59:59', 1000, 150);