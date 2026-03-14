/**
 * DeepSeek Agent Extension - Background Service Worker
 * 
 * 职责：
 * 1. 管理与 Native Messaging Host 的连接
 * 2. 转发 content script 和 native host 之间的消息
 * 3. 维护连接状态
 * 
 * v0.0.1 - Native Messaging 架构
 */

const NATIVE_HOST_NAME = 'com.deepseek.agent';

// 全局状态
let nativePort = null;
let isConnected = false;
let workspaceFolder = null;
let pendingRequests = new Map(); // requestId -> { resolve, reject, timeout }
let reconnectTimer = null;

// ===================== 日志 =====================

function log(...args) {
  console.log('[DeepSeek Agent]', ...args);
}

function error(...args) {
  console.error('[DeepSeek Agent]', ...args;
}

// ===================== Native Messaging 连接 =====================

/**
 * 连接到 Native Messaging Host
 */
function connectNative() {
  if (nativePort) {
    log('Already connected');
    return nativePort;
  }

  try {
    log('Connecting to native host:', NATIVE_HOST_NAME);
    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    
    // 监听来自 native host 的消息
    nativePort.onMessage.addListener(handleNativeMessage);
    
    // 监听断开事件
    nativePort.onDisconnect.addListener(handleDisconnect);
    
    isConnected = true;
    log('Connected to native host');
    
    // 请求初始状态
    sendToNative({ type: 'get-state' });
    
    // 通知所有 content scripts
    broadcastToContent({ type: 'connection-status', connected: true });
    
    return nativePort;
  } catch (err) {
    error('Failed to connect:', err);
    nativePort = null;
    isConnected = false;
    
    // 安排重连
    scheduleReconnect();
    
    return null;
  }
}

/**
 * 处理连接断开
 */
function handleDisconnect() {
  error('Native host disconnected');
  
  nativePort = null;
  isConnected = false;
  workspaceFolder = null;
  
  // 清理所有 pending 请求
  pendingRequests.forEach((value, key) => {
    value.reject(new Error('Native host disconnected'));
  });
  pendingRequests.clear();
  
  // 通知所有 content scripts
  broadcastToContent({ type: 'connection-status', connected: false });
  
  // 安排重连
  scheduleReconnect();
}

/**
 * 安排重连
 */
function scheduleReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  
  reconnectTimer = setTimeout(() => {
    log('Attempting to reconnect...');
    connectNative();
  }, 3000);
}

/**
 * 发送消息到 Native Host
 * @param {object} message - 消息对象
 */
function sendToNative(message) {
  if (!nativePort) {
    error('Not connected to native host');
    return false;
  }

  try {
    nativePort.postMessage(message);
    log('Sent to native:', message.type);
    return true;
  } catch (err) {
    error('Failed to send:', err);
    return false;
  }
}

/**
 * 处理来自 Native Host 的消息
 */
function handleNativeMessage(message) {
  log('Received from native:', message.type, message);
  
  switch (message.type) {
    case 'state':
      // 更新状态
      workspaceFolder = message.workspace || null;
      isConnected = !!message.workspace;
      
      // 广播到 content scripts
      broadcastToContent({
        type: 'state',
        workspace: workspaceFolder,
        systemPrompt: message.systemPrompt
      });
      break;

    case 'action-result':
      // 操作结果，转发到 content script
      handleActionResult(message);
      break;

    case 'error':
      // 错误响应
      handleErrorResponse(message);
      break;

    default:
      // 可能是对某个请求的响应
      if (message.requestId) {
        resolvePendingRequest(message.requestId, message);
      } else {
        log('Unknown message type:', message.type);
      }
  }
}

/**
 * 处理操作结果
 */
function handleActionResult(result) {
  // 如果有 requestId，尝试 resolve pending 请求
  if (result.requestId) {
    resolvePendingRequest(result.requestId, result);
  }
  
  // 广播到所有 content scripts（让对应的卡片更新）
  broadcastToContent({
    type: 'action-result',
    requestId: result.requestId,
    actionType: result.actionType,
    path: result.path,
    command: result.command,
    success: result.success,
    data: result.data,
    error: result.error,
    errorType: result.errorType,
    timestamp: result.timestamp,
    size: result.size,
    md5: result.md5
  });
}

/**
 * 处理错误响应
 */
function handleErrorResponse(error) {
  if (error.requestId) {
    rejectPendingRequest(error.requestId, error);
  }
  
  broadcastToContent({
    type: 'error',
    requestId: error.requestId,
    error: error.error || error.message,
    errorType: error.errorType
  });
}

// ===================== 请求管理 =====================

/**
 * 添加 pending 请求
 */
function addPendingRequest(requestId, resolve, reject, timeout = 30000) {
  const timer = setTimeout(() => {
    pendingRequests.delete(requestId);
    reject(new Error('Request timeout'));
  }, timeout);
  
  pendingRequests.set(requestId, { resolve, reject, timer });
}

/**
 * resolve pending 请求
 */
function resolvePendingRequest(requestId, result) {
  const pending = pendingRequests.get(requestId);
  if (pending) {
    clearTimeout(pending.timer);
    pending.resolve(result);
    pendingRequests.delete(requestId);
  }
}

/**
 * reject pending 请求
 */
function rejectPendingRequest(requestId, error) {
  const pending = pendingRequests.get(requestId);
  if (pending) {
    clearTimeout(pending.timer);
    pending.reject(error);
    pendingRequests.delete(requestId);
  }
}

// ===================== 消息广播 =====================

/**
 * 广播消息到所有 content scripts
 */
async function broadcastToContent(message) {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://chat.deepseek.com/*' });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, message);
      } catch (err) {
        // Tab 可能已关闭或没有 content script
      }
    }
  } catch (err) {
    error('Broadcast failed:', err);
  }
}

// ===================== 消息处理 =====================

/**
 * 处理来自 content script 的消息
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log('Message from content:', message.type);
  
  // 异步处理
  handleMessage(message, sender)
    .then(response => sendResponse(response))
    .catch(err => sendResponse({ error: err.message }));
  
  // 返回 true 表示异步响应
  return true;
});

/**
 * 处理消息的核心逻辑
 */
async function handleMessage(message, sender) {
  switch (message.type) {
    case 'check-connection':
      return {
        connected: isConnected,
        workspace: workspaceFolder
      };

    case 'connect-native':
      const port = connectNative();
      return { connected: !!port };

    case 'get-state':
      // 转发到 native host
      sendToNative({ type: 'get-state' });
      return { status: 'requesting' };

    case 'execute-action':
      return await executeAction(message);

    case 'execute-actions':
      return await executeActions(message);

    default:
      // 转发到 native host
      if (sendToNative(message)) {
        return { status: 'sent' };
      } else {
        return { error: 'Not connected to native host' };
      }
  }
}

/**
 * 执行单个操作
 */
async function executeAction(message) {
  return new Promise((resolve, reject) => {
    if (!isConnected) {
      resolve({
        success: false,
        errorType: 'not_connected',
        error: 'Please start DeepSeek Agent desktop application'
      });
      return;
    }

    if (!workspaceFolder) {
      resolve({
        success: false,
        errorType: 'workspace_not_set',
        error: 'Please set workspace folder in desktop application'
      });
      return;
    }

    const requestId = message.requestId || `req_${Date.now()}`;
    
    // 添加到 pending
    addPendingRequest(requestId, resolve, reject);
    
    // 发送到 native host
    const sent = sendToNative({
      type: 'execute-action',
      requestId: requestId,
      sessionId: message.sessionId,
      action: message.action,
      params: message.params
    });
    
    if (!sent) {
      pendingRequests.delete(requestId);
      resolve({
        success: false,
        errorType: 'send_failed',
        error: 'Failed to send request to native host'
      });
    }
  });
}

/**
 * 执行多个操作
 */
async function executeActions(message) {
  if (!isConnected) {
    return {
      success: false,
      errorType: 'not_connected',
      error: 'Please start DeepSeek Agent desktop application'
    };
  }

  if (!workspaceFolder) {
    return {
      success: false,
      errorType: 'workspace_not_set',
      error: 'Please set workspace folder in desktop application'
    };
  }

  // 转发到 native host
  sendToNative({
    type: 'execute-actions',
    requestId: message.requestId,
    sessionId: message.sessionId,
    commands: message.commands
  });

  return { status: 'executing' };
}

// ===================== 生命周期 =====================

// 安装时连接
chrome.runtime.onInstalled.addListener((details) => {
  log('Extension installed, version:', chrome.runtime.getManifest().version);
  
  // 延迟连接，给 native host 时间启动
  setTimeout(() => {
    connectNative();
  }, 1000);
});

// 启动时连接
chrome.runtime.onStartup.addListener(() => {
  log('Extension started');
  connectNative();
});

// 初始化
log('Background script loaded');
