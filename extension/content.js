// DeepSeek Agent Extension - Content Script
// Uses Native Messaging for secure communication with desktop app
// v0.0.1

(function() {
  'use strict';

  // ===================== State =====================
  var isConnected = false;
  var workspaceFolder = null;
  var currentSessionId = null;
  var agentEnabled = false;
  var sidebarWidth = 400;
  var activeTab = 'actions';
  var actionLogs = [];
  var previewUrl = '';
  var isResizing = false;
  var currentTheme = 'light';

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
  function detectTheme() {
    if (document.body.classList.contains('dark')) {
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

  // ===================== Native Messaging Communication =====================
  // Send message to background script which forwards to native host
  function sendNativeMessage(message, callback) {
    chrome.runtime.sendMessage(message, function(response) {
      if (callback) {
        callback(response || {});
      }
    });
  }

  // Handle messages from background script
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log('[DeepSeek Agent] Received message:', message);

    switch (message.type) {
      case 'state':
        workspaceFolder = message.workspace;
        isConnected = !!message.workspace;
        updateStatus();
        break;

      case 'action-result':
        handleActionResult(message);
        break;

      case 'actions-complete':
        console.log('[DeepSeek Agent] All actions completed');
        break;
    }

    sendResponse({ received: true });
    return true;
  });

  // Check connection status
  function checkConnection() {
    sendNativeMessage({ type: 'check-connection' }, function(response) {
      var wasConnected = isConnected;
      isConnected = response.connected || false;
      workspaceFolder = response.workspace || null;
      updateStatus();

      // Try to get state if connected but no workspace
      if (isConnected && !workspaceFolder) {
        sendNativeMessage({ type: 'get-state' });
      }
    });
  }

  // ===================== System Prompt =====================
  var SYSTEM_PROMPT = (function() {
    return '你是一位专业的 AI 编程助手，具备完整的本地开发环境访问能力。\n\n' +
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
  })();

  function getSystemPrompt(workspace) {
    return SYSTEM_PROMPT.replace('{workspace}', workspace || '未设置');
  }

  // Export for external use
  window.DeepSeekAgent = {
    getSystemPrompt: getSystemPrompt,
    isConnected: function() { return isConnected; },
    isEnabled: function() { return agentEnabled; },
    getWorkspace: function() { return workspaceFolder; }
  };

  // ===================== Initialize =====================
  function init() {
    console.log('[DeepSeek Agent] Extension initialized v0.0.1 (Native Messaging)');
    loadSettings();
    checkConnection();
    observePageChanges();
    injectUI();
    setupMessageObserver();
    setupThemeObserver();

    // Periodically check connection
    setInterval(checkConnection, 5000);
  }

  // Load settings from storage
  function loadSettings() {
    try {
      chrome.storage.local.get(['sidebarWidth', 'previewUrl', 'agentEnabled'], function(result) {
        if (result.sidebarWidth) sidebarWidth = result.sidebarWidth;
        if (result.previewUrl) {
          previewUrl = result.previewUrl;
          updatePreviewPanel();
        }
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
    currentTheme = detectTheme();

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes') {
          updateTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTheme);
    }
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
    var executeBtn = card.querySelector('.ds-btn-execute');

    statusEl.className = 'ds-card-status ds-status-running';
    statusEl.textContent = '执行中...';
    executeBtn.disabled = true;

    var command = { type: type };
    Object.assign(command, payload);

    // Send via Native Messaging
    sendNativeMessage({
      type: 'execute-actions',
      sessionId: currentSessionId,
      commands: [command]
    });
  }

  // Handle action result
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

  // Inject dynamic styles
  function injectStyles() {
    if (document.querySelector('#ds-agent-styles')) return;

    var style = document.createElement('style');
    style.id = 'ds-agent-styles';
    style.textContent = `
      .ds-agent-wrapper {
        cursor: pointer;
      }

      .ds-agent-wrapper .ds-icon svg {
        stroke: currentColor;
        stroke-width: 1.5;
        fill: none;
      }

      .ds-agent-sidebar {
        width: ${sidebarWidth}px;
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

      .ds-toast-fade {
        animation: ds-toast-out 0.3s ease forwards;
      }

      @keyframes ds-toast-out {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      }
    `;
    document.head.appendChild(style);
  }

  // Inject Agent button using DeepSeek native styles
  function injectAgentButton() {
    var existing = document.querySelector('.ds-agent-wrapper');
    if (existing) existing.remove();

    var buttonArea = document.querySelector('.ec4f5d61');

    if (!buttonArea) {
      var textarea = document.querySelector('textarea.ds-scroll-area, textarea[placeholder*="DeepSeek"]');
      if (textarea) {
        var grandParent = textarea.parentElement ? textarea.parentElement.parentElement : null;
        if (grandParent) {
          buttonArea = grandParent.querySelector('.ec4f5d61') ||
                       grandParent.nextElementSibling;
        }
      }
    }

    if (!buttonArea) {
      var toggleBtn = document.querySelector('.ds-toggle-button');
      if (toggleBtn) {
        buttonArea = toggleBtn.parentElement;
      }
    }

    if (!buttonArea) {
      console.log('[DeepSeek Agent] Could not find button area, will retry');
      setTimeout(injectAgentButton, 2000);
      return;
    }

    var button = document.createElement('div');
    button.setAttribute('role', 'button');
    button.setAttribute('aria-disabled', 'false');
    button.setAttribute('tabindex', '0');
    button.className = 'ds-agent-wrapper ds-atom-button ds-toggle-button ds-toggle-button--md';
    if (agentEnabled) {
      button.classList.add('ds-toggle-button--selected');
    }
    button.style.cssText = 'transform: translateZ(0px);';

    button.innerHTML =
      '<div class="ds-icon ds-atom-button__icon" style="font-size: 14px; width: 14px; height: 14px; color: var(--dsw-alias-brand-text); margin-right: 0px;">' + Icons.agent + '</div>' +
      '<span><span class="ds-agent-btn-text">Agent</span></span>' +
      '<div class="ds-focus-ring"></div>';

    button.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      toggleAgent();
    });

    button.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleAgent();
      }
    });

    var firstBtn = buttonArea.querySelector('.ds-atom-button, .ds-toggle-button');
    if (firstBtn) {
      buttonArea.insertBefore(button, firstBtn);
    } else {
      buttonArea.insertBefore(button, buttonArea.firstChild);
    }

    console.log('[DeepSeek Agent] Button injected successfully');
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
          '<span id="ds-conn-status" class="ds-status-value ds-disconnected">未连接</span>' +
        '</div>' +
        '<div class="ds-status-row">' +
          '<span class="ds-status-label">工作目录</span>' +
          '<span id="ds-workspace" class="ds-status-value">未设置</span>' +
        '</div>' +
      '</div>' +
      '<div class="ds-sidebar-content">' +
        '<div id="ds-actions-panel" class="ds-panel ds-panel-visible"></div>' +
        '<div id="ds-preview-panel" class="ds-panel"></div>' +
        '<div id="ds-logs-panel" class="ds-panel"></div>' +
      '</div>';

    document.body.appendChild(sidebar);

    // Tab click handlers
    sidebar.querySelectorAll('.ds-sidebar-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        activeTab = tab.dataset.tab;
        updateTabs();
      });
    });

    // Close button
    sidebar.querySelector('.ds-sidebar-close').addEventListener('click', hideSidebar);

    // Resize
    setupResize(sidebar);
  }

  // Setup resize functionality
  function setupResize(sidebar) {
    var resizeHandle = sidebar.querySelector('.ds-sidebar-resize');

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

  // Toggle Agent
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
    var sidebar = document.querySelector('.ds-agent-sidebar');
    if (sidebar) {
      sidebar.classList.add('ds-sidebar-visible');
    }
  }

  // Hide sidebar
  function hideSidebar() {
    var sidebar = document.querySelector('.ds-agent-sidebar');
    if (sidebar) {
      sidebar.classList.remove('ds-sidebar-visible');
    }
  }

  // ===================== Status Updates =====================
  function updateStatus() {
    var btn = document.querySelector('.ds-agent-wrapper');
    if (btn) {
      var text = btn.querySelector('.ds-agent-btn-text');
      if (text) {
        if (!isConnected) {
          text.textContent = 'Agent (离线)';
          btn.classList.remove('ds-toggle-button--selected');
        } else if (!workspaceFolder) {
          text.textContent = 'Agent';
          btn.classList.remove('ds-toggle-button--selected');
        } else {
          text.textContent = 'Agent';
          btn.classList.toggle('ds-toggle-button--selected', agentEnabled);
        }
      }
    }

    var connStatus = document.getElementById('ds-conn-status');
    if (connStatus) {
      connStatus.textContent = isConnected ? '已连接' : '未连接';
      connStatus.className = 'ds-status-value ' + (isConnected ? 'ds-connected' : 'ds-disconnected');
    }

    var workspaceEl = document.getElementById('ds-workspace');
    if (workspaceEl) {
      workspaceEl.textContent = workspaceFolder || '未设置';
      workspaceEl.title = workspaceFolder || '';
    }
  }

  // Update tabs
  function updateTabs() {
    document.querySelectorAll('.ds-sidebar-tab').forEach(function(tab) {
      tab.classList.toggle('ds-tab-active', tab.dataset.tab === activeTab);
    });

    document.querySelectorAll('.ds-panel').forEach(function(panel) {
      panel.classList.remove('ds-panel-visible');
    });

    var activePanel = document.getElementById('ds-' + activeTab + '-panel');
    if (activePanel) {
      activePanel.classList.add('ds-panel-visible');
    }
  }

  // Update logs panel
  function updateLogsPanel() {
    var panel = document.getElementById('ds-logs-panel');
    if (!panel) return;

    if (actionLogs.length === 0) {
      panel.innerHTML = '<div class="ds-log-list"><div style="text-align: center; color: #9ca3af; padding: 40px;">暂无操作日志</div></div>';
      return;
    }

    var html = '<div class="ds-log-list">';
    actionLogs.forEach(function(log) {
      html += '<div class="ds-log-item">' +
        '<div class="ds-log-header">' +
          '<span class="ds-log-type ' + log.type + '">' +
            '<span class="ds-icon">' + getActionIcon(log.type) + '</span>' +
            getActionLabel(log.type) +
          '</span>' +
          '<span class="ds-log-time">' + new Date(log.timestamp).toLocaleTimeString() + '</span>' +
        '</div>' +
        '<div class="ds-log-path">' + escapeHtml(log.path || '') + '</div>';

      if (log.data) {
        html += '<div class="ds-log-content">' + escapeHtml(log.data.substring(0, 200)) + '</div>';
      }

      html += '</div>';
    });
    html += '</div>';

    panel.innerHTML = html;
  }

  // Update preview panel
  function updatePreviewPanel() {
    var panel = document.getElementById('ds-preview-panel');
    if (!panel) return;

    if (!previewUrl) {
      panel.innerHTML = '<div class="ds-preview-placeholder">' +
        '<span class="ds-icon">' + Icons.globe + '</span>' +
        '<div>暂无预览</div>' +
        '<div style="font-size: 12px; margin-top: 8px;">AI 可以使用 &lt;preview url="..." /&gt; 设置预览</div>' +
      '</div>';
      return;
    }

    panel.innerHTML = '<iframe class="ds-preview-frame" src="' + previewUrl + '"></iframe>';
  }

  // ===================== Helpers =====================
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
      toast.classList.add('ds-toast-fade');
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
