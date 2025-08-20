// Vector Database Service for RAG Operations
import type { ServiceClients, RAGQuery, RAGResult, RetrievedChunk, DocumentVector } from '../types'

export class VectorDBService {
  constructor(private clients: ServiceClients) {}

  // Store document with embeddings
  async storeDocument(
    orgId: number,
    title: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<{ success: boolean; doc_id?: string; error?: string }> {
    try {
      // Generate embedding using OpenAI
      const embeddingResponse = await this.clients.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: content,
        encoding_format: 'float'
      })

      const embedding = embeddingResponse.data[0].embedding

      // Store in Supabase vector table
      const { data, error } = await this.clients.supabase
        .from('document_vectors')
        .insert({
          org_id: orgId,
          title,
          content,
          metadata,
          embedding
        })
        .select('id')
        .single()

      if (error) throw error

      return { success: true, doc_id: data.id }
    } catch (error) {
      console.error('Error storing document:', error)
      return { success: false, error: String(error) }
    }
  }

  // Store document chunks with embeddings (for large documents)
  async storeDocumentChunks(
    docId: string,
    chunks: Array<{ text: string; metadata?: Record<string, any> }>
  ): Promise<{ success: boolean; chunk_ids?: string[]; error?: string }> {
    try {
      const chunkData = []

      // Generate embeddings for all chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        
        const embeddingResponse = await this.clients.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk.text,
          encoding_format: 'float'
        })

        chunkData.push({
          doc_id: docId,
          chunk_index: i,
          text: chunk.text,
          embedding: embeddingResponse.data[0].embedding,
          metadata: chunk.metadata || {}
        })
      }

      // Batch insert chunks
      const { data, error } = await this.clients.supabase
        .from('chunk_vectors')
        .insert(chunkData)
        .select('id')

      if (error) throw error

      return { 
        success: true, 
        chunk_ids: data.map(row => row.id) 
      }
    } catch (error) {
      console.error('Error storing document chunks:', error)
      return { success: false, error: String(error) }
    }
  }

  // Perform similarity search
  async searchSimilar(
    query: RAGQuery,
    orgId: number
  ): Promise<RAGResult> {
    try {
      // Generate query embedding
      const embeddingResponse = await this.clients.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query.query,
        encoding_format: 'float'
      })

      const queryEmbedding = embeddingResponse.data[0].embedding
      const maxChunks = query.max_chunks || 5
      const threshold = query.similarity_threshold || 0.7

      // Search in chunk vectors first (more granular)
      const { data: chunkResults, error: chunkError } = await this.clients.supabase
        .rpc('search_chunk_vectors', {
          query_embedding: queryEmbedding,
          org_id: orgId,
          match_threshold: threshold,
          match_count: maxChunks
        })

      if (chunkError) {
        console.error('Chunk search error:', chunkError)
        // Fallback to document search
        return this.searchDocuments(queryEmbedding, orgId, maxChunks, threshold)
      }

      // Transform results
      const chunks: RetrievedChunk[] = chunkResults.map((result: any) => ({
        id: result.id,
        text: result.text,
        metadata: result.metadata,
        similarity_score: result.similarity,
        source: result.doc_title || 'Unknown'
      }))

      const sources = [...new Set(chunks.map(chunk => chunk.source))]

      return { chunks, sources }
    } catch (error) {
      console.error('Error in similarity search:', error)
      return { chunks: [], sources: [] }
    }
  }

  // Fallback document search
  private async searchDocuments(
    queryEmbedding: number[],
    orgId: number,
    maxChunks: number,
    threshold: number
  ): Promise<RAGResult> {
    const { data: docResults, error } = await this.clients.supabase
      .rpc('search_document_vectors', {
        query_embedding: queryEmbedding,
        org_id: orgId,
        match_threshold: threshold,
        match_count: maxChunks
      })

    if (error) {
      console.error('Document search error:', error)
      return { chunks: [], sources: [] }
    }

    const chunks: RetrievedChunk[] = docResults.map((result: any) => ({
      id: result.id,
      text: result.content,
      metadata: result.metadata,
      similarity_score: result.similarity,
      source: result.title
    }))

    const sources = [...new Set(chunks.map(chunk => chunk.source))]

    return { chunks, sources }
  }

  // Delete document and its chunks
  async deleteDocument(docId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete chunks first (cascading should handle this, but being explicit)
      await this.clients.supabase
        .from('chunk_vectors')
        .delete()
        .eq('doc_id', docId)

      // Delete document
      const { error } = await this.clients.supabase
        .from('document_vectors')
        .delete()
        .eq('id', docId)

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Error deleting document:', error)
      return { success: false, error: String(error) }
    }
  }

  // List documents for an organization
  async listDocuments(orgId: number): Promise<DocumentVector[]> {
    try {
      const { data, error } = await this.clients.supabase
        .from('document_vectors')
        .select('id, title, metadata, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error listing documents:', error)
      return []
    }
  }

  // Get document statistics
  async getDocumentStats(orgId: number): Promise<{
    total_documents: number
    total_chunks: number
    storage_size: number
  }> {
    try {
      const { data, error } = await this.clients.supabase
        .rpc('get_document_stats', { org_id: orgId })

      if (error) throw error

      return data || { total_documents: 0, total_chunks: 0, storage_size: 0 }
    } catch (error) {
      console.error('Error getting document stats:', error)
      return { total_documents: 0, total_chunks: 0, storage_size: 0 }
    }
  }
}

// SQL functions to be created in Supabase for vector search
export const VECTOR_SEARCH_FUNCTIONS = {
  search_chunk_vectors: `
    CREATE OR REPLACE FUNCTION search_chunk_vectors(
      query_embedding vector(1536),
      org_id integer,
      match_threshold float,
      match_count int
    )
    RETURNS TABLE (
      id uuid,
      text text,
      metadata jsonb,
      similarity float,
      doc_title text
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        cv.id,
        cv.text,
        cv.metadata,
        1 - (cv.embedding <=> query_embedding) as similarity,
        dv.title as doc_title
      FROM chunk_vectors cv
      JOIN document_vectors dv ON cv.doc_id = dv.id
      WHERE dv.org_id = search_chunk_vectors.org_id
        AND 1 - (cv.embedding <=> query_embedding) > match_threshold
      ORDER BY cv.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $$;
  `,

  search_document_vectors: `
    CREATE OR REPLACE FUNCTION search_document_vectors(
      query_embedding vector(1536),
      org_id integer,
      match_threshold float,
      match_count int
    )
    RETURNS TABLE (
      id uuid,
      title text,
      content text,
      metadata jsonb,
      similarity float
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        dv.id,
        dv.title,
        dv.content,
        dv.metadata,
        1 - (dv.embedding <=> query_embedding) as similarity
      FROM document_vectors dv
      WHERE dv.org_id = search_document_vectors.org_id
        AND 1 - (dv.embedding <=> query_embedding) > match_threshold
      ORDER BY dv.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $$;
  `,

  get_document_stats: `
    CREATE OR REPLACE FUNCTION get_document_stats(org_id integer)
    RETURNS TABLE (
      total_documents bigint,
      total_chunks bigint,
      storage_size bigint
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        COUNT(dv.id) as total_documents,
        COUNT(cv.id) as total_chunks,
        SUM(LENGTH(dv.content) + COALESCE(SUM(LENGTH(cv.text)), 0)) as storage_size
      FROM document_vectors dv
      LEFT JOIN chunk_vectors cv ON dv.id = cv.doc_id
      WHERE dv.org_id = get_document_stats.org_id;
    END;
    $$;
  `
}

// Helper function to chunk text content
export function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): Array<{ text: string; metadata: { chunk_index: number; char_start: number; char_end: number } }> {
  const chunks = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    const chunkText = text.slice(start, end)

    chunks.push({
      text: chunkText,
      metadata: {
        chunk_index: chunks.length,
        char_start: start,
        char_end: end
      }
    })

    // Move start position with overlap
    start = end - overlap
    if (start >= text.length) break
  }

  return chunks
}