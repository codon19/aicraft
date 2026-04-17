# 执行计划（exec-plans）

这里是**中大型改动开工前**的路线图存放地。AI 在动手之前要先读这里对应的 active 计划，避免"一路写得很顺但方向跑偏"。

## 什么算"中大型"

**必须**写计划的：

- 新增一个 `packages/*` 下的包
- 新增 / 重命名 / 删除任何 MCP tool
- 修改任何 tool 的 input/output schema（哪怕只是加字段）
- 跨包的重构 / 公共工具抽取
- 引入新的运行时依赖（zod、mcp sdk 以外的新 npm 包）

**不需要**写计划的：

- typo / 格式化 / 注释微调
- 单文件内 < 30 行的 bug 修复
- README 的拼写 / 排版更新
- `docs/` 内部内容润色（不改结构）

## 目录约定

| 目录 | 含义 |
| --- | --- |
| `active/` | 正在进行中。AI 动手前必读。 |
| `completed/` | 已完成 / 已发布。按需归档参考，不影响当前决策。 |

## 命名规范

```
YYYY-MM-DD-<short-kebab>.md
```

- 日期取**创建日**，不是完成日
- kebab 名要短但能识别。例子：
  - `2026-04-20-swagger-call-api-streaming.md`
  - `2026-05-02-new-pkg-mcp-datasource.md`
  - `2026-05-10-bridge-zod-migration.md`

## 生命周期

1. 从 [../templates/exec-plan-template.md](../templates/exec-plan-template.md) 复制一份到 `active/`
2. 填写元信息、目标、非目标、方案要点，**状态设为 `draft`**
3. 与 AI / 自己过一遍 [prd-checklist.md](../templates/prd-checklist.md)，补齐追问
4. **状态改为 `active`** 开始编码
5. 编码中遇到的偏差写进"追问区"，不改写前文
6. 完成后：
   - 状态改为 `completed`
   - 追加 "## 实际落地差异" 段（如有）
   - `git mv` 到 `completed/`

## 与 PR 的关系

- 一份 active 计划通常对应 1-N 个 PR
- PR 描述里引用对应计划路径，例如：`See docs/exec-plans/active/2026-04-20-swagger-call-api-streaming.md`
- PR merge 前，如果该计划已全部完成，在同一 PR 里把它 `git mv` 到 `completed/` 并加上落地差异小节
