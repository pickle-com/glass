# Glass视频学习功能使用指南

## 概述

Glass的视频学习功能是一个强大的屏幕内容分析工具，能够自动捕获屏幕内容，进行OCR文字识别，并提供实时翻译、关键词提取和术语解释功能，特别适用于在线课程、视频教程和文档阅读。

## 功能特点

### 🎥 智能屏幕捕获
- **自动帧提取**: 智能分析屏幕变化，只处理有意义的帧
- **多屏幕支持**: 支持选择不同的显示器进行捕获
- **性能优化**: 可配置的捕获频率和质量级别

### 🔍 高精度OCR识别
- **多引擎支持**: Mock引擎（演示）、Tesseract.js、原生引擎
- **多语言识别**: 支持英文、中文等多种语言
- **智能预处理**: 图像增强和噪声过滤

### 🎞️ 智能帧分析
- **相似性检测**: 自动跳过重复或相似的帧
- **文本区域识别**: 智能判断帧中是否包含有价值的文本
- **稳定性分析**: 确保只处理稳定的视频帧

### 🔗 无缝集成
- **增强服务集成**: 与翻译、关键词提取、思维导图完全集成
- **实时处理**: OCR结果自动传递给增强功能进行处理
- **统一界面**: 在Glass主界面查看所有增强功能结果

## 使用方法

### 1. 启动视频学习

在Glass监听界面中：
1. 点击视频学习控制按钮（📹图标）
2. 展开视频学习控制面板
3. 点击"Start"按钮开始屏幕捕获
4. 系统会自动选择主屏幕开始捕获

### 2. 配置选项

可通过代码配置以下选项：
```javascript
const options = {
    captureRate: 0.5,        // 捕获频率（每2秒一帧）
    qualityLevel: 'medium',  // 质量级别：low/medium/high
    ocrEnabled: true,        // 是否启用OCR
    languages: ['eng', 'chi_sim'], // OCR语言
    autoStart: false         // 是否自动启动
};
```

### 3. 监控状态

- **绿色指示灯**: 视频学习正在运行
- **红色指示灯**: 视频学习已停止
- **状态文本**: 显示当前服务状态

### 4. 手动捕获

在视频学习运行时，可以点击"Capture"按钮手动捕获当前帧进行OCR处理。

## 技术架构

### 核心服务

```
VideoLearningService (主服务)
├── ScreenCaptureService (屏幕捕获)
├── OCRService (文字识别) 
├── FrameAnalyzer (帧分析)
└── Enhanced Integration (增强集成)
```

### 数据流

```
屏幕内容 → 帧捕获 → 智能分析 → OCR识别 → 增强处理 → UI显示
```

### 集成点

- **EnhancedService**: 统一的增强功能入口
- **ListenService**: 与现有Glass功能集成
- **UI Components**: ListenView中的视频控制界面
- **IPC Communication**: 前后端通信

## API接口

### IPC通道

```javascript
// 启动/停止视频学习
window.api.invoke('video:start-learning', options)
window.api.invoke('video:stop-learning')
window.api.invoke('video:toggle-learning')

// 状态和统计
window.api.invoke('video:get-status')
window.api.invoke('video:get-stats')
window.api.invoke('video:get-screens')

// 手动捕获
window.api.invoke('video:capture-frame')
```

### 事件监听

```javascript
// UI事件监听
window.api.listenView.onVideoSessionStarted(callback)
window.api.listenView.onVideoSessionStopped(callback)
window.api.listenView.onVideoLearningUpdate(callback)
window.api.listenView.onVideoError(callback)
```

## 配置说明

### 视频捕获配置

```javascript
// 在VideoLearningService中
this.config = {
    enabled: false,
    captureRate: 0.5,        // 每2秒捕获一帧
    ocrEnabled: true,
    autoStart: false,
    qualityLevel: 'medium',  // low/medium/high
    languages: ['eng', 'chi_sim']
};
```

### OCR引擎配置

```javascript
// 在OCRService中
this.config = {
    languages: ['eng', 'chi_sim'],
    confidence: 60,          // 最低置信度阈值
    preprocessing: true,     // 图像预处理
    caching: true           // 结果缓存
};
```

### 帧分析配置

```javascript
// 在FrameAnalyzer中
this.config = {
    differenceThreshold: 0.15,  // 帧差异阈值
    minTextLength: 20,          // 最小有效文本长度
    stabilityFrames: 3,         // 稳定性检查帧数
    skipSimilarFrames: true     // 跳过相似帧
};
```

## 性能优化

### 1. 捕获频率优化
- 降低捕获频率可减少CPU使用
- 推荐频率：0.2-1.0 FPS

### 2. 质量级别选择
- **Low**: 640x480，适合文本识别
- **Medium**: 1280x720，平衡性能和质量
- **High**: 1920x1080，最高质量

### 3. 智能跳帧
- 自动跳过相似或无文本的帧
- 减少不必要的OCR处理

### 4. 缓存机制
- OCR结果缓存，避免重复处理
- 智能缓存清理策略

## 故障排除

### 常见问题

1. **屏幕捕获失败**
   - 检查屏幕录制权限
   - 确保在Electron环境中运行

2. **OCR识别率低**
   - 调整图像质量级别
   - 检查文本对比度
   - 尝试不同的OCR引擎

3. **性能问题**
   - 降低捕获频率
   - 减少质量级别
   - 启用智能跳帧

### 调试信息

启用调试模式查看详细日志：
```javascript
console.log(videoLearningService.getStatus());
console.log(videoLearningService.getPerformanceStats());
```

## 扩展开发

### 添加新OCR引擎

1. 在`src/features/video-learning/ocr/engines/`创建新引擎
2. 实现标准OCR接口
3. 在OCRService中注册引擎

### 自定义帧分析算法

1. 继承FrameAnalyzer类
2. 重写分析方法
3. 在VideoLearningService中使用

### 添加新的集成点

1. 监听`video:text_ready`事件
2. 实现自定义处理逻辑
3. 通过EnhancedService发送结果

## 最佳实践

1. **合理设置捕获频率**: 根据内容变化频率调整
2. **启用智能分析**: 让系统自动优化处理
3. **监控性能指标**: 定期检查统计信息
4. **配置合适的语言**: 根据内容选择OCR语言
5. **测试不同场景**: 在各种内容下测试效果

## 更新历史

- **v1.0.0**: 初始版本，基础屏幕捕获和OCR功能
- **v1.1.0**: 添加智能帧分析和性能优化
- **v1.2.0**: 完整的增强服务集成
- **v1.3.0**: UI控制界面和用户体验优化

---

有关更多技术细节，请参考：
- [增强架构文档](./ENHANCED_ARCHITECTURE.md)
- [设计模式指南](./DESIGN_PATTERNS.md)
- [API参考文档](../src/features/video-learning/)