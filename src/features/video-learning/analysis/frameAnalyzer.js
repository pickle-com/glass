const { EventEmitter } = require('events');

/**
 * 视频帧分析器
 * 负责分析视频帧的变化和内容，优化OCR处理
 */
class FrameAnalyzer extends EventEmitter {
    constructor() {
        super();
        
        this.previousFrame = null;
        this.frameHistory = [];
        this.maxHistorySize = 10;
        
        // 分析配置
        this.config = {
            differenceThreshold: 0.15, // 帧差异阈值
            minTextLength: 20, // 最小有效文本长度
            stabilityFrames: 3, // 稳定性检查帧数
            skipSimilarFrames: true // 跳过相似帧
        };
        
        this.stats = {
            totalFrames: 0,
            processedFrames: 0,
            skippedFrames: 0,
            textDetected: 0
        };
        
        console.log('[FrameAnalyzer] Analyzer initialized');
    }

    /**
     * 分析帧是否应该进行OCR处理
     * @param {string} frameData - Base64图像数据
     * @param {object} frameInfo - 帧信息
     * @returns {Promise<object>} 分析结果
     */
    async analyzeFrame(frameData, frameInfo = {}) {
        try {
            this.stats.totalFrames++;
            
            const analysis = {
                shouldProcess: false,
                reason: '',
                confidence: 0,
                frameInfo: frameInfo,
                timestamp: Date.now()
            };

            // 基本数据验证
            if (!frameData || frameData.length < 1000) {
                analysis.reason = 'Invalid or empty frame data';
                return analysis;
            }

            // 计算当前帧的特征
            const currentFeatures = await this.extractFrameFeatures(frameData);
            
            // 检查是否有足够的变化
            if (this.previousFrame && this.config.skipSimilarFrames) {
                const similarity = this.calculateSimilarity(currentFeatures, this.previousFrame.features);
                
                if (similarity > (1 - this.config.differenceThreshold)) {
                    analysis.reason = `Frame too similar (${(similarity * 100).toFixed(1)}%)`;
                    this.stats.skippedFrames++;
                    return analysis;
                }
            }

            // 检查帧是否包含可能的文本区域
            const textLikelihood = this.estimateTextLikelihood(currentFeatures);
            if (textLikelihood < 0.3) {
                analysis.reason = `Low text likelihood (${(textLikelihood * 100).toFixed(1)}%)`;
                this.stats.skippedFrames++;
                return analysis;
            }

            // 检查帧稳定性
            const isStable = this.checkFrameStability(currentFeatures);
            if (!isStable) {
                analysis.reason = 'Frame not stable enough';
                return analysis;
            }

            // 决定处理
            analysis.shouldProcess = true;
            analysis.reason = 'Frame suitable for OCR processing';
            analysis.confidence = Math.min(textLikelihood + 0.2, 1.0);
            
            // 更新历史
            this.updateFrameHistory({
                features: currentFeatures,
                timestamp: Date.now(),
                processed: true
            });
            
            this.stats.processedFrames++;
            this.previousFrame = { features: currentFeatures, timestamp: Date.now() };
            
            this.emit('frame:analyzed', analysis);
            return analysis;

        } catch (error) {
            console.error('[FrameAnalyzer] Frame analysis failed:', error);
            return {
                shouldProcess: false,
                reason: `Analysis error: ${error.message}`,
                confidence: 0,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    /**
     * 提取帧特征
     * @param {string} frameData - 图像数据
     * @returns {Promise<object>} 帧特征
     */
    async extractFrameFeatures(frameData) {
        try {
            // 创建临时canvas进行图像分析
            const canvas = this.createCanvas();
            const ctx = canvas.getContext('2d');
            
            // 加载图像
            const image = await this.loadImage(frameData);
            canvas.width = Math.min(image.width, 640); // 限制分析分辨率
            canvas.height = Math.min(image.height, 480);
            
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            
            // 提取像素数据
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;
            
            // 计算基本特征
            const features = {
                brightness: this.calculateBrightness(pixels),
                contrast: this.calculateContrast(pixels),
                edges: this.detectEdges(pixels, canvas.width, canvas.height),
                colorVariance: this.calculateColorVariance(pixels),
                textRegions: this.detectTextRegions(pixels, canvas.width, canvas.height),
                width: canvas.width,
                height: canvas.height
            };
            
            // 清理临时canvas
            this.cleanupCanvas(canvas);
            
            return features;

        } catch (error) {
            console.error('[FrameAnalyzer] Feature extraction failed:', error);
            return {
                brightness: 0,
                contrast: 0,
                edges: 0,
                colorVariance: 0,
                textRegions: 0,
                error: error.message
            };
        }
    }

    /**
     * 计算帧相似度
     * @param {object} features1 - 特征1
     * @param {object} features2 - 特征2
     * @returns {number} 相似度 (0-1)
     */
    calculateSimilarity(features1, features2) {
        if (!features1 || !features2) return 0;
        
        try {
            // 计算各个特征的相似度
            const brightnessSim = 1 - Math.abs(features1.brightness - features2.brightness) / 255;
            const contrastSim = 1 - Math.abs(features1.contrast - features2.contrast) / 255;
            const edgeSim = 1 - Math.abs(features1.edges - features2.edges) / Math.max(features1.edges, features2.edges, 1);
            const colorSim = 1 - Math.abs(features1.colorVariance - features2.colorVariance) / Math.max(features1.colorVariance, features2.colorVariance, 1);
            
            // 加权平均
            const similarity = (brightnessSim * 0.2 + contrastSim * 0.3 + edgeSim * 0.3 + colorSim * 0.2);
            
            return Math.max(0, Math.min(1, similarity));
        } catch (error) {
            console.error('[FrameAnalyzer] Similarity calculation failed:', error);
            return 0;
        }
    }

    /**
     * 估计文本存在的可能性
     * @param {object} features - 帧特征
     * @returns {number} 文本可能性 (0-1)
     */
    estimateTextLikelihood(features) {
        try {
            let likelihood = 0;
            
            // 对比度检查（文本通常有较高对比度）
            if (features.contrast > 50) {
                likelihood += 0.3;
            }
            
            // 边缘检查（文本有明显边缘）
            if (features.edges > 20) {
                likelihood += 0.4;
            }
            
            // 颜色方差检查（文本区域通常有适中的颜色变化）
            if (features.colorVariance > 10 && features.colorVariance < 100) {
                likelihood += 0.2;
            }
            
            // 文本区域检查
            if (features.textRegions > 5) {
                likelihood += 0.3;
            }
            
            return Math.min(1, likelihood);
        } catch (error) {
            console.error('[FrameAnalyzer] Text likelihood estimation failed:', error);
            return 0.5; // 默认中等可能性
        }
    }

    /**
     * 检查帧稳定性
     * @param {object} currentFeatures - 当前帧特征
     * @returns {boolean} 是否稳定
     */
    checkFrameStability(currentFeatures) {
        if (this.frameHistory.length < this.config.stabilityFrames) {
            return true; // 历史不足，认为稳定
        }
        
        // 检查最近几帧的变化
        const recentFrames = this.frameHistory.slice(-this.config.stabilityFrames);
        const variations = recentFrames.map(frame => 
            this.calculateSimilarity(currentFeatures, frame.features)
        );
        
        const avgSimilarity = variations.reduce((sum, sim) => sum + sim, 0) / variations.length;
        
        // 如果与最近帧的平均相似度太低，说明变化太频繁
        return avgSimilarity > 0.7;
    }

    /**
     * 更新帧历史
     * @param {object} frameRecord - 帧记录
     */
    updateFrameHistory(frameRecord) {
        this.frameHistory.push(frameRecord);
        
        // 限制历史大小
        if (this.frameHistory.length > this.maxHistorySize) {
            this.frameHistory.shift();
        }
    }

    /**
     * 计算亮度
     * @param {Uint8ClampedArray} pixels - 像素数据
     * @returns {number} 平均亮度
     */
    calculateBrightness(pixels) {
        let sum = 0;
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            sum += (r + g + b) / 3;
        }
        return sum / (pixels.length / 4);
    }

    /**
     * 计算对比度
     * @param {Uint8ClampedArray} pixels - 像素数据
     * @returns {number} 对比度
     */
    calculateContrast(pixels) {
        const brightness = this.calculateBrightness(pixels);
        let sumSquaredDiff = 0;
        
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const pixelBrightness = (r + g + b) / 3;
            sumSquaredDiff += Math.pow(pixelBrightness - brightness, 2);
        }
        
        return Math.sqrt(sumSquaredDiff / (pixels.length / 4));
    }

    /**
     * 检测边缘
     * @param {Uint8ClampedArray} pixels - 像素数据
     * @param {number} width - 图像宽度
     * @param {number} height - 图像高度
     * @returns {number} 边缘强度
     */
    detectEdges(pixels, width, height) {
        let edgeStrength = 0;
        
        // 简化的边缘检测（Sobel算子的简化版本）
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                
                const current = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
                const right = (pixels[idx + 4] + pixels[idx + 5] + pixels[idx + 6]) / 3;
                const bottom = (pixels[idx + width * 4] + pixels[idx + width * 4 + 1] + pixels[idx + width * 4 + 2]) / 3;
                
                const gx = Math.abs(right - current);
                const gy = Math.abs(bottom - current);
                edgeStrength += Math.sqrt(gx * gx + gy * gy);
            }
        }
        
        return edgeStrength / ((width - 2) * (height - 2));
    }

    /**
     * 计算颜色方差
     * @param {Uint8ClampedArray} pixels - 像素数据
     * @returns {number} 颜色方差
     */
    calculateColorVariance(pixels) {
        const values = [];
        for (let i = 0; i < pixels.length; i += 4) {
            values.push((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3);
        }
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        
        return Math.sqrt(variance);
    }

    /**
     * 检测潜在文本区域
     * @param {Uint8ClampedArray} pixels - 像素数据
     * @param {number} width - 图像宽度
     * @param {number} height - 图像高度
     * @returns {number} 文本区域数量估计
     */
    detectTextRegions(pixels, width, height) {
        // 简化的文本区域检测
        // 寻找具有适当大小和对比度的连续区域
        let textRegions = 0;
        const blockSize = 20; // 检测块大小
        
        for (let y = 0; y < height - blockSize; y += blockSize) {
            for (let x = 0; x < width - blockSize; x += blockSize) {
                const blockVariance = this.calculateBlockVariance(pixels, x, y, blockSize, width);
                
                // 文本区域通常有适中的方差
                if (blockVariance > 15 && blockVariance < 80) {
                    textRegions++;
                }
            }
        }
        
        return textRegions;
    }

    /**
     * 计算图像块的方差
     * @param {Uint8ClampedArray} pixels - 像素数据
     * @param {number} x - 起始X坐标
     * @param {number} y - 起始Y坐标
     * @param {number} blockSize - 块大小
     * @param {number} width - 图像宽度
     * @returns {number} 块方差
     */
    calculateBlockVariance(pixels, x, y, blockSize, width) {
        const values = [];
        
        for (let by = y; by < y + blockSize; by++) {
            for (let bx = x; bx < x + blockSize; bx++) {
                const idx = (by * width + bx) * 4;
                if (idx < pixels.length - 2) {
                    values.push((pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3);
                }
            }
        }
        
        if (values.length === 0) return 0;
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        
        return Math.sqrt(variance);
    }

    /**
     * 创建临时canvas
     * @returns {HTMLCanvasElement} Canvas元素
     */
    createCanvas() {
        if (typeof document !== 'undefined') {
            return document.createElement('canvas');
        } else {
            // Node.js环境下的canvas（需要安装canvas包）
            try {
                const { createCanvas } = require('canvas');
                return createCanvas(640, 480);
            } catch (error) {
                throw new Error('Canvas not available in this environment');
            }
        }
    }

    /**
     * 加载图像
     * @param {string} imageData - Base64图像数据
     * @returns {Promise<Image>} 图像对象
     */
    loadImage(imageData) {
        return new Promise((resolve, reject) => {
            if (typeof Image !== 'undefined') {
                // 浏览器环境
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = imageData;
            } else {
                // Node.js环境下需要使用canvas包的Image
                try {
                    const { Image } = require('canvas');
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = Buffer.from(imageData.split(',')[1], 'base64');
                } catch (error) {
                    reject(new Error('Image loading not supported in this environment'));
                }
            }
        });
    }

    /**
     * 清理canvas
     * @param {HTMLCanvasElement} canvas - Canvas元素
     */
    cleanupCanvas(canvas) {
        try {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        } catch (error) {
            // 忽略清理错误
        }
    }

    /**
     * 更新配置
     * @param {object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[FrameAnalyzer] Configuration updated:', this.config);
        this.emit('config:updated', this.config);
    }

    /**
     * 重置统计
     */
    resetStats() {
        this.stats = {
            totalFrames: 0,
            processedFrames: 0,
            skippedFrames: 0,
            textDetected: 0
        };
        console.log('[FrameAnalyzer] Statistics reset');
        this.emit('stats:reset');
    }

    /**
     * 获取统计信息
     * @returns {object} 统计数据
     */
    getStats() {
        return {
            ...this.stats,
            processRate: this.stats.totalFrames > 0 ? 
                (this.stats.processedFrames / this.stats.totalFrames * 100).toFixed(1) + '%' : '0%',
            skipRate: this.stats.totalFrames > 0 ? 
                (this.stats.skippedFrames / this.stats.totalFrames * 100).toFixed(1) + '%' : '0%'
        };
    }

    /**
     * 获取服务状态
     * @returns {object} 状态信息
     */
    getStatus() {
        return {
            config: this.config,
            stats: this.getStats(),
            historySize: this.frameHistory.length,
            hasPreivousFrame: !!this.previousFrame
        };
    }
}

module.exports = FrameAnalyzer;