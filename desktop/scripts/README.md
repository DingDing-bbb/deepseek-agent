# 代码签名指南

Windows 上未签名的应用程序会被 SmartScreen 阻止运行。本文档说明如何获取免费签名证书。

## 方案对比

| 方案 | 费用 | 信任级别 | 难度 |
|------|------|----------|------|
| SignPath Foundation | 免费 | 高 (受信任) | 中等 |
| 自签名证书 | 免费 | 无 (需用户手动信任) | 简单 |
| 商业证书 | $200-400/年 | 高 (受信任) | 简单 |

## 方案一：SignPath Foundation（推荐）

### 申请步骤

1. 访问 https://signpath.org
2. 点击 "Apply for Code Signing"
3. 填写项目信息：
   - GitHub 项目：`https://github.com/DingDing-bbb/deepseek-agent`
   - 项目类型：开源桌面应用
   - 开源许可证：MIT

### 审核通过后

1. 登录 SignPath 后台
2. 获取以下信息：
   - API Token
   - Organization ID
   - Project Slug

3. 在 GitHub 仓库 Settings → Secrets 添加：
   ```
   SIGNPATH_API_TOKEN = <你的 API Token>
   SIGNPATH_ORG_ID = <你的 Organization ID>
   ```

4. 创建 tag 触发自动构建和签名：
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

## 方案二：自签名证书（开发测试用）

### 创建证书

1. 以管理员身份运行 PowerShell
2. 执行：
   ```powershell
   cd desktop\scripts
   .\create-self-signed-cert.ps1
   ```

### 签名应用

```powershell
.\sign-app.ps1 -PfxPath "证书路径.pfx" -Password "密码" -ExePath "..\release\DeepSeek-Agent-Desktop-Setup-1.0.0.exe"
```

### 用户安装证书

用户首次运行时会提示"未知发布者"，需要：

1. 右键点击证书文件 → 安装证书
2. 选择"本地计算机"
3. 选择"将所有的证书放入下列存储" → 浏览
4. 选择"受信任的发布者"
5. 完成

## 方案三：免费开源证书 (Certum)

Certum 为开源项目提供免费代码签名证书：

1. 访问 https://www.certum.eu/en/code-signing-certificates/
2. 选择 "Open Source Code Signing"
3. 提交项目证明

## 电子邮件验证

大多数证书颁发机构需要验证：
- 域名所有权（通过 DNS 记录或文件上传）
- 组织信息（营业执照等，开源项目可豁免）
- 电子邮件验证（发送验证邮件到 admin@yourdomain.com）

## 时间戳服务器

免费的时间戳服务器：
- DigiCert: http://timestamp.digicert.com
- Sectigo: http://timestamp.sectigo.com
- Globalsign: http://timestamp.globalsign.com/scripts/timstamp.dll

## 常见问题

### Q: 签名后仍提示"未知发布者"？
A: 自签名证书需要用户手动安装。SignPath 签名的证书需要积累一定下载量后才会被 SmartScreen 信任。

### Q: 签名需要多长时间？
A: SignPath 通常几分钟内完成。

### Q: 可以撤销签名吗？
A: 可以，通过证书吊销列表 (CRL) 或 OCSP。

## 参考资料

- [SignPath Documentation](https://docs.signpath.org)
- [Windows Code Signing](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)
- [Electron Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)
