/**
 * DeepSeek Agent Extension - Content Script
 * 
 * 职责：
 * 1. 监听 AI 消息，解析 XML 标签
 * 2. 渲染可交互的操作卡片 UI
 * 3. 用户点击执行时发送请求
 * 4. 接收结果并更新 UI
 * 
 * v0.0.1 - Native Messaging 架构
 */

(function() {
  'use strict';

  // ===================== 常量定义 =====================
  const VERSION = '0.0.1';
  const NATIVE_HOST_NAME = 'com.deepseek.agent';
  
  // 操作类型
  const ACTION_TYPES = {
    READ_FILE: 'read_file',
    WRITE_FILE: 'write_file',
    EDIT_FILE: 'edit_file',
    LIST_DIR: 'list_dir',
    DELETE: 'delete',
    EXECUTE: 'execute',
    SEARCH: 'search',
    PREVIEW: 'preview'
  };

  // 操作状态
  const ACTION_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCESS: 'success',
    ERROR: 'error'
  };

  // 错误类型
  const ERROR_TYPES = {
    PERMISSION_DENIED: 'permission_denied',
    FILE_NOT_FOUND: 'file_not_found',
    PATH_INVALID: 'path_invalid',
    COMMAND_FAILED: 'command_failed',
    WORKSPACE_NOT_SET: 'workspace_not_set',
    NOT_CONNECTED: 'not_connected',
    UNKNOWN: 'unknown'
  };

  // ===================== 全局状态 =====================
  let state = {
    isConnected: false,
    workspaceFolder: null,
    currentSessionId: null,
    agentEnabled: false,
    sidebarWidth: 400,
    activeTab: 'actions',
    actionLogs: [],
    previewUrl: '',
    currentTheme: 'light',
    pendingRequests: new Map() // requestId -> { card, resolve, reject }
  };

  let requestIdCounter = 0;

  // ===================== 图标定义 =====================
  const Icons = {
    agent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v10"/><path d="m4.22 4.22 4.24 4.24m7.08 7.08 4.24 4.24"/><path d="M1 12h6m6 0h10"/><path d="m4.22 19.78 4.24-4.24m7.08-7.08 4.24-4.24"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    terminal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    loader: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>'
  };

  // 操作类型配置
  const ACTION_CONFIG = {
    [ACTION_TYPES.READ_FILE]: {
      label: '读取文件',
      icon: Icons.eye,
      color: 'blue',
      description: '读取指定文件的内容'
    },
    [ACTION_TYPES.WRITE_FILE]: {
      label: '写入文件',
      icon: Icons.edit,
      color: 'green',
      description: '创建或覆盖文件'
    },
    [ACTION_TYPES.EDIT_FILE]: {
      label: '编辑文件',
      icon: Icons.edit,
      color: 'amber',
      description: '追加或前置内容到文件'
    },
    [ACTION_TYPES.LIST_DIR]: {
      label: '列出目录',
      icon: Icons.folder,
      color: 'purple',
      description: '列出目录内容'
    },
    [ACTION_TYPES.DELETE]: {
      label: '删除',
      icon: Icons.trash,
      color: 'red',
      description: '删除文件或目录'
    },
    [ACTION_TYPES.EXECUTE]: {
      label: '执行命令',
      icon: Icons.terminal,
      color: 'orange',
      description: '执行 shell 命令'
    },
    [ACTION_TYPES.SEARCH]: {
      label: '搜索文件',
      icon: Icons.search,
      color: 'cyan',
      description: '搜索匹配的文件'
    },
    [ACTION_TYPES.PREVIEW]: {
      label: '设置预览',
      icon: Icons.globe,
      color: 'indigo',
      description: '设置预览 URL'
    }
  };

  // ===================== 工具函数 =====================
  
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeAttr(text) {
    if (!text) return '';
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function generateRequestId() {
    return `req_${Date.now()}_${++requestIdCounter}`;
  }

  function formatTimestamp(isoString) {
    if (!isoString) return new Date().toLocaleString();
    return new Date(isoString).toLocaleString();
  }

  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  function detectTheme() {
    return document.body.classList.contains('dark') ? 'dark' : 'light';
  }

  // ===================== 通信模块 =====================
  
  /**
   * 发送消息到 background script
   * @param {object} message - 消息对象
   * @returns {Promise<object>} - 响应结果
   */
  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response || {});
        }
      });
    });
  }

  /**
   * 检查连接状态
   */
  async function checkConnection() {
    try {
      const response = await sendMessage({ type: 'check-connection' });
      state.isConnected = response.connected || false;
      state.workspaceFolder = response.workspace || null;
      updateStatusUI();
      return response;
    } catch (error) {
      console.error('[DeepSeek Agent] Connection check failed:', error);
      state.isConnected = false;
      updateStatusUI();
      return { connected: false };
    }
  }

  /**
   * 执行操作
   * @param {string} requestId - 请求ID
   * @param {object} action - 操作对象
   * @returns {Promise<object>} - 执行结果
   */
  async function executeAction(requestId, action) {
    const message = {
      type: 'execute-action',
      requestId: requestId,
      sessionId: state.currentSessionId,
      action: action.type,
      params: action.params
    };
    
    return await sendMessage(message);
  }

  // ===================== XML 解析模块 =====================
  
  /**
   * 从 HTML 中解析 XML 标签
   * @param {string} html - HTML 内容
   * @returns {Array<object>} - 解析出的操作列表
   */
  function parseXMLFromHTML(html) {
    const actions = [];
    
    // 正则表达式匹配各种 XML 标签
    const patterns = [
      // <read_file path="xxx" />
      { type: ACTION_TYPES.READ_FILE, regex: /<read_file\s+path=["']([^"']+)["']\s*\/?>/gi, extract: (m) => ({ path: m[1] }) },
      
      // <write_file path="xxx">content</write_file>
      { type: ACTION_TYPES.WRITE_FILE, regex: /<write_file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/write_file>/gi, extract: (m) => ({ path: m[1], content: m[2] }) },
      
      // <edit_file path="xxx" mode="append|prepend">content</edit_file>
      { type: ACTION_TYPES.EDIT_FILE, regex: /<edit_file\s+path=["']([^"']+)["']\s+mode=["']([^"']+)["']\s*>([\s\S]*?)<\/edit_file>/gi, extract: (m) => ({ path: m[1], mode: m[2], content: m[3] }) },
      
      // <list_dir path="xxx" />
      { type: ACTION_TYPES.LIST_DIR, regex: /<list_dir\s+path=["']([^"']+)["']\s*\/?>/gi, extract: (m) => ({ path: m[1] }) },
      
      // <delete path="xxx" />
      { type: ACTION_TYPES.DELETE, regex: /<delete\s+path=["']([^"']+)["']\s*\/?>/gi, extract: (m) => ({ path: m[1] }) },
      
      // <execute command="xxx" />
      { type: ACTION_TYPES.EXECUTE, regex: /<execute\s+command=["']([^"']+)["']\s*\/?>/gi, extract: (m) => ({ command: m[1] }) },
      
      // <search pattern="xxx" path="yyy" />
      { type: ACTION_TYPES.SEARCH, regex: /<search\s+pattern=["']([^"']+)["']\s+path=["']([^"']+)["']\s*\/?>/gi, extract: (m) => ({ pattern: m[1], path: m[2] }) },
      
      // <preview url="xxx" />
      { type: ACTION_TYPES.PREVIEW, regex: /<preview\s+url=["']([^"']+)["']\s*\/?>/gi, extract: (m) => ({ url: m[1] }) }
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(html)) !== null) {
        actions.push({
          type: pattern.type,
          params: pattern.extract(match),
          rawXML: match[0]
        });
      }
    }

    return actions;
  }

  // ===================== UI 渲染模块 =====================
  
  /**
   * 创建操作卡片
   * @param {object} action - 操作对象
   * @returns {HTMLElement} - 卡片元素
   */
  function createActionCard(action) {
    const config = ACTION_CONFIG[action.type];
    if (!config) return null;

    const requestId = generateRequestId();
    const card = document.createElement('div');
    card.className = `ds-action-card ds-card-${config.color}`;
    card.dataset.requestId = requestId;
    card.dataset.type = action.type;
    card.dataset.status = ACTION_STATUS.PENDING;

    // 构建参数显示
    let paramsHtml = '';
    if (action.params.path) {
      paramsHtml += `<div class="ds-card-param"><span class="ds-param-label">路径:</span> <code>${escapeHtml(action.params.path)}</code></div>`;
    }
    if (action.params.command) {
      paramsHtml += `<div class="ds-card-param"><span class="ds-param-label">命令:</span> <code>${escapeHtml(action.params.command)}</code></div>`;
    }
    if (action.params.pattern) {
      paramsHtml += `<div class="ds-card-param"><span class="ds-param-label">模式:</span> <code>${escapeHtml(action.params.pattern)}</code></div>`;
    }
    if (action.params.mode) {
      paramsHtml += `<div class="ds-card-param"><span class="ds-param-label">模式:</span> <code>${escapeHtml(action.params.mode)}</code></div>`;
    }
    if (action.params.url) {
      paramsHtml += `<div class="ds-card-param"><span class="ds-param-label">URL:</span> <code>${escapeHtml(action.params.url)}</code></div>`;
    }
    if (action.params.content) {
      const preview = action.params.content.length > 100 
        ? action.params.content.substring(0, 100) + '...' 
        : action.params.content;
      paramsHtml += `<div class="ds-card-param ds-param-content"><span class="ds-param-label">内容:</span><pre>${escapeHtml(preview)}</pre></div>`;
    }

    card.innerHTML = `
      <div class="ds-card-header">
        <span class="ds-card-icon">${config.icon}</span>
        <span class="ds-card-title">${config.label}</span>
        <span class="ds-card-status ds-status-pending">待执行</span>
      </div>
      <div class="ds-card-body">${paramsHtml}</div>
      <div class="ds-card-footer">
        <button class="ds-btn ds-btn-execute">执行</button>
        <button class="ds-btn ds-btn-copy">复制 XML</button>
      </div>
      <div class="ds-card-result" style="display:none;"></div>
    `;

    // 绑定事件
    const executeBtn = card.querySelector('.ds-btn-execute');
    const copyBtn = card.querySelector('.ds-btn-copy');

    executeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleExecuteClick(card, action);
    });

    copyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(action.rawXML).then(() => {
        showToast('已复制到剪贴板', 'success');
      });
    });

    return card;
  }

  /**
   * 更新卡片状态
   * @param {HTMLElement} card - 卡片元素
   * @param {string} status - 状态
   * @param {object} result - 结果数据
   */
  function updateCardStatus(card, status, result = null) {
    const statusEl = card.querySelector('.ds-card-status');
    const resultEl = card.querySelector('.ds-card-result');
    const executeBtn = card.querySelector('.ds-btn-execute');
    
    card.dataset.status = status;
    statusEl.className = `ds-card-status ds-status-${status}`;

    switch (status) {
      case ACTION_STATUS.RUNNING:
        statusEl.textContent = '执行中...';
        executeBtn.disabled = true;
        executeBtn.innerHTML = '<span class="ds-spinner"></span> 执行中';
        break;

      case ACTION_STATUS.SUCCESS:
        statusEl.textContent = '成功';
        executeBtn.disabled = false;
        executeBtn.textContent = '重新执行';
        
        if (result) {
          let resultHtml = '<div class="ds-result-success">';
          
          // 显示文件信息
          if (result.timestamp) {
            resultHtml += `<div class="ds-result-info"><span>时间:</span> ${formatTimestamp(result.timestamp)}</div>`;
          }
          if (result.size !== undefined) {
            resultHtml += `<div class="ds-result-info"><span>大小:</span> ${formatFileSize(result.size)}</div>`;
          }
          if (result.md5) {
            resultHtml += `<div class="ds-result-info"><span>MD5:</span> <code>${result.md5}</code></div>`;
          }
          
          // 显示内容
          if (result.data) {
            const content = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
            const truncated = content.length > 500 ? content.substring(0, 500) + '\n...(已截断)' : content;
            resultHtml += `<pre>${escapeHtml(truncated)}</pre>`;
          }
          
          resultHtml += '</div>';
          resultEl.innerHTML = resultHtml;
          resultEl.style.display = 'block';
        }
        break;

      case ACTION_STATUS.ERROR:
        statusEl.textContent = '失败';
        executeBtn.disabled = false;
        executeBtn.textContent = '重试';
        
        if (result) {
          let errorHtml = '<div class="ds-result-error">';
          
          // 错误类型
          const errorMessages = {
            [ERROR_TYPES.PERMISSION_DENIED]: '权限不足，无法访问该路径',
            [ERROR_TYPES.FILE_NOT_FOUND]: '文件或目录不存在',
            [ERROR_TYPES.PATH_INVALID]: '路径格式无效',
            [ERROR_TYPES.COMMAND_FAILED]: '命令执行失败',
            [ERROR_TYPES.WORKSPACE_NOT_SET]: '请先在桌面应用中设置工作目录',
            [ERROR_TYPES.NOT_CONNECTED]: '请先启动 DeepSeek Agent 桌面应用',
            [ERROR_TYPES.UNKNOWN]: '未知错误'
          };
          
          const errorType = result.errorType || ERROR_TYPES.UNKNOWN;
          resultHtml += `<div class="ds-error-type">${errorMessages[errorType] || result.error}</div>`;
          
          if (result.errorDetail) {
            resultHtml += `<div class="ds-error-detail">${escapeHtml(result.errorDetail)}</div>`;
          }
          
          errorHtml += '</div>';
          resultEl.innerHTML = errorHtml;
          resultEl.style.display = 'block';
        }
        break;
    }
  }

  /**
   * 处理执行按钮点击
   */
  async function handleExecuteClick(card, action) {
    // 检查连接
    if (!state.isConnected) {
      showToast('请先启动 DeepSeek Agent 桌面应用', 'error');
      updateCardStatus(card, ACTION_STATUS.ERROR, {
        errorType: ERROR_TYPES.NOT_CONNECTED,
        error: '桌面应用未运行'
      });
      return;
    }

    if (!state.workspaceFolder) {
      showToast('请先在桌面应用中设置工作目录', 'error');
      updateCardStatus(card, ACTION_STATUS.ERROR, {
        errorType: ERROR_TYPES.WORKSPACE_NOT_SET,
        error: '工作目录未设置'
      });
      return;
    }

    const requestId = card.dataset.requestId;
    
    // 更新状态为执行中
    updateCardStatus(card, ACTION_STATUS.RUNNING);

    try {
      const result = await executeAction(requestId, action);
      
      if (result.success) {
        updateCardStatus(card, ACTION_STATUS.SUCCESS, result);
        showToast('操作成功', 'success');
        
        // 添加到日志
        addActionLog(action, true, result);
      } else {
        updateCardStatus(card, ACTION_STATUS.ERROR, result);
        showToast('操作失败: ' + (result.error || '未知错误'), 'error');
        
        // 添加到日志
        addActionLog(action, false, result);
      }
    } catch (error) {
      updateCardStatus(card, ACTION_STATUS.ERROR, {
        errorType: ERROR_TYPES.UNKNOWN,
        error: error.message
      });
      showToast('通信错误: ' + error.message, 'error');
    }
  }

  /**
   * 渲染消息中的 XML 卡片
   * @param {HTMLElement} container - 消息容器
   */
  function renderMessageCards(container) {
    const html = container.innerHTML;
    const actions = parseXMLFromHTML(html);

    if (actions.length === 0) return;

    let processed = html;
    
    // 为每个操作创建卡片并替换原始 XML
    for (const action of actions) {
      const card = createActionCard(action);
      if (card) {
        // 创建临时容器获取卡片 HTML
        const temp = document.createElement('div');
        temp.appendChild(card);
        processed = processed.replace(action.rawXML, temp.innerHTML);
      }
    }

    if (processed !== html) {
      container.innerHTML = processed;
      // 重新绑定事件（因为 innerHTML 会丢失事件）
      container.querySelectorAll('.ds-action-card').forEach(card => {
        const action = actions.find(a => card.querySelector('.ds-card-title')?.textContent === ACTION_CONFIG[a.type]?.label);
        if (!action) return;

        const executeBtn = card.querySelector('.ds-btn-execute');
        const copyBtn = card.querySelector('.ds-btn-copy');

        if (executeBtn && !executeBtn.dataset.bound) {
          executeBtn.dataset.bound = 'true';
          executeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleExecuteClick(card, action);
          });
        }

        if (copyBtn && !copyBtn.dataset.bound) {
          copyBtn.dataset.bound = 'true';
          copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            navigator.clipboard.writeText(action.rawXML).then(() => {
              showToast('已复制到剪贴板', 'success');
            });
          });
        }
      });
    }
  }

  // ===================== 消息监听 =====================
  
  // 监听来自 background 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[DeepSeek Agent] Received:', message.type);

    switch (message.type) {
      case 'state':
        state.isConnected = !!message.workspace;
        state.workspaceFolder = message.workspace;
        updateStatusUI();
        break;

      case 'action-result':
        handleActionResult(message);
        break;

      case 'check-connection-result':
        state.isConnected = message.connected;
        state.workspaceFolder = message.workspace;
        updateStatusUI();
        break;
    }

    sendResponse({ received: true });
    return true;
  });

  /**
   * 处理操作结果（用于异步响应）
   */
  function handleActionResult(result) {
    const card = document.querySelector(`[data-request-id="${result.requestId}"]`);
    
    if (card) {
      if (result.success) {
        updateCardStatus(card, ACTION_STATUS.SUCCESS, result);
        showToast('操作成功', 'success');
      } else {
        updateCardStatus(card, ACTION_STATUS.ERROR, result);
        showToast('操作失败: ' + (result.error || '未知错误'), 'error');
      }
      
      addActionLog(
        { type: result.actionType, params: { path: result.path, command: result.command } },
        result.success,
        result
      );
    }
  }

  // ===================== 日志模块 =====================
  
  function addActionLog(action, success, result) {
    const log = {
      id: Date.now(),
      type: action.type,
      params: action.params,
      success: success,
      timestamp: new Date().toISOString(),
      result: result
    };

    state.actionLogs.unshift(log);
    if (state.actionLogs.length > 100) {
      state.actionLogs.pop();
    }

    updateLogsPanel();
  }

  function updateLogsPanel() {
    const panel = document.getElementById('ds-logs-panel');
    if (!panel) return;

    if (state.actionLogs.length === 0) {
      panel.innerHTML = '<div class="ds-empty">暂无操作日志</div>';
      return;
    }

    let html = '<div class="ds-log-list">';
    
    state.actionLogs.forEach(log => {
      const config = ACTION_CONFIG[log.type];
      html += `
        <div class="ds-log-item ${log.success ? 'ds-log-success' : 'ds-log-error'}">
          <div class="ds-log-header">
            <span class="ds-log-icon">${config?.icon || Icons.file}</span>
            <span class="ds-log-title">${config?.label || log.type}</span>
            <span class="ds-log-time">${formatTimestamp(log.timestamp)}</span>
          </div>
          <div class="ds-log-path">${escapeHtml(log.params.path || log.params.command || '')}</div>
        </div>
      `;
    });

    html += '</div>';
    panel.innerHTML = html;
  }

  // ===================== UI 组件 =====================
  
  function showToast(message, type = 'info') {
    const existing = document.querySelector('.ds-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `ds-toast ds-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('ds-toast-fade');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function updateStatusUI() {
    // 更新按钮状态
    const btn = document.querySelector('.ds-agent-wrapper');
    if (btn) {
      const text = btn.querySelector('.ds-agent-btn-text');
      if (text) {
        text.textContent = state.isConnected && state.workspaceFolder ? 'Agent' : 'Agent (离线)';
        btn.classList.toggle('ds-toggle-button--selected', state.agentEnabled && state.isConnected);
      }
    }

    // 更新侧边栏状态
    const connStatus = document.getElementById('ds-conn-status');
    if (connStatus) {
      connStatus.textContent = state.isConnected ? '已连接' : '未连接';
      connStatus.className = `ds-status-value ${state.isConnected ? 'ds-connected' : 'ds-disconnected'}`;
    }

    const workspaceEl = document.getElementById('ds-workspace');
    if (workspaceEl) {
      workspaceEl.textContent = state.workspaceFolder || '未设置';
      workspaceEl.title = state.workspaceFolder || '';
    }
  }

  function toggleAgent() {
    if (!state.isConnected) {
      showToast('请先启动 DeepSeek Agent 桌面应用', 'error');
      return;
    }

    if (!state.workspaceFolder) {
      showToast('请先在桌面应用中设置工作目录', 'error');
      return;
    }

    state.agentEnabled = !state.agentEnabled;
    chrome.storage.local.set({ agentEnabled: state.agentEnabled });

    const sidebar = document.querySelector('.ds-agent-sidebar');
    if (sidebar) {
      sidebar.classList.toggle('ds-sidebar-visible', state.agentEnabled);
    }

    if (state.agentEnabled) {
      showToast('Agent 已激活', 'success');
      processExistingMessages();
    }

    updateStatusUI();
  }

  function processExistingMessages() {
    document.querySelectorAll('[class*="message-content"], [class*="markdown"], .ds-markdown').forEach(container => {
      if (!container.dataset.dsProcessed) {
        renderMessageCards(container);
        container.dataset.dsProcessed = 'true';
      }
    });
  }

  // ===================== 消息监听器 =====================
  
  function setupMessageObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1 && state.agentEnabled) {
            const containers = node.querySelectorAll 
              ? node.querySelectorAll('[class*="message-content"], [class*="markdown"], .ds-markdown')
              : [];
            containers.forEach(container => {
              if (!container.dataset.dsProcessed) {
                renderMessageCards(container);
                container.dataset.dsProcessed = 'true';
              }
            });
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ===================== Agent 按钮 =====================
  
  function injectAgentButton() {
    const existing = document.querySelector('.ds-agent-wrapper');
    if (existing) return;

    // 查找按钮区域
    let buttonArea = document.querySelector('.ec4f5d61');
    if (!buttonArea) {
      const textarea = document.querySelector('textarea.ds-scroll-area, textarea[placeholder*="DeepSeek"]');
      if (textarea) {
        const parent = textarea.parentElement?.parentElement;
        buttonArea = parent?.querySelector('.ec4f5d61') || parent?.nextElementSibling;
      }
    }

    if (!buttonArea) {
      buttonArea = document.querySelector('.ds-toggle-button')?.parentElement;
    }

    if (!buttonArea) {
      setTimeout(injectAgentButton, 2000);
      return;
    }

    const button = document.createElement('div');
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.className = 'ds-agent-wrapper ds-atom-button ds-toggle-button ds-toggle-button--md';
    if (state.agentEnabled) {
      button.classList.add('ds-toggle-button--selected');
    }

    button.innerHTML = `
      <div class="ds-icon ds-atom-button__icon">${Icons.agent}</div>
      <span class="ds-agent-btn-text">Agent</span>
    `;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleAgent();
    });

    const firstBtn = buttonArea.querySelector('.ds-atom-button, .ds-toggle-button');
    buttonArea.insertBefore(button, firstBtn || buttonArea.firstChild);
  }

  // ===================== 侧边栏 =====================
  
  function injectSidebar() {
    const existing = document.querySelector('.ds-agent-sidebar');
    if (existing) return;

    const sidebar = document.createElement('div');
    sidebar.className = `ds-agent-sidebar${state.currentTheme === 'dark' ? ' ds-dark' : ''}`;
    
    sidebar.innerHTML = `
      <div class="ds-sidebar-resize"></div>
      <div class="ds-sidebar-header">
        <span class="ds-sidebar-title">
          <span class="ds-icon">${Icons.agent}</span>
          Agent Panel
        </span>
        <button class="ds-sidebar-close">${Icons.close}</button>
      </div>
      <div class="ds-sidebar-tabs">
        <div class="ds-sidebar-tab ds-tab-active" data-tab="actions">${Icons.terminal}操作</div>
        <div class="ds-sidebar-tab" data-tab="preview">${Icons.eye}预览</div>
        <div class="ds-sidebar-tab" data-tab="logs">${Icons.list}日志</div>
      </div>
      <div class="ds-status-bar">
        <div class="ds-status-row">
          <span class="ds-status-label">连接</span>
          <span id="ds-conn-status" class="ds-status-value ds-disconnected">未连接</span>
        </div>
        <div class="ds-status-row">
          <span class="ds-status-label">工作目录</span>
          <span id="ds-workspace" class="ds-status-value">未设置</span>
        </div>
      </div>
      <div class="ds-sidebar-content">
        <div id="ds-actions-panel" class="ds-panel ds-panel-visible"></div>
        <div id="ds-preview-panel" class="ds-panel"></div>
        <div id="ds-logs-panel" class="ds-panel"></div>
      </div>
    `;

    document.body.appendChild(sidebar);

    // 绑定标签切换
    sidebar.querySelectorAll('.ds-sidebar-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.activeTab = tab.dataset.tab;
        sidebar.querySelectorAll('.ds-sidebar-tab').forEach(t => 
          t.classList.toggle('ds-tab-active', t === tab));
        sidebar.querySelectorAll('.ds-panel').forEach(p => 
          p.classList.toggle('ds-panel-visible', p.id === `ds-${state.activeTab}-panel`));
      });
    });

    // 绑定关闭按钮
    sidebar.querySelector('.ds-sidebar-close').addEventListener('click', () => {
      sidebar.classList.remove('ds-sidebar-visible');
      state.agentEnabled = false;
    });

    // 设置调整大小
    setupSidebarResize(sidebar);
  }

  function setupSidebarResize(sidebar) {
    const handle = sidebar.querySelector('.ds-sidebar-resize');
    let isResizing = false;

    handle.addEventListener('mousedown', () => {
      isResizing = true;
      document.body.style.cursor = 'ew-resize';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 800) {
        state.sidebarWidth = newWidth;
        sidebar.style.width = newWidth + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        chrome.storage.local.set({ sidebarWidth: state.sidebarWidth });
      }
    });
  }

  // ===================== 主题监听 =====================
  
  function setupThemeObserver() {
    state.currentTheme = detectTheme();

    const observer = new MutationObserver(() => {
      const newTheme = detectTheme();
      if (newTheme !== state.currentTheme) {
        state.currentTheme = newTheme;
        document.querySelector('.ds-agent-sidebar')?.classList.toggle('ds-dark', newTheme === 'dark');
      }
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  // ===================== URL 监听 =====================
  
  function setupUrlObserver() {
    let lastUrl = location.href;
    
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        
        // 提取会话 ID
        const match = location.pathname.match(/\/a\/chat\/s\/([a-f0-9-]+)/);
        state.currentSessionId = match ? match[1] : null;
        
        // 重新注入按钮
        setTimeout(injectAgentButton, 500);
      }
    }, 1000);

    // 初始提取
    const match = location.pathname.match(/\/a\/chat\/s\/([a-f0-9-]+)/);
    state.currentSessionId = match ? match[1] : null;
  }

  // ===================== 初始化 =====================
  
  async function init() {
    console.log(`[DeepSeek Agent] Initializing v${VERSION}`);

    // 加载设置
    chrome.storage.local.get(['sidebarWidth', 'previewUrl', 'agentEnabled'], (result) => {
      if (result.sidebarWidth) state.sidebarWidth = result.sidebarWidth;
      if (result.previewUrl) state.previewUrl = result.previewUrl;
      if (result.agentEnabled) state.agentEnabled = result.agentEnabled;
    });

    // 检查连接
    await checkConnection();

    // 设置监听器
    setupThemeObserver();
    setupUrlObserver();
    setupMessageObserver();

    // 注入 UI
    injectAgentButton();
    injectSidebar();
    updateStatusUI();

    // 定期检查连接
    setInterval(checkConnection, 5000);

    console.log('[DeepSeek Agent] Ready');
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
