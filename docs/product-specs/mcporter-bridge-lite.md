# `@codon/mcporter-bridge-lite` 产品摘要

> 源包：[packages/mcporter-bridge-lite](../../packages/mcporter-bridge-lite/)
> 详细 setup / 环境变量：见该包 [README.md](../../packages/mcporter-bridge-lite/README.md)
> 硬约束（开发者向）：[packages/mcporter-bridge-lite/AGENTS.md](../../packages/mcporter-bridge-lite/AGENTS.md)

---

## 问题定义

[mcporter](https://github.com/nicepkg/mcporter) 是一个可以统一管理多个 MCP server 的 CLI 工具，但它对外是命令行形态——MCP 客户端（Cursor / Claude Desktop / Continue）不能直接以 MCP 协议调用它。每次要挂一个新的 mcporter 托管的 server，用户得手动在 `~/.cursor/mcp.json` 里配一条。

本包提供一个**单进程的 MCP stdio bridge**：客户端只需要挂载这一个 server，即可通过三个工具列出、查看、调用任意 mcporter 下托管的 MCP。

## 目标用户

- **主要**：已经用 mcporter 管理多个 MCP server、希望在 Cursor 里"一键访问全部"的工程师
- **次要**：希望让 agent 动态发现并调用其他 MCP 工具的自动化流程
- **非目标用户**：不使用 mcporter 的用户（本包**只**是 bridge，不是独立的 MCP server 库）

## 核心能力

| Tool | 用途 | 关键参数 |
| --- | --- | --- |
| `mcporter_list_servers` | 列出 mcporter 已知的所有 MCP server | `timeoutMs?` |
| `mcporter_help` | 查看指定 server 的 tool schema 和文档 | `server`, `timeoutMs?` |
| `mcporter_call_tool` | 调用某个 server 上的某个 tool | `server`, `tool`, `argsJson?`, `timeoutMs?` |

### 关键特性

- **极致轻量**：只做协议桥接，不缓存、不改写、不做业务逻辑
- **全量 zod schema**：所有 tool 参数走 zod 校验，schema 即文档
- **可配置 bin 路径**：通过 `MCPORTER_BIN` 环境变量指向非默认安装路径

## 边界

### 在范围内

- 把 mcporter 的 `list` / `help` / 调用能力以 MCP 协议暴露
- 透传 mcporter 的返回结果，不做二次解析 / 格式化
- 在启动时检查 mcporter bin 是否可用，失败时给出可读错误

### 不在范围内（非目标）

- **不**实现任何业务 tool（所有业务工具由 mcporter 下托管的 server 自己提供）
- **不**缓存 tool schema（每次 `mcporter_help` 调用都穿透到 CLI，换取一致性）
- **不**做 mcporter 本身的安装 / 升级（由用户自行 `npm i -g mcporter`）
- **不**扩展成"重型版 bridge"（如果未来需要缓存、重写、代理策略，请起一个新包 `mcporter-bridge` 或 `mcporter-gateway`，不要污染本包的 "lite" 定位）

## 验收标准

- [ ] 任何 tool 新增 / 变更时，README Tools 段与本文件 Core capabilities 表同步
- [ ] 所有对外 tool 的 input schema 用 `zod` 声明，无手写 JSON Schema
- [ ] `mcporter` bin 不可用时，启动阶段即抛出带 hint 的错误（提示 `MCPORTER_BIN` 配置）
- [ ] 发布前在本机验证：列 / 查 / 调用 三条主路径在真实 mcporter 环境里跑通
- [ ] 保持"lite"身份：任何 PR 引入本包内的业务逻辑 / 缓存层必须先建 exec-plan 讨论

## 关联文档

- 包内硬约束：[packages/mcporter-bridge-lite/AGENTS.md](../../packages/mcporter-bridge-lite/AGENTS.md)
- Setup / env vars / 示例：[packages/mcporter-bridge-lite/README.md](../../packages/mcporter-bridge-lite/README.md)
- mcporter 上游：<https://github.com/nicepkg/mcporter>
