// C8Y Session 1Password Extension - Popup Script
// Handles UI interactions and communication with background script

document.addEventListener('DOMContentLoaded', function () {
    const elements = {
        form: document.getElementById('search-form'),
        tagsInput: document.getElementById('tags-input'),
        searchInput: document.getElementById('search-input'),
        autoLoginToggle: document.getElementById('auto-login-toggle'),
        searchButton: document.getElementById('search-button'),
        statusArea: document.getElementById('status-area'),
        resultsArea: document.getElementById('results-area')
    };

    // Load saved values from storage
    loadSavedInputs();

    // Check storage quota on startup
    checkStorageQuota();

    // Clean up any old storage data
    cleanupStorage();

    // Log storage info for debugging (can be removed in production)
    if (typeof console !== 'undefined') {
        getStorageInfo();
    }

    // Event listeners
    elements.form.addEventListener('submit', handleSearch);
    elements.resultsArea.addEventListener('click', handleResultClick);

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);

    // Listen for storage changes (Extension Storage best practice)
    chrome.storage.onChanged.addListener(function (changes, areaName) {
        // Handle local storage changes for user preferences
        if (areaName === 'local') {
            if (changes.tags && changes.tags.newValue !== undefined) {
                elements.tagsInput.value = changes.tags.newValue;
            }
            if (changes.search && changes.search.newValue !== undefined) {
                elements.searchInput.value = changes.search.newValue;
            }
            if (changes.autoLogin && changes.autoLogin.newValue !== undefined) {
                elements.autoLoginToggle.checked = changes.autoLogin.newValue;
            }
        }
        
        // Handle session storage changes for search results
        if (areaName === 'session' && changes.lastResults) {
            if (changes.lastResults.newValue && Array.isArray(changes.lastResults.newValue) && changes.lastResults.newValue.length > 0) {
                renderResults(changes.lastResults.newValue);
            } else {
                elements.resultsArea.innerHTML = '';
            }
        }
    });

    /**
     * Load saved input values using Extension Storage API
     */
    function loadSavedInputs() {
        // Load persistent user preferences from extension local storage
        chrome.storage.local.get(['tags', 'search', 'autoLogin'], function (result) {
            if (chrome.runtime.lastError) {
                console.error('Error loading saved preferences:', chrome.runtime.lastError);
                return;
            }
            
            if (result.tags) {
                elements.tagsInput.value = result.tags;
            }
            if (result.search) {
                elements.searchInput.value = result.search;
            }
            if (result.autoLogin !== undefined) {
                elements.autoLoginToggle.checked = result.autoLogin;
            }
        });

        // Load session-only search results from extension session storage
        chrome.storage.session.get(['lastResults'], function (result) {
            if (chrome.runtime.lastError) {
                console.error('Error loading session results:', chrome.runtime.lastError);
                return;
            }
            
            if (result.lastResults && Array.isArray(result.lastResults) && result.lastResults.length > 0) {
                renderResults(result.lastResults);
            }
        });
    }

    /**
     * Check Extension Storage quota and usage
     */
    function checkStorageQuota() {
        chrome.storage.local.getBytesInUse(function (bytesInUse) {
            if (chrome.runtime.lastError) {
                console.error('Error checking storage quota:', chrome.runtime.lastError);
                return;
            }
            
            // Extension local storage quota is typically 5MB (5,242,880 bytes)
            const quota = 5242880;
            const usagePercent = (bytesInUse / quota) * 100;
            
            if (usagePercent > 80) {
                console.warn('Extension storage usage is high:', usagePercent.toFixed(1) + '%');
            }
        });
    }

    /**
     * Clean up old or unnecessary storage data (Extension Storage maintenance)
     */
    function cleanupStorage() {
        // Clear any legacy storage keys that might exist
        chrome.storage.local.remove(['oldResults', 'tempData'], function () {
            if (chrome.runtime.lastError) {
                console.error('Error cleaning up storage:', chrome.runtime.lastError);
            }
        });
    }

    /**
     * Get storage usage information for debugging (Extension Storage API)
     */
    function getStorageInfo() {
        chrome.storage.local.getBytesInUse(function (localBytes) {
            if (chrome.runtime.lastError) {
                console.error('Error getting local storage info:', chrome.runtime.lastError);
                return;
            }
            
            chrome.storage.session.getBytesInUse(function (sessionBytes) {
                if (chrome.runtime.lastError) {
                    console.error('Error getting session storage info:', chrome.runtime.lastError);
                    return;
                }
                
                console.log('Extension Storage Usage:', {
                    local: localBytes + ' bytes',
                    session: sessionBytes + ' bytes',
                    localPercent: ((localBytes / 5242880) * 100).toFixed(2) + '%'
                });
            });
        });
    }

    /**
     * Handle search form submission
     */
    function handleSearch(event) {
        event.preventDefault();

        const vaults = []; // Always search all vaults
        const tags = elements.tagsInput.value.split(',').map(function (t) { return t.trim(); }).filter(function (t) { return t; });
        const search = elements.searchInput.value.trim();

        // Save current inputs to extension local storage
        chrome.storage.local.set({
            tags: elements.tagsInput.value,
            search: elements.searchInput.value,
            autoLogin: elements.autoLoginToggle.checked
        }, function () {
            if (chrome.runtime.lastError) {
                console.error('Error saving inputs:', chrome.runtime.lastError);
            }
        });

        // Clear previous results and show loading
        elements.resultsArea.innerHTML = '';
        showStatus('Searching...', 'info');
        elements.searchButton.disabled = true;

        // Send search message to background script
        const message = {
            type: 'SEARCH',
            // Include vaults, tags, search term, and reveal option
            // reveal is required to get sensitive data
            payload: { vaults: vaults, tags: tags, search: search, reveal: true }
        };

        chrome.runtime.sendMessage(message).catch(function (error) {
            console.error('Error sending search message:', error);
            showStatus('Error: Could not communicate with background script', 'error');
            elements.searchButton.disabled = false;
        });
    }

    /**
     * Handle messages from background script
     */
    function handleBackgroundMessage(message) {
        switch (message.type) {
            case 'SEARCH_RESULTS':
                handleSearchResults(message.payload);
                break;
            case 'SEARCH_ERROR':
                handleSearchError(message.payload);
                break;
            case 'OAUTH_SUCCESS':
                handleOAuthSuccess(message.payload);
                break;
            case 'OAUTH_ERROR':
                handleOAuthError(message.payload);
                break;
            case 'LOGIN_ERROR':
                handleLoginError(message.payload);
                break;
        }
    }

    /**
     * Handle successful search results
     */
    function handleSearchResults(results) {
        elements.searchButton.disabled = false;

        if (!results || results.length === 0) {
            showStatus('No results found', 'info');
            elements.resultsArea.innerHTML = '<div class="no-results">No sessions found matching your criteria</div>';
            // Clear session results when no results found using Extension Storage
            chrome.storage.session.set({ lastResults: [] }, function () {
                if (chrome.runtime.lastError) {
                    console.error('Error clearing session results:', chrome.runtime.lastError);
                }
            });
            return;
        }

        hideStatus();
        renderResults(results);

        // Save search results to extension session storage
        chrome.storage.session.set({ lastResults: results }, function () {
            if (chrome.runtime.lastError) {
                console.error('Error saving search results to session:', chrome.runtime.lastError);
            }
        });
    }

    /**
     * Handle search errors
     */
    function handleSearchError(error) {
        elements.searchButton.disabled = false;
        showStatus('Error: ' + error, 'error');
        elements.resultsArea.innerHTML = '';
    }

    /**
     * Render search results in the UI
     */
    function renderResults(results) {
        elements.resultsArea.innerHTML = '';

        results.forEach(function (item, index) {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';

            // Item name
            const title = document.createElement('div');
            title.className = 'item-title';
            title.textContent = item.itemName || item.title || 'Unnamed Item';

            // User and vault info container
            const infoContainer = document.createElement('div');
            infoContainer.className = 'item-info-container';

            // User
            const username = document.createElement('div');
            username.className = 'item-username';
            username.textContent = item.username || 'Not specified';

            // Vault
            const vault = document.createElement('div');
            vault.className = 'item-vault';
            vault.textContent = item.vaultName || 'Unknown';

            infoContainer.appendChild(username);
            infoContainer.appendChild(vault);

            resultItem.appendChild(title);
            resultItem.appendChild(infoContainer);

            // Handle URLs - create clickable entries
            if (item.urls && Array.isArray(item.urls) && item.urls.length > 0) {
                item.urls.forEach(function (urlInfo, urlIndex) {
                    const urlEntry = createUrlEntry(urlInfo, item, index + '-' + urlIndex);
                    resultItem.appendChild(urlEntry);
                });
            } else if (item.host) {
                // Fallback to host property
                const urlEntry = createUrlEntry({
                    label: item.host,
                    url: item.host.startsWith('http') ? item.host : 'https://' + item.host
                }, item, index + '-host');
                resultItem.appendChild(urlEntry);
            }

            elements.resultsArea.appendChild(resultItem);
        });
    }

    /**
     * Create a clickable URL entry element
     */
    function createUrlEntry(urlInfo, item, dataId) {
        const urlEntry = document.createElement('div');
        urlEntry.className = 'url-entry';
        urlEntry.dataset.itemIndex = dataId;
        urlEntry.dataset.url = urlInfo.url;
        urlEntry.dataset.username = item.username;
        urlEntry.dataset.password = item.password;

        const url = document.createElement('span');
        url.className = 'url-value';
        url.textContent = urlInfo.url;

        urlEntry.appendChild(url);

        return urlEntry;
    }

    /**
     * Handle clicks on result items
     */
    function handleResultClick(event) {
        const urlEntry = event.target.closest('.url-entry');
        if (!urlEntry) return;

        const url = urlEntry.dataset.url;
        const username = urlEntry.dataset.username;
        const password = urlEntry.dataset.password;
        const autoLogin = elements.autoLoginToggle.checked;

        if (!url) {
            console.error('No URL found for clicked item');
            return;
        }

        // Send login message to background script
        const message = {
            type: 'LOGIN',
            payload: {
                url: url,
                username: username,
                password: password,
                autoLogin: autoLogin,
                // Include cookie banner settings
                cookieSettings: {
                    acceptCookieNotice: {
                        required: true,
                        functional: true,
                        marketing: false
                    }
                }
            }
        };

        chrome.runtime.sendMessage(message).then(function () {
            window.close(); // Close popup after successful login initiation
        }).catch(function (error) {
            console.error('Error sending login message:', error);
            showStatus('Error: Could not initiate login', 'error');
        });
    }

    /**
     * Show status message
     */
    function showStatus(message, type) {
        elements.statusArea.textContent = message;
        elements.statusArea.className = 'status-area ' + type;
    }

    /**
     * Hide status message
     */
    function hideStatus() {
        elements.statusArea.className = 'status-area';
    }

    /**
     * Handle OAuth success message
     */
    function handleOAuthSuccess(payload) {
        showStatus('Authentication successful', 'success');
        setTimeout(function () {
            hideStatus();
        }, 2000);
    }

    /**
     * Handle OAuth error message
     */
    function handleOAuthError(payload) {
        showStatus('Authentication failed: ' + payload.error, 'error');
    }

    /**
     * Handle login error message
     */
    function handleLoginError(payload) {
        showStatus('Login failed: ' + payload.error, 'error');
    }
});