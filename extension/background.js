// Background service worker for handling screenshots and other background tasks

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'takeScreenshot') {
    handleScreenshot(request.tabId)
      .then(dataUrl => {
        sendResponse({ success: true, dataUrl });
      })
      .catch(error => {
        logger.error('Screenshot error:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep the message channel open for async response
  }
});

async function handleScreenshot(tabId) {
  try {
    // First, ensure the tab is active and focused
    await chrome.tabs.update(tabId, { active: true });
    
    // Wait a moment for the tab to become active
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Capture the visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });
    
    return dataUrl;
  } catch (error) {
    throw new Error(`Failed to capture screenshot: ${error.message}`);
  }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  // Create context menu items
  chrome.contextMenus.create({
    id: 'clipContent',
    title: 'Clip page content',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'takeScreenshot',
    title: 'Take screenshot',
    contexts: ['page']
  });
  
  if (details.reason === 'install') {
    logger.log('Web Clipper extension installed');
    
    // Show welcome page on first install
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html')
    });
  } else if (details.reason === 'update') {
    logger.log('Web Clipper extension updated');
  }
});

// Note: Content script injection is now handled dynamically in popup.js when needed

// Optional: Add context menu items for quick access
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'clipContent') {
    // Send message to content script to extract content
    chrome.tabs.sendMessage(tab.id, { action: 'extractContent' }, (response) => {
      if (response && response.success) {
        // Store the content for the popup to access
        chrome.storage.local.set({
          lastClippedContent: response.data,
          lastClippedTimestamp: Date.now()
        });
      }
    });
  } else if (info.menuItemId === 'takeScreenshot') {
    handleScreenshot(tab.id).then(dataUrl => {
      // Store the screenshot for the popup to access
      chrome.storage.local.set({
        lastScreenshot: dataUrl,
        lastScreenshotTimestamp: Date.now()
      });
    });
  }
});

// Create context menu items (moved to main onInstalled listener to avoid duplicates) 