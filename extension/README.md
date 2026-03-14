# DeepSeek Agent 浏览器插件

配合 DeepSeek Agent Desktop 桌面应用使用的浏览器插件。

## 功能特点

- 🤖 **一键应用系统提示** - 快速应用程序员角色的系统提示
- 📁 **本地文件访问** - AI 可以读写本地文件
- 💻 **命令执行** - AI 可以执行 shell 命令
- 🔄 **实时连接** - WebSocket 实时通信

## 系统要求

- **必须** 先安装并运行 DeepSeek Agent Desktop 桌面应用
- 桌面应用会在后台运行，监听 WebSocket 端口 3777

## 安装方法

### Chrome / Edge / Brave

1. 下载插件文件夹
2. 打开浏览器扩展管理页面：
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 `deepseek-agent-extension` 文件夹

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击「临时载入附加组件」
3. 选择 `manifest.json` 文件

## 使用方法

1. **启动桌面应用** - 确保 DeepSeek Agent Desktop 正在运行
2. **设置工作目录** - 在桌面应用中选择一个文件夹作为工作空间
3. **访问 DeepSeek** - 打开 https://chat.deepseek.com
4. **点击 Agent 按钮** - 在输入框上方找到 Agent 按钮并点击
5. **开始对话** - AI 现在可以访问你的文件和执行命令了

## 工作原理

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│  浏览器插件     │◄──────────────────►│  桌面应用        │
│  (content.js)   │     端口 3777      │  (Electron)      │
└─────────────────┘                    └──────────────────┘
                                              │
                                              ▼
                                       ┌──────────────────┐
                                       │  文件系统        │
                                       │  Shell 命令      │
                                       └──────────────────┘
```

## 安全说明

- 桌面应用仅在本地运行，监听 `localhost:3777`
- 浏览器插件只能访问 `chat.deepseek.com` 页面
- 所有通信都在本地进行，不发送任何数据到远程服务器
- AI 执行危险操作前会提示确认

## 文件结构

```
deepseek-agent-extension/
├── manifest.json      # 插件配置
├── content.js         # 内容脚本
├── background.js      # 后台服务
├── styles.css         # 样式
├── popup.html         # 弹窗界面
├── popup.js           # 弹窗逻辑
├── icons/             # 图标
│   └── icon.svg
└── README.md          # 说明文档
```

## 许可证

MIT License
