#!/bin/bash

# DeepSeek Agent - Native Messaging Host Installer
# This script installs the native messaging host configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    NATIVE_HOST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    NATIVE_HOST_DIR_CHROMIUM="$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
    NATIVE_HOST_DIR_EDGE="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    echo "Windows detected. Please run install-native-host.bat instead."
    exit 1
else
    # Linux
    NATIVE_HOST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    NATIVE_HOST_DIR_CHROMIUM="$HOME/.config/chromium/NativeMessagingHosts"
    NATIVE_HOST_DIR_EDGE="$HOME/.config/microsoft-edge/NativeMessagingHosts"
fi

# Get extension ID from user or use placeholder
EXTENSION_ID="${1:-}"
if [ -z "$EXTENSION_ID" ]; then
    echo "Please provide the extension ID as argument:"
    echo "  ./install-native-host.sh YOUR_EXTENSION_ID"
    echo ""
    echo "You can find the extension ID in chrome://extensions (Developer mode must be enabled)"
    exit 1
fi

# Get the path to the native host executable
NATIVE_HOST_APP="$PROJECT_ROOT/desktop/src/main/main.js"

if [ ! -f "$NATIVE_HOST_APP" ]; then
    echo "Error: Native host app not found at $NATIVE_HOST_APP"
    echo "Please run this script from the project root or build the desktop app first."
    exit 1
fi

# Create the manifest
MANIFEST_FILE="$SCRIPT_DIR/com.deepseek.agent.json"
cat > "$MANIFEST_FILE" << EOF
{
  "name": "com.deepseek.agent",
  "description": "DeepSeek Agent - Local file access and command execution for AI coding assistant",
  "path": "$NATIVE_HOST_APP",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

# Install for Chrome
install_manifest() {
    local target_dir="$1"
    local browser_name="$2"
    
    if [ -d "$(dirname "$target_dir")" ]; then
        mkdir -p "$target_dir"
        cp "$MANIFEST_FILE" "$target_dir/com.deepseek.agent.json"
        echo "✓ Installed native messaging host for $browser_name"
    fi
}

echo "Installing DeepSeek Agent Native Messaging Host..."
echo "Extension ID: $EXTENSION_ID"
echo "Native Host: $NATIVE_HOST_APP"
echo ""

install_manifest "$NATIVE_HOST_DIR" "Google Chrome"
install_manifest "$NATIVE_HOST_DIR_CHROMIUM" "Chromium"

if [ -n "$NATIVE_HOST_DIR_EDGE" ]; then
    install_manifest "$NATIVE_HOST_DIR_EDGE" "Microsoft Edge"
fi

echo ""
echo "Installation complete!"
echo ""
echo "To use the extension:"
echo "1. Open chrome://extensions"
echo "2. Enable 'Developer mode' (top right)"
echo "3. Click 'Load unpacked' and select the extension folder"
echo "4. The extension ID will be shown - use it with this script if different"
echo ""
echo "Note: You may need to restart Chrome for changes to take effect."
