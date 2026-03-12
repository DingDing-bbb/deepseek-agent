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
let workspaceFolder = null;
let runningProcesses = new Map();
let isServerRunning = false;

// Platform
const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

// System prompt for coding agent - XML-based protocol
const SYSTEM_PROMPT = `你是一位专业的 AI 编程助手，具备完整的本地开发环境访问能力。

## 你的能力
你可以通过输出特定的 XML 标签来执行以下操作：

### 1. 读取文件
\`\`\`xml
<read_file path="相对或绝对路径" />
\`\`\`
示例：
\`\`\`xml
<read_file path="src/index.ts" />
<read_file path="/home/user/project/package.json" />
\`\`\`

### 2. 写入/创建文件
\`\`\`xml
<write_file path="文件路径">
文件内容写在这里...
</write_file>
\`\`\`
示例：
\`\`\`xml
<write_file path="src/utils/helper.ts">
export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}
</write_file>
\`\`\`

### 3. 编辑文件（追加内容）
\`\`\`xml
<edit_file path="文件路径" mode="append">
要追加的内容...
</edit_file>
\`\`\`
mode 可选值：append（追加）, prepend（前置）

### 4. 列出目录内容
\`\`\`xml
<list_dir path="目录路径" />
\`\`\`

### 5. 删除文件或目录
\`\`\`xml
<delete path="路径" />
\`\`\`
⚠️ 注意：删除操作不可逆，请在执行前确认

### 6. 执行命令
\`\`\`xml
<execute command="命令" />
\`\`\`
示例：
\`\`\`xml
<execute command="npm install" />
<execute command="git status" />
<execute command="npm run build" />
\`\`\`

### 7. 搜索文件
\`\`\`xml
<search pattern="搜索模式" path="搜索目录" />
\`\`\`
示例：
\`\`\`xml
<search pattern="*.ts" path="src" />
\`\`\`

## 工作流程
1. 当用户提出需求时，先分析需要哪些文件操作
2. 输出相应的 XML 标签来执行操作
3. 等待系统返回执行结果
4. 根据结果继续下一步操作或给用户反馈

## 当前工作目录
{workspace}

## 重要提醒
- 所有路径支持相对路径（相对于工作目录）和绝对路径
- 危险操作（如删除）执行前会提示用户确认
- 一次可以输出多个 XML 标签，系统会按顺序执行
- XML 标签必须单独一行输出，便于解析`;

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

  // Hide to tray on close (instead of quitting)
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

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => mainWindow && mainWindow.show() },
    { type: 'separator' },
    { label: workspaceFolder ? '工作目录: ' + workspaceFolder : '未设置工作目录', enabled: false },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
  ]);

  tray.setToolTip('DeepSeek Agent Desktop');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow && mainWindow.show();
  });
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

    // Send current state
    ws.send(JSON.stringify({
      type: 'state',
      workspace: workspaceFolder,
      systemPrompt: workspaceFolder ? SYSTEM_PROMPT.replace('{workspace}', workspaceFolder) : null,
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
      console.log('Client disconnected, total:', wsClients.size);
    });
  });

  isServerRunning = true;
  console.log('WebSocket server started on port ' + port);
}

// Broadcast to all WebSocket clients
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
        workspace: workspaceFolder,
        systemPrompt: workspaceFolder ? SYSTEM_PROMPT.replace('{workspace}', workspaceFolder) : null,
      };

    case 'set-workspace':
      workspaceFolder = message.path;
      updateTrayMenu();
      broadcast({
        type: 'state',
        workspace: workspaceFolder,
        systemPrompt: SYSTEM_PROMPT.replace('{workspace}', workspaceFolder),
      });
      return { type: 'success', message: 'Workspace set' };

    case 'read-file':
      return await readFile(message.path);

    case 'write-file':
      return await writeFile(message.path, message.content);

    case 'list-files':
      return await listFiles(message.path, message.recursive);

    case 'execute':
      return await executeCommand(message.command, message.options);

    case 'kill-process':
      return killProcess(message.pid);

    case 'get-system-prompt':
      return {
        type: 'system-prompt',
        prompt: workspaceFolder ? SYSTEM_PROMPT.replace('{workspace}', workspaceFolder) : null,
      };

    // Handle batch XML actions
    case 'execute-actions':
      return await executeActions(message.commands, ws);

    default:
      return { type: 'error', message: 'Unknown message type' };
  }
}

// Execute multiple actions from XML parsing
async function executeActions(commands, ws) {
  const results = [];
  
  for (const cmd of commands) {
    let result;
    
    switch (cmd.type) {
      case 'read_file':
        result = await readFile(cmd.path);
        break;
        
      case 'write_file':
        result = await writeFile(cmd.path, cmd.content);
        break;
        
      case 'edit_file':
        result = await editFile(cmd.path, cmd.content, cmd.mode);
        break;
        
      case 'list_dir':
        result = await listFiles(cmd.path, false);
        break;
        
      case 'delete':
        result = await deleteFile(cmd.path);
        break;
        
      case 'execute':
        result = await executeCommand(cmd.command, {});
        break;
        
      case 'search':
        result = await searchFiles(cmd.pattern, cmd.path);
        break;
        
      default:
        result = { type: 'error', message: 'Unknown action type: ' + cmd.type };
    }
    
    results.push({
      type: cmd.type,
      path: cmd.path || cmd.command,
      success: result.type !== 'error',
      data: result.type === 'error' ? undefined : result,
      error: result.type === 'error' ? result.message : undefined,
    });
    
    // Send each result immediately
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'action-result',
        action: cmd.type,
        success: result.type !== 'error',
        data: result.content || result.files || result.message,
        error: result.message,
      }));
    }
  }
  
  return {
    type: 'actions-complete',
    total: commands.length,
    results,
  };
}

// File operations
async function readFile(filePath) {
  try {
    const fullPath = workspaceFolder ? path.join(workspaceFolder, filePath) : filePath;
    const content = await fs.promises.readFile(fullPath, 'utf-8');
    return { type: 'file-content', path: filePath, content };
  } catch (error) {
    return { type: 'error', message: 'Failed to read file: ' + error.message };
  }
}

async function writeFile(filePath, content) {
  try {
    const fullPath = workspaceFolder ? path.join(workspaceFolder, filePath) : filePath;
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    
    await fs.promises.writeFile(fullPath, content, 'utf-8');
    return { type: 'success', message: 'File written: ' + filePath, path: filePath };
  } catch (error) {
    return { type: 'error', message: 'Failed to write file: ' + error.message };
  }
}

async function editFile(filePath, content, mode) {
  try {
    const fullPath = workspaceFolder ? path.join(workspaceFolder, filePath) : filePath;
    let existingContent = '';
    
    if (fs.existsSync(fullPath)) {
      existingContent = await fs.promises.readFile(fullPath, 'utf-8');
    }
    
    let newContent;
    if (mode === 'prepend') {
      newContent = content + existingContent;
    } else {
      // default: append
      newContent = existingContent + content;
    }
    
    await fs.promises.writeFile(fullPath, newContent, 'utf-8');
    return { type: 'success', message: 'File edited: ' + filePath, path: filePath };
  } catch (error) {
    return { type: 'error', message: 'Failed to edit file: ' + error.message };
  }
}

async function deleteFile(filePath) {
  try {
    const fullPath = workspaceFolder ? path.join(workspaceFolder, filePath) : filePath;
    
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

async function searchFiles(pattern, searchPath) {
  try {
    const fullPath = workspaceFolder ? path.join(workspaceFolder, searchPath) : searchPath;
    const results = [];
    
    const globToRegex = (glob) => {
      return new RegExp('^' + glob.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    };
    
    const search = async (dir) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await search(fullPath);
        } else if (globToRegex(pattern).test(entry.name)) {
          results.push(fullPath);
        }
      }
    };
    
    await search(fullPath);
    return { type: 'search-results', pattern, path: searchPath, results };
  } catch (error) {
    return { type: 'error', message: 'Search failed: ' + error.message };
  }
}

async function listFiles(dirPath = '.', recursive = false) {
  try {
    const fullPath = workspaceFolder ? path.join(workspaceFolder, dirPath) : dirPath;
    const files = await listFilesRecursive(fullPath, recursive);
    return { type: 'file-list', path: dirPath, files };
  } catch (error) {
    return { type: 'error', message: 'Failed to list files: ' + error.message };
  }
}

async function listFilesRecursive(dir, recursive, basePath = '') {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
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
    if (!workspaceFolder) {
      resolve({ type: 'error', message: 'No workspace folder set' });
      return;
    }

    const cwd = options.cwd || workspaceFolder;
    const shell = isWin ? 'powershell.exe' : '/bin/bash';

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
      broadcast({
        type: 'command-output',
        pid,
        data: str,
        stream: 'stdout',
      });
    });

    proc.stderr && proc.stderr.on('data', (data) => {
      const str = data.toString();
      errorOutput += str;
      broadcast({
        type: 'command-output',
        pid,
        data: str,
        stream: 'stderr',
      });
    });

    proc.on('close', (code) => {
      runningProcesses.delete(pid);
      broadcast({
        type: 'command-complete',
        pid,
        code,
      });
    });

    resolve({
      type: 'command-started',
      pid,
      command,
      cwd,
    });
  });
}

function killProcess(pid) {
  const proc = runningProcesses.get(pid);
  if (proc) {
    proc.kill();
    runningProcesses.delete(pid);
    return { type: 'success', message: 'Process ' + pid + ' killed' };
  }
  return { type: 'error', message: 'Process ' + pid + ' not found' };
}

// Update tray menu
function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => mainWindow && mainWindow.show() },
    { type: 'separator' },
    { label: workspaceFolder ? '工作目录: ' + path.basename(workspaceFolder) : '未设置工作目录', enabled: false },
    { 
      label: '更改工作目录',
      click: async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory'],
        });
        if (!result.canceled && result.filePaths.length > 0) {
          workspaceFolder = result.filePaths[0];
          updateTrayMenu();
          broadcast({
            type: 'state',
            workspace: workspaceFolder,
            systemPrompt: SYSTEM_PROMPT.replace('{workspace}', workspaceFolder),
          });
        }
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);
}

// IPC handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    workspaceFolder = result.filePaths[0];
    updateTrayMenu();
    broadcast({
      type: 'state',
      workspace: workspaceFolder,
      systemPrompt: SYSTEM_PROMPT.replace('{workspace}', workspaceFolder),
    });
    return workspaceFolder;
  }
  return null;
});

ipcMain.handle('get-state', () => ({
  workspace: workspaceFolder,
  isServerRunning,
  clientCount: wsClients.size,
}));

ipcMain.handle('get-system-prompt', () => 
  workspaceFolder ? SYSTEM_PROMPT.replace('{workspace}', workspaceFolder) : null
);

ipcMain.handle('execute-command', async (event, command, options) => {
  return executeCommand(command, options);
});

ipcMain.handle('read-file', async (event, filePath) => {
  return readFile(filePath);
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  return writeFile(filePath, content);
});

ipcMain.handle('list-files', async (event, dirPath, recursive) => {
  return listFiles(dirPath, recursive);
});

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
