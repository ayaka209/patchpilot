# API Response Mock / API 响应模拟

[Back to Examples](./README.md)

---

## Scenario / 场景

You want to mock or modify JSON API responses without touching the backend. Common use cases:
- Test frontend behavior with different API data
- Simulate error responses
- Add missing fields to API responses during development

你想在不修改后端的情况下模拟或修改 JSON API 响应。常见场景：
- 用不同的 API 数据测试前端行为
- 模拟错误响应
- 在开发过程中为 API 响应添加缺失字段

---

## Example 1: Override a specific field / 覆盖指定字段

**URL Pattern**: `api\.example\.com/users/me`

```javascript
function(content, url) {
  const data = JSON.parse(content);
  data.user.role = "admin";
  data.user.permissions = ["read", "write", "delete"];
  return JSON.stringify(data);
}
```

This changes the current user's role to `admin` — useful for testing admin-only UI without backend changes.

将当前用户角色改为 `admin`，无需后端改动即可测试管理员界面。

---

## Example 2: Simulate an error response / 模拟错误响应

**URL Pattern**: `api\.example\.com/orders`

```javascript
function(content, url) {
  return JSON.stringify({
    error: "INTERNAL_SERVER_ERROR",
    message: "Database connection timeout",
    code: 500
  });
}
```

Forces the orders API to return a 500 error. Great for testing error handling UI.

强制订单 API 返回 500 错误，适合测试错误处理界面。

---

## Example 3: Add delay simulation marker / 添加延迟模拟标记

**URL Pattern**: `api\.example\.com/products`

```javascript
function(content, url) {
  const data = JSON.parse(content);
  // Add metadata for debugging
  data._patchpilot = {
    intercepted: true,
    timestamp: new Date().toISOString()
  };
  // Modify product list
  data.products = data.products.map(p => ({
    ...p,
    price: p.price * 0.8  // 20% discount for testing
  }));
  return JSON.stringify(data, null, 2);
}
```

Adds debug metadata and applies a 20% discount to all products for testing pricing UI.

添加调试元数据，并对所有产品打八折以测试价格显示。

---

## Example 4: Mock an entire endpoint / 完全模拟一个接口

**URL Pattern**: `api\.example\.com/feature-flags`

```javascript
function(content, url) {
  // Completely replace the response
  return JSON.stringify({
    flags: {
      newDashboard: true,
      darkMode: true,
      betaFeatures: true,
      experimentalSearch: false
    }
  });
}
```

Overrides feature flags to enable features still behind flags in production.

覆盖功能开关，启用生产环境中仍在灰度的功能。

---

## Mode Recommendation / 模式建议

**Lite Mode** is sufficient for API mocking — `fetch()` and `XMLHttpRequest` are fully intercepted.

**Lite Mode** 足以满足 API 模拟需求 — `fetch()` 和 `XMLHttpRequest` 均可完整拦截。
