[English](./README.md)

# PatchPilot

基于 URL 模式匹配和用户脚本的动态响应拦截与修改 Chrome MV3 扩展程序。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Vue 3](https://img.shields.io/badge/Vue-3-green.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)

## 功能特性

PatchPilot 允许开发者和高级用户即时拦截并修改网络响应。通过定义 URL 正则表达式规则并编写自定义 JavaScript “用户脚本”，匹配的响应在交付给网页之前将通过您的逻辑进行处理。

- 匹配的网络响应在交付给页面之前会经过用户脚本处理。
- **用户脚本签名**：`function(content, url) { return modifiedContent; }`
- **典型使用场景**：对来自 `https://host.chanjet.com/tplus/UserFiles/tonggrid-*.js` 的旧版 JS 文件进行补丁修复，在不更改服务器端的情况下修复 Bug 或添加新功能。
- **多语言支持**：支持英文和中文，自动检测浏览器语言。

## 双引擎架构

PatchPilot 采用两种不同的拦截引擎，以平衡性能与功能：

### Lite Mode (默认)
使用 MAIN world 的 fetch/XHR 重写，并结合 `MutationObserver`。
- **无调试横幅**：在页面上下文中静默运行。
- **拦截范围**：`fetch()`、`XMLHttpRequest` 以及动态插入的 `<script>` 和 `<link>` 标签。
- **⚠️ 限制**：无法拦截页面加载时 HTML 中已存在的同步 `<script src="...">` 标签。

### Full Mode
使用 `chrome.debugger` (Chrome DevTools Protocol) 和 `Fetch.requestPaused`。
- **显示 Chrome 调试横幅**：“PatchPilot 正在调试此浏览器”（无法隐藏）。
- **拦截范围**：所有网络请求，包括同步 `<script src>` 标签。
- **启用方式**：用户必须在扩展程序设置中显式开启此模式。

## 已知限制 (至关重要)

### `<script src>` 竞态条件 (Lite Mode)
Content scripts 无法拦截页面加载时 HTML 中已经存在的同步脚本标签。当 MAIN world 拦截引擎初始化时，这些脚本通常已经被浏览器获取并执行。这是 Manifest V3 的底层浏览器限制，而非 Bug。

- **解决方案**：切换到 **Full Mode** (chrome.debugger)，它在任何脚本执行之前的网络层级进行拦截。
- **原因**：MV3 移除了 `webRequestBlocking`，且 `declarativeNetRequest` 无法修改响应体。MAIN world 脚本注入发生在 HTML 解析开始之后。

### 其他限制
- **时序依赖**：Lite Mode 的 fetch/XHR 拦截依赖于规则在页面脚本触发前完成加载。
- **Chrome 调试横幅**：在 Full Mode 下，横幅是 Chrome 强制的安全特性，无法隐藏。
- **仅限文本资源**：仅支持修改文本类资源（JS、CSS、HTML、JSON）。不支持二进制数据（图像、字体）。
- **浏览器支持**：仅限 Chrome（需要 MV3 和 CDP 支持）。

## 安装方法 (开发版)

1. 克隆仓库。
2. 安装依赖：
   ```bash
   pnpm install
   ```
3. 构建扩展程序：
   ```bash
   pnpm build
   ```
4. 在 Chrome 中加载扩展程序：
   - 打开 `chrome://extensions`
   - 开启“开发者模式”
   - 点击“加载已解压的扩展程序”
   - 选择 `.output/chrome-mv3/` 目录。

## 开发指南

- `pnpm dev` — 启动带有热重载的开发模式。
- `pnpm build` — 创建生产环境构建。
- `pnpm test` — 运行单元测试（59 个测试）。
- `pnpm test:e2e` — 运行 Playwright E2E 测试（7 个测试）。

## 项目结构

- `entrypoints/background.ts` — Service worker (编排与 Full Mode)
- `entrypoints/content.ts` — Content script (ISOLATED world 桥接)
- `entrypoints/injected.ts` — 拦截引擎 (MAIN world / Lite Mode)
- `entrypoints/popup/` — 弹出窗口 UI (Vue 3)
- `entrypoints/options/` — 选项页面 (Vue 3)
- `utils/storage.ts` — 存储 CRUD (chrome.storage.local)
- `utils/matcher.ts` — URL 正则匹配逻辑
- `utils/logger.ts` — 匹配日志记录 (环形缓冲区)
- `utils/debugger-engine.ts` — CDP Fetch 引擎 (Full Mode)
- `utils/i18n.ts` — 国际化工具
- `utils/types.ts` — TypeScript 类型定义
- `locales/en.json` — 英文语言包
- `locales/zh-CN.json` — 中文语言包
- `components/` — Vue 组件
- `components/LanguageSwitcher.vue` — 语言切换组件
- `composables/` — Vue composables

## 用户脚本示例

### 1. 简单字符串替换
```javascript
function(content, url) {
  return content.replace('oldValue', 'newValue');
}
```

### 2. JSON 响应修改
```javascript
function(content, url) {
  const data = JSON.parse(content);
  data.patchpilot = "modified";
  return JSON.stringify(data);
}
```

### 3. CSS 注入/覆盖
```javascript
function(content, url) {
  return content + "\nbody { background-color: #f0f0f0 !important; }";
}
```

## 技术栈

- **WXT 0.20.x**：基于 Vite 的 Web Extension 框架。
- **Vue 3**：用于构建响应式 UI 的 Composition API。
- **TypeScript**：贯穿整个项目的类型安全。
- **Vitest**：单元测试框架。
- **Playwright**：E2E 测试框架。

## 参与贡献

欢迎提交 Issue 或 Pull Request 来改进 PatchPilot。对于重大更改，请先开 Issue 讨论您想要更改的内容。

## 作者

GitHub 用户 [ayaka209](https://github.com/ayaka209)

## 开源协议

本项目采用 [MIT](LICENSE) 协议。
