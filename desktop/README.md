# DeepSeek Agent Desktop

<div align="center">
  <img src="build/icon.svg" width="128" height="128" alt="Logo">
  <h3>本地文件访问 & 命令执行服务</h3>
  <p>配合 DeepSeek Agent 浏览器插件使用，让 AI 可以访问本地文件和执行命令</p>
</div>

---

## 功能特点

- 🔌 **WebSocket 服务** - 与浏览器插件实时通信
- 📁 **文件系统访问** - 读取、创建、修改文件
- 💻 **命令执行** - 执行 shell 命令（构建、测试、运行等）
- 🎯 **系统托盘** - 后台运行，不干扰工作
- 🖥️ **跨平台** - 支持 Windows、macOS、Linux

## 下载安装

### 从 Release 下载

前往 [Releases](https://github.com/DingDing-bbb/deepseek-agent-desktop/releases) 页面下载对应平台的安装包：

| 平台 | 文件 |
|------|------|
| Windows | `DeepSeek-Agent-Desktop-Setup-x.x.x.exe` |
| macOS | `DeepSeek-Agent-Desktop-x.x.x.dmg` |
| Linux | `DeepSeek-Agent-Desktop-x.x.x.AppImage` |

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/DingDing-bbb/deepseek-agent-desktop.git
cd deepseek-agent-desktop

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 打包
pnpm package        # 当前平台
pnpm package:win    # Windows
pnpm package:mac    # macOS
pnpm package:linux  # Linux
```

## 使用方法

### 1. 启动应用

安装后启动 DeepSeek Agent Desktop，应用会在系统托盘显示图标。

### 2. 选择工作目录

点击「选择文件夹」按钮，选择一个目录作为 AI 的工作空间。

### 3. 安装浏览器插件

安装 DeepSeek Agent 浏览器插件（需要单独下载）。

### 4. 开始使用

1. 访问 [chat.deepseek.com](https://chat.deepseek.com)
2. 点击 Agent 按钮应用系统提示
3. AI 现在可以访问文件和执行命令了

## 工作原理

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│  浏览器插件     │◄──────────────────►│  桌面应用        │
│  (Chrome/Edge)  │     端口 3777      │  (Electron)      │
└─────────────────┘                    └──────────────────┘
                                              │
                                              ▼
                                       ┌──────────────────┐
                                       │  文件系统        │
                                       │  Shell 命令      │
                                       └──────────────────┘
```

## 安全说明

- 应用仅在本地运行，监听 `localhost:3777`
- 不发送任何数据到远程服务器
- 所有操作都在本地进行
- 建议只在信任的环境中使用

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **React** - UI 组件库
- **TypeScript** - 类型安全
- **WebSocket** - 实时通信
- **electron-vite** - 构建工具

## 开发

### 项目结构

```
deepseek-agent-desktop/
├── src/
│   ├── main/          # Electron 主进程
│   │   └── main.ts    # 文件操作、命令执行、WebSocket
│   ├── preload/       # 预加载脚本
│   │   └── preload.ts # IPC 通信桥接
│   └── renderer/      # 渲染进程 (UI)
│       ├── index.html
│       └── App.tsx    # React 应用
├── build/             # 构建资源
├── .github/
│   └── workflows/     # GitHub Actions
└── package.json
```

### API

桌面应用通过 WebSocket 提供以下 API：

| 类型 | 说明 | 参数 |
|------|------|------|
| `get-state` | 获取当前状态 | - |
| `set-workspace` | 设置工作目录 | `path` |
| `read-file` | 读取文件 | `path` |
| `write-file` | 写入文件 | `path`, `content` |
| `list-files` | 列出文件 | `path`, `recursive` |
| `execute` | 执行命令 | `command`, `options` |
| `get-system-prompt` | 获取系统提示 | - |

## 许可证

MIT License

## 相关项目

- [DeepSeek Agent 浏览器插件](https://github.com/DingDing-bbb/deepseek-agent-extension)
