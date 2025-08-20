-- Radiology Assistant Database Schema
-- Based on Technical Specification Document

-- Organizations (multi-tenant support)
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User profiles with organization relationship  
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT UNIQUE NOT NULL, -- Supabase Auth user ID
  org_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'admin', 'user'
  default_template_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- Report templates with versioning
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  instructions TEXT NOT NULL, -- LLM instructions for report generation
  output_schema TEXT NOT NULL, -- JSON schema for structured output
  retrieval_config TEXT, -- JSON config for RAG settings
  visibility TEXT NOT NULL DEFAULT 'private', -- 'public', 'private', 'org'
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (created_by) REFERENCES profiles(id)
);

-- User-template permissions
CREATE TABLE IF NOT EXISTS user_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  template_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'admin', 'user'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id),
  FOREIGN KEY (template_id) REFERENCES templates(id),
  UNIQUE(user_id, template_id)
);

-- Chat sessions
CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  title TEXT,
  template_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (user_id) REFERENCES profiles(id),
  FOREIGN KEY (template_id) REFERENCES templates(id)
);

-- Chat messages with structured output
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL, -- 'user', 'assistant'
  text TEXT, -- User input text
  transcript_text TEXT, -- Transcribed audio
  attachments_json TEXT, -- JSON array of uploaded files
  rendered_md TEXT, -- Markdown output for display
  json_output TEXT, -- Structured JSON output
  citations_json TEXT, -- JSON array of citations
  pii_detected BOOLEAN DEFAULT FALSE,
  pii_details TEXT, -- JSON details of detected PII
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES chats(id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Knowledge base documents for RAG
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  source_type TEXT NOT NULL, -- 'upload', 'url', 'crawl'
  title TEXT NOT NULL,
  url TEXT, -- Original URL if crawled
  file_path TEXT, -- Storage path for uploaded files
  sha256 TEXT UNIQUE NOT NULL, -- Content hash for deduplication
  mime_type TEXT,
  language TEXT DEFAULT 'en',
  content_length INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- Document chunks for vector search
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  metadata_json TEXT, -- Additional chunk metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doc_id) REFERENCES documents(id),
  UNIQUE(doc_id, chunk_index)
);

-- Vector embeddings (note: actual vector storage may use pgvector or external service)
CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chunk_id INTEGER NOT NULL,
  embedding_text TEXT NOT NULL, -- JSON array of embedding values
  model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chunk_id) REFERENCES chunks(id),
  UNIQUE(chunk_id)
);

-- Subscription plans
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_price_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  monthly_credits INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  overage_per_credit_cents INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Organization subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  plan_id INTEGER NOT NULL,
  status TEXT NOT NULL, -- 'active', 'canceled', 'past_due', etc.
  current_period_start DATETIME NOT NULL,
  current_period_end DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (plan_id) REFERENCES plans(id)
);

-- Credit balance tracking
CREATE TABLE IF NOT EXISTS credit_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  period_start DATETIME NOT NULL,
  period_end DATETIME NOT NULL,
  credits_granted INTEGER NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  UNIQUE(org_id, period_start)
);

-- Usage events for billing
CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  chat_id INTEGER,
  message_id INTEGER,
  event_type TEXT NOT NULL, -- 'tokens_in', 'tokens_out', 'audio_minutes', 'pages'
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  audio_minutes REAL DEFAULT 0,
  pages INTEGER DEFAULT 0,
  credits_charged REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (user_id) REFERENCES profiles(id),
  FOREIGN KEY (chat_id) REFERENCES chats(id),
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_templates_org_id ON templates(org_id);
CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active);
CREATE INDEX IF NOT EXISTS idx_chats_org_id ON chats(org_id);
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON documents(org_id);
CREATE INDEX IF NOT EXISTS idx_documents_active ON documents(is_active);
CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON chunks(doc_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_chunk_id ON embeddings(chunk_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_credit_balances_org_id ON credit_balances(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_org_id ON usage_events(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at);