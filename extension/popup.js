// DeepSeek Agent Extension - Popup Script

// Check connection to desktop app
async function checkConnection() {
  const statusEl = document.getElementById('desktop-status');
  
  try {
    const response = await fetch('http://localhost:3777', {
      method: 'GET',
      mode: 'no-cors',
    });
    
    statusEl.textContent = '已连接 ✓';
    statusEl.className = 'status-value connected';
  } catch (error) {
    statusEl.textContent = '未连接';
    statusEl.className = 'status-value disconnected';
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkConnection();
  
  // Refresh connection status every 5 seconds
  setInterval(checkConnection, 5000);
});
