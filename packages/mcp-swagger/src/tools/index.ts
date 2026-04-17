import { searchApi } from "./search.js";
import { getApiDetail } from "./detail.js";
import { listTags, listTagApis } from "./tags.js";
import { openApiDoc } from "./doc.js";
import { callApi } from "./call.js";
import { reloadSpec } from "./reload.js";
import { checkUpdates } from "./check_updates.js";
import { generateTypes } from "../generator/index.js";
import { ensureFresh } from "../freshness.js";

/**
 * Tools that do NOT need a pre-flight freshness check:
 *  - reload_spec: already forces a full reload
 *  - check_updates: internally calls ensureFresh()
 *  - call_api: unrelated to the spec cache
 */
const SKIP_FRESHNESS = new Set(["reload_spec", "check_updates", "call_api"]);

export const TOOLS = [
  {
    name: "search_api",
    description:
      'Search backend API endpoints by keyword or semantic similarity. mode: "keyword" (exact), "semantic" (embedding), "auto" (keyword first, semantic fallback, default).',
    inputSchema: {
      type: "object" as const,
      properties: {
        keyword: {
          type: "string",
          description:
            "Search query — keyword or natural language description",
        },
        mode: {
          type: "string",
          description: '"keyword" | "semantic" | "auto" (default)',
        },
        tag: { type: "string", description: "Filter by tag/group name" },
        limit: {
          type: "number",
          description: "Max results (default: 10)",
        },
      },
      required: ["keyword"],
    },
  },
  {
    name: "get_api_detail",
    description:
      "Get full details of a specific API endpoint including parameters, request body schema, and response schema.",
    inputSchema: {
      type: "object" as const,
      properties: {
        method: {
          type: "string",
          description: "HTTP method: GET, POST, PUT, DELETE, PATCH",
        },
        path: {
          type: "string",
          description: 'API path, e.g. "/api/v1/users"',
        },
      },
      required: ["path"],
    },
  },
  {
    name: "list_api_tags",
    description: "List all API tags/groups with endpoint counts.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_tag_apis",
    description: "List all API endpoints under a specific tag/group.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tag: {
          type: "string",
          description: "Tag/group name to list endpoints for",
        },
      },
      required: ["tag"],
    },
  },
  {
    name: "open_api_doc",
    description:
      "Open a specific API endpoint's documentation page in the default browser (Knife4j UI).",
    inputSchema: {
      type: "object" as const,
      properties: {
        method: {
          type: "string",
          description: "HTTP method: GET, POST, PUT, DELETE, PATCH",
        },
        path: {
          type: "string",
          description: 'API path, e.g. "/api/v1/users"',
        },
      },
      required: ["path"],
    },
  },
  {
    name: "generate_types",
    description:
      'Generate typed code from API endpoint schemas. Supports TypeScript (interfaces) and Dart (classes with fromJson/toJson). Resolves all $ref references recursively. Provide path (single endpoint) or tag (all endpoints in a group).',
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description:
            'API path to generate types for, e.g. "/api/v1/users"',
        },
        method: {
          type: "string",
          description:
            "HTTP method filter (optional, defaults to all methods for the path)",
        },
        tag: {
          type: "string",
          description:
            "Generate types for all endpoints under this tag/group name",
        },
        language: {
          type: "string",
          description: '"typescript" (default) or "dart"',
        },
      },
    },
  },
  {
    name: "reload_spec",
    description:
      "Force a full reload of the OpenAPI/Swagger spec from the backend. Prefer `check_updates` for routine freshness — it uses conditional GETs and only reloads when something changed.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "check_updates",
    description:
      "Check whether the backend API spec has changed since last load, using HTTP conditional GET (ETag / Last-Modified / sha256 fallback). Cheap — 304 responses are ~5ms. If changes are detected, the spec is auto-reloaded and a diff of added/removed endpoint paths is returned.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "call_api",
    description:
      "Make a real HTTP request to any URL and return the live response. Auto-detects HTTP method from Swagger spec if the URL path matches a known endpoint. All headers, auth, and base URL must be provided by the caller (typically configured via a project-level Skill).",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description:
            'Full request URL, e.g. "https://api.example.com/api/v1/users"',
        },
        method: {
          type: "string",
          description:
            "HTTP method: GET, POST, PUT, DELETE, PATCH (auto-detected from Swagger spec if omitted)",
        },
        body: {
          type: "object",
          description: "JSON request body (for POST/PUT/PATCH)",
        },
        query: {
          type: "object",
          description: "URL query parameters as key-value pairs",
        },
        headers: {
          type: "object",
          description:
            "HTTP headers to send (Content-Type defaults to application/json when body is present)",
        },
        timeout: {
          type: "number",
          description: "Request timeout in ms (default: 30000)",
        },
      },
      required: ["url"],
    },
  },
];

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  if (!SKIP_FRESHNESS.has(name)) {
    await ensureFresh();
  }

  switch (name) {
    case "search_api":
      return searchApi(
        args.keyword as string,
        (args.mode as string) || "auto",
        args.tag as string | undefined,
        (args.limit as number) || 10,
      );
    case "get_api_detail":
      return getApiDetail(
        args.path as string,
        args.method as string | undefined,
      );
    case "list_api_tags":
      return listTags();
    case "list_tag_apis":
      return listTagApis(args.tag as string);
    case "open_api_doc":
      return openApiDoc(
        args.path as string,
        args.method as string | undefined,
      );
    case "generate_types":
      return generateTypes(
        args.path as string | undefined,
        args.method as string | undefined,
        args.tag as string | undefined,
        (args.language as string) || "typescript",
      );
    case "reload_spec":
      return reloadSpec();
    case "check_updates":
      return checkUpdates();
    case "call_api":
      return callApi({
        url: args.url as string,
        method: args.method as string | undefined,
        body: args.body as Record<string, unknown> | undefined,
        query: args.query as Record<string, unknown> | undefined,
        headers: args.headers as Record<string, string> | undefined,
        timeout: args.timeout as number | undefined,
      });
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
