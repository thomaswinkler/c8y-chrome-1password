#!/bin/bash

# Installation script for C8Y Session 1Password Chrome Extension
# This script installs the native messaging host manifest

set -e

echo "Installing C8Y Session 1Password Chrome Extension native messaging host..."

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "This script is designed for macOS. For other platforms, please install manually."
    exit 1
fi

# Define paths
MANIFEST_SOURCE="./com.your_company.c8y_session.json"
MANIFEST_DEST="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.your_company.c8y_session.json"

# Create directory if it doesn't exist
mkdir -p "$(dirname "$MANIFEST_DEST")"

# Copy manifest file
if [ -f "$MANIFEST_SOURCE" ]; then
    cp "$MANIFEST_SOURCE" "$MANIFEST_DEST"
    echo "✓ Native messaging host manifest installed to: $MANIFEST_DEST"
else
    echo "✗ Error: Manifest file not found at $MANIFEST_SOURCE"
    exit 1
fi

# Check if the c8y-session-1password executable exists
EXECUTABLE_PATH="/usr/local/bin/c8y-session-1password"
if [ -f "$EXECUTABLE_PATH" ]; then
    echo "✓ Found c8y-session-1password executable at: $EXECUTABLE_PATH"
    
    # Make sure it's executable
    chmod +x "$EXECUTABLE_PATH"
    echo "✓ Made executable file executable"
else
    echo "⚠ Warning: c8y-session-1password executable not found at: $EXECUTABLE_PATH"
    echo "   Please ensure the c8y-session-1password executable is installed and accessible."
    echo "   You can download it from: https://github.com/thomaswinkler/c8y-session-1password"
fi

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "1. Load the extension in Chrome (chrome://extensions, enable Developer Mode, Load Unpacked)"
echo "2. Note down the extension ID from the Chrome extensions page"
echo "3. Update the 'allowed_origins' in the manifest file with your extension ID:"
echo "   $MANIFEST_DEST"
echo "4. Ensure the c8y-session-1password executable is installed and working"
echo ""
echo "The extension should now be able to communicate with the native messaging host."
