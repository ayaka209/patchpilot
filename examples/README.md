# PatchPilot Examples

[中文](#中文说明)

A collection of practical user script examples for PatchPilot.

## User Script Basics

Every PatchPilot user script follows the same signature:

```javascript
function(content, url) {
  // content: the original response body (string)
  // url: the full URL that was intercepted
  // MUST return a string (the modified content)
  return content;
}
```

## Examples

| Example | Description | Difficulty |
|---------|-------------|------------|
| [API Response Mock](./api-response-mock.md) | Mock and modify JSON API responses | Beginner |
| [JS Hotfix](./js-hotfix.md) | Patch production JS bugs without redeploying | Intermediate |
| [CSS Override](./css-override.md) | Override remote stylesheets on the fly | Beginner |
| [Debug Logging](./debug-logging.md) | Inject logging into remote scripts for debugging | Intermediate |
| [Import & Export](./import-export.md) | Share rule sets with your team via JSON | Beginner |

## Tips

- **URL Pattern** is a JavaScript regular expression. Use `.*` for wildcards, `\.` for literal dots.
- User scripts run in the **MAIN world** (Lite Mode) or via **CDP** (Full Mode) — both have full access to the response body.
- If your script throws an error, PatchPilot returns the **original content** unmodified and logs the error.
- Use **Full Mode** if you need to intercept synchronous `<script src>` tags in the initial HTML.

---

<a id="中文说明"></a>

# PatchPilot 示例文档

一组实用的 PatchPilot 用户脚本示例。

## 用户脚本基础

每个 PatchPilot 用户脚本遵循相同的函数签名：

```javascript
function(content, url) {
  // content: 原始响应体（字符串）
  // url: 被拦截的完整 URL
  // 必须返回字符串（修改后的内容）
  return content;
}
```

## 示例列表

| 示例 | 说明 | 难度 |
|------|------|------|
| [API 响应模拟](./api-response-mock.md) | 模拟和修改 JSON API 响应 | 入门 |
| [JS 热修复](./js-hotfix.md) | 无需重新部署即可修补生产环境 JS Bug | 中级 |
| [CSS 覆盖](./css-override.md) | 即时覆盖远程样式表 | 入门 |
| [调试日志注入](./debug-logging.md) | 向远程脚本注入日志以便调试 | 中级 |
| [导入与导出](./import-export.md) | 通过 JSON 与团队共享规则集 | 入门 |

## 小贴士

- **URL 匹配模式** 是 JavaScript 正则表达式。用 `.*` 做通配符，`\.` 匹配字面量的点。
- 用户脚本在 **MAIN world**（Lite Mode）或通过 **CDP**（Full Mode）运行，都能完整访问响应体。
- 如果脚本抛出异常，PatchPilot 会返回**原始内容**不做修改，并记录错误日志。
- 如果需要拦截 HTML 中的同步 `<script src>` 标签，请使用 **Full Mode**。
