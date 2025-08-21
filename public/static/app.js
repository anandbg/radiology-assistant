// Radiology Assistant Frontend Application
class RadiologyAssistant {
  constructor() {
    this.currentChatId = null;
    this.templates = [];
    this.selectedTemplate = null;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.piiDetected = false;
    this.originalPIIText = '';
    this.cleanedPIIText = '';
    this.finalTranscript = '';
    
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
      // Check if clicked element or its parent is the send button
      const sendButton = e.target.closest('#send-button') || (e.target.id === 'send-button' ? e.target : null);
      if (sendButton) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🚀 Send button clicked!');
        this.sendMessage();
      } else if (e.target.id === 'record-button') {
        console.log('Record button clicked!');
        
        // Visual feedback immediately
        e.target.style.backgroundColor = 'orange';
        setTimeout(() => {
          e.target.style.backgroundColor = '';
        }, 200);
        
        this.toggleRecording();
      } else if (e.target.id === 'new-chat-button') {
        this.createNewChat();
      } else if (e.target.closest('.template-card')) {
        const templateId = e.target.closest('.template-card').dataset.templateId;
        this.selectTemplate(parseInt(templateId));
      } else if (e.target.closest('.chat-item')) {
        const chatElement = e.target.closest('.chat-item');
        const chatId = chatElement.dataset.chatId;
        console.log('🔄 Loading chat:', chatId);
        if (chatId) {
          this.loadChat(parseInt(chatId));
        } else {
          console.error('❌ No chat ID found on element:', chatElement);
        }
      }
    });

    // Enter key to send
    document.addEventListener('keydown', (e) => {
      if (e.target.id === 'message-input' && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        console.log('⌨️ Enter key pressed - sending message');
        this.sendMessage();
      }
    });

    // Add direct event listener for send button as backup
    setTimeout(() => {
      const sendBtn = document.getElementById('send-button');
      if (sendBtn) {
        sendBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('🚀 Direct send button clicked!');
          this.sendMessage();
        });
        console.log('✅ Direct send button listener added');
      }
    }, 1000);
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
              <!-- Usage Stats -->
              <div class="text-sm text-gray-600 space-y-1">
                <div class="flex items-center">
                  <i class="fas fa-coins mr-1"></i>
                  <span id="credits-remaining">Loading...</span> credits
                </div>
                <div class="flex items-center cursor-pointer" onclick="radiologyApp.showUsageDetails()">
                  <i class="fas fa-chart-line mr-1"></i>
                  <span id="tokens-used">0</span> tokens
                  <i class="fas fa-info-circle ml-1 text-gray-400"></i>
                </div>
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
                  <button id="record-button" class="record-button idle" title="Click to start/stop voice recording">
                    <i class="fas fa-microphone"></i>
                  </button>
                  <button id="send-button" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2 send-btn">
                    <i class="fas fa-paper-plane"></i>
                    <span>Send</span>
                  </button>
                </div>

                <!-- Recording Status -->
                <div id="recording-status" class="hidden mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                  <div class="flex items-center space-x-2">
                    <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span class="text-green-700 text-sm font-medium">🛡️ Privacy-first recording active - all processing happens locally</span>
                  </div>
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

    // Debug: Check if record button was created and add direct event listener
    setTimeout(() => {
      const button = document.getElementById('record-button');
      console.log('Record button found:', button);
      if (button) {
        console.log('Button innerHTML:', button.innerHTML);
        console.log('Button className:', button.className);
        
        // Add direct event listener as backup
        button.addEventListener('click', (e) => {
          console.log('Direct event listener triggered!');
          this.toggleRecording();
        });
        
        console.log('Direct event listener added to button');
      } else {
        console.error('Record button NOT found in DOM!');
      }
    }, 1000);

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
    console.log('📋 Loading chats...');
    try {
      const response = await axios.get('/api/chats');
      const chats = response.data.chats;
      console.log(`✅ Loaded ${chats.length} chats:`, chats);
      
      const chatsList = document.getElementById('chats-list');
      console.log('📍 chats-list element:', chatsList);
      
      if (!chatsList) {
        console.error('❌ chats-list element not found!');
        return;
      }
      
      if (chats.length === 0) {
        chatsList.innerHTML = '<div class="text-gray-500 text-sm">No chats yet</div>';
        return;
      }

      // Check if dayjs is available
      if (typeof dayjs === 'undefined') {
        console.error('❌ dayjs is not loaded!');
        chatsList.innerHTML = chats.map(chat => `
          <div class="chat-item p-2 hover:bg-gray-50 rounded cursor-pointer" data-chat-id="${chat.id}">
            <div class="font-medium text-sm truncate">${chat.title || 'Untitled'}</div>
            <div class="text-xs text-gray-500">${chat.updated_at}</div>
          </div>
        `).join('');
      } else {
        chatsList.innerHTML = chats.map(chat => `
          <div class="chat-item p-2 hover:bg-gray-50 rounded cursor-pointer" data-chat-id="${chat.id}">
            <div class="font-medium text-sm truncate">${chat.title || 'Untitled'}</div>
            <div class="text-xs text-gray-500">${dayjs(chat.updated_at).format('MMM D, h:mm A')}</div>
          </div>
        `).join('');
      }
      
      console.log(`✅ Rendered ${chats.length} chat items`);
    } catch (error) {
      console.error('❌ Error loading chats:', error);
      const chatsList = document.getElementById('chats-list');
      if (chatsList) {
        chatsList.innerHTML = '<div class="text-red-500 text-sm">Error loading chats</div>';
      }
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
    console.log(`🔄 Loading chat ${chatId}...`);
    
    try {
      // Show loading state
      const container = document.getElementById('messages-container');
      if (!container) {
        console.error('❌ messages-container element not found!');
        return;
      }
      
      container.innerHTML = `
        <div class="text-center text-gray-500 py-8">
          <div class="loading-spinner mb-4"></div>
          <p>Loading chat...</p>
        </div>
      `;

      this.currentChatId = chatId;
      console.log(`📡 Making API call to /api/chats/${chatId}/messages`);
      const response = await axios.get(`/api/chats/${chatId}/messages`);
      const messages = response.data.messages;
      
      console.log(`✅ Loaded ${messages.length} messages for chat ${chatId}:`, messages);
      this.displayMessages(messages);
      
      // Update active chat in sidebar
      document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('bg-blue-50', 'border-blue-200', 'border');
      });
      const activeChat = document.querySelector(`[data-chat-id="${chatId}"]`);
      if (activeChat) {
        activeChat.classList.add('bg-blue-50', 'border-blue-200', 'border');
      }
      
    } catch (error) {
      console.error('❌ Error loading chat:', error);
      
      // Show error state
      const container = document.getElementById('messages-container');
      container.innerHTML = `
        <div class="text-center text-red-500 py-8">
          <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
          <p>Failed to load chat</p>
          <button onclick="radiologyApp.loadChat(${chatId})" class="mt-2 text-blue-600 hover:text-blue-800">
            Try again
          </button>
        </div>
      `;
      
      this.showError('Failed to load chat: ' + (error.response?.data?.message || error.message));
    }
  }

  displayMessages(messages) {
    console.log(`🎨 Displaying ${messages.length} messages...`);
    const container = document.getElementById('messages-container');
    
    if (!container) {
      console.error('❌ messages-container not found in displayMessages!');
      return;
    }
    
    if (messages.length === 0) {
      console.log('📭 No messages to display');
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
        // Parse transcript data if it's JSON (new format with local + Whisper)
        let displayText = message.text || '';
        let transcriptInfo = '';
        
        if (message.transcript_text) {
          try {
            const transcriptData = JSON.parse(message.transcript_text);
            if (transcriptData.whisper_transcript) {
              displayText = transcriptData.combined_text || displayText;
              transcriptInfo = `<div class="text-xs text-gray-500 mt-1">✨ Enhanced with Whisper AI</div>`;
            }
          } catch (e) {
            // Legacy format - just use transcript_text
            displayText = displayText || message.transcript_text;
          }
        }
        
        return `
          <div class="message-user">
            <div class="text-sm">${this.escapeHtml(displayText)}</div>
            ${transcriptInfo}
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
            ${message.rendered_md ? this.renderDownloadButtons(message) : ''}
          </div>
        `;
      }
    }).join('');

    console.log('🎨 Messages HTML generated, updating container...');
    console.log('📏 Container HTML length:', container.innerHTML.length);
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
    console.log('✅ Messages displayed and scrolled to bottom');
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
    const sendButton = document.getElementById('send-button');
    const text = input.value.trim();
    
    // Prevent double-clicking
    if (sendButton.disabled) {
      console.log('Send already in progress');
      return;
    }
    
    // Check if we have any content to send
    // Use pendingAudioBlob if available (from recording results), otherwise localAudioBlob
    const audioBlob = this.pendingAudioBlob || this.localAudioBlob;
    const hasAudio = audioBlob && audioBlob.size > 0;
    const hasFiles = this.uploadedFiles && this.uploadedFiles.length > 0;
    const hasText = text && !text.includes('[Audio recorded') && !text.includes('will be transcribed on server]');
    
    if (!hasText && !hasAudio && !hasFiles) {
      console.log('No content to send');
      this.showError('Please enter text, record audio, or upload files before sending');
      return;
    }

    // Check if PII was detected and user hasn't made a choice yet
    if (this.piiDetected) {
      this.showError('Please choose how to handle the detected sensitive information before sending');
      return;
    }

    if (!this.currentChatId) {
      await this.createNewChat();
    }

    // Disable send button and show loading
    sendButton.disabled = true;\n    sendButton.classList.add('opacity-50', 'cursor-not-allowed');\n    console.log('🔒 Send button disabled');
    sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Sending...</span>';
    this.showLoading();
    
    try {
      // Clean the text (remove placeholder if present)
      const cleanText = hasText ? text : '';

      // Always use FormData when we have audio, otherwise use JSON
      if (hasAudio) {
        // Audio + text message
        const formData = new FormData();
        formData.append('text', cleanText);
        formData.append('template_id', this.selectedTemplate?.id || '');
        formData.append('attachments', JSON.stringify(this.uploadedFiles || []));
        formData.append('audio', audioBlob, 'recording.webm');

        console.log('Sending audio + text to server for processing');
        const response = await axios.post(`/api/chats/${this.currentChatId}/messages`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000 // 2 minute timeout
        });

        this.handleMessageResponse(response, input);
      } else {
        // Text-only message
        const messageData = {
          text: cleanText,
          template_id: this.selectedTemplate?.id,
          attachments: this.uploadedFiles || []
        };
        
        const response = await axios.post(`/api/chats/${this.currentChatId}/messages`, messageData, {
          timeout: 120000 // 2 minute timeout
        });
        this.handleMessageResponse(response, input);
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      this.clearLoading();
      
      if (error.response?.data?.error === 'PII_DETECTED') {
        this.showPIIWarning(error.response.data.detected_entities);
      } else if (error.code === 'ECONNABORTED') {
        this.showError('Request timed out. Please try again.');
      } else {
        this.showError('Failed to send message: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      // Always re-enable the button
      sendButton.disabled = false;\n      sendButton.classList.remove('opacity-50', 'cursor-not-allowed');\n      console.log('🔓 Send button re-enabled');
      sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> <span>Send</span>';
    }
  }

  handleMessageResponse(response, input) {
    // Clear loading state first
    this.clearLoading();
    
    // Handle PII detection error
    if (response.data.error === 'PII_DETECTED') {
      this.showPIIWarning(response.data.detected_entities);
      return;
    }
    
    // Clear input and reset state
    input.value = '';
    this.recordedChunks = [];
    this.uploadedFiles = [];
    this.localTranscript = '';
    this.localAudioBlob = null;
    this.pendingAudioBlob = null;
    this.piiDetected = false;
    
    // Reset file upload area
    this.updateFileList();
    
    // Show usage info
    if (response.data.usage) {
      this.showUsageInfo(response.data.usage);
    }
    
    // Reload messages
    this.loadChat(this.currentChatId).then(() => {
      // Update usage after loading
      this.loadUsage();
    }).catch((error) => {
      console.error('Error reloading messages:', error);
      this.showError('Failed to reload messages');
    });
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

  // Stage 1: Local transcription for PII detection
  startSpeechRecognition() {
    console.log('🎤 Starting local transcription for PII detection...');
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.log('❌ Local transcription not available - will use demo mode');
      this.useDemoTranscription();
      return false;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.localTranscript = '';

    this.recognition.onstart = () => {
      console.log('✅ Local transcription started');
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          this.localTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      // Update input with live transcription
      const input = document.getElementById('message-input');
      if (input) {
        input.value = this.localTranscript + interimTranscript;
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error === 'network') {
        console.log('Network error - using demo mode');
        this.useDemoTranscription();
      }
    };

    this.recognition.onend = () => {
      if (this.isRecording) {
        setTimeout(() => {
          if (this.isRecording) {
            try {
              this.recognition.start();
            } catch (e) {
              console.log('Restart failed');
            }
          }
        }, 100);
      }
    };

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      console.log('Speech recognition failed, using demo mode');
      this.useDemoTranscription();
      return false;
    }
  }

  // Demo transcription for testing when Web Speech API isn't available
  useDemoTranscription() {
    console.log('📋 Using demo transcription mode');
    
    // Simulate transcription after a delay
    setTimeout(() => {
      if (this.isRecording) {
        // Demo text with PII for testing
        this.localTranscript = "Patient John Smith, NHS number 123 456 7890, presented with chest pain. Contact at john.smith@email.com or call 0207 123 4567. Address: SW1A 1AA London.";
        
        const input = document.getElementById('message-input');
        if (input) {
          input.value = this.localTranscript;
        }
      }
    }, 2000);
  }

  // Local PII processing for transcripts (privacy-first)
  processTranscriptForPII(transcript) {
    console.log('Processing transcript for PII locally:', transcript);
    
    // UK Healthcare PII patterns (same as server-side but client-side)
    const piiPatterns = {
      nhsNumber: /\b(?:\d{3}\s*\d{3}\s*\d{4}|\d{10})\b/g, // NHS numbers
      postcode: /\b[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}\b/gi, // UK postcodes
      niNumber: /\b[A-Z]{2}\s*\d{2}\s*\d{2}\s*\d{2}\s*[A-Z]\b/gi, // National Insurance
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b(?:\+44|0)(?:\d{2}\s*\d{4}\s*\d{4}|\d{3}\s*\d{3}\s*\d{4}|\d{4}\s*\d{6})\b/g,
      dateOfBirth: /\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g
    };

    let cleanTranscript = transcript;
    let piiDetected = false;
    const detectedTypes = [];

    // Check and mask each PII type
    for (const [type, pattern] of Object.entries(piiPatterns)) {
      if (pattern.test(transcript)) {
        piiDetected = true;
        detectedTypes.push(type);
        
        // Mask the PII (replace with generic placeholders)
        switch (type) {
          case 'nhsNumber':
            cleanTranscript = cleanTranscript.replace(pattern, '[NHS-NUMBER]');
            break;
          case 'postcode':
            cleanTranscript = cleanTranscript.replace(pattern, '[POSTCODE]');
            break;
          case 'niNumber':
            cleanTranscript = cleanTranscript.replace(pattern, '[NI-NUMBER]');
            break;
          case 'email':
            cleanTranscript = cleanTranscript.replace(pattern, '[EMAIL]');
            break;
          case 'phone':
            cleanTranscript = cleanTranscript.replace(pattern, '[PHONE]');
            break;
          case 'dateOfBirth':
            cleanTranscript = cleanTranscript.replace(pattern, '[DATE]');
            break;
        }
      }
    }

    // Show PII warning if detected
    if (piiDetected) {
      this.showPIIDetectionWarning(detectedTypes, transcript, cleanTranscript);
    }

    return cleanTranscript;
  }

  // Show local PII detection warning with re-record option
  showPIIDetectionWarning(detectedTypes, originalText, cleanedText) {
    const warningDiv = document.getElementById('pii-warning');
    if (warningDiv) {
      const typesList = detectedTypes.join(', ');
      warningDiv.querySelector('.pii-warning-text').innerHTML = `
        <strong>⚠️ Sensitive Information Detected:</strong> ${typesList}<br>
        <div class="mt-2 space-x-2">
          <button onclick="radiologyApp.acceptMaskedTranscript()" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
            ✅ Use Masked Version
          </button>
          <button onclick="radiologyApp.reRecord()" class="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm">
            🎤 Re-record Without PII
          </button>
          <button onclick="radiologyApp.showPIIComparison('${originalText.replace(/'/g, "\\'")}', '${cleanedText.replace(/'/g, "\\'")}')\" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
            👀 Show What Was Masked
          </button>
        </div>
      `;
      warningDiv.classList.remove('hidden');
      
      console.log('PII detected and masked locally:', {
        types: detectedTypes,
        original: originalText,
        cleaned: cleanedText
      });
      
      // Don't auto-hide - user needs to make a choice
      this.piiDetected = true;
      this.originalPIIText = originalText;
      this.cleanedPIIText = cleanedText;
    }
  }

  acceptMaskedTranscript() {
    const warningDiv = document.getElementById('pii-warning');
    warningDiv.classList.add('hidden');
    this.piiDetected = false;
    console.log('User accepted masked transcript');
  }

  processFinalTranscript() {
    const input = document.getElementById('message-input');
    if (!input || !input.value.trim()) {
      console.log('No transcript to process - using audio-only mode');
      return;
    }

    const transcript = input.value.trim();
    
    // Skip processing if it's just the placeholder text
    if (transcript.includes('[Audio recorded') && transcript.includes('will be transcribed on server]')) {
      console.log('Audio-only mode - PII detection will happen on server');
      return;
    }

    console.log('Processing transcript for PII:', transcript);

    // Run PII detection on the transcript (only if we have actual text)
    const piiResult = this.detectPIILocally(transcript);
    
    if (piiResult.detected) {
      // Show PII warning with options
      this.showPIIResults(piiResult, transcript);
    } else {
      console.log('No PII detected - transcript is clean');
    }
  }

  detectPIILocally(text) {
    const piiPatterns = {
      nhsNumber: /\b(?:\d{3}\s*\d{3}\s*\d{4}|\d{10})\b/g,
      postcode: /\b[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}\b/gi,
      niNumber: /\b[A-Z]{2}\s*\d{2}\s*\d{2}\s*\d{2}\s*[A-Z]\b/gi,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b(?:\+44|0)(?:\d{2}\s*\d{4}\s*\d{4}|\d{3}\s*\d{3}\s*\d{4}|\d{4}\s*\d{6})\b/g,
      // Date patterns - various formats including spoken dates like "24th of seven 1975"
      dateOfBirth: /\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+\d{4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|date\s+of\s+birth\s+is\s+[^\,\.]+|\d{1,2}(?:st|nd|rd|th)?\s+of\s+\w+\s+\d{4})\b/gi,
      // Patient names - common patterns
      patientName: /\b(?:patient|mr|mrs|ms|miss|dr)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/gi,
      // Simple date of birth phrase detection
      dobPhrase: /\b(?:date\s+of\s+birth|d\.?o\.?b\.?|born\s+(?:on\s+)?|birthday)\s+is\s+[^\.!?]*\d{4}\b/gi
    };

    let detected = false;
    const detectedTypes = [];
    let cleanText = text;

    for (const [type, pattern] of Object.entries(piiPatterns)) {
      if (pattern.test(text)) {
        detected = true;
        detectedTypes.push(type);
        // Custom replacements for different PII types
        switch (type) {
          case 'nhsNumber':
            cleanText = cleanText.replace(pattern, '[NHS-NUMBER]');
            break;
          case 'postcode':
            cleanText = cleanText.replace(pattern, '[POSTCODE]');
            break;
          case 'niNumber':
            cleanText = cleanText.replace(pattern, '[NI-NUMBER]');
            break;
          case 'email':
            cleanText = cleanText.replace(pattern, '[EMAIL]');
            break;
          case 'phone':
            cleanText = cleanText.replace(pattern, '[PHONE]');
            break;
          case 'dateOfBirth':
            cleanText = cleanText.replace(pattern, '[DATE-OF-BIRTH]');
            break;
          case 'patientName':
            cleanText = cleanText.replace(pattern, '[PATIENT-NAME]');
            break;
          case 'dobPhrase':
            cleanText = cleanText.replace(pattern, '[DATE-OF-BIRTH-INFORMATION]');
            break;
          default:
            cleanText = cleanText.replace(pattern, `[${type.toUpperCase()}]`);
        }
      }
    }

    return {
      detected,
      types: detectedTypes,
      originalText: text,
      cleanedText: cleanText
    };
  }

  showPIIResults(piiResult, originalText) {
    const warningDiv = document.getElementById('pii-warning');
    if (warningDiv) {
      const typesList = piiResult.types.join(', ');
      warningDiv.querySelector('.pii-warning-text').innerHTML = `
        <strong>⚠️ Sensitive Information Detected:</strong> ${typesList}<br>
        <div class="mt-2 space-x-2">
          <button onclick="radiologyApp.useMaskedVersion('${piiResult.cleanedText.replace(/'/g, "\\'")}')\" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
            ✅ Use Masked Version
          </button>
          <button onclick="radiologyApp.reRecord()" class="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm">
            🎤 Re-record
          </button>
        </div>
      `;
      warningDiv.classList.remove('hidden');
      this.piiDetected = true;
    }
  }

  useMaskedVersion(cleanedText) {
    const input = document.getElementById('message-input');
    if (input) {
      input.value = cleanedText;
    }
    document.getElementById('pii-warning').classList.add('hidden');
    this.piiDetected = false;
    console.log('User accepted masked version');
  }

  displayRecordingResults() {
    console.log('📋 Processing recording results...');
    
    const transcript = this.localTranscript || '';
    const audioSize = Math.round((this.localAudioBlob?.size || 0) / 1024);
    
    if (!transcript && audioSize === 0) {
      console.log('❌ No audio or transcript captured');
      return;
    }

    // Process transcript for PII
    const piiResult = this.detectPIILocally(transcript);
    
    // Create the results display
    this.showRecordingResultsInChat(transcript, piiResult, audioSize);
    
    // Clear input
    const input = document.getElementById('message-input');
    if (input) {
      input.value = '';
    }
  }

  showRecordingResultsInChat(transcript, piiResult, audioSizeKB) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;

    // Remove any existing recording results
    const existingResults = messagesContainer.querySelector('.recording-results');
    if (existingResults) {
      existingResults.remove();
    }

    // Create the results display
    const resultsDiv = document.createElement('div');
    resultsDiv.className = 'recording-results p-4 mb-4 bg-blue-50 border border-blue-200 rounded-lg';
    
    let transcriptDisplay = '';
    if (transcript) {
      // Mark PII in bold
      transcriptDisplay = this.markPIIInText(transcript, piiResult);
    } else {
      transcriptDisplay = '<em class="text-gray-500">No local transcription available - audio will be transcribed by server</em>';
    }
    
    const piiWarning = piiResult.detected ? 
      `<div class="text-orange-600 text-sm mb-2">⚠️ <strong>PII Detected:</strong> ${piiResult.types.join(', ')}</div>` : 
      '<div class="text-green-600 text-sm mb-2">✅ No PII detected</div>';

    resultsDiv.innerHTML = `
      <div class="flex items-start space-x-3">
        <div class="flex-shrink-0">
          <i class="fas fa-microphone text-blue-600 text-lg"></i>
        </div>
        <div class="flex-1">
          <h4 class="font-semibold text-gray-900 mb-2">Recording Complete</h4>
          
          <!-- Audio File -->
          <div class="bg-white p-3 rounded border mb-3">
            <div class="flex items-center space-x-2">
              <i class="fas fa-file-audio text-gray-600"></i>
              <span class="text-sm text-gray-700">Audio file: ${audioSizeKB}KB</span>
              <span class="text-xs text-gray-500">(webm format)</span>
            </div>
          </div>
          
          <!-- Local Transcription with PII marking -->
          <div class="bg-white p-3 rounded border mb-3">
            <h5 class="text-sm font-medium text-gray-700 mb-2">Local Transcription (for PII detection):</h5>
            <div class="text-sm text-gray-800">${transcriptDisplay}</div>
          </div>
          
          <!-- PII Detection Results -->
          ${piiWarning}
          
          <!-- Action Buttons -->
          <div class="flex space-x-3 mt-4">
            <button onclick="radiologyApp.sendRecordingToLLM()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm flex items-center space-x-2">
              <i class="fas fa-paper-plane"></i>
              <span>Send to LLM</span>
            </button>
            <button onclick="radiologyApp.deleteAndReRecord()" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm flex items-center space-x-2">
              <i class="fas fa-trash"></i>
              <span>Delete & Re-record</span>
            </button>
          </div>
          
          <div class="text-xs text-gray-500 mt-2">
            💡 The audio will be sent to the LLM (Whisper) for more accurate transcription
          </div>
        </div>
      </div>
    `;

    // Insert at the bottom of messages
    messagesContainer.appendChild(resultsDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  markPIIInText(text, piiResult) {
    if (!piiResult.detected) {
      return text;
    }

    let markedText = text;
    
    // PII patterns with replacement to bold
    const piiPatterns = {
      nhsNumber: { 
        regex: /\b(?:\d{3}\s*\d{3}\s*\d{4}|\d{10})\b/g, 
        replacement: '<strong class="bg-yellow-200">$&</strong>'
      },
      postcode: { 
        regex: /\b[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}\b/gi, 
        replacement: '<strong class="bg-yellow-200">$&</strong>'
      },
      email: { 
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, 
        replacement: '<strong class="bg-yellow-200">$&</strong>'
      },
      phone: { 
        regex: /\b(?:\+44|0)(?:\d{2}\s*\d{4}\s*\d{4}|\d{3}\s*\d{3}\s*\d{4}|\d{4}\s*\d{6})\b/g, 
        replacement: '<strong class="bg-yellow-200">$&</strong>'
      }
    };

    // Apply highlighting for detected PII types
    piiResult.types.forEach(type => {
      if (piiPatterns[type]) {
        markedText = markedText.replace(piiPatterns[type].regex, piiPatterns[type].replacement);
      }
    });

    return markedText;
  }

  sendRecordingToLLM() {
    console.log('📤 Sending recording to LLM...');
    
    // Remove the results display
    const resultsDiv = document.querySelector('.recording-results');
    if (resultsDiv) {
      resultsDiv.remove();
    }
    
    // Send the message with both transcript and audio
    this.sendMessage();
  }

  deleteAndReRecord() {
    console.log('🗑️ Deleting recording and starting new one...');
    
    // Clear everything
    this.localTranscript = '';
    this.localAudioBlob = null;
    this.recordedChunks = [];
    
    // Remove the results display
    const resultsDiv = document.querySelector('.recording-results');
    if (resultsDiv) {
      resultsDiv.remove();
    }
    
    // Start new recording
    this.toggleRecording();
  }

  reRecord() {
    const input = document.getElementById('message-input');
    if (input) {
      input.value = '';
    }
    this.finalTranscript = '';
    const warningDiv = document.getElementById('pii-warning');
    if (warningDiv) {
      warningDiv.classList.add('hidden');
    }
    this.piiDetected = false;
    
    // Start recording again
    this.toggleRecording();
  }

  stopLocalAudioTranscription() {
    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
        console.log('🛑 Speech recognition stopped');
        
        // Finalize transcript (already PII-processed)
        const input = document.getElementById('message-input');
        if (input && this.localTranscript) {
          const finalText = this.localTranscript.trim();
          input.value = finalText;
          
          const wordCount = finalText.split(' ').length;
          console.log(`✅ Transcription complete: ${wordCount} words (PII-safe)`);
        } else if (input) {
          console.log('⚠️ No transcript generated during recording');
          // Add placeholder to show recording happened
          if (!input.value.trim()) {
            input.value = '[Audio recorded - local transcription may not have captured speech]';
          }
        }
        
        this.speechRecognition = null;
        this.localTranscript = '';
        this.interimTranscript = '';
        this.speechStarted = false;
        this.speechResults = false;
      } catch (error) {
        console.error('❌ Error stopping speech recognition:', error);
      }
    } else {
      console.log('⚠️ No speech recognition to stop');
    }
  }

  // Send audio to Whisper for enhanced transcription (automatic with local transcript)
  async transcribeAudioWithWhisper() {
    if (!this.localAudioBlob) {
      console.warn('No local audio available for Whisper transcription');
      return null;
    }
    
    try {
      console.log('Sending audio to Whisper API for enhanced transcription...');
      
      const formData = new FormData();
      formData.append('audio', this.localAudioBlob, 'recording.webm');
      
      const response = await axios.post('/api/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      console.log('Whisper transcription received:', response.data.transcript);
      return response.data.transcript;
    } catch (error) {
      console.error('Error transcribing audio with Whisper:', error);
      // Don't show error to user - just log it and continue with local transcript
      console.log('Continuing with local transcript only');
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
    
    // Remove any existing loading indicators
    this.clearLoading();
    
    const loading = document.createElement('div');
    loading.className = 'message-assistant loading-message';
    loading.id = 'loading-indicator';
    loading.innerHTML = `
      <div class="flex items-center space-x-2">
        <div class="loading-spinner"></div>
        <span class="text-gray-600">Generating report...</span>
      </div>
    `;
    container.appendChild(loading);
    container.scrollTop = container.scrollHeight;
  }
  
  clearLoading() {
    const loadingElement = document.getElementById('loading-indicator');
    if (loadingElement) {
      loadingElement.remove();
    }
    
    // Also remove any loading messages by class
    const loadingMessages = document.querySelectorAll('.loading-message');
    loadingMessages.forEach(el => el.remove());
  }

  async toggleRecording() {
    console.log('Toggle recording clicked, current state:', this.isRecording);
    
    if (this.isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  async startRecording() {
    console.log('🎤 Starting recording...');
    console.log('🌍 Environment check:', {
      userAgent: navigator.userAgent,
      webdriver: navigator.webdriver,
      headless: navigator.userAgent.includes('HeadlessChrome'),
      mediaDevices: !!navigator.mediaDevices,
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      mediaRecorder: !!window.MediaRecorder
    });
    
    try {
      // Check for MediaDevices API first
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API not supported');
      }

      // Get microphone access with specific constraints
      console.log('🎯 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      console.log('✅ Got media stream');
      console.log('🔧 Stream tracks:', stream.getTracks().map(track => ({
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState,
        settings: track.getSettings ? track.getSettings() : 'N/A'
      })));

      // Check MediaRecorder support
      if (!window.MediaRecorder) {
        throw new Error('MediaRecorder not supported');
      }

      console.log('🎵 Initializing MediaRecorder...');
      console.log('🔧 MediaRecorder supported formats:', {
        'audio/webm': MediaRecorder.isTypeSupported('audio/webm'),
        'audio/webm;codecs=opus': MediaRecorder.isTypeSupported('audio/webm;codecs=opus'),
        'audio/mp4': MediaRecorder.isTypeSupported('audio/mp4'),
        'audio/wav': MediaRecorder.isTypeSupported('audio/wav')
      });

      // Try different MIME types if webm isn't supported
      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
        console.log('✅ Using audio/webm;codecs=opus');
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
        console.log('✅ Using audio/webm');
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        options = { mimeType: 'audio/wav' };
        console.log('✅ Using audio/wav');
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
        console.log('✅ Using audio/mp4');
      } else {
        console.log('⚠️ Using default MediaRecorder options');
      }

      this.mediaRecorder = new MediaRecorder(stream, options);
      this.recordedChunks = [];
      
      console.log('✅ MediaRecorder created. State:', this.mediaRecorder.state);

      this.mediaRecorder.ondataavailable = (event) => {
        console.log('📊 Data available - size:', event.data.size, 'bytes, type:', event.data.type);
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
          console.log('✅ Added chunk. Total chunks:', this.recordedChunks.length);
        } else {
          console.warn('⚠️ Received empty data chunk');
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        this.localAudioBlob = blob;
        console.log('✅ Audio recording stopped. Blob size:', blob.size, 'bytes');
        console.log('📊 Recorded chunks:', this.recordedChunks.length);
        
        if (blob.size === 0) {
          console.error('❌ Audio recording failed - no data captured!');
          console.log('🔍 MediaRecorder state:', this.mediaRecorder.state);
          console.log('🔍 Recorded chunks details:', this.recordedChunks.map(chunk => ({
            size: chunk.size,
            type: chunk.type
          })));
        }
      };

      // Start Speech Recognition for real-time transcription
      const speechStarted = this.startSpeechRecognition();
      if (!speechStarted) {
        console.log('Speech recognition not available - audio-only recording');
      }

      // Add error handling for MediaRecorder
      this.mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event.error);
      };

      this.mediaRecorder.onstart = () => {
        console.log('✅ MediaRecorder started successfully');
      };

      // Start MediaRecorder with data collection every 100ms
      console.log('🚀 Starting MediaRecorder...');
      this.mediaRecorder.start(100); // Collect data every 100ms for better capture
      this.isRecording = true;
      
      console.log('✅ Recording started with 100ms intervals');
      
      // Show recording status
      const status = document.getElementById('recording-status');
      if (status) {
        status.classList.remove('hidden');
      }

      // Update button appearance
      const button = document.getElementById('record-button');
      if (button) {
        button.className = 'record-button recording';
        button.innerHTML = '<i class="fas fa-stop"></i>';
        button.title = 'Stop recording';
      }

      console.log('Recording and transcription started');
      
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      console.error('🔍 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      let errorMessage = 'Failed to start recording. ';
      let showErrorToUser = false;
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Microphone permission denied. Please allow microphone access and try again.';
        showErrorToUser = true;
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone and try again.';
        showErrorToUser = true;
      } else if (error.name === 'NotSupportedError') {
        errorMessage += 'Audio recording not supported in this browser.';
        showErrorToUser = true;
      } else if (error.message.includes('MediaDevices API not supported')) {
        errorMessage += 'Your browser does not support audio recording.';
        showErrorToUser = true;
      } else if (error.message.includes('MediaRecorder not supported')) {
        errorMessage += 'Audio recording not available in this browser.';
        showErrorToUser = true;
      } else {
        errorMessage += error.message;
        // For testing environments, don't show generic errors
        console.log('💡 This might be a testing environment without real microphone access');
      }
      
      if (showErrorToUser) {
        this.showError(errorMessage);
      } else {
        // Just show in UI that recording is not available
        const input = document.getElementById('message-input');
        if (input) {
          input.placeholder = 'Type your message (audio recording not available in this environment)';
        }
      }
    }
  }

  stopRecording() {
    console.log('Stopping recording...');
    
    if (this.mediaRecorder && this.isRecording) {
      try {
        this.mediaRecorder.stop();
        
        // Stop all tracks
        if (this.mediaRecorder.stream) {
          this.mediaRecorder.stream.getTracks().forEach(track => {
            track.stop();
            console.log('Stopped track:', track.kind);
          });
        }
        
        this.isRecording = false;
        
        // Update button appearance
        const button = document.getElementById('record-button');
        if (button) {
          button.className = 'record-button idle';
          button.innerHTML = '<i class="fas fa-microphone"></i>';
          button.title = 'Start recording';
        }

        // Hide recording status
        const status = document.getElementById('recording-status');
        if (status) {
          status.classList.add('hidden');
        }

        // Stop speech recognition (if it was running)
        if (this.recognition) {
          this.recognition.stop();
        }

        // Reset input appearance
        const input = document.getElementById('message-input');
        if (input) {
          input.placeholder = 'Describe the case, upload images, or use voice recording...';
          input.style.background = '';
        }

        // Process and display results in chat window
        setTimeout(() => {
          this.displayRecordingResults();
        }, 500);
        
        console.log('Recording stopped successfully');
        
      } catch (error) {
        console.error('Error stopping recording:', error);
        // No popup for stop errors
      }
    } else {
      console.warn('No active recording to stop');
    }
  }

  // Display recording results in chat window with PII-marked transcription
  displayRecordingResults() {
    console.log('📋 Displaying recording results in chat...');
    
    const transcript = this.localTranscript || '';
    const audioSize = this.localAudioBlob ? Math.round(this.localAudioBlob.size / 1024) : 0;
    
    console.log('Recording results:', {
      transcriptLength: transcript.length,
      audioSizeKB: audioSize,
      hasAudio: !!this.localAudioBlob
    });

    // Process transcript for PII detection
    const piiResult = this.detectPIILocally(transcript);
    
    // Display results in chat
    this.showRecordingResultsInChat(transcript, piiResult, audioSize);
  }

  // Show recording results in chat window with audio file and PII-marked transcription
  showRecordingResultsInChat(transcript, piiResult, audioSizeKB) {
    console.log('💬 Adding recording results to chat window');
    
    const container = document.getElementById('messages-container');
    if (!container) {
      console.error('Messages container not found');
      return;
    }

    // Create results message div
    const resultsDiv = document.createElement('div');
    resultsDiv.className = 'message-user mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg';
    
    // Create transcript display with PII marking
    const transcriptDisplay = piiResult.detected 
      ? this.markPIIInText(transcript, piiResult)
      : transcript || 'No transcription available (audio-only recording)';
    
    // Build the results HTML
    resultsDiv.innerHTML = `
      <div class="recording-results">
        <div class="mb-3">
          <h4 class="text-sm font-semibold text-gray-700 mb-2">
            <i class="fas fa-microphone mr-2"></i>Recording Complete
          </h4>
        </div>
        
        <!-- Audio File -->
        <div class="bg-white p-3 rounded border mb-3">
          <div class="flex items-center space-x-2">
            <i class="fas fa-file-audio text-blue-600"></i>
            <span class="text-sm text-gray-700">Audio file: ${audioSizeKB}KB</span>
            ${audioSizeKB > 0 ? '<i class="fas fa-check-circle text-green-500 ml-2"></i>' : '<i class="fas fa-exclamation-triangle text-yellow-500 ml-2"></i>'}
          </div>
        </div>
        
        <!-- Local Transcription with PII marking -->
        <div class="bg-white p-3 rounded border mb-3">
          <div class="text-xs text-gray-500 mb-1 uppercase tracking-wide">Local Transcription${piiResult.detected ? ' (PII Detected)' : ''}</div>
          <div class="text-sm text-gray-800 leading-relaxed">${transcriptDisplay}</div>
          ${piiResult.detected ? `
            <div class="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
              <div class="text-xs text-yellow-800">
                <i class="fas fa-exclamation-triangle mr-1"></i>
                <strong>PII Detected:</strong> ${piiResult.types.join(', ')} - highlighted in yellow
              </div>
            </div>
          ` : ''}
        </div>
        
        <!-- Action Buttons -->
        <div class="flex space-x-3 mt-4">
          <button onclick="radiologyApp.sendRecordingToLLM()" 
                  class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium">
            <i class="fas fa-paper-plane mr-2"></i>Send to LLM
          </button>
          <button onclick="radiologyApp.deleteAndReRecord()" 
                  class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium">
            <i class="fas fa-trash mr-2"></i>Delete & Re-record
          </button>
        </div>
      </div>
    `;
    
    // Add to chat and scroll to view
    container.appendChild(resultsDiv);
    container.scrollTop = container.scrollHeight;
    
    console.log('✅ Recording results displayed in chat');
  }

  // Mark PII in text with bold and yellow background
  markPIIInText(text, piiResult) {
    if (!piiResult.detected) return text;
    
    let markedText = text;
    
    // Define PII patterns (same as detectPIILocally)
    const piiPatterns = {
      nhsNumber: /\b(?:\d{3}\s*\d{3}\s*\d{4}|\d{10})\b/g,
      postcode: /\b[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}\b/gi,
      niNumber: /\b[A-Z]{2}\s*\d{2}\s*\d{2}\s*\d{2}\s*[A-Z]\b/gi,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b(?:\+44|0)(?:\d{2}\s*\d{4}\s*\d{4}|\d{3}\s*\d{3}\s*\d{4}|\d{4}\s*\d{6})\b/g,
      // Date patterns - various formats including spoken dates like "24th of seven 1975"
      dateOfBirth: /\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+\d{4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|date\s+of\s+birth\s+is\s+[^\,\.]+|\d{1,2}(?:st|nd|rd|th)?\s+of\s+\w+\s+\d{4})\b/gi,
      // Patient names - common patterns
      patientName: /\b(?:patient|mr|mrs|ms|miss|dr)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/gi,
      // Simple date of birth phrase detection
      dobPhrase: /\b(?:date\s+of\s+birth|d\.?o\.?b\.?|born\s+(?:on\s+)?|birthday)\s+is\s+[^\.!?]*\d{4}\b/gi
    };

    // Highlight each detected PII type
    for (const [type, pattern] of Object.entries(piiPatterns)) {
      if (piiResult.types.includes(type)) {
        markedText = markedText.replace(pattern, '<strong class="bg-yellow-200 px-1 rounded">$&</strong>');
      }
    }
    
    return markedText;
  }

  // Send recording (audio + transcript) to LLM
  sendRecordingToLLM() {
    console.log('📤 Sending recording to LLM...');
    
    if (!this.localAudioBlob && !this.localTranscript) {
      console.error('No audio or transcript to send');
      return;
    }

    // Use the existing sendMessage logic but with our recorded audio and transcript
    const input = document.getElementById('message-input');
    if (input) {
      // Set the transcript in the input field
      input.value = this.localTranscript || '[Audio recording - will be transcribed on server]';
    }

    // Temporarily store the audio blob for sending
    this.pendingAudioBlob = this.localAudioBlob;
    
    // Send the message using existing logic
    this.sendMessage();
    
    // Clear the temporary data after sending
    this.clearRecordingData();
  }

  // Delete recording and start new recording
  deleteAndReRecord() {
    console.log('🗑️ Deleting recording and preparing to re-record...');
    
    // Clear all recording data
    this.clearRecordingData();
    
    // Clear the chat message showing the results
    const container = document.getElementById('messages-container');
    const recordingResults = container?.querySelector('.recording-results')?.closest('.message-user');
    if (recordingResults) {
      recordingResults.remove();
    }
    
    // Start new recording
    this.startRecording();
  }

  // Clear all recording-related data
  clearRecordingData() {
    this.localAudioBlob = null;
    this.localTranscript = '';
    this.recordedChunks = [];
    this.pendingAudioBlob = null;
    
    // Clear input field
    const input = document.getElementById('message-input');
    if (input) {
      input.value = '';
      input.placeholder = 'Describe the case, upload images, or use voice recording...';
    }
    
    console.log('🧹 Recording data cleared');
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
        console.log(`Uploaded ${file.name}`);
        
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
      
      // Update credits display
      const creditsElement = document.getElementById('credits-remaining');
      if (creditsElement) {
        const remaining = balance.credits_granted - balance.credits_used;
        creditsElement.textContent = remaining.toLocaleString();
      }

      // Update tokens display
      const tokensElement = document.getElementById('tokens-used');
      if (tokensElement && usage) {
        const totalTokens = usage.input_tokens + usage.output_tokens + (usage.transcription_duration || 0);
        tokensElement.textContent = totalTokens.toLocaleString();
      }

      // Store usage data for details modal
      this.currentUsage = { usage, balance };
      
    } catch (error) {
      console.error('Error loading usage:', error);
      // Set fallback values
      const tokensElement = document.getElementById('tokens-used');
      if (tokensElement) tokensElement.textContent = 'N/A';
    }
  }

  // Show detailed usage information in a modal
  showUsageDetails() {
    if (!this.currentUsage) {
      this.showError('Usage information not available');
      return;
    }

    const { usage, balance } = this.currentUsage;
    
    // Calculate costs based on OpenAI pricing (approximate)
    const inputCost = (usage.input_tokens / 1000) * 0.0015; // GPT-4o input tokens
    const outputCost = (usage.output_tokens / 1000) * 0.006; // GPT-4o output tokens  
    const transcriptionCost = (usage.transcription_duration / 60) * 0.006; // Whisper per minute
    const totalCost = inputCost + outputCost + transcriptionCost;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };
    
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Usage & Costs</h3>
          <button onclick="document.body.removeChild(this.closest('.fixed'))" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <!-- Credits -->
        <div class="mb-6">
          <h4 class="text-sm font-medium text-gray-700 mb-2">Credits</h4>
          <div class="bg-gray-50 rounded-lg p-3">
            <div class="flex justify-between text-sm">
              <span>Granted:</span>
              <span>${balance.credits_granted?.toLocaleString() || 0}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span>Used:</span>
              <span>${balance.credits_used?.toLocaleString() || 0}</span>
            </div>
            <div class="flex justify-between text-sm font-semibold border-t pt-1 mt-1">
              <span>Remaining:</span>
              <span>${((balance.credits_granted || 0) - (balance.credits_used || 0)).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <!-- Token Usage -->
        <div class="mb-6">
          <h4 class="text-sm font-medium text-gray-700 mb-2">Token Usage</h4>
          <div class="bg-gray-50 rounded-lg p-3 space-y-2">
            <div class="flex justify-between text-sm">
              <span>Input tokens:</span>
              <span>${usage.input_tokens?.toLocaleString() || 0}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span>Output tokens:</span>
              <span>${usage.output_tokens?.toLocaleString() || 0}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span>Audio minutes:</span>
              <span>${((usage.transcription_duration || 0) / 60).toFixed(1)}</span>
            </div>
          </div>
        </div>

        <!-- Estimated Costs -->
        <div class="mb-6">
          <h4 class="text-sm font-medium text-gray-700 mb-2">Estimated OpenAI Costs</h4>
          <div class="bg-blue-50 rounded-lg p-3 space-y-1">
            <div class="flex justify-between text-sm">
              <span>Input:</span>
              <span>$${inputCost.toFixed(4)}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span>Output:</span>
              <span>$${outputCost.toFixed(4)}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span>Transcription:</span>
              <span>$${transcriptionCost.toFixed(4)}</span>
            </div>
            <div class="flex justify-between text-sm font-semibold border-t pt-1 mt-1">
              <span>Total:</span>
              <span>$${totalCost.toFixed(4)}</span>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-2">
            * Estimates based on current OpenAI pricing. Actual costs may vary.
          </p>
        </div>

        <div class="text-center">
          <button onclick="document.body.removeChild(this.closest('.fixed'))" 
                  class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
            Close
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
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

  renderDownloadButtons(message) {
    return `
      <div class="mt-4 pt-3 border-t border-gray-200">
        <div class="flex flex-wrap gap-2">
          <button onclick="radiologyApp.downloadAsMarkdown(${message.id}, '${this.escapeForAttribute(message.text || 'report')}')" 
                  class="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors">
            <i class="fas fa-download mr-1"></i>
            Download .md
          </button>
          <button onclick="radiologyApp.downloadAsJson(${message.id}, '${this.escapeForAttribute(message.text || 'report')}')" 
                  class="inline-flex items-center px-3 py-1 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-md transition-colors">
            <i class="fas fa-download mr-1"></i>
            Download .json
          </button>
          <button onclick="radiologyApp.copyToClipboard('${message.id}-content')" 
                  class="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors">
            <i class="fas fa-copy mr-1"></i>
            Copy Text
          </button>
        </div>
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

  escapeForAttribute(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
  }

  // Download assistant message as markdown file
  async downloadAsMarkdown(messageId, filename) {
    try {
      console.log('📥 Downloading markdown for message:', messageId);
      
      // Find the message in current chat
      const response = await axios.get(`/api/chats/${this.currentChatId}/messages`);
      const message = response.data.messages.find(msg => msg.id === messageId);
      
      if (!message || !message.rendered_md) {
        this.showError('No markdown content found for this message');
        return;
      }

      // Create markdown content with metadata
      const timestamp = new Date(message.created_at).toLocaleDateString();
      const markdownContent = `# Radiology Report

**Generated**: ${timestamp}
**Chat ID**: ${this.currentChatId}
**Message ID**: ${messageId}

---

${message.rendered_md}

---

*Generated by Radiology Assistant*
`;

      // Create and download file
      this.downloadFile(markdownContent, `${this.sanitizeFilename(filename)}-${timestamp}.md`, 'text/markdown');
      console.log('✅ Markdown download initiated');
      
    } catch (error) {
      console.error('❌ Error downloading markdown:', error);
      this.showError('Failed to download markdown file');
    }
  }

  // Download assistant message as JSON file
  async downloadAsJson(messageId, filename) {
    try {
      console.log('📥 Downloading JSON for message:', messageId);
      
      // Find the message in current chat
      const response = await axios.get(`/api/chats/${this.currentChatId}/messages`);
      const message = response.data.messages.find(msg => msg.id === messageId);
      
      if (!message) {
        this.showError('Message not found');
        return;
      }

      // Create comprehensive JSON export
      const jsonExport = {
        metadata: {
          messageId: message.id,
          chatId: this.currentChatId,
          generated: new Date(message.created_at).toISOString(),
          template: message.template_name || 'Unknown',
          exportedAt: new Date().toISOString()
        },
        content: {
          markdownReport: message.rendered_md || null,
          structuredData: message.json_output ? JSON.parse(message.json_output) : null,
          citations: message.citations_json ? JSON.parse(message.citations_json) : [],
        },
        original: {
          userInput: message.text || '',
          piiDetected: !!message.pii_detected,
          attachments: message.attachments_json ? JSON.parse(message.attachments_json) : []
        }
      };

      const timestamp = new Date(message.created_at).toLocaleDateString();
      this.downloadFile(JSON.stringify(jsonExport, null, 2), `${this.sanitizeFilename(filename)}-${timestamp}.json`, 'application/json');
      console.log('✅ JSON download initiated');
      
    } catch (error) {
      console.error('❌ Error downloading JSON:', error);
      this.showError('Failed to download JSON file');
    }
  }

  // Copy message content to clipboard
  async copyToClipboard(messageId) {
    try {
      const response = await axios.get(`/api/chats/${this.currentChatId}/messages`);
      const message = response.data.messages.find(msg => msg.id.toString() === messageId.replace('-content', ''));
      
      if (!message || !message.rendered_md) {
        this.showError('No content to copy');
        return;
      }

      await navigator.clipboard.writeText(message.rendered_md);
      this.showSuccess('Report copied to clipboard!');
      
    } catch (error) {
      console.error('❌ Error copying to clipboard:', error);
      this.showError('Failed to copy to clipboard');
    }
  }

  // Utility function to download files
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Sanitize filename for downloads
  sanitizeFilename(filename) {
    return filename
      .replace(/[^\w\s-]/g, '') // Remove special characters except spaces, hyphens, underscores
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .toLowerCase()
      .substring(0, 50); // Limit length
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
  window.radiologyApp = new RadiologyAssistant();
  console.log('Radiology Assistant initialized successfully');
  
  console.log('Radiology Assistant initialized and ready');
});