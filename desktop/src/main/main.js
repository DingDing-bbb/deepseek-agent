const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

let mainWindow = null;
let tray = null;
let wsServer = null;
let wsClients = new Set();

// State
let baseWorkspaceFolder = null;
let runningProcesses = new Map();
let isServerRunning = false;
let sessionFolders = new Map(); // sessionId -> folder info

// Platform
const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

// System prompt
const SYSTEM_PROMPT = `你是一位专业的 AI 编程助手，具备完整的本地开发环境访问能力。

## 你的能力
你可以通过输出特定的 XML 标签来执行以下操作：

### 1. 读取文件
\`\`\`xml
<read_file path="相对或绝对路径" />
\`\`\`

### 2. 写入/创建文件
\`\`\`xml
<write_file path="文件路径">
文件内容...
</write_file>
\`\`\`

### 3. 编辑文件
\`\`\`xml
<edit_file path="文件路径" mode="append|prepend">
内容...
</edit_file>
\`\`\`

### 4. 列出目录
\`\`\`xml
<list_dir path="目录路径" />
\`\`\`

### 5. 删除
\`\`\`xml
<delete path="路径" />
\`\`\`

### 6. 执行命令
\`\`\`xml
<execute command="命令" />
\`\`\`

### 7. 搜索文件
\`\`\`xml
<search pattern="搜索模式" path="目录" />
\`\`\`

### 8. 设置预览
\`\`\`xml
<preview url="http://localhost:3000" />
\`\`\`

## 当前工作目录
{workspace}

## 重要提醒
- 所有路径支持相对和绝对路径
- 危险操作会确认
- 一次可输出多个 XML 标签`;

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 650,
    minWidth: 400,
    minHeight: 500,
    show: false,
    frame: true,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });
}

// Create system tray
function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/svg+xml;base64,' + 
    Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="#4d6bfe"/>
        <circle cx="32" cy="32" r="18" fill="none" stroke="white" stroke-width="3"/>
        <circle cx="32" cy="32" r="4" fill="white"/>
        <path d="M32 8 L32 18" stroke="white" stroke-width="3" stroke-linecap="round"/>
        <path d="M32 46 L32 56" stroke="white" stroke-width="3" stroke-linecap="round"/>
        <path d="M8 32 L18 32" stroke="white" stroke-width="3" stroke-linecap="round"/>
        <path d="M46 32 L56 32" stroke="white" stroke-width="3" stroke-linecap="round"/>
      </svg>
    `).toString('base64')
  );

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  updateTrayMenu();

  tray.on('double-click', () => {
    mainWindow && mainWindow.show();
  });
}

function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => mainWindow && mainWindow.show() },
    { type: 'separator' },
    { label: baseWorkspaceFolder ? '工作目录: ' + path.basename(baseWorkspaceFolder) : '未设置工作目录', enabled: false },
    { 
      label: '更改工作目录',
      click: async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory'],
        });
        if (!result.canceled && result.filePaths.length > 0) {
          setBaseWorkspace(result.filePaths[0]);
        }
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);
}

// Set base workspace folder
function setBaseWorkspace(folder) {
  baseWorkspaceFolder = folder;
  
  // Ensure .deepseek-agent folder exists
  const agentDir = path.join(folder, '.deepseek-agent');
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true });
  }
  
  // Load or create settings
  const settingsFile = path.join(agentDir, 'settings.json');
  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify({
      version: '0.0.1',
      previewUrl: '',
      sidebarWidth: 400,
      sessions: {}
    }, null, 2));
  }
  
  updateTrayMenu();
  broadcast({
    type: 'state',
    workspace: baseWorkspaceFolder,
    systemPrompt: SYSTEM_PROMPT.replace('{workspace}', baseWorkspaceFolder),
  });
}

// Get session folder path
function getSessionFolder(sessionId) {
  if (!baseWorkspaceFolder) return null;
  return path.join(baseWorkspaceFolder, sessionId);
}

// Ensure session folder exists with metadata
function ensureSessionFolder(sessionId, title = 'DeepSeek Chat') {
  if (!baseWorkspaceFolder) return null;
  
  const folder = getSessionFolder(sessionId);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  
  // Create desktop.ini (Windows)
  const desktopIni = path.join(folder, 'desktop.ini');
  const iniContent = `[.ShellClassInfo]
IconResource=chat-icon.ico,0
[ViewState]
Mode=
Vid=
FolderType=Documents
Logo=
[DeepSeek]
SessionId=${sessionId}
Title=${title}
CreatedAt=${new Date().toISOString()}
`;
  fs.writeFileSync(desktopIni, iniContent);
  
  // Create .directory (Linux/Mac)
  const directoryFile = path.join(folder, '.directory');
  const directoryContent = `[Desktop Entry]
Icon=folder-chat
Name=${title}
Comment=DeepSeek Chat Session: ${sessionId}
DeepSeekSessionId=${sessionId}
DeepSeekTitle=${title}
DeepSeekCreatedAt=${new Date().toISOString()}
`;
  fs.writeFileSync(directoryFile, directoryContent);
  
  return folder;
}

// Start WebSocket server
function startWebSocketServer(port = 3777) {
  if (wsServer) {
    wsServer.close();
  }

  wsServer = new WebSocket.Server({ port });

  wsServer.on('connection', (ws) => {
    wsClients.add(ws);
    console.log('Client connected, total:', wsClients.size);

    ws.send(JSON.stringify({
      type: 'state',
      workspace: baseWorkspaceFolder,
      systemPrompt: baseWorkspaceFolder ? SYSTEM_PROMPT.replace('{workspace}', baseWorkspaceFolder) : null,
    }));

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        const response = await handleMessage(message, ws);
        if (response) {
          ws.send(JSON.stringify(response));
        }
      } catch (error) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: error.message || 'Unknown error' 
        }));
      }
    });

    ws.on('close', () => {
      wsClients.delete(ws);
    });
  });

  isServerRunning = true;
  console.log('WebSocket server started on port ' + port);
}

// Broadcast to all clients
function broadcast(data) {
  const message = JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Handle messages from browser extension
async function handleMessage(message, ws) {
  switch (message.type) {
    case 'get-state':
      return {
        type: 'state',
        workspace: baseWorkspaceFolder,
        systemPrompt: baseWorkspaceFolder ? SYSTEM_PROMPT.replace('{workspace}', baseWorkspaceFolder) : null,
      };

    case 'set-workspace':
      setBaseWorkspace(message.path);
      return { type: 'success', message: 'Workspace set' };

    case 'read-file':
      return await readFile(message.path, message.sessionId);

    case 'write-file':
      return await writeFile(message.path, message.content, message.sessionId);

    case 'list-files':
      return await listFiles(message.path, message.recursive);

    case 'execute':
      return await executeCommand(message.command, message.options);

    case 'list-session-files':
      return await listSessionFiles(message.sessionId);

    case 'execute-actions':
      return await executeActions(message.commands, message.sessionId, ws);

    default:
      return { type: 'error', message: 'Unknown message type' };
  }
}

// Execute multiple XML actions
async function executeActions(commands, sessionId, ws) {
  const results = [];
  
  // Ensure session folder exists
  if (sessionId && baseWorkspaceFolder) {
    ensureSessionFolder(sessionId);
  }
  
  for (const cmd of commands) {
    let result;
    
    switch (cmd.type) {
      case 'read_file':
        result = await readFile(cmd.path, sessionId);
        break;
        
      case 'write_file':
        result = await writeFile(cmd.path, cmd.content, sessionId);
        break;
        
      case 'edit_file':
        result = await editFile(cmd.path, cmd.content, cmd.mode, sessionId);
        break;
        
      case 'list_dir':
        result = await listFiles(cmd.path, false, sessionId);
        break;
        
      case 'delete':
        result = await deleteFile(cmd.path, sessionId);
        break;
        
      case 'execute':
        result = await executeCommand(cmd.command, { sessionId });
        break;
        
      case 'search':
        result = await searchFiles(cmd.pattern, cmd.path, sessionId);
        break;
        
      default:
        result = { type: 'error', message: 'Unknown action: ' + cmd.type };
    }
    
    const logEntry = {
      type: cmd.type,
      path: cmd.path || cmd.command,
      success: result.type !== 'error',
      data: result.content || result.files || result.output,
      error: result.message,
    };
    
    results.push(logEntry);
    
    // Send real-time update
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'action-result',
        action: cmd.type,
        path: cmd.path || cmd.command,
        success: result.type !== 'error',
        data: logEntry.data ? String(logEntry.data).substring(0, 1000) : null,
        error: result.message,
      }));
    }
    
    // Log to file
    if (sessionId) {
      logAction(sessionId, logEntry);
    }
  }
  
  return {
    type: 'actions-complete',
    total: commands.length,
    results,
  };
}

// Log action to session history
function logAction(sessionId, entry) {
  if (!baseWorkspaceFolder) return;
  
  const logFile = path.join(baseWorkspaceFolder, '.deepseek-agent', 'actions.json');
  let logs = [];
  
  if (fs.existsSync(logFile)) {
    try {
      logs = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
    } catch (e) {}
  }
  
  logs.unshift({
    ...entry,
    sessionId,
    timestamp: new Date().toISOString()
  });
  
  // Keep last 1000 entries
  if (logs.length > 1000) logs = logs.slice(0, 1000);
  
  fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
}

// File operations with session context
function resolvePath(filePath, sessionId) {
  if (!baseWorkspaceFolder) return filePath;
  if (path.isAbsolute(filePath)) return filePath;
  
  // If session folder exists, use it as base
  if (sessionId) {
    const sessionFolder = getSessionFolder(sessionId);
    if (sessionFolder && fs.existsSync(sessionFolder)) {
      return path.join(sessionFolder, filePath);
    }
  }
  
  return path.join(baseWorkspaceFolder, filePath);
}

async function readFile(filePath, sessionId) {
  try {
    const fullPath = resolvePath(filePath, sessionId);
    const content = await fs.promises.readFile(fullPath, 'utf-8');
    return { type: 'file-content', path: filePath, content };
  } catch (error) {
    return { type: 'error', message: 'Failed to read: ' + error.message };
  }
}

async function writeFile(filePath, content, sessionId) {
  try {
    const fullPath = resolvePath(filePath, sessionId);
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    
    await fs.promises.writeFile(fullPath, content, 'utf-8');
    return { type: 'success', message: 'File written: ' + filePath, path: filePath };
  } catch (error) {
    return { type: 'error', message: 'Failed to write: ' + error.message };
  }
}

async function editFile(filePath, content, mode, sessionId) {
  try {
    const fullPath = resolvePath(filePath, sessionId);
    let existingContent = '';
    
    if (fs.existsSync(fullPath)) {
      existingContent = await fs.promises.readFile(fullPath, 'utf-8');
    }
    
    let newContent;
    if (mode === 'prepend') {
      newContent = content + existingContent;
    } else {
      newContent = existingContent + content;
    }
    
    await fs.promises.writeFile(fullPath, newContent, 'utf-8');
    return { type: 'success', message: 'File edited: ' + filePath, path: filePath };
  } catch (error) {
    return { type: 'error', message: 'Failed to edit: ' + error.message };
  }
}

async function deleteFile(filePath, sessionId) {
  try {
    const fullPath = resolvePath(filePath, sessionId);
    
    if (fs.existsSync(fullPath)) {
      const stat = await fs.promises.stat(fullPath);
      if (stat.isDirectory()) {
        await fs.promises.rm(fullPath, { recursive: true });
      } else {
        await fs.promises.unlink(fullPath);
      }
      return { type: 'success', message: 'Deleted: ' + filePath };
    } else {
      return { type: 'error', message: 'File not found: ' + filePath };
    }
  } catch (error) {
    return { type: 'error', message: 'Failed to delete: ' + error.message };
  }
}

async function searchFiles(pattern, searchPath, sessionId) {
  try {
    const fullPath = resolvePath(searchPath, sessionId);
    const results = [];
    
    const globToRegex = (glob) => {
      return new RegExp('^' + glob.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    };
    
    const search = async (dir) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await search(entryPath);
        } else if (globToRegex(pattern).test(entry.name)) {
          results.push(entryPath);
        }
      }
    };
    
    await search(fullPath);
    return { type: 'search-results', pattern, path: searchPath, results };
  } catch (error) {
    return { type: 'error', message: 'Search failed: ' + error.message };
  }
}

async function listFiles(dirPath = '.', recursive = false, sessionId) {
  try {
    const fullPath = resolvePath(dirPath, sessionId);
    const files = await listFilesRecursive(fullPath, recursive);
    return { type: 'file-list', path: dirPath, files };
  } catch (error) {
    return { type: 'error', message: 'Failed to list: ' + error.message };
  }
}

async function listSessionFiles(sessionId) {
  if (!sessionId || !baseWorkspaceFolder) {
    return { type: 'file-list', files: [] };
  }
  
  const sessionFolder = getSessionFolder(sessionId);
  if (!fs.existsSync(sessionFolder)) {
    // Create session folder
    ensureSessionFolder(sessionId);
    return { type: 'file-list', path: sessionFolder, files: [] };
  }
  
  return await listFiles('.', true, sessionId);
}

async function listFilesRecursive(dir, recursive, basePath = '') {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.directory') continue;
    
    const fullPath = path.join(dir, entry.name);
    const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;

    if (entry.isDirectory()) {
      files.push({
        name: entry.name,
        path: relativePath,
        type: 'directory',
      });

      if (recursive) {
        const subFiles = await listFilesRecursive(fullPath, recursive, relativePath);
        files.push(...subFiles);
      }
    } else {
      const stat = await fs.promises.stat(fullPath);
      files.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
        size: stat.size,
        modified: stat.mtime,
      });
    }
  }

  return files;
}

// Command execution
async function executeCommand(command, options = {}) {
  return new Promise((resolve) => {
    if (!baseWorkspaceFolder) {
      resolve({ type: 'error', message: 'No workspace folder set' });
      return;
    }

    const cwd = options.sessionId ? 
      getSessionFolder(options.sessionId) || baseWorkspaceFolder : 
      baseWorkspaceFolder;

    const proc = spawn(command, [], {
      cwd,
      shell: true,
      env: { ...process.env, ...options.env },
    });

    const pid = proc.pid ? proc.pid.toString() : Date.now().toString();
    runningProcesses.set(pid, proc);

    let output = '';
    let errorOutput = '';

    proc.stdout && proc.stdout.on('data', (data) => {
      const str = data.toString();
      output += str;
    });

    proc.stderr && proc.stderr.on('data', (data) => {
      const str = data.toString();
      errorOutput += str;
    });

    proc.on('close', (code) => {
      runningProcesses.delete(pid);
      resolve({
        type: 'command-complete',
        pid,
        command,
        code,
        output: output || errorOutput,
      });
    });
  });
}

// IPC handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    setBaseWorkspace(result.filePaths[0]);
    return baseWorkspaceFolder;
  }
  return null;
});

ipcMain.handle('get-state', () => ({
  workspace: baseWorkspaceFolder,
  isServerRunning,
  clientCount: wsClients.size,
}));

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();
  startWebSocketServer();
});

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow && mainWindow.show();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  
  runningProcesses.forEach((proc) => proc.kill());
  runningProcesses.clear();
  
  if (wsServer) {
    wsServer.close();
  }
});
