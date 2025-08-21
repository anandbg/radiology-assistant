import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import { jwt } from 'hono/jwt'
import { renderer } from './renderer'
import { createServiceClients } from './services/clients'
import { createSupabaseClient, SupabaseDB, SupabaseService } from './services/supabase'
import { VectorDBService } from './services/vector-db'
import { LLMService } from './services/llm'
import { PIIDetectionService } from './services/pii-detection'
import { FileStorageService } from './services/file-storage'
import type { Bindings, HybridContext } from './types'

const app = new Hono<{ Bindings: Bindings }>()

// Middleware
app.use('*', logger())
app.use('/api/*', cors())
app.use(renderer)

// Serve static files from public directory
app.use('/static/*', serveStatic({ root: './public' }))

// Initialize hybrid services middleware
app.use('*', async (c, next) => {
  // Create service clients (may be null in development)
  const clients = createServiceClients(c.env)
  
  // Create Supabase client (pass Cloudflare env context)
  const supabase = createSupabaseClient(c.env)
  const supabaseDB = supabase ? new SupabaseDB(supabase.client) : null
  
  // Initialize services
  let vectorDB = null
  let llmService = null
  let fileStorage = null
  
  if (clients) {
    vectorDB = new VectorDBService(clients)
    llmService = new LLMService(clients)
  }
  
  // PII detection works locally without external services
  const piiDetection = PIIDetectionService.getInstance()
  
  // File storage needs R2 bucket
  if (c.env.BUCKET) {
    fileStorage = new FileStorageService(c.env.BUCKET, c.env)
  }
  
  // Add to context
  c.set('clients', clients)
  c.set('supabase', supabase)
  c.set('supabaseDB', supabaseDB)
  c.set('vectorDB', vectorDB)
  c.set('llmService', llmService)
  c.set('piiDetection', piiDetection)
  c.set('fileStorage', fileStorage)
  c.set('hybrid_enabled', !!clients)
  c.set('database_enabled', !!(supabaseDB || c.env.DB))
  
  await next()
})

// API Routes

// Health check
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Radiology Assistant API' 
  })
})

// Get user templates
app.get('/api/templates', async (c) => {
  const supabaseDB = c.get('supabaseDB')
  const { DB } = c.env
  
  try {
    let templates
    
    if (supabaseDB) {
      // Use Supabase
      templates = await supabaseDB.getTemplates()
    } else if (DB) {
      // Fallback to D1
      const { results } = await DB.prepare(`
        SELECT t.*, p.name as created_by_name 
        FROM templates t 
        LEFT JOIN profiles p ON t.created_by = p.id 
        WHERE t.is_active = TRUE 
        ORDER BY t.name
      `).all()
      templates = results
    } else {
      // Demo mode - return sample templates
      templates = [
        {
          id: 1,
          name: 'Chest X-Ray Report',
          description: 'Standard chest radiograph reporting template',
          is_active: true,
          created_by_name: 'Demo User'
        }
      ]
    }

    return c.json({ templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return c.json({ error: 'Failed to fetch templates' }, 500)
  }
})

// Get single template
app.get('/api/templates/:id', async (c) => {
  const supabaseDB = c.get('supabaseDB')
  const { DB } = c.env
  const templateId = c.req.param('id')
  
  try {
    let template
    
    if (supabaseDB) {
      // Use Supabase
      template = await supabaseDB.getTemplate(templateId)
    } else if (DB) {
      // Fallback to D1
      template = await DB.prepare(`
        SELECT t.*, p.name as created_by_name 
        FROM templates t 
        LEFT JOIN profiles p ON t.created_by = p.id 
        WHERE t.id = ? AND t.is_active = TRUE
      `).bind(templateId).first()
    } else {
      // Demo template
      template = {
        id: 1,
        name: 'Chest X-Ray Report',
        description: 'Standard chest radiograph reporting template',
        is_active: true,
        created_by_name: 'Demo User',
        output_schema: JSON.stringify({
          patient_info: { age: 'string', sex: 'string' },
          clinical_history: 'string',
          findings: {
            heart: 'string',
            lungs: 'string',
            pleura: 'string',
            bones: 'string'
          },
          impression: 'string',
          recommendations: 'string'
        })
      }
    }

    if (!template) {
      return c.json({ error: 'Template not found' }, 404)
    }

    return c.json({ template })
  } catch (error) {
    console.error('Error fetching template:', error)
    return c.json({ error: 'Failed to fetch template' }, 500)
  }
})

// Create new chat
app.post('/api/chats', async (c) => {
  const supabaseDB = c.get('supabaseDB')
  const { DB } = c.env
  
  try {
    const { title, template_id } = await c.req.json()
    let result
    
    if (supabaseDB) {
      // Use Supabase
      result = await supabaseDB.createChat(title, template_id)
    } else if (DB) {
      // Fallback to D1
      const dbResult = await DB.prepare(`
        INSERT INTO chats (org_id, user_id, title, template_id, created_at) 
        VALUES (1, 1, ?, ?, CURRENT_TIMESTAMP)
      `).bind(title || 'New Chat', template_id || 1).run()
      
      result = { 
        chat_id: dbResult.meta.last_row_id,
        title: title || 'New Chat',
        template_id: template_id || 1
      }
    } else {
      // Demo mode - generate fake ID
      result = {
        chat_id: Math.floor(Math.random() * 1000000),
        title: title || 'New Chat',
        template_id: template_id || 1
      }
    }

    return c.json(result)
  } catch (error) {
    console.error('Error creating chat:', error)
    return c.json({ error: 'Failed to create chat' }, 500)
  }
})

// Get user chats
app.get('/api/chats', async (c) => {
  const supabaseDB = c.get('supabaseDB')
  const { DB } = c.env
  
  try {
    let chats
    
    if (supabaseDB) {
      // Use Supabase
      chats = await supabaseDB.getChats()
    } else if (DB) {
      // Fallback to D1
      const { results } = await DB.prepare(`
        SELECT c.*, t.name as template_name 
        FROM chats c 
        LEFT JOIN templates t ON c.template_id = t.id 
        WHERE c.user_id = 1 
        ORDER BY c.updated_at DESC
      `).all()
      chats = results
    } else {
      // Demo mode - empty chats
      chats = []
    }

    return c.json({ chats })
  } catch (error) {
    console.error('Error fetching chats:', error)
    return c.json({ error: 'Failed to fetch chats' }, 500)
  }
})

// Get chat messages
app.get('/api/chats/:id/messages', async (c) => {
  const supabaseDB = c.get('supabaseDB')
  const { DB } = c.env
  const chatId = c.req.param('id')
  
  try {
    let messages
    
    if (supabaseDB) {
      // Use Supabase
      messages = await supabaseDB.getChatMessages(chatId)
    } else if (DB) {
      // Fallback to D1
      const { results } = await DB.prepare(`
        SELECT m.*, p.name as user_name 
        FROM messages m 
        LEFT JOIN profiles p ON m.user_id = p.id 
        WHERE m.chat_id = ? 
        ORDER BY m.created_at ASC
      `).bind(chatId).all()
      messages = results
    } else {
      // Demo mode - empty messages
      messages = []
    }

    return c.json({ messages })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return c.json({ error: 'Failed to fetch messages' }, 500)
  }
})

// Enhanced message endpoint with hybrid architecture
app.post('/api/chats/:id/messages', async (c) => {
  const supabaseDB = c.get('supabaseDB')
  const { DB } = c.env
  const chatId = c.req.param('id')
  
  try {
    const { text, transcript_text, whisper_transcript, attachments, template_id } = await c.req.json()
    
    // Get services from context
    const piiDetection = c.get('piiDetection')
    const vectorDB = c.get('vectorDB')
    const llmService = c.get('llmService')
    const hybridEnabled = c.get('hybrid_enabled')
    
    // Step 1: PII Detection - use the best available text
    // Priority: whisper_transcript (most accurate) > text (local + manual) > transcript_text (legacy)
    const inputText = whisper_transcript || text || transcript_text || ''
    const localTranscript = text || transcript_text || '' // Keep local for comparison
    const piiResult = piiDetection.detectPII(inputText)
    
    if (piiResult.detected && piiDetection.isHighRiskPII(piiResult.entities)) {
      return c.json({
        error: 'PII_DETECTED',
        message: 'Potential personal identifiable information detected. Please review and remove sensitive data.',
        detected_entities: piiResult.entities.map(e => ({
          type: e.type,
          confidence: e.confidence
        }))
      }, 400)
    }

    // Step 2: Get template for context
    let template
    
    if (supabaseDB) {
      template = await supabaseDB.getTemplate((template_id || 1).toString())
    } else if (DB) {
      template = await DB.prepare(`
        SELECT * FROM templates WHERE id = ? AND is_active = TRUE
      `).bind(template_id || 1).first()
    } else {
      // Demo template
      template = {
        id: 1,
        name: 'Chest X-Ray Report',
        output_schema: JSON.stringify({
          patient_info: { age: 'string', sex: 'string' },
          clinical_history: 'string',
          findings: { heart: 'string', lungs: 'string', pleura: 'string', bones: 'string' },
          impression: 'string',
          recommendations: 'string'
        })
      }
    }

    if (!template) {
      return c.json({ error: 'Template not found' }, 404)
    }

    // Step 3: Insert user message with PII status and both transcripts
    let userResult
    
    if (supabaseDB) {
      userResult = await supabaseDB.insertUserMessage(
        chatId,
        piiResult.sanitized_text || inputText || null,
        {
          local_transcript: localTranscript,
          whisper_transcript: whisper_transcript,
          combined_text: piiResult.sanitized_text || inputText
        },
        attachments || [],
        {
          detected: piiResult.detected,
          ...piiDetection.getPIISummary(piiResult)
        }
      )
    } else if (DB) {
      userResult = await DB.prepare(`
        INSERT INTO messages (chat_id, user_id, role, text, transcript_text, attachments_json, pii_detected, pii_details, created_at) 
        VALUES (?, 1, 'user', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        chatId, 
        piiResult.sanitized_text || inputText || null, 
        JSON.stringify({
          local_transcript: localTranscript,
          whisper_transcript: whisper_transcript,
          combined_text: piiResult.sanitized_text || inputText
        }), 
        JSON.stringify(attachments || []),
        piiResult.detected ? 1 : 0,
        piiResult.detected ? JSON.stringify(piiDetection.getPIISummary(piiResult)) : null
      ).run()
    } else {
      // Demo mode - fake result
      userResult = { meta: { last_row_id: Math.floor(Math.random() * 1000000) } }
    }

    // Step 4: RAG - Retrieve relevant context (if enabled for template)
    let contextChunks = []
    const retrievalConfig = template.retrieval_config ? JSON.parse(template.retrieval_config) : null
    
    if (retrievalConfig?.enabled) {
      const ragResult = await vectorDB.searchSimilar({
        query: inputText,
        template_id: template_id,
        max_chunks: retrievalConfig.max_chunks || 5,
        similarity_threshold: 0.7
      }, 1) // orgId = 1 for demo
      
      contextChunks = ragResult.chunks
    }

    // Step 5: Generate AI response 
    let llmResult, renderedMarkdown, citations
    
    if (hybridEnabled && llmService) {
      // Use hybrid LLM service
      llmResult = await llmService.generateReport(
        { text: piiResult.sanitized_text || inputText, attachments },
        template,
        contextChunks,
        1, // userId
        1  // orgId
      )

      // Convert structured output to markdown if needed
      renderedMarkdown = llmResult.response.content
      if (llmResult.structured_output && template.output_schema) {
        renderedMarkdown = llmService.convertToMarkdown(llmResult.structured_output, template)
      }

      // Generate citations
      citations = llmService.generateCitations(contextChunks)
    } else {
      // Fallback to local placeholder response
      const placeholderOutput = {
        patient_info: { age: "Unknown", sex: "Unknown" },
        clinical_history: piiResult.sanitized_text || inputText,
        technique: "As described",
        findings: {
          heart: "Assessment pending - hybrid services not configured",
          lungs: "Assessment pending - hybrid services not configured", 
          pleura: "Assessment pending - hybrid services not configured",
          bones: "Assessment pending - hybrid services not configured"
        },
        impression: "Preliminary assessment - AI services not available",
        recommendations: "Configure OpenAI API key for full AI report generation"
      }

      renderedMarkdown = `# ${template.name}\n\n**Clinical History**: ${piiResult.sanitized_text || inputText}\n\n## Status\nDemo mode - Configure hybrid services for full AI capabilities\n\n## Next Steps\n- Set up OpenAI API key\n- Configure Supabase for RAG\n- Enable full report generation`
      
      citations = []
      llmResult = {
        response: { content: renderedMarkdown, usage: { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 } },
        usage_event: { credits_charged: 0 },
        structured_output: placeholderOutput
      }
    }

    // Step 8: Insert assistant response
    let assistantResult
    
    if (supabaseDB) {
      assistantResult = await supabaseDB.insertAssistantMessage(
        chatId,
        renderedMarkdown,
        llmResult.structured_output,
        citations
      )
    } else if (DB) {
      assistantResult = await DB.prepare(`
        INSERT INTO messages (chat_id, user_id, role, rendered_md, json_output, citations_json, created_at) 
        VALUES (?, 1, 'assistant', ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        chatId, 
        renderedMarkdown,
        llmResult.structured_output ? JSON.stringify(llmResult.structured_output) : null,
        JSON.stringify(citations)
      ).run()
    } else {
      // Demo mode - fake result
      assistantResult = { meta: { last_row_id: Math.floor(Math.random() * 1000000) } }
    }

    // Step 9: Record usage event
    if (llmResult.usage_event) {
      if (supabaseDB) {
        await supabaseDB.insertUsageEvent(
          llmResult.usage_event,
          chatId,
          assistantResult.meta.last_row_id
        )
      } else if (DB) {
        await DB.prepare(`
          INSERT INTO usage_events (org_id, user_id, chat_id, message_id, event_type, tokens_in, tokens_out, credits_charged, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          llmResult.usage_event.org_id,
          llmResult.usage_event.user_id,
          chatId,
          assistantResult.meta.last_row_id,
          llmResult.usage_event.event_type,
          llmResult.usage_event.tokens_in || 0,
          llmResult.usage_event.tokens_out || 0,
          llmResult.usage_event.credits_charged
        ).run()
      }
      // Demo mode - no action needed
    }

    // Step 10: Update chat timestamp
    if (supabaseDB) {
      await supabaseDB.updateChatTimestamp(chatId)
    } else if (DB) {
      await DB.prepare(`
        UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(chatId).run()
    }
    // Demo mode - no action needed

    return c.json({
      user_message_id: userResult.meta.last_row_id,
      assistant_message_id: assistantResult.meta.last_row_id,
      response: {
        json_output: llmResult.structured_output ? JSON.stringify(llmResult.structured_output) : null,
        rendered_md: renderedMarkdown,
        citations: citations
      },
      pii_detected: piiResult.detected,
      context_sources: contextChunks.map(chunk => chunk.source),
      usage: {
        tokens_used: llmResult.response.usage?.total_tokens || 0,
        credits_charged: llmResult.usage_event.credits_charged
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return c.json({ error: 'Failed to send message' }, 500);
  }
})

// File upload endpoint
app.post('/api/files/upload', async (c) => {
  try {
    const fileStorage = c.get('fileStorage')
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }

    const result = await fileStorage.uploadFile(file, 1, 1, {
      filename: file.name,
      contentType: file.type
    })

    if (!result.success) {
      return c.json({ error: result.error }, 400)
    }

    return c.json({
      file_key: result.file_key,
      url: result.url,
      attachment: result.attachment,
      credits_charged: result.usage_event?.credits_charged
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return c.json({ error: 'Upload failed' }, 500)
  }
})

// File download endpoint
app.get('/api/files/:key{.*}', async (c) => {
  try {
    const fileStorage = c.get('fileStorage')
    const fileKey = c.req.param('key')
    
    const result = await fileStorage.getFile(fileKey, 1) // orgId = 1 for demo
    
    if (!result.success) {
      return c.json({ error: result.error }, 404)
    }

    return new Response(result.data, {
      headers: {
        'Content-Type': result.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${result.metadata?.['original-filename'] || 'file'}"`
      }
    })
  } catch (error) {
    console.error('Error downloading file:', error)
    return c.json({ error: 'Download failed' }, 500)
  }
})

// Audio transcription endpoint
app.post('/api/transcribe', async (c) => {
  try {
    const llmService = c.get('llmService')
    const formData = await c.req.formData()
    const audioFile = formData.get('audio') as File
    
    if (!audioFile) {
      return c.json({ error: 'No audio file provided' }, 400)
    }

    const result = await llmService.transcribeAudio(audioFile, 1, 1)
    
    return c.json({
      transcript: result.transcript,
      credits_charged: result.usage_event.credits_charged
    })
  } catch (error) {
    console.error('Error transcribing audio:', error)
    return c.json({ error: 'Transcription failed' }, 500)
  }
})

// PII detection endpoint (works locally)
// Test route for speech recognition
app.get('/test-speech', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Speech Recognition Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        button { padding: 15px 25px; margin: 10px; font-size: 16px; border: none; border-radius: 5px; cursor: pointer; }
        .start { background: #4CAF50; color: white; }
        .stop { background: #f44336; color: white; }
        button:disabled { background: #ccc; cursor: not-allowed; }
        #status { padding: 10px; margin: 10px 0; background: #e7e7e7; border-radius: 5px; font-weight: bold; }
        #output { border: 2px solid #ddd; padding: 15px; min-height: 150px; margin: 10px 0; background: #fafafa; border-radius: 5px; font-family: monospace; }
        .transcript-final { color: #2e7d32; font-weight: bold; }
        .transcript-interim { color: #1976d2; font-style: italic; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎤 Speech Recognition Test</h1>
        <p>This tests if speech recognition works in your browser. Click Start and speak clearly.</p>
        
        <button id="startBtn" class="start">🎤 Start Recording</button>
        <button id="stopBtn" class="stop" disabled>⏹️ Stop Recording</button>
        
        <div id="status">Ready - Click start to begin</div>
        <div id="output">Transcription will appear here...</div>
        
        <div style="margin-top: 20px; padding: 10px; background: #fff3cd; border-radius: 5px;">
            <strong>Tips:</strong>
            <ul>
                <li>Allow microphone permission when prompted</li>
                <li>Speak clearly and at normal volume</li>
                <li>Works best in Chrome, Edge, or Safari</li>
                <li>Requires internet connection</li>
            </ul>
        </div>
    </div>
    
    <script>
        let recognition;
        let isRecording = false;
        let finalTranscript = '';
        
        function startRecording() {
            console.log('🎤 Starting speech recognition test...');
            
            if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                console.log('❌ Speech recognition not supported');
                document.getElementById('status').textContent = '❌ Speech recognition not supported in this browser';
                document.getElementById('status').style.background = '#ffebee';
                return;
            }
            
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRecognition();
            
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            
            finalTranscript = '';
            
            recognition.onstart = () => {
                console.log('✅ Speech recognition started!');
                document.getElementById('status').textContent = '🎤 Listening... Speak now!';
                document.getElementById('status').style.background = '#c8e6c9';
                document.getElementById('startBtn').disabled = true;
                document.getElementById('stopBtn').disabled = false;
                isRecording = true;
            };
            
            recognition.onresult = (event) => {
                console.log('🔊 Got speech result:', event.results.length);
                let interimTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    const confidence = event.results[i][0].confidence;
                    console.log('📝 Transcript:', transcript, event.results[i].isFinal ? '(final)' : '(interim)', 'confidence:', confidence);
                    
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }
                
                const output = document.getElementById('output');
                output.innerHTML = \`<div class="transcript-final"><strong>Final:</strong> \${finalTranscript}</div><div class="transcript-interim"><em>Current:</em> \${interimTranscript}</div>\`;
                
                // Update status
                if (finalTranscript || interimTranscript) {
                    document.getElementById('status').textContent = '🔊 Speech detected - keep talking!';
                }
            };
            
            recognition.onerror = (event) => {
                console.error('🚨 Speech recognition error:', event.error);
                document.getElementById('status').textContent = \`❌ Error: \${event.error}\`;
                document.getElementById('status').style.background = '#ffebee';
                
                if (event.error === 'not-allowed') {
                    document.getElementById('output').innerHTML = '❌ <strong>Microphone permission denied.</strong><br>Please allow microphone access and try again.';
                } else if (event.error === 'no-speech') {
                    console.log('No speech detected, will restart...');
                } else if (event.error === 'network') {
                    document.getElementById('output').innerHTML = '❌ <strong>Network error.</strong><br>Speech recognition requires internet connection.';
                }
            };
            
            recognition.onend = () => {
                console.log('🛑 Speech recognition ended');
                if (isRecording) {
                    console.log('Auto-restarting...');
                    setTimeout(() => {
                        if (isRecording) {
                            try {
                                recognition.start();
                            } catch (e) {
                                console.error('Failed to restart:', e);
                            }
                        }
                    }, 100);
                }
            };
            
            try {
                recognition.start();
                console.log('🚀 Recognition start() called');
            } catch (error) {
                console.error('❌ Failed to start:', error);
                document.getElementById('status').textContent = \`❌ Failed to start: \${error.message}\`;
                document.getElementById('status').style.background = '#ffebee';
            }
        }
        
        function stopRecording() {
            if (recognition) {
                isRecording = false;
                recognition.stop();
                document.getElementById('status').textContent = '⏹️ Recording stopped';
                document.getElementById('status').style.background = '#e7e7e7';
                document.getElementById('startBtn').disabled = false;
                document.getElementById('stopBtn').disabled = true;
                console.log('⏹️ Recording stopped');
            }
        }
        
        document.getElementById('startBtn').onclick = startRecording;
        document.getElementById('stopBtn').onclick = stopRecording;
        
        // Log browser info
        console.log('Test page loaded.');
        console.log('Browser:', navigator.userAgent);
        console.log('Speech recognition available:', 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
        
        // Show browser compatibility
        const hasWebSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        if (!hasWebSpeech) {
            document.getElementById('output').innerHTML = '❌ <strong>Speech recognition not supported</strong><br>Try using Chrome, Edge, or Safari.';
            document.getElementById('startBtn').disabled = true;
        }
    </script>
</body>
</html>`)
})

app.post('/api/pii/detect', async (c) => {
  try {
    const piiDetection = c.get('piiDetection')
    const { text } = await c.req.json()
    
    if (!text) {
      return c.json({ error: 'No text provided' }, 400)
    }

    if (!piiDetection) {
      return c.json({ error: 'PII detection service not available' }, 503)
    }

    const result = piiDetection.detectPII(text)
    const summary = piiDetection.getPIISummary(result)
    
    return c.json({
      detected: result.detected,
      entities: result.entities.map(e => ({ // Remove sensitive values from response
        type: e.type,
        confidence: e.confidence,
        start: e.start,
        end: e.end
      })),
      sanitized_text: result.sanitized_text,
      summary,
      high_risk: piiDetection.isHighRiskPII(result.entities)
    })
  } catch (error) {
    console.error('Error detecting PII:', error)
    return c.json({ error: 'PII detection failed' }, 500)
  }
})

// Document upload for RAG
app.post('/api/knowledge/documents', async (c) => {
  try {
    const vectorDB = c.get('vectorDB')
    const { title, content, metadata } = await c.req.json()
    
    if (!title || !content) {
      return c.json({ error: 'Title and content are required' }, 400)
    }

    const result = await vectorDB.storeDocument(1, title, content, metadata)
    
    if (!result.success) {
      return c.json({ error: result.error }, 400)
    }

    return c.json({
      doc_id: result.doc_id,
      message: 'Document stored successfully'
    })
  } catch (error) {
    console.error('Error storing document:', error)
    return c.json({ error: 'Failed to store document' }, 500)
  }
})

// RAG search endpoint
app.post('/api/knowledge/search', async (c) => {
  try {
    const vectorDB = c.get('vectorDB')
    const { query, max_chunks, similarity_threshold } = await c.req.json()
    
    if (!query) {
      return c.json({ error: 'Query is required' }, 400)
    }

    const result = await vectorDB.searchSimilar({
      query,
      max_chunks: max_chunks || 5,
      similarity_threshold: similarity_threshold || 0.7
    }, 1)
    
    return c.json(result)
  } catch (error) {
    console.error('Error searching knowledge base:', error)
    return c.json({ error: 'Search failed' }, 500)
  }
})

// Usage statistics with hybrid tracking
app.get('/api/usage/me', async (c) => {
  const supabaseDB = c.get('supabaseDB')
  const { DB } = c.env
  
  try {
    let usage, balance
    
    if (supabaseDB) {
      // Use Supabase
      usage = await supabaseDB.getUserUsage()
      balance = await supabaseDB.getCreditBalance()
    } else if (DB) {
      // Fallback to D1
      usage = await DB.prepare(`
        SELECT 
          SUM(credits_charged) as total_credits_used,
          COUNT(*) as total_requests,
          SUM(tokens_in) as total_tokens_in,
          SUM(tokens_out) as total_tokens_out,
          SUM(audio_minutes) as total_audio_minutes,
          SUM(pages) as total_pages
        FROM usage_events 
        WHERE user_id = 1 AND created_at >= date('now', 'start of month')
      `).first()
      
      balance = await DB.prepare(`
        SELECT credits_granted, credits_used 
        FROM credit_balances 
        WHERE org_id = 1 
        ORDER BY created_at DESC 
        LIMIT 1
      `).first()
    } else {
      // Demo mode
      usage = { total_credits_used: 0, total_requests: 0, total_tokens_in: 0, total_tokens_out: 0, total_audio_minutes: 0, total_pages: 0 }
      balance = { credits_granted: 1000, credits_used: 0 }
    }

    // Get storage stats
    const fileStorage = c.get('fileStorage')
    let storageStats = { used_bytes: 0, total_files: 0 }
    
    if (fileStorage) {
      try {
        storageStats = await fileStorage.getStorageStats(1)
      } catch (e) {
        console.warn('Storage stats not available:', e.message)
      }
    }

    return c.json({
      usage: usage || { total_credits_used: 0, total_requests: 0 },
      balance: balance || { credits_granted: 1000, credits_used: 0 },
      storage: storageStats,
      breakdown: {
        tokens_in: usage?.total_tokens_in || 0,
        tokens_out: usage?.total_tokens_out || 0,
        audio_minutes: usage?.total_audio_minutes || 0,
        pages_processed: usage?.total_pages || 0
      }
    })
  } catch (error) {
    console.error('Error fetching usage:', error)
    return c.json({ error: 'Failed to fetch usage' }, 500)
  }
})

// Main application page
app.get('/', (c) => {
  return c.render(
    <div>
      <h1>Radiology Assistant</h1>
      <div id="app">Loading...</div>
    </div>
  )
})

export default app
