'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bot, 
  Download, 
  Shield, 
  Zap,
  Terminal,
  Globe,
  CheckCircle2,
  Monitor,
  Puzzle,
  ExternalLink,
  WindowsIcon,
  AppleIcon,
  LinuxIcon,
  FileCode,
  Package
} from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: '一键应用',
    desc: '快速应用程序员角色的系统提示'
  },
  {
    icon: Shield,
    title: '本地运行',
    desc: '所有数据都在本地处理，不上传云端'
  },
  {
    icon: Terminal,
    title: '命令执行',
    desc: 'AI 可以执行 shell 命令进行开发操作'
  },
  {
    icon: Globe,
    title: '跨平台',
    desc: '支持 Windows、macOS、Linux'
  }
];

const steps = [
  {
    step: 1,
    title: '下载桌面应用',
    desc: '安装 DeepSeek Agent Desktop'
  },
  {
    step: 2,
    title: '选择工作目录',
    desc: '在桌面应用中选择 AI 可访问的文件夹'
  },
  {
    step: 3,
    title: '安装浏览器插件',
    desc: '加载浏览器扩展程序'
  },
  {
    step: 4,
    title: '开始使用',
    desc: '访问 DeepSeek Chat 使用 Agent'
  }
];

// Windows icon component
function WindowsIconSVG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
    </svg>
  );
}

// Apple icon component
function AppleIconSVG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

// Linux icon component
function LinuxIconSVG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473.286.534.855 1.659 1.102 3.024.156-.005.33.018.513.064.646-1.671-.546-3.467-1.089-3.966-.22-.2-.232-.335-.123-.335.59.534 1.365 1.572 1.646 2.757.13.535.16 1.104.021 1.67.067.028.135.06.205.067 1.032.534 1.413.938 1.23 1.537v-.043c-.06-.003-.12 0-.18 0h-.016c.151-.467-.182-.825-1.065-1.224-.915-.4-1.646-.336-1.77.465-.008.043-.013.066-.018.135-.068.023-.139.053-.209.064-.43.268-.662.669-.793 1.187-.13.533-.17 1.156-.205 1.869v.003c-.02.334-.17.838-.319 1.35-1.5 1.072-3.58 1.538-5.348.334a2.645 2.645 0 00-.402-.533 1.45 1.45 0 00-.275-.333c.182 0 .338-.03.465-.067a.615.615 0 00.314-.334c.108-.267 0-.697-.345-1.163-.345-.467-.931-.995-1.788-1.521-.63-.4-.986-.87-1.15-1.396-.165-.534-.143-1.085-.015-1.645.245-1.07.873-2.11 1.254-2.763.105-.065.037.135-.408.974-.396.751-1.14 2.497-.122 3.854a8.123 8.123 0 01.647-2.876c.564-1.278 1.743-3.504 1.836-5.268.048.036.217.135.289.202.218.133.38.333.59.465.21.201.477.335.876.335.039.003.075.006.11.006.412 0 .73-.134.997-.268.29-.134.52-.334.74-.4h.005c.467-.135.835-.402 1.044-.7zm2.185 8.958c.037.6.343 1.245.882 1.377.588.134 1.434-.333 1.791-.765l.211-.01c.315-.007.577.01.847.268l.003.003c.208.199.305.53.391.876.085.4.154.78.409 1.066.486.527.645.906.636 1.14l.003-.007v.018l-.003-.012c-.015.262-.185.396-.498.595-.63.401-1.746.712-2.457 1.57-.618.737-1.37 1.14-2.036 1.191-.664.053-1.237-.2-1.574-.898l-.005-.003c-.21-.4-.12-1.025.086-1.692.206-.668.5-1.344.543-1.925.053-.714.063-1.335.145-1.814.083-.468.234-.812.607-1.027l.018-.01z"/>
    </svg>
  );
}

export default function Home() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownloadExtension = async () => {
    setDownloading('extension');
    try {
      const response = await fetch('/api/download-extension');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'deepseek-agent-extension.zip';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(null);
    }
  };

  const version = 'v0.0.1';
  const releaseUrl = `https://github.com/DingDing-bbb/deepseek-agent/releases/tag/${version}`;
  const downloadUrl = 'https://github.com/DingDing-bbb/deepseek-agent/releases/download/v0.0.1';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-xl">DeepSeek Agent</span>
              <Badge variant="secondary" className="ml-2">{version}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="https://github.com/DingDing-bbb/deepseek-agent" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                GitHub
              </Button>
            </a>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-4 py-12 text-center">
          <Badge variant="outline" className="mb-6 px-4 py-1">
            🤖 让 AI 成为你的专属编程助手
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-slate-900 via-indigo-800 to-purple-800 dark:from-white dark:via-indigo-200 dark:to-purple-200 bg-clip-text text-transparent">
            DeepSeek Agent
            <br />
            本地文件 & 命令执行
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10">
            通过 Electron 桌面应用 + 浏览器插件，让 DeepSeek AI 可以访问本地文件系统、执行命令行操作，
            成为真正的编程助手。
          </p>
        </section>

        {/* Download Section */}
        <section className="max-w-5xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">下载安装</h2>
            <p className="text-slate-600 dark:text-slate-400">选择适合你系统的版本</p>
          </div>

          {/* Desktop Downloads */}
          <Card className="border-slate-200 dark:border-slate-800 mb-6">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Monitor className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">桌面应用</CardTitle>
                  <CardDescription>本地服务，文件访问 & 命令执行</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Windows */}
                <a 
                  href={`${downloadUrl}/DeepSeek-Agent-Desktop-Setup-0.0.1.exe`}
                  className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <WindowsIconSVG />
                  </div>
                  <div>
                    <div className="font-medium">Windows</div>
                    <div className="text-xs text-slate-500">.exe 安装包</div>
                  </div>
                  <Download className="w-4 h-4 ml-auto text-slate-400" />
                </a>

                {/* macOS */}
                <a 
                  href={`${downloadUrl}/DeepSeek-Agent-Desktop-0.0.1.dmg`}
                  className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-500/10 flex items-center justify-center text-gray-500">
                    <AppleIconSVG />
                  </div>
                  <div>
                    <div className="font-medium">macOS</div>
                    <div className="text-xs text-slate-500">.dmg 安装包</div>
                  </div>
                  <Download className="w-4 h-4 ml-auto text-slate-400" />
                </a>

                {/* Linux */}
                <a 
                  href={`${downloadUrl}/DeepSeek-Agent-Desktop-0.0.1.AppImage`}
                  className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700"
                >
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                    <LinuxIconSVG />
                  </div>
                  <div>
                    <div className="font-medium">Linux</div>
                    <div className="text-xs text-slate-500">.AppImage</div>
                  </div>
                  <Download className="w-4 h-4 ml-auto text-slate-400" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Extension & Source Code */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Browser Extension */}
            <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                    <Puzzle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">浏览器插件</CardTitle>
                    <CardDescription>连接 DeepSeek Chat 和桌面应用</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  支持 Chrome、Edge、Brave、Firefox 浏览器
                </p>
                <Button 
                  className="w-full"
                  onClick={handleDownloadExtension}
                  disabled={downloading === 'extension'}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {downloading === 'extension' ? '下载中...' : '下载插件 ZIP'}
                </Button>
              </CardContent>
            </Card>

            {/* Source Code */}
            <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <FileCode className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">源代码</CardTitle>
                    <CardDescription>完整项目源码</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  包含桌面应用、浏览器插件、网页展示完整源码
                </p>
                <div className="flex gap-3">
                  <a 
                    href={`https://github.com/DingDing-bbb/deepseek-agent/archive/refs/tags/${version}.zip`}
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full">
                      <Package className="w-4 h-4 mr-2" />
                      ZIP
                    </Button>
                  </a>
                  <a 
                    href={`https://github.com/DingDing-bbb/deepseek-agent/archive/refs/tags/${version}.tar.gz`}
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full">
                      <Package className="w-4 h-4 mr-2" />
                      TAR.GZ
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Release Notes */}
          <div className="mt-6 text-center">
            <a 
              href={releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-500 hover:underline"
            >
              查看完整 Release Notes →
            </a>
          </div>
        </section>

        {/* Features Grid */}
        <section className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">功能特点</h2>
            <p className="text-slate-600 dark:text-slate-400">
              本地运行，安全可控
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-indigo-500" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-4xl mx-auto px-4 py-12">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle>工作原理</CardTitle>
              <CardDescription>
                桌面应用通过 WebSocket 与浏览器插件通信
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-900 rounded-xl p-6 text-center">
                <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-2">
                      <Puzzle className="w-8 h-8 text-white" />
                    </div>
                    <span className="text-white font-medium">浏览器插件</span>
                    <span className="text-slate-400 text-sm">DeepSeek Chat</span>
                  </div>
                  
                  <div className="flex flex-col items-center text-slate-400">
                    <span className="text-sm mb-1">WebSocket</span>
                    <span className="text-xs">端口 3777</span>
                    <div className="hidden md:block text-2xl">←→</div>
                    <div className="md:hidden text-2xl">↕</div>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-2">
                      <Monitor className="w-8 h-8 text-white" />
                    </div>
                    <span className="text-white font-medium">桌面应用</span>
                    <span className="text-slate-400 text-sm">Electron</span>
                  </div>
                  
                  <div className="flex flex-col items-center text-slate-400">
                    <span className="text-sm mb-1">访问</span>
                    <div className="text-2xl">↓</div>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-xl bg-slate-700 flex items-center justify-center mb-2">
                      <Terminal className="w-8 h-8 text-white" />
                    </div>
                    <span className="text-white font-medium">文件系统</span>
                    <span className="text-slate-400 text-sm">Shell 命令</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Installation Steps */}
        <section className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">安装步骤</h2>
            <p className="text-slate-600 dark:text-slate-400">
              只需简单几步，即可开始使用
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((item, index) => (
              <div key={index} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl mb-4">
                    {item.step}
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Detailed Installation */}
        <section className="max-w-4xl mx-auto px-4 py-8">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle>详细安装说明</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="desktop">
                <TabsList className="mb-4">
                  <TabsTrigger value="desktop">桌面应用</TabsTrigger>
                  <TabsTrigger value="extension">浏览器插件</TabsTrigger>
                </TabsList>
                <TabsContent value="desktop" className="space-y-4">
                  <div className="space-y-4 text-sm">
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 flex-shrink-0">1</div>
                      <span>在上方选择对应平台下载安装包</span>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 flex-shrink-0">2</div>
                      <span>安装并启动应用，应用会在系统托盘显示图标</span>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 flex-shrink-0">3</div>
                      <span>点击「选择文件夹」，设置 AI 可访问的工作目录</span>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-600 dark:text-green-300 flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span>应用会在后台运行，监听 WebSocket 端口 3777</span>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="extension" className="space-y-4">
                  <div className="space-y-4 text-sm">
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 flex-shrink-0">1</div>
                      <span>点击上方「下载插件 ZIP」按钮获取插件压缩包</span>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 flex-shrink-0">2</div>
                      <div>
                        <span>解压后打开浏览器扩展管理页面：</span>
                        <ul className="mt-2 ml-4 space-y-1 text-slate-600 dark:text-slate-400">
                          <li>• Chrome: <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">chrome://extensions/</code></li>
                          <li>• Edge: <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">edge://extensions/</code></li>
                          <li>• Brave: <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">brave://extensions/</code></li>
                        </ul>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 flex-shrink-0">3</div>
                      <span>开启「开发者模式」，点击「加载已解压的扩展程序」</span>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-600 dark:text-green-300 flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span>完成！访问 chat.deepseek.com 即可使用 Agent 按钮</span>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">DeepSeek Agent</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <a href="https://github.com/DingDing-bbb/deepseek-agent" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500">
                GitHub
              </a>
              <span>MIT License</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
