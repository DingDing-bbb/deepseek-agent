// DeepSeek Agent Extension - Background Service Worker
// Native Messaging Host: com.deepseek.agent

const NATIVE_HOST_NAME = 'com.deepseek.agent';

// Store active connections
let nativePort = null;
let isConnected = false;
let workspaceFolder = null;

// Connect to Native Messaging Host
function connectNative() {
  if (nativePort) {
    return nativePort;
  }

  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    isConnected = true;

    nativePort.onMessage.addListener((message) => {
      console.log('[DeepSeek Agent] Native message received:', message);

      // Handle state update
      if (message.type === 'state') {
        workspaceFolder = message.workspace;
        isConnected = true;

        // Broadcast to content scripts
        broadcastToContent(message);
      }

      // Forward action results to content scripts
      if (message.type === 'action-result' || message.type === 'actions-complete') {
        broadcastToContent(message);
      }
    });

    nativePort.onDisconnect.addListener(() => {
      console.log('[DeepSeek Agent] Native host disconnected');
      isConnected = false;
      nativePort = null;

      // Try to reconnect after 3 seconds
      setTimeout(() => {
        if (!nativePort) {
          connectNative();
        }
      }, 3000);
    });

    return nativePort;
  } catch (error) {
    console.error('[DeepSeek Agent] Failed to connect to native host:', error);
    isConnected = false;
    return null;
  }
}

// Send message to Native Messaging Host
function sendNativeMessage(message) {
  if (!nativePort) {
    connectNative();
  }

  if (nativePort) {
    nativePort.postMessage(message);
    return true;
  }
  return false;
}

// Broadcast message to all content scripts
async function broadcastToContent(message) {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://chat.deepseek.com/*' });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    }
  } catch (error) {
    console.error('[DeepSeek Agent] Broadcast error:', error);
  }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[DeepSeek Agent] Message from content:', message);

  switch (message.type) {
    case 'check-connection':
      sendResponse({
        connected: isConnected,
        workspace: workspaceFolder
      });
      return true;

    case 'get-state':
      sendNativeMessage({ type: 'get-state' });
      sendResponse({ status: 'requesting' });
      return true;

    case 'execute-actions':
    case 'read-file':
    case 'write-file':
    case 'list-files':
    case 'execute':
    case 'list-session-files':
      // Forward to native host
      const sent = sendNativeMessage(message);
      sendResponse({ sent, connected: isConnected });
      return true;

    case 'connect-native':
      const port = connectNative();
      sendResponse({ connected: !!port });
      return true;

    default:
      sendResponse({ error: 'Unknown message type' });
      return true;
  }
});

// Handle messages from Native Messaging Host
chrome.runtime.onConnectNative?.addListener((port) => {
  console.log('[DeepSeek Agent] Native connection established');
});

// Initialize on install
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[DeepSeek Agent] Extension installed v0.0.1');

  // Try to connect to native host
  setTimeout(() => {
    connectNative();
  }, 1000);
});

// Reconnect on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[DeepSeek Agent] Extension started');
  connectNative();
});
