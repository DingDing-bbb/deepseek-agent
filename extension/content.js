// DeepSeek Agent Extension - Content Script
// Connects to local Electron app for file access and command execution
(function() {
  'use strict';

  // Configuration
  var WS_PORT = 3777;
  var ws = null;
  var reconnectAttempts = 0;
  var MAX_RECONNECT_ATTEMPTS = 5;
  var RECONNECT_DELAY = 3000;

  // State
  var agentButton = null;
  var isConnected = false;
  var workspaceFolder = null;
  var isProcessing = false;

  // XML-based Agent Protocol
  // AI outputs XML tags to request file/command operations
  // We parse these and send to desktop app for execution

  var SYSTEM_PROMPT = 
    '你是一位专业的 AI 编程助手，具备完整的本地开发环境访问能力。\n\n' +
    
    '## 你的能力\n' +
    '你可以通过输出特定的 XML 标签来执行以下操作：\n\n' +
    
    '### 1. 读取文件\n' +
    '```xml\n' +
    '<read_file path="相对或绝对路径" />\n' +
    '```\n' +
    '示例：\n' +
    '```xml\n' +
    '<read_file path="src/index.ts" />\n' +
    '<read_file path="/home/user/project/package.json" />\n' +
    '```\n\n' +
    
    '### 2. 写入/创建文件\n' +
    '```xml\n' +
    '<write_file path="文件路径">\n' +
    '文件内容写在这里...\n' +
    '</write_file>\n' +
    '```\n' +
    '示例：\n' +
    '```xml\n' +
    '<write_file path="src/utils/helper.ts">\n' +
    'export function formatDate(date: Date): string {\n' +
    '  return date.toLocaleDateString();\n' +
    '}\n' +
    '</write_file>\n' +
    '```\n\n' +
    
    '### 3. 编辑文件（追加内容）\n' +
    '```xml\n' +
    '<edit_file path="文件路径" mode="append">\n' +
    '要追加的内容...\n' +
    '</edit_file>\n' +
    '```\n' +
    'mode 可选值：append（追加）, prepend（前置）\n\n' +
    
    '### 4. 列出目录内容\n' +
    '```xml\n' +
    '<list_dir path="目录路径" />\n' +
    '```\n\n' +
    
    '### 5. 删除文件或目录\n' +
    '```xml\n' +
    '<delete path="路径" />\n' +
    '```\n' +
    '⚠️ 注意：删除操作不可逆，请在执行前确认\n\n' +
    
    '### 6. 执行命令\n' +
    '```xml\n' +
    '<execute command="命令" />\n' +
    '```\n' +
    '示例：\n' +
    '```xml\n' +
    '<execute command="npm install" />\n' +
    '<execute command="git status" />\n' +
    '<execute command="npm run build" />\n' +
    '```\n\n' +
    
    '### 7. 搜索文件\n' +
    '```xml\n' +
    '<search pattern="搜索模式" path="搜索目录" />\n' +
    '```\n' +
    '示例：\n' +
    '```xml\n' +
    '<search pattern="*.ts" path="src" />\n' +
    '```\n\n' +
    
    '## 工作流程\n' +
    '1. 当用户提出需求时，先分析需要哪些文件操作\n' +
    '2. 输出相应的 XML 标签来执行操作\n' +
    '3. 等待系统返回执行结果\n' +
    '4. 根据结果继续下一步操作或给用户反馈\n\n' +
    
    '## 当前工作目录\n' +
    '{workspace}\n\n' +
    
    '## 重要提醒\n' +
    '- 所有路径支持相对路径（相对于工作目录）和绝对路径\n' +
    '- 危险操作（如删除）执行前会提示用户确认\n' +
    '- 一次可以输出多个 XML 标签，系统会按顺序执行\n' +
    '- XML 标签必须单独一行输出，便于解析';

  // Initialize
  function init() {
    console.log('[DeepSeek Agent] Extension initialized');
    connectWebSocket();
    waitAndInsertButton();
    observeAIResponse();
  }

  // Connect to Electron app
  function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) return;

    try {
      ws = new WebSocket('ws://localhost:' + WS_PORT);

      ws.onopen = function() {
        console.log('[DeepSeek Agent] Connected to desktop app');
        isConnected = true;
        reconnectAttempts = 0;
        updateButtonState();
        
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
        workspaceFolder = null;
        updateButtonState();
        
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
        updateButtonState();
        break;
      
      case 'action-result':
        handleActionResult(message);
        break;
    }
  }

  // Handle action execution results
  function handleActionResult(result) {
    isProcessing = false;
    
    if (result.success) {
      // Insert result into chat as a system message
      insertSystemMessage('✅ 操作成功', result.data || '');
    } else {
      insertSystemMessage('❌ 操作失败', result.error || '未知错误');
    }
  }

  // Insert a system message into the chat
  function insertSystemMessage(title, content) {
    var chatContainer = document.querySelector('[class*="chat-messages"]') || 
                        document.querySelector('[class*="message-list"]') ||
                        document.querySelector('main');
    
    if (!chatContainer) {
      console.log('[DeepSeek Agent] Result:', title, content);
      showNotification(title + ': ' + content.substring(0, 50), result.success ? 'success' : 'error');
      return;
    }

    var msgDiv = document.createElement('div');
    msgDiv.className = 'ds-agent-result-message';
    msgDiv.innerHTML = 
      '<div class="ds-agent-result-header">' + title + '</div>' +
      '<div class="ds-agent-result-content"><pre>' + escapeHtml(content) + '</pre></div>';
    
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Wait and insert button with retry
  function waitAndInsertButton() {
    var attempts = 0;
    var maxAttempts = 30;
    
    var interval = setInterval(function() {
      attempts++;
      
      // Try multiple selectors for DeepSeek's button container
      var container = document.querySelector('.ec4f5d61') || 
                      document.querySelector('[class*="input-container"]') ||
                      document.querySelector('[class*="chat-input"]');
      
      if (container && !document.querySelector('.ds-agent-btn-wrapper')) {
        clearInterval(interval);
        insertAgentButton(container);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.log('[DeepSeek Agent] Could not find button container');
      }
    }, 500);
  }

  // Insert Agent button
  function insertAgentButton(container) {
    // Remove any existing button first
    var existing = document.querySelector('.ds-agent-btn-wrapper');
    if (existing) existing.remove();

    // Find insertion point - the attachment button area
    var attachmentArea = container.querySelector('.bf38813a') ||
                         container.querySelector('[class*="attachment"]') ||
                         container.querySelector('button[class*="attach"]');

    // Create wrapper for our button
    var wrapper = document.createElement('div');
    wrapper.className = 'ds-agent-btn-wrapper';
    wrapper.style.cssText = 'display: inline-flex; margin-right: 8px;';

    // Create Agent button
    agentButton = document.createElement('button');
    agentButton.type = 'button';
    agentButton.className = 'ds-agent-toggle-btn';
    agentButton.innerHTML = 
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
      '<span class="ds-agent-btn-text">' + getButtonLabel() + '</span>';

    agentButton.addEventListener('click', handleAgentClick);
    
    wrapper.appendChild(agentButton);
    
    // Insert before attachment area
    if (attachmentArea && attachmentArea.parentNode) {
      attachmentArea.parentNode.insertBefore(wrapper, attachmentArea);
    } else {
      container.appendChild(wrapper);
    }

    updateButtonState();
  }

  // Get button label
  function getButtonLabel() {
    if (!isConnected) return 'Agent (离线)';
    if (!workspaceFolder) return 'Agent';
    return 'Agent ✓';
  }

  // Update button state
  function updateButtonState() {
    if (!agentButton) return;

    var textEl = agentButton.querySelector('.ds-agent-btn-text');
    if (textEl) {
      textEl.textContent = getButtonLabel();
    }

    if (isConnected && workspaceFolder) {
      agentButton.classList.add('ds-agent-active');
    } else {
      agentButton.classList.remove('ds-agent-active');
    }
  }

  // Handle agent button click
  function handleAgentClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!isConnected) {
      showNotification('⚠️ 请先启动 DeepSeek Agent 桌面应用', 'warning');
      return;
    }

    if (!workspaceFolder) {
      showNotification('⚠️ 请先在桌面应用中选择工作目录', 'warning');
      return;
    }

    applySystemPrompt();
  }

  // Apply system prompt
  function applySystemPrompt() {
    var textarea = document.querySelector('textarea._27c9245') ||
                   document.querySelector('textarea[class*="chat-input"]') ||
                   document.querySelector('textarea[placeholder]');
    
    if (!textarea) {
      showNotification('⚠️ 找不到输入框', 'error');
      return;
    }

    var formattedPrompt = SYSTEM_PROMPT.replace('{workspace}', workspaceFolder);
    
    // Check if prompt already exists
    var currentText = textarea.value;
    if (currentText.indexOf('[AGENT SYSTEM PROMPT]') !== -1) {
      showNotification('✅ Agent 已激活', 'success');
      return;
    }

    // Insert as hidden system instruction
    var promptBlock = '[AGENT SYSTEM PROMPT - 此消息会被系统处理，AI将获得文件操作能力]\n\n' +
                      formattedPrompt + '\n\n[END AGENT PROMPT]\n\n';
    
    textarea.value = promptBlock + currentText.replace(/\[AGENT SYSTEM PROMPT[\s\S]*?\[END AGENT PROMPT\]\n*/g, '');
    
    // Trigger React's input handling
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.focus();

    showNotification('✅ Agent 已激活 - AI 现在可以操作文件和执行命令', 'success');
  }

  // Observe AI responses for XML commands
  function observeAIResponse() {
    var observer = new MutationObserver(function(mutations) {
      if (isProcessing) return;
      
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            checkForXMLCommands(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Check for XML commands in AI response
  function checkForXMLCommands(element) {
    if (!isConnected || !workspaceFolder) return;

    // Find AI message content
    var aiMessages = element.querySelectorAll('[class*="assistant"] [class*="content"], ' +
                                              '[class*="message-content"], ' +
                                              '[class*="markdown"]');
    
    if (element.matches) {
      if (element.matches('[class*="assistant"] [class*="content"]') ||
          element.matches('[class*="message-content"]')) {
        aiMessages = [element];
      }
    }

    aiMessages.forEach(function(msg) {
      var text = msg.textContent || msg.innerText;
      parseAndExecuteXML(text, msg);
    });
  }

  // Parse XML commands and execute
  function parseAndExecuteXML(text, element) {
    if (!text || text.indexOf('<') === -1) return;

    var commands = [];
    
    // Parse different XML patterns
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

    // Execute commands
    if (commands.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
      isProcessing = true;
      showNotification('🔧 执行中: ' + commands.length + ' 个操作...', 'info');
      
      ws.send(JSON.stringify({
        type: 'execute-actions',
        commands: commands
      }));
    }
  }

  // Show notification
  function showNotification(message, type) {
    type = type || 'success';
    var existing = document.querySelector('.ds-agent-notification');
    if (existing) existing.remove();

    var notification = document.createElement('div');
    notification.className = 'ds-agent-notification ds-agent-notification-' + type;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(function() {
      notification.classList.add('ds-agent-notification-fade');
      setTimeout(function() {
        notification.remove();
      }, 300);
    }, 2500);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
