# @codon/mcporter-bridge-lite

An MCP (Model Context Protocol) stdio server that bridges to the [mcporter](https://github.com/nicepkg/mcporter) CLI. It lets any MCP client — like Cursor, Claude Desktop, or Continue — list servers, inspect tool schemas, and call tools managed by mcporter, all through a single lightweight process.

## Prerequisites

- **Node.js** >= 18
- **mcporter** CLI installed and available on `PATH` (or set `MCPORTER_BIN`)

## Installation

```bash
npm install -g @codon/mcporter-bridge-lite
```

Or run directly with npx:

```bash
npx @codon/mcporter-bridge-lite
```

## Configuration

### Cursor

Add to your `~/.cursor/mcp.json`:

```json
{
  "mcServers": {
    "mcporter": {
      "command": "npx",
      "args": ["-y", "@codon/mcporter-bridge-lite"]
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "mcporter": {
      "command": "npx",
      "args": ["-y", "@codon/mcporter-bridge-lite"]
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCPORTER_BIN` | `mcporter` | Path to the mcporter binary |

## Tools

### `mcporter_list_servers`

List all MCP servers known to mcporter.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `timeoutMs` | number | No | Command timeout in milliseconds (default: 30000) |

### `mcporter_help`

Show tool schema and documentation for a specific MCP server.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `server` | string | Yes | MCP server name, e.g. `dingtalk-ai-table` |
| `timeoutMs` | number | No | Command timeout in milliseconds |

### `mcporter_call_tool`

Call a tool on a mcporter-managed MCP server.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `server` | string | Yes | MCP server name |
| `tool` | string | Yes | Tool name inside the MCP server |
| `argsJson` | string | No | JSON string of arguments |
| `timeoutMs` | number | No | Command timeout in milliseconds |

---

## 中文说明

一个轻量级的 MCP (Model Context Protocol) stdio 服务器，作为 [mcporter](https://github.com/nicepkg/mcporter) CLI 的桥接层。它允许任何 MCP 客户端（如 Cursor、Claude Desktop、Continue）通过一个进程即可列出服务器、查看工具定义和调用 mcporter 管理的工具。

### 前置条件

- **Node.js** >= 18
- **mcporter** CLI 已安装并在 `PATH` 中可用（或通过 `MCPORTER_BIN` 环境变量指定路径）

### 安装

```bash
npm install -g @codon/mcporter-bridge-lite
```

或通过 npx 直接运行：

```bash
npx @codon/mcporter-bridge-lite
```

### 配置

在 Cursor 的 `~/.cursor/mcp.json` 中添加：

```json
{
  "mcServers": {
    "mcporter": {
      "command": "npx",
      "args": ["-y", "@codon/mcporter-bridge-lite"]
    }
  }
}
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MCPORTER_BIN` | `mcporter` | mcporter 可执行文件路径 |

### 提供的工具

| 工具 | 说明 |
|------|------|
| `mcporter_list_servers` | 列出 mcporter 已知的所有 MCP 服务器 |
| `mcporter_help` | 查看指定 MCP 服务器的工具定义和文档 |
| `mcporter_call_tool` | 调用 mcporter 管理的某个 MCP 工具 |

## License

MIT
