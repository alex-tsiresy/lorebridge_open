// Specialized chat extractors for different platforms

const ChatExtractors = {
  // Platform detection based on URL and DOM elements
  detectPlatform() {
    const url = window.location.href.toLowerCase();
    const domain = window.location.hostname.toLowerCase();
    
    if (domain.includes('discord.com')) return 'discord';
    if (domain.includes('slack.com')) return 'slack';
    if (domain.includes('web.whatsapp.com')) return 'whatsapp';
    if (domain.includes('teams.microsoft.com')) return 'teams';
    if (domain.includes('telegram.org') || domain.includes('web.telegram.org')) return 'telegram';
    if (domain.includes('messenger.com')) return 'messenger';
    if (url.includes('chat.google.com')) return 'google-chat';
    if (domain.includes('zoom.us') && url.includes('chat')) return 'zoom';
    
    // Generic chat detection fallback
    const chatIndicators = [
      '[role="log"]', '[role="main"]', '.chat', '.messages', 
      '.conversation', '[data-chat]', '.message-list'
    ];
    
    for (const selector of chatIndicators) {
      if (document.querySelector(selector)) {
        return 'generic';
      }
    }
    
    return null;
  },

  // Discord chat extractor
  discord: {
    getMessages() {
      const messages = [];
      const messageElements = document.querySelectorAll('[id^="chat-messages-"] [class*="message-"]');
      
      messageElements.forEach(msg => {
        try {
          const username = msg.querySelector('[class*="username-"]')?.textContent?.trim() || 'Unknown';
          const timestamp = msg.querySelector('time')?.getAttribute('datetime') || 
                          msg.querySelector('[class*="timestamp-"]')?.textContent?.trim() || '';
          const content = msg.querySelector('[class*="messageContent-"]')?.textContent?.trim() || '';
          const reactions = Array.from(msg.querySelectorAll('[class*="reaction-"]'))
            .map(r => r.textContent.trim()).join(' ');
          
          if (content) {
            messages.push({
              username,
              timestamp,
              content,
              reactions,
              platform: 'Discord'
            });
          }
        } catch (e) {
          logger.warn('Error extracting Discord message:', e);
        }
      });
      
      return messages;
    },
    
    getChannelInfo() {
      const channelName = document.querySelector('[class*="title-"]:not([class*="username-"])')?.textContent?.trim() || 
                         document.querySelector('h1')?.textContent?.trim() || 'Unknown Channel';
      const serverName = document.querySelector('[class*="guild"] [class*="name-"]')?.textContent?.trim() || 'Unknown Server';
      return { channelName, serverName };
    }
  },

  // Slack chat extractor
  slack: {
    getMessages() {
      const messages = [];
      const messageElements = document.querySelectorAll('[data-qa="virtual-list-item"], .c-message_kit__blocks, .c-message');
      
      messageElements.forEach(msg => {
        try {
          const username = msg.querySelector('[data-qa="message_sender_name"], .c-message__sender_link')?.textContent?.trim() || 'Unknown';
          const timestamp = msg.querySelector('[data-qa="message_timestamp"], .c-timestamp')?.textContent?.trim() || '';
          const content = msg.querySelector('[data-qa="message_content"], .c-message__content_text')?.textContent?.trim() || '';
          
          if (content) {
            messages.push({
              username,
              timestamp,
              content,
              platform: 'Slack'
            });
          }
        } catch (e) {
          logger.warn('Error extracting Slack message:', e);
        }
      });
      
      return messages;
    },
    
    getChannelInfo() {
      const channelName = document.querySelector('[data-qa="channel_name"], .p-channel_sidebar__name')?.textContent?.trim() || 'Unknown Channel';
      const workspaceName = document.querySelector('[data-qa="team_name"], .p-ia__sidebar_header__team')?.textContent?.trim() || 'Unknown Workspace';
      return { channelName, workspaceName };
    }
  },

  // WhatsApp Web extractor
  whatsapp: {
    getMessages() {
      const messages = [];
      const messageElements = document.querySelectorAll('[data-id*="message"], .message-in, .message-out');
      
      messageElements.forEach(msg => {
        try {
          const isOutgoing = msg.classList.contains('message-out') || msg.querySelector('[data-icon="msg-check"]');
          const username = isOutgoing ? 'You' : (msg.querySelector('[class*="copyable-text"] span')?.textContent?.trim() || 'Contact');
          const timestamp = msg.querySelector('[data-testid="msg-meta"] span')?.textContent?.trim() || '';
          const content = msg.querySelector('[class*="selectable-text"]')?.textContent?.trim() || '';
          
          if (content) {
            messages.push({
              username,
              timestamp,
              content,
              platform: 'WhatsApp'
            });
          }
        } catch (e) {
          logger.warn('Error extracting WhatsApp message:', e);
        }
      });
      
      return messages;
    },
    
    getChannelInfo() {
      const chatName = document.querySelector('[data-testid="conversation-info-header-chat-title"]')?.textContent?.trim() || 'Unknown Chat';
      return { chatName };
    }
  },

  // Microsoft Teams extractor
  teams: {
    getMessages() {
      const messages = [];
      const messageElements = document.querySelectorAll('[data-tid="message-pane"] [role="listitem"], .ts-message-list-item');
      
      messageElements.forEach(msg => {
        try {
          const username = msg.querySelector('[data-tid="message-author-name"], .ts-message-author-name')?.textContent?.trim() || 'Unknown';
          const timestamp = msg.querySelector('[data-tid="message-timestamp"], .ts-timestamp')?.textContent?.trim() || '';
          const content = msg.querySelector('[data-tid="message-body-content"], .ts-message-body')?.textContent?.trim() || '';
          
          if (content) {
            messages.push({
              username,
              timestamp,
              content,
              platform: 'Microsoft Teams'
            });
          }
        } catch (e) {
          logger.warn('Error extracting Teams message:', e);
        }
      });
      
      return messages;
    },
    
    getChannelInfo() {
      const channelName = document.querySelector('[data-tid="team-channel-name"], .ts-channel-name')?.textContent?.trim() || 'Unknown Channel';
      return { channelName };
    }
  },

  // Generic chat extractor for unknown platforms
  generic: {
    getMessages() {
      const messages = [];
      const selectors = [
        '[role="log"] > *', '.message', '.chat-message', '[data-message]',
        '.conversation-message', '[class*="message"]', '[class*="chat"]'
      ];
      
      let messageElements = [];
      for (const selector of selectors) {
        messageElements = document.querySelectorAll(selector);
        if (messageElements.length > 0) break;
      }
      
      messageElements.forEach((msg, index) => {
        try {
          const text = msg.textContent?.trim();
          if (text && text.length > 10) { // Filter out very short messages
            messages.push({
              username: `User ${index + 1}`,
              timestamp: new Date().toISOString(),
              content: text,
              platform: 'Generic Chat'
            });
          }
        } catch (e) {
          logger.warn('Error extracting generic message:', e);
        }
      });
      
      return messages;
    },
    
    getChannelInfo() {
      const title = document.title || document.querySelector('h1, h2, h3')?.textContent?.trim() || 'Unknown Chat';
      return { title };
    }
  },

  // Main extraction function
  extractChatData() {
    const platform = this.detectPlatform();
    
    if (!platform) {
      return null; // Not a chat platform
    }
    
    const extractor = this[platform] || this.generic;
    const messages = extractor.getMessages();
    const channelInfo = extractor.getChannelInfo();
    
    return {
      platform: platform,
      url: window.location.href,
      extractedAt: new Date().toISOString(),
      messageCount: messages.length,
      channelInfo,
      messages: messages.slice(-100) // Limit to last 100 messages for performance
    };
  },

  // Format chat data for export
  formatForExport(chatData, options = {}) {
    if (!chatData) return null;
    
    const { includeMetadata = true, includeTimestamps = true, groupByUser = false } = options;
    
    let output = '';
    
    if (includeMetadata) {
      output += `Chat Export from ${chatData.platform}\n`;
      output += `URL: ${chatData.url}\n`;
      output += `Extracted: ${new Date(chatData.extractedAt).toLocaleString()}\n`;
      output += `Messages: ${chatData.messageCount}\n`;
      
      if (chatData.channelInfo) {
        Object.entries(chatData.channelInfo).forEach(([key, value]) => {
          output += `${key}: ${value}\n`;
        });
      }
      
      output += '\n' + '='.repeat(50) + '\n\n';
    }
    
    if (groupByUser) {
      const userMessages = {};
      chatData.messages.forEach(msg => {
        if (!userMessages[msg.username]) {
          userMessages[msg.username] = [];
        }
        userMessages[msg.username].push(msg);
      });
      
      Object.entries(userMessages).forEach(([username, messages]) => {
        output += `\n--- ${username} (${messages.length} messages) ---\n\n`;
        messages.forEach(msg => {
          if (includeTimestamps && msg.timestamp) {
            output += `[${msg.timestamp}] `;
          }
          output += `${msg.content}\n`;
          if (msg.reactions) {
            output += `Reactions: ${msg.reactions}\n`;
          }
          output += '\n';
        });
      });
    } else {
      chatData.messages.forEach(msg => {
        if (includeTimestamps && msg.timestamp) {
          output += `[${msg.timestamp}] `;
        }
        output += `${msg.username}: ${msg.content}\n`;
        if (msg.reactions) {
          output += `Reactions: ${msg.reactions}\n`;
        }
        output += '\n';
      });
    }
    
    return output;
  }
};

// Export for use in content script
if (typeof window !== 'undefined') {
  window.ChatExtractors = ChatExtractors;
} 