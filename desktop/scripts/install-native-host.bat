@echo off
REM DeepSeek Agent - Native Messaging Host Installer for Windows

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..\..\
set PROJECT_ROOT=%PROJECT_ROOT:\=/%

REM Get extension ID from argument
set EXTENSION_ID=%~1
if "%EXTENSION_ID%"=="" (
    echo Please provide the extension ID as argument:
    echo   install-native-host.bat YOUR_EXTENSION_ID
    echo.
    echo You can find the extension ID in chrome://extensions ^(Developer mode must be enabled^)
    exit /b 1
)

REM Get the path to the native host executable
set NATIVE_HOST_APP=%PROJECT_ROOT%desktop\src\main\main.js

if not exist "%NATIVE_HOST_APP%" (
    echo Error: Native host app not found at %NATIVE_HOST_APP%
    echo Please run this script from the project root or build the desktop app first.
    exit /b 1
)

REM Create the manifest JSON
set MANIFEST_FILE=%SCRIPT_DIR%com.deepseek.agent.json

(
echo {
echo   "name": "com.deepseek.agent",
echo   "description": "DeepSeek Agent - Local file access for AI coding assistant",
echo   "path": "%NATIVE_HOST_APP:\=\\%",
echo   "type": "stdio",
echo   "allowed_origins": [
echo     "chrome-extension://%EXTENSION_ID%/"
echo   ]
echo }
) > "%MANIFEST_FILE%"

echo Installing DeepSeek Agent Native Messaging Host...
echo Extension ID: %EXTENSION_ID%
echo Native Host: %NATIVE_HOST_APP%
echo.

REM Install for Chrome
set CHROME_REG=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.deepseek.agent
reg add "%CHROME_REG%" /ve /t REG_SZ /d "%MANIFEST_FILE%" /f >nul 2>&1
if !errorlevel!==0 (
    echo [*] Installed native messaging host for Google Chrome
)

REM Install for Chromium
set CHROMIUM_REG=HKCU\Software\Chromium\NativeMessagingHosts\com.deepseek.agent
reg add "%CHROMIUM_REG%" /ve /t REG_SZ /d "%MANIFEST_FILE%" /f >nul 2>&1
if !errorlevel!==0 (
    echo [*] Installed native messaging host for Chromium
)

REM Install for Edge
set EDGE_REG=HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.deepseek.agent
reg add "%EDGE_REG%" /ve /t REG_SZ /d "%MANIFEST_FILE%" /f >nul 2>&1
if !errorlevel!==0 (
    echo [*] Installed native messaging host for Microsoft Edge
)

echo.
echo Installation complete!
echo.
echo To use the extension:
echo 1. Open chrome://extensions
echo 2. Enable 'Developer mode' (top right)
echo 3. Click 'Load unpacked' and select the extension folder
echo 4. The extension ID will be shown - use it with this script if different
echo.
echo Note: You may need to restart Chrome for changes to take effect.

pause
