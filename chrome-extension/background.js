/**
 * Glass Web Assistant - Background Service Worker
 * 处理扩展的后台逻辑和与主程序的通信
 */

console.log('[Glass Extension] Background service worker starting...');

class GlassBackgroundService {
    constructor() {
        this.nativePort = null;
        this.isConnected = false;
        this.extensionId = chrome.runtime.id;
        this.activeTab = null;
        
        this.init();
    }

    /**
     * 初始化后台服务
     */
    init() {
        this.setupEventListeners();
        this.connectNativeApp();
        console.log('[Glass Extension] Background service initialized');
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听来自content script的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleContentMessage(message, sender, sendResponse);
            return true; // 保持消息通道开放，支持异步响应
        });

        // 监听标签页更新
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                this.handleTabUpdate(tab);
            }
        });

        // 监听标签页激活
        chrome.tabs.onActivated.addListener((activeInfo) => {
            chrome.tabs.get(activeInfo.tabId, (tab) => {
                this.activeTab = tab;
            });
        });

        // 监听扩展安装/启动
        chrome.runtime.onStartup.addListener(() => {
            console.log('[Glass Extension] Extension startup');
            this.connectNativeApp();
        });

        chrome.runtime.onInstalled.addListener((details) => {
            console.log('[Glass Extension] Extension installed:', details.reason);
            if (details.reason === 'install') {
                this.handleFirstInstall();
            }
        });
    }

    /**
     * 建立与主程序的原生消息通信
     */
    connectNativeApp() {
        try {
            console.log('[Glass Extension] Attempting to connect to native app...');
            
            // 注意：这里的应用名称需要与主程序的native messaging配置匹配
            this.nativePort = chrome.runtime.connectNative('com.pickle.glass.extension');
            
            if (this.nativePort) {
                this.isConnected = true;
                console.log('[Glass Extension] ✅ Connected to native app');

                this.nativePort.onMessage.addListener((message) => {
                    this.handleNativeMessage(message);
                });

                this.nativePort.onDisconnect.addListener(() => {
                    this.isConnected = false;
                    const error = chrome.runtime.lastError;
                    console.log('[Glass Extension] ❌ Native app disconnected:', error ? error.message : 'Unknown reason');
                    
                    // 尝试重连（延迟5秒）
                    setTimeout(() => {
                        if (!this.isConnected) {
                            console.log('[Glass Extension] Attempting to reconnect...');
                            this.connectNativeApp();
                        }
                    }, 5000);
                });

                // 发送初始连接消息
                this.sendToNativeApp('connection', {
                    type: 'extension_connected',
                    extensionId: this.extensionId,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('[Glass Extension] ❌ Failed to connect to native app:', error);
            this.isConnected = false;
        }
    }

    /**
     * 处理来自content script的消息
     */
    async handleContentMessage(message, sender, sendResponse) {
        console.log('[Glass Extension] Message from content script:', message.action);

        try {
            switch (message.action) {
                case 'extractContent':
                    await this.handleContentExtraction(message.data, sender);
                    sendResponse({ success: true });
                    break;

                case 'requestHighlight':
                    await this.handleHighlightRequest(message.data, sender);
                    sendResponse({ success: true });
                    break;

                case 'getDefinition':
                    const definition = await this.requestDefinition(message.data.term);
                    sendResponse({ success: true, definition });
                    break;

                case 'reportError':
                    console.error('[Glass Extension] Content script error:', message.data);
                    sendResponse({ success: true });
                    break;

                default:
                    console.warn('[Glass Extension] Unknown message action:', message.action);
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('[Glass Extension] Error handling content message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * 处理内容提取
     */
    async handleContentExtraction(data, sender) {
        if (!this.isConnected) {
            console.warn('[Glass Extension] Cannot extract content: not connected to native app');
            return;
        }

        const extractedData = {
            ...data,
            tabId: sender.tab.id,
            url: sender.tab.url,
            title: sender.tab.title,
            timestamp: Date.now()
        };

        this.sendToNativeApp('webContent', extractedData);
        console.log('[Glass Extension] Content extracted and sent to native app');
    }

    /**
     * 处理高亮请求
     */
    async handleHighlightRequest(data, sender) {
        // 将高亮请求转发给对应的content script
        try {
            await chrome.tabs.sendMessage(sender.tab.id, {
                action: 'highlight',
                data: data
            });
        } catch (error) {
            console.error('[Glass Extension] Failed to send highlight message:', error);
        }
    }

    /**
     * 请求术语定义
     */
    async requestDefinition(term) {
        if (!this.isConnected) {
            return null;
        }

        return new Promise((resolve) => {
            const requestId = Date.now().toString();
            
            // 设置超时
            const timeout = setTimeout(() => {
                resolve(null);
            }, 5000);

            // 临时监听响应
            const responseHandler = (message) => {
                if (message.type === 'definition_response' && message.requestId === requestId) {
                    clearTimeout(timeout);
                    this.nativePort.onMessage.removeListener(responseHandler);
                    resolve(message.definition);
                }
            };

            this.nativePort.onMessage.addListener(responseHandler);

            // 发送请求
            this.sendToNativeApp('definition_request', {
                term: term,
                requestId: requestId,
                timestamp: Date.now()
            });
        });
    }

    /**
     * 处理来自主程序的消息
     */
    handleNativeMessage(message) {
        console.log('[Glass Extension] Message from native app:', message.type);

        try {
            switch (message.type) {
                case 'keywords':
                    this.broadcastToContentScripts('highlightKeywords', message.data);
                    break;

                case 'definitions':
                    this.broadcastToContentScripts('showDefinitions', message.data);
                    break;

                case 'highlight':
                    this.sendToSpecificTab(message.tabId, 'highlight', message.data);
                    break;

                case 'clear_highlights':
                    this.broadcastToContentScripts('clearHighlights', {});
                    break;

                case 'status_update':
                    this.updateExtensionStatus(message.data);
                    break;

                default:
                    console.warn('[Glass Extension] Unknown native message type:', message.type);
            }
        } catch (error) {
            console.error('[Glass Extension] Error handling native message:', error);
        }
    }

    /**
     * 广播消息到所有content scripts
     */
    async broadcastToContentScripts(action, data) {
        try {
            const tabs = await chrome.tabs.query({});
            
            for (const tab of tabs) {
                if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                    try {
                        await chrome.tabs.sendMessage(tab.id, {
                            action: action,
                            data: data
                        });
                    } catch (error) {
                        // 忽略无法发送消息的标签页（可能没有content script）
                    }
                }
            }
        } catch (error) {
            console.error('[Glass Extension] Failed to broadcast message:', error);
        }
    }

    /**
     * 发送消息到特定标签页
     */
    async sendToSpecificTab(tabId, action, data) {
        try {
            await chrome.tabs.sendMessage(tabId, {
                action: action,
                data: data
            });
        } catch (error) {
            console.error(`[Glass Extension] Failed to send message to tab ${tabId}:`, error);
        }
    }

    /**
     * 发送数据到主程序
     */
    sendToNativeApp(type, data) {
        if (!this.nativePort || !this.isConnected) {
            console.warn('[Glass Extension] Cannot send to native app: not connected');
            return false;
        }

        try {
            const message = {
                type: type,
                data: data,
                timestamp: Date.now()
            };

            this.nativePort.postMessage(message);
            return true;
        } catch (error) {
            console.error('[Glass Extension] Failed to send message to native app:', error);
            this.isConnected = false;
            return false;
        }
    }

    /**
     * 处理标签页更新
     */
    handleTabUpdate(tab) {
        if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
            return;
        }

        // 通知主程序有新页面加载
        this.sendToNativeApp('page_loaded', {
            tabId: tab.id,
            url: tab.url,
            title: tab.title,
            timestamp: Date.now()
        });
    }

    /**
     * 处理首次安装
     */
    handleFirstInstall() {
        console.log('[Glass Extension] First time installation');
        
        // 可以在这里显示欢迎页面或设置指导
        chrome.tabs.create({
            url: chrome.runtime.getURL('welcome.html')
        });
    }

    /**
     * 更新扩展状态
     */
    updateExtensionStatus(status) {
        // 更新badge或图标状态
        if (status.active) {
            chrome.action.setBadgeText({ text: '●' });
            chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
    }

    /**
     * 获取扩展状态
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            extensionId: this.extensionId,
            activeTab: this.activeTab ? {
                id: this.activeTab.id,
                url: this.activeTab.url,
                title: this.activeTab.title
            } : null
        };
    }
}

// 创建全局实例
const glassBackground = new GlassBackgroundService();

// 导出用于调试
globalThis.glassBackground = glassBackground;