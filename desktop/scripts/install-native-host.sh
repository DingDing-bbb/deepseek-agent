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
    NATIVE_HOST_DIR_BRAVE="$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
    NATIVE_HOST_DIR_FIREFOX="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    echo "Windows detected. Please run install-native-host.bat instead."
    exit 1
else
    # Linux
    NATIVE_HOST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    NATIVE_HOST_DIR_CHROMIUM="$HOME/.config/chromium/NativeMessagingHosts"
    NATIVE_HOST_DIR_EDGE="$HOME/.config/microsoft-edge/NativeMessagingHosts"
    NATIVE_HOST_DIR_BRAVE="$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
    NATIVE_HOST_DIR_FIREFOX="$HOME/.mozilla/native-messaging-hosts"
fi

# Get extension ID from user
EXTENSION_ID="${1:-}"
if [ -z "$EXTENSION_ID" ]; then
    echo "Please provide the extension ID as argument:"
    echo "  ./install-native-host.sh YOUR_EXTENSION_ID"
    echo ""
    echo "You can find the extension ID in chrome://extensions (Developer mode must be enabled)"
    exit 1
fi

# Path to native host script
NATIVE_HOST_SCRIPT="$PROJECT_ROOT/desktop/src/main/main.js"

if [ ! -f "$NATIVE_HOST_SCRIPT" ]; then
    echo "Error: Native host script not found at $NATIVE_HOST_SCRIPT"
    exit 1
fi

# Find Node.js path
NODE_PATH=$(which node 2>/dev/null || echo "/usr/local/bin/node")

if [ ! -x "$NODE_PATH" ]; then
    echo "Error: Node.js not found. Please install Node.js first."
    exit 1
fi

echo "Node.js path: $NODE_PATH"
echo "Native host script: $NATIVE_HOST_SCRIPT"

# Create a wrapper script
WRAPPER_SCRIPT="$PROJECT_ROOT/desktop/native-host/deepseek-agent-native"
mkdir -p "$(dirname "$WRAPPER_SCRIPT")"

cat > "$WRAPPER_SCRIPT" << EOF
#!/bin/bash
exec "$NODE_PATH" "$NATIVE_HOST_SCRIPT" --native-messaging
EOF

chmod +x "$WRAPPER_SCRIPT"

echo "Created wrapper script: $WRAPPER_SCRIPT"

# Create the manifest
install_manifest() {
    local target_dir="$1"
    local browser_name="$2"
    local manifest_file="$target_dir/com.deepseek.agent.json"
    
    if [ -d "$(dirname "$target_dir")" ] || [ "$browser_name" = "Firefox" ]; then
        mkdir -p "$target_dir"
        
        cat > "$manifest_file" << MANIFEST
{
  "name": "com.deepseek.agent",
  "description": "DeepSeek Agent - Local file access for AI coding assistant",
  "path": "$WRAPPER_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
MANIFEST
        
        echo "✓ Installed for $browser_name: $manifest_file"
    fi
}

# Install for Firefox (different manifest format)
install_firefox() {
    local target_dir="$1"
    local manifest_file="$target_dir/com.deepseek.agent.json"
    
    mkdir -p "$target_dir"
    
    cat > "$manifest_file" << MANIFEST
{
  "name": "com.deepseek.agent",
  "description": "DeepSeek Agent - Local file access for AI coding assistant",
  "path": "$WRAPPER_SCRIPT",
  "type": "stdio",
  "allowed_extensions": [
    "$EXTENSION_ID"
  ]
}
MANIFEST
    
    echo "✓ Installed for Firefox: $manifest_file"
}

echo ""
echo "Installing DeepSeek Agent Native Messaging Host..."
echo "Extension ID: $EXTENSION_ID"
echo ""

install_manifest "$NATIVE_HOST_DIR" "Google Chrome"
install_manifest "$NATIVE_HOST_DIR_CHROMIUM" "Chromium"

if [ -n "$NATIVE_HOST_DIR_EDGE" ]; then
    install_manifest "$NATIVE_HOST_DIR_EDGE" "Microsoft Edge"
fi

if [ -n "$NATIVE_HOST_DIR_BRAVE" ]; then
    install_manifest "$NATIVE_HOST_DIR_BRAVE" "Brave"
fi

if [ -n "$NATIVE_HOST_DIR_FIREFOX" ]; then
    install_firefox "$NATIVE_HOST_DIR_FIREFOX"
fi

echo ""
echo "Installation complete!"
echo ""
echo "To use the extension:"
echo "1. Open chrome://extensions (or edge://extensions, brave://extensions)"
echo "2. Enable 'Developer mode' (top right)"
echo "3. Click 'Load unpacked' and select the extension folder"
echo "4. Restart the browser"
echo ""
echo "Note: Make sure the desktop app is built and the native host script exists."
