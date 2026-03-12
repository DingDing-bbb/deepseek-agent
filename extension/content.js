// DeepSeek Agent Extension - Content Script
// Connects to local Electron app for file access and command execution
(function() {
  'use strict';

  // Configuration
  var WS_PORT = 3777;
  var ws = null;
  var reconnectAttempts = 0;
  var MAX_RECONNECT_ATTEMPTS = 10;
  var RECONNECT_DELAY = 3000;

  // State
  var isConnected = false;
  var workspaceFolder = null;
  var currentSessionId = null;
  var agentEnabled = false;
  var sidebarVisible = false;
  var sidebarWidth = 400;
  var activeTab = 'files'; // 'files' | 'preview' | 'logs'
  var actionLogs = [];
  var previewUrl = '';
  var currentSessionInfo = null;

  // XML-based Agent Protocol System Prompt
  var SYSTEM_PROMPT = 
    '你是一位专业的 AI 编程助手，具备完整的本地开发环境访问能力。\n\n' +
    
    '## 你的能力\n' +
    '你可以通过输出特定的 XML 标签来执行以下操作：\n\n' +
    
    '### 1. 读取文件\n' +
    '```xml\n' +
    '<read_file path="相对或绝对路径" />\n' +
    '```\n\n' +
    
    '### 2. 写入/创建文件\n' +
    '```xml\n' +
    '<write_file path="文件路径">\n' +
    '文件内容写在这里...\n' +
    '</write_file>\n' +
    '```\n\n' +
    
    '### 3. 编辑文件\n' +
    '```xml\n' +
    '<edit_file path="文件路径" mode="append|prepend">\n' +
    '要添加的内容...\n' +
    '</edit_file>\n' +
    '```\n\n' +
    
    '### 4. 列出目录\n' +
    '```xml\n' +
    '<list_dir path="目录路径" />\n' +
    '```\n\n' +
    
    '### 5. 删除文件或目录\n' +
    '```xml\n' +
    '<delete path="路径" />\n' +
    '```\n\n' +
    
    '### 6. 执行命令\n' +
    '```xml\n' +
    '<execute command="命令" />\n' +
    '```\n\n' +
    
    '### 7. 搜索文件\n' +
    '```xml\n' +
    '<search pattern="搜索模式" path="搜索目录" />\n' +
    '```\n\n' +
    
    '### 8. 设置预览网页\n' +
    '```xml\n' +
    '<preview url="http://localhost:3000" />\n' +
    '```\n\n' +
    
    '## 当前工作目录\n' +
    '{workspace}\n\n' +
    
    '## 重要提醒\n' +
    '- 所有路径支持相对路径和绝对路径\n' +
    '- 危险操作执行前会确认\n' +
    '- 一次可以输出多个 XML 标签\n' +
    '- XML 标签必须单独一行输出';

  // Initialize
  function init() {
    console.log('[DeepSeek Agent] Extension initialized v0.0.1');
    loadSettings();
    connectWebSocket();
    waitAndInject();
    observePageChanges();
    interceptNetworkRequests();
  }

  // Load settings from storage
  function loadSettings() {
    chrome.storage.local.get(['sidebarWidth', 'previewUrl', 'agentEnabled'], function(result) {
      if (result.sidebarWidth) sidebarWidth = result.sidebarWidth;
      if (result.previewUrl) previewUrl = result.previewUrl;
      if (result.agentEnabled) agentEnabled = result.agentEnabled;
    });
  }

  // Save settings
  function saveSettings(settings) {
    chrome.storage.local.set(settings);
  }

  // Connect to Electron app via WebSocket
  function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) return;

    try {
      ws = new WebSocket('ws://localhost:' + WS_PORT);

      ws.onopen = function() {
        console.log('[DeepSeek Agent] Connected to desktop app');
        isConnected = true;
        reconnectAttempts = 0;
        updateStatus();
        if (ws) {
          ws.send(JSON.stringify({ type: 'get-state' }));
        }
      };

      ws.onmessage = function(event) {
        try {
          var message = JSON.parse(event.data);
          handleServerMessage(message);
        } catch (error) {
          console.error('[DeepSeek Agent] Failed to parse message:', error);
        }
      };

      ws.onclose = function() {
        console.log('[DeepSeek Agent] Disconnected from desktop app');
        isConnected = false;
        updateStatus();
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          setTimeout(connectWebSocket, RECONNECT_DELAY);
        }
      };

      ws.onerror = function(error) {
        console.error('[DeepSeek Agent] WebSocket error:', error);
      };
    } catch (error) {
      console.error('[DeepSeek Agent] Failed to connect:', error);
    }
  }

  // Handle messages from Electron app
  function handleServerMessage(message) {
    switch (message.type) {
      case 'state':
        workspaceFolder = message.workspace;
        updateStatus();
        if (workspaceFolder) {
          loadSessionInfo();
        }
        break;

      case 'action-result':
        handleActionResult(message);
        break;

      case 'file-changed':
        refreshFileList();
        break;

      case 'settings':
        if (message.previewUrl) {
          previewUrl = message.previewUrl;
          updatePreviewPanel();
        }
        break;
    }
  }

  // Handle action execution result
  function handleActionResult(result) {
    var logEntry = {
      id: Date.now(),
      type: result.action,
      path: result.path || result.command,
      success: result.success,
      data: result.data,
      error: result.error,
      timestamp: new Date().toISOString()
    };

    actionLogs.unshift(logEntry);
    if (actionLogs.length > 100) actionLogs.pop();
    
    updateLogsPanel();
    refreshFileList();

    if (!result.success) {
      showToast('❌ 操作失败: ' + result.error, 'error');
    } else {
      showToast('✅ ' + getActionLabel(result.action) + ' 成功', 'success');
    }
  }

  function getActionLabel(action) {
    var labels = {
      'read_file': '读取文件',
      'write_file': '写入文件',
      'edit_file': '编辑文件',
      'list_dir': '列出目录',
      'delete': '删除',
      'execute': '执行命令',
      'search': '搜索文件',
      'preview': '设置预览'
    };
    return labels[action] || action;
  }

  // Intercept network requests to get session info
  function interceptNetworkRequests() {
    // Intercept fetch
    var originalFetch = window.fetch;
    window.fetch = function(url, options) {
      return originalFetch.apply(this, arguments).then(function(response) {
        // Clone response to read it
        var clonedResponse = response.clone();
        
        if (url.includes('/api/v0/chat_session/create') || 
            url.includes('/api/v0/chat/completion')) {
          handleApiRequest(url, options, clonedResponse);
        }
        
        return response;
      });
    };

    // Intercept XMLHttpRequest
    var originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
      var xhr = new originalXHR();
      var originalOpen = xhr.open;
      var originalSend = xhr.send;
      
      xhr.open = function(method, url) {
        xhr._url = url;
        xhr._method = method;
        return originalOpen.apply(this, arguments);
      };
      
      xhr.send = function(body) {
        if (xhr._url && xhr._url.includes('/api/v0/chat/completion')) {
          try {
            var data = JSON.parse(body);
            if (data.chat_session_id) {
              currentSessionId = data.chat_session_id;
              updateSessionInfo();
            }
          } catch (e) {}
        }
        return originalSend.apply(this, arguments);
      };
      
      return xhr;
    };
  }

  // Handle API requests
  function handleApiRequest(url, options, response) {
    if (url.includes('/chat_session/create')) {
      response.json().then(function(data) {
        if (data.data && data.data.biz_data && data.data.biz_data.chat_session) {
          currentSessionId = data.data.biz_data.chat_session.id;
          updateSessionInfo();
        }
      }).catch(function() {});
    }
    
    if (url.includes('/chat/completion')) {
      // Parse SSE response for XML commands
      response.text().then(function(text) {
        parseSSEResponse(text);
      }).catch(function() {});
    }
  }

  // Parse SSE response for XML commands
  function parseSSEResponse(text) {
    var lines = text.split('\n');
    var content = '';
    
    lines.forEach(function(line) {
      if (line.startsWith('data: ')) {
        try {
          var data = JSON.parse(line.substring(6));
          if (data.v) {
            content += data.v;
          }
        } catch (e) {}
      }
    });

    // Parse XML commands from content
    parseAndExecuteXML(content);
  }

  // Parse and execute XML commands
  function parseAndExecuteXML(text) {
    if (!text || text.indexOf('<') === -1) return;
    if (!isConnected || !currentSessionId) return;

    var commands = [];
    
    // <read_file path="..." />
    var readFileRegex = /<read_file\s+path=["']([^"']+)["']\s*\/?>/gi;
    var match;
    while ((match = readFileRegex.exec(text)) !== null) {
      commands.push({ type: 'read_file', path: match[1] });
    }

    // <write_file path="...">content</write_file>
    var writeFileRegex = /<write_file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/write_file>/gi;
    while ((match = writeFileRegex.exec(text)) !== null) {
      commands.push({ type: 'write_file', path: match[1], content: match[2] });
    }

    // <edit_file path="..." mode="...">content</edit_file>
    var editFileRegex = /<edit_file\s+path=["']([^"']+)["']\s+mode=["']([^"']+)["']\s*>([\s\S]*?)<\/edit_file>/gi;
    while ((match = editFileRegex.exec(text)) !== null) {
      commands.push({ type: 'edit_file', path: match[1], mode: match[2], content: match[3] });
    }

    // <list_dir path="..." />
    var listDirRegex = /<list_dir\s+path=["']([^"']+)["']\s*\/?>/gi;
    while ((match = listDirRegex.exec(text)) !== null) {
      commands.push({ type: 'list_dir', path: match[1] });
    }

    // <delete path="..." />
    var deleteRegex = /<delete\s+path=["']([^"']+)["']\s*\/?>/gi;
    while ((match = deleteRegex.exec(text)) !== null) {
      commands.push({ type: 'delete', path: match[1] });
    }

    // <execute command="..." />
    var executeRegex = /<execute\s+command=["']([^"']+)["']\s*\/?>/gi;
    while ((match = executeRegex.exec(text)) !== null) {
      commands.push({ type: 'execute', command: match[1] });
    }

    // <search pattern="..." path="..." />
    var searchRegex = /<search\s+pattern=["']([^"']+)["']\s+path=["']([^"']+)["']\s*\/?>/gi;
    while ((match = searchRegex.exec(text)) !== null) {
      commands.push({ type: 'search', pattern: match[1], path: match[2] });
    }

    // <preview url="..." />
    var previewRegex = /<preview\s+url=["']([^"']+)["']\s*\/?>/gi;
    while ((match = previewRegex.exec(text)) !== null) {
      previewUrl = match[1];
      saveSettings({ previewUrl: previewUrl });
      updatePreviewPanel();
      showToast('🌐 预览地址已设置: ' + previewUrl, 'info');
    }

    // Execute commands
    if (commands.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
      showToast('🔧 执行中: ' + commands.length + ' 个操作...', 'info');
      
      ws.send(JSON.stringify({
        type: 'execute-actions',
        sessionId: currentSessionId,
        commands: commands
      }));
    }
  }

  // Wait and inject UI
  function waitAndInject() {
    var attempts = 0;
    var maxAttempts = 30;
    
    var interval = setInterval(function() {
      attempts++;
      
      var container = document.querySelector('.ec4f5d61') || 
                      document.querySelector('[class*="chat-input"]') ||
                      document.querySelector('main');
      
      if (container && !document.querySelector('.ds-agent-wrapper')) {
        clearInterval(interval);
        injectUI();
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 500);
  }

  // Inject all UI elements
  function injectUI() {
    injectStyles();
    injectAgentButton();
    injectSidebar();
    updateStatus();
  }

  // Inject additional styles
  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = `
      .ds-agent-wrapper {
        position: relative;
        z-index: 100;
      }
      
      .ds-agent-toggle-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 0 14px;
        height: 34px;
        font-size: 13px;
        font-weight: 500;
        border-radius: 18px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid #e5e7eb;
        background: transparent;
        color: #374151;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .ds-agent-toggle-btn:hover {
        border-color: #d1d5db;
        background: rgba(0, 0, 0, 0.02);
      }
      
      .ds-agent-toggle-btn.ds-agent-active {
        border-color: #4d6bfe;
        background: linear-gradient(135deg, #4d6bfe 0%, #6366f1 100%);
        color: #fff;
      }
      
      .ds-agent-sidebar {
        position: fixed;
        top: 0;
        right: 0;
        height: 100vh;
        width: ${sidebarWidth}px;
        background: #fff;
        border-left: 1px solid #e5e7eb;
        box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      }
      
      .ds-agent-sidebar.ds-sidebar-visible {
        transform: translateX(0);
      }
      
      .ds-sidebar-resize {
        position: absolute;
        left: 0;
        top: 0;
        width: 4px;
        height: 100%;
        cursor: ew-resize;
        background: transparent;
        transition: background 0.2s;
      }
      
      .ds-sidebar-resize:hover {
        background: #4d6bfe;
      }
      
      .ds-sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid #e5e7eb;
        background: linear-gradient(135deg, #4d6bfe 0%, #6366f1 100%);
        color: #fff;
      }
      
      .ds-sidebar-title {
        font-size: 16px;
        font-weight: 600;
      }
      
      .ds-sidebar-close {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: none;
        background: rgba(255,255,255,0.2);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .ds-sidebar-close:hover {
        background: rgba(255,255,255,0.3);
      }
      
      .ds-sidebar-tabs {
        display: flex;
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
      }
      
      .ds-sidebar-tab {
        flex: 1;
        padding: 12px;
        text-align: center;
        font-size: 13px;
        font-weight: 500;
        color: #6b7280;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
      }
      
      .ds-sidebar-tab:hover {
        color: #374151;
        background: #f3f4f6;
      }
      
      .ds-sidebar-tab.ds-tab-active {
        color: #4d6bfe;
        border-bottom-color: #4d6bfe;
        background: #fff;
      }
      
      .ds-sidebar-content {
        flex: 1;
        overflow: auto;
      }
      
      .ds-panel {
        display: none;
        height: 100%;
      }
      
      .ds-panel.ds-panel-visible {
        display: block;
      }
      
      .ds-file-tree {
        padding: 8px;
      }
      
      .ds-file-item {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        gap: 8px;
      }
      
      .ds-file-item:hover {
        background: #f3f4f6;
      }
      
      .ds-file-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }
      
      .ds-file-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .ds-file-size {
        font-size: 11px;
        color: #9ca3af;
      }
      
      .ds-log-list {
        padding: 8px;
      }
      
      .ds-log-item {
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 8px;
        font-size: 12px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
      }
      
      .ds-log-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      
      .ds-log-type {
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
      }
      
      .ds-log-type.read_file { background: #dbeafe; color: #1d4ed8; }
      .ds-log-type.write_file { background: #dcfce7; color: #16a34a; }
      .ds-log-type.execute { background: #fef3c7; color: #d97706; }
      .ds-log-type.delete { background: #fee2e2; color: #dc2626; }
      
      .ds-log-time {
        font-size: 11px;
        color: #9ca3af;
      }
      
      .ds-log-path {
        font-family: monospace;
        background: #e5e7eb;
        padding: 2px 6px;
        border-radius: 4px;
        word-break: break-all;
      }
      
      .ds-log-content {
        margin-top: 8px;
        max-height: 100px;
        overflow: auto;
        background: #1f2937;
        color: #d1d5db;
        padding: 8px;
        border-radius: 6px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre-wrap;
      }
      
      .ds-preview-frame {
        width: 100%;
        height: 100%;
        border: none;
        background: #fff;
      }
      
      .ds-preview-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #9ca3af;
        text-align: center;
        padding: 20px;
      }
      
      .ds-preview-placeholder svg {
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }
      
      .ds-toast {
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        animation: ds-toast-in 0.3s ease;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        max-width: 400px;
        text-align: center;
      }
      
      .ds-toast.ds-toast-success { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; }
      .ds-toast.ds-toast-error { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #fff; }
      .ds-toast.ds-toast-warning { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #fff; }
      .ds-toast.ds-toast-info { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #fff; }
      
      @keyframes ds-toast-in {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      
      .ds-status-bar {
        padding: 12px 16px;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
        font-size: 12px;
      }
      
      .ds-status-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
      }
      
      .ds-status-row:last-child {
        margin-bottom: 0;
      }
      
      .ds-status-label {
        color: #6b7280;
      }
      
      .ds-status-value {
        font-weight: 500;
        color: #374151;
      }
      
      .ds-status-value.ds-connected {
        color: #10b981;
      }
      
      .ds-status-value.ds-disconnected {
        color: #ef4444;
      }
      
      /* Dark mode */
      @media (prefers-color-scheme: dark) {
        .ds-agent-sidebar {
          background: #1f2937;
          border-left-color: #374151;
        }
        
        .ds-sidebar-tabs {
          background: #111827;
        }
        
        .ds-sidebar-tab {
          color: #9ca3af;
        }
        
        .ds-sidebar-tab:hover {
          color: #e5e7eb;
          background: #1f2937;
        }
        
        .ds-sidebar-tab.ds-tab-active {
          color: #818cf8;
          border-bottom-color: #818cf8;
          background: #1f2937;
        }
        
        .ds-file-item:hover {
          background: #374151;
        }
        
        .ds-log-item {
          background: #374151;
          border-color: #4b5563;
        }
        
        .ds-status-bar {
          background: #111827;
          border-bottom-color: #374151;
        }
        
        .ds-status-label {
          color: #9ca3af;
        }
        
        .ds-status-value {
          color: #e5e7eb;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Inject Agent button
  function injectAgentButton() {
    var container = document.querySelector('.ec4f5d61') || 
                    document.querySelector('[class*="input-container"]');
    
    if (!container) return;

    var existing = document.querySelector('.ds-agent-wrapper');
    if (existing) existing.remove();

    var attachmentArea = container.querySelector('.bf38813a') ||
                         container.querySelector('[class*="attachment"]');

    var wrapper = document.createElement('div');
    wrapper.className = 'ds-agent-wrapper';
    wrapper.style.cssText = 'display: inline-flex; margin-right: 8px;';

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'ds-agent-toggle-btn';
    button.innerHTML = 
      '<span class="ds-agent-btn-icon">' +
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none">' +
          '<circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>' +
          '<circle cx="8" cy="8" r="2.5" fill="currentColor"/>' +
          '<path d="M8 1.5V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
          '<path d="M8 12V14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
          '<path d="M1.5 8H4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
          '<path d="M12 8H14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>' +
      '</span>' +
      '<span class="ds-agent-btn-text">Agent</span>';

    button.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      toggleAgent();
    });

    wrapper.appendChild(button);
    
    if (attachmentArea && attachmentArea.parentNode) {
      attachmentArea.parentNode.insertBefore(wrapper, attachmentArea);
    } else {
      container.appendChild(wrapper);
    }
  }

  // Inject Sidebar
  function injectSidebar() {
    var existing = document.querySelector('.ds-agent-sidebar');
    if (existing) existing.remove();

    var sidebar = document.createElement('div');
    sidebar.className = 'ds-agent-sidebar';
    sidebar.innerHTML = 
      '<div class="ds-sidebar-resize"></div>' +
      '<div class="ds-sidebar-header">' +
        '<span class="ds-sidebar-title">🤖 Agent Panel</span>' +
        '<button class="ds-sidebar-close">' +
          '<svg width="14" height="14" viewBox="0 0 14 14" fill="none">' +
            '<path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
          '</svg>' +
        '</button>' +
      '</div>' +
      '<div class="ds-sidebar-tabs">' +
        '<div class="ds-sidebar-tab ds-tab-active" data-tab="files">📁 文件</div>' +
        '<div class="ds-sidebar-tab" data-tab="preview">🌐 预览</div>' +
        '<div class="ds-sidebar-tab" data-tab="logs">📋 日志</div>' +
      '</div>' +
      '<div class="ds-status-bar">' +
        '<div class="ds-status-row">' +
          '<span class="ds-status-label">连接</span>' +
          '<span class="ds-status-value ds-disconnected" id="ds-conn-status">未连接</span>' +
        '</div>' +
        '<div class="ds-status-row">' +
          '<span class="ds-status-label">工作目录</span>' +
          '<span class="ds-status-value" id="ds-workspace">-</span>' +
        '</div>' +
        '<div class="ds-status-row">' +
          '<span class="ds-status-label">会话</span>' +
          '<span class="ds-status-value" id="ds-session">-</span>' +
        '</div>' +
      '</div>' +
      '<div class="ds-sidebar-content">' +
        '<div class="ds-panel ds-panel-visible" id="ds-panel-files">' +
          '<div class="ds-file-tree" id="ds-file-tree">' +
            '<div style="padding: 20px; text-align: center; color: #9ca3af;">连接桌面应用后显示文件</div>' +
          '</div>' +
        '</div>' +
        '<div class="ds-panel" id="ds-panel-preview">' +
          '<div class="ds-preview-placeholder" id="ds-preview-placeholder">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
              '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
              '<circle cx="8.5" cy="8.5" r="1.5"/>' +
              '<path d="M21 15l-5-5L5 21"/>' +
            '</svg>' +
            '<div>AI 可通过设置预览地址</div>' +
            '<div style="margin-top: 8px; font-size: 11px;">&lt;preview url="http://..." /&gt;</div>' +
          '</div>' +
          '<iframe class="ds-preview-frame" id="ds-preview-frame" style="display: none;"></iframe>' +
        '</div>' +
        '<div class="ds-panel" id="ds-panel-logs">' +
          '<div class="ds-log-list" id="ds-log-list">' +
            '<div style="padding: 20px; text-align: center; color: #9ca3af;">暂无操作日志</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(sidebar);

    // Tab switching
    sidebar.querySelectorAll('.ds-sidebar-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        activeTab = this.dataset.tab;
        updateTabs();
      });
    });

    // Close button
    sidebar.querySelector('.ds-sidebar-close').addEventListener('click', function() {
      toggleSidebar();
    });

    // Resize handle
    var resizeHandle = sidebar.querySelector('.ds-sidebar-resize');
    var isResizing = false;
    
    resizeHandle.addEventListener('mousedown', function(e) {
      isResizing = true;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    });
    
    document.addEventListener('mousemove', function(e) {
      if (!isResizing) return;
      var newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 800) {
        sidebarWidth = newWidth;
        sidebar.style.width = sidebarWidth + 'px';
        saveSettings({ sidebarWidth: sidebarWidth });
      }
    });
    
    document.addEventListener('mouseup', function() {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });
  }

  // Toggle Agent
  function toggleAgent() {
    if (!isConnected) {
      showToast('⚠️ 请先启动 DeepSeek Agent 桌面应用', 'warning');
      return;
    }

    if (!workspaceFolder) {
      showToast('⚠️ 请先在桌面应用中选择工作目录', 'warning');
      return;
    }

    agentEnabled = !agentEnabled;
    saveSettings({ agentEnabled: agentEnabled });
    toggleSidebar();
    applySystemPrompt();
    updateStatus();
  }

  // Toggle sidebar
  function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    var sidebar = document.querySelector('.ds-agent-sidebar');
    if (sidebar) {
      if (sidebarVisible) {
        sidebar.classList.add('ds-sidebar-visible');
        refreshFileList();
      } else {
        sidebar.classList.remove('ds-sidebar-visible');
      }
    }
  }

  // Update status display
  function updateStatus() {
    var btn = document.querySelector('.ds-agent-toggle-btn');
    if (btn) {
      var text = btn.querySelector('.ds-agent-btn-text');
      if (text) {
        if (!isConnected) {
          text.textContent = 'Agent (离线)';
          btn.classList.remove('ds-agent-active');
        } else if (!workspaceFolder) {
          text.textContent = 'Agent';
          btn.classList.remove('ds-agent-active');
        } else {
          text.textContent = 'Agent ✓';
          if (agentEnabled) {
            btn.classList.add('ds-agent-active');
          } else {
            btn.classList.remove('ds-agent-active');
          }
        }
      }
    }

    // Update sidebar status
    var connStatus = document.getElementById('ds-conn-status');
    if (connStatus) {
      if (isConnected) {
        connStatus.textContent = '已连接';
        connStatus.className = 'ds-status-value ds-connected';
      } else {
        connStatus.textContent = '未连接';
        connStatus.className = 'ds-status-value ds-disconnected';
      }
    }

    var workspaceEl = document.getElementById('ds-workspace');
    if (workspaceEl) {
      workspaceEl.textContent = workspaceFolder ? workspaceFolder.split('/').pop() : '-';
    }

    var sessionEl = document.getElementById('ds-session');
    if (sessionEl) {
      sessionEl.textContent = currentSessionId ? currentSessionId.substring(0, 8) + '...' : '-';
    }
  }

  // Update tabs
  function updateTabs() {
    document.querySelectorAll('.ds-sidebar-tab').forEach(function(tab) {
      if (tab.dataset.tab === activeTab) {
        tab.classList.add('ds-tab-active');
      } else {
        tab.classList.remove('ds-tab-active');
      }
    });

    document.querySelectorAll('.ds-panel').forEach(function(panel) {
      if (panel.id === 'ds-panel-' + activeTab) {
        panel.classList.add('ds-panel-visible');
      } else {
        panel.classList.remove('ds-panel-visible');
      }
    });
  }

  // Apply system prompt
  function applySystemPrompt() {
    if (!agentEnabled) return;

    var textarea = document.querySelector('textarea._27c9245') ||
                   document.querySelector('textarea[class*="chat-input"]') ||
                   document.querySelector('textarea[placeholder]');
    
    if (!textarea) return;

    var formattedPrompt = SYSTEM_PROMPT.replace('{workspace}', workspaceFolder || '未设置');
    
    var currentText = textarea.value;
    if (currentText.indexOf('[AGENT SYSTEM]') !== -1) return;

    var promptBlock = '[AGENT SYSTEM - 此消息会被系统处理]\n\n' +
                      formattedPrompt + '\n\n[END AGENT]\n\n';
    
    textarea.value = promptBlock + currentText.replace(/\[AGENT SYSTEM[\s\S]*?\[END AGENT\]\n*/g, '');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.focus();

    showToast('✅ Agent 已激活 - AI 可操作文件和命令', 'success');
  }

  // Refresh file list
  function refreshFileList() {
    if (!isConnected || !currentSessionId || !ws) return;

    ws.send(JSON.stringify({
      type: 'list-session-files',
      sessionId: currentSessionId
    }));
  }

  // Update file list in sidebar
  function updateFileList(files) {
    var container = document.getElementById('ds-file-tree');
    if (!container) return;

    if (!files || files.length === 0) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #9ca3af;">暂无文件</div>';
      return;
    }

    var html = '';
    files.forEach(function(file) {
      var icon = file.type === 'directory' ? '📁' : '📄';
      var size = file.size ? formatSize(file.size) : '';
      html += '<div class="ds-file-item" data-path="' + file.path + '">' +
        '<span class="ds-file-icon">' + icon + '</span>' +
        '<span class="ds-file-name">' + file.name + '</span>' +
        (size ? '<span class="ds-file-size">' + size + '</span>' : '') +
      '</div>';
    });

    container.innerHTML = html;

    // Add click handlers
    container.querySelectorAll('.ds-file-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var path = this.dataset.path;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'read-file', path: path }));
        }
      });
    });
  }

  // Update logs panel
  function updateLogsPanel() {
    var container = document.getElementById('ds-log-list');
    if (!container) return;

    if (actionLogs.length === 0) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #9ca3af;">暂无操作日志</div>';
      return;
    }

    var html = '';
    actionLogs.forEach(function(log) {
      var time = new Date(log.timestamp).toLocaleTimeString();
      html += '<div class="ds-log-item">' +
        '<div class="ds-log-header">' +
          '<span class="ds-log-type ' + log.type + '">' + getActionLabel(log.type) + '</span>' +
          '<span class="ds-log-time">' + time + '</span>' +
        '</div>' +
        '<div class="ds-log-path">' + (log.path || log.command) + '</div>' +
        (log.data ? '<div class="ds-log-content">' + escapeHtml(log.data.substring(0, 500)) + '</div>' : '') +
        (log.error ? '<div class="ds-log-content" style="background: #7f1d1d;">❌ ' + escapeHtml(log.error) + '</div>' : '') +
      '</div>';
    });

    container.innerHTML = html;
  }

  // Update preview panel
  function updatePreviewPanel() {
    var placeholder = document.getElementById('ds-preview-placeholder');
    var frame = document.getElementById('ds-preview-frame');

    if (previewUrl) {
      if (placeholder) placeholder.style.display = 'none';
      if (frame) {
        frame.style.display = 'block';
        frame.src = previewUrl;
      }
    } else {
      if (placeholder) placeholder.style.display = 'flex';
      if (frame) {
        frame.style.display = 'none';
        frame.src = '';
      }
    }
  }

  // Update session info
  function updateSessionInfo() {
    updateStatus();
    if (sidebarVisible && currentSessionId) {
      refreshFileList();
    }
  }

  // Load session info from server
  function loadSessionInfo() {
    // Will be handled by the desktop app
  }

  // Helper functions
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function showToast(message, type) {
    type = type || 'info';
    var existing = document.querySelector('.ds-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'ds-toast ds-toast-' + type;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(function() {
      toast.style.opacity = '0';
      setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
  }

  // Observe page changes
  function observePageChanges() {
    var observer = new MutationObserver(function() {
      if (!document.querySelector('.ds-agent-wrapper')) {
        var container = document.querySelector('.ec4f5d61') || document.querySelector('[class*="input-container"]');
        if (container) {
          injectAgentButton();
        }
      }

      // Get session ID from URL
      var match = window.location.pathname.match(/\/a\/chat\/s\/([a-f0-9-]+)/);
      if (match) {
        currentSessionId = match[1];
        updateSessionInfo();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
