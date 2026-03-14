/**
 * DeepSeek Agent Extension - Popup Script
 * 
 * 检查 Native Messaging 连接状态
 */

async function checkConnection() {
  const statusEl = document.getElementById('connection-status');
  const workspaceEl = document.getElementById('workspace-status');

  try {
    const response = await chrome.runtime.sendMessage({ type: 'check-connection' });
    
    if (response.connected) {
      statusEl.textContent = '已连接 ✓';
      statusEl.className = 'status-value connected';
      
      if (response.workspace) {
        workspaceEl.textContent = response.workspace.split('/').pop() || response.workspace.split('\\').pop();
        workspaceEl.title = response.workspace;
      } else {
        workspaceEl.textContent = '已连接 (未设置目录)';
      }
    } else {
      statusEl.textContent = '未连接';
      statusEl.className = 'status-value disconnected';
      workspaceEl.textContent = '未设置';
    }
  } catch (error) {
    console.error('Connection check failed:', error);
    statusEl.textContent = '未连接';
    statusEl.className = 'status-value disconnected';
    workspaceEl.textContent = '未设置';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkConnection();
  setInterval(checkConnection, 5000);
});
