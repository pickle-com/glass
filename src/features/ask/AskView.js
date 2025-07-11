import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class AskView extends LitElement {
    static properties = {
        conversationHistory: { type: Array },    // Array of {role: 'user'|'assistant', content: string, timestamp: number}
        currentStreamingMessage: { type: String },  // Currently streaming AI response
        isLoading: { type: Boolean },
        showTextInput: { type: Boolean },
        headerText: { type: String },
        isStreaming: { type: Boolean },
        showScrollButton: { type: Boolean },  // Show scroll to bottom button
    };

    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            color: white;
            transform: translate3d(0, 0, 0);
            backface-visibility: hidden;
            transition: transform 0.2s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.2s ease-out;
            will-change: transform, opacity;
        }

        :host(.hiding) {
            animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }

        :host(.showing) {
            animation: slideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        :host(.hidden) {
            opacity: 0;
            transform: translateY(-150%) scale(0.85);
            pointer-events: none;
        }

        @keyframes slideUp {
            0% {
                opacity: 1;
                transform: translateY(0) scale(1);
                filter: blur(0px);
            }
            30% {
                opacity: 0.7;
                transform: translateY(-20%) scale(0.98);
                filter: blur(0.5px);
            }
            70% {
                opacity: 0.3;
                transform: translateY(-80%) scale(0.92);
                filter: blur(1.5px);
            }
            100% {
                opacity: 0;
                transform: translateY(-150%) scale(0.85);
                filter: blur(2px);
            }
        }

        @keyframes slideDown {
            0% {
                opacity: 0;
                transform: translateY(-150%) scale(0.85);
                filter: blur(2px);
            }
            30% {
                opacity: 0.5;
                transform: translateY(-50%) scale(0.92);
                filter: blur(1px);
            }
            65% {
                opacity: 0.9;
                transform: translateY(-5%) scale(0.99);
                filter: blur(0.2px);
            }
            85% {
                opacity: 0.98;
                transform: translateY(2%) scale(1.005);
                filter: blur(0px);
            }
            100% {
                opacity: 1;
                transform: translateY(0) scale(1);
                filter: blur(0px);
            }
        }

        * {
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: default;
            user-select: none;
        }

        .ask-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            background: rgba(0, 0, 0, 0.6);
            border-radius: 12px;
            outline: 0.5px rgba(255, 255, 255, 0.3) solid;
            outline-offset: -1px;
            backdrop-filter: blur(1px);
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
        }

        .ask-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.15);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border-radius: 12px;
            filter: blur(10px);
            z-index: -1;
        }

        .chat-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: transparent;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }

        .chat-icon {
            width: 20px;
            height: 20px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .chat-icon svg {
            width: 12px;
            height: 12px;
            stroke: rgba(255, 255, 255, 0.9);
        }

        .chat-title {
            font-size: 13px;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.9);
            white-space: nowrap;
        }

        .conversation-container {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            overflow-x: hidden;
            background: transparent;
            min-height: 0;
            max-height: calc(100vh - 120px); /* Ensure it doesn't exceed viewport */
            display: flex;
            flex-direction: column;
            gap: 12px;
            scroll-behavior: smooth;
            position: relative; /* For scroll button positioning */
        }

        .conversation-container::-webkit-scrollbar {
            width: 8px;
        }

        .conversation-container::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
            margin: 4px;
        }

        .conversation-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .conversation-container::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.35);
            border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .conversation-container::-webkit-scrollbar-corner {
            background: transparent;
        }

        .message-bubble {
            max-width: 85%;
            padding: 12px 16px;
            border-radius: 18px;
            font-size: 13px;
            line-height: 1.4;
            word-wrap: break-word;
            position: relative;
            animation: messageSlideIn 0.3s ease-out;
            cursor: text;
            user-select: text;
            -webkit-user-select: text;
            -moz-user-select: text;
            -ms-user-select: text;
        }

        .message-bubble * {
            user-select: text;
            -webkit-user-select: text;
        }

        .message-bubble h1,
        .message-bubble h2,
        .message-bubble h3,
        .message-bubble h4,
        .message-bubble h5,
        .message-bubble h6 {
            margin: 8px 0 4px 0;
            font-weight: 600;
        }

        .message-bubble h3 {
            font-size: 14px;
            color: inherit;
        }

        .message-bubble p {
            margin: 4px 0;
        }

        .message-bubble strong {
            font-weight: 600;
        }

        .message-bubble ul,
        .message-bubble ol {
            margin: 4px 0;
            padding-left: 20px;
        }

        .message-bubble li {
            margin: 2px 0;
        }

        .message-bubble code {
            background: rgba(255, 255, 255, 0.1);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 12px;
        }

        .message-bubble.user {
            align-self: flex-end;
            background: linear-gradient(135deg, #007AFF 0%, #0056D6 100%);
            color: white;
            border-bottom-right-radius: 6px;
            margin-left: auto;
        }

        .message-bubble.assistant {
            align-self: flex-start;
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-bottom-left-radius: 6px;
            backdrop-filter: blur(10px);
        }

        .message-bubble.streaming {
            border-bottom-right-radius: 18px;
            position: relative;
        }

        .message-bubble.streaming::after {
            content: '';
            display: inline-block;
            width: 4px;
            height: 4px;
            background: rgba(255, 255, 255, 0.7);
            border-radius: 50%;
            margin-left: 4px;
            animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes messageSlideIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
        }

        .loading-message {
            display: flex;
            align-items: center;
            gap: 8px;
            color: rgba(255, 255, 255, 0.7);
            font-size: 13px;
            padding: 16px;
            align-self: flex-start;
        }

        .loading-dots {
            display: flex;
            gap: 3px;
        }

        .loading-dot {
            width: 4px;
            height: 4px;
            background: rgba(255, 255, 255, 0.6);
            border-radius: 50%;
            animation: loadingDot 1.4s ease-in-out infinite both;
        }

        .loading-dot:nth-child(1) { animation-delay: -0.32s; }
        .loading-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes loadingDot {
            0%, 80%, 100% {
                transform: scale(0.8);
                opacity: 0.5;
            }
            40% {
                transform: scale(1);
                opacity: 1;
            }
        }

        .text-input-container {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            background: transparent;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
        }

        .text-input-container.hidden {
            display: none;
        }

        #textInput {
            flex: 1;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 10px 16px;
            color: white;
            font-size: 13px;
            outline: none;
            transition: all 0.2s ease;
        }

        #textInput::placeholder {
            color: rgba(255, 255, 255, 0.5);
        }

        #textInput:focus {
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(255, 255, 255, 0.2);
            box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
        }

        #textInput:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .send-button {
            width: 36px;
            height: 36px;
            background: #007AFF;
            border: none;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            flex-shrink: 0;
        }

        .send-button:hover:not(:disabled) {
            background: #0056D6;
            transform: scale(1.05);
        }

        .send-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        .send-button svg {
            width: 16px;
            height: 16px;
            stroke: white;
            stroke-width: 2;
        }

        .scroll-to-bottom {
            position: absolute;
            bottom: 16px;
            right: 16px;
            width: 36px;
            height: 36px;
            background: rgba(0, 0, 0, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10;
        }

        .scroll-to-bottom:hover {
            background: rgba(0, 0, 0, 0.8);
            transform: scale(1.05);
        }

        .scroll-to-bottom svg {
            width: 16px;
            height: 16px;
            stroke: rgba(255, 255, 255, 0.8);
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 40px 20px;
            text-align: center;
            color: rgba(255, 255, 255, 0.7);
            min-height: 200px;
        }

        .empty-state-icon {
            width: 32px;
            height: 32px;
            stroke: rgba(255, 255, 255, 0.5);
            stroke-width: 1.5;
        }

        .scroll-to-bottom svg {
            width: 20px;
            height: 20px;
            stroke: rgba(255, 255, 255, 0.9);
        }

        .scroll-to-bottom.hidden {
            opacity: 0;
            visibility: hidden;
            transform: translateY(10px);
        }

        /* ────────────────[ GLASS BYPASS ]─────────────── */
        :host-context(body.has-glass) .ask-container,
        :host-context(body.has-glass) .chat-header,
        :host-context(body.has-glass) .chat-icon,
        :host-context(body.has-glass) .send-button,
        :host-context(body.has-glass) .text-input-container,
        :host-context(body.has-glass) .message-bubble,
        :host-context(body.has-glass) .loading-message {
            background: transparent !important;
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
        }

        :host-context(body.has-glass) .ask-container::before {
            display: none !important;
        }

        :host-context(body.has-glass) .send-button:hover,
        :host-context(body.has-glass) .message-bubble:hover {
            background: transparent !important;
        }

        :host-context(body.has-glass) .conversation-container::-webkit-scrollbar-track,
        :host-context(body.has-glass) .conversation-container::-webkit-scrollbar-thumb {
            background: transparent !important;
        }
    `;

    constructor() {
        super();
        this.conversationHistory = [];
        this.currentStreamingMessage = '';
        this.isLoading = false;
        this.showTextInput = true;
        this.headerText = 'Design Tutor';
        this.isStreaming = false;
        this.showScrollButton = false;
        this.conversationState = null;

        this.handleStreamChunk = this.handleStreamChunk.bind(this);
        this.handleStreamEnd = this.handleStreamEnd.bind(this);
        this.handleSendText = this.handleSendText.bind(this);
        this.handleTextKeydown = this.handleTextKeydown.bind(this);
        this.handleToggleTextInput = this.handleToggleTextInput.bind(this);
        this.handleEscKey = this.handleEscKey.bind(this);
        this.handleWindowBlur = this.handleWindowBlur.bind(this);
        
        // Initialize with greeting if this is a new session
        this.initializeGreeting();
    }

    // Initialize with greeting message
    async initializeGreeting() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            try {
                const state = await ipcRenderer.invoke('ask:getConversationState');
                this.conversationState = state;
                
                // If it's a new session (greeting phase), show initial message
                if (state.phase === 'greeting' && this.conversationHistory.length === 0) {
                    this.conversationHistory = [{
                        role: 'assistant',
                        content: 'Hi! What are you planning to design today?',
                        timestamp: Date.now()
                    }];
                    this.requestUpdate();
                }
            } catch (error) {
                console.error('Error getting conversation state:', error);
            }
        }
    }

    // Simple markdown parser that returns clean text (no HTML)
    parseMarkdown(text) {
        if (!text) return '';
        
        return text
            // Remove markdown bold syntax **text** -> text (keep the text bold styling will be done via CSS)
            .replace(/\*\*(.*?)\*\*/g, '$1')
            // Remove markdown headers ### Text -> Text
            .replace(/^### (.*$)/gm, '$1')
            // Keep line breaks as they are
            .replace(/\n/g, '\n');
    }

    connectedCallback() {
        super.connectedCallback();

        console.log('📱 AskView connectedCallback - Setting up chat interface');

        document.addEventListener('keydown', this.handleEscKey);

        this.resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const needed = entry.contentRect.height;
                const current = window.innerHeight;

                if (needed > current - 4) {
                    this.requestWindowResize(Math.ceil(needed));
                }
            }
        });

        const container = this.shadowRoot?.querySelector('.ask-container');
        if (container) this.resizeObserver.observe(container);

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('toggle-text-input', this.handleToggleTextInput);
            ipcRenderer.on('window-blur', this.handleWindowBlur);
            ipcRenderer.on('window-did-show', () => {
                this.focusTextInput();
                // Refresh conversation state when window shows
                this.updateConversationState();
            });

            ipcRenderer.on('ask-response-chunk', this.handleStreamChunk);
            ipcRenderer.on('ask-response-stream-end', this.handleStreamEnd);
            console.log('✅ AskView: Chat interface ready');
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('keydown', this.handleEscKey);
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }

    // --- 스트리밍 처리 핸들러 ---
    handleStreamChunk(event, { token }) {
        if (!this.isStreaming) {
            this.isStreaming = true;
            this.isLoading = false;
            this.currentStreamingMessage = '';
            this.headerText = 'Chat';
            this.requestUpdate();
        }
        this.currentStreamingMessage += token;
        this.requestUpdate();
        // Use conditional scrolling during streaming to not interrupt user
        this.conditionalScrollToBottom();
    }

    handleStreamEnd() {
        if (this.isStreaming) {
            // Add the completed AI message to conversation history
            this.conversationHistory = [...this.conversationHistory, {
                role: 'assistant',
                content: this.currentStreamingMessage,
                timestamp: Date.now()
            }];
            
            this.currentStreamingMessage = '';
            this.isStreaming = false;
            
            // Update conversation state after response
            this.updateConversationState();
            
            this.requestUpdate();
            // Force scroll to bottom when message is complete
            this.scrollToBottom();
        }
    }

    scrollToBottom() {
        this.updateComplete.then(() => {
            const container = this.shadowRoot.getElementById('conversationContainer');
            if (container) {
                // Use smooth scrolling for better UX
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: 'smooth'
                });
                
                // Hide scroll button since we're going to bottom
                this.showScrollButton = false;
                this.requestUpdate();
            }
        });
    }

    // New method to check if user is near bottom of chat
    isUserNearBottom() {
        const container = this.shadowRoot.getElementById('conversationContainer');
        if (!container) return true;
        
        const threshold = 100; // pixels from bottom
        return container.scrollTop + container.clientHeight >= container.scrollHeight - threshold;
    }

    // Enhanced scroll to bottom that respects user scroll position
    conditionalScrollToBottom() {
        // Only auto-scroll if user is already near the bottom
        if (this.isUserNearBottom()) {
            this.scrollToBottom();
        } else {
            // Update scroll button when new content is added but user isn't at bottom
            this.updateScrollButton();
        }
    }

    async handleSendText() {
        const textInput = this.shadowRoot?.getElementById('textInput');
        if (!textInput) return;
        const text = textInput.value.trim();
        if (!text) return;

        // Clear input
        textInput.value = '';

        // Add user message to conversation history
        this.conversationHistory = [...this.conversationHistory, {
            role: 'user',
            content: text,
            timestamp: Date.now()
        }];

        // Set loading state
        this.isLoading = true;
        this.isStreaming = false;
        this.currentStreamingMessage = '';
        this.requestUpdate();
        
        // Always scroll to bottom when user sends a message
        this.scrollToBottom();

        // Send message to backend
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            try {
                await ipcRenderer.invoke('ask:sendMessage', text);
            } catch (error) {
                console.error('Error sending text:', error);
                
                // Add error message to conversation
                this.conversationHistory = [...this.conversationHistory, {
                    role: 'assistant',
                    content: `Error: ${error.message}`,
                    timestamp: Date.now()
                }];
                
                this.isLoading = false;
                this.isStreaming = false;
                this.requestUpdate();
                this.scrollToBottom();
            }
        }
    }

    handleTextKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.handleSendText();
        }
    }

    handleToggleTextInput() {
        this.showTextInput = !this.showTextInput;
        this.requestUpdate();
        if (this.showTextInput) {
            setTimeout(() => this.focusTextInput(), 100);
        }
    }

    handleEscKey(event) {
        if (event.key === 'Escape') {
            // Could close the window or clear input
            const textInput = this.shadowRoot?.getElementById('textInput');
            if (textInput && textInput.value) {
                textInput.value = '';
            }
        }
    }

    handleWindowBlur() {
        // Optional: handle when window loses focus
        console.log('Chat window lost focus');
    }

    async updateConversationState() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            try {
                const state = await ipcRenderer.invoke('ask:getConversationState');
                this.conversationState = state;
                
                // Update header text based on current state
                this.updateHeaderText();
                this.requestUpdate();
            } catch (error) {
                console.error('Error updating conversation state:', error);
            }
        }
    }

    updateHeaderText() {
        if (!this.conversationState) return;
        
        switch (this.conversationState.phase) {
            case 'greeting':
                this.headerText = 'Design Tutor - Getting Started';
                break;
            case 'planning':
                this.headerText = 'Design Tutor - Planning';
                break;
            case 'task_assigned':
                this.headerText = `Design Tutor - Task ${this.conversationState.currentTaskNumber}`;
                break;
            case 'feedback':
                this.headerText = 'Design Tutor - Feedback';
                break;
            case 'approved':
                this.headerText = 'Design Tutor - Great Work!';
                break;
            default:
                this.headerText = 'Design Tutor';
        }
    }

    getEmptyStateContent() {
        if (!this.conversationState) {
            return html`
                <span>Loading...</span>
                <span style="font-size: 12px; opacity: 0.7;">Preparing your design session</span>
            `;
        }

        switch (this.conversationState.phase) {
            case 'greeting':
                return html`
                    <span>Ready to start learning design!</span>
                    <span style="font-size: 12px; opacity: 0.7;">Tell me what you'd like to design today</span>
                `;
            case 'planning':
                return html`
                    <span>Let's plan your design project</span>
                    <span style="font-size: 12px; opacity: 0.7;">Project: ${this.conversationState.projectDescription}</span>
                `;
            case 'task_assigned':
                return html`
                    <span>Working on Task ${this.conversationState.currentTaskNumber}</span>
                    <span style="font-size: 12px; opacity: 0.7;">${this.conversationState.currentTask}</span>
                `;
            case 'feedback':
                return html`
                    <span>Review your work</span>
                    <span style="font-size: 12px; opacity: 0.7;">I'll provide feedback on your progress</span>
                `;
            default:
                return html`
                    <span>Design session in progress</span>
                    <span style="font-size: 12px; opacity: 0.7;">Continue with your current task</span>
                `;
        }
    }

    focusTextInput() {
        const textInput = this.shadowRoot?.getElementById('textInput');
        if (textInput) {
            textInput.focus();
        }
    }

    // Dynamically resize the BrowserWindow to fit current content
    adjustWindowHeight() {
        if (!window.require) return;

        this.updateComplete.then(() => {
            const headerEl = this.shadowRoot.querySelector('.chat-header');
            const conversationEl = this.shadowRoot.querySelector('.conversation-container');
            const inputEl = this.shadowRoot.querySelector('.text-input-container');

            if (!headerEl || !conversationEl) return;

            const headerHeight = headerEl.offsetHeight;
            const inputHeight = (inputEl && !inputEl.classList.contains('hidden')) ? inputEl.offsetHeight : 0;
            
            // For chat interface, we want a consistent height rather than dynamic
            // Let the conversation area scroll if content is too long
            const targetHeight = Math.min(600, Math.max(400, headerHeight + 300 + inputHeight));

            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('adjust-window-height', targetHeight);

        }).catch(err => console.error('AskView adjustWindowHeight error:', err));
    }

    requestWindowResize(targetHeight) {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('adjust-window-height', targetHeight);
        }
    }

    firstUpdated() {
        setTimeout(() => this.adjustWindowHeight(), 200);
        
        // Add scroll event listener to conversation container
        const container = this.shadowRoot.getElementById('conversationContainer');
        if (container) {
            container.addEventListener('scroll', () => {
                this.updateScrollButton();
            });
        }
    }

    updateScrollButton() {
        const shouldShow = !this.isUserNearBottom() && this.conversationHistory.length > 0;
        if (this.showScrollButton !== shouldShow) {
            this.showScrollButton = shouldShow;
            this.requestUpdate();
        }
    }

    render() {
        return html`
            <div class="ask-container">
                <!-- Chat Header -->
                <div class="chat-header">
                    <div class="header-left">
                        <div class="chat-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                        </div>
                        <span class="chat-title">${this.headerText}</span>
                    </div>
                </div>

                <!-- Conversation Container -->
                <div class="conversation-container" id="conversationContainer">
                    ${this.conversationHistory.length === 0 && !this.isLoading && !this.isStreaming
                        ? html`
                            <div class="empty-state">
                                <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                </svg>
                                ${this.getEmptyStateContent()}
                            </div>
                        `
                        : html`
                            ${this.conversationHistory.map(msg => html`
                                <div class="message-bubble ${msg.role}">
                                    ${this.parseMarkdown(msg.content)}
                                </div>
                            `)}
                            
                            ${this.isLoading ? html`
                                <div class="loading-message">
                                    <span>AI is thinking</span>
                                    <div class="loading-dots">
                                        <div class="loading-dot"></div>
                                        <div class="loading-dot"></div>
                                        <div class="loading-dot"></div>
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${this.isStreaming && this.currentStreamingMessage ? html`
                                <div class="message-bubble assistant streaming">
                                    ${this.parseMarkdown(this.currentStreamingMessage)}
                                </div>
                            ` : ''}
                        `
                    }
                    
                    <!-- Scroll to Bottom Button -->
                    ${this.showScrollButton ? html`
                        <div class="scroll-to-bottom" @click=${this.scrollToBottom}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="m6 9 6 6 6-6"/>
                            </svg>
                        </div>
                    ` : ''}
                </div>

                <!-- Text Input - Always visible for chat interface -->
                <div class="text-input-container">
                    <input 
                        type="text" 
                        id="textInput" 
                        placeholder="Ask me anything..."
                        @keydown=${this.handleTextKeydown}
                        .disabled=${this.isLoading || this.isStreaming}
                    />
                    <button 
                        class="send-button" 
                        @click=${this.handleSendText}
                        .disabled=${this.isLoading || this.isStreaming}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22,2 15,22 11,13 2,9"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }
}

customElements.define('ask-view', AskView); 