# JS Hotfix / JS 热修复

[Back to Examples](./README.md)

---

## Scenario / 场景

A production JS file has a bug, but you can't deploy a fix immediately. PatchPilot lets you patch the response on the fly in your browser.

生产环境的 JS 文件有 Bug，但无法立即部署修复。PatchPilot 可以在浏览器中即时修补响应内容。

---

## Example 1: Fix a typo in a function / 修复函数中的拼写错误

**URL Pattern**: `cdn\.example\.com/app\.bundle\.js`

```javascript
function(content, url) {
  return content.replace(
    'if (user.staus === "active")',
    'if (user.status === "active")'
  );
}
```

Fixes a typo (`staus` → `status`) in the production bundle without redeploying.

修复生产包中的拼写错误（`staus` → `status`），无需重新部署。

---

## Example 2: Replace a broken function / 替换损坏的函数

**URL Pattern**: `cdn\.example\.com/utils-[a-f0-9]+\.js`

```javascript
function(content, url) {
  // Replace the broken calculateTotal function
  return content.replace(
    /function calculateTotal\(items\)\s*\{[^}]*\}/,
    `function calculateTotal(items) {
      return items.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);
    }`
  );
}
```

Uses regex to find and replace an entire function body.

使用正则表达式查找并替换整个函数体。

---

## Example 3: Add a missing null check / 添加缺失的空值检查

**URL Pattern**: `host\.chanjet\.com/tplus/UserFiles/tonggrid-.*\.js`

```javascript
function(content, url) {
  // The original code crashes when row.data is null
  return content.replace(
    'row.data.forEach(',
    '(row.data || []).forEach('
  );
}
```

A real-world example: patching a Chanjet T+ grid component to handle null data gracefully.

真实案例：修补畅捷通 T+ 表格组件，优雅处理空数据。

---

## Example 4: Inject a polyfill / 注入 Polyfill

**URL Pattern**: `cdn\.example\.com/legacy-app\.js`

```javascript
function(content, url) {
  const polyfill = `
    if (!Array.prototype.at) {
      Array.prototype.at = function(index) {
        if (index < 0) index = this.length + index;
        return this[index];
      };
    }
  `;
  return polyfill + '\n' + content;
}
```

Prepends a polyfill before the legacy script executes.

在旧版脚本执行前注入 Polyfill。

---

## Example 5: Multiple replacements / 多处替换

**URL Pattern**: `cdn\.example\.com/vendor\.js`

```javascript
function(content, url) {
  let patched = content;

  // Fix 1: timeout too short
  patched = patched.replace(
    'setTimeout(retry, 1000)',
    'setTimeout(retry, 5000)'
  );

  // Fix 2: wrong API endpoint
  patched = patched.replace(
    'https://old-api.example.com',
    'https://new-api.example.com'
  );

  // Fix 3: disable broken analytics
  patched = patched.replace(
    'analytics.track(',
    '// analytics.track('
  );

  return patched;
}
```

Applies multiple patches in a single script.

在一个脚本中应用多处修补。

---

## Mode Recommendation / 模式建议

- **Lite Mode**: Works for `fetch()`/XHR-loaded scripts and dynamically inserted `<script>` tags.
- **Full Mode**: Required if the target is a synchronous `<script src="...">` in the initial HTML.

- **Lite Mode**：适用于 `fetch()`/XHR 加载的脚本和动态插入的 `<script>` 标签。
- **Full Mode**：如果目标是 HTML 中的同步 `<script src="...">`，则必须使用此模式。
