// Preload script - Exposes safe APIs to renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // State
  getState: () => ipcRenderer.invoke('get-state'),
  getSystemPrompt: () => ipcRenderer.invoke('get-system-prompt'),
  
  // Folder selection
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // File operations
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
  listFiles: (path, recursive) => ipcRenderer.invoke('list-files', path, recursive),
  
  // Command execution
  executeCommand: (command, options) => ipcRenderer.invoke('execute-command', command, options),
});
