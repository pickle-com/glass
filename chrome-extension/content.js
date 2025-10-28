/**
 * Glass Web Assistant - Content Script
 * 在网页中运行，负责内容提取、高亮显示和用户交互
 */

console.log('[Glass Extension] Content script loading...');

class GlassContentScript {
    constructor() {
        this.isActive = false;
        this.highlightElements = new Map();
        this.textProcessor = new WebTextProcessor();
        this.observer = null;
        this.debounceTimer = null;
        
        this.init();
    }

    /**
     * 初始化content script
     */
    init() {
        // 等待DOM完全加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    /**
     * 设置content script
     */
    setup() {
        this.setupEventListeners();
        this.setupMutationObserver();
        this.extractInitialContent();
        
        console.log('[Glass Extension] Content script initialized on:', window.location.href);
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听来自background script的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleBackgroundMessage(message, sender, sendResponse);
            return true;
        });

        // 监听页面变化
        window.addEventListener('load', () => {
            this.debounceContentExtraction();
        });

        // 监听双击事件（用于获取词汇定义）
        document.addEventListener('dblclick', (event) => {
            this.handleDoubleClick(event);
        });

        // 监听选择文本事件
        document.addEventListener('mouseup', () => {
            this.handleTextSelection();
        });
    }

    /**
     * 设置DOM变化监听
     */
    setupMutationObserver() {
        this.observer = new MutationObserver((mutations) => {
            let shouldReprocess = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // 检查是否有新的文本内容添加
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                            shouldReprocess = true;
                            break;
                        }
                        if (node.nodeType === Node.ELEMENT_NODE && node.textContent.length > 50) {
                            shouldReprocess = true;
                            break;
                        }
                    }
                }
            });

            if (shouldReprocess) {
                this.debounceContentExtraction();
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * 防抖内容提取
     */
    debounceContentExtraction() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.extractAndSendContent();
        }, 1000); // 1秒防抖
    }

    /**
     * 提取初始页面内容
     */
    extractInitialContent() {
        // 页面加载完成后立即提取内容
        setTimeout(() => {
            this.extractAndSendContent();
        }, 500);
    }

    /**
     * 提取并发送页面内容
     */
    async extractAndSendContent() {
        try {
            const content = this.textProcessor.extractPageContent();
            
            if (content.text.length < 50) {
                return; // 内容太少，跳过
            }

            // 发送到background script
            await chrome.runtime.sendMessage({
                action: 'extractContent',
                data: content
            });

            console.log(`[Glass Extension] Content extracted: ${content.text.length} characters`);
        } catch (error) {
            console.error('[Glass Extension] Content extraction failed:', error);
            this.reportError(error);
        }
    }

    /**
     * 处理来自background script的消息
     */
    handleBackgroundMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'highlightKeywords':
                    this.highlightKeywords(message.data);
                    sendResponse({ success: true });
                    break;

                case 'showDefinitions':
                    this.showDefinitions(message.data);
                    sendResponse({ success: true });
                    break;

                case 'highlight':
                    this.highlightText(message.data);
                    sendResponse({ success: true });
                    break;

                case 'clearHighlights':
                    this.clearAllHighlights();
                    sendResponse({ success: true });
                    break;

                default:
                    console.warn('[Glass Extension] Unknown background message:', message.action);
                    sendResponse({ success: false });
            }
        } catch (error) {
            console.error('[Glass Extension] Error handling background message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * 高亮关键词
     */
    highlightKeywords(keywords) {
        if (!keywords || keywords.length === 0) {
            return;
        }

        console.log(`[Glass Extension] Highlighting ${keywords.length} keywords`);

        keywords.forEach(keyword => {
            this.highlightKeyword(keyword);
        });
    }

    /**
     * 高亮单个关键词
     */
    highlightKeyword(keyword) {
        const text = typeof keyword === 'string' ? keyword : keyword.word;
        const importance = typeof keyword === 'object' ? keyword.importance : 'medium';
        
        try {
            // 使用TreeWalker遍历文本节点
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        // 跳过已经高亮的元素和脚本/样式标签
                        const parent = node.parentElement;
                        if (!parent || parent.classList.contains('glass-highlight') ||
                            ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
                            return NodeFilter.FILTER_SKIP;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
            );

            const regex = new RegExp(`\\b${text}\\b`, 'gi');
            const nodesToReplace = [];

            let node;
            while (node = walker.nextNode()) {
                if (regex.test(node.textContent)) {
                    nodesToReplace.push(node);
                }
            }

            nodesToReplace.forEach(textNode => {
                this.replaceTextWithHighlight(textNode, text, importance);
            });

        } catch (error) {
            console.error('[Glass Extension] Keyword highlighting error:', error);
        }
    }

    /**
     * 替换文本为高亮版本
     */
    replaceTextWithHighlight(textNode, keyword, importance) {
        const parent = textNode.parentNode;
        const text = textNode.textContent;
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        
        if (!regex.test(text)) {
            return;
        }

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // 添加匹配前的文本
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
            }

            // 创建高亮元素
            const highlight = document.createElement('span');
            highlight.className = `glass-highlight glass-${importance}`;
            highlight.textContent = match[0];
            highlight.title = `Glass: ${keyword}`;
            
            // 添加点击事件
            highlight.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showTermDefinition(keyword, e.target);
            });

            fragment.appendChild(highlight);
            
            // 存储高亮元素引用
            const highlightId = `highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            highlight.dataset.glassId = highlightId;
            this.highlightElements.set(highlightId, highlight);

            lastIndex = regex.lastIndex;
        }

        // 添加剩余文本
        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        parent.replaceChild(fragment, textNode);
    }

    /**
     * 高亮文本（通用方法）
     */
    highlightText(data) {
        if (data.keywords) {
            this.highlightKeywords(data.keywords);
        }
        
        if (data.phrases) {
            data.phrases.forEach(phrase => {
                this.highlightKeyword({ word: phrase, importance: 'medium' });
            });
        }
    }

    /**
     * 显示定义
     */
    showDefinitions(definitions) {
        // 这里可以实现定义的显示逻辑
        console.log('[Glass Extension] Received definitions:', definitions);
    }

    /**
     * 清除所有高亮
     */
    clearAllHighlights() {
        const highlights = document.querySelectorAll('.glass-highlight');
        highlights.forEach(highlight => {
            const parent = highlight.parentNode;
            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
            parent.normalize(); // 合并相邻的文本节点
        });

        this.highlightElements.clear();
        console.log('[Glass Extension] All highlights cleared');
    }

    /**
     * 处理双击事件
     */
    async handleDoubleClick(event) {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText && selectedText.length > 0 && selectedText.length < 50) {
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'getDefinition',
                    data: { term: selectedText }
                });

                if (response.success && response.definition) {
                    this.showPopupDefinition(selectedText, response.definition, event);
                }
            } catch (error) {
                console.error('[Glass Extension] Failed to get definition:', error);
            }
        }
    }

    /**
     * 处理文本选择
     */
    handleTextSelection() {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText && selectedText.length > 10) {
            // 可以在这里添加选择文本的处理逻辑
            console.log('[Glass Extension] Text selected:', selectedText.substring(0, 50) + '...');
        }
    }

    /**
     * 显示术语定义
     */
    async showTermDefinition(term, element) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getDefinition',
                data: { term: term }
            });

            if (response.success && response.definition) {
                this.showPopupDefinition(term, response.definition, { target: element });
            }
        } catch (error) {
            console.error('[Glass Extension] Failed to show term definition:', error);
        }
    }

    /**
     * 显示弹出定义
     */
    showPopupDefinition(term, definition, event) {
        // 移除现有的弹出框
        const existingPopup = document.querySelector('.glass-definition-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        // 创建弹出框
        const popup = document.createElement('div');
        popup.className = 'glass-definition-popup';
        popup.innerHTML = `
            <div class="glass-popup-header">
                <strong>${term}</strong>
                <button class="glass-popup-close">×</button>
            </div>
            <div class="glass-popup-content">
                ${definition.definition || definition}
            </div>
        `;

        // 设置位置
        const rect = event.target.getBoundingClientRect();
        popup.style.position = 'fixed';
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + 5}px`;
        popup.style.zIndex = '10000';

        // 添加到页面
        document.body.appendChild(popup);

        // 添加关闭事件
        popup.querySelector('.glass-popup-close').addEventListener('click', () => {
            popup.remove();
        });

        // 3秒后自动关闭
        setTimeout(() => {
            if (popup.parentNode) {
                popup.remove();
            }
        }, 5000);
    }

    /**
     * 报告错误
     */
    reportError(error) {
        chrome.runtime.sendMessage({
            action: 'reportError',
            data: {
                message: error.message,
                stack: error.stack,
                url: window.location.href,
                timestamp: Date.now()
            }
        }).catch(() => {
            // 忽略报告错误时的失败
        });
    }

    /**
     * 获取当前状态
     */
    getStatus() {
        return {
            isActive: this.isActive,
            url: window.location.href,
            highlightCount: this.highlightElements.size,
            contentLength: document.body.textContent.length
        };
    }
}

/**
 * 网页文本处理器
 */
class WebTextProcessor {
    constructor() {
        this.excludeSelectors = [
            'script', 'style', 'noscript', 'iframe', 'object', 'embed',
            '.glass-highlight', '.glass-definition-popup',
            '[role="banner"]', '[role="navigation"]', '[role="complementary"]'
        ];
    }

    /**
     * 提取页面内容
     */
    extractPageContent() {
        return {
            title: document.title,
            url: window.location.href,
            text: this.extractMainText(),
            structure: this.analyzePageStructure(),
            metadata: this.extractMetadata(),
            timestamp: Date.now()
        };
    }

    /**
     * 提取主要文本内容
     */
    extractMainText() {
        // 尝试找到主要内容区域
        const mainContent = this.findMainContent();
        const textContent = this.getCleanText(mainContent || document.body);
        
        return textContent.trim();
    }

    /**
     * 查找主要内容区域
     */
    findMainContent() {
        // 尝试常见的主内容选择器
        const selectors = [
            'main', '[role="main"]', '.main-content', '#main-content',
            'article', '.article', '.post', '.content', '#content',
            '.container .row .col', '.entry-content'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.length > 200) {
                return element;
            }
        }

        // 如果没找到，使用启发式方法
        return this.findContentByHeuristics();
    }

    /**
     * 使用启发式方法查找内容
     */
    findContentByHeuristics() {
        const candidates = document.querySelectorAll('div, section, article');
        let bestCandidate = null;
        let maxScore = 0;

        candidates.forEach(element => {
            const score = this.calculateContentScore(element);
            if (score > maxScore) {
                maxScore = score;
                bestCandidate = element;
            }
        });

        return bestCandidate;
    }

    /**
     * 计算内容分数
     */
    calculateContentScore(element) {
        let score = 0;
        const text = element.textContent;
        
        // 文本长度分数
        score += Math.min(text.length / 100, 50);
        
        // 段落数量分数
        const paragraphs = element.querySelectorAll('p');
        score += paragraphs.length * 2;
        
        // 减分项：导航、侧边栏等
        if (element.matches('nav, aside, header, footer')) {
            score -= 20;
        }
        
        if (element.className.includes('nav') || element.className.includes('sidebar')) {
            score -= 10;
        }

        return score;
    }

    /**
     * 获取清理后的文本
     */
    getCleanText(element) {
        // 克隆元素避免修改原DOM
        const clone = element.cloneNode(true);
        
        // 移除不需要的元素
        this.excludeSelectors.forEach(selector => {
            const elements = clone.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });

        // 获取文本并清理
        const text = clone.textContent || clone.innerText || '';
        
        return text
            .replace(/\s+/g, ' ')  // 合并空白字符
            .replace(/\n\s*\n/g, '\n\n')  // 保留段落分隔
            .trim();
    }

    /**
     * 分析页面结构
     */
    analyzePageStructure() {
        const structure = {
            headings: this.extractHeadings(),
            links: this.extractLinks(),
            images: document.images.length,
            paragraphs: document.querySelectorAll('p').length,
            lists: document.querySelectorAll('ul, ol').length
        };

        return structure;
    }

    /**
     * 提取标题
     */
    extractHeadings() {
        const headings = [];
        const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        
        headingElements.forEach(heading => {
            headings.push({
                level: parseInt(heading.tagName.substring(1)),
                text: heading.textContent.trim()
            });
        });

        return headings;
    }

    /**
     * 提取链接
     */
    extractLinks() {
        const links = [];
        const linkElements = document.querySelectorAll('a[href]');
        
        linkElements.forEach(link => {
            const href = link.href;
            const text = link.textContent.trim();
            
            if (href && text && !href.startsWith('javascript:')) {
                links.push({
                    url: href,
                    text: text
                });
            }
        });

        return links.slice(0, 20); // 限制数量
    }

    /**
     * 提取元数据
     */
    extractMetadata() {
        const metadata = {};

        // Meta标签
        const metaTags = document.querySelectorAll('meta[name], meta[property]');
        metaTags.forEach(meta => {
            const name = meta.getAttribute('name') || meta.getAttribute('property');
            const content = meta.getAttribute('content');
            if (name && content) {
                metadata[name] = content;
            }
        });

        // 特殊信息
        metadata.language = document.documentElement.lang || 'en';
        metadata.charset = document.characterSet;
        metadata.domain = window.location.hostname;

        return metadata;
    }
}

// 初始化content script
if (typeof window !== 'undefined') {
    const glassContent = new GlassContentScript();
    
    // 导出用于调试
    window.glassContent = glassContent;
}

console.log('[Glass Extension] Content script loaded successfully');