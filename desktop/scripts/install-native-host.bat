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

REM Get the path to the native host script
set NATIVE_HOST_SCRIPT=%PROJECT_ROOT%desktop/src/main/main.js

if not exist "%NATIVE_HOST_SCRIPT%" (
    echo Error: Native host script not found at %NATIVE_HOST_SCRIPT%
    echo Please run this script from the project root.
    exit /b 1
)

REM Find Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js not found in PATH
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

for /f "tokens=*" %%i in ('where node') do set NODE_PATH=%%i
echo Node.js path: %NODE_PATH%
echo Native host script: %NATIVE_HOST_SCRIPT%

REM Create wrapper script directory
set WRAPPER_DIR=%SCRIPT_DIR%..\native-host
if not exist "%WRAPPER_DIR%" mkdir "%WRAPPER_DIR%"

REM Create wrapper batch file
set WRAPPER_SCRIPT=%WRAPPER_DIR%\deepseek-agent-native.bat

(
echo @echo off
echo "%NODE_PATH%" "%NATIVE_HOST_SCRIPT%" --native-messaging
) > "%WRAPPER_SCRIPT%"

echo Created wrapper script: %WRAPPER_SCRIPT%

REM Create manifest directory
set MANIFEST_DIR=%WRAPPER_DIR%
set MANIFEST_FILE=%MANIFEST_DIR%\com.deepseek.agent.json

REM Convert paths to Windows format for JSON
set WRAPPER_SCRIPT_WIN=%WRAPPER_SCRIPT:/=\%

(
echo {
echo   "name": "com.deepseek.agent",
echo   "description": "DeepSeek Agent - Local file access for AI coding assistant",
echo   "path": "%WRAPPER_SCRIPT_WIN:\=\\%",
echo   "type": "stdio",
echo   "allowed_origins": [
echo     "chrome-extension://%EXTENSION_ID%/"
echo   ]
echo }
) > "%MANIFEST_FILE%"

echo.
echo Installing DeepSeek Agent Native Messaging Host...
echo Extension ID: %EXTENSION_ID%
echo Manifest: %MANIFEST_FILE%
echo.

REM Install for Chrome
set CHROME_REG=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.deepseek.agent
reg add "%CHROME_REG%" /ve /t REG_SZ /d "%MANIFEST_FILE%" /f >nul 2>&1
if !errorlevel!==0 (
    echo [OK] Installed for Google Chrome
)

REM Install for Chromium
set CHROMIUM_REG=HKCU\Software\Chromium\NativeMessagingHosts\com.deepseek.agent
reg add "%CHROMIUM_REG%" /ve /t REG_SZ /d "%MANIFEST_FILE%" /f >nul 2>&1
if !errorlevel!==0 (
    echo [OK] Installed for Chromium
)

REM Install for Edge
set EDGE_REG=HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.deepseek.agent
reg add "%EDGE_REG%" /ve /t REG_SZ /d "%MANIFEST_FILE%" /f >nul 2>&1
if !errorlevel!==0 (
    echo [OK] Installed for Microsoft Edge
)

REM Install for Brave
set BRAVE_REG=HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.deepseek.agent
reg add "%BRAVE_REG%" /ve /t REG_SZ /d "%MANIFEST_FILE%" /f >nul 2>&1
if !errorlevel!==0 (
    echo [OK] Installed for Brave
)

echo.
echo Installation complete!
echo.
echo To use the extension:
echo 1. Open chrome://extensions (or edge://extensions, brave://extensions)
echo 2. Enable 'Developer mode' (top right)
echo 3. Click 'Load unpacked' and select the extension folder
echo 4. Restart the browser
echo.
echo Note: Make sure Node.js is installed and in your PATH.

pause
