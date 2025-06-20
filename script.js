
        class DeepSeekChat {
            constructor() {
                this.messages = [];
                this.isLoading = false;
                // Using our local API proxy instead of direct API key
                this.baseURL = '/api';
                this.storageKey = 'deepseek-chat-history';
                
                // Search functionality
                this.searchMatches = [];
                this.currentMatchIndex = -1;
                this.searchQuery = '';

                // Document processing
                this.isProcessingDocument = false;
                this.attachedFiles = [];

                // Speech recognition
                this.recognition = null;
                this.isRecording = false;
                this.initializeSpeechRecognition();
                
                this.initializeElements();
                this.attachEventListeners();
                this.loadChatHistory();
                this.setupTextareaAutoResize();
            }

            initializeSpeechRecognition() {
                if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                    this.recognition = new SpeechRecognition();
                    
                    this.recognition.continuous = false;
                    this.recognition.interimResults = true;
                    this.recognition.lang = 'en-US';
                    
                    this.recognition.onstart = () => {
                        this.isRecording = true;
                        this.updateVoiceButton();
                        this.showVoiceStatus('Listening...');
                    };
                    
                    this.recognition.onresult = (event) => {
                        let transcript = '';
                        for (let i = event.resultIndex; i < event.results.length; i++) {
                            transcript += event.results[i][0].transcript;
                        }
                        
                        if (event.results[event.results.length - 1].isFinal) {
                            this.messageInput.value = transcript;
                            this.messageInput.style.height = 'auto';
                            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
                            this.messageInput.focus();
                        } else {
                            // Show interim results
                            this.showVoiceStatus(`"${transcript}"`);
                        }
                    };
                    
                    this.recognition.onerror = (event) => {
                        console.error('Speech recognition error:', event.error);
                        this.isRecording = false;
                        this.updateVoiceButton();
                        this.hideVoiceStatus();
                        
                        let errorMessage = 'Voice input error';
                        switch (event.error) {
                            case 'no-speech':
                                errorMessage = 'No speech detected';
                                break;
                            case 'audio-capture':
                                errorMessage = 'Microphone not available';
                                break;
                            case 'not-allowed':
                                errorMessage = 'Microphone permission denied';
                                break;
                            case 'network':
                                errorMessage = 'Network error';
                                break;
                        }
                        this.showVoiceStatus(errorMessage, 2000);
                    };
                    
                    this.recognition.onend = () => {
                        this.isRecording = false;
                        this.updateVoiceButton();
                        this.hideVoiceStatus();
                    };
                } else {
                    console.warn('Speech recognition not supported in this browser');
                }
            }

            initializeElements() {
                this.chatContainer = document.getElementById('chatContainer');
                this.welcomeScreen = document.getElementById('welcomeScreen');
                this.chatForm = document.getElementById('chatForm');
                this.messageInput = document.getElementById('messageInput');
                this.sendButton = document.getElementById('sendButton');
                this.clearButton = document.getElementById('clearButton');
                this.attachButton = document.getElementById('attachButton');
                this.voiceButton = document.getElementById('voiceButton');
                this.voiceStatus = document.getElementById('voiceStatus');
                this.fileInput = document.getElementById('fileInput');
                this.attachmentPreview = document.getElementById('attachmentPreview');
                
                // Search elements
                this.searchInput = document.getElementById('searchInput');
                this.searchButton = document.getElementById('searchButton');
                this.searchResults = document.getElementById('searchResults');
                this.searchNavigation = document.getElementById('searchNavigation');
                this.searchPrev = document.getElementById('searchPrev');
                this.searchNext = document.getElementById('searchNext');
            }

            setupTextareaAutoResize() {
                this.messageInput.addEventListener('input', () => {
                    this.messageInput.style.height = 'auto';
                    this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
                });
            }

            attachEventListeners() {
                this.chatForm.addEventListener('submit', (e) => this.handleSubmit(e));
                this.messageInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.handleSubmit(e);
                    }
                });
                
                this.clearButton.addEventListener('click', () => {
                    if (confirm('Are you sure you want to clear all chat history? This action cannot be undone.')) {
                        this.clearChatHistory();
                    }
                });

                // Voice input
                this.voiceButton.addEventListener('click', () => {
                    this.toggleVoiceRecording();
                });

                // Document upload
                this.attachButton.addEventListener('click', () => {
                    this.fileInput.click();
                });

                this.fileInput.addEventListener('change', (e) => {
                    if (e.target.files.length > 0) {
                        this.handleFileAttachment(e.target.files);
                    }
                });

                // Search event listeners
                this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
                this.searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.navigateSearch('next');
                    } else if (e.key === 'Escape') {
                        this.clearSearch();
                    }
                });
                
                this.searchButton.addEventListener('click', () => {
                    if (this.searchQuery) {
                        this.clearSearch();
                    } else {
                        this.searchInput.focus();
                    }
                });
                
                this.searchPrev.addEventListener('click', () => this.navigateSearch('prev'));
                this.searchNext.addEventListener('click', () => this.navigateSearch('next'));

                // Clear search when clicking outside
                document.addEventListener('click', (e) => {
                    if (!e.target.closest('.search-container') && !e.target.closest('.search-navigation')) {
                        this.hideSearchResults();
                    }
                });

                // Drag and drop support
                this.chatContainer.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    this.chatContainer.style.backgroundColor = 'rgba(139, 92, 246, 0.05)';
                });

                this.chatContainer.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    this.chatContainer.style.backgroundColor = '';
                });

                this.chatContainer.addEventListener('drop', (e) => {
                    e.preventDefault();
                    this.chatContainer.style.backgroundColor = '';
                    if (e.dataTransfer.files.length > 0) {
                        this.handleFileAttachment(e.dataTransfer.files);
                    }
                });
            }

            toggleVoiceRecording() {
                if (!this.recognition) {
                    this.showVoiceStatus('Speech recognition not supported', 3000);
                    return;
                }

                if (this.isRecording) {
                    this.recognition.stop();
                } else {
                    try {
                        this.recognition.start();
                    } catch (error) {
                        console.error('Error starting speech recognition:', error);
                        this.showVoiceStatus('Could not start voice input', 2000);
                    }
                }
            }

            updateVoiceButton() {
                if (this.isRecording) {
                    this.voiceButton.classList.add('recording');
                    this.voiceButton.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                            <line x1="12" y1="19" x2="12" y2="22"></line>
                        </svg>
                    `;
                    this.voiceButton.title = 'Stop recording';
                } else {
                    this.voiceButton.classList.remove('recording', 'processing');
                    this.voiceButton.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                            <line x1="12" y1="19" x2="12" y2="22"></line>
                        </svg>
                    `;
                    this.voiceButton.title = 'Voice input';
                }
            }

            showVoiceStatus(message, duration = 0) {
                this.voiceStatus.textContent = message;
                this.voiceStatus.classList.add('show');
                
                if (duration > 0) {
                    setTimeout(() => {
                        this.hideVoiceStatus();
                    }, duration);
                }
            }

            hideVoiceStatus() {
                this.voiceStatus.classList.remove('show');
            }

            handleFileAttachment(files) {
                for (const file of files) {
                    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                        this.attachedFiles.push(file);
                        this.updateAttachmentPreview();
                    } else {
                        this.addMessage('assistant', `Unsupported file type: ${file.type}. Please upload images (JPG, PNG, etc.) or PDFs.`);
                    }
                }
                this.fileInput.value = ''; // Reset file input
            }

            updateAttachmentPreview() {
                if (this.attachedFiles.length === 0) {
                    this.attachmentPreview.classList.add('hidden');
                    return;
                }

                this.attachmentPreview.classList.remove('hidden');
                this.attachmentPreview.innerHTML = '';

                this.attachedFiles.forEach((file, index) => {
                    const item = document.createElement('div');
                    item.className = 'attachment-item';
                    
                    const icon = file.type.startsWith('image/') ? '🖼️' : '📄';
                    const name = file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name;
                    
                    item.innerHTML = `
                        <span>${icon}</span>
                        <span>${name}</span>
                        <button type="button" class="attachment-remove" onclick="window.chatInstance.removeAttachment(${index})">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    `;
                    
                    this.attachmentPreview.appendChild(item);
                });
            }

            removeAttachment(index) {
                this.attachedFiles.splice(index, 1);
                this.updateAttachmentPreview();
            }

            async handleSubmit(e) {
                e.preventDefault();
                
                const message = this.messageInput.value.trim();
                if (!message && this.attachedFiles.length === 0) return;
                if (this.isLoading) return;

                // Clear search when sending new message
                this.clearSearch();

                // Hide welcome screen
                this.welcomeScreen.classList.add('hidden');

                // Process attachments first if any
                if (this.attachedFiles.length > 0) {
                    await this.processAttachedFiles();
                }

                // Send text message if provided
                if (message) {
                    this.addMessage('user', message);
                    this.messageInput.value = '';
                    this.messageInput.style.height = 'auto';
                    this.setLoading(true);

                    // Show typing indicator
                    this.showTypingIndicator();

                    try {
                        await this.sendMessage(message);
                    } catch (error) {
                        console.error('Error:', error);
                        this.addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
                    } finally {
                        this.hideTypingIndicator();
                        this.setLoading(false);
                    }
                }

                // Clear attachments
                this.attachedFiles = [];
                this.updateAttachmentPreview();
            }

            async processAttachedFiles() {
                this.isProcessingDocument = true;

                for (const file of this.attachedFiles) {
                    if (file.type.startsWith('image/')) {
                        await this.processImageFile(file);
                    } else if (file.type === 'application/pdf') {
                        this.addMessage('assistant', 'PDF processing is coming soon! For now, please convert your PDF to images or use image files.');
                    }
                }

                this.isProcessingDocument = false;
            }

            async processImageFile(file) {
                try {
                    // Show processing indicator
                    const processingDiv = this.addProcessingIndicator(`Processing ${file.name}...`);

                    // Create image URL for preview
                    const imageUrl = URL.createObjectURL(file);

                    // Perform OCR
                    const ocrResult = await Tesseract.recognize(file, 'eng', {
                        logger: (m) => {
                            if (m.status === 'recognizing text') {
                                this.updateProcessingIndicator(processingDiv, 
                                    `Processing ${file.name}... ${Math.round(m.progress * 100)}%`);
                            }
                        }
                    });

                    // Remove processing indicator
                    processingDiv.remove();

                    // Add document analysis block
                    this.addDocumentAnalysisBlock(file, imageUrl, ocrResult);

                    // Auto-analyze the extracted text with AI if there's meaningful content
                    if (ocrResult.data.text.trim() && ocrResult.data.text.trim().length > 10) {
                        await this.analyzeExtractedText(ocrResult.data.text, file.name);
                    }

                } catch (error) {
                    console.error('OCR Error:', error);
                    this.addMessage('assistant', `Error processing ${file.name}: ${error.message}`);
                }
            }

            addProcessingIndicator(message) {
                const processingDiv = document.createElement('div');
                processingDiv.className = 'processing-indicator';
                
                const spinner = document.createElement('div');
                spinner.className = 'processing-spinner';
                
                const text = document.createElement('span');
                text.textContent = message;
                
                processingDiv.appendChild(spinner);
                processingDiv.appendChild(text);
                
                this.chatContainer.appendChild(processingDiv);
                this.scrollToBottom();
                
                return processingDiv;
            }

            updateProcessingIndicator(element, message) {
                const textSpan = element.querySelector('span');
                if (textSpan) {
                    textSpan.textContent = message;
                }
            }

            addDocumentAnalysisBlock(file, imageUrl, ocrResult) {
                const blockDiv = document.createElement('div');
                blockDiv.className = 'message document';
                
                const avatar = document.createElement('div');
                avatar.className = 'avatar document';
                avatar.textContent = '📄';
                
                const analysisBlock = document.createElement('div');
                analysisBlock.className = 'document-analysis-block';
                
                // Header
                const header = document.createElement('div');
                header.className = 'document-header';
                
                const title = document.createElement('div');
                title.className = 'document-title';
                title.textContent = `Document Analysis: ${file.name}`;
                
                const actions = document.createElement('div');
                actions.className = 'document-actions';
                
                const copyBtn = document.createElement('button');
                copyBtn.className = 'document-action-btn';
                copyBtn.textContent = 'Copy Text';
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(ocrResult.data.text);
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => copyBtn.textContent = 'Copy Text', 2000);
                });
                
                const downloadBtn = document.createElement('button');
                downloadBtn.className = 'document-action-btn';
                downloadBtn.textContent = 'Download';
                downloadBtn.addEventListener('click', () => {
                    const blob = new Blob([ocrResult.data.text], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${file.name}_extracted.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                });
                
                actions.appendChild(copyBtn);
                actions.appendChild(downloadBtn);
                
                header.appendChild(title);
                header.appendChild(actions);
                
                // Preview section
                const preview = document.createElement('div');
                preview.className = 'document-preview';
                
                const image = document.createElement('img');
                image.className = 'document-image';
                image.src = imageUrl;
                image.alt = 'Document preview';
                
                const info = document.createElement('div');
                info.className = 'document-info';
                
                // Stats
                const stats = document.createElement('div');
                stats.className = 'document-stats';
                
                const wordCount = ocrResult.data.text.split(/\s+/).filter(word => word.length > 0).length;
                const charCount = ocrResult.data.text.length;
                const confidence = Math.round(ocrResult.data.confidence);
                
                const statsData = [
                    { label: 'Words', value: wordCount },
                    { label: 'Characters', value: charCount },
                    { label: 'Confidence', value: `${confidence}%` },
                    { label: 'Size', value: this.formatFileSize(file.size) }
                ];
                
                statsData.forEach(stat => {
                    const statItem = document.createElement('div');
                    statItem.className = 'stat-item';
                    
                    const value = document.createElement('div');
                    value.className = 'stat-value';
                    value.textContent = stat.value;
                    
                    const label = document.createElement('div');
                    label.className = 'stat-label';
                    label.textContent = stat.label;
                    
                    statItem.appendChild(value);
                    statItem.appendChild(label);
                    stats.appendChild(statItem);
                });
                
                info.appendChild(stats);
                
                preview.appendChild(image);
                preview.appendChild(info);
                
                // Extracted text
                const extractedText = document.createElement('div');
                extractedText.className = 'extracted-text';
                extractedText.textContent = ocrResult.data.text || 'No text detected in the image.';
                
                analysisBlock.appendChild(header);
                analysisBlock.appendChild(preview);
                analysisBlock.appendChild(extractedText);
                
                blockDiv.appendChild(avatar);
                blockDiv.appendChild(analysisBlock);
                
                this.chatContainer.appendChild(blockDiv);
                this.scrollToBottom();
            }

            formatFileSize(bytes) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            }

            async analyzeExtractedText(text, filename) {
                const analysisPrompt = `I've extracted the following text from a document called "${filename}". Please analyze it and provide insights:

${text}

Please provide:
1. Document type identification (receipt, invoice, form, etc.)
2. Key information extracted (dates, amounts, names, etc.)
3. Summary of the content
4. Any notable patterns or insights`;

                // Show typing indicator
                this.showTypingIndicator();
                this.setLoading(true);

                try {
                    await this.sendMessage(analysisPrompt);
                } catch (error) {
                    console.error('Error:', error);
                    this.addMessage('assistant', 'Sorry, I encountered an error analyzing the document. Please try again.');
                } finally {
                    this.hideTypingIndicator();
                    this.setLoading(false);
                }
            }

            addMessage(role, content) {
                this.messages.push({ role, content });
                this.renderMessage(role, content);
                this.saveChatHistory();
                this.scrollToBottom();
            }

            handleSearch(query) {
                this.searchQuery = query.trim();
                
                if (!this.searchQuery) {
                    this.clearSearch();
                    return;
                }

                this.searchMatches = [];
                this.currentMatchIndex = -1;

                // Search through messages and extracted text
                const messageElements = this.chatContainer.querySelectorAll('.message');
                messageElements.forEach((element, index) => {
                    const content = element.querySelector('.message-content, .extracted-text');
                    if (content) {
                        const text = content.textContent.toLowerCase();
                        if (text.includes(this.searchQuery.toLowerCase())) {
                            this.searchMatches.push({
                                element: element,
                                content: content,
                                index: index,
                                originalText: content.textContent
                            });
                        }
                    }
                });

                this.updateSearchResults();
                this.highlightMatches();
                
                if (this.searchMatches.length > 0) {
                    this.navigateSearch('first');
                }
            }

            highlightMatches() {
                // Clear previous highlights
                this.clearHighlights();

                if (!this.searchQuery) return;

                this.searchMatches.forEach(match => {
                    const regex = new RegExp(`(${this.escapeRegex(this.searchQuery)})`, 'gi');
                    const highlightedText = match.originalText.replace(regex, '<span class="search-match">$1</span>');
                    match.content.innerHTML = highlightedText;
                    match.element.classList.add('search-highlight');
                });
            }

            clearHighlights() {
                const highlightedElements = this.chatContainer.querySelectorAll('.search-highlight');
                highlightedElements.forEach(element => {
                    element.classList.remove('search-highlight', 'search-current');
                    const content = element.querySelector('.message-content, .extracted-text');
                    if (content) {
                        // Restore original text or HTML
                        const message = this.messages.find(msg => content.textContent.includes(msg.content));
                        if (message && message.role === 'assistant') {
                            // Re-render markdown for assistant messages
                            content.innerHTML = marked.parse(message.content);
                        } else {
                            content.textContent = content.textContent;
                        }
                    }
                });
            }

            navigateSearch(direction) {
                if (this.searchMatches.length === 0) return;

                // Remove current highlight
                if (this.currentMatchIndex >= 0) {
                    this.searchMatches[this.currentMatchIndex].element.classList.remove('search-current');
                }

                // Calculate new index
                if (direction === 'next' || direction === 'first') {
                    this.currentMatchIndex = direction === 'first' ? 0 : 
                        (this.currentMatchIndex + 1) % this.searchMatches.length;
                } else if (direction === 'prev') {
                    this.currentMatchIndex = this.currentMatchIndex <= 0 ? 
                        this.searchMatches.length - 1 : this.currentMatchIndex - 1;
                }

                // Highlight current match
                const currentMatch = this.searchMatches[this.currentMatchIndex];
                currentMatch.element.classList.add('search-current');

                // Update current match highlighting in text
                const regex = new RegExp(`(${this.escapeRegex(this.searchQuery)})`, 'gi');
                let matchCount = 0;
                const highlightedText = currentMatch.originalText.replace(regex, (match) => {
                    matchCount++;
                    return matchCount === 1 ? 
                        `<span class="search-match current">${match}</span>` : 
                        `<span class="search-match">${match}</span>`;
                });
                currentMatch.content.innerHTML = highlightedText;

                // Scroll to current match
                currentMatch.element.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });

                this.updateSearchResults();
            }

            updateSearchResults() {
                if (this.searchMatches.length === 0) {
                    this.searchResults.textContent = this.searchQuery ? 'No matches found' : '';
                    this.searchResults.classList.toggle('hidden', !this.searchQuery);
                    this.searchNavigation.classList.add('hidden');
                } else {
                    this.searchResults.textContent = `${this.currentMatchIndex + 1} of ${this.searchMatches.length}`;
                    this.searchResults.classList.remove('hidden');
                    this.searchNavigation.classList.remove('hidden');
                    
                    // Update navigation buttons
                    this.searchPrev.disabled = this.searchMatches.length <= 1;
                    this.searchNext.disabled = this.searchMatches.length <= 1;
                }

                // Update search button icon
                this.searchButton.innerHTML = this.searchQuery ? 
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' :
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>';
            }

            clearSearch() {
                this.searchQuery = '';
                this.searchInput.value = '';
                this.searchMatches = [];
                this.currentMatchIndex = -1;
                this.clearHighlights();
                this.updateSearchResults();
                this.hideSearchResults();
            }

            hideSearchResults() {
                this.searchResults.classList.add('hidden');
                this.searchNavigation.classList.add('hidden');
            }

            escapeRegex(string) {
                return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }

            showTypingIndicator() {
                const typingDiv = document.createElement('div');
                typingDiv.className = 'typing-indicator';
                typingDiv.id = 'typingIndicator';
                
                const avatar = document.createElement('div');
                avatar.className = 'avatar assistant';
                avatar.textContent = '🤖';
                
                const typingContent = document.createElement('div');
                typingContent.className = 'typing-content';
                
                const typingDots = document.createElement('div');
                typingDots.className = 'typing-dots';
                
                for (let i = 0; i < 3; i++) {
                    const dot = document.createElement('div');
                    dot.className = 'typing-dot';
                    typingDots.appendChild(dot);
                }
                
                const typingText = document.createElement('span');
                typingText.textContent = 'please wait our bot is thinking...';
                
                typingContent.appendChild(typingDots);
                typingContent.appendChild(typingText);
                
                typingDiv.appendChild(avatar);
                typingDiv.appendChild(typingContent);
                
                this.chatContainer.appendChild(typingDiv);
                this.scrollToBottom();
            }

            hideTypingIndicator() {
                const typingIndicator = document.getElementById('typingIndicator');
                if (typingIndicator) {
                    typingIndicator.remove();
                }
            }

            async sendMessage(userMessage) {
                const messages = [
                    ...this.messages.map(msg => ({
                        role: msg.role,
                        content: msg.content
                    }))
                ];

                const response = await fetch(`${this.baseURL}/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'deepseek/deepseek-r1-0528:free',
                        messages: messages,
                        temperature: 0.7,
                        max_tokens: 4000,
                        stream: true
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let assistantMessage = '';

                // Create assistant message element for streaming
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message assistant';
                
                const avatar = document.createElement('div');
                avatar.className = 'avatar assistant';
                avatar.textContent = '🤖';
                
                const messageContent = document.createElement('div');
                messageContent.className = 'message-content';
                
                messageDiv.appendChild(avatar);
                messageDiv.appendChild(messageContent);
                this.chatContainer.appendChild(messageDiv);

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\n');

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const data = line.slice(6);
                                if (data === '[DONE]') continue;

                                try {
                                    const parsed = JSON.parse(data);
                                    const content = parsed.choices?.[0]?.delta?.content;
                                    
                                    if (content) {
                                        assistantMessage += content;
                                        // Render markdown in real-time
                                        messageContent.innerHTML = marked.parse(assistantMessage);
                                        this.scrollToBottom();
                                    }
                                } catch (e) {
                                    // Skip invalid JSON
                                }
                            }
                        }
                    }
                } finally {
                    reader.releaseLock();
                }

                // Add final message to messages array
                this.messages.push({ role: 'assistant', content: assistantMessage });
                this.saveChatHistory();
            }

            setLoading(loading) {
                this.isLoading = loading;
                this.sendButton.disabled = loading;
                this.messageInput.disabled = loading;
                this.voiceButton.disabled = loading;
                this.attachButton.disabled = loading;
            }

            scrollToBottom() {
                this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
            }

            loadChatHistory() {
                try {
                    const savedHistory = localStorage.getItem(this.storageKey);
                    if (savedHistory) {
                        const parsedHistory = JSON.parse(savedHistory);
                        this.messages = parsedHistory.messages || [];
                        
                        // Restore messages to UI
                        if (this.messages.length > 0) {
                            this.welcomeScreen.classList.add('hidden');
                            this.messages.forEach(message => {
                                this.renderMessage(message.role, message.content);
                            });
                            this.scrollToBottom();
                        }
                    }
                } catch (error) {
                    console.error('Error loading chat history:', error);
                    localStorage.removeItem(this.storageKey);
                }
            }

            saveChatHistory() {
                try {
                    const historyData = {
                        messages: this.messages,
                        timestamp: new Date().toISOString()
                    };
                    localStorage.setItem(this.storageKey, JSON.stringify(historyData));
                } catch (error) {
                    console.error('Error saving chat history:', error);
                }
            }

            clearChatHistory() {
                this.messages = [];
                localStorage.removeItem(this.storageKey);
                
                // Clear search
                this.clearSearch();
                
                // Clear attachments
                this.attachedFiles = [];
                this.updateAttachmentPreview();
                
                // Clear UI
                const messageElements = this.chatContainer.querySelectorAll('.message, .typing-indicator');
                messageElements.forEach(element => element.remove());
                
                // Show welcome screen
                this.welcomeScreen.classList.remove('hidden');
            }

            renderMessage(role, content) {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${role}`;
                
                const avatar = document.createElement('div');
                avatar.className = `avatar ${role}`;
                avatar.textContent = role === 'user' ? '👤' : '🤖';
                
                const messageContent = document.createElement('div');
                messageContent.className = 'message-content';
                
                // Render markdown for assistant messages, plain text for user messages
                if (role === 'assistant') {
                    messageContent.innerHTML = marked.parse(content);
                } else {
                    messageContent.textContent = content;
                }
                
                messageDiv.appendChild(avatar);
                messageDiv.appendChild(messageContent);
                
                this.chatContainer.appendChild(messageDiv);
            }
        }

        // Initialize the chat application
        document.addEventListener('DOMContentLoaded', () => {
            window.chatInstance = new DeepSeekChat();
        });
    