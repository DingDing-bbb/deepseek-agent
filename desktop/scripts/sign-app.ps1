# 使用 SignTool 对 Electron 应用签名
# 需要先安装 Windows SDK (包含 SignTool)

param(
    [Parameter(Mandatory=$true)]
    [string]$PfxPath,
    
    [Parameter(Mandatory=$true)]
    [string]$Password,
    
    [Parameter(Mandatory=$true)]
    [string]$ExePath,
    
    [string]$TimestampServer = "http://timestamp.digicert.com"
)

# 查找 SignTool
$signtoolPaths = @(
    "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe",
    "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22000.0\x64\signtool.exe",
    "C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe"
)

$signtool = $null
foreach ($path in $signtoolPaths) {
    if ($path -contains "*") {
        $found = Get-Item $path -ErrorAction SilentlyContinue | Sort-Object -Descending | Select-Object -First 1
        if ($found) {
            $signtool = $found.FullName
            break
        }
    } elseif (Test-Path $path) {
        $signtool = $path
        break
    }
}

if (-not $signtool) {
    Write-Host "错误: 找不到 SignTool，请安装 Windows SDK" -ForegroundColor Red
    Write-Host "下载地址: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/" -ForegroundColor Yellow
    exit 1
}

Write-Host "使用 SignTool: $signtool" -ForegroundColor Cyan

# 签名
Write-Host "正在签名: $ExePath" -ForegroundColor Yellow

$arguments = @(
    "sign",
    "/f", $PfxPath,
    "/p", $Password,
    "/tr", $TimestampServer,
    "/td", "SHA256",
    "/fd", "SHA256",
    $ExePath
)

& $signtool $arguments

if ($LASTEXITCODE -eq 0) {
    Write-Host "签名成功！" -ForegroundColor Green
    
    # 验证签名
    Write-Host "`n验证签名..." -ForegroundColor Yellow
    & $signtool verify /pa /all $ExePath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "签名验证通过！" -ForegroundColor Green
    } else {
        Write-Host "签名验证失败！" -ForegroundColor Red
    }
} else {
    Write-Host "签名失败！" -ForegroundColor Red
    exit 1
}
