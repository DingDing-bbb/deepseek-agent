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
const fileListEl = document.getElementById('file-list');
const promptCardEl = document.getElementById('prompt-card');
const promptPreviewEl = document.getElementById('prompt-preview');

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
    loadFiles();
    loadPrompt();
  } else {
    folderPathEl.textContent = '点击选择文件夹...';
    folderPathEl.classList.add('empty');
    fileListEl.style.display = 'none';
    promptCardEl.style.display = 'none';
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

// Load files
async function loadFiles() {
  if (!state.workspace) return;

  try {
    const result = await ipcRenderer.invoke('list-files', '.', false);
    if (result.type === 'file-list') {
      renderFiles(result.files);
    }
  } catch (error) {
    console.error('Failed to load files:', error);
  }
}

// Render file list
function renderFiles(files) {
  if (!files || files.length === 0) {
    fileListEl.style.display = 'none';
    return;
  }

  fileListEl.style.display = 'block';
  fileListEl.innerHTML = files.map(function(file) {
    return '<div class="file-item">' +
      '<span class="file-icon">' + (file.type === 'directory' ? '📁' : '📄') + '</span>' +
      '<span class="file-name">' + file.name + '</span>' +
      (file.size ? '<span class="file-size">' + formatSize(file.size) + '</span>' : '') +
    '</div>';
  }).join('');
}

// Format file size
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Load system prompt
async function loadPrompt() {
  if (!state.workspace) return;

  try {
    const prompt = await ipcRenderer.invoke('get-system-prompt');
    if (prompt) {
      promptPreviewEl.textContent = prompt;
      promptCardEl.style.display = 'block';
    }
  } catch (error) {
    console.error('Failed to load prompt:', error);
  }
}

// Event listeners
selectFolderBtn.addEventListener('click', selectFolder);

// Refresh state periodically
setInterval(loadState, 3000);

// Initialize
loadState();
