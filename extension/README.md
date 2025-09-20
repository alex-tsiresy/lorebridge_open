# Web Clipper Chrome Extension

A powerful web clipper extension that extracts website content and captures screenshots with just one click.

## Features

### 📄 Content Extraction
- Extracts main article content (filters out ads, navigation, etc.)
- Captures page metadata (title, URL, author, description)
- Preserves heading structure and lists
- Outputs detailed text files with timestamps

### 💬 Chat Platform Optimization
- **Intelligent Platform Detection**: Automatically detects Discord, Slack, WhatsApp Web, Microsoft Teams, Telegram, and more
- **Message-Based Extraction**: Extracts individual messages with usernames, timestamps, and reactions
- **Conversation Threading**: Preserves the natural flow of conversations
- **User Grouping**: Option to export messages grouped by user for analysis
- **Metadata Preservation**: Captures channel names, server info, and conversation context

### 📸 Screenshot Capture
- High-quality PNG screenshots of visible webpage area
- Automatic file naming with page title and timestamp
- Works on any webpage

### 📋 Combined Clipping
- Extract content AND take screenshot simultaneously
- Matching file names for easy organization
- One-click solution for complete webpage archiving

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `extension` folder
5. The Web Clipper icon should appear in your toolbar

### From Chrome Web Store
*Coming soon...*

## Usage

### Method 1: Extension Popup
1. Navigate to any webpage or chat platform
2. Click the Web Clipper icon in your browser toolbar
3. Choose your desired action:
   - **📄 Clip Content as Text** (or "Export Chat Messages" for chat platforms)
   - **📸 Take Screenshot**: Capture visible area
   - **📋 Clip Content + Screenshot** (or "Export Chat + Screenshot")
   - **👥 Export by User**: Group chat messages by user (chat platforms only)

### Method 2: Context Menu
1. Right-click anywhere on a webpage
2. Select "Clip page content" or "Take screenshot" from the context menu

## File Output

### Text Files
- Format: `PageTitle_YYYY-MM-DDTHH-MM-SS.txt`
- Contains: Title, URL, content, headings, lists, metadata
- Automatically cleaned and formatted for readability

### Screenshot Files
- Format: `PageTitle_YYYY-MM-DDTHH-MM-SS.png`
- High-quality PNG format
- Captures exactly what you see on screen

### Chat Export Files
- Format: `PlatformName_ChannelName_YYYY-MM-DDTHH-MM-SS.txt`
- Structured format with usernames, timestamps, and message content
- Optional grouping by user for conversation analysis
- Includes platform metadata and conversation context

## Permissions

The extension requires these permissions:
- **activeTab**: Access the current webpage for content extraction
- **storage**: Save user preferences and temporary data
- **tabs**: Take screenshots and manage tab interactions

## Privacy

- Only accesses webpages when you explicitly use the clipper
- No data is sent to external servers
- All processing happens locally in your browser
- Files are downloaded directly to your computer

## Browser Compatibility

- Chrome 88+
- Chromium-based browsers (Edge, Brave, etc.)
- Uses Manifest V3 for future compatibility

## Troubleshooting

### Common Issues

**Content not extracting properly:**
- Works best on article pages, content-focused websites, and supported chat platforms
- Some heavily dynamic sites may require a page refresh
- Protected sites (banking, etc.) may have limited functionality
- Chat platforms may need to load messages before extraction (scroll up to load older messages)

**Screenshot not capturing:**
- Ensure the webpage is fully loaded
- Make sure the tab is active and visible
- Some restricted pages may prevent screenshots

**Downloads not working:**
- Check your browser's download settings
- Ensure popup blockers aren't interfering
- Verify you have write permissions to your downloads folder

### Technical Support

If you encounter persistent issues:
1. Check the browser console for error messages
2. Try disabling and re-enabling the extension
3. Refresh the webpage and try again

## Development

### Project Structure
```
extension/
├── manifest.json       # Extension configuration
├── popup.html         # Extension popup interface
├── popup.js          # Popup functionality
├── content.js        # Content extraction logic
├── chat-extractors.js # Specialized chat platform extractors
├── background.js     # Screenshot handling
├── welcome.html      # Welcome/help page
└── icons/           # Extension icons
```

### Supported Chat Platforms
- **Discord** (discord.com)
- **Slack** (*.slack.com)
- **WhatsApp Web** (web.whatsapp.com)
- **Microsoft Teams** (teams.microsoft.com)
- **Telegram Web** (web.telegram.org)
- **Facebook Messenger** (messenger.com)
- **Google Chat** (chat.google.com)
- **Zoom Chat** (zoom.us/chat)
- **Generic Chat Detection** for unknown platforms

### Building from Source
1. Make any desired modifications to the source files
2. Ensure all files are in the `extension/` directory
3. Load the unpacked extension in Chrome developer mode

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve the extension.

## License

MIT License - see LICENSE file for details 