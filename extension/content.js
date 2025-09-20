// Content script for extracting webpage content

// Load chat extractors inline to avoid loading issues
function loadChatExtractors() {
  // If already loaded, don't load again
  if (window.ChatExtractors) {
    return Promise.resolve();
  }
  
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.onload = resolve;
    script.onerror = resolve; // Still resolve even if loading fails
    script.src = chrome.runtime.getURL('chat-extractors.js');
    (document.head || document.documentElement).appendChild(script);
    
    // Fallback timeout
    setTimeout(resolve, 500);
  });
}

// Load extractors immediately
loadChatExtractors();

function extractMainContent() {
  // Remove scripts, styles, and other non-content elements
  const elementsToRemove = ['script', 'style', 'nav', 'header', 'footer', 'aside', '.advertisement', '.ad', '.sidebar'];
  
  // Create a clone of the document to avoid modifying the original
  const docClone = document.cloneNode(true);
  
  elementsToRemove.forEach(selector => {
    const elements = docClone.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });

  // Try to find the main content area
  let mainContent = '';
  
  // Priority order for content extraction
  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.main-content',
    '.content',
    '.post-content',
    '.entry-content',
    '#content',
    '#main',
    'body'
  ];

  for (const selector of contentSelectors) {
    const element = docClone.querySelector(selector);
    if (element) {
      mainContent = element.innerText || element.textContent || '';
      if (mainContent.trim().length > 100) { // Ensure we have substantial content
        break;
      }
    }
  }

  // If no substantial content found, extract from body
  if (!mainContent || mainContent.trim().length < 100) {
    mainContent = docClone.body ? (docClone.body.innerText || docClone.body.textContent || '') : '';
  }

  // Clean up the text
  mainContent = mainContent
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n\s*\n/g, '\n') // Remove excessive line breaks
    .trim();

  return mainContent;
}

function extractPageMetadata() {
  const title = document.title || 'Untitled';
  const url = window.location.href;
  const description = document.querySelector('meta[name="description"]')?.content || '';
  const author = document.querySelector('meta[name="author"]')?.content || '';
  const publishDate = document.querySelector('meta[property="article:published_time"]')?.content || 
                     document.querySelector('meta[name="date"]')?.content || '';

  return {
    title,
    url,
    description,
    author,
    publishDate,
    timestamp: new Date().toISOString()
  };
}

function extractDetailedContent() {
  // Check if this is a chat platform first
  if (window.ChatExtractors) {
    const chatData = window.ChatExtractors.extractChatData();
    if (chatData) {
      // Format chat data for export
      const formattedChat = window.ChatExtractors.formatForExport(chatData, {
        includeMetadata: true,
        includeTimestamps: true,
        groupByUser: false
      });
      
      return {
        title: `${chatData.platform} Chat - ${Object.values(chatData.channelInfo)[0] || 'Unknown'}`,
        url: chatData.url,
        content: formattedChat,
        isChat: true,
        platform: chatData.platform,
        messageCount: chatData.messageCount,
        wordCount: formattedChat.split(/\s+/).length,
        characterCount: formattedChat.length,
        extractedAt: chatData.extractedAt
      };
    }
  }
  
  // Fall back to regular content extraction
  const metadata = extractPageMetadata();
  const mainContent = extractMainContent();
  
  // Extract headings for structure
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    .map(h => `${h.tagName}: ${h.textContent.trim()}`)
    .join('\n');

  // Extract lists
  const lists = Array.from(document.querySelectorAll('ul, ol'))
    .map(list => {
      const items = Array.from(list.querySelectorAll('li'))
        .map(li => `- ${li.textContent.trim()}`)
        .join('\n');
      return items;
    })
    .join('\n');

  // Combine all content
  let detailedContent = mainContent;
  
  if (headings) {
    detailedContent = `HEADINGS:\n${headings}\n\nCONTENT:\n${detailedContent}`;
  }
  
  if (lists) {
    detailedContent += `\n\nLISTS:\n${lists}`;
  }

  return {
    ...metadata,
    content: detailedContent,
    isChat: false,
    wordCount: detailedContent.split(/\s+/).length,
    characterCount: detailedContent.length
  };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    // Simple ping to check if content script is active
    sendResponse({ success: true, pong: true });
    return true;
  }
  
  if (request.action === 'extractContent') {
    try {
      const data = extractDetailedContent();
      sendResponse({ success: true, data });
    } catch (error) {
      logger.error('Error extracting content:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'checkChatPlatform') {
    try {
      const platform = window.ChatExtractors ? window.ChatExtractors.detectPlatform() : null;
      sendResponse({ success: true, platform, isChat: !!platform });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  if (request.action === 'extractGroupedChat') {
    try {
      if (window.ChatExtractors) {
        const chatData = window.ChatExtractors.extractChatData();
        if (chatData) {
          const groupedContent = window.ChatExtractors.formatForExport(chatData, {
            includeMetadata: true,
            includeTimestamps: true,
            groupByUser: true // This is the key difference
          });
          
          sendResponse({ 
            success: true, 
            data: { 
              content: groupedContent,
              title: `${chatData.platform} Chat (Grouped) - ${Object.values(chatData.channelInfo)[0] || 'Unknown'}`
            }
          });
        } else {
          sendResponse({ success: false, error: 'No chat data found' });
        }
      } else {
        sendResponse({ success: false, error: 'Chat extractors not available' });
      }
    } catch (error) {
      logger.error('Error extracting grouped chat:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  if (request.action === 'getTitle') {
    try {
      sendResponse({ success: true, data: document.title });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});

// Optional: Add visual feedback when extension is active
function addVisualFeedback() {
  // Check if feedback is already shown to prevent duplicates
  if (document.getElementById('web-clipper-feedback')) {
    return;
  }
  
  const feedback = document.createElement('div');
  feedback.id = 'web-clipper-feedback';
  feedback.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4CAF50;
    color: white;
    padding: 10px 15px;
    border-radius: 5px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  feedback.textContent = 'Web Clipper Ready';
  
  document.body.appendChild(feedback);
  
  setTimeout(() => {
    feedback.style.opacity = '1';
  }, 100);
  
  setTimeout(() => {
    feedback.style.opacity = '0';
    setTimeout(() => feedback.remove(), 300);
  }, 2000);
}

// Mark that content script is loaded to prevent multiple injections
if (!window.webClipperLoaded) {
  window.webClipperLoaded = true;
  
  // Show feedback when content script loads (optional)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addVisualFeedback);
  } else {
    addVisualFeedback();
  }
} 