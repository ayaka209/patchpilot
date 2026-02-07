# Debug Logging / 调试日志注入

[Back to Examples](./README.md)

---

## Scenario / 场景

You need to debug a remote script but can't add `console.log` to the source. PatchPilot lets you inject logging statements into the response before execution.

你需要调试远程脚本，但无法在源码中添加 `console.log`。PatchPilot 可以在脚本执行前向响应中注入日志语句。

---

## Example 1: Log all function calls / 记录所有函数调用

**URL Pattern**: `cdn\.example\.com/app\.js`

```javascript
function(content, url) {
  const wrapper = `
    console.log('[PatchPilot] Script loaded:', '${url}');
    console.time('[PatchPilot] Execution time');
  `;
  const footer = `
    console.timeEnd('[PatchPilot] Execution time');
  `;
  return wrapper + '\n' + content + '\n' + footer;
}
```

Wraps the script with timing logs to measure execution duration.

用计时日志包裹脚本，测量执行耗时。

---

## Example 2: Intercept specific function calls / 拦截特定函数调用

**URL Pattern**: `cdn\.example\.com/checkout\.js`

```javascript
function(content, url) {
  const hook = `
    const _originalSubmitOrder = window.submitOrder;
    window.submitOrder = function(...args) {
      console.log('[PatchPilot] submitOrder called with:', JSON.stringify(args, null, 2));
      console.trace('[PatchPilot] Call stack:');
      return _originalSubmitOrder.apply(this, args);
    };
  `;
  return content + '\n' + hook;
}
```

Monkey-patches `submitOrder` to log arguments and call stack.

对 `submitOrder` 进行猴子补丁，记录参数和调用栈。

---

## Example 3: Log API request/response pairs / 记录 API 请求响应对

**URL Pattern**: `cdn\.example\.com/api-client\.js`

```javascript
function(content, url) {
  const logger = `
    const _origFetch = window.fetch;
    window.fetch = async function(input, init) {
      const reqUrl = typeof input === 'string' ? input : input.url;
      console.group('[PatchPilot] fetch: ' + reqUrl);
      console.log('Request:', { method: init?.method || 'GET', body: init?.body });
      const resp = await _origFetch.call(this, input, init);
      const clone = resp.clone();
      clone.text().then(body => {
        console.log('Response:', resp.status, body.substring(0, 500));
        console.groupEnd();
      });
      return resp;
    };
  `;
  return logger + '\n' + content;
}
```

Wraps `fetch` to log every request and response in grouped console output.

包装 `fetch` 以在分组控制台输出中记录每个请求和响应。

---

## Example 4: Add error boundary / 添加错误边界

**URL Pattern**: `cdn\.example\.com/main-.*\.js`

```javascript
function(content, url) {
  return `
    window.addEventListener('error', function(e) {
      console.error('[PatchPilot] Uncaught error:', e.message, 'at', e.filename + ':' + e.lineno);
    });
    window.addEventListener('unhandledrejection', function(e) {
      console.error('[PatchPilot] Unhandled promise rejection:', e.reason);
    });
  ` + '\n' + content;
}
```

Adds global error listeners before the script runs.

在脚本运行前添加全局错误监听器。

---

## Mode Recommendation / 模式建议

- **Lite Mode**: Sufficient for dynamically loaded scripts.
- **Full Mode**: Use when debugging scripts loaded via `<script src>` in the initial HTML.

- **Lite Mode**：对动态加载的脚本足够。
- **Full Mode**：调试 HTML 中通过 `<script src>` 加载的脚本时使用。
