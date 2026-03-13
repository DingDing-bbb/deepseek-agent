// DeepSeek Agent Extension - Content Script
// Connects to local Electron app for file access and command execution
// v0.0.1 - Clean UI with soft pastel colors
(function() {
  'use strict';

  // ===================== Configuration =====================
  var WS_PORT = 3777;
  var ws = null;
  var reconnectAttempts = 0;
  var MAX_RECONNECT_ATTEMPTS = 10;
  var RECONNECT_DELAY = 3000;

  // ===================== State =====================
  var isConnected = false;
  var workspaceFolder = null;
  var currentSessionId = null;
  var agentEnabled = false;
  var sidebarVisible = false;
  var sidebarWidth = 400;
  var activeTab = 'actions';
  var actionLogs = [];
  var previewUrl = '';
  var isResizing = false;
  var currentTheme = 'light'; // 'light' or 'dark'

  // ===================== SVG Icons =====================
  var Icons = {
    agent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v10"/><path d="m4.22 4.22 4.24 4.24m7.08 7.08 4.24 4.24"/><path d="M1 12h6m6 0h10"/><path d="m4.22 19.78 4.24-4.24m7.08-7.08 4.24-4.24"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    terminal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>'
  };

  // ===================== Theme Detection =====================
  // TODO: 将由用户指定具体的选择器来检测主题
  // 当前使用备用方案：检测 class 或 data-theme
  function detectTheme() {
    // 方案1: 检测 html 或 body 的 class
    var html = document.documentElement;
    var body = document.body;

    // 常见的深色模式 class
    if (html.classList.contains('dark') ||
        html.classList.contains('theme-dark') ||
        body.classList.contains('dark') ||
        body.classList.contains('theme-dark')) {
      return 'dark';
    }

    // 方案2: 检测 data-theme 属性
    var theme = html.getAttribute('data-theme') ||
                body.getAttribute('data-theme') ||
                html.getAttribute('data-color-mode');
    if (theme === 'dark') return 'dark';

    // 方案3: 检测 prefers-color-scheme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  }

  function updateTheme() {
    var newTheme = detectTheme();
    if (newTheme !== currentTheme) {
      currentTheme = newTheme;
      applyTheme();
    }
  }

  function applyTheme() {
    var sidebar = document.querySelector('.ds-agent-sidebar');
    if (sidebar) {
      sidebar.classList.toggle('ds-dark', currentTheme === 'dark');
    }
  }

  // ===================== System Prompt =====================
  var SYSTEM_PROMPT =
    '你是一位专业的 AI 编程助手，具备完整的本地开发环境访问能力。\n\n' +
    '## 你的能力\n' +
    '你可以通过输出特定的 XML 标签来执行以下操作：\n\n' +
    '### 读取文件\n```xml\n<read_file path="相对或绝对路径" />\n```\n\n' +
    '### 写入文件\n```xml\n<write_file path="文件路径">内容</write_file>\n```\n\n' +
    '### 编辑文件\n```xml\n<edit_file path="文件路径" mode="append|prepend">内容</edit_file>\n```\n\n' +
    '### 列出目录\n```xml\n<list_dir path="目录路径" />\n```\n\n' +
    '### 删除\n```xml\n<delete path="路径" />\n```\n\n' +
    '### 执行命令\n```xml\n<execute command="命令" />\n```\n\n' +
    '### 搜索文件\n```xml\n<search pattern="模式" path="目录" />\n```\n\n' +
    '### 设置预览\n```xml\n<preview url="http://localhost:3000" />\n```\n\n' +
    '## 当前工作目录\n{workspace}\n\n' +
    '## 重要提醒\n- 所有路径支持相对和绝对路径\n- 危险操作会确认\n- 一次可输出多个 XML 标签';

  // ===================== Initialize =====================
  function init() {
    console.log('[DeepSeek Agent] Extension initialized v0.0.1');
    loadSettings();
    connectWebSocket();
    observePageChanges();
    injectUI();
    setupMessageObserver();
    setupThemeObserver();
  }

  // Load settings from storage
  function loadSettings() {
    try {
      chrome.storage.local.get(['sidebarWidth', 'previewUrl', 'agentEnabled'], function(result) {
        if (result.sidebarWidth) sidebarWidth = result.sidebarWidth;
        if (result.previewUrl) previewUrl = result.previewUrl;
        if (result.agentEnabled) agentEnabled = result.agentEnabled;
      });
    } catch (e) {
      console.error('[DeepSeek Agent] Failed to load settings:', e);
    }
  }

  // Save settings
  function saveSettings(settings) {
    try {
      chrome.storage.local.set(settings);
    } catch (e) {
      console.error('[DeepSeek Agent] Failed to save settings:', e);
    }
  }

  // ===================== Theme Observer =====================
  function setupThemeObserver() {
    // 初始检测
    currentTheme = detectTheme();

    // 监听 class 变化
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes') {
          updateTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-color-mode']
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    // 监听系统主题变化
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTheme);
    }
  }

  // ===================== WebSocket Connection =====================
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
        break;

      case 'action-result':
        handleActionResult(message);
        break;

      case 'file-list':
        updateFileList(message.files);
        break;

      case 'file-content':
        showToast('文件内容已获取', 'success');
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
    if (actionLogs.length > 50) actionLogs.pop();

    updateLogsPanel();
    updateActionCard(result);

    if (!result.success) {
      showToast('操作失败: ' + result.error, 'error');
    } else {
      showToast(getActionLabel(result.action) + ' 成功', 'success');
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

  function getActionIcon(action) {
    var iconMap = {
      'read_file': Icons.eye,
      'write_file': Icons.edit,
      'edit_file': Icons.edit,
      'list_dir': Icons.folder,
      'delete': Icons.trash,
      'execute': Icons.terminal,
      'search': Icons.search,
      'preview': Icons.globe
    };
    return iconMap[action] || Icons.file;
  }

  // ===================== Page Observation =====================
  function observePageChanges() {
    function checkSessionFromUrl() {
      var match = window.location.pathname.match(/\/a\/chat\/s\/([a-f0-9-]+)/);
      if (match) {
        currentSessionId = match[1];
        updateStatus();
      }
    }

    checkSessionFromUrl();

    var lastUrl = window.location.href;
    setInterval(function() {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        checkSessionFromUrl();
        setTimeout(injectAgentButton, 500);
      }
    }, 1000);
  }

  // Setup observer for new AI messages
  function setupMessageObserver() {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            processMessageNode(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Process message node to find and render XML
  function processMessageNode(node) {
    if (!agentEnabled) return;

    var messageContents = node.querySelectorAll ?
      node.querySelectorAll('[class*="message-content"], [class*="markdown"], .ds-markdown') :
      [];

    if (messageContents.length === 0 && node.classList) {
      if (node.className && (
        node.className.includes('message-content') ||
        node.className.includes('markdown') ||
        node.classList.contains('ds-markdown')
      )) {
        messageContents = [node];
      }
    }

    messageContents.forEach(function(content) {
      if (!content.dataset.dsProcessed) {
        renderXMLCards(content);
        content.dataset.dsProcessed = 'true';
      }
    });
  }

  // ===================== XML Rendering =====================
  function renderXMLCards(container) {
    var html = container.innerHTML;

    if (html.indexOf('<read_file') === -1 &&
        html.indexOf('<write_file') === -1 &&
        html.indexOf('<edit_file') === -1 &&
        html.indexOf('<list_dir') === -1 &&
        html.indexOf('<delete') === -1 &&
        html.indexOf('<execute') === -1 &&
        html.indexOf('<search') === -1 &&
        html.indexOf('<preview') === -1) {
      return;
    }

    var processed = html;

    processed = processed.replace(/<read_file\s+path=["']([^"']+)["']\s*\/?>/gi, function(match, path) {
      return createActionCard('read_file', { path: path });
    });

    processed = processed.replace(/<write_file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/write_file>/gi, function(match, path, content) {
      return createActionCard('write_file', { path: path, content: content });
    });

    processed = processed.replace(/<edit_file\s+path=["']([^"']+)["']\s+mode=["']([^"']+)["']\s*>([\s\S]*?)<\/edit_file>/gi, function(match, path, mode, content) {
      return createActionCard('edit_file', { path: path, mode: mode, content: content });
    });

    processed = processed.replace(/<list_dir\s+path=["']([^"']+)["']\s*\/?>/gi, function(match, path) {
      return createActionCard('list_dir', { path: path });
    });

    processed = processed.replace(/<delete\s+path=["']([^"']+)["']\s*\/?>/gi, function(match, path) {
      return createActionCard('delete', { path: path });
    });

    processed = processed.replace(/<execute\s+command=["']([^"']+)["']\s*\/?>/gi, function(match, command) {
      return createActionCard('execute', { command: command });
    });

    processed = processed.replace(/<search\s+pattern=["']([^"']+)["']\s+path=["']([^"']+)["']\s*\/?>/gi, function(match, pattern, path) {
      return createActionCard('search', { pattern: pattern, path: path });
    });

    processed = processed.replace(/<preview\s+url=["']([^"']+)["']\s*\/?>/gi, function(match, url) {
      return createActionCard('preview', { url: url });
    });

    if (processed !== html) {
      container.innerHTML = processed;
      attachCardHandlers(container);
    }
  }

  // Create action card HTML
  function createActionCard(type, data) {
    var cardId = 'ds-card-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    var icon = getActionIcon(type);
    var label = getActionLabel(type);

    var colorClass = {
      'read_file': 'blue',
      'write_file': 'green',
      'edit_file': 'amber',
      'list_dir': 'purple',
      'delete': 'red',
      'execute': 'orange',
      'search': 'cyan',
      'preview': 'indigo'
    }[type] || 'gray';

    var detailHtml = '';
    if (data.path) {
      detailHtml += '<div class="ds-card-detail"><span class="ds-card-label">路径:</span> <code>' + escapeHtml(data.path) + '</code></div>';
    }
    if (data.command) {
      detailHtml += '<div class="ds-card-detail"><span class="ds-card-label">命令:</span> <code>' + escapeHtml(data.command) + '</code></div>';
    }
    if (data.pattern) {
      detailHtml += '<div class="ds-card-detail"><span class="ds-card-label">模式:</span> <code>' + escapeHtml(data.pattern) + '</code></div>';
    }
    if (data.mode) {
      detailHtml += '<div class="ds-card-detail"><span class="ds-card-label">模式:</span> <code>' + escapeHtml(data.mode) + '</code></div>';
    }
    if (data.url) {
      detailHtml += '<div class="ds-card-detail"><span class="ds-card-label">URL:</span> <code>' + escapeHtml(data.url) + '</code></div>';
    }
    if (data.content) {
      var preview = data.content.length > 100 ? data.content.substring(0, 100) + '...' : data.content;
      detailHtml += '<div class="ds-card-detail ds-card-content"><span class="ds-card-label">内容:</span><pre>' + escapeHtml(preview) + '</pre></div>';
    }

    return '<div class="ds-action-card ds-card-' + colorClass + '" id="' + cardId + '" data-type="' + type + '" data-payload="' + escapeAttr(JSON.stringify(data)) + '">' +
      '<div class="ds-card-header">' +
        '<span class="ds-card-icon">' + icon + '</span>' +
        '<span class="ds-card-title">' + label + '</span>' +
        '<span class="ds-card-status ds-status-pending">待执行</span>' +
      '</div>' +
      '<div class="ds-card-body">' + detailHtml + '</div>' +
      '<div class="ds-card-footer">' +
        '<button class="ds-card-btn ds-btn-execute">执行</button>' +
        '<button class="ds-card-btn ds-btn-copy">复制</button>' +
      '</div>' +
      '<div class="ds-card-result" style="display:none;"></div>' +
    '</div>';
  }

  // Attach click handlers to cards
  function attachCardHandlers(container) {
    container.querySelectorAll('.ds-action-card').forEach(function(card) {
      var executeBtn = card.querySelector('.ds-btn-execute');
      var copyBtn = card.querySelector('.ds-btn-copy');

      if (executeBtn && !executeBtn.dataset.attached) {
        executeBtn.dataset.attached = 'true';
        executeBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          executeCardAction(card);
        });
      }

      if (copyBtn && !copyBtn.dataset.attached) {
        copyBtn.dataset.attached = 'true';
        copyBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          copyCardXML(card);
        });
      }
    });
  }

  // Execute action from card
  function executeCardAction(card) {
    if (!isConnected) {
      showToast('请先启动 DeepSeek Agent 桌面应用', 'warning');
      return;
    }

    if (!workspaceFolder) {
      showToast('请先在桌面应用中选择工作目录', 'warning');
      return;
    }

    var type = card.dataset.type;
    var payload = JSON.parse(card.dataset.payload);
    var statusEl = card.querySelector('.ds-card-status');
    var resultEl = card.querySelector('.ds-card-result');
    var executeBtn = card.querySelector('.ds-btn-execute');

    statusEl.className = 'ds-card-status ds-status-running';
    statusEl.textContent = '执行中...';
    executeBtn.disabled = true;

    var command = { type: type };
    Object.assign(command, payload);

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'execute-actions',
        sessionId: currentSessionId,
        commands: [command]
      }));
    }
  }

  // Update action card with result
  function updateActionCard(result) {
    document.querySelectorAll('.ds-action-card').forEach(function(card) {
      var type = card.dataset.type;
      var payload = JSON.parse(card.dataset.payload);

      var matches = false;
      if (result.path && payload.path === result.path) matches = true;
      if (result.command && payload.command === result.command) matches = true;

      if (matches && result.action === type) {
        var statusEl = card.querySelector('.ds-card-status');
        var resultEl = card.querySelector('.ds-card-result');
        var executeBtn = card.querySelector('.ds-btn-execute');

        if (result.success) {
          statusEl.className = 'ds-card-status ds-status-success';
          statusEl.textContent = '成功';
          resultEl.innerHTML = '<div class="ds-result-success">' +
            (result.data ? '<pre>' + escapeHtml(result.data.substring(0, 500)) + '</pre>' : '') +
          '</div>';
        } else {
          statusEl.className = 'ds-card-status ds-status-error';
          statusEl.textContent = '失败';
          resultEl.innerHTML = '<div class="ds-result-error">' + escapeHtml(result.error) + '</div>';
        }

        resultEl.style.display = 'block';
        executeBtn.disabled = false;
      }
    });
  }

  // Copy card XML
  function copyCardXML(card) {
    var type = card.dataset.type;
    var payload = JSON.parse(card.dataset.payload);
    var xml = generateXML(type, payload);

    navigator.clipboard.writeText(xml).then(function() {
      showToast('已复制到剪贴板', 'success');
    }).catch(function() {
      showToast('复制失败', 'error');
    });
  }

  // Generate XML from type and payload
  function generateXML(type, data) {
    switch (type) {
      case 'read_file':
        return '<read_file path="' + data.path + '" />';
      case 'write_file':
        return '<write_file path="' + data.path + '">' + data.content + '</write_file>';
      case 'edit_file':
        return '<edit_file path="' + data.path + '" mode="' + data.mode + '">' + data.content + '</edit_file>';
      case 'list_dir':
        return '<list_dir path="' + data.path + '" />';
      case 'delete':
        return '<delete path="' + data.path + '" />';
      case 'execute':
        return '<execute command="' + data.command + '" />';
      case 'search':
        return '<search pattern="' + data.pattern + '" path="' + data.path + '" />';
      case 'preview':
        return '<preview url="' + data.url + '" />';
      default:
        return '';
    }
  }

  // ===================== UI Injection =====================
  function injectUI() {
    injectStyles();
    injectAgentButton();
    injectSidebar();
    updateStatus();
    console.log('[DeepSeek Agent] UI injected successfully');
  }

  // Inject all styles
  function injectStyles() {
    if (document.querySelector('#ds-agent-styles')) return;

    var style = document.createElement('style');
    style.id = 'ds-agent-styles';
    style.textContent = `
      /* Agent Button */
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
        height: 36px;
        font-size: 14px;
        font-weight: 500;
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid #e5e7eb;
        background: #fff;
        color: #374151;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .ds-agent-toggle-btn:hover {
        border-color: #d1d5db;
        background: #f9fafb;
      }

      .ds-agent-toggle-btn.ds-agent-active {
        border-color: #4d6bfe;
        background: linear-gradient(135deg, #4d6bfe 0%, #6366f1 100%);
        color: #fff;
      }

      .ds-agent-toggle-btn .ds-icon {
        width: 16px;
        height: 16px;
      }

      /* Sidebar */
      .ds-agent-sidebar {
        position: fixed;
        top: 0;
        right: 0;
        height: 100vh;
        width: ${sidebarWidth}px;
        background: #fafafa;
        border-left: 1px solid #e5e7eb;
        box-shadow: -4px 0 20px rgba(0, 0, 0, 0.08);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
        background: #fff;
        color: #374151;
      }

      .ds-sidebar-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        font-weight: 600;
      }

      .ds-sidebar-title .ds-icon {
        width: 18px;
        height: 18px;
        color: #4d6bfe;
      }

      .ds-sidebar-close {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: none;
        background: #f3f4f6;
        color: #6b7280;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .ds-sidebar-close:hover {
        background: #e5e7eb;
        color: #374151;
      }

      .ds-sidebar-close .ds-icon {
        width: 14px;
        height: 14px;
      }

      .ds-sidebar-tabs {
        display: flex;
        border-bottom: 1px solid #e5e7eb;
        background: #fff;
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
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .ds-sidebar-tab .ds-icon {
        width: 14px;
        height: 14px;
      }

      .ds-sidebar-tab:hover {
        color: #374151;
        background: #f9fafb;
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

      /* Status Bar */
      .ds-status-bar {
        padding: 12px 16px;
        background: #fff;
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
        color: #9ca3af;
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

      /* Action Cards - 淡白色系，低饱和度 */
      .ds-action-card {
        margin: 12px 0;
        border-radius: 12px;
        border: 1px solid #e5e7eb;
        overflow: hidden;
        background: #fefefe;
        font-size: 13px;
      }

      .ds-card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-bottom: 1px solid #f0f0f0;
      }

      .ds-card-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      .ds-card-title {
        font-weight: 500;
        flex: 1;
        color: #374151;
      }

      .ds-card-status {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 10px;
        font-weight: 500;
      }

      .ds-status-pending {
        background: #f5f5f5;
        color: #9ca3af;
      }

      .ds-status-running {
        background: #f0f7ff;
        color: #3b82f6;
      }

      .ds-status-success {
        background: #f0fdf4;
        color: #22c55e;
      }

      .ds-status-error {
        background: #fef2f2;
        color: #ef4444;
      }

      .ds-card-body {
        padding: 12px 14px;
        background: #fafafa;
      }

      .ds-card-detail {
        margin-bottom: 6px;
      }

      .ds-card-detail:last-child {
        margin-bottom: 0;
      }

      .ds-card-label {
        color: #9ca3af;
        font-size: 11px;
      }

      .ds-card-detail code {
        background: #f0f0f0;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        font-family: ui-monospace, monospace;
        word-break: break-all;
        color: #525252;
      }

      .ds-card-content pre {
        margin: 6px 0 0;
        padding: 8px;
        background: #1f2937;
        color: #e5e7eb;
        border-radius: 6px;
        font-size: 11px;
        overflow-x: auto;
        font-family: ui-monospace, monospace;
      }

      .ds-card-footer {
        display: flex;
        gap: 8px;
        padding: 10px 14px;
        border-top: 1px solid #f0f0f0;
      }

      .ds-card-btn {
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 500;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid #e5e7eb;
        background: #fff;
        color: #374151;
      }

      .ds-card-btn:hover {
        background: #f9fafb;
        border-color: #d1d5db;
      }

      .ds-card-btn.ds-btn-execute {
        background: #4d6bfe;
        color: #fff;
        border-color: #4d6bfe;
      }

      .ds-card-btn.ds-btn-execute:hover {
        background: #4365fe;
      }

      .ds-card-btn.ds-btn-execute:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .ds-card-result {
        padding: 12px 14px;
        border-top: 1px solid #f0f0f0;
      }

      .ds-result-success pre,
      .ds-result-error {
        padding: 8px;
        border-radius: 6px;
        font-size: 12px;
        font-family: ui-monospace, monospace;
      }

      .ds-result-success pre {
        background: #1f2937;
        color: #e5e7eb;
      }

      .ds-result-error {
        background: #fef2f2;
        color: #dc2626;
      }

      /* Card color variants - 淡白色系 */
      .ds-card-blue .ds-card-header { background: #f8fafc; }
      .ds-card-green .ds-card-header { background: #f9fafb; }
      .ds-card-amber .ds-card-header { background: #fefdfb; }
      .ds-card-purple .ds-card-header { background: #faf9fb; }
      .ds-card-red .ds-card-header { background: #fefafa; }
      .ds-card-orange .ds-card-header { background: #fffbf5; }
      .ds-card-cyan .ds-card-header { background: #f5fcfc; }
      .ds-card-indigo .ds-card-header { background: #f7f8fc; }

      .ds-card-blue .ds-card-icon { color: #64748b; }
      .ds-card-green .ds-card-icon { color: #6b7280; }
      .ds-card-amber .ds-card-icon { color: #92702a; }
      .ds-card-purple .ds-card-icon { color: #7c6f8a; }
      .ds-card-red .ds-card-icon { color: #b86b6b; }
      .ds-card-orange .ds-card-icon { color: #a67c52; }
      .ds-card-cyan .ds-card-icon { color: #5f8a8a; }
      .ds-card-indigo .ds-card-icon { color: #6366a0; }

      /* Log List */
      .ds-log-list {
        padding: 8px;
      }

      .ds-log-item {
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 8px;
        font-size: 12px;
        background: #fff;
        border: 1px solid #e5e7eb;
      }

      .ds-log-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .ds-log-type {
        display: flex;
        align-items: center;
        gap: 4px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
      }

      .ds-log-type .ds-icon {
        width: 12px;
        height: 12px;
      }

      .ds-log-type.read_file { background: #f0f7ff; color: #4b5563; }
      .ds-log-type.write_file { background: #f0fdf4; color: #4b5563; }
      .ds-log-type.execute { background: #fefce8; color: #4b5563; }
      .ds-log-type.delete { background: #fef2f2; color: #4b5563; }

      .ds-log-time {
        font-size: 11px;
        color: #9ca3af;
      }

      .ds-log-path {
        font-family: ui-monospace, monospace;
        background: #f5f5f5;
        padding: 4px 8px;
        border-radius: 4px;
        word-break: break-all;
        font-size: 11px;
        color: #525252;
      }

      .ds-log-content {
        margin-top: 8px;
        max-height: 100px;
        overflow: auto;
        background: #1f2937;
        color: #d1d5db;
        padding: 8px;
        border-radius: 6px;
        font-family: ui-monospace, monospace;
        font-size: 11px;
        white-space: pre-wrap;
      }

      /* Preview Frame */
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

      .ds-preview-placeholder .ds-icon {
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      /* File Tree */
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
        background: #f5f5f5;
      }

      .ds-file-item .ds-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        color: #9ca3af;
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

      /* Toast */
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
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        max-width: 400px;
        text-align: center;
      }

      .ds-toast.ds-toast-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
      .ds-toast.ds-toast-error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
      .ds-toast.ds-toast-warning { background: #fefce8; color: #ca8a04; border: 1px solid #fef08a; }
      .ds-toast.ds-toast-info { background: #f0f7ff; color: #2563eb; border: 1px solid #bfdbfe; }

      @keyframes ds-toast-in {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }

      /* ==================== Dark Mode ==================== */
      .ds-agent-sidebar.ds-dark {
        background: #1a1a1a;
        border-left-color: #2a2a2a;
      }

      .ds-agent-sidebar.ds-dark .ds-sidebar-header {
        background: #222;
        border-bottom-color: #2a2a2a;
        color: #e5e5e5;
      }

      .ds-agent-sidebar.ds-dark .ds-sidebar-title .ds-icon {
        color: #818cf8;
      }

      .ds-agent-sidebar.ds-dark .ds-sidebar-close {
        background: #333;
        color: #9ca3af;
      }

      .ds-agent-sidebar.ds-dark .ds-sidebar-close:hover {
        background: #444;
        color: #e5e5e5;
      }

      .ds-agent-sidebar.ds-dark .ds-sidebar-tabs {
        background: #1f1f1f;
        border-bottom-color: #2a2a2a;
      }

      .ds-agent-sidebar.ds-dark .ds-sidebar-tab {
        color: #6b7280;
      }

      .ds-agent-sidebar.ds-dark .ds-sidebar-tab:hover {
        color: #9ca3af;
        background: #282828;
      }

      .ds-agent-sidebar.ds-dark .ds-sidebar-tab.ds-tab-active {
        color: #818cf8;
        border-bottom-color: #818cf8;
        background: #222;
      }

      .ds-agent-sidebar.ds-dark .ds-status-bar {
        background: #1f1f1f;
        border-bottom-color: #2a2a2a;
      }

      .ds-agent-sidebar.ds-dark .ds-status-label {
        color: #6b7280;
      }

      .ds-agent-sidebar.ds-dark .ds-status-value {
        color: #e5e5e5;
      }

      .ds-agent-sidebar.ds-dark .ds-log-item {
        background: #222;
        border-color: #333;
      }

      .ds-agent-sidebar.ds-dark .ds-log-path {
        background: #333;
        color: #a3a3a3;
      }

      .ds-agent-sidebar.ds-dark .ds-file-item:hover {
        background: #282828;
      }

      /* Dark Mode Cards - 深色背景下淡灰色系 */
      .ds-agent-sidebar.ds-dark .ds-action-card {
        background: #222;
        border-color: #333;
      }

      .ds-agent-sidebar.ds-dark .ds-card-header {
        border-bottom-color: #333;
      }

      .ds-agent-sidebar.ds-dark .ds-card-title {
        color: #e5e5e5;
      }

      .ds-agent-sidebar.ds-dark .ds-card-body {
        background: #1f1f1f;
      }

      .ds-agent-sidebar.ds-dark .ds-card-detail code {
        background: #333;
        color: #a3a3a3;
      }

      .ds-agent-sidebar.ds-dark .ds-card-footer {
        border-top-color: #333;
      }

      .ds-agent-sidebar.ds-dark .ds-card-btn {
        background: #333;
        border-color: #444;
        color: #e5e5e5;
      }

      .ds-agent-sidebar.ds-dark .ds-card-btn:hover {
        background: #444;
        border-color: #555;
      }

      .ds-agent-sidebar.ds-dark .ds-card-result {
        border-top-color: #333;
      }

      /* Dark card color variants */
      .ds-agent-sidebar.ds-dark .ds-card-blue .ds-card-header { background: #232629; }
      .ds-agent-sidebar.ds-dark .ds-card-green .ds-card-header { background: #232423; }
      .ds-agent-sidebar.ds-dark .ds-card-amber .ds-card-header { background: #252320; }
      .ds-agent-sidebar.ds-dark .ds-card-purple .ds-card-header { background: #242326; }
      .ds-agent-sidebar.ds-dark .ds-card-red .ds-card-header { background: #262222; }
      .ds-agent-sidebar.ds-dark .ds-card-orange .ds-card-header { background: #262218; }
      .ds-agent-sidebar.ds-dark .ds-card-cyan .ds-card-header { background: #202424; }
      .ds-agent-sidebar.ds-dark .ds-card-indigo .ds-card-header { background: #22223a; }

      .ds-agent-sidebar.ds-dark .ds-card-blue .ds-card-icon { color: #94a3b8; }
      .ds-agent-sidebar.ds-dark .ds-card-green .ds-card-icon { color: #9ca3af; }
      .ds-agent-sidebar.ds-dark .ds-card-amber .ds-card-icon { color: #c4a35a; }
      .ds-agent-sidebar.ds-dark .ds-card-purple .ds-card-icon { color: #a89cb8; }
      .ds-agent-sidebar.ds-dark .ds-card-red .ds-card-icon { color: #c88080; }
      .ds-agent-sidebar.ds-dark .ds-card-orange .ds-card-icon { color: #c49a6c; }
      .ds-agent-sidebar.ds-dark .ds-card-cyan .ds-card-icon { color: #8ab8b8; }
      .ds-agent-sidebar.ds-dark .ds-card-indigo .ds-card-icon { color: #9899c8; }

      /* Dark status */
      .ds-agent-sidebar.ds-dark .ds-status-pending {
        background: #333;
        color: #6b7280;
      }

      .ds-agent-sidebar.ds-dark .ds-status-running {
        background: #1e3a5f;
        color: #60a5fa;
      }

      .ds-agent-sidebar.ds-dark .ds-status-success {
        background: #1a2e1a;
        color: #4ade80;
      }

      .ds-agent-sidebar.ds-dark .ds-status-error {
        background: #2a1a1a;
        color: #f87171;
      }

      /* Dark toast */
      .ds-agent-sidebar.ds-dark .ds-toast.ds-toast-success { background: #1a2e1a; color: #4ade80; border-color: #2d4a2d; }
      .ds-agent-sidebar.ds-dark .ds-toast.ds-toast-error { background: #2a1a1a; color: #f87171; border-color: #4a2d2d; }
      .ds-agent-sidebar.ds-dark .ds-toast.ds-toast-warning { background: #2a2a1a; color: #facc15; border-color: #4a4a2d; }
      .ds-agent-sidebar.ds-dark .ds-toast.ds-toast-info { background: #1a2a3a; color: #60a5fa; border-color: #2d4a5a; }

      /* Dark button */
      .ds-dark .ds-agent-toggle-btn {
        background: #333;
        border-color: #444;
        color: #e5e5e5;
      }

      .ds-dark .ds-agent-toggle-btn:hover {
        background: #444;
      }
    `;
    document.head.appendChild(style);
  }

  // Inject Agent button
  function injectAgentButton() {
    var existing = document.querySelector('.ds-agent-wrapper');
    if (existing) existing.remove();

    var containers = document.querySelectorAll('[class*="input-container"], [class*="chat-input"]');
    var container = null;

    for (var i = 0; i < containers.length; i++) {
      if (containers[i].querySelector('textarea, input[type="text"]')) {
        container = containers[i];
        break;
      }
    }

    if (!container && containers.length > 0) {
      container = containers[0];
    }

    if (!container) {
      console.log('[DeepSeek Agent] Could not find input container, will retry');
      setTimeout(injectAgentButton, 2000);
      return;
    }

    var wrapper = document.createElement('div');
    wrapper.className = 'ds-agent-wrapper';
    wrapper.style.cssText = 'display: inline-flex; margin-right: 8px;';

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'ds-agent-toggle-btn';
    button.innerHTML =
      '<span class="ds-icon">' + Icons.agent + '</span>' +
      '<span class="ds-agent-btn-text">Agent</span>';

    button.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      toggleAgent();
    });

    wrapper.appendChild(button);

    var attachmentArea = container.querySelector('[class*="attachment"]');
    if (attachmentArea && attachmentArea.parentNode) {
      attachmentArea.parentNode.insertBefore(wrapper, attachmentArea);
    } else {
      var actionsArea = container.querySelector('[class*="actions"]');
      if (actionsArea) {
        actionsArea.insertBefore(wrapper, actionsArea.firstChild);
      } else {
        container.appendChild(wrapper);
      }
    }

    console.log('[DeepSeek Agent] Button injected');
  }

  // Inject Sidebar
  function injectSidebar() {
    var existing = document.querySelector('.ds-agent-sidebar');
    if (existing) existing.remove();

    var sidebar = document.createElement('div');
    sidebar.className = 'ds-agent-sidebar' + (currentTheme === 'dark' ? ' ds-dark' : '');
    sidebar.innerHTML =
      '<div class="ds-sidebar-resize"></div>' +
      '<div class="ds-sidebar-header">' +
        '<span class="ds-sidebar-title">' +
          '<span class="ds-icon">' + Icons.agent + '</span>' +
          'Agent Panel' +
        '</span>' +
        '<button class="ds-sidebar-close">' +
          '<span class="ds-icon">' + Icons.close + '</span>' +
        '</button>' +
      '</div>' +
      '<div class="ds-sidebar-tabs">' +
        '<div class="ds-sidebar-tab ds-tab-active" data-tab="actions">' +
          '<span class="ds-icon">' + Icons.terminal + '</span>' +
          '操作' +
        '</div>' +
        '<div class="ds-sidebar-tab" data-tab="preview">' +
          '<span class="ds-icon">' + Icons.eye + '</span>' +
          '预览' +
        '</div>' +
        '<div class="ds-sidebar-tab" data-tab="logs">' +
          '<span class="ds-icon">' + Icons.list + '</span>' +
          '日志' +
        '</div>' +
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
        '<div class="ds-panel ds-panel-visible" id="ds-panel-actions">' +
          '<div class="ds-file-tree" id="ds-action-list">' +
            '<div style="padding: 20px; text-align: center; color: #9ca3af;">启用 Agent 后，AI 回复中的操作命令会显示为可执行的卡片</div>' +
          '</div>' +
        '</div>' +
        '<div class="ds-panel" id="ds-panel-preview">' +
          '<div class="ds-preview-placeholder" id="ds-preview-placeholder">' +
            '<span class="ds-icon">' + Icons.globe + '</span>' +
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
      hideSidebar();
    });

    // Resize handle
    var resizeHandle = sidebar.querySelector('.ds-sidebar-resize');

    resizeHandle.addEventListener('mousedown', function(e) {
      isResizing = true;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
      if (!isResizing) return;
      var newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 800) {
        sidebarWidth = newWidth;
        sidebar.style.width = sidebarWidth + 'px';
      }
    });

    document.addEventListener('mouseup', function() {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        saveSettings({ sidebarWidth: sidebarWidth });
      }
    });
  }

  // ===================== Agent Toggle =====================
  function toggleAgent() {
    if (!isConnected) {
      showToast('请先启动 DeepSeek Agent 桌面应用', 'warning');
      return;
    }

    if (!workspaceFolder) {
      showToast('请先在桌面应用中选择工作目录', 'warning');
      return;
    }

    agentEnabled = !agentEnabled;
    saveSettings({ agentEnabled: agentEnabled });

    if (agentEnabled) {
      showSidebar();
      showToast('Agent 已激活', 'success');
      processExistingMessages();
    } else {
      hideSidebar();
    }

    updateStatus();
  }

  // Process existing messages on the page
  function processExistingMessages() {
    document.querySelectorAll('[class*="message-content"], [class*="markdown"], .ds-markdown').forEach(function(content) {
      if (!content.dataset.dsProcessed) {
        renderXMLCards(content);
        content.dataset.dsProcessed = 'true';
      }
    });
  }

  // Show sidebar
  function showSidebar() {
    sidebarVisible = true;
    var sidebar = document.querySelector('.ds-agent-sidebar');
    if (sidebar) {
      sidebar.classList.add('ds-sidebar-visible');
    }
  }

  // Hide sidebar
  function hideSidebar() {
    sidebarVisible = false;
    var sidebar = document.querySelector('.ds-agent-sidebar');
    if (sidebar) {
      sidebar.classList.remove('ds-sidebar-visible');
    }
  }

  // ===================== Status Updates =====================
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
          text.textContent = agentEnabled ? 'Agent' : 'Agent';
          btn.classList.toggle('ds-agent-active', agentEnabled);
        }
      }
    }

    // Update sidebar status
    var connStatus = document.getElementById('ds-conn-status');
    if (connStatus) {
      connStatus.textContent = isConnected ? '已连接' : '未连接';
      connStatus.className = 'ds-status-value ' + (isConnected ? 'ds-connected' : 'ds-disconnected');
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
      tab.classList.toggle('ds-tab-active', tab.dataset.tab === activeTab);
    });

    document.querySelectorAll('.ds-panel').forEach(function(panel) {
      panel.classList.toggle('ds-panel-visible', panel.id === 'ds-panel-' + activeTab);
    });
  }

  // Update file list
  function updateFileList(files) {
    var container = document.getElementById('ds-file-tree');
    if (!container) return;

    if (!files || files.length === 0) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #9ca3af;">暂无文件</div>';
      return;
    }

    var html = '';
    files.forEach(function(file) {
      var icon = file.type === 'directory' ? Icons.folder : Icons.file;
      var size = file.size ? formatSize(file.size) : '';
      html += '<div class="ds-file-item" data-path="' + escapeHtml(file.path) + '">' +
        '<span class="ds-icon">' + icon + '</span>' +
        '<span class="ds-file-name">' + escapeHtml(file.name) + '</span>' +
        (size ? '<span class="ds-file-size">' + size + '</span>' : '') +
      '</div>';
    });

    container.innerHTML = html;

    container.querySelectorAll('.ds-file-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var path = this.dataset.path;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'read-file', path: path, sessionId: currentSessionId }));
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
      var icon = getActionIcon(log.type);
      html += '<div class="ds-log-item">' +
        '<div class="ds-log-header">' +
          '<span class="ds-log-type ' + log.type + '">' +
            '<span class="ds-icon">' + icon + '</span>' +
            getActionLabel(log.type) +
          '</span>' +
          '<span class="ds-log-time">' + time + '</span>' +
        '</div>' +
        '<div class="ds-log-path">' + escapeHtml(log.path || log.command || '') + '</div>' +
        (log.data ? '<div class="ds-log-content">' + escapeHtml(log.data.substring(0, 500)) + '</div>' : '') +
        (log.error ? '<div class="ds-log-content" style="background: #7f1d1d;">' + escapeHtml(log.error) + '</div>' : '') +
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

  // ===================== Helpers =====================
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeAttr(text) {
    if (!text) return '';
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
      setTimeout(function() {
        if (toast.parentNode) toast.remove();
      }, 300);
    }, 3000);
  }

  // ===================== Initialize =====================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
