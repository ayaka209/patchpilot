# Import & Export / 导入与导出

[Back to Examples](./README.md)

---

## Scenario / 场景

You want to share PatchPilot rules with teammates, back up your configuration, or migrate rules between machines.

你想与团队成员共享 PatchPilot 规则、备份配置，或在不同机器间迁移规则。

---

## Export Format / 导出格式

PatchPilot exports rules as a JSON file with this structure:

PatchPilot 以如下 JSON 结构导出规则：

```json
{
  "version": 1,
  "groups": [
    {
      "id": "group-abc123",
      "name": "Production Hotfixes",
      "enabled": true,
      "order": 0
    }
  ],
  "rules": [
    {
      "id": "rule-def456",
      "groupId": "group-abc123",
      "name": "Fix login timeout",
      "urlPattern": "cdn\\.example\\.com/auth\\.js",
      "script": "return content.replace('timeout: 3000', 'timeout: 10000');",
      "enabled": true,
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    }
  ]
}
```

---

## How to Export / 如何导出

1. Open the PatchPilot **Options** page (right-click extension icon → Options).
2. Scroll to the **Import / Export** section.
3. Click **Export** — a `.json` file will be downloaded.

1. 打开 PatchPilot **选项页面**（右键扩展图标 → 选项）。
2. 滚动到 **导入 / 导出** 区域。
3. 点击 **导出** — 将下载一个 `.json` 文件。

---

## How to Import / 如何导入

1. Open the PatchPilot **Options** page.
2. Click **Import** and select a previously exported `.json` file.
3. Imported rules and groups will be **merged** with existing ones (no duplicates by ID).

1. 打开 PatchPilot **选项页面**。
2. 点击 **导入** 并选择之前导出的 `.json` 文件。
3. 导入的规则和分组将与现有数据**合并**（按 ID 去重）。

---

## Team Sharing Workflow / 团队共享工作流

```
Developer A                    Developer B
    │                              │
    ├─ Creates rules               │
    ├─ Tests & verifies            │
    ├─ Exports .json ──────────►   │
    │                              ├─ Imports .json
    │                              ├─ Rules active immediately
    │                              └─ Can modify independently
```

### Recommended Practice / 推荐做法

- Keep exported JSON files in your project's Git repo (e.g., `patches/patchpilot-rules.json`).
- Use group names to organize rules by purpose: `"Production Hotfixes"`, `"Dev Mocks"`, `"Debug Tools"`.
- Disable groups you don't need instead of deleting them.

- 将导出的 JSON 文件保存在项目 Git 仓库中（如 `patches/patchpilot-rules.json`）。
- 用分组名称按用途组织规则：`"生产热修复"`、`"开发模拟"`、`"调试工具"`。
- 不需要的分组禁用即可，无需删除。

---

## Example: Pre-built Rule Set / 示例：预置规则集

Save this as a `.json` file and import it into PatchPilot:

将以下内容保存为 `.json` 文件并导入 PatchPilot：

```json
{
  "version": 1,
  "groups": [
    {
      "id": "grp-demo",
      "name": "Demo Rules",
      "enabled": true,
      "order": 0
    }
  ],
  "rules": [
    {
      "id": "rule-demo-1",
      "groupId": "grp-demo",
      "name": "Mock user API",
      "urlPattern": "api\\.example\\.com/users/me",
      "script": "const d = JSON.parse(content); d.user.role = 'admin'; return JSON.stringify(d);",
      "enabled": true,
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    },
    {
      "id": "rule-demo-2",
      "groupId": "grp-demo",
      "name": "Hide cookie banner",
      "urlPattern": "example\\.com/.*\\.css",
      "script": "return content + '\\n.cookie-banner { display: none !important; }';",
      "enabled": true,
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    }
  ]
}
```
