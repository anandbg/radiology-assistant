// Hybrid Architecture Types for Radiology Assistant

import { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import Stripe from 'stripe'

// Cloudflare Environment Bindings
export interface Bindings {
  // Cloudflare Services
  DB: D1Database              // D1 for metadata and relational data
  BUCKET: R2Bucket           // R2 for file storage
  
  // Environment Variables
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  OPENAI_API_KEY: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  APP_URL: string
  JWT_SECRET: string
  ENVIRONMENT: string
}

// Database Models (D1)
export interface Organization {
  id: number
  name: string
  slug: string
  stripe_customer_id?: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: number
  user_id: string              // Supabase Auth user ID
  org_id: number
  email: string
  name: string
  role: 'admin' | 'user'
  default_template_id?: number
  created_at: string
  updated_at: string
}

export interface Template {
  id: number
  org_id: number
  name: string
  version: number
  instructions: string
  output_schema: string        // JSON schema
  retrieval_config?: string    // RAG configuration
  visibility: 'public' | 'private' | 'org'
  is_active: boolean
  created_by: number
  created_at: string
  updated_at: string
}

export interface Chat {
  id: number
  org_id: number
  user_id: number
  title?: string
  template_id?: number
  created_at: string
  updated_at: string
}

export interface Message {
  id: number
  chat_id: number
  user_id: number
  role: 'user' | 'assistant'
  text?: string
  transcript_text?: string
  attachments_json?: string
  rendered_md?: string
  json_output?: string
  citations_json?: string
  pii_detected: boolean
  pii_details?: string
  created_at: string
}

// Vector DB Models (Supabase)
export interface DocumentVector {
  id: string
  org_id: number
  title: string
  content: string
  metadata: Record<string, any>
  embedding: number[]
  created_at: string
}

export interface ChunkVector {
  id: string
  doc_id: string
  chunk_index: number
  text: string
  embedding: number[]
  metadata: Record<string, any>
  created_at: string
}

// API Request/Response Types
export interface AuthRequest {
  email: string
  password?: string
  provider?: 'google' | 'github'
}

export interface ChatCreateRequest {
  title?: string
  template_id?: number
}

export interface MessageRequest {
  text?: string
  transcript_text?: string
  attachments?: FileAttachment[]
  template_id?: number
}

export interface FileAttachment {
  name: string
  type: string
  size: number
  url?: string
  r2_key?: string
}

export interface MessageResponse {
  user_message_id: number
  assistant_message_id: number
  response: {
    json_output: string
    rendered_md: string
    citations: Citation[]
  }
}

export interface Citation {
  source: string
  title: string
  url?: string
  excerpt: string
  relevance_score: number
}

// RAG System Types
export interface RAGQuery {
  query: string
  template_id?: number
  max_chunks?: number
  similarity_threshold?: number
}

export interface RAGResult {
  chunks: RetrievedChunk[]
  sources: string[]
}

export interface RetrievedChunk {
  id: string
  text: string
  metadata: Record<string, any>
  similarity_score: number
  source: string
}

// LLM Integration Types
export interface LLMRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  template: Template
  context_chunks?: RetrievedChunk[]
  max_tokens?: number
  temperature?: number
}

export interface LLMResponse {
  content: string
  structured_output?: Record<string, any>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// PII Detection Types
export interface PIIResult {
  detected: boolean
  entities: PIIEntity[]
  sanitized_text?: string
}

export interface PIIEntity {
  type: 'nhs_number' | 'postcode' | 'phone' | 'email' | 'name' | 'address' | 'dob'
  value: string
  start: number
  end: number
  confidence: number
}

// Billing Types
export interface SubscriptionPlan {
  id: number
  stripe_price_id: string
  name: string
  description?: string
  monthly_credits: number
  price_cents: number
  overage_per_credit_cents?: number
  is_active: boolean
}

export interface UsageEvent {
  id: number
  org_id: number
  user_id: number
  chat_id?: number
  message_id?: number
  event_type: 'tokens_in' | 'tokens_out' | 'audio_minutes' | 'pages'
  tokens_in?: number
  tokens_out?: number
  audio_minutes?: number
  pages?: number
  credits_charged: number
  created_at: string
}

// Service Client Types
export interface ServiceClients {
  supabase: SupabaseClient
  openai: OpenAI
  stripe: Stripe
}

// Hybrid Architecture Context
export interface HybridContext {
  bindings: Bindings
  clients: ServiceClients
  user?: Profile
  organization?: Organization
}

// Configuration Types
export interface AppConfig {
  features: {
    pii_detection: boolean
    voice_recording: boolean
    file_uploads: boolean
    rag_enabled: boolean
    billing_enabled: boolean
  }
  limits: {
    max_file_size: number
    max_audio_duration: number
    max_message_length: number
    max_context_chunks: number
  }
  models: {
    llm: string
    embedding: string
    whisper: string
  }
}

// Error Types
export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
}

export interface PIIError extends ApiError {
  code: 'PII_DETECTED'
  detected_entities: PIIEntity[]
}

export interface CreditError extends ApiError {
  code: 'INSUFFICIENT_CREDITS'
  required_credits: number
  available_credits: number
}

// Utility Types
export type AsyncResult<T> = Promise<{ data: T; error?: never } | { data?: never; error: ApiError }>

export type DatabaseProvider = 'cloudflare-d1' | 'supabase-postgres'
export type VectorProvider = 'supabase-pgvector' | 'pinecone' | 'weaviate'
export type LLMProvider = 'openai' | 'anthropic' | 'azure-openai'
export type AuthProvider = 'supabase' | 'clerk' | 'auth0'