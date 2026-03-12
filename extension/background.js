// DeepSeek Agent Extension - Background Service Worker

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'check-connection') {
    // Check if desktop app is running
    fetch('http://localhost:3777')
      .then(() => sendResponse({ connected: true }))
      .catch(() => sendResponse({ connected: false }));
    return true;
  }
});

// Log when extension is installed
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('DeepSeek Agent extension installed');
  }
});
