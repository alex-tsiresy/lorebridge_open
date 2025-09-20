document.addEventListener('DOMContentLoaded', function() {
  const clipContentBtn = document.getElementById('clipContent');
  const takeScreenshotBtn = document.getElementById('takeScreenshot');
  const clipBothBtn = document.getElementById('clipBoth');
  const exportGroupedBtn = document.getElementById('exportGrouped');
  const statusDiv = document.getElementById('status');
  const platformInfo = document.getElementById('platformInfo');
  const platformName = document.getElementById('platformName');
  const chatOptions = document.getElementById('chatOptions');
  const clipContentText = document.getElementById('clipContentText');
  const clipBothText = document.getElementById('clipBothText');
  
  // Check if current page is a chat platform
  checkChatPlatform();

  function showStatus(message, type = 'success') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  function disableButtons() {
    clipContentBtn.disabled = true;
    takeScreenshotBtn.disabled = true;
    clipBothBtn.disabled = true;
    if (exportGroupedBtn) exportGroupedBtn.disabled = true;
  }

  function enableButtons() {
    clipContentBtn.disabled = false;
    takeScreenshotBtn.disabled = false;
    clipBothBtn.disabled = false;
    if (exportGroupedBtn) exportGroupedBtn.disabled = false;
  }

  async function checkChatPlatform() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        return;
      }

      await ensureContentScript(tab.id);
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'checkChatPlatform' });
      
      if (response && response.success && response.isChat) {
        // Update UI for chat platform
        platformInfo.style.display = 'block';
        platformName.textContent = `📱 ${response.platform.toUpperCase()} detected`;
        chatOptions.style.display = 'block';
        
        // Update button text for chat context
        clipContentText.textContent = 'Export Chat Messages';
        clipBothText.textContent = 'Export Chat + Screenshot';
      }
    } catch (error) {
      logger.log('Could not check chat platform:', error);
    }
  }

  function downloadText(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadImage(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  function generateFilename(type, title) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    return `${cleanTitle}_${timestamp}.${type}`;
  }

  async function ensureContentScript(tabId) {
    try {
      // First try to ping the content script
      await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    } catch (error) {
      // If ping fails, inject the content script
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        // Wait a moment for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (injectError) {
        logger.error('Failed to inject content script:', injectError);
        throw new Error('Cannot access this page. Please refresh and try again.');
      }
    }
  }

  clipContentBtn.addEventListener('click', async function() {
    try {
      disableButtons();
      showStatus('Extracting content...', 'processing');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we can access this tab
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
        showStatus('Cannot access this page type', 'error');
        return;
      }

      // Ensure content script is injected
      await ensureContentScript(tab.id);
      
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
      
      if (response && response.success) {
        const filename = generateFilename('txt', response.data.title);
        let content;
        
        if (response.data.isChat) {
          content = response.data.content; // Already formatted by chat extractor
          showStatus(`Chat exported! ${response.data.messageCount} messages`, 'success');
        } else {
          content = `Title: ${response.data.title}\nURL: ${response.data.url}\n\nContent:\n${response.data.content}`;
          showStatus('Content clipped successfully!', 'success');
        }
        
        downloadText(content, filename);
      } else {
        showStatus('Failed to extract content', 'error');
      }
    } catch (error) {
      logger.error('Error clipping content:', error);
      if (error.message.includes('Could not establish connection')) {
        showStatus('Please refresh the page and try again', 'error');
      } else {
        showStatus('Error occurred while clipping', 'error');
      }
    } finally {
      enableButtons();
    }
  });

  takeScreenshotBtn.addEventListener('click', async function() {
    try {
      disableButtons();
      showStatus('Taking screenshot...', 'processing');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const response = await chrome.runtime.sendMessage({ 
        action: 'takeScreenshot', 
        tabId: tab.id 
      });
      
      if (response && response.success) {
        let title = 'screenshot';
        try {
          // Try to get the title, but don't fail if content script isn't available
          await ensureContentScript(tab.id);
          const titleResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getTitle' });
          if (titleResponse && titleResponse.data) {
            title = titleResponse.data;
          }
        } catch (e) {
          // Fall back to tab title if content script fails
          title = tab.title || 'screenshot';
        }
        
        const filename = generateFilename('png', title);
        downloadImage(response.dataUrl, filename);
        showStatus('Screenshot captured successfully!', 'success');
      } else {
        showStatus('Failed to take screenshot', 'error');
      }
    } catch (error) {
      logger.error('Error taking screenshot:', error);
      showStatus('Error occurred while taking screenshot', 'error');
    } finally {
      enableButtons();
    }
  });

  clipBothBtn.addEventListener('click', async function() {
    try {
      disableButtons();
      showStatus('Clipping content and taking screenshot...', 'processing');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we can access this tab
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
        showStatus('Cannot access this page type', 'error');
        return;
      }

      // Ensure content script is injected
      await ensureContentScript(tab.id);
      
      // Get content
      const contentResponse = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
      
      // Take screenshot
      const screenshotResponse = await chrome.runtime.sendMessage({ 
        action: 'takeScreenshot', 
        tabId: tab.id 
      });
      
      if (contentResponse && contentResponse.success && screenshotResponse && screenshotResponse.success) {
        const title = contentResponse.data.title;
        
        // Download text content
        const textFilename = generateFilename('txt', title);
        let content;
        
        if (contentResponse.data.isChat) {
          content = contentResponse.data.content; // Already formatted by chat extractor
        } else {
          content = `Title: ${title}\nURL: ${contentResponse.data.url}\n\nContent:\n${contentResponse.data.content}`;
        }
        
        downloadText(content, textFilename);
        
        // Download screenshot
        const imageFilename = generateFilename('png', title);
        downloadImage(screenshotResponse.dataUrl, imageFilename);
        
        if (contentResponse.data.isChat) {
          showStatus(`Chat and screenshot saved! ${contentResponse.data.messageCount} messages`, 'success');
        } else {
          showStatus('Content and screenshot saved successfully!', 'success');
        }
      } else {
        showStatus('Failed to complete clipping', 'error');
      }
    } catch (error) {
      logger.error('Error clipping both:', error);
      if (error.message.includes('Could not establish connection')) {
        showStatus('Please refresh the page and try again', 'error');
      } else {
        showStatus('Error occurred during clipping', 'error');
      }
    } finally {
      enableButtons();
    }
  });

  // Export grouped by user functionality
  if (exportGroupedBtn) {
    exportGroupedBtn.addEventListener('click', async function() {
      try {
        disableButtons();
        showStatus('Exporting chat grouped by user...', 'processing');

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          showStatus('Cannot access this page type', 'error');
          return;
        }

        await ensureContentScript(tab.id);
        
        // Get chat data and request grouped format
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
        
        if (response && response.success && response.data.isChat) {
          // Send a message to get grouped format
          const groupedResponse = await chrome.tabs.sendMessage(tab.id, { 
            action: 'extractGroupedChat' 
          });
          
          if (groupedResponse && groupedResponse.success) {
            const filename = generateFilename('txt', response.data.title + '_grouped');
            downloadText(groupedResponse.data.content, filename);
            showStatus(`Grouped chat exported! ${response.data.messageCount} messages`, 'success');
          } else {
            showStatus('Failed to export grouped chat', 'error');
          }
        } else {
          showStatus('This feature is only available for chat platforms', 'error');
        }
      } catch (error) {
        logger.error('Error exporting grouped chat:', error);
        showStatus('Error occurred while exporting', 'error');
      } finally {
        enableButtons();
      }
    });
  }
}); 