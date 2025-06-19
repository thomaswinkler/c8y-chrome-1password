# Chrome Extension for c8y-session-1password - Development Guidelines

## Project Overview

This is a Google Chrome Extension using Manifest V3 that serves as a user interface for the native messaging host executable `c8y-session-1password`. The extension allows users to search 1Password items by vaults, tags, and search terms, then open URLs with automatic OAuth authentication and credential filling.

## Architecture

### Key Components
- **manifest.json** - Manifest V3 configuration with native messaging, storage, tabs, cookies, and scripting permissions
- **src/popup/** - User interface (HTML/CSS/JS) with search form, results display, and OAuth toggle
- **src/background.js** - Service worker handling native messaging, OAuth authentication, and tab management
- **src/content.js** - Minimal content script (placeholder)
- **icons/** - Extension icons (16px, 48px, 128px)
- **com.cumulocity.c8y_session_1password.json** - Native messaging host manifest

### Flow
1. User provides search criteria in popup
2. Sent via background script to native host (`c8y-session-1password`)
3. Results displayed in popup
4. Clicking result performs OAuth authentication (if enabled) then opens URL in new tab

### OAuth Authentication
- **Service worker context** for OAuth requests
- **Chrome Cookies API** for cookie management
- **Global toggle** to enable/disable automatic OAuth login

## Development Guidelines

### Code Style
- Use ES5 syntax for compatibility (no async/await, arrow functions, template literals)
- Minimal essential logging only
- Error handling with user-friendly messages
- Promise chains instead of async/await

### Message Types
- **SEARCH** - Search 1Password items
- **LOGIN** - Open URL with auto-fill/OAuth
- **SEARCH_RESULTS** - Response with search results
- **SEARCH_ERROR** - Search operation error
- **LOGIN_ERROR** - Login operation error
- **OAUTH_SUCCESS** - OAuth authentication successful
- **OAUTH_ERROR** - OAuth authentication failed

### File Structure
```
src/
├── background.js        # Service worker (native messaging, OAuth, tab management)
├── content.js          # Content script (minimal placeholder)
└── popup/
    ├── popup.html      # Search form UI with OAuth toggle
    ├── popup.css       # Modern responsive styling
    └── popup.js        # Event handling, message passing, OAuth toggle
```

### OAuth Implementation Details
- **CSRF protection** with mandatory two-step handshake
- **Primary CSRF endpoint**: `/apps/devicemanagement/` login page
- **Fallback CSRF endpoint**: `/user/currentUser` API endpoint
- **OAuth endpoint**: Dynamically detected from `/tenant/loginOptions`
- **Cookie management**: Via Chrome Cookies API
- **Error handling**: Graceful degradation to manual login

### Native Messaging
- **Host name**: `com.cumulocity.c8y_session_1password`
- **Executable**: `/usr/local/bin/c8y-session-1password-wrapper`
- **Timeout**: 30 seconds for search operations
- **JSON message format** for requests and responses

## Testing

### Prerequisites
- Chrome extension loaded in developer mode
- 1Password CLI installed and authenticated
- Native messaging host (`c8y-session-1password`) installed
- Cumulocity IoT tenant for OAuth testing

### Testing Steps
1. Load extension in Chrome Developer Mode
2. Check background script console for essential logging only
3. Test search functionality with 1Password items
4. Test OAuth flow with "Enable automatic OAuth login" checkbox
5. Verify target URLs open with automatic authentication

## Security Features

### CSRF Protection
- Mandatory two-step CSRF token acquisition
- Multiple token extraction methods (headers, HTML content)
- Fallback endpoints for token acquisition

### Cookie Security
- Chrome Cookies API for proper browser integration
- Domain isolation and secure attribute handling
- Session persistence across tabs

## Dependencies
- **1Password CLI** (`op` command)
- **Native messaging host** (`c8y-session-1password`)
- **Chrome/Chromium browser** with extensions enabled
- **Cumulocity IoT tenant** for OAuth authentication

## Common Issues
1. **Native Host Not Found** - Verify installation and manifest paths
2. **Permission Errors** - Check manifest.json permissions
3. **OAuth Failures** - Verify CSRF token acquisition and endpoints
4. **Cookie Issues** - Check Chrome Cookies API permissions
5. **Timeout Errors** - Host processing large datasets or auth prompts

## Documentation Structure
- `docs/LoginSummary.md` - Complete OAuth implementation documentation
- `README.md` - User installation and usage instructions
- `manifest.json` - Extension configuration and permissions
- `.github/copilot-instructions.md` - Development guidelines (this file)