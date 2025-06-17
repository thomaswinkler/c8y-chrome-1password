// C8Y Session 1Password Extension - Background Service Worker
// Handles native messaging communication and tab management

// Native messaging host name (matching the c8y-session-1password executable)
const NATIVE_HOST_NAME = 'com.cumulocity.c8y_session_1password';

// Check if fetch API is available in service worker
if (typeof fetch === 'undefined') {
    console.error('Fetch API not available in service worker');
}

/**
 * OAuth Authentication Functions
 */

/**
 * Extract base URL from a Cumulocity URL (origin without path)
 */
function extractBaseUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.origin;
    } catch (error) {
        console.error('Invalid URL format:', error);
        throw new Error('Invalid URL format');
    }
}

/**
 * Check login options for OAuth2 Internal support
 */
async function checkLoginOptions(baseUrl) {
    const loginOptionsUrl = `${baseUrl}/tenant/loginOptions`;

    try {
        const response = await fetch(loginOptionsUrl, {
            credentials: 'omit' // Don't include any cookies for login options check
        });
        if (!response.ok) {
            throw new Error(`Login options request failed: ${response.status} ${response.statusText}`);
        }

        const loginOptions = await response.json();

        // Find OAuth2 Internal login option
        const oauthOption = loginOptions.loginOptions?.find(
            option => option.type === 'OAUTH2_INTERNAL'
        );

        if (!oauthOption) {
            throw new Error('OAuth2 Internal authentication not available for this tenant');
        }

        return { oauthOption, loginOptions };
    } catch (error) {
        console.error('Error checking login options:', error);
        throw error;
    }
}

/**
 * Perform OAuth authentication using service worker fetch
 */
async function performOAuthLogin(baseUrl, username, password, oauthOption) {
    console.log('Starting OAuth authentication for:', baseUrl);

    try {
        // Construct OAuth URL using baseUrl with path from initRequest
        const initRequestUrl = new URL(oauthOption.initRequest);
        const oauthUrl = baseUrl + initRequestUrl.pathname + (initRequestUrl.search || '');

        const params = new URLSearchParams({
            grant_type: 'PASSWORD',
            username: username || '',
            password: password || ''
        });

        // Build headers with CSRF token if available
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json, text/plain, */*'
        };

        const response = await fetch(oauthUrl, {
            method: 'POST',
            body: params.toString(),
            headers: headers,
            credentials: 'include' // should be included to handle cookies
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OAuth authentication failed:', response.status, errorText);
            throw new Error(`OAuth authentication failed: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('OAuth authentication error:', error.message);
        throw error;
    }

    console.log('OAuth authentication successful');
}

// Listen for messages from popup and other extension components
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'SEARCH':
            handleSearchRequest(message.payload, sender);
            break;
        case 'LOGIN':
            handleLoginRequest(message.payload, sender);
            break;
    }
    return true; // Async response
});

/**
 * Handle search requests from popup
 */
async function handleSearchRequest(payload, sender) {
    try {
        const port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
        let responseReceived = false;
        let hostDisconnected = false;

        port.onMessage.addListener((response) => {
            if (responseReceived) return;
            responseReceived = true;

            // Forward results to popup
            chrome.runtime.sendMessage({
                type: 'SEARCH_RESULTS',
                payload: response
            }).catch(error => {
                console.error('Error sending search results to popup:', error);
            });

            port.disconnect();
        });

        port.onDisconnect.addListener(() => {
            hostDisconnected = true;

            if (chrome.runtime.lastError) {
                const errorMessage = chrome.runtime.lastError.message;
                console.error('Native host error:', errorMessage);

                chrome.runtime.sendMessage({
                    type: 'SEARCH_ERROR',
                    payload: `Native host error: ${errorMessage}`
                }).catch(err => {
                    console.error('Error sending search error to popup:', err);
                });
            } else if (!responseReceived) {
                console.warn('Native host exited without response');
                chrome.runtime.sendMessage({
                    type: 'SEARCH_ERROR',
                    payload: 'Native host exited without response'
                }).catch(err => {
                    console.error('Error sending search error to popup:', err);
                });
            }
        });

        // Send search payload to native host
        port.postMessage(payload);

        // Set timeout for host response
        setTimeout(() => {
            if (!responseReceived && !hostDisconnected) {
                console.warn('Search timed out after 30 seconds');
                chrome.runtime.sendMessage({
                    type: 'SEARCH_ERROR',
                    payload: 'Search timed out after 30 seconds'
                }).catch(err => {
                    console.error('Error sending timeout error to popup:', err);
                });
            }
        }, 30000);

    } catch (error) {
        console.error('Search request error:', error);
        chrome.runtime.sendMessage({
            type: 'SEARCH_ERROR',
            payload: `Search error: ${error.message}`
        }).catch(err => {
            console.error('Error sending search error to popup:', err);
        });
    }
}

/**
 * Handle login requests from popup
 */
async function handleLoginRequest(payload, sender) {
    const { url, username, password, autoLogin, cookieSettings } = payload;

    try {
        // If autoLogin is enabled, attempt OAuth authentication first
        if (autoLogin && username && password) {
            try {
                const baseUrl = extractBaseUrl(url);
                const { oauthOption } = await checkLoginOptions(baseUrl);
                await performOAuthLogin(baseUrl, username, password, oauthOption);

                console.log('OAuth authentication completed successfully');

                // Send success message to popup
                chrome.runtime.sendMessage({
                    type: 'OAUTH_SUCCESS',
                    payload: { message: 'OAuth authentication successful' }
                }).catch(() => {
                    // Popup may be closed
                });

            } catch (oauthError) {
                console.error('OAuth authentication failed:', oauthError.message);

                // Send OAuth error to popup
                chrome.runtime.sendMessage({
                    type: 'OAUTH_ERROR',
                    payload: { error: oauthError.message }
                }).catch(() => {
                    // Popup may be closed
                });

                console.log('Continuing with normal login flow after OAuth failure');
            }
        }

        // Create new tab with the URL
        const tab = await chrome.tabs.create({
            url: url,
            active: true
        });

        // Wait for tab to load and then inject scripts
        setTimeout(async () => {
            try {
                // First inject cookie banner settings if provided
                if (cookieSettings && cookieSettings.acceptCookieNotice) {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: setCookieBannerSettings,
                        args: [cookieSettings.acceptCookieNotice]
                    });
                }

                // Only inject login script if not using OAuth
                if (!autoLogin || !username || !password) {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: fillLoginForm,
                        args: [username, password]
                    });
                }
            } catch (scriptError) {
                console.error('Script injection failed:', scriptError.message);
            }
        }, 1000);

    } catch (error) {
        console.error('Login request error:', error);
        chrome.runtime.sendMessage({
            type: 'LOGIN_ERROR',
            payload: { error: error.message || 'Failed to open tab and perform login' }
        }).catch(() => {
            // Popup may be closed
        });
    }
}

/**
 * Content script function to set cookie banner acceptance in localStorage
 * This function will be injected into the target page
 */
function setCookieBannerSettings(cookieSettings) {
    try {
        // Set the acceptCookieNotice value in localStorage
        if (window.localStorage) {
            const cookieNoticeValue = JSON.stringify(cookieSettings);
            window.localStorage.setItem('acceptCookieNotice', cookieNoticeValue);
            console.log('Cookie banner settings applied:', cookieSettings);
        }
    } catch (error) {
        console.error('Failed to set cookie banner settings:', error);
    }
}

/**
 * Content script function to fill login forms
 * This function will be injected into the target page
 */
function fillLoginForm(username, password) {
    // Common selectors for username fields
    const usernameSelectors = [
        'input[type="email"]',
        'input[type="text"][name*="user"]',
        'input[type="text"][name*="email"]',
        'input[name="username"]',
        'input[name="email"]',
        'input[id="username"]',
        'input[id="email"]'
    ];

    // Common selectors for password fields
    const passwordSelectors = [
        'input[type="password"]'
    ];

    // Function to find and fill a field
    function findAndFillField(selectors, value, fieldType) {
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                if (element && element.offsetParent !== null) {
                    element.value = value;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
            }
        }
        return false;
    }

    // Attempt to fill fields
    function attemptFill() {
        let usernameFilled = false;
        let passwordFilled = false;

        if (username) {
            usernameFilled = findAndFillField(usernameSelectors, username, 'username');
        }

        if (password) {
            passwordFilled = findAndFillField(passwordSelectors, password, 'password');
        }

        return usernameFilled || passwordFilled;
    }

    // Try immediately
    if (attemptFill()) {
        return;
    }

    // Try again after DOM loads and with delays for dynamic content
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attemptFill);
    } else {
        setTimeout(attemptFill, 500);
        setTimeout(attemptFill, 1500);
        setTimeout(attemptFill, 3000);
    }
}

/**
 * Extension lifecycle events
 */
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed:', details.reason);
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Extension started');
});
