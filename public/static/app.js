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
        // Default to MRI Lumbar Spine template (most comprehensive)
        const mriTemplate = this.templates.find(t => t.name.includes('MRI Lumbar Spine'));
        this.selectedTemplate = mriTemplate || this.templates[0];
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
      } else if (e.target.id === 'toggle-older-chats' || e.target.closest('#toggle-older-chats')) {
        this.toggleOlderChats();
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
      <div class="min-h-screen bg-slate-50">
        <!-- Professional Header -->
        <div class="bg-white border-b border-slate-200 shadow-sm">
          <div class="max-w-7xl mx-auto px-6 py-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <i class="fas fa-stethoscope text-white text-lg"></i>
                </div>
                <div>
                  <h1 class="text-2xl font-bold text-slate-800">Radiology Assistant</h1>
                  <p class="text-sm text-slate-500">AI-Powered Medical Analysis</p>
                </div>
              </div>
              
              <div class="flex items-center space-x-4">
                <!-- Usage Stats -->
                <div class="hidden md:flex items-center space-x-4">
                  <div class="flex items-center space-x-2 px-3 py-2 bg-slate-50 rounded-lg">
                    <i class="fas fa-coins text-amber-600"></i>
                    <span id="credits-remaining" class="font-semibold">Loading...</span>
                    <span class="text-xs text-slate-500">credits</span>
                  </div>
                  
                  <div class="flex items-center space-x-2 px-3 py-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100" onclick="radiologyApp.showUsageDetails()">
                    <i class="fas fa-chart-line text-blue-600"></i>
                    <span id="tokens-used" class="font-semibold">0</span>
                    <span class="text-xs text-slate-500">tokens</span>
                  </div>
                </div>
                
                <button id="new-chat-button" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2">
                  <i class="fas fa-plus"></i>
                  <span>New Analysis</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto p-6">
          <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <!-- Sidebar -->
            <div class="lg:col-span-1 space-y-6">
              <!-- Template Selection -->
              <div class="bg-white rounded-lg shadow-sm border">
                <div class="px-4 py-3 border-b bg-slate-50">
                  <div class="flex items-center space-x-2">
                    <i class="fas fa-file-medical text-blue-600"></i>
                    <h3 class="font-semibold text-slate-800">Report Templates</h3>
                  </div>
                </div>
                <div class="p-4">
                  <div id="templates-list" class="space-y-2">
                    ${this.renderTemplates()}
                  </div>
                </div>
              </div>

              <!-- Analysis History -->
              <div class="bg-white rounded-lg shadow-sm border">
                <div class="px-4 py-3 border-b bg-slate-50">
                  <div class="flex items-center space-x-2">
                    <i class="fas fa-history text-green-600"></i>
                    <h3 class="font-semibold text-slate-800">Analysis History</h3>
                  </div>
                </div>
                <div class="p-4">
                  <!-- Recent Analyses -->
                  <div class="mb-4">
                    <div class="flex items-center space-x-2 mb-3">
                      <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                      <h4 class="text-sm font-medium text-slate-700">Recent</h4>
                    </div>
                    <div id="recent-chats-list" class="space-y-2">
                      <div class="text-slate-400 text-sm flex items-center justify-center py-4">
                        <i class="fas fa-spinner fa-spin mr-2"></i>
                        Loading...
                      </div>
                    </div>
                  </div>
                  
                  <!-- Archive -->
                  <div id="older-chats-section" class="hidden">
                    <button id="toggle-older-chats" class="w-full text-left text-sm font-medium mb-3 flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div class="flex items-center space-x-2">
                        <div class="w-2 h-2 bg-amber-500 rounded-full"></div>
                        <span class="text-slate-700">Archive</span>
                      </div>
                      <i id="older-chats-arrow" class="fas fa-chevron-down text-slate-400 text-xs transition-transform"></i>
                    </button>
                    <div id="older-chats-list" class="space-y-2 hidden pl-4">
                      <!-- Archived analyses will be populated here -->
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Chat Interface -->
            <div class="lg:col-span-3">
              <div class="bg-white rounded-lg shadow-sm border chat-container">
                <!-- Chat Header -->
                <div class="px-4 py-3 border-b bg-blue-50">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                      <i class="fas fa-robot text-blue-600"></i>
                      <h2 class="font-semibold text-slate-800">AI Analysis Session</h2>
                    </div>
                    <div class="flex items-center space-x-2">
                      <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span class="text-xs text-slate-500">Ready</span>
                    </div>
                  </div>
                </div>

                <!-- Messages -->
                <div id="messages-container" class="chat-messages p-4">
                  <div class="text-center text-slate-500 py-8">
                    <i class="fas fa-stethoscope text-4xl text-blue-600 mb-4"></i>
                    <h3 class="text-lg font-semibold text-slate-600 mb-2">Ready for Medical Analysis</h3>
                    <p class="text-sm text-slate-500">Upload medical images, dictate findings, or describe patient observations</p>
                  </div>
                </div>

                <!-- Input Area -->
                <div class="border-t bg-gray-50 chat-input p-4">
                  <!-- Professional File Upload Area -->
                  <div class="file-upload-area mb-6 bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 cursor-pointer group" onclick="document.getElementById('file-input').click()">
                    <input type="file" id="file-input" multiple accept=".pdf,.docx,.png,.jpg,.jpeg,.dcm,.mp3,.wav,.m4a,.ogg,.webm,.aac,.flac,.mp4,.mov,audio/*,video/mp4,video/quicktime" class="hidden">
                    <div class="flex flex-col items-center space-y-3">
                      <div class="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center group-hover:shadow-md transition-shadow">
                        <i class="fas fa-cloud-upload-alt text-blue-600 text-xl"></i>
                      </div>
                      <div>
                        <p class="text-slate-700 font-medium">Upload Medical Files & Audio</p>
                        <p class="text-slate-500 text-sm mt-1">DICOM, PDF, DOCX, Images, Audio (MP3, WAV, M4A, MP4, OGG) • Drag & drop or click</p>
                      </div>
                    </div>
                  </div>

                  <!-- Enhanced Chat Input Controls -->
                  <div class="space-y-4">
                    <!-- Main Input Row -->
                    <div class="flex items-end space-x-3">
                      <!-- Microphone Button -->
                      <button id="record-button" class="record-button idle group flex-shrink-0" title="Voice dictation (Click to start/stop recording)">
                        <i class="fas fa-microphone text-lg"></i>
                        <span class="sr-only">Start voice recording</span>
                      </button>
                      
                      <!-- Text Input Area -->
                      <div class="flex-1">
                        <label class="block text-sm font-medium text-slate-700 mb-2">Clinical Information</label>
                        <textarea
                          id="message-input"
                          placeholder="Describe patient presentation, clinical history, or imaging findings..."
                          class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none shadow-sm transition-all duration-200 bg-white"
                          rows="3"
                        ></textarea>
                      </div>
                      
                      <!-- Send Button -->
                      <button id="send-button" class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl flex items-center space-x-2 shadow-lg hover:shadow-xl transition-all duration-200 font-medium send-btn flex-shrink-0" style="height: fit-content;">
                        <i class="fas fa-paper-plane text-sm"></i>
                        <span>Send</span>
                      </button>
                    </div>
                    
                    <!-- Info Row -->
                    <div class="flex items-center justify-between">
                      <div class="flex items-center space-x-3">
                        <div class="text-xs text-slate-500">
                          <i class="fas fa-shield-alt mr-1"></i>
                          <span>HIPAA-compliant processing</span>
                        </div>
                      </div>
                      
                      <div class="text-xs text-slate-500">
                        <i class="fas fa-keyboard mr-1"></i>
                        <span>Press Enter to send • Shift+Enter for new line</span>
                      </div>
                    </div>
                  </div>

                  <!-- Professional Recording Status -->
                  <div id="recording-status" class="hidden mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                    <div class="flex items-center space-x-3">
                      <div class="w-4 h-4 bg-green-500 rounded-full animate-pulse shadow-sm"></div>
                      <div class="flex-1">
                        <p class="text-green-800 text-sm font-semibold">🎤 Voice Recording Active</p>
                        <p class="text-green-600 text-xs mt-1">Privacy-first processing • All data stays secure</p>
                      </div>
                    </div>
                  </div>

                  <!-- Professional PII Warning -->
                  <div id="pii-warning" class="pii-warning hidden mt-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4">
                    <div class="flex items-start space-x-3">
                      <div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i class="fas fa-shield-alt text-red-600 text-sm"></i>
                      </div>
                      <div class="flex-1">
                        <p class="font-semibold text-red-800">Protected Health Information Detected</p>
                        <p class="pii-warning-text text-red-700 text-sm mt-1">Please review and remove any personal identifiers before proceeding with analysis.</p>
                      </div>
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
    if (!this.templates || this.templates.length === 0) {
      return `
        <div class="text-slate-400 text-sm flex items-center justify-center py-4">
          <i class="fas fa-spinner fa-spin mr-2"></i>
          Loading templates...
        </div>
      `;
    }
    
    return this.templates.map(template => `
      <div class="template-card ${this.selectedTemplate?.id === template.id ? 'selected' : ''}" 
           data-template-id="${template.id}">
        <div class="flex items-start space-x-3 p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer ${this.selectedTemplate?.id === template.id ? 'border-blue-500 bg-blue-50 shadow-md' : 'bg-white hover:bg-slate-50'}">
          <div class="w-8 h-8 bg-gradient-to-br ${this.getTemplateColor(template.name)} rounded-lg flex items-center justify-center flex-shrink-0">
            <i class="fas ${this.getTemplateIcon(template.name)} text-white text-sm"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm text-slate-800 leading-tight">${template.name}</div>
            <div class="text-xs text-slate-500 mt-1 flex items-center space-x-2">
              <span>Version ${template.version || '1.0'}</span>
              ${template.created_by_name ? `<span>•</span><span>by ${template.created_by_name}</span>` : ''}
            </div>
          </div>
          ${this.selectedTemplate?.id === template.id ? '<div class="flex-shrink-0"><i class="fas fa-check-circle text-blue-600"></i></div>' : ''}
        </div>
      </div>
    `).join('');
  }

  getTemplateColor(name) {
    if (name.includes('MRI')) return 'from-purple-500 to-indigo-600';
    if (name.includes('CT')) return 'from-blue-500 to-cyan-600';
    if (name.includes('X-Ray') || name.includes('Chest')) return 'from-green-500 to-teal-600';
    if (name.includes('Ultrasound')) return 'from-amber-500 to-orange-600';
    return 'from-slate-500 to-gray-600';
  }

  getTemplateIcon(name) {
    if (name.includes('MRI')) return 'fa-brain';
    if (name.includes('CT')) return 'fa-circle-radiation';
    if (name.includes('X-Ray') || name.includes('Chest')) return 'fa-lungs';
    if (name.includes('Ultrasound')) return 'fa-heartbeat';
    return 'fa-file-medical';
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
      
      const recentChatsList = document.getElementById('recent-chats-list');
      const olderChatsList = document.getElementById('older-chats-list');
      const olderChatsSection = document.getElementById('older-chats-section');
      
      if (!recentChatsList || !olderChatsList) {
        console.error('❌ Chat list elements not found!');
        return;
      }
      
      if (chats.length === 0) {
        recentChatsList.innerHTML = '<div class="text-gray-500 text-sm">No chats yet</div>';
        olderChatsSection.classList.add('hidden');
        return;
      }

      // Separate recent (latest 5) and older chats
      const recentChats = chats.slice(0, 5);
      const olderChats = chats.slice(5);
      
      console.log(`📊 Recent: ${recentChats.length}, Older: ${olderChats.length}`);

      // Render recent chats
      if (typeof dayjs === 'undefined') {
        console.error('❌ dayjs is not loaded!');
        recentChatsList.innerHTML = recentChats.map(chat => `
          <div class="chat-item p-2 hover:bg-gray-50 rounded cursor-pointer" data-chat-id="${chat.id}">
            <div class="font-medium text-sm truncate">${chat.title || 'Untitled'}</div>
            <div class="text-xs text-gray-500">${chat.updated_at}</div>
          </div>
        `).join('');
      } else {
        recentChatsList.innerHTML = recentChats.map(chat => `
          <div class="chat-item p-2 hover:bg-gray-50 rounded cursor-pointer" data-chat-id="${chat.id}">
            <div class="font-medium text-sm truncate">${chat.title || 'Untitled'}</div>
            <div class="text-xs text-gray-500">${dayjs(chat.updated_at).format('MMM D, h:mm A')}</div>
          </div>
        `).join('');
      }
      
      // Handle older chats section
      if (olderChats.length > 0) {
        olderChatsSection.classList.remove('hidden');
        
        // Render older chats
        if (typeof dayjs === 'undefined') {
          olderChatsList.innerHTML = olderChats.map(chat => `
            <div class="chat-item p-2 hover:bg-gray-50 rounded cursor-pointer" data-chat-id="${chat.id}">
              <div class="font-medium text-sm truncate">${chat.title || 'Untitled'}</div>
              <div class="text-xs text-gray-500">${chat.updated_at}</div>
            </div>
          `).join('');
        } else {
          olderChatsList.innerHTML = olderChats.map(chat => `
            <div class="chat-item p-2 hover:bg-gray-50 rounded cursor-pointer" data-chat-id="${chat.id}">
              <div class="font-medium text-sm truncate">${chat.title || 'Untitled'}</div>
              <div class="text-xs text-gray-500">${dayjs(chat.updated_at).format('MMM D, h:mm A')}</div>
            </div>
          `).join('');
        }
        
        // Update the toggle button to show count
        const toggleButton = document.querySelector('#toggle-older-chats span');
        if (toggleButton) {
          toggleButton.innerHTML = `
            <i class="fas fa-archive mr-2 text-gray-400"></i>
            Older Chats (${olderChats.length})
          `;
        }
      } else {
        olderChatsSection.classList.add('hidden');
      }
      
      console.log(`✅ Rendered ${recentChats.length} recent and ${olderChats.length} older chat items`);
    } catch (error) {
      console.error('❌ Error loading chats:', error);
      const recentChatsList = document.getElementById('recent-chats-list');
      if (recentChatsList) {
        recentChatsList.innerHTML = '<div class="text-red-500 text-sm">Error loading chats</div>';
      }
    }
  }

  toggleOlderChats() {
    const olderChatsList = document.getElementById('older-chats-list');
    const arrow = document.getElementById('older-chats-arrow');
    
    if (!olderChatsList || !arrow) {
      console.error('❌ Older chats elements not found!');
      return;
    }
    
    const isHidden = olderChatsList.classList.contains('hidden');
    
    if (isHidden) {
      // Show older chats
      olderChatsList.classList.remove('hidden');
      arrow.classList.remove('fa-chevron-down');
      arrow.classList.add('fa-chevron-up');
      console.log('📝 Expanded older chats');
    } else {
      // Hide older chats
      olderChatsList.classList.add('hidden');
      arrow.classList.remove('fa-chevron-up');
      arrow.classList.add('fa-chevron-down');
      console.log('🗑️ Collapsed older chats');
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
    const hasUploadedAudio = hasFiles && (this.uploadedFiles || []).some(file => file.file_type === 'audio');
    const hasText = text && !text.includes('[Audio recorded') && !text.includes('will be transcribed on server]');
    
    if (!hasText && !hasAudio && !hasFiles) {
      console.log('No content to send');
      this.showError('Please enter text, record audio, or upload files before sending');
      return;
    }

    // Special message for uploaded audio files
    if (hasUploadedAudio && !hasText && !hasAudio) {
      console.log('Sending uploaded audio file(s) for transcription and analysis');
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
    sendButton.disabled = true;
    sendButton.classList.add('opacity-50', 'cursor-not-allowed');
    console.log('🔒 Send button disabled');
    sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Sending...</span>';
    this.showLoading();
    
    try {
      // Clean the text (remove placeholder if present)
      const cleanText = hasText ? text : '';

      // Check if we have uploaded audio files that need transcription
      const audioFiles = (this.uploadedFiles || []).filter(file => file.file_type === 'audio');
      const hasUploadedAudio = audioFiles.length > 0;

      // Debug logging
      console.log('📊 Send message debug:', {
        hasText,
        hasAudio,
        hasFiles,
        hasUploadedAudio,
        uploadedFiles: this.uploadedFiles,
        audioFiles: audioFiles,
        audioFilesCount: audioFiles.length
      });

      // Always use FormData when we have audio (recorded OR uploaded), otherwise use JSON
      if (hasAudio || hasUploadedAudio) {
        // Audio + text message
        const formData = new FormData();
        formData.append('text', cleanText);
        formData.append('template_id', this.selectedTemplate?.id || '');
        formData.append('attachments', JSON.stringify(this.uploadedFiles || []));

        // Add recorded audio if available
        if (hasAudio) {
          formData.append('audio', audioBlob, 'recording.webm');
          console.log('Sending recorded audio + text to server for processing');
        } 
        // If no recorded audio but we have uploaded audio files, process them for transcription
        else if (hasUploadedAudio) {
          // For uploaded audio files, we need to download them and add to FormData for transcription
          console.log(`Found ${audioFiles.length} uploaded audio file(s) for transcription`);
          
          // Get the first audio file for transcription
          const audioFile = audioFiles[0];
          try {
            // Fetch the uploaded audio file
            const audioResponse = await fetch(`/api/files/${audioFile.file_key}`);
            if (audioResponse.ok) {
              const audioBlob = await audioResponse.blob();
              formData.append('audio', audioBlob, audioFile.name);
              console.log('✅ Added uploaded audio file to transcription queue:', audioFile.name);
            } else {
              console.warn('Failed to fetch uploaded audio file for transcription');
            }
          } catch (error) {
            console.error('Error fetching uploaded audio file:', error);
          }
        }

        const response = await axios.post(`/api/chats/${this.currentChatId}/messages`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000 // 2 minute timeout
        });

        this.handleMessageResponse(response, input);
      } else {
        // Text-only message (no audio at all)
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
      sendButton.disabled = false;
      sendButton.classList.remove('opacity-50', 'cursor-not-allowed');
      console.log('🔓 Send button re-enabled');
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
    
    // Show transcription message first if audio was processed, then reload messages
    if (response.data.transcription && response.data.transcription.audio_processed) {
      // Show transcription immediately
      this.displayTranscriptionMessage(response.data.transcription.text);
      
      // Wait a moment for visual effect, then reload messages to show the full conversation
      setTimeout(() => {
        this.loadChat(this.currentChatId).then(() => {
          this.loadUsage();
        }).catch((error) => {
          console.error('Error reloading messages:', error);
          this.showError('Failed to reload messages');
        });
      }, 1000);
    } else {
      // Normal flow - reload messages immediately
      this.loadChat(this.currentChatId).then(() => {
        this.loadUsage();
      }).catch((error) => {
        console.error('Error reloading messages:', error);
        this.showError('Failed to reload messages');
      });
    }
  }

  displayTranscriptionMessage(transcriptionText) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;

    // Create transcription message element
    const transcriptionDiv = document.createElement('div');
    transcriptionDiv.className = 'message mb-4';
    transcriptionDiv.innerHTML = `
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <i class="fas fa-microphone text-white text-sm"></i>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2 mb-2">
              <span class="text-sm font-medium text-blue-700">Audio Transcription</span>
              <span class="text-xs text-blue-500">• Processed by Whisper AI</span>
            </div>
            <div class="text-sm text-gray-800 bg-white rounded p-3 border">
              ${transcriptionText}
            </div>
            <div class="text-xs text-blue-600 mt-2 flex items-center space-x-1">
              <i class="fas fa-check-circle"></i>
              <span>Transcription complete • Generating report...</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Insert the transcription message
    messagesContainer.appendChild(transcriptionDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
        // Detect file type - prioritize audio detection for MP4/MOV
        const isAudioFile = this.isAudioFile(file);
        const isVideoFile = !isAudioFile && this.isVideoFile(file); // Only consider video if not audio
        
        // Validate file size (audio files can be larger)
        const sizeLimit = isAudioFile || isVideoFile ? 100 * 1024 * 1024 : 50 * 1024 * 1024; // 100MB for audio/video, 50MB for others
        if (file.size > sizeLimit) {
          this.showError(`File ${file.name} exceeds ${sizeLimit / (1024 * 1024)}MB limit`);
          continue;
        }

        // Validate audio file formats
        if (isAudioFile && !this.validateAudioFormat(file)) {
          this.showError(`Audio format not supported for ${file.name}. Please use MP3, WAV, M4A, OGG, AAC, or FLAC.`);
          continue;
        }

        // Show upload progress with file type indication
        this.showUploadProgress(file.name, isAudioFile ? 'audio' : isVideoFile ? 'video' : 'document');
        
        // Upload file
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await axios.post('/api/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        // Add file type metadata to the attachment
        const attachment = response.data.attachment;
        attachment.file_type = isAudioFile ? 'audio' : isVideoFile ? 'video' : 'document';
        attachment.can_preview = isAudioFile || isVideoFile;
        
        // Add to uploaded files
        this.uploadedFiles.push(attachment);
        
        // If it's an audio file, offer transcription
        if (isAudioFile) {
          this.offerAudioTranscription(file, attachment);
        }
        
        // Update UI
        this.updateFileList();
        console.log(`✅ Uploaded ${file.name} (${attachment.file_type})`);
        
      } catch (error) {
        console.error('Upload error:', error);
        this.showError(`Failed to upload ${file.name}: ${error.response?.data?.error || error.message}`);
      }
    }
  }

  isAudioFile(file) {
    const audioExtensions = ['mp3', 'wav', 'm4a', 'ogg', 'webm', 'aac', 'flac', 'mp4', 'mov'];
    const audioMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac', 'audio/x-flac', 'video/mp4', 'video/quicktime'];
    
    const extension = file.name.split('.').pop().toLowerCase();
    const hasAudioExtension = audioExtensions.includes(extension);
    const hasAudioMimeType = audioMimeTypes.some(type => file.type.startsWith(type));
    
    // Special handling for MP4 and MOV - treat as audio for transcription purposes
    if (extension === 'mp4' || extension === 'mov' || file.type.startsWith('video/mp4') || file.type.startsWith('video/quicktime')) {
      return true; // Always treat MP4/MOV as audio for Whisper transcription
    }
    
    return hasAudioExtension || hasAudioMimeType;
  }

  isVideoFile(file) {
    const videoExtensions = ['mp4', 'mov', 'avi', 'webm', 'mkv'];
    const videoMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];
    
    const extension = file.name.split('.').pop().toLowerCase();
    return videoExtensions.includes(extension) || videoMimeTypes.some(type => file.type.startsWith(type));
  }

  validateAudioFormat(file) {
    // More strict validation for audio files (now including MP4/MOV)
    const supportedFormats = ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac', 'mp4', 'mov'];
    const extension = file.name.split('.').pop().toLowerCase();
    return supportedFormats.includes(extension);
  }

  async offerAudioTranscription(file, attachment) {
    // Show a notification that the audio can be transcribed
    this.showInfo(`🎤 Audio file uploaded: ${file.name}. Click "Send Message" to automatically transcribe via Whisper AI and generate your medical report.`);
  }

  showUploadProgress(filename, fileType = 'document') {
    // Progress indicator with file type
    const container = document.querySelector('.file-upload-area');
    const icon = fileType === 'audio' ? 'fa-volume-up' : fileType === 'video' ? 'fa-video' : 'fa-file';
    const color = fileType === 'audio' ? 'text-green-500' : fileType === 'video' ? 'text-purple-500' : 'text-blue-500';
    
    container.innerHTML = `
      <div class="flex flex-col items-center space-y-2">
        <div class="flex items-center space-x-2">
          <i class="fas fa-spinner fa-spin ${color} text-lg"></i>
          <i class="fas ${icon} ${color} text-lg"></i>
        </div>
        <p class="${color.replace('text-', 'text-').replace('-500', '-600')} text-sm font-medium">Uploading ${fileType} file...</p>
        <p class="text-slate-500 text-xs">${filename}</p>
      </div>
    `;
  }

  updateFileList() {
    const container = document.querySelector('.file-upload-area');
    
    if (this.uploadedFiles.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center space-y-3">
          <div class="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center group-hover:shadow-md transition-shadow">
            <i class="fas fa-cloud-upload-alt text-blue-600 text-xl"></i>
          </div>
          <div>
            <p class="text-slate-700 font-medium">Upload Medical Files & Audio</p>
            <p class="text-slate-500 text-sm mt-1">DICOM, PDF, DOCX, Images, Audio (MP3, WAV, M4A, OGG) • Drag & drop or click</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="space-y-3">
        <div class="text-center">
          <p class="text-sm font-medium text-slate-700 mb-2">Uploaded Files (${this.uploadedFiles.length})</p>
        </div>
        <div class="space-y-2 max-h-32 overflow-y-auto">
          ${this.uploadedFiles.map((file, index) => {
            const fileType = file.file_type || 'document';
            const icon = fileType === 'audio' ? 'fa-volume-up' : fileType === 'video' ? 'fa-video' : 'fa-file-alt';
            const bgColor = fileType === 'audio' ? 'bg-green-50 border-green-200' : fileType === 'video' ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200';
            const textColor = fileType === 'audio' ? 'text-green-700' : fileType === 'video' ? 'text-purple-700' : 'text-blue-700';
            const iconColor = fileType === 'audio' ? 'text-green-600' : fileType === 'video' ? 'text-purple-600' : 'text-blue-600';
            
            return `
              <div class="flex items-center justify-between ${bgColor} border rounded-lg p-3">
                <div class="flex items-center space-x-3 flex-1 min-w-0">
                  <i class="fas ${icon} ${iconColor} flex-shrink-0"></i>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium ${textColor} truncate">${file.name}</p>
                    ${fileType === 'audio' ? `<p class="text-xs text-green-600 mt-1"><i class="fas fa-microphone mr-1"></i>Will be transcribed</p>` : ''}
                    ${file.can_preview ? `<p class="text-xs text-slate-500 mt-1">Preview available</p>` : ''}
                  </div>
                </div>
                <div class="flex items-center space-x-2 flex-shrink-0">
                  ${file.can_preview ? `
                    <button onclick="radiologyApp.previewFile(${index})" 
                            class="text-slate-500 hover:text-slate-700 text-sm" 
                            title="Preview ${fileType}">
                      <i class="fas fa-eye"></i>
                    </button>
                  ` : ''}
                  <button onclick="radiologyApp.removeFile(${index})" 
                          class="text-red-500 hover:text-red-700 text-sm" 
                          title="Remove file">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="text-center pt-2 border-t border-slate-200">
          <button onclick="document.getElementById('file-input').click()" 
                  class="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center space-x-1 mx-auto">
            <i class="fas fa-plus text-xs"></i>
            <span>Add more files</span>
          </button>
        </div>
      </div>
    `;
  }

  removeFile(index) {
    this.uploadedFiles.splice(index, 1);
    this.updateFileList();
  }

  previewFile(index) {
    const file = this.uploadedFiles[index];
    if (!file || !file.can_preview) return;

    // Create modal for preview
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };

    let previewContent = '';
    if (file.file_type === 'audio') {
      previewContent = `
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-slate-800">Audio Preview</h3>
            <button onclick="document.body.removeChild(this.closest('.fixed'))" class="text-slate-500 hover:text-slate-700">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="text-center mb-4">
            <i class="fas fa-volume-up text-green-600 text-3xl mb-2"></i>
            <p class="text-sm font-medium text-slate-700">${file.name}</p>
          </div>
          <audio controls class="w-full mb-4">
            <source src="${file.url || `/api/files/${file.file_key}`}" type="audio/*">
            Your browser does not support the audio element.
          </audio>
          <div class="bg-green-50 border border-green-200 rounded-lg p-3">
            <div class="flex items-center space-x-2">
              <i class="fas fa-info-circle text-green-600"></i>
              <p class="text-sm text-green-700 font-medium">Audio will be transcribed automatically when you send your message.</p>
            </div>
          </div>
        </div>
      `;
    } else if (file.file_type === 'video') {
      previewContent = `
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-slate-800">Video Preview</h3>
            <button onclick="document.body.removeChild(this.closest('.fixed'))" class="text-slate-500 hover:text-slate-700">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="text-center mb-4">
            <i class="fas fa-video text-purple-600 text-3xl mb-2"></i>
            <p class="text-sm font-medium text-slate-700">${file.name}</p>
          </div>
          <video controls class="w-full mb-4 rounded-lg">
            <source src="${file.url || `/api/files/${file.file_key}`}" type="video/*">
            Your browser does not support the video element.
          </video>
          <div class="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div class="flex items-center space-x-2">
              <i class="fas fa-info-circle text-purple-600"></i>
              <p class="text-sm text-purple-700 font-medium">Video files will be processed for analysis when you send your message.</p>
            </div>
          </div>
        </div>
      `;
    }

    modal.innerHTML = previewContent;
    document.body.appendChild(modal);
  }

  showInfo(message) {
    // Create a temporary info notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-blue-100 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg shadow-lg z-50 max-w-sm';
    notification.innerHTML = `
      <div class="flex items-start space-x-2">
        <i class="fas fa-info-circle text-blue-600 mt-0.5"></i>
        <p class="text-sm">${message}</p>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 5000);
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
        const inputTokens = usage.total_tokens_in || 0;
        const outputTokens = usage.total_tokens_out || 0;
        const totalTokens = inputTokens + outputTokens;
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
    const inputTokens = usage.total_tokens_in || 0;
    const outputTokens = usage.total_tokens_out || 0;
    const audioMinutes = usage.total_audio_minutes || 0;
    
    const inputCost = (inputTokens / 1000) * 0.0015; // GPT-4o input tokens
    const outputCost = (outputTokens / 1000) * 0.006; // GPT-4o output tokens  
    const transcriptionCost = audioMinutes * 0.006; // Whisper per minute
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
              <span>${inputTokens.toLocaleString()}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span>Output tokens:</span>
              <span>${outputTokens.toLocaleString()}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span>Audio minutes:</span>
              <span>${audioMinutes.toFixed(1)}</span>
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

          <button onclick="radiologyApp.copyToClipboard('${message.id}-content')" 
                  class="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors">
            <i class="fas fa-copy mr-1"></i>
            Copy Text
          </button>
        </div>
      </div>
    `;
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