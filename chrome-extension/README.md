# Glass Web Assistant - Chrome Extension

Glass Web Assistant Chrome扩展是Glass AI学习助手的网页组件，提供智能内容分析、关键词高亮和实时定义功能。

## 📋 功能特性

### 🔍 智能内容分析
- 自动提取网页主要内容
- 识别和高亮重要关键词
- 实时发送内容到Glass主程序进行分析

### 📚 术语定义
- 双击任意词汇获取定义
- 上下文相关的术语解释
- 支持多语言定义

### 🎯 关键词高亮
- 基于重要性的不同高亮样式
- 可点击的关键词获取更多信息
- 智能避免重复高亮

### ⚙️ 用户控制
- 可配置的自动高亮开关
- 内容分析控制
- 实时统计信息显示

## 🚀 安装和使用

### 前置条件
1. **Glass主程序**: 确保Glass桌面应用程序已安装并运行
2. **Chrome浏览器**: 版本88或更高
3. **Native Messaging**: 需要配置原生消息通信

### 安装步骤

#### 开发者模式安装
1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择此目录 (`chrome-extension`)
6. 扩展将出现在工具栏中

#### 生产环境安装
```bash
# 打包扩展
npm run build-extension

# 生成.crx文件用于分发
npm run package-extension
```

### Native Messaging配置

扩展需要与Glass主程序通信，需要配置native messaging。

#### macOS配置
```bash
# 创建native messaging配置目录
mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/

# 复制配置文件
cp native-host-manifest.json ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.pickle.glass.extension.json
```

#### Windows配置
```cmd
# 注册表配置 (需要管理员权限)
reg add "HKEY_CURRENT_USER\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.pickle.glass.extension" /ve /t REG_SZ /d "C:\path\to\native-host-manifest.json"
```

#### Linux配置
```bash
# 创建配置目录
mkdir -p ~/.config/google-chrome/NativeMessagingHosts/

# 复制配置文件
cp native-host-manifest.json ~/.config/google-chrome/NativeMessagingHosts/com.pickle.glass.extension.json
```

## 🎛️ 使用指南

### 基本使用
1. **启动Glass主程序**
2. **打开任意网页** - 扩展会自动开始分析内容
3. **查看高亮** - 重要关键词会被自动高亮
4. **获取定义** - 双击任意词汇查看定义
5. **控制功能** - 点击扩展图标打开控制面板

### 扩展弹出窗口
- **连接状态**: 显示与Glass主程序的连接状态
- **页面信息**: 当前页面的基本信息
- **功能开关**: 控制各种自动功能
- **统计信息**: 处理的词汇数量和定义数量

### 快捷操作
- **双击词汇**: 获取术语定义
- **点击高亮**: 显示详细信息
- **右键菜单**: 快速操作 (计划功能)

## 🔧 技术架构

### 组件结构
```
chrome-extension/
├── manifest.json          # 扩展清单文件
├── background.js          # 服务工作者脚本
├── content.js            # 内容脚本
├── popup.html           # 弹出窗口界面
├── popup.js             # 弹出窗口逻辑
├── styles/
│   └── highlight.css    # 高亮样式
├── icons/               # 扩展图标
└── welcome.html         # 欢迎页面
```

### 通信流程
```
网页内容 → Content Script → Background Script → Native Messaging → Glass主程序
                ↓
            页面高亮 ← Background Script ← Native Messaging ← 分析结果
```

### 消息类型
- `webContent`: 网页内容数据
- `keywords`: 关键词高亮指令
- `definitions`: 术语定义响应
- `highlight`: 特定高亮指令
- `status`: 状态更新

## 🎨 样式和UI

### 高亮样式
- **高重要性**: 红色边框，粗体文字
- **中等重要性**: 橙色边框，正常文字
- **低重要性**: 绿色边框，正常文字

### 响应式设计
- 支持移动设备浏览器
- 高对比度模式支持
- 减少动画模式支持
- 暗色主题适配

### 无障碍功能
- 键盘导航支持
- 屏幕阅读器友好
- 高对比度模式
- 语义化HTML结构

## 🧪 开发和调试

### 开发环境设置
```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建扩展
npm run build
```

### 调试技巧
1. **Background Script调试**:
   - 访问 `chrome://extensions/`
   - 点击"检查视图 服务工作者"

2. **Content Script调试**:
   - 在网页上按F12
   - 查看Console中的扩展日志

3. **Popup调试**:
   - 右键点击扩展图标
   - 选择"检查弹出内容"

### 常见问题

#### 连接问题
- **症状**: 显示"Disconnected"状态
- **解决**: 检查Glass主程序是否运行，Native Messaging是否正确配置

#### 高亮不工作
- **症状**: 页面没有高亮显示
- **解决**: 检查内容脚本是否加载，控制台是否有错误

#### 定义不显示
- **症状**: 双击词汇没有反应
- **解决**: 确保与主程序连接正常，检查网络请求

## 📊 性能优化

### 内容提取优化
- 防抖机制避免频繁提取
- 智能内容区域识别
- 排除导航和广告内容

### 高亮性能
- 使用TreeWalker高效遍历
- 避免重复高亮相同内容
- 批量DOM操作减少重排

### 内存管理
- 及时清理事件监听器
- 限制高亮元素数量
- 定期清理缓存数据

## 🔒 隐私和安全

### 数据处理
- 不存储用户浏览历史
- 仅处理当前页面内容
- 所有数据处理在本地进行

### 权限说明
- `activeTab`: 访问当前活跃标签页
- `storage`: 存储用户设置
- `scripting`: 注入内容脚本
- `nativeMessaging`: 与主程序通信

### 安全措施
- 内容脚本沙箱隔离
- 消息验证和过滤
- 防止XSS攻击

## 📈 版本历史

### v1.0.0 (当前版本)
- ✅ 基础内容提取功能
- ✅ 关键词智能高亮
- ✅ 术语定义查询
- ✅ 与Glass主程序通信
- ✅ 用户控制面板

### 计划功能
- 🔄 多语言界面支持
- 🔄 自定义高亮样式
- 🔄 批量术语导出
- 🔄 学习进度跟踪
- 🔄 右键菜单集成

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

### 代码规范
- 使用ESLint进行代码检查
- 遵循Google JavaScript风格指南
- 添加适当的注释和文档
- 确保所有功能都有相应测试

## 📞 支持和帮助

- **问题报告**: [GitHub Issues](https://github.com/pickle-com/glass/issues)
- **功能请求**: [GitHub Discussions](https://github.com/pickle-com/glass/discussions)
- **文档**: [Glass官方文档](https://docs.pickle.com/glass)
- **社区**: [Discord频道](https://discord.gg/UCZH5B5Hpd)

## 📄 许可证

本项目采用MIT许可证 - 查看 [LICENSE](../LICENSE) 文件了解详情。

---

*Glass Web Assistant - 让网页学习更智能 🚀*