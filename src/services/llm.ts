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

      // Call GPT-4o (latest model) with optimized settings for medical accuracy
      const completion = await this.clients.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 2000,
        temperature: 0.3, // Balanced temperature for medical accuracy with natural language
        top_p: 0.9, // High precision with focused sampling
        frequency_penalty: 0.1, // Reduce repetition
        presence_penalty: 0.0, // Don't penalize medical terminology repetition
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
    structured_output?: Record<string, any>
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
        max_tokens: 2000,
        temperature: 0.3, // Balanced temperature for medical accuracy with natural language
        top_p: 0.85, // Even tighter focus
        frequency_penalty: 0.2, // Higher penalty for repetition
        presence_penalty: 0.0,
        response_format: template.output_schema ? { type: 'json_object' } : undefined
      })

      const response = completion.choices[0]?.message?.content || ''
      const usage = completion.usage

      let structuredOutput: Record<string, any> | undefined
      if (template.output_schema && response) {
        try {
          structuredOutput = JSON.parse(response)
        } catch (error) {
          console.error('Failed to parse structured output:', error)
        }
      }

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

    let prompt = `You are a precision-focused radiology AI assistant. Your primary objective is to generate highly structured, factual radiology reports with maximum clinical accuracy and minimal creative interpretation.

TEMPLATE: ${template.name}
${template.description || ''}

TEMPLATE FORMAT:
${templateInstructions.template_format || 'Use standard radiology report format'}

MANDATORY STRUCTURAL REQUIREMENTS:`

    // Add structural requirements first
    prompt += `
1. Use consistent section headers in bold (e.g., **Clinical Information:**)
2. Break each section into bullet points when listing multiple items
3. Use sub-bullets (- ) for detailed findings within categories  
4. Present information in logical anatomical order
5. Separate normal findings from abnormal findings clearly
6. Use precise measurements and locations when available`

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

OUTPUT SCHEMA:
${template.output_schema ? `Structure your response as JSON according to this schema:\n${JSON.stringify(template.output_schema, null, 2)}` : 'Provide a clear, professional radiology report in structured markdown format.'}

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

    let prompt = `You are an expert radiology AI assistant. Generate professional radiology reports in this EXACT format:

**Clinical Information:**
[Patient information and clinical history]

**Technique:**
[Imaging technique and parameters]

**Findings:**
• [Finding 1]
• [Finding 2]
• [Finding 3]

**Impression:**
[Concise clinical impression]

**Recommendations:**
[Follow-up recommendations if needed]

TEMPLATE: ${template.name}
${template.description || ''}

TEMPLATE FORMAT:
${templateInstructions.template_format || 'Use standard radiology report format'}

GENERAL RULES:`

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

OUTPUT SCHEMA:
${template.output_schema ? `Please structure your response as JSON according to this schema:\n${JSON.stringify(template.output_schema, null, 2)}` : 'Provide a clear, professional radiology report in markdown format.'}

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
    let message = ''

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

    message += 'Please generate a complete radiology report following the template format and rules specified above.'

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

  // Convert structured output to markdown using template format
  convertToMarkdown(structuredOutput: Record<string, any>, template: Template): string {
    // Parse template instructions to get template format
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

    // Start with template header
    let markdown = `# ${template.name} Report\n\n`

    // Use template-specific formatting if available
    if (templateInstructions.template_format) {
      // For now, use a simplified approach - in production, implement template-specific formatters
      if (template.name.includes('MRI')) {
        return this.convertMRIToMarkdown(structuredOutput, templateInstructions)
      } else if (template.name.includes('Chest')) {
        return this.convertChestXrayToMarkdown(structuredOutput, templateInstructions)
      } else if (template.name.includes('CT Head')) {
        return this.convertCTHeadToMarkdown(structuredOutput, templateInstructions)
      }
    }

    // Default formatting
    return this.convertDefaultToMarkdown(structuredOutput, template)
  }

  // MRI-specific markdown converter - matches your uploaded template format
  private convertMRIToMarkdown(output: Record<string, any>, instructions: any): string {
    // Start with your preferred format style
    let markdown = 'Here is the completed MRI Lumbosacral Spine Report based on your template and the provided information:\n\n'

    if (output.clinical_information) {
      markdown += `Clinical Information:\n${output.clinical_information}\n\n`
    }

    if (output.technique) {
      markdown += `## Technique:\n${output.technique}\n\n`
    }

    if (output.comparison) {
      markdown += `## Comparison:\n${output.comparison}\n\n`
    }

    markdown += 'Findings:\n'
    
    if (output.findings) {
      if (output.findings.last_formed_disc) {
        markdown += `${output.findings.last_formed_disc}\n\n`
      }

      if (output.findings.localizer_images) {
        markdown += `Localizer images:\n${output.findings.localizer_images}\n\n`
      }

      if (output.findings.spinal_cord) {
        const spinalCord = output.findings.spinal_cord.description || output.findings.spinal_cord
        markdown += `Spinal cord:\n${spinalCord}\n\n`
      }

      if (output.findings.bones_and_joints) {
        const bones = output.findings.bones_and_joints.description || output.findings.bones_and_joints
        markdown += `Bones and joints:\n${bones}\n\n`
      }

      if (output.findings.thoracic_discs) {
        const thoracic = output.findings.thoracic_discs.description || output.findings.thoracic_discs
        markdown += `Visualized thoracic discs and disc levels:\n${thoracic}\n\n`
      }

      if (output.findings.lumbar_discs) {
        const lumbar = output.findings.lumbar_discs.description || output.findings.lumbar_discs
        // Format with bullet points for detailed findings
        let lumbarFormatted = lumbar
        
        // Look for specific disc level mentions and format as bullet points
        if (lumbar.includes('L1-2') || lumbar.includes('L2-3') || lumbar.includes('L3-4') || lumbar.includes('L4-5') || lumbar.includes('L5-S1')) {
          // If it contains detailed disc analysis, keep the formatting
          lumbarFormatted = lumbar.replace(/- At ([^.]+\.)/g, '\n- At $1')
          lumbarFormatted = lumbarFormatted.replace(/^\n/, '') // Remove leading newline
        }
        
        markdown += `Lumbar discs and disc levels:\n${lumbarFormatted}\n\n`
      }

      if (output.findings.sacrum_iliac) {
        const sacrum = output.findings.sacrum_iliac.description || output.findings.sacrum_iliac
        markdown += `Visualised sacrum and iliac bones:\n${sacrum}\n\n`
      }

      if (output.findings.soft_tissues) {
        const softTissues = output.findings.soft_tissues.description || output.findings.soft_tissues
        markdown += `Soft tissues:\n${softTissues}\n\n`
      }

      if (output.findings.other_findings) {
        const other = output.findings.other_findings.description || output.findings.other_findings
        markdown += `Other findings:\n${other}\n\n`
      }
    }

    if (output.conclusion_recommendations) {
      // Format conclusion with bullet points for key findings
      let conclusion = output.conclusion_recommendations
      
      // If conclusion contains multiple points, format as bullet points
      if (conclusion.includes('Features are most likely to represent')) {
        // Split into main statement and bullet points
        const parts = conclusion.split('Features are most likely to represent the following as described and discussed above')
        if (parts.length > 1) {
          markdown += `Conclusion/Recommendations:\nFeatures are most likely to represent the following as described and discussed above:\n`
          
          // Format remaining text as bullet points if it contains multiple findings
          let findings = parts[1].trim()
          if (findings.includes('.') && findings.length > 100) {
            // Split into sentences and format as bullets
            const sentences = findings.split('.').filter(s => s.trim().length > 0)
            sentences.forEach(sentence => {
              if (sentence.trim()) {
                markdown += `\n- ${sentence.trim()}.`
              }
            })
          } else {
            markdown += `\n${findings}`
          }
        } else {
          markdown += `Conclusion/Recommendations:\n${conclusion}`
        }
      } else {
        markdown += `Conclusion/Recommendations:\n${conclusion}`
      }
      markdown += '\n\n'
    }

    // Add professional closing
    markdown += 'Let me know if you\'d like to adjust or add anything.\n'

    return markdown
  }

  // Chest X-ray specific markdown converter
  private convertChestXrayToMarkdown(output: Record<string, any>, instructions: any): string {
    let markdown = '# Chest X-Ray Report\n\n'

    if (output.clinical_information) {
      markdown += `**Clinical Information:**\n${output.clinical_information}\n\n`
    }

    if (output.technique) {
      markdown += `**Technique:**\n${output.technique}\n\n`
    }

    if (output.comparison) {
      markdown += `**Comparison:**\n${output.comparison}\n\n`
    }

    if (output.findings) {
      markdown += '**Findings:**\n\n'

      if (output.findings.heart) {
        markdown += `**Heart:**\n${output.findings.heart}\n\n`
      }

      if (output.findings.lungs) {
        markdown += '**Lungs:**\n'
        if (typeof output.findings.lungs === 'object') {
          if (output.findings.lungs.right_lung) {
            markdown += `Right lung: ${output.findings.lungs.right_lung}\n`
          }
          if (output.findings.lungs.left_lung) {
            markdown += `Left lung: ${output.findings.lungs.left_lung}\n`
          }
        } else {
          markdown += `${output.findings.lungs}\n`
        }
        markdown += '\n'
      }

      if (output.findings.pleura) {
        markdown += `**Pleura:**\n${output.findings.pleura}\n\n`
      }

      if (output.findings.bones) {
        markdown += `**Bones:**\n${output.findings.bones}\n\n`
      }

      if (output.findings.soft_tissues) {
        markdown += `**Soft tissues:**\n${output.findings.soft_tissues}\n\n`
      }

      if (output.findings.lines_tubes) {
        markdown += `**Lines and tubes:**\n${output.findings.lines_tubes}\n\n`
      }
    }

    if (output.impression) {
      markdown += `**Impression:**\n${output.impression}\n\n`
    }

    if (output.recommendations) {
      markdown += `**Recommendations:**\n${output.recommendations}\n\n`
    }

    return markdown
  }

  // CT Head specific markdown converter
  private convertCTHeadToMarkdown(output: Record<string, any>, instructions: any): string {
    let markdown = '# CT Head Report\n\n'

    if (output.clinical_information) {
      markdown += `**Clinical Information:**\n${output.clinical_information}\n\n`
    }

    if (output.technique) {
      markdown += `**Technique:**\n${output.technique}\n\n`
    }

    if (output.comparison) {
      markdown += `**Comparison:**\n${output.comparison}\n\n`
    }

    if (output.findings) {
      markdown += '**Findings:**\n\n'

      if (output.findings.brain_parenchyma) {
        markdown += `**Brain parenchyma:**\n${output.findings.brain_parenchyma}\n\n`
      }

      if (output.findings.ventricles) {
        markdown += `**Ventricles:**\n${output.findings.ventricles}\n\n`
      }

      if (output.findings.cisterns) {
        markdown += `**Cisterns:**\n${output.findings.cisterns}\n\n`
      }

      if (output.findings.skull_bones) {
        markdown += `**Skull and bones:**\n${output.findings.skull_bones}\n\n`
      }

      if (output.findings.soft_tissues) {
        markdown += `**Soft tissues:**\n${output.findings.soft_tissues}\n\n`
      }
    }

    if (output.impression) {
      markdown += `**Impression:**\n${output.impression}\n\n`
    }

    if (output.recommendations) {
      markdown += `**Recommendations:**\n${output.recommendations}\n\n`
    }

    return markdown
  }

  // Default markdown converter
  private convertDefaultToMarkdown(output: Record<string, any>, template: Template): string {
    let markdown = `# ${template.name} Report\n\n`

    // Generic field mapping
    Object.entries(output).forEach(([key, value]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      
      if (typeof value === 'object' && value !== null) {
        markdown += `**${label}:**\n`
        Object.entries(value).forEach(([subKey, subValue]) => {
          const subLabel = subKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          markdown += `- **${subLabel}**: ${subValue}\n`
        })
        markdown += '\n'
      } else {
        markdown += `**${label}:**\n${value}\n\n`
      }
    })

    return markdown
  }
}