-- Radiology Assistant Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL, -- Updated to match backend expectations
  role VARCHAR(50) DEFAULT 'user',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  output_schema JSONB DEFAULT '{}', -- Updated to match backend expectations
  retrieval_config JSONB DEFAULT '{}', -- Added for RAG configuration
  created_by INTEGER REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chats table
CREATE TABLE IF NOT EXISTS chats (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id),
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(500) NOT NULL,
  template_id INTEGER REFERENCES templates(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER REFERENCES chats(id),
  user_id INTEGER REFERENCES users(id),
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  text TEXT,
  transcript_text JSONB,
  attachments_json JSONB DEFAULT '[]',
  rendered_md TEXT,
  json_output JSONB,
  citations_json JSONB DEFAULT '[]',
  pii_detected BOOLEAN DEFAULT FALSE,
  pii_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage tracking table (updated column names to match original D1 schema)
CREATE TABLE IF NOT EXISTS usage_tracking (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id),
  user_id INTEGER REFERENCES users(id),
  chat_id INTEGER REFERENCES chats(id), -- Added for compatibility
  message_id INTEGER REFERENCES messages(id),
  event_type VARCHAR(50) DEFAULT 'chat', -- Added for compatibility
  tokens_in INTEGER DEFAULT 0, -- Kept original naming for compatibility
  tokens_out INTEGER DEFAULT 0, -- Kept original naming for compatibility
  audio_minutes FLOAT DEFAULT 0, -- Kept original naming for compatibility
  pages INTEGER DEFAULT 0, -- Added for compatibility
  credits_charged INTEGER DEFAULT 0,
  model_used VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge base tables for RAG functionality
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  file_path VARCHAR(500),
  file_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document chunks for vector search
CREATE TABLE IF NOT EXISTS document_chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id),
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Insert default data
INSERT INTO organizations (id, name, domain) VALUES 
(1, 'Radiology Assistant Demo', 'demo.radiologyassistant.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, org_id, email, full_name, role) VALUES 
(1, 1, 'demo@radiologyassistant.com', 'Demo User', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert default templates
INSERT INTO templates (id, org_id, name, description, system_prompt, output_schema, created_by, is_active) VALUES 
(1, 1, 'Chest X-ray Report', 'Template for chest X-ray radiological reports', 
 'You are an expert radiologist. Generate a professional chest X-ray report based on the clinical information provided. Include sections for patient info, technique, findings, impression, and recommendations.',
 '{"patient_info": {"age": "string", "sex": "string"}, "clinical_history": "string", "technique": "string", "findings": {"heart": "string", "lungs": "string", "pleura": "string", "bones": "string"}, "impression": "string", "recommendations": "string"}', 1, true),
(2, 1, 'CT Head Report', 'Template for CT head scan reports',
 'You are an expert radiologist. Generate a professional CT head report based on the clinical information provided.',
 '{"patient_info": {"age": "string", "sex": "string"}, "clinical_history": "string", "technique": "string", "findings": "string", "impression": "string", "recommendations": "string"}', 1, true),
(3, 1, 'Abdominal X-ray Report', 'Template for abdominal X-ray reports',
 'You are an expert radiologist. Generate a professional abdominal X-ray report based on the clinical information provided.',
 '{"patient_info": {"age": "string", "sex": "string"}, "clinical_history": "string", "technique": "string", "findings": "string", "impression": "string", "recommendations": "string"}', 1, true)
ON CONFLICT (id) DO NOTHING;

-- Create Row Level Security policies (optional - for multi-tenant setup)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Basic policies (can be customized based on authentication needs)
CREATE POLICY "Enable all access for demo" ON organizations FOR ALL USING (true);
CREATE POLICY "Enable all access for demo" ON users FOR ALL USING (true);
CREATE POLICY "Enable all access for demo" ON templates FOR ALL USING (true);
CREATE POLICY "Enable all access for demo" ON chats FOR ALL USING (true);
CREATE POLICY "Enable all access for demo" ON messages FOR ALL USING (true);
CREATE POLICY "Enable all access for demo" ON usage_tracking FOR ALL USING (true);
CREATE POLICY "Enable all access for demo" ON documents FOR ALL USING (true);
CREATE POLICY "Enable all access for demo" ON document_chunks FOR ALL USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Success message
DO $$ BEGIN
  RAISE NOTICE 'Radiology Assistant database schema created successfully!';
  RAISE NOTICE 'Tables: organizations, users, templates, chats, messages, usage_tracking, documents, document_chunks';
  RAISE NOTICE 'Vector search enabled for RAG functionality';
END $$;