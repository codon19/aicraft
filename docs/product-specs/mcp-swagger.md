# `@codon/mcp-swagger` 产品摘要

> 源包：[packages/mcp-swagger](../../packages/mcp-swagger/)
> 详细 setup / 环境变量：见该包 [README.md](../../packages/mcp-swagger/README.md)
> 硬约束（开发者向）：[packages/mcp-swagger/AGENTS.md](../../packages/mcp-swagger/AGENTS.md)

---

## 问题定义

后端 API 规范（Swagger 2.0 / OpenAPI 3.0 / Knife4j）信息量大、分散在 Web 文档页里，人工查找接口、拼请求、写前端类型，是高频但低创造性的劳动。AI 编码助手在没有结构化接口上下文时，只能靠"猜字段"，容易生成不符合契约的代码。

本包通过 MCP 协议把一份 Swagger 文档变成一组结构化工具，让 AI 可以**按名搜索、按 tag 浏览、按 endpoint 取完整 schema、按需生成类型代码**，同时用条件 GET 自动感知后端变更。

## 目标用户

- **主要**：使用 Cursor / Claude Desktop / Continue 等 MCP 客户端开发前端、移动端或 SDK 的工程师
- **次要**：需要让 agent 感知后端契约变化的全栈 / 自动化流程
- **非目标用户**：纯后端 API 设计阶段的使用者（本工具是"消费侧"而非"设计侧"）

## 核心能力

以下是当前对外暴露的 MCP tool 集合。**任何增删改都必须同步更新此表和 [README.md](../../packages/mcp-swagger/README.md) 的 Features 表。**

| Tool | 类别 | 用途 |
| --- | --- | --- |
| `search_api` | 查询 | 关键字或语义（embedding）搜 endpoint |
| `get_api_detail` | 查询 | 返回某 endpoint 的完整参数、请求体、响应 schema |
| `list_api_tags` | 查询 | 列出所有 tag/分组及各自 endpoint 数 |
| `list_tag_apis` | 查询 | 列出某 tag 下的所有 endpoint |
| `open_api_doc` | 副作用 | 在浏览器打开 Knife4j 文档页 |
| `generate_types` | 生成 | 输出 TypeScript interface 或 Dart class |
| `check_updates` | 元控制 | 主动对比后端 spec 是否变化，返回增删 diff |
| `reload_spec` | 元控制 | 强制重新拉取并重建索引 |
| `call_api` | 副作用 | 直接按 spec 调用后端 endpoint（用于联调） |

### 关键特性

- **自动 freshness check**：除 `check_updates` / `reload_spec` / `call_api` 外，每次 tool 调用都会对缓存的 spec URL 发一次条件 GET（304 → 命中，200 sha256 变化 → 自动重载）。LAN 内开销约 5ms，远程场景可用 `SWAGGER_FRESHNESS_THROTTLE_MS` 节流。
- **语义搜索**：配置 `OPENAI_API_KEY` 后 `search_api` 启用 embedding；无 key 时自动退化为关键字匹配。
- **多规范兼容**：Swagger 2.0、OpenAPI 3.0、Knife4j。

## 边界

### 在范围内

- 把一份 spec（远程 URL 或本地文件）结构化暴露给 MCP 客户端
- 自动感知 spec 更新并透明重建索引
- 基于 spec 生成 TypeScript / Dart 类型代码（含 `$ref` 递归解析）

### 不在范围内（非目标）

- 不做 spec 的可视化 UI（交给 Knife4j / Swagger UI）
- 不做 API 设计 / 编辑功能（只消费不生产）
- 不为 gRPC / GraphQL / AsyncAPI 提供支持（另起包）
- 不在本包内做 mock server（交给其他工具）

## 验收标准

- [ ] 新增 / 修改 tool 时，README Features 表、本文件 Core capabilities 表、`packages/mcp-swagger/AGENTS.md` 三处同步更新
- [ ] `search_api` 在有 / 无 `OPENAI_API_KEY` 时行为均可观察（日志或返回字段区分）
- [ ] `check_updates` 返回可被 AI 直接解析的 diff 结构（added / removed endpoints 列表）
- [ ] 自动 freshness check **不会**在 `check_updates` / `reload_spec` / `call_api` 三个 tool 上触发
- [ ] 破坏性 schema 变更时，发布前完成 minor version bump 并在 README 追加 changelog 条目

## 关联文档

- 包内硬约束：[packages/mcp-swagger/AGENTS.md](../../packages/mcp-swagger/AGENTS.md)
- Setup / env vars / 示例：[packages/mcp-swagger/README.md](../../packages/mcp-swagger/README.md)
- 相关执行计划：见 [docs/exec-plans/active/](../exec-plans/active/) 中文件名含 `swagger` 的项
