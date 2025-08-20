// Radiology Assistant Frontend Application
class RadiologyAssistant {
  constructor() {
    this.currentChatId = null;
    this.templates = [];
    this.selectedTemplate = null;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    
    this.init();
  }

  async init() {
    await this.loadTemplates();
    this.setupEventListeners();
    this.renderInterface();
    await this.loadChats();
  }

  async loadTemplates() {
    try {
      const response = await axios.get('/api/templates');
      this.templates = response.data.templates;
      if (this.templates.length > 0 && !this.selectedTemplate) {
        this.selectedTemplate = this.templates[0];
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      this.showError('Failed to load templates');
    }
  }

  setupEventListeners() {
    // File upload
    document.addEventListener('change', (e) => {
      if (e.target.id === 'file-input') {
        this.handleFileUpload(e.target.files);
      }
    });

    // Drag and drop
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.target.classList.contains('file-upload-area')) {
        e.target.classList.add('dragover');
      }
    });

    document.addEventListener('dragleave', (e) => {
      if (e.target.classList.contains('file-upload-area')) {
        e.target.classList.remove('dragover');
      }
    });

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.target.classList.contains('file-upload-area')) {
        e.target.classList.remove('dragover');
        this.handleFileUpload(e.dataTransfer.files);
      }
    });

    // Send message
    document.addEventListener('click', (e) => {
      if (e.target.id === 'send-button') {
        this.sendMessage();
      } else if (e.target.id === 'record-button') {
        this.toggleRecording();
      } else if (e.target.id === 'new-chat-button') {
        this.createNewChat();
      } else if (e.target.closest('.template-card')) {
        const templateId = e.target.closest('.template-card').dataset.templateId;
        this.selectTemplate(parseInt(templateId));
      } else if (e.target.closest('.chat-item')) {
        const chatId = e.target.closest('.chat-item').dataset.chatId;
        this.loadChat(parseInt(chatId));
      }
    });

    // Enter key to send
    document.addEventListener('keydown', (e) => {
      if (e.target.id === 'message-input' && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  renderInterface() {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = `
      <div class="max-w-7xl mx-auto p-4">
        <!-- Header -->
        <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <i class="fas fa-x-ray text-blue-600 text-2xl"></i>
              <h1 class="text-2xl font-bold text-gray-900">Radiology Assistant</h1>
            </div>
            <div class="flex items-center space-x-4">
              <div class="text-sm text-gray-600">
                <i class="fas fa-coins mr-1"></i>
                <span id="credits-remaining">Loading...</span> credits
              </div>
              <button id="new-chat-button" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2">
                <i class="fas fa-plus"></i>
                <span>New Chat</span>
              </button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <!-- Sidebar -->
          <div class="lg:col-span-1">
            <!-- Template Selection -->
            <div class="bg-white rounded-lg shadow-sm p-4 mb-6">
              <h3 class="font-semibold text-gray-900 mb-3">Report Templates</h3>
              <div id="templates-list" class="space-y-2">
                ${this.renderTemplates()}
              </div>
            </div>

            <!-- Chat History -->
            <div class="bg-white rounded-lg shadow-sm p-4">
              <h3 class="font-semibold text-gray-900 mb-3">Recent Chats</h3>
              <div id="chats-list" class="space-y-2">
                <div class="text-gray-500 text-sm">Loading chats...</div>
              </div>
            </div>
          </div>

          <!-- Main Chat Interface -->
          <div class="lg:col-span-3">
            <div class="bg-white rounded-lg shadow-sm chat-container">
              <!-- Messages -->
              <div id="messages-container" class="chat-messages p-4">
                <div class="text-center text-gray-500 py-8">
                  <i class="fas fa-comments text-4xl mb-4"></i>
                  <p>Start a conversation with your radiology assistant</p>
                  <p class="text-sm mt-2">Upload images, dictate findings, or type your observations</p>
                </div>
              </div>

              <!-- Input Area -->
              <div class="border-t bg-gray-50 chat-input p-4">
                <!-- File Upload Area -->
                <div class="file-upload-area mb-4" onclick="document.getElementById('file-input').click()">
                  <input type="file" id="file-input" multiple accept=".pdf,.docx,.png,.jpg,.jpeg" class="hidden">
                  <i class="fas fa-upload text-gray-400 text-xl mb-2"></i>
                  <p class="text-gray-600 text-sm">Click or drag files here (PDF, DOCX, Images)</p>
                </div>

                <!-- Input Controls -->
                <div class="flex items-end space-x-3">
                  <div class="flex-1">
                    <textarea
                      id="message-input"
                      placeholder="Describe the case, upload images, or use voice recording..."
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows="2"
                    ></textarea>
                  </div>
                  <button id="record-button" class="record-button idle">
                    <i class="fas fa-microphone"></i>
                  </button>
                  <button id="send-button" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2">
                    <i class="fas fa-paper-plane"></i>
                    <span>Send</span>
                  </button>
                </div>

                <!-- PII Warning -->
                <div id="pii-warning" class="pii-warning hidden mt-3">
                  <div class="flex items-start space-x-2">
                    <i class="fas fa-exclamation-triangle text-red-600 mt-1"></i>
                    <div>
                      <p class="font-semibold text-red-700">Potential PII Detected</p>
                      <p class="pii-warning-text">Please review and remove any personal identifiable information before sending.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.loadUsage();
  }

  renderTemplates() {
    return this.templates.map(template => `
      <div class="template-card ${this.selectedTemplate?.id === template.id ? 'selected' : ''}" 
           data-template-id="${template.id}">
        <div class="font-medium text-sm">${template.name}</div>
        <div class="text-xs text-gray-500 mt-1">v${template.version}</div>
      </div>
    `).join('');
  }

  selectTemplate(templateId) {
    this.selectedTemplate = this.templates.find(t => t.id === templateId);
    
    // Update UI
    document.querySelectorAll('.template-card').forEach(card => {
      card.classList.remove('selected');
    });
    document.querySelector(`[data-template-id="${templateId}"]`).classList.add('selected');
  }

  async loadChats() {
    try {
      const response = await axios.get('/api/chats');
      const chats = response.data.chats;
      
      const chatsList = document.getElementById('chats-list');
      if (chats.length === 0) {
        chatsList.innerHTML = '<div class="text-gray-500 text-sm">No chats yet</div>';
        return;
      }

      chatsList.innerHTML = chats.map(chat => `
        <div class="chat-item p-2 hover:bg-gray-50 rounded cursor-pointer" data-chat-id="${chat.id}">
          <div class="font-medium text-sm truncate">${chat.title || 'Untitled'}</div>
          <div class="text-xs text-gray-500">${dayjs(chat.updated_at).format('MMM D, h:mm A')}</div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  }

  async createNewChat() {
    try {
      const response = await axios.post('/api/chats', {
        title: `New Chat - ${dayjs().format('MMM D, h:mm A')}`,
        template_id: this.selectedTemplate?.id
      });
      
      this.currentChatId = response.data.chat_id;
      await this.loadChats();
      this.clearMessages();
    } catch (error) {
      console.error('Error creating new chat:', error);
      this.showError('Failed to create new chat');
    }
  }

  async loadChat(chatId) {
    try {
      this.currentChatId = chatId;
      const response = await axios.get(`/api/chats/${chatId}/messages`);
      const messages = response.data.messages;
      
      this.displayMessages(messages);
      
      // Update active chat in sidebar
      document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('bg-blue-50', 'border-blue-200');
      });
      document.querySelector(`[data-chat-id="${chatId}"]`)?.classList.add('bg-blue-50', 'border-blue-200');
    } catch (error) {
      console.error('Error loading chat:', error);
      this.showError('Failed to load chat');
    }
  }

  displayMessages(messages) {
    const container = document.getElementById('messages-container');
    
    if (messages.length === 0) {
      container.innerHTML = `
        <div class="text-center text-gray-500 py-8">
          <i class="fas fa-comments text-4xl mb-4"></i>
          <p>Start the conversation</p>
        </div>
      `;
      return;
    }

    container.innerHTML = messages.map(message => {
      if (message.role === 'user') {
        return `
          <div class="message-user">
            <div class="text-sm">${this.escapeHtml(message.text || message.transcript_text || '')}</div>
            ${message.attachments_json ? this.renderAttachments(JSON.parse(message.attachments_json)) : ''}
          </div>
        `;
      } else {
        return `
          <div class="message-assistant">
            <div class="prose prose-sm max-w-none">
              ${message.rendered_md ? this.markdownToHtml(message.rendered_md) : ''}
            </div>
            ${message.json_output ? this.renderJsonOutput(message.json_output) : ''}
          </div>
        `;
      }
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  clearMessages() {
    const container = document.getElementById('messages-container');
    container.innerHTML = `
      <div class="text-center text-gray-500 py-8">
        <i class="fas fa-comments text-4xl mb-4"></i>
        <p>Start the conversation</p>
      </div>
    `;
  }

  async sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    if (!text && this.recordedChunks.length === 0) {
      return;
    }

    if (!this.currentChatId) {
      await this.createNewChat();
    }

    // Step 1: PII Detection
    if (text) {
      const piiResult = await this.checkPII(text);
      if (piiResult && piiResult.detected && piiResult.high_risk) {
        this.showPIIWarning(piiResult.entities);
        return;
      }
    }

    // Show loading
    this.showLoading();
    
    try {
      let transcript_text = null;
      
      // Step 2: Transcribe audio if recorded
      if (this.recordedChunks.length > 0) {
        transcript_text = await this.transcribeAudio();
      }

      const messageData = {
        text: text,
        transcript_text: transcript_text,
        template_id: this.selectedTemplate?.id,
        attachments: this.uploadedFiles || []
      };
      
      const response = await axios.post(`/api/chats/${this.currentChatId}/messages`, messageData);
      
      // Handle PII detection error
      if (response.data.error === 'PII_DETECTED') {
        this.showPIIWarning(response.data.detected_entities);
        return;
      }
      
      // Clear input and reset state
      input.value = '';
      this.recordedChunks = [];
      this.uploadedFiles = [];
      
      // Show usage info
      if (response.data.usage) {
        this.showUsageInfo(response.data.usage);
      }
      
      // Reload messages
      await this.loadChat(this.currentChatId);
      
      // Update usage
      await this.loadUsage();
    } catch (error) {
      console.error('Error sending message:', error);
      if (error.response?.data?.error === 'PII_DETECTED') {
        this.showPIIWarning(error.response.data.detected_entities);
      } else {
        this.showError('Failed to send message');
      }
    }
  }

  async checkPII(text) {
    try {
      const response = await axios.post('/api/pii/detect', { text });
      return response.data;
    } catch (error) {
      console.error('Error checking PII:', error);
      return null;
    }
  }

  async transcribeAudio() {
    if (this.recordedChunks.length === 0) return null;
    
    try {
      const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      
      const response = await axios.post('/api/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      return response.data.transcript;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      return null;
    }
  }

  showPIIWarning(entities) {
    const warning = document.getElementById('pii-warning');
    if (warning) {
      const entityTypes = [...new Set(entities.map(e => e.type))].join(', ');
      warning.querySelector('.pii-warning-text').textContent = 
        `Detected: ${entityTypes}. Please remove sensitive information before sending.`;
      warning.classList.remove('hidden');
      
      // Hide after 10 seconds
      setTimeout(() => {
        warning.classList.add('hidden');
      }, 10000);
    }
  }

  showUsageInfo(usage) {
    // Simple usage notification
    if (usage.credits_charged > 0) {
      console.log(`Credits used: ${usage.credits_charged}, Tokens: ${usage.tokens_used}`);
    }
  }

  showLoading() {
    const container = document.getElementById('messages-container');
    const loading = document.createElement('div');
    loading.className = 'message-assistant';
    loading.innerHTML = `
      <div class="flex items-center space-x-2">
        <div class="loading-spinner"></div>
        <span class="text-gray-600">Generating report...</span>
      </div>
    `;
    container.appendChild(loading);
    container.scrollTop = container.scrollHeight;
  }

  async toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        // TODO: Transcribe audio and add to message input
        console.log('Recording finished:', blob);
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      
      const button = document.getElementById('record-button');
      button.className = 'record-button recording';
      button.innerHTML = '<i class="fas fa-stop"></i>';
    } catch (error) {
      console.error('Error starting recording:', error);
      this.showError('Failed to start recording. Please check microphone permissions.');
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.isRecording = false;
      
      const button = document.getElementById('record-button');
      button.className = 'record-button idle';
      button.innerHTML = '<i class="fas fa-microphone"></i>';
    }
  }

  async handleFileUpload(files) {
    if (!files || files.length === 0) return;
    
    this.uploadedFiles = this.uploadedFiles || [];
    
    for (let file of Array.from(files)) {
      try {
        // Validate file
        if (file.size > 50 * 1024 * 1024) { // 50MB limit
          this.showError(`File ${file.name} exceeds 50MB limit`);
          continue;
        }

        // Show upload progress
        this.showUploadProgress(file.name);
        
        // Upload file
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await axios.post('/api/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        // Add to uploaded files
        this.uploadedFiles.push(response.data.attachment);
        
        // Update UI
        this.updateFileList();
        this.showSuccess(`Uploaded ${file.name}`);
        
      } catch (error) {
        console.error('Upload error:', error);
        this.showError(`Failed to upload ${file.name}`);
      }
    }
  }

  showUploadProgress(filename) {
    // Simple progress indicator
    const container = document.querySelector('.file-upload-area');
    container.innerHTML = `
      <i class="fas fa-spinner fa-spin text-blue-500 text-xl mb-2"></i>
      <p class="text-blue-600 text-sm">Uploading ${filename}...</p>
    `;
  }

  updateFileList() {
    const container = document.querySelector('.file-upload-area');
    
    if (this.uploadedFiles.length === 0) {
      container.innerHTML = `
        <i class="fas fa-upload text-gray-400 text-xl mb-2"></i>
        <p class="text-gray-600 text-sm">Click or drag files here (PDF, DOCX, Images)</p>
      `;
      return;
    }

    container.innerHTML = `
      <div class="space-y-2">
        ${this.uploadedFiles.map((file, index) => `
          <div class="flex items-center justify-between bg-green-50 border border-green-200 rounded p-2">
            <div class="flex items-center space-x-2">
              <i class="fas fa-file text-green-600"></i>
              <span class="text-sm text-green-700">${file.name}</span>
            </div>
            <button onclick="radiologyApp.removeFile(${index})" class="text-red-500 hover:text-red-700">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `).join('')}
        <div class="text-center mt-2">
          <button onclick="document.getElementById('file-input').click()" 
                  class="text-blue-600 hover:text-blue-800 text-sm">
            + Add more files
          </button>
        </div>
      </div>
    `;
  }

  removeFile(index) {
    this.uploadedFiles.splice(index, 1);
    this.updateFileList();
  }

  async loadUsage() {
    try {
      const response = await axios.get('/api/usage/me');
      const { usage, balance } = response.data;
      
      const creditsElement = document.getElementById('credits-remaining');
      if (creditsElement) {
        const remaining = balance.credits_granted - balance.credits_used;
        creditsElement.textContent = remaining.toLocaleString();
      }
    } catch (error) {
      console.error('Error loading usage:', error);
    }
  }

  renderAttachments(attachments) {
    if (!attachments || attachments.length === 0) return '';
    
    return `
      <div class="mt-2 space-y-1">
        ${attachments.map(file => `
          <div class="text-xs bg-blue-600 text-white px-2 py-1 rounded">
            <i class="fas fa-paperclip mr-1"></i>
            ${file.name}
          </div>
        `).join('')}
      </div>
    `;
  }

  renderJsonOutput(jsonOutput) {
    try {
      const data = JSON.parse(jsonOutput);
      return `
        <details class="mt-4">
          <summary class="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
            <i class="fas fa-code mr-1"></i>
            View Structured Data
          </summary>
          <pre class="report-json mt-2 text-xs overflow-x-auto">${JSON.stringify(data, null, 2)}</pre>
        </details>
      `;
    } catch (error) {
      return '';
    }
  }

  markdownToHtml(markdown) {
    // Simple markdown to HTML conversion
    return markdown
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mb-2">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold mb-2">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-md font-medium mb-2">$1</h3>')
      .replace(/^\*\*(.*$)/gim, '<p class="font-semibold">$1</p>')
      .replace(/^\* (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/\n/gim, '<br>');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full`;
    
    const colors = {
      error: 'bg-red-500 text-white',
      success: 'bg-green-500 text-white',
      info: 'bg-blue-500 text-white',
      warning: 'bg-yellow-500 text-black'
    };
    
    notification.className += ` ${colors[type]}`;
    notification.innerHTML = `
      <div class="flex items-center space-x-2">
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${message}</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.remove('translate-x-full');
    }, 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.classList.add('translate-x-full');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 5000);
  }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new RadiologyAssistant();
});