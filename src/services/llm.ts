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

      // Call GPT-4o (latest model) with optimized settings for medical accuracy
      const completion = await this.clients.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 2500, // Increased for comprehensive template coverage
        temperature: 0.1, // Lower temperature for stricter format adherence
        top_p: 0.8, // More focused sampling for template compliance
        frequency_penalty: 0.0, // Allow medical terminology repetition
        presence_penalty: 0.3, // Encourage comprehensive coverage of all sections

      })

      let response = completion.choices[0]?.message?.content || ''
      const usage = completion.usage

      // Validate template compliance and log warnings
      const validation = this.validateTemplateCompliance(response, template)
      if (!validation.isCompliant) {
        console.warn('⚠️ Template compliance issues detected:')
        validation.suggestions.forEach(suggestion => {
          console.warn(`  - ${suggestion}`)
        })
        
        // Add a compliance note to the response for debugging
        response += '\n\n<!-- Template compliance issues detected: ' + validation.suggestions.join(', ') + ' -->'
      } else {
        console.log('✅ Response follows template format correctly')
      }

      // No longer parsing structured JSON output - using markdown format only

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
          usage: {
            prompt_tokens: usage?.prompt_tokens || 0,
            completion_tokens: usage?.completion_tokens || 0,
            total_tokens: usage?.total_tokens || 0
          }
        },
        usage_event: usageEvent
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

  // Generate highly structured report with enhanced factual precision
  async generateStructuredReport(
    request: MessageRequest,
    template: Template,
    contextChunks: RetrievedChunk[] = [],
    userId: number,
    orgId: number
  ): Promise<{
    response: LLMResponse
    usage_event: Partial<UsageEvent>
  }> {
    // Use even more restrictive settings for maximum factual accuracy
    const originalMethod = this.generateReport
    
    // Override the completion call for this specific method
    try {
      const systemPrompt = this.buildHighPrecisionSystemPrompt(template, contextChunks)
      const userMessage = this.buildUserMessage(request)

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userMessage }
      ]

      const completion = await this.clients.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 2500, // Increased for comprehensive template coverage
        temperature: 0.05, // Very low temperature for maximum format compliance
        top_p: 0.7, // Tight focus for structured output
        frequency_penalty: 0.0, // Allow medical terminology repetition
        presence_penalty: 0.4, // Strong encouragement for comprehensive coverage

      })

      let response = completion.choices[0]?.message?.content || ''
      const usage = completion.usage

      // Validate template compliance and log warnings (structured report)
      const validation = this.validateTemplateCompliance(response, template)
      if (!validation.isCompliant) {
        console.warn('⚠️ [STRUCTURED] Template compliance issues detected:')
        validation.suggestions.forEach(suggestion => {
          console.warn(`  - ${suggestion}`)
        })
        
        // Add a compliance note to the response for debugging
        response += '\n\n<!-- Structured report template compliance issues: ' + validation.suggestions.join(', ') + ' -->'
      } else {
        console.log('✅ [STRUCTURED] Response follows template format correctly')
      }

      // No longer parsing structured JSON output - using markdown format only

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
          usage: {
            prompt_tokens: usage?.prompt_tokens || 0,
            completion_tokens: usage?.completion_tokens || 0,
            total_tokens: usage?.total_tokens || 0
          }
        },
        usage_event: usageEvent
      }
    } catch (error) {
      console.error('Error generating structured report:', error)
      throw new Error(`Failed to generate structured report: ${error}`)
    }
  }

  // Build high-precision system prompt for maximum factual accuracy
  private buildHighPrecisionSystemPrompt(template: Template, contextChunks: RetrievedChunk[]): string {
    let templateInstructions: any = {}
    try {
      if (template.retrieval_config) {
        if (typeof template.retrieval_config === 'string') {
          templateInstructions = JSON.parse(template.retrieval_config)
        } else {
          templateInstructions = template.retrieval_config
        }
      }
    } catch (error) {
      console.error('Error parsing template instructions:', error)
    }

    let prompt = `🚨 CRITICAL INSTRUCTION: You are a precision radiology AI that MUST follow the EXACT template format provided. Deviation from the format is not acceptable.

📋 TEMPLATE: ${template.name}
${template.description || ''}

⚠️ MANDATORY TEMPLATE FORMAT - FOLLOW EXACTLY:
${templateInstructions.template_format || 'Use standard radiology report format'}

🔴 ABSOLUTE REQUIREMENTS - NON-NEGOTIABLE:`

    // Add structural requirements first
    prompt += `
1. 🎯 EXACT FORMAT COMPLIANCE: Follow the template format character-by-character, section-by-section
2. 📝 SECTION HEADERS: Use the EXACT headers provided in the template format
3. 🔢 SECTION ORDER: Maintain the EXACT order of sections as shown in template
4. 📋 COMPLETE COVERAGE: Address EVERY section mentioned in the template format
5. 🎨 FORMATTING STYLE: Match the template's formatting style (bullet points, numbering, etc.)
6. 📍 ANATOMICAL ORDER: Follow the systematic approach defined in the template`

    // Add general rules
    if (templateInstructions.general_rules && Array.isArray(templateInstructions.general_rules)) {
      prompt += '\n\nTEMPLATE-SPECIFIC RULES:'
      templateInstructions.general_rules.forEach((rule: string, index: number) => {
        prompt += `\n${index + 1}. ${rule}`
      })
    }

    // Add macros section
    if (templateInstructions.macros && Object.keys(templateInstructions.macros).length > 0) {
      prompt += '\n\nMACRO REPLACEMENTS:'
      Object.entries(templateInstructions.macros).forEach(([key, value]) => {
        prompt += `\n- ${key}: "${value}"`
      })
    }

    prompt += `

🚨 CRITICAL OUTPUT REQUIREMENTS:
1. START with the EXACT opening line from template format if provided
2. Use IDENTICAL section headers as shown in template
3. Follow IDENTICAL formatting structure (spacing, bullets, numbering)
4. Address ALL sections mentioned in template - DO NOT skip any
5. END with the exact closing line from template if provided

⚠️ TEMPLATE COMPLIANCE CHECK:
- Before responding, verify each section header matches template exactly
- Ensure no sections are missing from the template format
- Confirm formatting style matches template specifications

🎯 FINAL REMINDER: Your response MUST be an exact structural match to the template format provided above.

FACTUAL PRECISION GUIDELINES:`

    // Add RAG context if available
    if (contextChunks && contextChunks.length > 0) {
      prompt += '\n\nRELEVANT MEDICAL KNOWLEDGE:\n'
      contextChunks.forEach((chunk, index) => {
        prompt += `\n${index + 1}. From "${chunk.source}":\n${chunk.text}\n`
      })
    }

    prompt += `

CRITICAL INSTRUCTIONS - FOLLOW EXACTLY:
• FACTUAL ONLY: Base all statements on provided clinical data
• BULLET POINTS: Use bullet points for all findings lists
• SECTION HEADERS: Use consistent **Header:** format
• NO CREATIVITY: Avoid interpretive or flowery language
• PRECISE TERMINOLOGY: Use exact medical terms without elaboration
• SYSTEMATIC ORDER: Present findings in anatomical sequence
• CONSERVATIVE ASSESSMENT: If uncertain, state "clinical correlation recommended"
• STRUCTURED FORMAT: Group related findings under appropriate subsections

MANDATORY SECTION STRUCTURE:
• **Clinical Information:** (if provided)
• **Technique:** (scanning parameters/methods)
• **Comparison:** (prior studies if mentioned)
• **Findings:** (organized by anatomical region with bullet points)
• **Impression/Conclusion:** (summarized key findings)
• **Recommendations:** (next steps if applicable)

Generate a complete, structured radiology report based on the provided clinical information:`

    return prompt
  }

  // Build system prompt with template and RAG context
  private buildSystemPrompt(template: Template, contextChunks: RetrievedChunk[]): string {
    // Parse template instructions from retrieval_config
    let templateInstructions: any = {}
    try {
      if (template.retrieval_config) {
        if (typeof template.retrieval_config === 'string') {
          templateInstructions = JSON.parse(template.retrieval_config)
        } else {
          templateInstructions = template.retrieval_config
        }
      }
    } catch (error) {
      console.error('Error parsing template instructions:', error)
    }

    let prompt = `🚨 CRITICAL INSTRUCTION: You are a precision radiology AI that MUST follow the template format with ABSOLUTE compliance.

📋 TEMPLATE: ${template.name}
${template.description || ''}

⚠️ MANDATORY TEMPLATE FORMAT - FOLLOW EXACTLY:
${templateInstructions.template_format || 'Use standard radiology report format'}

🔴 NON-NEGOTIABLE REQUIREMENTS:`

    // Add general rules
    if (templateInstructions.general_rules && Array.isArray(templateInstructions.general_rules)) {
      templateInstructions.general_rules.forEach((rule: string, index: number) => {
        prompt += `\n${index + 1}. ${rule}`
      })
    } else {
      prompt += '\n1. Follow template format exactly\n2. Convert phrases to full sentences\n3. Maintain professional medical language'
    }

    // Add macros section
    if (templateInstructions.macros && Object.keys(templateInstructions.macros).length > 0) {
      prompt += '\n\nMACRO REPLACEMENTS:'
      Object.entries(templateInstructions.macros).forEach(([key, value]) => {
        prompt += `\n- ${key}: "${value}"`
      })
    }

    prompt += `

🚨 CRITICAL COMPLIANCE REQUIREMENTS:
1. EXACT SECTION HEADERS: Use the identical headers from template format
2. COMPLETE SECTION COVERAGE: Address EVERY section in the template
3. IDENTICAL STRUCTURE: Match spacing, bullets, and formatting exactly
4. SEQUENTIAL ORDER: Follow the exact order of sections as shown
5. NO OMISSIONS: Do not skip any section mentioned in template format

⚠️ BEFORE RESPONDING: Verify your output matches template format section-by-section

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

OUTPUT FORMATTING REQUIREMENTS:
- Use clear section headers with consistent formatting
- Structure each section with bullet points for key findings
- Present information in logical, sequential order
- Use precise medical terminology without unnecessary elaboration
- Keep sentences concise and factual
- Avoid creative language or subjective interpretations
- List findings systematically rather than in narrative paragraphs

Please generate a complete radiology report based on the following clinical information:`

    return prompt
  }

  // Build user message from request with template context
  private buildUserMessage(request: MessageRequest): string {
    let message = '🚨 REMEMBER: Follow the EXACT template format provided in the system prompt. Address ALL sections in the correct order.\n\n'

    // Add text input
    if (request.text) {
      message += `Text Input: ${request.text}\n\n`
    }

    // Add transcription if available (the two-stage approach)
    if (request.transcript_text) {
      // Handle both string and object types for transcript_text
      let transcriptContent = ''
      try {
        if (typeof request.transcript_text === 'string') {
          // If it's a string, it might be JSON or plain text
          try {
            const parsed = JSON.parse(request.transcript_text)
            transcriptContent = parsed.whisper_text || parsed.web_speech_text || request.transcript_text
          } catch {
            transcriptContent = request.transcript_text
          }
        } else {
          // If it's already an object
          transcriptContent = request.transcript_text.whisper_text || request.transcript_text.web_speech_text || JSON.stringify(request.transcript_text)
        }
      } catch (error) {
        console.error('Error processing transcript:', error)
        transcriptContent = String(request.transcript_text)
      }
      
      message += `Audio Transcription: ${transcriptContent}\n\n`
    }

    // Add file attachments
    if (request.attachments && request.attachments.length > 0) {
      message += `Attached Files:\n`
      request.attachments.forEach((file, index) => {
        message += `${index + 1}. ${file.name} (${file.type}) - ${file.size} bytes\n`
      })
      message += '\n'
    }

    if (!message.trim()) {
      message = 'Please generate a radiology report based on the selected template format.\n\n'
    }

    message += '🎯 FINAL INSTRUCTION: Generate a complete radiology report that follows the EXACT template format provided in the system prompt. Ensure ALL sections are included and properly formatted. Do not skip any sections.'

    return message
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

  // Validate that the LLM output follows the template format
  private validateTemplateCompliance(response: string, template: Template): { isCompliant: boolean; suggestions: string[] } {
    const suggestions: string[] = []
    let isCompliant = true

    try {
      let templateInstructions: any = {}
      if (template.retrieval_config) {
        if (typeof template.retrieval_config === 'string') {
          templateInstructions = JSON.parse(template.retrieval_config)
        } else {
          templateInstructions = template.retrieval_config
        }
      }

      const templateFormat = templateInstructions.template_format || ''
      
      // Extract expected section headers from template format
      const expectedSections = templateFormat.match(/^[A-Z][^:]*:/gm) || []
      const responseSections = response.match(/^[A-Z][^:]*:/gm) || []
      
      // Check if all expected sections are present
      expectedSections.forEach(section => {
        const sectionName = section.replace(':', '')
        if (!response.includes(sectionName)) {
          isCompliant = false
          suggestions.push(`Missing section: ${sectionName}`)
        }
      })

      // Check for template opening line
      if (templateFormat.includes('Here is the completed') && !response.includes('Here is the completed')) {
        isCompliant = false
        suggestions.push('Missing template opening line')
      }

      // Check for template closing line  
      if (templateFormat.includes('Let me know if you') && !response.includes('Let me know if you')) {
        isCompliant = false
        suggestions.push('Missing template closing line')
      }

      return { isCompliant, suggestions }
    } catch (error) {
      console.error('Error validating template compliance:', error)
      return { isCompliant: true, suggestions: [] } // Assume compliant if validation fails
    }
  }

  // Note: Structured JSON output conversion removed - LLM now returns markdown directly
}