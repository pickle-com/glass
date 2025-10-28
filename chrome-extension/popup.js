/**
 * Glass Web Assistant - Popup Script
 * 扩展弹出窗口的交互逻辑
 */

console.log('[Glass Extension] Popup script loading...');

class GlassPopup {
    constructor() {
        this.isConnected = false;
        this.currentTab = null;
        this.stats = {
            wordsProcessed: 0,
            definitionsShown: 0,
            highlightCount: 0
        };
        
        this.init();
    }

    /**
     * 初始化弹出窗口
     */
    async init() {
        await this.setupEventListeners();
        await this.loadCurrentTab();
        await this.updateStatus();
        await this.loadSettings();
        
        console.log('[Glass Extension] Popup initialized');
    }

    /**
     * 设置事件监听器
     */
    async setupEventListeners() {
        // 开关控制
        document.getElementById('auto-highlight').addEventListener('change', (e) => {
            this.toggleSetting('autoHighlight', e.target.checked);
        });

        document.getElementById('show-definitions').addEventListener('change', (e) => {
            this.toggleSetting('showDefinitions', e.target.checked);
        });

        document.getElementById('content-analysis').addEventListener('change', (e) => {
            this.toggleSetting('contentAnalysis', e.target.checked);
        });

        // 按钮事件
        document.getElementById('extract-content').addEventListener('click', () => {
            this.extractContent();
        });

        document.getElementById('clear-highlights').addEventListener('click', () => {
            this.clearHighlights();
        });

        document.getElementById('help-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.showHelp();
        });

        // 监听后台消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleBackgroundMessage(message, sender, sendResponse);
        });
    }

    /**
     * 加载当前标签页信息
     */
    async loadCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tab;
            
            // 更新页面信息显示
            if (tab && tab.url) {
                const domain = new URL(tab.url).hostname;
                document.getElementById('current-page').textContent = domain;
            } else {
                document.getElementById('current-page').textContent = 'N/A';
            }
        } catch (error) {
            console.error('[Glass Extension] Failed to get current tab:', error);
            document.getElementById('current-page').textContent = 'Error';
        }
    }

    /**
     * 更新连接状态
     */
    async updateStatus() {
        try {
            // 向background script请求状态
            const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
            
            if (response && response.status) {
                this.isConnected = response.status.isConnected;
                this.updateConnectionDisplay();
            } else {
                // 如果没有响应，假设未连接
                this.isConnected = false;
                this.updateConnectionDisplay();
            }
        } catch (error) {
            console.error('[Glass Extension] Failed to get status:', error);
            this.isConnected = false;
            this.updateConnectionDisplay();
        }
    }

    /**
     * 更新连接状态显示
     */
    updateConnectionDisplay() {
        const statusElement = document.getElementById('connection-status');
        
        if (this.isConnected) {
            statusElement.innerHTML = `
                <span class="status-indicator indicator-green"></span>
                <span class="status-connected">Connected</span>
            `;
        } else {
            statusElement.innerHTML = `
                <span class="status-indicator indicator-red"></span>
                <span class="status-disconnected">Disconnected</span>
            `;
        }
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        try {
            const settings = await chrome.storage.sync.get({
                autoHighlight: true,
                showDefinitions: true,
                contentAnalysis: true
            });

            document.getElementById('auto-highlight').checked = settings.autoHighlight;
            document.getElementById('show-definitions').checked = settings.showDefinitions;
            document.getElementById('content-analysis').checked = settings.contentAnalysis;
        } catch (error) {
            console.error('[Glass Extension] Failed to load settings:', error);
        }
    }

    /**
     * 切换设置
     */
    async toggleSetting(setting, enabled) {
        try {
            const settingsUpdate = {};
            settingsUpdate[setting] = enabled;
            await chrome.storage.sync.set(settingsUpdate);
            
            // 通知background script设置变更
            chrome.runtime.sendMessage({
                action: 'settingChanged',
                data: { setting, enabled }
            });

            console.log(`[Glass Extension] Setting ${setting} set to ${enabled}`);
        } catch (error) {
            console.error('[Glass Extension] Failed to update setting:', error);
        }
    }

    /**
     * 提取内容
     */
    async extractContent() {
        if (!this.currentTab) {
            this.showNotification('No active tab found', 'error');
            return;
        }

        try {
            // 向当前标签页的content script发送消息
            await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'forceExtract'
            });

            this.showNotification('Content extracted successfully', 'success');
        } catch (error) {
            console.error('[Glass Extension] Failed to extract content:', error);
            this.showNotification('Failed to extract content', 'error');
        }
    }

    /**
     * 清除高亮
     */
    async clearHighlights() {
        if (!this.currentTab) {
            this.showNotification('No active tab found', 'error');
            return;
        }

        try {
            await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'clearHighlights'
            });

            this.stats.highlightCount = 0;
            this.updateStats();
            this.showNotification('Highlights cleared', 'success');
        } catch (error) {
            console.error('[Glass Extension] Failed to clear highlights:', error);
            this.showNotification('Failed to clear highlights', 'error');
        }
    }

    /**
     * 显示帮助
     */
    showHelp() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('help.html')
        });
    }

    /**
     * 处理后台消息
     */
    handleBackgroundMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'statusUpdate':
                this.isConnected = message.data.isConnected;
                this.updateConnectionDisplay();
                break;

            case 'statsUpdate':
                this.stats = { ...this.stats, ...message.data };
                this.updateStats();
                break;

            case 'highlightUpdate':
                this.stats.highlightCount = message.data.count || 0;
                this.updateStats();
                break;
        }
    }

    /**
     * 更新统计显示
     */
    updateStats() {
        document.getElementById('words-processed').textContent = this.formatNumber(this.stats.wordsProcessed);
        document.getElementById('definitions-shown').textContent = this.formatNumber(this.stats.definitionsShown);
        document.getElementById('highlight-count').textContent = this.formatNumber(this.stats.highlightCount);
    }

    /**
     * 格式化数字显示
     */
    formatNumber(num) {
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toString();
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        // 创建临时通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
            ${type === 'success' ? 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : ''}
            ${type === 'error' ? 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;' : ''}
            ${type === 'info' ? 'background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;' : ''}
        `;

        document.body.appendChild(notification);

        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    /**
     * 获取当前状态
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            currentTab: this.currentTab,
            stats: this.stats
        };
    }
}

// 初始化弹出窗口
document.addEventListener('DOMContentLoaded', () => {
    const glassPopup = new GlassPopup();
    
    // 导出用于调试
    window.glassPopup = glassPopup;
});

console.log('[Glass Extension] Popup script loaded successfully');