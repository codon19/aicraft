# @codon/mcp-swagger

MCP Server for Swagger/OpenAPI documentation — search, browse, and generate typed code (TypeScript / Dart) from your backend API specs.

Compatible with **Knife4j**, **Swagger 2.0**, and **OpenAPI 3.0**.

## Features

| Tool | Description |
|------|-------------|
| `search_api` | Search endpoints by keyword or semantic similarity (embedding) |
| `get_api_detail` | Get full details of a specific endpoint (params, request body, response schema) |
| `list_api_tags` | List all tags/groups with endpoint counts |
| `list_tag_apis` | List all endpoints under a specific tag |
| `open_api_doc` | Open the Knife4j doc page in the browser |
| `generate_types` | Generate TypeScript interfaces or Dart classes from API schemas |
| `check_updates` | Detect backend spec changes via conditional GET (ETag / Last-Modified / sha256) and auto-reload with a diff of added/removed endpoints |
| `reload_spec` | Force a full reload of the OpenAPI spec |

### Automatic freshness checks

Every tool call (except `reload_spec`, `check_updates`, `call_api`) transparently issues an HTTP conditional GET against each cached spec URL:

- **304 Not Modified** → cache hit, ~5ms overhead on an internal LAN, tool proceeds immediately
- **200 OK with same sha256** → still unchanged, tool proceeds
- **200 OK with new content** → spec is auto-reloaded, embedding index rebuilt, tool then runs against fresh data

This means the agent is always querying the latest backend spec without you ever having to call `reload_spec`. Network errors are swallowed — the cached spec is used so transient upstream issues never break tool calls.

For remote/slow backends you can throttle these checks with `SWAGGER_FRESHNESS_THROTTLE_MS` (see below).

### Type Generation

`generate_types` resolves all `$ref` references recursively and produces ready-to-use code:

- **TypeScript** — `export interface` / `export type` with JSDoc comments
- **Dart** — Full classes with `final` fields, `const` constructor, `fromJson()`, `toJson()`, null-safety

Specify a single endpoint (`path` + `method`) or batch-generate for an entire tag.

## Setup

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SWAGGER_BASE_URL` | Yes | Backend URL, e.g. `http://10.15.10.9:18888` |
| `OPENAI_API_KEY` | No | Enables semantic (embedding) search |
| `OPENAI_BASE_URL` | No | Custom embedding API base (default: `https://api.openai.com/v1`) |
| `EMBEDDING_MODEL` | No | Embedding model name (default: `text-embedding-3-small`) |
| `SWAGGER_REFRESH_INTERVAL` | No | Background auto-refresh interval in minutes (default: `0` = disabled). Complementary to the per-call freshness check |
| `SWAGGER_LOAD_RETRIES` | No | Max retry attempts on startup (default: `3`) |
| `SWAGGER_FRESHNESS_THROTTLE_MS` | No | Minimum interval between per-call freshness checks (default: `0` = check on every tool call). Set to a positive value (e.g. `30000`) for remote backends where ETag round-trips are expensive |

### Cursor MCP Config

**From npm:**

```json
{
  "mcpServers": {
    "swagger": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@codon/mcp-swagger"],
      "env": {
        "SWAGGER_BASE_URL": "http://10.15.10.9:18888"
      }
    }
  }
}
```

**Local development:**

```json
{
  "mcpServers": {
    "swagger": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/mcp-swagger/dist/index.js"],
      "env": {
        "SWAGGER_BASE_URL": "http://10.15.10.9:18888"
      }
    }
  }
}
```

## Usage

In Cursor chat, just describe what you need in natural language:

```
搜一下用户相关的接口
```

```
生成 POST /api/user/list 的 TypeScript 类型
```

```
生成「订单管理」分组下所有接口的 Dart 类，写到 lib/models/order.dart
```

The AI will automatically call the appropriate MCP tools.

## Example Output

### TypeScript

```typescript
export interface ResultPageUserVO {
  /** 状态码 */
  code?: number
  /** 消息 */
  message?: string
  data?: PageUserVO
}

export interface PageUserVO {
  records?: UserVO[]
  total?: number
}

export type ListUserResponse = ResultPageUserVO
```

### Dart

```dart
class UserVO {
  /// 用户ID
  final int? id;
  /// 用户名
  final String? name;
  /// 角色列表
  final List<RoleVO>? roles;

  const UserVO({this.id, this.name, this.roles});

  factory UserVO.fromJson(Map<String, dynamic> json) {
    return UserVO(
      id: json['id'] as int?,
      name: json['name'] as String?,
      roles: (json['roles'] as List<dynamic>?)
          ?.map((e) => RoleVO.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'roles': roles?.map((e) => e.toJson()).toList(),
    };
  }
}
```

## Development

```bash
pnpm install
pnpm build        # Compile TypeScript
pnpm dev          # Run with tsx (hot reload)
```

## License

MIT
