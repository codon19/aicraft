# 文档导航

这个 `docs/` 目录是 `aicraft` monorepo 的"知识地图"。`AGENTS.md` 只负责给 AI 一个短入口，所有需要展开的内容都在这里分层放置。

## 目录总览

| 目录 | 用途 | 何时读 / 何时写 |
| --- | --- | --- |
| [`product-specs/`](./product-specs/) | 每个包的产品摘要（问题定义、目标用户、核心能力、边界、验收） | 设计新 tool、评审需求、给 AI 补上下文时读；新增 / 调整能力时同步写 |
| [`exec-plans/`](./exec-plans/) | 中大型改动的执行计划（active 进行中，completed 已归档） | 开始中大型改动前写；完成后移入 `completed/` |
| [`templates/`](./templates/) | 可复用模板（需求澄清 prompt、五个清楚 checklist、执行计划骨架） | 需求澄清、PRD 自检、起草执行计划时读 |
| [`references/`](./references/) | 第三方库 / 协议的精选参考（llms.txt 等） | 给 AI 喂外部上下文时读；按需补充 |

## 针对常见动作的读文顺序

### 要给 `mcp-swagger` 加一个新 tool

1. 读 [packages/mcp-swagger/AGENTS.md](../packages/mcp-swagger/AGENTS.md) 确认硬约束
2. 读 [docs/product-specs/mcp-swagger.md](./product-specs/mcp-swagger.md) 看现有能力边界
3. 把 [docs/templates/requirement-clarification-prompt.md](./templates/requirement-clarification-prompt.md) 粘到 Cursor chat，让 AI 追问澄清
4. 澄清完成后，按 [docs/templates/exec-plan-template.md](./templates/exec-plan-template.md) 在 `docs/exec-plans/active/` 建一份计划
5. 编码 → 更新 README 和 `product-specs/mcp-swagger.md` → 把 plan 移到 `completed/`

### 要新增一个 MCP 包

1. 在 [docs/exec-plans/active/](./exec-plans/active/) 建立计划，覆盖包名、作用域、初始 tool 集合
2. 参考现有两个包的 `AGENTS.md` 为新包起草一份同等结构的 `AGENTS.md`
3. 新增 `docs/product-specs/<pkg>.md`
4. 在根 `AGENTS.md` 的 Repo map 段追加一行

### 写 PRD / 做需求自检

直接打开 [docs/templates/prd-checklist.md](./templates/prd-checklist.md)，对照"五个清楚"逐项打钩。

## 维护约定

- 本文件只做导航，**不**沉淀具体内容
- 每次增删子目录，记得同步更新上面的"目录总览"表
- 行为变化必须和文档更新在**同一个 PR** 里（来自根 `AGENTS.md` 的硬约束）
