# OAuth Login Implementation Summary

## Overview
The Chrome extension implements automatic OAuth authentication for Cumulocity IoT using a service worker-based approach with CSRF protection.

## Architecture

### Service Worker OAuth Flow
1. **CSRF Token Acquisition**: Get XSRF token from login page
2. **OAuth Authentication**: Perform OAuth with CSRF protection
3. **Cookie Management**: Set authentication cookies via Chrome Cookies API
4. **URL Opening**: Open target URL with automatic login

### Key Components

#### OAuth Functions (background.js)
- `extractBaseUrl()` - Extract base URL from target URLs
- `checkLoginOptions()` - Query `/tenant/loginOptions` for OAuth2_INTERNAL support
- `getCsrfToken()` - Get CSRF token from `/apps/devicemanagement/` endpoint
- `getCsrfTokenAlternative()` - Fallback CSRF token from `/user/currentUser`
- `performOAuthLogin()` - Main OAuth authentication orchestrator
- `setCookieFromHeader()` - Parse and set cookies from response headers
- `verifyCookiesSet()` - Verify authentication cookies were set correctly

#### User Interface
- **Checkbox**: "Enable automatic OAuth login" toggle in popup
- **Status Messages**: Success/error notifications for OAuth operations
- **Storage Persistence**: Auto-login preference saved to chrome.storage

## OAuth Flow Details

### Step 1: CSRF Protection
```javascript
// Primary method: Get token from login page
const csrfToken = await getCsrfToken(baseUrl);
// Fallback: Get token from current user endpoint
if (!csrfToken) {
    csrfToken = await getCsrfTokenAlternative(baseUrl);
}
```

### Step 2: OAuth Authentication
```javascript
const response = await fetch(oauthUrl, {
    method: 'POST',
    body: new URLSearchParams({
        grant_type: 'PASSWORD',
        username: username,
        password: password
    }),
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-XSRF-TOKEN': csrfToken  // CSRF protection
    },
    credentials: 'include'
});
```

### Step 3: Cookie Management
```javascript
// Extract cookies from response headers
const setCookieHeaders = response.headers.getSetCookie();

// Set each cookie using Chrome Cookies API
for (const cookieHeader of setCookieHeaders) {
    await setCookieFromHeader(baseUrl, cookieHeader);
}
```

## Message Types

### OAuth-Specific Messages
- `OAUTH_SUCCESS` - OAuth authentication completed successfully
- `OAUTH_ERROR` - OAuth authentication failed with error details

### Existing Messages
- `SEARCH` - Search 1Password items
- `LOGIN` - Open URL with auto-fill (now includes OAuth)
- `SEARCH_RESULTS` - Search results from native host
- `SEARCH_ERROR` - Search operation errors

## Security Features

### CSRF Protection
- **Mandatory two-step process**: Always get CSRF token before OAuth
- **Primary endpoint**: `/apps/devicemanagement/` login page
- **Fallback endpoint**: `/user/currentUser` API endpoint
- **Token sources**: Set-Cookie headers and HTML content parsing
- **Header inclusion**: X-XSRF-TOKEN header in OAuth requests

### Cookie Security
- **Chrome Cookies API**: Proper browser cookie management
- **Domain isolation**: Cookies set only for target domain
- **Secure attributes**: Honors secure, httpOnly, path, and domain attributes
- **Session persistence**: Cookies available across all tabs

## Error Handling

### Graceful Degradation
- **OAuth failures**: Falls back to manual login
- **CSRF token missing**: Attempts OAuth without token (may fail)
- **Network errors**: Displays user-friendly error messages
- **Timeout protection**: 30-second timeout for all operations

### Logging Levels
- **Essential**: OAuth success/failure, CSRF token status
- **Minimal**: Error messages and key flow indicators
- **Debug**: Removed verbose debugging logs

## Testing

### Prerequisites
- Chrome extension loaded in developer mode
- Cumulocity IoT tenant accessible
- Valid username/password credentials
- 1Password items with Cumulocity URLs

### Testing Steps
1. **Enable OAuth**: Check "Enable automatic OAuth login" in popup
2. **Search Items**: Use extension to search 1Password items
3. **Click Result**: Click item with OAuth toggle enabled
4. **Monitor Console**: Check background script console for OAuth flow
5. **Verify Login**: Target URL should open automatically logged in

### Success Indicators
- ✅ CSRF token obtained from login page
- ✅ OAuth request includes X-XSRF-TOKEN header
- ✅ OAuth response status: 200
- ✅ Authentication cookies set via Chrome API
- ✅ Target URL opens with automatic login

### Common Issues
- **CSRF token failures**: Check tenant accessibility and endpoints
- **OAuth 403 errors**: Verify CSRF token validity
- **OAuth 401 errors**: Check username/password credentials
- **Cookie issues**: Verify Chrome Cookies API permissions

## Integration

### With Existing Flow
The OAuth implementation integrates seamlessly with the existing search and login flow:

1. User searches 1Password items (unchanged)
2. Results displayed in popup (unchanged)
3. User clicks result with auto-login enabled
4. **NEW**: OAuth authentication performed if enabled
5. URL opens in new tab (unchanged)
6. **ENHANCED**: Automatic login via OAuth cookies

### Storage Integration
- Auto-login preference stored in `chrome.storage.sync`
- Persists across browser sessions
- Per-user setting (not per-item)

## Performance

### Optimizations
- **Service worker context**: No additional tabs or pages required
- **Cookie caching**: Avoids repeated OAuth for same domain
- **Timeout protection**: Prevents hanging operations
- **Minimal logging**: Reduced console output for production

### Timing
- CSRF token acquisition: ~500ms
- OAuth authentication: ~1-2 seconds
- Cookie setting: ~100ms
- Total overhead: ~2-3 seconds for first login per domain

The implementation provides a seamless OAuth experience while maintaining compatibility with existing functionality and security requirements.
