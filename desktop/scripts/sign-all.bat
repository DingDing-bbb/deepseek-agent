@echo off
REM 批量签名脚本 - 对 release 目录下的所有 exe 文件签名

setlocal

set PFX_PATH=%1
set PFX_PASSWORD=%2
set TIMESTAMP_SERVER=http://timestamp.digicert.com

if "%~1"=="" (
    echo 用法: sign-all.bat ^<pfx_path^> ^<password^>
    exit /b 1
)

REM 查找 SignTool
set SIGNTOOL=""
for /f "tokens=*" %%i in ('dir /s /b "C:\Program Files (x86)\Windows Kits\10\bin\signtool.exe" 2^>nul') do (
    set SIGNTOOL=%%i
    goto :found
)

echo 错误: 未找到 SignTool，请安装 Windows SDK
exit /b 1

:found
echo 找到 SignTool: %SIGNTOOL%

REM 签名所有 exe 文件
for %%f in (..\release\*.exe) do (
    echo.
    echo 正在签名: %%f
    "%SIGNTOOL%" sign /f "%PFX_PATH%" /p "%PFX_PASSWORD%" /tr %TIMESTAMP_SERVER% /td SHA256 /fd SHA256 "%%f"
    
    if errorlevel 1 (
        echo 签名失败: %%f
    ) else (
        echo 签名成功: %%f
    )
)

echo.
echo 完成！

endlocal
