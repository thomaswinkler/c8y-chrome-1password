# Chrome 1Password Extension

# C8Y Session 1Password Chrome Extension

A Chrome extension that provides a user interface for the [c8y-session-1password](https://github.com/thomaswinkler/c8y-session-1password) native messaging host, allowing you to search and launch Cumulocity IoT sessions stored in 1Password.

## Features

- 🔍 Search 1Password items by vaults, tags, and search terms
- 🚀 One-click session launching with automatic login credential filling
- 💾 Remembers your search preferences (vaults and tags)
- 🔒 Secure communication with native 1Password CLI via native messaging
- 🎨 Clean, modern user interface

## Prerequisites

1. **1Password CLI**: Install the 1Password CLI and ensure it's configured
2. **c8y-session-1password**: Download and install the native messaging host from [thomaswinkler/c8y-session-1password](https://github.com/thomaswinkler/c8y-session-1password)
3. **Chrome Browser**: Chrome or Chromium-based browser

## Installation

### Step 1: Install the Native Messaging Host

1. Download the `c8y-session-1password` executable from the GitHub repository
2. Place it in `/usr/local/bin/c8y-session-1password`
3. Make it executable: `chmod +x /usr/local/bin/c8y-session-1password`

### Step 2: Install the Chrome Extension

1. Clone or download this repository
2. Run the installation script (macOS only):
   ```bash
   ./install.sh
   ```
   
   Or manually install the native messaging host manifest:
   ```bash
   mkdir -p "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
   cp com.your_company.c8y_session.json "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/"
   ```

3. Open Chrome and navigate to `chrome://extensions`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extension directory
6. Note the extension ID displayed in the extension card

### Step 3: Configure the Native Messaging Host

1. Edit the native messaging host manifest file:
   ```bash
   nano "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.your_company.c8y_session.json"
   ```

2. Replace `YOUR_EXTENSION_ID_HERE` with the actual extension ID from Step 2:
   ```json
   {
     "name": "com.your_company.c8y_session",
     "description": "C8Y Session 1Password native messaging host",
     "path": "/usr/local/bin/c8y-session-1password",
     "type": "stdio",
     "allowed_origins": [
       "chrome-extension://YOUR_ACTUAL_EXTENSION_ID_HERE/"
     ]
   }
   ```

## Usage

1. Click the extension icon in Chrome toolbar
2. Enter your search criteria:
   - **Vaults**: Comma-separated list of vault names (e.g., "Employee,Shared")
   - **Tags**: Comma-separated list of tags (e.g., "c8y,dev")
   - **Search**: General search term for item names
3. Click "Search" to query your 1Password items
4. Click on any result to open the URL and automatically fill login credentials

## Architecture

The extension consists of four main components:

### 1. Manifest (manifest.json)
- Defines extension permissions and configuration
- Specifies native messaging, storage, tabs, and scripting permissions
- Configures the popup and background service worker

### 2. Popup (popup.html/popup.js)
- User interface for search criteria input
- Displays search results with clickable entries
- Manages user preferences in local storage
- Communicates with background script via message passing

### 3. Background Service Worker (background.js)
- Central communication hub between popup and native host
- Manages native messaging connection to c8y-session-1password
- Handles tab creation and script injection for auto-login
- Processes search requests and login actions

### 4. Login Auto-filler (injected script)
- Programmatically injected into target web pages
- Attempts to find and fill username/password fields
- Uses multiple selector strategies for compatibility
- Triggers appropriate DOM events for modern web frameworks

## Message Flow

```
Popup → Background → Native Host → 1Password CLI
  ↑         ↓            ↓
  └─── Search Results ←──┘

Popup → Background → New Tab + Script Injection
              ↓
         Auto-fill Login
```

## Development

### Project Structure
```
├── manifest.json                 # Extension manifest
├── src/
│   ├── popup/
│   │   ├── popup.html           # Popup UI
│   │   ├── popup.js             # Popup logic
│   │   └── popup.css            # Popup styling
│   ├── background.js            # Service worker
│   └── content.js               # Content script (unused)
├── icons/                       # Extension icons
├── com.your_company.c8y_session.json  # Native messaging manifest
└── install.sh                   # Installation script
```

### Building and Testing

1. Make changes to the source files
2. Reload the extension in `chrome://extensions`
3. Test functionality with the popup and background script console logs
4. Debug native messaging issues by checking the host executable directly

### Debugging

- **Extension Console**: Right-click extension → "Inspect popup" or "Inspect views: background page"
- **Native Host**: Test the c8y-session-1password executable directly from command line
- **Page Auto-fill**: Use browser developer tools on target pages to debug script injection

## Security Considerations

- Native messaging provides secure communication between extension and local executable
- Credentials are passed directly from 1Password CLI without storage in the extension
- Script injection occurs only after user action (clicking a search result)
- Extension runs with minimal required permissions

## Troubleshooting

### "Native host has exited" error
- Verify c8y-session-1password executable exists and is executable
- Check the native messaging manifest path and permissions
- Ensure the extension ID in the manifest matches the loaded extension

### Search returns no results
- Verify 1Password CLI is installed and authenticated
- Check that the specified vaults and tags exist
- Test the c8y-session-1password executable directly

### Auto-fill not working
- Check browser console for script injection errors
- Verify the target page has standard login form fields
- Some single-page applications may load forms dynamically

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Related Projects

- [c8y-session-1password](https://github.com/thomaswinkler/c8y-session-1password) - Native messaging host executable
- [1Password CLI](https://1password.com/downloads/command-line/) - Official 1Password command-line tool

## License

This project is licensed under the MIT License. See the LICENSE file for details.