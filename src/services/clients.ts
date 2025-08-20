// Hybrid Architecture Service Clients
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import Stripe from 'stripe'
import type { Bindings } from '../types'

export interface ServiceClients {
  supabase: any
  openai: any
  stripe: any
}

export function createServiceClients(env: Bindings): ServiceClients | null {
  try {
    // Check if required environment variables are present
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('Supabase environment variables not configured - running in local mode')
      return null
    }

    // Supabase Client for Auth and Vector DB
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY, // Use service role for server-side operations
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // OpenAI Client for LLM, Whisper, and Embeddings (optional for demo)
    let openai = null
    if (env.OPENAI_API_KEY) {
      openai = new OpenAI({
        apiKey: env.OPENAI_API_KEY
      })
    }

    // Stripe Client for Billing (optional for demo)
    let stripe = null
    if (env.STRIPE_SECRET_KEY) {
      stripe = new Stripe(env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-06-20' // Latest API version
      })
    }

    return {
      supabase,
      openai,
      stripe
    }
  } catch (error) {
    console.error('Error creating service clients:', error)
    return null
  }
}

// Supabase Database Schema (PostgreSQL + pgvector)
export const SUPABASE_SCHEMA = {
  // Document vectors table for RAG
  document_vectors: `
    CREATE TABLE IF NOT EXISTS document_vectors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      embedding vector(1536), -- OpenAI text-embedding-3-small dimensions
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Enable RLS
    ALTER TABLE document_vectors ENABLE ROW LEVEL SECURITY;

    -- Create policies for multi-tenant access
    CREATE POLICY "Users can access their org's documents" ON document_vectors
      FOR ALL USING (org_id IN (
        SELECT org_id FROM profiles WHERE user_id = auth.uid()
      ));

    -- Create index for vector similarity search
    CREATE INDEX IF NOT EXISTS document_vectors_embedding_idx ON document_vectors 
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

    -- Create index for metadata queries
    CREATE INDEX IF NOT EXISTS document_vectors_org_id_idx ON document_vectors (org_id);
    CREATE INDEX IF NOT EXISTS document_vectors_metadata_idx ON document_vectors USING GIN (metadata);
  `,

  // Chunk vectors table for granular RAG
  chunk_vectors: `
    CREATE TABLE IF NOT EXISTS chunk_vectors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      doc_id UUID NOT NULL REFERENCES document_vectors(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      embedding vector(1536),
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Enable RLS
    ALTER TABLE chunk_vectors ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY "Users can access their org's chunks" ON chunk_vectors
      FOR ALL USING (doc_id IN (
        SELECT id FROM document_vectors WHERE org_id IN (
          SELECT org_id FROM profiles WHERE user_id = auth.uid()
        )
      ));

    -- Create indexes
    CREATE INDEX IF NOT EXISTS chunk_vectors_embedding_idx ON chunk_vectors 
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
    CREATE INDEX IF NOT EXISTS chunk_vectors_doc_id_idx ON chunk_vectors (doc_id);
  `,

  // User profiles for auth integration (mirrors D1 profiles)
  profiles: `
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY DEFAULT auth.uid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      org_id INTEGER NOT NULL,
      role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Enable RLS
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY "Users can view own profile" ON profiles
      FOR SELECT USING (id = auth.uid());

    CREATE POLICY "Users can update own profile" ON profiles
      FOR UPDATE USING (id = auth.uid());

    -- Trigger to sync with auth.users
    CREATE OR REPLACE FUNCTION handle_new_user()
    RETURNS trigger AS $$
    BEGIN
      INSERT INTO public.profiles (id, email, name)
      VALUES (new.id, new.email, new.raw_user_meta_data->>'name');
      RETURN new;
    END;
    $$ language plpgsql security definer;

    CREATE OR REPLACE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  `
}

// Initialize Supabase schema (run once during setup)
export async function initializeSupabaseSchema(supabase: ServiceClients['supabase']) {
  try {
    // Enable pgvector extension
    await supabase.rpc('exec', {
      sql: 'CREATE EXTENSION IF NOT EXISTS vector;'
    }).throwOnError()

    // Create tables
    for (const [tableName, sql] of Object.entries(SUPABASE_SCHEMA)) {
      console.log(`Creating ${tableName}...`)
      await supabase.rpc('exec', { sql }).throwOnError()
    }

    console.log('Supabase schema initialized successfully')
    return { success: true }
  } catch (error) {
    console.error('Error initializing Supabase schema:', error)
    return { success: false, error }
  }
}

// Utility function to get authenticated user from Supabase
export async function getAuthenticatedUser(
  supabase: ServiceClients['supabase'],
  token: string
) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error) throw error
    if (!user) throw new Error('No user found')

    // Get user profile with org info
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return { user, profile }
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}