// LLM Service for Report Generation and AI Operations
import type { ServiceClients, LLMRequest, LLMResponse, Template, RetrievedChunk, MessageRequest, UsageEvent } from '../types'

export class LLMService {
  constructor(private clients: ServiceClients) {}

  // Generate radiology report using GPT-4o with RAG context
  async generateReport(
    request: MessageRequest,
    template: Template,
    contextChunks: RetrievedChunk[] = [],
    userId: number,
    orgId: number
  ): Promise<{
    response: LLMResponse
    usage_event: Partial<UsageEvent>
    structured_output?: Record<string, any>
  }> {
    try {
      // Build system prompt with template instructions and context
      const systemPrompt = this.buildSystemPrompt(template, contextChunks)
      
      // Build user message
      const userMessage = this.buildUserMessage(request)

      // Prepare OpenAI request
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userMessage }
      ]

      // Call GPT-4o with structured output if schema provided
      const completion = await this.clients.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 2000,
        temperature: 0.3, // Lower temperature for medical accuracy
        response_format: template.output_schema ? { type: 'json_object' } : undefined
      })

      const response = completion.choices[0]?.message?.content || ''
      const usage = completion.usage

      // Parse structured output if JSON schema provided
      let structuredOutput: Record<string, any> | undefined
      if (template.output_schema && response) {
        try {
          structuredOutput = JSON.parse(response)
        } catch (error) {
          console.error('Failed to parse structured output:', error)
        }
      }

      // Create usage event for billing
      const usageEvent: Partial<UsageEvent> = {
        org_id: orgId,
        user_id: userId,
        event_type: 'tokens_out',
        tokens_in: usage?.prompt_tokens || 0,
        tokens_out: usage?.completion_tokens || 0,
        credits_charged: this.calculateCredits(usage?.total_tokens || 0, 0, 0, 0)
      }

      return {
        response: {
          content: response,
          structured_output: structuredOutput,
          usage: {
            prompt_tokens: usage?.prompt_tokens || 0,
            completion_tokens: usage?.completion_tokens || 0,
            total_tokens: usage?.total_tokens || 0
          }
        },
        usage_event: usageEvent,
        structured_output: structuredOutput
      }
    } catch (error) {
      console.error('Error generating report:', error)
      throw new Error(`Failed to generate report: ${error}`)
    }
  }

  // Transcribe audio using Whisper
  async transcribeAudio(
    audioFile: File | ArrayBuffer,
    userId: number,
    orgId: number
  ): Promise<{
    transcript: string
    usage_event: Partial<UsageEvent>
  }> {
    try {
      // Convert ArrayBuffer to File if needed
      let file: File
      if (audioFile instanceof ArrayBuffer) {
        file = new File([audioFile], 'audio.webm', { type: 'audio/webm' })
      } else {
        file = audioFile
      }

      // Call Whisper API
      const transcription = await this.clients.openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        response_format: 'text',
        language: 'en' // Can be made configurable
      })

      // Calculate audio duration for billing (approximate)
      const audioDuration = this.estimateAudioDuration(file.size)

      const usageEvent: Partial<UsageEvent> = {
        org_id: orgId,
        user_id: userId,
        event_type: 'audio_minutes',
        audio_minutes: audioDuration,
        credits_charged: this.calculateCredits(0, 0, audioDuration, 0)
      }

      return {
        transcript: transcription,
        usage_event
      }
    } catch (error) {
      console.error('Error transcribing audio:', error)
      throw new Error(`Failed to transcribe audio: ${error}`)
    }
  }

  // Generate embeddings for documents
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.clients.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
        encoding_format: 'float'
      })

      return response.data.map(item => item.embedding)
    } catch (error) {
      console.error('Error generating embeddings:', error)
      throw new Error(`Failed to generate embeddings: ${error}`)
    }
  }

  // Build system prompt with template and RAG context
  private buildSystemPrompt(template: Template, contextChunks: RetrievedChunk[]): string {
    let prompt = `You are an expert radiology AI assistant. Your task is to generate structured radiology reports based on clinical information and imaging findings.

TEMPLATE INSTRUCTIONS:
${template.instructions}

OUTPUT SCHEMA:
${template.output_schema ? `Please structure your response as JSON according to this schema:\n${template.output_schema}` : 'Provide a clear, professional radiology report in markdown format.'}

MEDICAL GUIDELINES:`

    // Add RAG context if available
    if (contextChunks && contextChunks.length > 0) {
      prompt += '\n\nRELEVANT MEDICAL KNOWLEDGE:\n'
      contextChunks.forEach((chunk, index) => {
        prompt += `\n${index + 1}. From "${chunk.source}":\n${chunk.text}\n`
      })
    }

    prompt += `\n\nIMPORTANT GUIDELINES:
- Always maintain professional medical language
- Be accurate and conservative in your assessments
- Include all relevant findings systematically
- Provide clear recommendations when appropriate
- Never make definitive diagnoses without sufficient clinical correlation
- If uncertain, recommend further evaluation or clinical correlation

Please generate a complete radiology report based on the following clinical information:`

    return prompt
  }

  // Build user message from request
  private buildUserMessage(request: MessageRequest): string {
    let message = ''

    if (request.text) {
      message += `Clinical Information: ${request.text}\n`
    }

    if (request.transcript_text) {
      message += `Voice Notes: ${request.transcript_text}\n`
    }

    if (request.attachments && request.attachments.length > 0) {
      message += `\nAttached Files:\n`
      request.attachments.forEach((file, index) => {
        message += `${index + 1}. ${file.name} (${file.type})\n`
      })
    }

    return message.trim() || 'Please generate a standard radiology report template.'
  }

  // Calculate credits based on usage
  private calculateCredits(
    tokens: number,
    audioMinutes: number,
    pages: number,
    files: number
  ): number {
    // Credit calculation rules (from technical spec):
    // 1 credit = 1K input tokens OR 500 output tokens OR 0.25 audio minutes OR 2 pages
    
    let credits = 0
    
    // Token-based credits (simplified - in production, separate input/output)
    credits += Math.ceil(tokens / 750) // Average between input/output rates
    
    // Audio credits
    credits += Math.ceil(audioMinutes / 0.25)
    
    // Page processing credits
    credits += Math.ceil(pages / 2)
    
    // File processing credits (fixed rate)
    credits += files * 0.5

    return Math.max(credits, 0.1) // Minimum charge
  }

  // Estimate audio duration from file size (rough approximation)
  private estimateAudioDuration(fileSizeBytes: number): number {
    // Rough estimate: ~1MB per minute for compressed audio
    const sizeInMB = fileSizeBytes / (1024 * 1024)
    return Math.max(sizeInMB, 0.1) // Minimum 0.1 minutes
  }

  // Validate output against schema
  private validateStructuredOutput(
    output: string,
    schema: string
  ): { valid: boolean; data?: Record<string, any>; error?: string } {
    try {
      const data = JSON.parse(output)
      const schemaObj = JSON.parse(schema)
      
      // Basic validation - in production, use a proper JSON schema validator
      if (typeof data === 'object' && data !== null) {
        return { valid: true, data }
      }
      
      return { valid: false, error: 'Output is not a valid object' }
    } catch (error) {
      return { valid: false, error: `JSON parsing error: ${error}` }
    }
  }

  // Generate citations from RAG chunks
  generateCitations(chunks: RetrievedChunk[]): Array<{
    source: string
    title: string
    excerpt: string
    relevance_score: number
  }> {
    return chunks.map(chunk => ({
      source: chunk.source,
      title: chunk.metadata.title || chunk.source,
      excerpt: chunk.text.substring(0, 200) + (chunk.text.length > 200 ? '...' : ''),
      relevance_score: chunk.similarity_score
    }))
  }

  // Convert structured output to markdown
  convertToMarkdown(structuredOutput: Record<string, any>, template: Template): string {
    // This is a simplified converter - in production, use template-specific formatters
    let markdown = `# ${template.name}\n\n`

    if (structuredOutput.patient_info) {
      markdown += `**Patient**: ${structuredOutput.patient_info.age}-year-old ${structuredOutput.patient_info.sex}\n\n`
    }

    if (structuredOutput.clinical_history) {
      markdown += `**Clinical History**: ${structuredOutput.clinical_history}\n\n`
    }

    if (structuredOutput.technique) {
      markdown += `**Technique**: ${structuredOutput.technique}\n\n`
    }

    if (structuredOutput.findings) {
      markdown += `## Findings\n\n`
      Object.entries(structuredOutput.findings).forEach(([key, value]) => {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        markdown += `- **${label}**: ${value}\n`
      })
      markdown += '\n'
    }

    if (structuredOutput.impression) {
      markdown += `## Impression\n\n${structuredOutput.impression}\n\n`
    }

    if (structuredOutput.recommendations) {
      markdown += `## Recommendations\n\n${structuredOutput.recommendations}\n\n`
    }

    return markdown
  }
}