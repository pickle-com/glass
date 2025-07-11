import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class AskView extends LitElement {
    static properties = {
        currentResponse: { type: String },
        currentQuestion: { type: String },
        isLoading: { type: Boolean },
        copyState: { type: String },
        isHovering: { type: Boolean },
        hoveredLineIndex: { type: Number },
        lineCopyState: { type: Object },
        showTextInput: { type: Boolean },
        headerText: { type: String },
        headerAnimating: { type: Boolean },
        isStreaming: { type: Boolean },
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

        /* Allow text selection in assistant responses */
        .response-container, .response-container * {
            user-select: text !important;
            cursor: text !important;
        }

        .response-container pre {
            background: rgba(0, 0, 0, 0.4) !important;
            border-radius: 8px !important;
            padding: 12px !important;
            margin: 8px 0 !important;
            overflow-x: auto !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            white-space: pre !important;
            word-wrap: normal !important;
            word-break: normal !important;
        }

        .response-container code {
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace !important;
            font-size: 11px !important;
            background: transparent !important;
            white-space: pre !important;
            word-wrap: normal !important;
            word-break: normal !important;
        }

        .response-container pre code {
            white-space: pre !important;
            word-wrap: normal !important;
            word-break: normal !important;
            display: block !important;
        }

        .response-container p code {
            background: rgba(255, 255, 255, 0.1) !important;
            padding: 2px 4px !important;
            border-radius: 3px !important;
            color: #ffd700 !important;
        }

        .hljs-keyword {
            color: #ff79c6 !important;
        }
        .hljs-string {
            color: #f1fa8c !important;
        }
        .hljs-comment {
            color: #6272a4 !important;
        }
        .hljs-number {
            color: #bd93f9 !important;
        }
        .hljs-function {
            color: #50fa7b !important;
        }
        .hljs-variable {
            color: #8be9fd !important;
        }
        .hljs-built_in {
            color: #ffb86c !important;
        }
        .hljs-title {
            color: #50fa7b !important;
        }
        .hljs-attr {
            color: #50fa7b !important;
        }
        .hljs-tag {
            color: #ff79c6 !important;
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

        .response-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: transparent;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
        }

        .response-header.hidden {
            display: none;
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }

        .response-icon {
            width: 20px;
            height: 20px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .response-icon svg {
            width: 12px;
            height: 12px;
            stroke: rgba(255, 255, 255, 0.9);
        }

        .response-label {
            font-size: 13px;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.9);
            white-space: nowrap;
            position: relative;
            overflow: hidden;
        }

        .response-label.animating {
            animation: fadeInOut 0.3s ease-in-out;
        }

        @keyframes fadeInOut {
            0% {
                opacity: 1;
                transform: translateY(0);
            }
            50% {
                opacity: 0;
                transform: translateY(-10px);
            }
            100% {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1;
            justify-content: flex-end;
        }

        .question-text {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.7);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 300px;
            margin-right: 8px;
        }

        .header-controls {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-shrink: 0;
        }

        .copy-button {
            background: transparent;
            color: rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 4px;
            border-radius: 3px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 24px;
            height: 24px;
            flex-shrink: 0;
            transition: background-color 0.15s ease;
            position: relative;
            overflow: hidden;
        }

        .copy-button:hover {
            background: rgba(255, 255, 255, 0.15);
        }

        .copy-button svg {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
        }

        .copy-button .check-icon {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
        }

        .copy-button.copied .copy-icon {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
        }

        .copy-button.copied .check-icon {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }

        .close-button {
            background: rgba(255, 255, 255, 0.07);
            color: white;
            border: none;
            padding: 4px;
            border-radius: 20px;
            outline: 1px rgba(255, 255, 255, 0.3) solid;
            outline-offset: -1px;
            backdrop-filter: blur(0.5px);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
        }

        .close-button:hover {
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 1);
        }

        .response-container {
            flex: 1;
            padding: 16px;
            padding-left: 48px;
            overflow-y: auto;
            font-size: 14px;
            line-height: 1.6;
            background: transparent;
            min-height: 0;
            max-height: 400px;
            position: relative;
        }

        .response-container.hidden {
            display: none;
        }

        .response-container::-webkit-scrollbar {
            width: 6px;
        }

        .response-container::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
        }

        .response-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
        }

        .response-container::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .loading-dots {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 40px;
        }

        .loading-dot {
            width: 8px;
            height: 8px;
            background: rgba(255, 255, 255, 0.6);
            border-radius: 50%;
            animation: pulse 1.5s ease-in-out infinite;
        }

        .loading-dot:nth-child(1) {
            animation-delay: 0s;
        }

        .loading-dot:nth-child(2) {
            animation-delay: 0.2s;
        }

        .loading-dot:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes pulse {
            0%,
            80%,
            100% {
                opacity: 0.3;
                transform: scale(0.8);
            }
            40% {
                opacity: 1;
                transform: scale(1.2);
            }
        }

        .response-line {
            position: relative;
            padding: 2px 0;
            margin: 0;
            transition: background-color 0.15s ease;
        }

        .response-line:hover {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
        }

        .line-copy-button {
            position: absolute;
            left: -32px;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            padding: 2px;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.15s ease, background-color 0.15s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
        }

        .response-line:hover .line-copy-button {
            opacity: 1;
        }

        .line-copy-button:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        .line-copy-button.copied {
            background: rgba(40, 167, 69, 0.3);
        }

        .line-copy-button svg {
            width: 12px;
            height: 12px;
            stroke: rgba(255, 255, 255, 0.9);
        }

        .text-input-container {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            background: rgba(0, 0, 0, 0.1);
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
            transition: opacity 0.1s ease-in-out, transform 0.1s ease-in-out;
            transform-origin: bottom;
        }

        .text-input-container.hidden {
            opacity: 0;
            transform: scaleY(0);
            padding: 0;
            height: 0;
            overflow: hidden;
        }

        .text-input-container.no-response {
            border-top: none;
        }

        #textInput {
            flex: 1;
            padding: 10px 14px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 20px;
            outline: none;
            border: none;
            color: white;
            font-size: 14px;
            font-family: 'Helvetica Neue', sans-serif;
            font-weight: 400;
        }

        #textInput::placeholder {
            color: rgba(255, 255, 255, 0.5);
        }

        #textInput:focus {
            outline: none;
        }

        .response-line h1,
        .response-line h2,
        .response-line h3,
        .response-line h4,
        .response-line h5,
        .response-line h6 {
            color: rgba(255, 255, 255, 0.95);
            margin: 16px 0 8px 0;
            font-weight: 600;
        }

        .response-line p {
            margin: 8px 0;
            color: rgba(255, 255, 255, 0.9);
        }

        .response-line ul,
        .response-line ol {
            margin: 8px 0;
            padding-left: 20px;
        }

        .response-line li {
            margin: 4px 0;
            color: rgba(255, 255, 255, 0.9);
        }

        .response-line code {
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.95);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 13px;
        }

        .response-line pre {
            background: rgba(255, 255, 255, 0.05);
            color: rgba(255, 255, 255, 0.95);
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 12px 0;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .response-line pre code {
            background: none;
            padding: 0;
        }

        .response-line blockquote {
            border-left: 3px solid rgba(255, 255, 255, 0.3);
            margin: 12px 0;
            padding: 8px 16px;
            background: rgba(255, 255, 255, 0.05);
            color: rgba(255, 255, 255, 0.8);
        }

        .empty-state {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: rgba(255, 255, 255, 0.5);
            font-size: 14px;
        }

        .btn-gap {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            gap: 4px;
        }

        /* ────────────────[ GLASS BYPASS ]─────────────── */
        :host-context(body.has-glass) .ask-container,
        :host-context(body.has-glass) .response-header,
        :host-context(body.has-glass) .response-icon,
        :host-context(body.has-glass) .copy-button,
        :host-context(body.has-glass) .close-button,
        :host-context(body.has-glass) .line-copy-button,
        :host-context(body.has-glass) .text-input-container,
        :host-context(body.has-glass) .response-container pre,
        :host-context(body.has-glass) .response-container p code,
        :host-context(body.has-glass) .response-container pre code {
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

        :host-context(body.has-glass) .copy-button:hover,
        :host-context(body.has-glass) .close-button:hover,
        :host-context(body.has-glass) .line-copy-button,
        :host-context(body.has-glass) .line-copy-button:hover,
        :host-context(body.has-glass) .response-line:hover {
            background: transparent !important;
        }

        :host-context(body.has-glass) .response-container::-webkit-scrollbar-track,
        :host-context(body.has-glass) .response-container::-webkit-scrollbar-thumb {
            background: transparent !important;
        }

        .submit-btn, .clear-btn {
            display: flex;
            align-items: center;
            background: transparent;
            color: white;
            border: none;
            border-radius: 6px;
            margin-left: 8px;
            font-size: 13px;
            font-family: 'Helvetica Neue', sans-serif;
            font-weight: 500;
            overflow: hidden;
            cursor: pointer;
            transition: background 0.15s;
            height: 32px;
            padding: 0 10px;
            box-shadow: none;
        }
        .submit-btn:hover, .clear-btn:hover {
            background: rgba(255,255,255,0.1);
        }
        .btn-label {
            margin-right: 8px;
            display: flex;
            align-items: center;
            height: 100%;
        }
        .btn-icon {
            background: rgba(255,255,255,0.1);
            border-radius: 13%;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
        }
        .btn-icon img, .btn-icon svg {
            width: 13px;
            height: 13px;
            display: block;
        }
        .header-clear-btn {
            background: transparent;
            border: none;
            display: flex;
            align-items: center;
            gap: 2px;
            cursor: pointer;
            padding: 0 2px;
        }
        .header-clear-btn .icon-box {
            color: white;
            font-size: 12px;
            font-family: 'Helvetica Neue', sans-serif;
            font-weight: 500;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 13%;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .header-clear-btn:hover .icon-box {
            background-color: rgba(255,255,255,0.18);
        }
    `;

    constructor() {
        super();
        this.currentResponse = '';
        this.currentQuestion = '';
        this.isLoading = false;
        this.copyState = 'idle';
        this.showTextInput = true;
        this.headerText = 'AI Response';
        this.headerAnimating = false;
        this.isStreaming = false;
        this.accumulatedResponse = '';

        this.marked = null;
        this.hljs = null;
        this.DOMPurify = null;
        this.isLibrariesLoaded = false;

        this.handleStreamChunk = this.handleStreamChunk.bind(this);
        this.handleStreamEnd = this.handleStreamEnd.bind(this);
        this.handleSendText = this.handleSendText.bind(this);
        this.handleGlobalSendRequest = this.handleGlobalSendRequest.bind(this);
        this.handleTextKeydown = this.handleTextKeydown.bind(this);
        this.closeResponsePanel = this.closeResponsePanel.bind(this);
        this.handleCopy = this.handleCopy.bind(this);
        this.clearResponseContent = this.clearResponseContent.bind(this);
        this.processAssistantQuestion = this.processAssistantQuestion.bind(this);
        this.handleToggleTextInput = this.handleToggleTextInput.bind(this);
        this.handleEscKey = this.handleEscKey.bind(this);
        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleWindowBlur = this.handleWindowBlur.bind(this);

        this.handleScroll = this.handleScroll.bind(this);

        this.loadLibraries();

        // --- Resize helpers ---
        this.isThrottled = false;
    }

    async loadLibraries() {
        try {
            if (!window.marked) {
                await this.loadScript('../../assets/marked-4.3.0.min.js');
            }

            if (!window.hljs) {
                await this.loadScript('../../assets/highlight-11.9.0.min.js');
            }

            if (!window.DOMPurify) {
                await this.loadScript('../../assets/dompurify-3.0.7.min.js');
            }

            this.marked = window.marked;
            this.hljs = window.hljs;
            this.DOMPurify = window.DOMPurify;

            if (this.marked && this.hljs) {
                this.marked.setOptions({
                    highlight: (code, lang) => {
                        if (lang && this.hljs.getLanguage(lang)) {
                            try {
                                return this.hljs.highlight(code, { language: lang }).value;
                            } catch (err) {
                                console.warn('Highlight error:', err);
                            }
                        }
                        try {
                            return this.hljs.highlightAuto(code).value;
                        } catch (err) {
                            console.warn('Auto highlight error:', err);
                        }
                        return code;
                    },
                    breaks: true,
                    gfm: true,
                    pedantic: false,
                    smartypants: false,
                    xhtml: false,
                });

                this.isLibrariesLoaded = true;
                this.renderContent();
                console.log('Markdown libraries loaded successfully in AskView');
            }

            if (this.DOMPurify) {
                this.isDOMPurifyLoaded = true;
                console.log('DOMPurify loaded successfully in AskView');
            }
        } catch (error) {
            console.error('Failed to load libraries in AskView:', error);
        }
    }

    handleDocumentClick(e) {
        if (!this.currentResponse && !this.isLoading && !this.isStreaming) {
            const askContainer = this.shadowRoot?.querySelector('.ask-container');
            if (askContainer && !e.composedPath().includes(askContainer)) {
                this.closeIfNoContent();
            }
        }
    }

    handleEscKey(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            this.closeResponsePanel();
        }
    }

    handleWindowBlur() {
        if (!this.currentResponse && !this.isLoading && !this.isStreaming) {
            // If there's no active content, ask the main process to close this window.
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.invoke('close-ask-window-if-empty');
            }
        }
    }

    closeIfNoContent() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('force-close-window', 'ask');
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    parseMarkdown(text) {
        if (!text) return '';

        if (!this.isLibrariesLoaded || !this.marked) {
            return text;
        }

        try {
            return this.marked(text);
        } catch (error) {
            console.error('Markdown parsing error in AskView:', error);
            return text;
        }
    }

    fixIncompleteCodeBlocks(text) {
        if (!text) return text;

        const codeBlockMarkers = text.match(/```/g) || [];
        const markerCount = codeBlockMarkers.length;

        if (markerCount % 2 === 1) {
            return text + '\n```';
        }

        return text;
    }

    connectedCallback() {
        super.connectedCallback();

        console.log('📱 AskView connectedCallback - IPC 이벤트 리스너 설정');

        document.addEventListener('click', this.handleDocumentClick, true);
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

        this.handleQuestionFromAssistant = (event, question) => {
            console.log('📨 AskView: Received question from AssistantView:', question);
            this.currentResponse = '';
            this.isStreaming = false;
            this.requestUpdate();

            this.currentQuestion = question;
            this.isLoading = true;
            this.showTextInput = false;
            this.headerText = 'analyzing screen...';
            this.startHeaderAnimation();
            this.requestUpdate();

            this.processAssistantQuestion(question);
        };

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('ask-global-send', this.handleGlobalSendRequest);
            ipcRenderer.on('toggle-text-input', this.handleToggleTextInput);
            ipcRenderer.on('receive-question-from-assistant', this.handleQuestionFromAssistant);
            ipcRenderer.on('hide-text-input', () => {
                console.log('📤 Hide text input signal received');
                this.showTextInput = false;
                this.requestUpdate();
            });
            ipcRenderer.on('clear-ask-response', () => {
                console.log('📤 Clear response signal received');
                this.currentResponse = '';
                this.isStreaming = false;
                this.isLoading = false;
                this.headerText = 'AI Response';
                this.requestUpdate();
            });
            ipcRenderer.on('window-hide-animation', () => {
                console.log('📤 Ask window hiding - clearing response content');
                setTimeout(() => {
                    this.clearResponseContent();
                }, 250);
            });
            ipcRenderer.on('window-blur', this.handleWindowBlur);
            ipcRenderer.on('window-did-show', () => {
                if (!this.currentResponse && !this.isLoading && !this.isStreaming) {
                    this.focusTextInput();
                }
            });

            ipcRenderer.on('ask-response-chunk', this.handleStreamChunk);
            ipcRenderer.on('ask-response-stream-end', this.handleStreamEnd);

            ipcRenderer.on('scroll-response-up', () => this.handleScroll('up'));
            ipcRenderer.on('scroll-response-down', () => this.handleScroll('down'));
            console.log('✅ AskView: IPC 이벤트 리스너 등록 완료');
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.resizeObserver?.disconnect();

        console.log('📱 AskView disconnectedCallback - IPC 이벤트 리스너 제거');

        document.removeEventListener('click', this.handleDocumentClick, true);
        document.removeEventListener('keydown', this.handleEscKey);

        if (this.copyTimeout) {
            clearTimeout(this.copyTimeout);
        }

        if (this.headerAnimationTimeout) {
            clearTimeout(this.headerAnimationTimeout);
        }

        if (this.streamingTimeout) {
            clearTimeout(this.streamingTimeout);
        }

        Object.values(this.lineCopyTimeouts).forEach(timeout => clearTimeout(timeout));

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeListener('ask-global-send', this.handleGlobalSendRequest);
            ipcRenderer.removeListener('toggle-text-input', this.handleToggleTextInput);
            ipcRenderer.removeListener('clear-ask-response', () => { });
            ipcRenderer.removeListener('hide-text-input', () => { });
            ipcRenderer.removeListener('window-hide-animation', () => { });
            ipcRenderer.removeListener('window-blur', this.handleWindowBlur);

            ipcRenderer.removeListener('ask-response-chunk', this.handleStreamChunk);
            ipcRenderer.removeListener('ask-response-stream-end', this.handleStreamEnd);

            ipcRenderer.removeListener('scroll-response-up', () => this.handleScroll('up'));
            ipcRenderer.removeListener('scroll-response-down', () => this.handleScroll('down'));
            console.log('✅ AskView: IPC 이벤트 리스너 제거 완료');
        }
    }

    handleScroll(direction) {
        const scrollableElement = this.shadowRoot.querySelector('#responseContainer');
        if (scrollableElement) {
            const scrollAmount = 100; // 한 번에 스크롤할 양 (px)
            if (direction === 'up') {
                scrollableElement.scrollTop -= scrollAmount;
            } else {
                scrollableElement.scrollTop += scrollAmount;
            }
        }
    }

    // --- 스트리밍 처리 핸들러 ---
    handleStreamChunk(event, { token }) {
        if (!this.isStreaming) {
            this.isStreaming = true;
            this.isLoading = false;
            this.accumulatedResponse = '';
            const container = this.shadowRoot.getElementById('responseContainer');
            if (container) container.innerHTML = '';
            this.headerText = 'AI Response';
            this.headerAnimating = false;
            this.requestUpdate();
        }
        this.accumulatedResponse += token;
        this.renderContent();
    }

    handleStreamEnd() {
        this.isStreaming = false;
        this.currentResponse = this.accumulatedResponse;
        if (this.headerText !== 'AI Response') {
            this.headerText = 'AI Response';
            this.requestUpdate();
        }
        this.renderContent();
    }

    // ✨ 렌더링 로직 통합
    renderContent() {
        if (!this.isLoading && !this.isStreaming && !this.currentResponse) {
            const responseContainer = this.shadowRoot.getElementById('responseContainer');
            if (responseContainer) responseContainer.innerHTML = '<div class="empty-state">Ask a question to see the response here</div>';
            return;
        }

        const responseContainer = this.shadowRoot.getElementById('responseContainer');
        if (!responseContainer) return;

        if (this.isLoading) {
            responseContainer.innerHTML = `
                <div class="loading-dots">
                    <div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div>
                </div>`;
            return;
        }

        let textToRender = this.isStreaming ? this.accumulatedResponse : this.currentResponse;

        // 불완전한 마크다운 수정
        textToRender = this.fixIncompleteMarkdown(textToRender);
        textToRender = this.fixIncompleteCodeBlocks(textToRender);

        if (this.isLibrariesLoaded && this.marked && this.DOMPurify) {
            try {
                // 마크다운 파싱
                const parsedHtml = this.marked.parse(textToRender);

                // DOMPurify로 정제
                const cleanHtml = this.DOMPurify.sanitize(parsedHtml, {
                    ALLOWED_TAGS: [
                        'h1',
                        'h2',
                        'h3',
                        'h4',
                        'h5',
                        'h6',
                        'p',
                        'br',
                        'strong',
                        'b',
                        'em',
                        'i',
                        'ul',
                        'ol',
                        'li',
                        'blockquote',
                        'code',
                        'pre',
                        'a',
                        'img',
                        'table',
                        'thead',
                        'tbody',
                        'tr',
                        'th',
                        'td',
                        'hr',
                        'sup',
                        'sub',
                        'del',
                        'ins',
                    ],
                    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel'],
                });

                // HTML 적용
                responseContainer.innerHTML = cleanHtml;

                // 코드 하이라이팅 적용
                if (this.hljs) {
                    responseContainer.querySelectorAll('pre code').forEach(block => {
                        this.hljs.highlightElement(block);
                    });
                }

                // 스크롤을 맨 아래로
                responseContainer.scrollTop = responseContainer.scrollHeight;
            } catch (error) {
                console.error('Error rendering markdown:', error);
                // 에러 발생 시 일반 텍스트로 표시
                responseContainer.textContent = textToRender;
            }
        } else {
            // 라이브러리가 로드되지 않았을 때 기본 렌더링
            const basicHtml = textToRender
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>');

            responseContainer.innerHTML = `<p>${basicHtml}</p>`;
        }

        // 🚀 After updating content, recalculate window height
        this.adjustWindowHeightThrottled();
    }

    clearResponseContent() {
        this.currentResponse = '';
        this.currentQuestion = '';
        this.isLoading = false;
        this.isStreaming = false;
        this.headerText = 'AI Response';
        this.showTextInput = true;
        this.accumulatedResponse = '';
        this.requestUpdate();
        this.renderContent(); // 👈 updateResponseContent() 대신 renderContent() 호출
    }

    handleToggleTextInput() {
        this.showTextInput = !this.showTextInput;
        this.requestUpdate();
    }

    requestWindowResize(targetHeight) {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('adjust-window-height', targetHeight);
        }
    }

    animateHeaderText(text) {
        this.headerAnimating = true;
        this.requestUpdate();

        setTimeout(() => {
            this.headerText = text;
            this.headerAnimating = false;
            this.requestUpdate();
        }, 150);
    }

    startHeaderAnimation() {
        this.animateHeaderText('analyzing screen...');

        if (this.headerAnimationTimeout) {
            clearTimeout(this.headerAnimationTimeout);
        }

        this.headerAnimationTimeout = setTimeout(() => {
            this.animateHeaderText('thinking...');
        }, 1500);
    }

    renderMarkdown(content) {
        if (!content) return '';

        if (this.isLibrariesLoaded && this.marked) {
            return this.parseMarkdown(content);
        }

        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
    }

    closeResponsePanel() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('force-close-window', 'ask');
        }
    }

    fixIncompleteMarkdown(text) {
        if (!text) return text;

        // 불완전한 볼드체 처리
        const boldCount = (text.match(/\*\*/g) || []).length;
        if (boldCount % 2 === 1) {
            text += '**';
        }

        // 불완전한 이탤릭체 처리
        const italicCount = (text.match(/(?<!\*)\*(?!\*)/g) || []).length;
        if (italicCount % 2 === 1) {
            text += '*';
        }

        // 불완전한 인라인 코드 처리
        const inlineCodeCount = (text.match(/`/g) || []).length;
        if (inlineCodeCount % 2 === 1) {
            text += '`';
        }

        // 불완전한 링크 처리
        const openBrackets = (text.match(/\[/g) || []).length;
        const closeBrackets = (text.match(/\]/g) || []).length;
        if (openBrackets > closeBrackets) {
            text += ']';
        }

        const openParens = (text.match(/\]\(/g) || []).length;
        const closeParens = (text.match(/\)\s*$/g) || []).length;
        if (openParens > closeParens && text.endsWith('(')) {
            text += ')';
        }

        return text;
    }

    // ✨ processAssistantQuestion 수정
    async processAssistantQuestion(question) {
        this.currentQuestion = question;
        this.showTextInput = false;
        this.isLoading = true;
        this.isStreaming = false;
        this.currentResponse = '';
        this.accumulatedResponse = '';
        this.startHeaderAnimation();
        this.requestUpdate();
        this.renderContent();

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('ask:sendMessage', question).catch(error => {
                console.error('Error processing assistant question:', error);
                this.isLoading = false;
                this.isStreaming = false;
                this.currentResponse = `Error: ${error.message}`;
                this.renderContent();
            });
        }
    }

    async handleCopy() {
        if (this.copyState === 'copied') return;

        let responseToCopy = this.currentResponse;

        if (this.isDOMPurifyLoaded && this.DOMPurify) {
            const testHtml = this.renderMarkdown(responseToCopy);
            const sanitized = this.DOMPurify.sanitize(testHtml);

            if (this.DOMPurify.removed && this.DOMPurify.removed.length > 0) {
                console.warn('Unsafe content detected, copy blocked');
                return;
            }
        }

        const textToCopy = `Question: ${this.currentQuestion}\n\nAnswer: ${responseToCopy}`;

        try {
            await navigator.clipboard.writeText(textToCopy);
            console.log('Content copied to clipboard');

            this.copyState = 'copied';
            this.requestUpdate();

            if (this.copyTimeout) {
                clearTimeout(this.copyTimeout);
            }

            this.copyTimeout = setTimeout(() => {
                this.copyState = 'idle';
                this.requestUpdate();
            }, 1500);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    async handleLineCopy(lineIndex) {
        const originalLines = this.currentResponse.split('\n');
        const lineToCopy = originalLines[lineIndex];

        if (!lineToCopy) return;

        try {
            await navigator.clipboard.writeText(lineToCopy);
            console.log('Line copied to clipboard');

            // '복사됨' 상태로 UI 즉시 업데이트
            this.lineCopyState = { ...this.lineCopyState, [lineIndex]: true };
            this.requestUpdate(); // LitElement에 UI 업데이트 요청

            // 기존 타임아웃이 있다면 초기화
            if (this.lineCopyTimeouts && this.lineCopyTimeouts[lineIndex]) {
                clearTimeout(this.lineCopyTimeouts[lineIndex]);
            }

            // ✨ 수정된 타임아웃: 1.5초 후 '복사됨' 상태 해제
            this.lineCopyTimeouts[lineIndex] = setTimeout(() => {
                const updatedState = { ...this.lineCopyState };
                delete updatedState[lineIndex];
                this.lineCopyState = updatedState;
                this.requestUpdate(); // UI 업데이트 요청
            }, 1500);
        } catch (err) {
            console.error('Failed to copy line:', err);
        }
    }

    async handleSendText() {
        const textInput = this.shadowRoot?.getElementById('textInput');
        if (!textInput) return;
        const text = textInput.value.trim();
        if (!text) return;

        textInput.value = '';

        this.currentQuestion = text;
        this.lineCopyState = {};
        this.showTextInput = false;
        this.isLoading = true;
        this.isStreaming = false;
        this.currentResponse = '';
        this.accumulatedResponse = '';
        this.startHeaderAnimation();
        this.requestUpdate();
        this.renderContent();

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('ask:sendMessage', text).catch(error => {
                console.error('Error sending text:', error);
                this.isLoading = false;
                this.isStreaming = false;
                this.currentResponse = `Error: ${error.message}`;
                this.renderContent();
            });
        }
    }

    handleTextKeydown(e) {
        // Fix for IME composition issue: Ignore Enter key presses while composing.
        if (e.isComposing) {
            return;
        }

        const isPlainEnter = e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey;
        const isModifierEnter = e.key === 'Enter' && (e.metaKey || e.ctrlKey);

        if (isPlainEnter || isModifierEnter) {
            e.preventDefault();
            this.handleSendText();
        }
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('isLoading')) {
            this.renderContent();
        }

        if (changedProperties.has('showTextInput') || changedProperties.has('isLoading')) {
            this.adjustWindowHeightThrottled();
        }

        if (changedProperties.has('showTextInput') && this.showTextInput) {
            this.focusTextInput();
        }
    }

    focusTextInput() {
        requestAnimationFrame(() => {
            const textInput = this.shadowRoot?.getElementById('textInput');
            if (textInput) {
                textInput.focus();
            }
        });
    }

    firstUpdated() {
        setTimeout(() => this.adjustWindowHeight(), 200);
    }

    handleGlobalSendRequest() {
        const textInput = this.shadowRoot?.getElementById('textInput');

        if (!this.showTextInput) {
            this.showTextInput = true;
            this.requestUpdate();
            this.focusTextInput();
            return;
        }

        if (!textInput) return;

        textInput.focus();

        if (!textInput.value.trim()) return;

        this.handleSendText();
    }

    getTruncatedQuestion(question, maxLength = 30) {
        if (!question) return '';
        if (question.length <= maxLength) return question;
        return question.substring(0, maxLength) + '...';
    }

    handleInputFocus() {
        this.isInputFocused = true;
    }

    handleInputBlur(e) {
        this.isInputFocused = false;

        // 잠시 후 포커스가 다른 곳으로 갔는지 확인
        setTimeout(() => {
            const activeElement = this.shadowRoot?.activeElement || document.activeElement;
            const textInput = this.shadowRoot?.getElementById('textInput');

            // 포커스가 AskView 내부가 아니고, 응답이 없는 경우
            if (!this.currentResponse && !this.isLoading && !this.isStreaming && activeElement !== textInput && !this.isInputFocused) {
                this.closeIfNoContent();
            }
        }, 200);
    }

    render() {
        const hasResponse = this.isLoading || this.currentResponse || this.isStreaming;

        return html`
            <div class="ask-container">
                <!-- Response Header -->
                <div class="response-header ${!hasResponse ? 'hidden' : ''}">
                    <div class="header-left">
                        <div class="response-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                                <path d="M8 12l2 2 4-4" />
                            </svg>
                        </div>
                        <span class="response-label ${this.headerAnimating ? 'animating' : ''}">${this.headerText}</span>
                    </div>
                    <div class="header-right">
                        <span class="question-text">${this.getTruncatedQuestion(this.currentQuestion)}</span>
                        <div class="header-controls">
                            <button class="copy-button ${this.copyState === 'copied' ? 'copied' : ''}" @click=${this.handleCopy}>
                                <svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                </svg>
                                <svg
                                    class="check-icon"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2.5"
                                >
                                    <path d="M20 6L9 17l-5-5" />
                                </svg>
                            </button>
                            <button class="close-button" @click=${this.closeResponsePanel}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Response Container -->
                <div class="response-container ${!hasResponse ? 'hidden' : ''}" id="responseContainer">
                    <!-- Content is dynamically generated in updateResponseContent() -->
                </div>

                <!-- Text Input Container -->
                <div class="text-input-container ${!hasResponse ? 'no-response' : ''} ${!this.showTextInput ? 'hidden' : ''}">
                    <input
                        type="text"
                        id="textInput"
                        placeholder="Ask about your screen or audio"
                        @keydown=${this.handleTextKeydown}
                        @focus=${this.handleInputFocus}
                        @blur=${this.handleInputBlur}
                    />
                    <button
                        class="submit-btn"
                        @click=${this.handleSendText}
                    >
                        <span class="btn-label">Submit</span>
                        <span class="btn-icon">
                            ↵
                        </span>
                    </button>
                </div>
            </div>
        `;
    }

    // Dynamically resize the BrowserWindow to fit current content
    adjustWindowHeight() {
        if (!window.require) return;

        this.updateComplete.then(() => {
            const headerEl = this.shadowRoot.querySelector('.response-header');
            const responseEl = this.shadowRoot.querySelector('.response-container');
            const inputEl = this.shadowRoot.querySelector('.text-input-container');

            if (!headerEl || !responseEl) return;

            const headerHeight = headerEl.classList.contains('hidden') ? 0 : headerEl.offsetHeight;
            const responseHeight = responseEl.scrollHeight;
            const inputHeight = (inputEl && !inputEl.classList.contains('hidden')) ? inputEl.offsetHeight : 0;

            const idealHeight = headerHeight + responseHeight + inputHeight;

            const targetHeight = Math.min(700, idealHeight);

            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('adjust-window-height', targetHeight);

        }).catch(err => console.error('AskView adjustWindowHeight error:', err));
    }

    // Throttled wrapper to avoid excessive IPC spam (executes at most once per animation frame)
    adjustWindowHeightThrottled() {
        if (this.isThrottled) return;

        this.isThrottled = true;
        requestAnimationFrame(() => {
            this.adjustWindowHeight();
            this.isThrottled = false;
        });
    }
}

customElements.define('ask-view', AskView);
