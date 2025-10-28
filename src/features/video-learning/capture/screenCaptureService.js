const { EventEmitter } = require('events');
const { desktopCapturer } = require('electron');

/**
 * 屏幕捕获服务
 * 负责捕获屏幕内容并提取视频帧用于OCR分析
 */
class ScreenCaptureService extends EventEmitter {
    constructor() {
        super();
        
        this.isCapturing = false;
        this.captureStream = null;
        this.videoElement = null;
        this.canvas = null;
        this.context = null;
        this.frameInterval = null;
        
        // 配置参数
        this.config = {
            frameRate: 0.5, // 每2秒捕获一帧
            maxWidth: 1280,
            maxHeight: 720,
            quality: 0.8,
            format: 'image/jpeg'
        };
        
        console.log('[ScreenCaptureService] Service initialized');
    }

    /**
     * 开始屏幕捕获
     * @param {object} options - 捕获选项
     * @returns {Promise<boolean>} 是否成功开始捕获
     */
    async startCapture(options = {}) {
        try {
            if (this.isCapturing) {
                console.warn('[ScreenCaptureService] Already capturing');
                return true;
            }

            // 合并配置
            const captureConfig = { ...this.config, ...options };
            
            console.log('[ScreenCaptureService] Starting screen capture...');

            // 获取可用的屏幕源
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 150, height: 150 }
            });

            if (sources.length === 0) {
                throw new Error('No screen sources available');
            }

            // 选择主屏幕（通常是第一个）
            const primaryScreen = sources[0];
            console.log(`[ScreenCaptureService] Selected screen: ${primaryScreen.name}`);

            // 创建媒体流
            this.captureStream = await navigator.mediaDevices.getUserMedia({
                audio: false, // 音频由现有STT服务处理
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: primaryScreen.id,
                        maxWidth: captureConfig.maxWidth,
                        maxHeight: captureConfig.maxHeight,
                        maxFrameRate: 30 // 高帧率用于流畅显示，但OCR提取频率低
                    }
                }
            });

            // 设置视频元素和画布
            await this.setupVideoProcessing();

            // 开始定期帧提取
            this.startFrameExtraction(captureConfig);

            this.isCapturing = true;
            this.emit('capture:started', { source: primaryScreen.name });
            
            console.log('[ScreenCaptureService] ✅ Screen capture started successfully');
            return true;

        } catch (error) {
            console.error('[ScreenCaptureService] ❌ Failed to start capture:', error);
            this.emit('capture:error', { error: error.message });
            return false;
        }
    }

    /**
     * 停止屏幕捕获
     */
    async stopCapture() {
        try {
            if (!this.isCapturing) {
                return;
            }

            console.log('[ScreenCaptureService] Stopping screen capture...');

            // 停止帧提取
            if (this.frameInterval) {
                clearInterval(this.frameInterval);
                this.frameInterval = null;
            }

            // 停止媒体流
            if (this.captureStream) {
                this.captureStream.getTracks().forEach(track => track.stop());
                this.captureStream = null;
            }

            // 清理DOM元素
            this.cleanupVideoProcessing();

            this.isCapturing = false;
            this.emit('capture:stopped');
            
            console.log('[ScreenCaptureService] ✅ Screen capture stopped');

        } catch (error) {
            console.error('[ScreenCaptureService] Error stopping capture:', error);
            this.emit('capture:error', { error: error.message });
        }
    }

    /**
     * 设置视频处理组件
     */
    async setupVideoProcessing() {
        return new Promise((resolve, reject) => {
            try {
                // 创建隐藏的video元素
                this.videoElement = document.createElement('video');
                this.videoElement.style.display = 'none';
                this.videoElement.muted = true;
                this.videoElement.playsInline = true;
                document.body.appendChild(this.videoElement);

                // 创建画布用于帧提取
                this.canvas = document.createElement('canvas');
                this.context = this.canvas.getContext('2d');

                // 设置视频源
                this.videoElement.srcObject = this.captureStream;

                // 等待视频准备就绪
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    
                    // 设置画布尺寸
                    this.canvas.width = Math.min(this.videoElement.videoWidth, this.config.maxWidth);
                    this.canvas.height = Math.min(this.videoElement.videoHeight, this.config.maxHeight);
                    
                    console.log(`[ScreenCaptureService] Video setup complete: ${this.canvas.width}x${this.canvas.height}`);
                    resolve();
                };

                this.videoElement.onerror = (error) => {
                    console.error('[ScreenCaptureService] Video element error:', error);
                    reject(error);
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 清理视频处理组件
     */
    cleanupVideoProcessing() {
        if (this.videoElement) {
            if (this.videoElement.parentNode) {
                this.videoElement.parentNode.removeChild(this.videoElement);
            }
            this.videoElement = null;
        }
        
        this.canvas = null;
        this.context = null;
    }

    /**
     * 开始帧提取
     */
    startFrameExtraction(config) {
        const extractionInterval = 1000 / config.frameRate; // 转换为毫秒

        this.frameInterval = setInterval(async () => {
            try {
                const frameData = await this.extractCurrentFrame();
                if (frameData) {
                    this.emit('frame:extracted', {
                        data: frameData,
                        timestamp: Date.now(),
                        width: this.canvas.width,
                        height: this.canvas.height
                    });
                }
            } catch (error) {
                console.error('[ScreenCaptureService] Frame extraction error:', error);
            }
        }, extractionInterval);

        console.log(`[ScreenCaptureService] Frame extraction started (${config.frameRate} FPS)`);
    }

    /**
     * 提取当前帧
     * @returns {Promise<string|null>} Base64编码的图像数据
     */
    async extractCurrentFrame() {
        try {
            if (!this.videoElement || !this.canvas || !this.context) {
                return null;
            }

            // 检查视频是否准备就绪
            if (this.videoElement.readyState < 2) {
                return null;
            }

            // 将视频帧绘制到画布
            this.context.drawImage(
                this.videoElement,
                0, 0,
                this.canvas.width,
                this.canvas.height
            );

            // 转换为Base64图像数据
            const imageData = this.canvas.toDataURL(this.config.format, this.config.quality);
            
            return imageData;

        } catch (error) {
            console.error('[ScreenCaptureService] Frame extraction error:', error);
            return null;
        }
    }

    /**
     * 手动捕获单帧
     * @returns {Promise<string|null>} Base64编码的图像数据
     */
    async captureFrame() {
        if (!this.isCapturing) {
            throw new Error('Screen capture not active');
        }

        return await this.extractCurrentFrame();
    }

    /**
     * 获取可用屏幕列表
     * @returns {Promise<array>} 屏幕源列表
     */
    async getAvailableScreens() {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 150, height: 150 }
            });

            return sources.map(source => ({
                id: source.id,
                name: source.name,
                thumbnail: source.thumbnail.toDataURL()
            }));
        } catch (error) {
            console.error('[ScreenCaptureService] Failed to get screens:', error);
            return [];
        }
    }

    /**
     * 更新捕获配置
     * @param {object} newConfig - 新的配置参数
     */
    updateConfig(newConfig) {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };
        
        console.log('[ScreenCaptureService] Configuration updated:', {
            old: oldConfig,
            new: this.config
        });

        this.emit('config:updated', this.config);

        // 如果正在捕获且帧率改变，重启帧提取
        if (this.isCapturing && newConfig.frameRate && newConfig.frameRate !== oldConfig.frameRate) {
            this.restartFrameExtraction();
        }
    }

    /**
     * 重启帧提取
     */
    restartFrameExtraction() {
        if (this.frameInterval) {
            clearInterval(this.frameInterval);
        }
        this.startFrameExtraction(this.config);
    }

    /**
     * 获取捕获状态
     * @returns {object} 当前状态
     */
    getStatus() {
        return {
            isCapturing: this.isCapturing,
            config: this.config,
            hasStream: !!this.captureStream,
            videoReady: this.videoElement && this.videoElement.readyState >= 2,
            canvasSize: this.canvas ? {
                width: this.canvas.width,
                height: this.canvas.height
            } : null
        };
    }

    /**
     * 获取性能统计
     * @returns {object} 性能信息
     */
    getPerformanceStats() {
        const stats = {
            memoryUsage: process.memoryUsage(),
            isCapturing: this.isCapturing,
            frameRate: this.config.frameRate,
            resolution: this.canvas ? `${this.canvas.width}x${this.canvas.height}` : 'N/A'
        };

        return stats;
    }

    /**
     * 销毁服务
     */
    destroy() {
        this.stopCapture();
        this.removeAllListeners();
        console.log('[ScreenCaptureService] Service destroyed');
    }
}

module.exports = ScreenCaptureService;