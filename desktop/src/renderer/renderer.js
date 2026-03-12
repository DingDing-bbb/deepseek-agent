// DeepSeek Agent Desktop - Renderer Script

const { ipcRenderer } = require('electron');

let state = {
  workspace: null,
  isServerRunning: false,
  clientCount: 0
};

// DOM Elements
const folderPathEl = document.getElementById('folder-path');
const selectFolderBtn = document.getElementById('select-folder-btn');
const clientCountEl = document.getElementById('client-count');
const previewUrlInput = document.getElementById('preview-url');
const savePreviewBtn = document.getElementById('save-preview-btn');
const sessionsCardEl = document.getElementById('sessions-card');
const sessionsListEl = document.getElementById('sessions-list');

// Load initial state
async function loadState() {
  try {
    state = await ipcRenderer.invoke('get-state');
    updateUI();
  } catch (error) {
    console.error('Failed to load state:', error);
  }
}

// Update UI based on state
function updateUI() {
  // Update folder path
  if (state.workspace) {
    folderPathEl.textContent = state.workspace;
    folderPathEl.classList.remove('empty');
    loadSessions();
  } else {
    folderPathEl.textContent = '点击选择工作空间根目录...';
    folderPathEl.classList.add('empty');
    sessionsCardEl.style.display = 'none';
  }

  // Update client count
  clientCountEl.textContent = state.clientCount || 0;
}

// Select folder
async function selectFolder() {
  try {
    const folder = await ipcRenderer.invoke('select-folder');
    if (folder) {
      state.workspace = folder;
      updateUI();
    }
  } catch (error) {
    console.error('Failed to select folder:', error);
  }
}

// Load sessions from workspace
async function loadSessions() {
  if (!state.workspace) return;

  const fs = require('fs');
  const path = require('path');

  try {
    const entries = fs.readdirSync(state.workspace, { withFileTypes: true });
    const sessions = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;

      // Check if it's a UUID-like folder
      const isUUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(entry.name);
      if (!isUUID) continue;

      const sessionPath = path.join(state.workspace, entry.name);
      const stat = fs.statSync(sessionPath);

      // Try to read .directory for metadata
      let title = entry.name.substring(0, 8) + '...';
      const directoryFile = path.join(sessionPath, '.directory');
      if (fs.existsSync(directoryFile)) {
        try {
          const content = fs.readFileSync(directoryFile, 'utf-8');
          const match = content.match(/DeepSeekTitle=(.+)/);
          if (match) title = match[1];
        } catch (e) {}
      }

      sessions.push({
        id: entry.name,
        name: title,
        path: sessionPath,
        modified: stat.mtime
      });
    }

    // Sort by modified time
    sessions.sort((a, b) => b.modified - a.modified);

    if (sessions.length > 0) {
      sessionsCardEl.style.display = 'block';
      renderSessions(sessions);
    } else {
      sessionsCardEl.style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to load sessions:', error);
  }
}

// Render sessions list
function renderSessions(sessions) {
  sessionsListEl.innerHTML = sessions.map(session => {
    const time = session.modified.toLocaleDateString() + ' ' + 
                 session.modified.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    return `
      <div class="session-item">
        <div class="session-icon">💬</div>
        <div class="session-info">
          <div class="session-name">${escapeHtml(session.name)}</div>
          <div class="session-path">${session.id}</div>
        </div>
        <div class="session-time">${time}</div>
      </div>
    `;
  }).join('');
}

// Save preview URL
function savePreviewUrl() {
  const url = previewUrlInput.value.trim();
  // This would be sent to the main process and broadcast to clients
  console.log('Preview URL saved:', url);
}

// Helper
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Event listeners
selectFolderBtn.addEventListener('click', selectFolder);
savePreviewBtn.addEventListener('click', savePreviewUrl);
previewUrlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') savePreviewUrl();
});

// Refresh state periodically
setInterval(loadState, 3000);

// Initialize
loadState();
