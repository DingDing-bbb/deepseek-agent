/**
 * DeepSeek Agent Desktop - Main Process
 * 
 * 职责：
 * 1. 作为 Native Messaging Host 与浏览器插件通信
 * 2. 执行文件操作（读写、命令执行）
 * 3. 返回详细的结果信息（成功：时间戳、大小、MD5；失败：错误类型和原因）
 * 
 * 运行模式：
 * - Native Messaging: node main.js --native-messaging (无GUI)
 * - GUI: electron . (带系统托盘和窗口)
 * 
 * v0.0.1
 */

const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ===================== 常量 =====================

const VERSION = '0.0.1';
const IS_NATIVE_MESSAGING = process.argv.includes('--native-messaging') || process.env.NATIVE_MESSAGING === '1';
const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';

// 错误类型定义
const ERROR_TYPES = {
  PERMISSION_DENIED: 'permission_denied',
  FILE_NOT_FOUND: 'file_not_found',
  PATH_INVALID: 'path_invalid',
  COMMAND_FAILED: 'command_failed',
  WORKSPACE_NOT_SET: 'workspace_not_set',
  INVALID_PARAMS: 'invalid_params',
  UNKNOWN: 'unknown'
};

// ===================== 全局状态 =====================

let mainWindow = null;
let tray = null;
let baseWorkspaceFolder = null;

// ===================== 工具函数 =====================

function log(...args) {
  if (IS_NATIVE_MESSAGING) {
    // Native Messaging 模式下输出到 stderr（stdout 用于通信）
    console.error('[DeepSeek Agent]', ...args);
  } else {
    console.log('[DeepSeek Agent]', ...args);
  }
}

function getTimestamp() {
  return new Date().toISOString();
}

function calculateMD5(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch {
    return null;
  }
}

function getFileStats(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile()
    };
  } catch {
    return null;
  }
}

function resolvePath(filePath, sessionId) {
  if (!baseWorkspaceFolder) {
    return { error: ERROR_TYPES.WORKSPACE_NOT_SET, path: null };
  }
  
  if (path.isAbsolute(filePath)) {
    return { error: null, path: filePath };
  }
  
  // 如果有 sessionId，优先使用会话目录
  if (sessionId) {
    const sessionFolder = path.join(baseWorkspaceFolder, sessionId);
    if (fs.existsSync(sessionFolder)) {
      return { error: null, path: path.join(sessionFolder, filePath) };
    }
  }
  
  return { error: null, path: path.join(baseWorkspaceFolder, filePath) };
}

// ===================== 操作执行 =====================

/**
 * 读取文件
 */
async function readFile(params, sessionId) {
  const { error: resolveError, path: fullPath } = resolvePath(params.path, sessionId);
  if (resolveError) {
    return { success: false, errorType: resolveError, error: 'Workspace not set' };
  }

  try {
    if (!fs.existsSync(fullPath)) {
      return { success: false, errorType: ERROR_TYPES.FILE_NOT_FOUND, error: `File not found: ${params.path}` };
    }

    const content = await fs.promises.readFile(fullPath, 'utf-8');
    const stats = getFileStats(fullPath);
    const md5 = calculateMD5(fullPath);

    return {
      success: true,
      data: content,
      path: params.path,
      timestamp: getTimestamp(),
      size: stats?.size || 0,
      md5: md5
    };
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      return { success: false, errorType: ERROR_TYPES.PERMISSION_DENIED, error: 'Permission denied' };
    }
    return { success: false, errorType: ERROR_TYPES.UNKNOWN, error: err.message };
  }
}

/**
 * 写入文件
 */
async function writeFile(params, sessionId) {
  const { error: resolveError, path: fullPath } = resolvePath(params.path, sessionId);
  if (resolveError) {
    return { success: false, errorType: resolveError, error: 'Workspace not set' };
  }

  try {
    // 确保目录存在
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    await fs.promises.writeFile(fullPath, params.content || '', 'utf-8');
    
    const stats = getFileStats(fullPath);
    const md5 = calculateMD5(fullPath);

    return {
      success: true,
      path: params.path,
      timestamp: getTimestamp(),
      size: stats?.size || Buffer.byteLength(params.content || '', 'utf-8'),
      md5: md5,
      created: stats?.created
    };
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      return { success: false, errorType: ERROR_TYPES.PERMISSION_DENIED, error: 'Permission denied' };
    }
    return { success: false, errorType: ERROR_TYPES.UNKNOWN, error: err.message };
  }
}

/**
 * 编辑文件（追加或前置）
 */
async function editFile(params, sessionId) {
  const { error: resolveError, path: fullPath } = resolvePath(params.path, sessionId);
  if (resolveError) {
    return { success: false, errorType: resolveError, error: 'Workspace not set' };
  }

  try {
    let existingContent = '';
    if (fs.existsSync(fullPath)) {
      existingContent = await fs.promises.readFile(fullPath, 'utf-8');
    }

    const mode = params.mode || 'append';
    const newContent = mode === 'prepend' 
      ? (params.content || '') + existingContent 
      : existingContent + (params.content || '');

    await fs.promises.writeFile(fullPath, newContent, 'utf-8');
    
    const stats = getFileStats(fullPath);
    const md5 = calculateMD5(fullPath);

    return {
      success: true,
      path: params.path,
      timestamp: getTimestamp(),
      size: stats?.size || 0,
      md5: md5,
      mode: mode
    };
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      return { success: false, errorType: ERROR_TYPES.PERMISSION_DENIED, error: 'Permission denied' };
    }
    return { success: false, errorType: ERROR_TYPES.UNKNOWN, error: err.message };
  }
}

/**
 * 列出目录
 */
async function listDir(params, sessionId) {
  const { error: resolveError, path: fullPath } = resolvePath(params.path || '.', sessionId);
  if (resolveError) {
    return { success: false, errorType: resolveError, error: 'Workspace not set' };
  }

  try {
    if (!fs.existsSync(fullPath)) {
      return { success: false, errorType: ERROR_TYPES.FILE_NOT_FOUND, error: `Directory not found: ${params.path}` };
    }

    const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });
    const files = entries.map(entry => {
      const entryPath = path.join(fullPath, entry.name);
      const stats = entry.isFile() ? getFileStats(entryPath) : null;
      
      return {
        name: entry.name,
        path: path.relative(baseWorkspaceFolder, entryPath),
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stats?.size || 0,
        modified: stats?.modified || null
      };
    });

    return {
      success: true,
      data: files,
      path: params.path,
      timestamp: getTimestamp()
    };
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      return { success: false, errorType: ERROR_TYPES.PERMISSION_DENIED, error: 'Permission denied' };
    }
    return { success: false, errorType: ERROR_TYPES.UNKNOWN, error: err.message };
  }
}

/**
 * 删除文件或目录
 */
async function deleteFile(params, sessionId) {
  const { error: resolveError, path: fullPath } = resolvePath(params.path, sessionId);
  if (resolveError) {
    return { success: false, errorType: resolveError, error: 'Workspace not set' };
  }

  try {
    if (!fs.existsSync(fullPath)) {
      return { success: false, errorType: ERROR_TYPES.FILE_NOT_FOUND, error: `Path not found: ${params.path}` };
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      await fs.promises.rm(fullPath, { recursive: true });
    } else {
      await fs.promises.unlink(fullPath);
    }

    return {
      success: true,
      path: params.path,
      timestamp: getTimestamp()
    };
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      return { success: false, errorType: ERROR_TYPES.PERMISSION_DENIED, error: 'Permission denied' };
    }
    return { success: false, errorType: ERROR_TYPES.UNKNOWN, error: err.message };
  }
}

/**
 * 执行命令
 */
async function executeCommand(params, sessionId) {
  if (!baseWorkspaceFolder) {
    return { success: false, errorType: ERROR_TYPES.WORKSPACE_NOT_SET, error: 'Workspace not set' };
  }

  const cwd = sessionId 
    ? path.join(baseWorkspaceFolder, sessionId) 
    : baseWorkspaceFolder;

  return new Promise((resolve) => {
    const proc = spawn(params.command, [], {
      cwd,
      shell: true,
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      const success = code === 0;
      resolve({
        success: success,
        data: stdout || stderr,
        command: params.command,
        exitCode: code,
        timestamp: getTimestamp(),
        error: success ? null : `Command exited with code ${code}`,
        errorType: success ? null : ERROR_TYPES.COMMAND_FAILED
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        error: err.message,
        errorType: ERROR_TYPES.COMMAND_FAILED,
        command: params.command,
        timestamp: getTimestamp()
      });
    });
  });
}

/**
 * 搜索文件
 */
async function searchFiles(params, sessionId) {
  const { error: resolveError, path: searchPath } = resolvePath(params.path || '.', sessionId);
  if (resolveError) {
    return { success: false, errorType: resolveError, error: 'Workspace not set' };
  }

  try {
    if (!fs.existsSync(searchPath)) {
      return { success: false, errorType: ERROR_TYPES.FILE_NOT_FOUND, error: `Directory not found: ${params.path}` };
    }

    const results = [];
    const pattern = new RegExp(params.pattern.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');

    async function search(dir) {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await search(entryPath);
        } else if (pattern.test(entry.name)) {
          const stats = getFileStats(entryPath);
          results.push({
            name: entry.name,
            path: path.relative(baseWorkspaceFolder, entryPath),
            size: stats?.size || 0
          });
        }
      }
    }

    await search(searchPath);

    return {
      success: true,
      data: results,
      pattern: params.pattern,
      path: params.path,
      timestamp: getTimestamp()
    };
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      return { success: false, errorType: ERROR_TYPES.PERMISSION_DENIED, error: 'Permission denied' };
    }
    return { success: false, errorType: ERROR_TYPES.UNKNOWN, error: err.message };
  }
}

// ===================== Native Messaging =====================

let inputBuffer = Buffer.alloc(0);

function startNativeMessaging() {
  log('Starting Native Messaging mode');

  process.stdin.on('data', (chunk) => {
    inputBuffer = Buffer.concat([inputBuffer, chunk]);
    processInputBuffer();
  });

  process.stdin.on('end', () => {
    log('stdin ended, exiting');
    process.exit(0);
  });

  process.stdin.on('error', (err) => {
    log('stdin error:', err);
  });

  // 保持进程运行
  process.stdin.resume();
}

function processInputBuffer() {
  while (inputBuffer.length >= 4) {
    const messageLength = inputBuffer.readUInt32LE(0);
    
    if (inputBuffer.length < 4 + messageLength) {
      break; // 数据不完整，等待更多数据
    }

    const messageData = inputBuffer.slice(4, 4 + messageLength);
    inputBuffer = inputBuffer.slice(4 + messageLength);

    try {
      const message = JSON.parse(messageData.toString('utf8'));
      handleNativeMessage(message);
    } catch (err) {
      log('Failed to parse message:', err);
    }
  }
}

function sendNativeMessage(message) {
  const messageStr = JSON.stringify(message);
  const messageBuffer = Buffer.from(messageStr, 'utf8');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32LE(messageBuffer.length, 0);
  
  process.stdout.write(lengthBuffer);
  process.stdout.write(messageBuffer);
}

async function handleNativeMessage(message) {
  log('Received:', message.type, message.requestId);

  let result;

  switch (message.type) {
    case 'get-state':
      result = {
        type: 'state',
        workspace: baseWorkspaceFolder,
        systemPrompt: baseWorkspaceFolder ? getSystemPrompt() : null
      };
      break;

    case 'set-workspace':
      baseWorkspaceFolder = message.path;
      result = { type: 'state', workspace: baseWorkspaceFolder };
      break;

    case 'execute-action':
      result = await executeAction(message);
      break;

    case 'execute-actions':
      result = await executeActions(message);
      break;

    default:
      result = { success: false, error: 'Unknown message type', errorType: ERROR_TYPES.UNKNOWN };
  }

  // 添加 requestId 到响应
  if (message.requestId && result) {
    result.requestId = message.requestId;
  }

  if (result) {
    sendNativeMessage(result);
  }
}

async function executeAction(message) {
  const { action, params, sessionId, requestId } = message;
  let result;

  switch (action) {
    case 'read_file':
      result = await readFile(params, sessionId);
      break;
    case 'write_file':
      result = await writeFile(params, sessionId);
      break;
    case 'edit_file':
      result = await editFile(params, sessionId);
      break;
    case 'list_dir':
      result = await listDir(params, sessionId);
      break;
    case 'delete':
      result = await deleteFile(params, sessionId);
      break;
    case 'execute':
      result = await executeCommand(params, sessionId);
      break;
    case 'search':
      result = await searchFiles(params, sessionId);
      break;
    default:
      result = { success: false, error: 'Unknown action', errorType: ERROR_TYPES.UNKNOWN };
  }

  // 添加请求 ID 和操作类型
  result.requestId = requestId;
  result.actionType = action;

  return result;
}

async function executeActions(message) {
  const { commands, sessionId, requestId } = message;
  const results = [];

  for (const cmd of commands) {
    const result = await executeAction({
      action: cmd.type,
      params: cmd,
      sessionId,
      requestId: `${requestId}-${results.length}`
    });

    results.push(result);

    // 发送实时更新
    sendNativeMessage({
      type: 'action-result',
      ...result
    });
  }

  return {
    type: 'actions-complete',
    requestId,
    total: commands.length,
    results
  };
}

// ===================== GUI Mode =====================

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 600,
    show: false,
    frame: true,
    titleBarStyle: IS_MAC ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, '../preload/preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('ready-to-show', () => mainWindow.show());
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/svg+xml;base64,' + 
    Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="#4d6bfe"/>
        <circle cx="32" cy="32" r="18" fill="none" stroke="white" stroke-width="3"/>
        <circle cx="32" cy="32" r="4" fill="white"/>
      </svg>
    `).toString('base64')
  );

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  updateTrayMenu();

  tray.on('double-click', () => mainWindow?.show());
}

function updateTrayMenu() {
  if (!tray) return;

  const menu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: baseWorkspaceFolder ? `工作目录: ${path.basename(baseWorkspaceFolder)}` : '未设置工作目录', enabled: false },
    {
      label: '更改工作目录',
      click: async () => {
        const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
        if (!result.canceled && result.filePaths[0]) {
          setWorkspace(result.filePaths[0]);
        }
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
  ]);

  tray.setContextMenu(menu);
}

function setWorkspace(folder) {
  baseWorkspaceFolder = folder;
  
  // 创建配置目录
  const agentDir = path.join(folder, '.deepseek-agent');
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true });
  }

  updateTrayMenu();
  log('Workspace set:', folder);
}

function getSystemPrompt() {
  return `你是一位专业的 AI 编程助手。

## 你的能力
你可以通过输出 XML 标签来执行操作：

### 读取文件
\`\`\`xml
<read_file path="文件路径" />
\`\`\`

### 写入文件
\`\`\`xml
<write_file path="文件路径">内容</write_file>
\`\`\`

### 列出目录
\`\`\`xml
<list_dir path="目录路径" />
\`\`\`

### 执行命令
\`\`\`xml
<execute command="命令" />
\`\`\`

## 当前工作目录
${baseWorkspaceFolder || '未设置'}

## 注意
- 所有路径支持相对路径（相对于工作目录）
- 返回结果包含：时间戳、文件大小、MD5`;
}

// IPC Handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (!result.canceled && result.filePaths[0]) {
    setWorkspace(result.filePaths[0]);
    return baseWorkspaceFolder;
  }
  return null;
});

ipcMain.handle('get-state', () => ({
  workspace: baseWorkspaceFolder
}));

// ===================== App Lifecycle =====================

if (IS_NATIVE_MESSAGING) {
  startNativeMessaging();
} else {
  app.whenReady().then(() => {
    createWindow();
    createTray();
    log('GUI mode ready');
  });

  app.on('window-all-closed', () => {
    if (!IS_MAC) app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
  });
}
