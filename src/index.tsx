import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import { renderer } from './renderer'

// Define Cloudflare bindings type
type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// Middleware
app.use('*', logger())
app.use('/api/*', cors())
app.use(renderer)

// Serve static files from public directory
app.use('/static/*', serveStatic({ root: './public' }))

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
  const { DB } = c.env;
  
  try {
    // For demo, return all templates - in production, filter by user permissions
    const { results } = await DB.prepare(`
      SELECT t.*, p.name as created_by_name 
      FROM templates t 
      LEFT JOIN profiles p ON t.created_by = p.id 
      WHERE t.is_active = TRUE 
      ORDER BY t.name
    `).all();

    return c.json({ templates: results });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return c.json({ error: 'Failed to fetch templates' }, 500);
  }
})

// Get single template
app.get('/api/templates/:id', async (c) => {
  const { DB } = c.env;
  const templateId = c.req.param('id');
  
  try {
    const template = await DB.prepare(`
      SELECT t.*, p.name as created_by_name 
      FROM templates t 
      LEFT JOIN profiles p ON t.created_by = p.id 
      WHERE t.id = ? AND t.is_active = TRUE
    `).bind(templateId).first();

    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }

    return c.json({ template });
  } catch (error) {
    console.error('Error fetching template:', error);
    return c.json({ error: 'Failed to fetch template' }, 500);
  }
})

// Create new chat
app.post('/api/chats', async (c) => {
  const { DB } = c.env;
  
  try {
    const { title, template_id } = await c.req.json();
    
    // For demo, use default user and org
    const result = await DB.prepare(`
      INSERT INTO chats (org_id, user_id, title, template_id, created_at) 
      VALUES (1, 1, ?, ?, CURRENT_TIMESTAMP)
    `).bind(title || 'New Chat', template_id || 1).run();

    return c.json({ 
      chat_id: result.meta.last_row_id,
      title: title || 'New Chat',
      template_id: template_id || 1
    });
  } catch (error) {
    console.error('Error creating chat:', error);
    return c.json({ error: 'Failed to create chat' }, 500);
  }
})

// Get user chats
app.get('/api/chats', async (c) => {
  const { DB } = c.env;
  
  try {
    const { results } = await DB.prepare(`
      SELECT c.*, t.name as template_name 
      FROM chats c 
      LEFT JOIN templates t ON c.template_id = t.id 
      WHERE c.user_id = 1 
      ORDER BY c.updated_at DESC
    `).all();

    return c.json({ chats: results });
  } catch (error) {
    console.error('Error fetching chats:', error);
    return c.json({ error: 'Failed to fetch chats' }, 500);
  }
})

// Get chat messages
app.get('/api/chats/:id/messages', async (c) => {
  const { DB } = c.env;
  const chatId = c.req.param('id');
  
  try {
    const { results } = await DB.prepare(`
      SELECT m.*, p.name as user_name 
      FROM messages m 
      LEFT JOIN profiles p ON m.user_id = p.id 
      WHERE m.chat_id = ? 
      ORDER BY m.created_at ASC
    `).bind(chatId).all();

    return c.json({ messages: results });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return c.json({ error: 'Failed to fetch messages' }, 500);
  }
})

// Send message (placeholder for LLM integration)
app.post('/api/chats/:id/messages', async (c) => {
  const { DB } = c.env;
  const chatId = c.req.param('id');
  
  try {
    const { text, transcript_text, attachments, template_id } = await c.req.json();
    
    // Insert user message
    const userResult = await DB.prepare(`
      INSERT INTO messages (chat_id, user_id, role, text, transcript_text, attachments_json, created_at) 
      VALUES (?, 1, 'user', ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(chatId, text, transcript_text, JSON.stringify(attachments || [])).run();

    // TODO: Implement PII detection here
    
    // TODO: Implement LLM integration for response generation
    // For now, return a placeholder response
    const placeholderResponse = {
      json_output: JSON.stringify({
        patient_info: { age: "45", sex: "M" },
        clinical_history: "Chest pain, rule out pneumonia",
        technique: "Single frontal chest radiograph",
        findings: {
          heart: "Normal cardiac silhouette",
          lungs: "Clear lung fields bilaterally",
          pleura: "No pleural effusion",
          bones: "No acute bony abnormality"
        },
        impression: "Normal chest radiograph",
        recommendations: "Clinical correlation recommended"
      }),
      rendered_md: `# Chest X-ray Report\n\n**Patient**: 45-year-old male\n\n**Clinical History**: ${text}\n\n## Findings\n- **Heart**: Normal cardiac silhouette\n- **Lungs**: Clear lung fields bilaterally\n- **Pleura**: No pleural effusion\n- **Bones**: No acute bony abnormality\n\n## Impression\nNormal chest radiograph\n\n## Recommendations\nClinical correlation recommended`,
      citations: []
    };

    // Insert assistant response
    const assistantResult = await DB.prepare(`
      INSERT INTO messages (chat_id, user_id, role, rendered_md, json_output, citations_json, created_at) 
      VALUES (?, 1, 'assistant', ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      chatId, 
      placeholderResponse.rendered_md,
      placeholderResponse.json_output,
      JSON.stringify(placeholderResponse.citations)
    ).run();

    // Update chat timestamp
    await DB.prepare(`
      UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(chatId).run();

    return c.json({
      user_message_id: userResult.meta.last_row_id,
      assistant_message_id: assistantResult.meta.last_row_id,
      response: placeholderResponse
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return c.json({ error: 'Failed to send message' }, 500);
  }
})

// Usage statistics (placeholder)
app.get('/api/usage/me', async (c) => {
  const { DB } = c.env;
  
  try {
    const usage = await DB.prepare(`
      SELECT 
        SUM(credits_charged) as total_credits_used,
        COUNT(*) as total_requests
      FROM usage_events 
      WHERE user_id = 1 AND created_at >= date('now', 'start of month')
    `).first();

    const balance = await DB.prepare(`
      SELECT credits_granted, credits_used 
      FROM credit_balances 
      WHERE org_id = 1 
      ORDER BY created_at DESC 
      LIMIT 1
    `).first();

    return c.json({
      usage: usage || { total_credits_used: 0, total_requests: 0 },
      balance: balance || { credits_granted: 1000, credits_used: 0 }
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    return c.json({ error: 'Failed to fetch usage' }, 500);
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
