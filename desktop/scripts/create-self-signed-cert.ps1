# Windows 自签名证书脚本 (开发测试用)
# 注意：自签名证书不会被 Windows 信任，用户需要手动安装证书

param(
    [string]$AppName = "DeepSeek Agent",
    [string]$Publisher = "DeepSeek Agent Community",
    [int]$Years = 10
)

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "请以管理员身份运行此脚本！" -ForegroundColor Red
    exit 1
}

# 创建证书
$certName = "CN=$Publisher"
Write-Host "创建自签名证书: $certName" -ForegroundColor Yellow

$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject $certName `
    -FriendlyName "$AppName Code Signing Certificate" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyUsage DigitalSignature `
    -KeyAlgorithm RSA `
    -KeyLength 4096 `
    -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" `
    -KeyExportPolicy Exportable `
    -KeyProtection PersistKeySet `
    -NotAfter (Get-Date).AddYears($Years)

Write-Host "证书创建成功！" -ForegroundColor Green
Write-Host "证书指纹: $($cert.Thumbprint)" -ForegroundColor Cyan

# 导出证书
$certPath = "$PSScriptRoot\$($AppName -replace ' ', '_')_Certificate.cer"
Export-Certificate -Cert $cert -FilePath $certPath
Write-Host "证书已导出到: $certPath" -ForegroundColor Cyan

# 导出 PFX (用于签名)
$pfxPath = "$PSScriptRoot\$($AppName -replace ' ', '_')_CodeSigning.pfx"
$pfxPassword = Read-Host "请输入 PFX 密码" -AsSecureString
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pfxPassword
Write-Host "PFX 已导出到: $pfxPath" -ForegroundColor Cyan

# 将证书添加到受信任的发布者 (仅本机)
Write-Host "`n要将证书添加到受信任的发布者，请运行:" -ForegroundColor Yellow
Write-Host "  certutil -addstore ""TrustedPublisher"" ""$certPath""" -ForegroundColor White
Write-Host "  certutil -addstore ""Root"" ""$certPath""" -ForegroundColor White

Write-Host "`n=== 使用 SignTool 签名 ===" -ForegroundColor Yellow
Write-Host "SignTool sign /f ""$pfxPath"" /p YOUR_PASSWORD /tr http://timestamp.digicert.com /td SHA256 /fd SHA256 ""your-app.exe""" -ForegroundColor White

Write-Host "`n注意事项:" -ForegroundColor Red
Write-Host "1. 自签名证书不会被其他电脑信任" -ForegroundColor White
Write-Host "2. 用户需要手动安装证书到受信任的发布者" -ForegroundColor White
Write-Host "3. 建议使用 SignPath 获取免费的受信任证书" -ForegroundColor White
