# CSS Override / CSS 覆盖

[Back to Examples](./README.md)

---

## Scenario / 场景

You want to override styles from a remote CSS file without access to the server. PatchPilot intercepts the CSS response and lets you modify it before the browser applies it.

你想覆盖远程 CSS 文件中的样式，但无法访问服务器。PatchPilot 在浏览器应用样式之前拦截 CSS 响应并允许你修改。

---

## Example 1: Force dark background / 强制深色背景

**URL Pattern**: `cdn\.example\.com/styles/main\.css`

```javascript
function(content, url) {
  return content + `
    body {
      background-color: #1a1a2e !important;
      color: #e0e0e0 !important;
    }
  `;
}
```

Appends dark theme overrides to the end of the stylesheet.

在样式表末尾追加深色主题覆盖。

---

## Example 2: Hide annoying elements / 隐藏烦人的元素

**URL Pattern**: `example\.com/.*\.css`

```javascript
function(content, url) {
  return content + `
    .cookie-banner,
    .newsletter-popup,
    .ads-container,
    #floating-chat-widget {
      display: none !important;
    }
  `;
}
```

Hides cookie banners, popups, ads, and chat widgets via CSS injection.

通过 CSS 注入隐藏 Cookie 横幅、弹窗、广告和聊天组件。

---

## Example 3: Fix layout issues / 修复布局问题

**URL Pattern**: `static\.example\.com/app-[a-f0-9]+\.css`

```javascript
function(content, url) {
  // Fix: sidebar overlaps main content on narrow screens
  return content.replace(
    '.sidebar { position: fixed; width: 280px; }',
    '.sidebar { position: fixed; width: 220px; }'
  ).replace(
    '.main-content { margin-left: 280px; }',
    '.main-content { margin-left: 220px; }'
  );
}
```

Directly patches CSS values to fix a layout bug.

直接修补 CSS 值以修复布局 Bug。

---

## Example 4: Override CSS variables / 覆盖 CSS 变量

**URL Pattern**: `cdn\.example\.com/theme\.css`

```javascript
function(content, url) {
  const overrides = `
    :root {
      --primary-color: #6366f1 !important;
      --font-family: "Inter", sans-serif !important;
      --border-radius: 8px !important;
      --spacing-unit: 6px !important;
    }
  `;
  return overrides + '\n' + content;
}
```

Prepends CSS variable overrides so they take precedence.

在样式表前面注入 CSS 变量覆盖，使其优先生效。

---

## Mode Recommendation / 模式建议

- **Lite Mode**: Works for dynamically loaded `<link>` stylesheets and `fetch()`-loaded CSS.
- **Full Mode**: Required for `<link>` tags in the initial HTML `<head>`.

- **Lite Mode**：适用于动态加载的 `<link>` 样式表和 `fetch()` 加载的 CSS。
- **Full Mode**：如果目标是 HTML `<head>` 中的 `<link>` 标签，则需要此模式。
