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
