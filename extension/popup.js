// DeepSeek Agent Extension - Popup Script

async function checkConnection() {
  const statusEl = document.getElementById('desktop-status');
  
  try {
    const response = await fetch('http://localhost:3777', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'get-state' }),
    });
    
    if (response.ok) {
      const data = await response.json();
      statusEl.textContent = data.workspace ? '已连接 ✓' : '已连接 (未设置目录)';
      statusEl.className = 'status-value connected';
    } else {
      throw new Error('Connection failed');
    }
  } catch (error) {
    statusEl.textContent = '未连接';
    statusEl.className = 'status-value disconnected';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkConnection();
  setInterval(checkConnection, 5000);
});
