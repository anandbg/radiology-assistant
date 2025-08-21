import { createClient, SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseService {
  client: SupabaseClient
  isConnected: () => Promise<boolean>
}

export function createSupabaseClient(env?: any): SupabaseService | null {
  // Get credentials from environment variables (Cloudflare Workers context or process.env)
  const supabaseUrl = env?.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase credentials not configured - running in local mode')
    return null
  }

  try {
    const client = createClient(supabaseUrl, supabaseKey)
    
    return {
      client,
      async isConnected() {
        try {
          const { error } = await client.from('organizations').select('id').limit(1)
          return !error
        } catch (e) {
          return false
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error)
    return null
  }
}

// Database helper functions for easier migration from D1
export class SupabaseDB {
  private client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  // Templates
  async getTemplates() {
    const { data, error } = await this.client
      .from('templates')
      .select('*')
      .eq('is_active', true)
      .order('name')
    
    if (error) throw error
    return data?.map(t => ({
      ...t,
      created_by_name: 'System' // For demo - in production, join with users table
    })) || []
  }

  async getTemplate(id: string) {
    const { data, error } = await this.client
      .from('templates')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single()
    
    if (error) throw error
    return data ? {
      ...data,
      created_by_name: 'System' // For demo - in production, join with users table
    } : null
  }

  // Chats
  async createChat(title: string, templateId?: number) {
    const { data, error } = await this.client
      .from('chats')
      .insert({
        org_id: 1, // Demo org
        user_id: 1, // Demo user
        title: title || 'New Chat',
        template_id: templateId || 1,
        created_at: new Date().toISOString()
      })
      .select('id, title, template_id')
      .single()
    
    if (error) throw error
    return {
      chat_id: data.id,
      title: data.title,
      template_id: data.template_id
    }
  }

  async getChats() {
    const { data, error } = await this.client
      .from('chats')
      .select(`
        *,
        templates (
          name
        )
      `)
      .eq('user_id', 1) // Demo user
      .order('updated_at', { ascending: false })
    
    if (error) throw error
    return data?.map(c => ({
      ...c,
      template_name: c.templates?.name || 'Unknown'
    })) || []
  }

  async getChatMessages(chatId: string) {
    const { data, error } = await this.client
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    return data?.map(m => ({
      ...m,
      user_name: 'Demo User' // For demo - in production, join with users table
    })) || []
  }

  // Messages
  async insertUserMessage(chatId: string, text: string, transcriptData: any, attachments: any[], piiResult: any) {
    const { data, error } = await this.client
      .from('messages')
      .insert({
        chat_id: chatId,
        user_id: 1, // Demo user
        role: 'user',
        text: piiResult.sanitized_text || text || null,
        transcript_text: JSON.stringify({
          local_transcript: transcriptData.local_transcript,
          whisper_transcript: transcriptData.whisper_transcript,
          combined_text: piiResult.sanitized_text || text
        }),
        attachments_json: JSON.stringify(attachments || []),
        pii_detected: piiResult.detected,
        pii_details: piiResult.detected ? JSON.stringify(piiResult) : null,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()
    
    if (error) throw error
    return { meta: { last_row_id: data.id } }
  }

  async insertAssistantMessage(chatId: string, renderedMd: string, structuredOutput: any, citations: any[]) {
    const { data, error } = await this.client
      .from('messages')
      .insert({
        chat_id: chatId,
        user_id: 1, // Demo user
        role: 'assistant',
        rendered_md: renderedMd,
        json_output: structuredOutput ? JSON.stringify(structuredOutput) : null,
        citations_json: JSON.stringify(citations),
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()
    
    if (error) throw error
    return { meta: { last_row_id: data.id } }
  }

  // Usage tracking
  async insertUsageEvent(usageEvent: any, chatId: string, messageId: number) {
    const { error } = await this.client
      .from('usage_tracking')
      .insert({
        org_id: usageEvent.org_id || 1,
        user_id: usageEvent.user_id || 1,
        chat_id: chatId,
        message_id: messageId,
        event_type: usageEvent.event_type || 'chat',
        tokens_in: usageEvent.tokens_in || 0,
        tokens_out: usageEvent.tokens_out || 0,
        audio_minutes: usageEvent.audio_minutes || 0,
        pages: usageEvent.pages || 0,
        credits_charged: usageEvent.credits_charged,
        model_used: usageEvent.model_used || 'unknown',
        created_at: new Date().toISOString()
      })
    
    if (error) throw error
  }

  async updateChatTimestamp(chatId: string) {
    const { error } = await this.client
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId)
    
    if (error) throw error
  }

  // Usage statistics
  async getUserUsage() {
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    const { data, error } = await this.client
      .from('usage_tracking')
      .select('credits_charged, tokens_in, tokens_out, audio_minutes, pages')
      .eq('user_id', 1)
      .gte('created_at', oneMonthAgo.toISOString())
    
    if (error) throw error
    
    const usage = data.reduce((acc, row) => ({
      total_credits_used: acc.total_credits_used + (row.credits_charged || 0),
      total_requests: acc.total_requests + 1,
      total_tokens_in: acc.total_tokens_in + (row.tokens_in || 0),
      total_tokens_out: acc.total_tokens_out + (row.tokens_out || 0),
      total_audio_minutes: acc.total_audio_minutes + (row.audio_minutes || 0),
      total_pages: acc.total_pages + (row.pages || 0)
    }), {
      total_credits_used: 0,
      total_requests: 0,
      total_tokens_in: 0,
      total_tokens_out: 0,
      total_audio_minutes: 0,
      total_pages: 0
    })

    return usage
  }

  async getCreditBalance() {
    // For now, return demo balance - in production this would query actual balances
    return {
      credits_granted: 1000,
      credits_used: 0
    }
  }
}