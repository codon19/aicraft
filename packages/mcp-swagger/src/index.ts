#!/usr/bin/env node
/**
 * MCP Server — Swagger/OpenAPI documentation search.
 *
 * Fetches the OpenAPI spec from a Knife4j / Swagger backend,
 * builds an in-memory index, and exposes search + browse tools via MCP (stdio).
 *
 * Environment variables:
 *   SWAGGER_BASE_URL  — required, e.g. http://10.15.10.9:18888
 *   OPENAI_API_KEY    — optional, enables semantic (embedding) search
 *   OPENAI_BASE_URL   — optional, default https://api.openai.com/v1
 *   EMBEDDING_MODEL   — optional, default text-embedding-3-small
 */

import * as readline from "node:readline";
import { exec } from "node:child_process";

// ─── Types ──────────────────────────────────────────────────────

interface ApiEndpoint {
  method: string;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  operationId: string;
  parameters: ParameterInfo[];
  requestBody: string;
  responses: Record<string, string>;
}

interface ParameterInfo {
  name: string;
  in: string;
  required: boolean;
  type: string;
  description: string;
}

interface SwaggerResource {
  name: string;
  url: string;
  location: string;
}

// ─── State ──────────────────────────────────────────────────────

const BASE_URL = process.env.SWAGGER_BASE_URL;
if (!BASE_URL) {
  process.stderr.write("Error: SWAGGER_BASE_URL environment variable is required.\n");
  process.exit(1);
}

const EMBEDDING_API_KEY = process.env.OPENAI_API_KEY || "";
const EMBEDDING_BASE_URL =
  process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "text-embedding-3-small";

let endpoints: ApiEndpoint[] = [];
let tags: Map<string, string[]> = new Map();
let groupName = "default";
let loadError = "";

let embeddingIndex: number[][] = [];
let embeddingReady = false;
let rawSpecs: any[] = [];

function buildDocUrl(ep: ApiEndpoint): string {
  const tag = encodeURIComponent(ep.tags[0] || "default");
  const opId = encodeURIComponent(ep.operationId);
  return `${BASE_URL}/doc.html#/${groupName}/${tag}/${opId}`;
}

// ─── Embedding Engine ───────────────────────────────────────────

function buildSearchText(ep: ApiEndpoint): string {
  return `${ep.method} ${ep.path} ${ep.summary} ${ep.description} ${ep.tags.join(" ")}`;
}

async function callEmbeddingApi(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${EMBEDDING_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${EMBEDDING_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
  };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function buildEmbeddingIndex(): Promise<void> {
  if (!EMBEDDING_API_KEY) {
    process.stderr.write(
      "No OPENAI_API_KEY set, semantic search disabled\n",
    );
    return;
  }

  try {
    const texts = endpoints.map(buildSearchText);
    const BATCH_SIZE = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const embeddings = await callEmbeddingApi(batch);
      allEmbeddings.push(...embeddings);
      process.stderr.write(
        `  Embedded ${allEmbeddings.length}/${texts.length} endpoints\n`,
      );
    }

    embeddingIndex = allEmbeddings;
    embeddingReady = true;
    process.stderr.write(
      `Embedding index ready (${embeddingIndex.length} vectors, dim=${embeddingIndex[0]?.length})\n`,
    );
  } catch (e: any) {
    process.stderr.write(`Embedding index failed: ${e.message}\n`);
  }
}

async function semanticSearch(
  query: string,
  limit: number,
): Promise<{ endpoint: ApiEndpoint; score: number }[]> {
  const [queryVec] = await callEmbeddingApi([query]);
  const scored = endpoints.map((ep, i) => ({
    endpoint: ep,
    score: cosineSimilarity(queryVec, embeddingIndex[i]),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ─── OpenAPI Spec Loader ────────────────────────────────────────

function resolveRef(ref: string, spec: any): any {
  const parts = ref.replace(/^#\//, "").split("/");
  let current = spec;
  for (const part of parts) {
    current = current?.[part];
  }
  return current;
}

function extractSchemaPreview(schema: any, spec: any, depth = 0): string {
  if (!schema || depth > 3) return "{}";

  if (schema.$ref) {
    schema = resolveRef(schema.$ref, spec);
    if (!schema) return "{}";
  }

  if (schema.type === "array" && schema.items) {
    return `[${extractSchemaPreview(schema.items, spec, depth + 1)}]`;
  }

  if (schema.type === "object" || schema.properties) {
    const props = schema.properties || {};
    const lines: string[] = [];
    for (const [key, val] of Object.entries(props) as [string, any][]) {
      const resolved = val.$ref ? resolveRef(val.$ref, spec) : val;
      const type = resolved?.type || "object";
      const desc = resolved?.description || "";
      const required = (schema.required || []).includes(key);
      lines.push(
        `  ${key}${required ? "*" : ""}: ${type}${desc ? ` // ${desc}` : ""}`,
      );
    }
    return `{\n${lines.join("\n")}\n}`;
  }

  return schema.type || "unknown";
}

function parseEndpoints(spec: any): ApiEndpoint[] {
  const result: ApiEndpoint[] = [];
  const paths = spec.paths || {};

  for (const [path, methods] of Object.entries(paths) as [string, any][]) {
    for (const [method, operation] of Object.entries(methods) as [
      string,
      any,
    ][]) {
      if (
        ["get", "post", "put", "delete", "patch"].indexOf(method) === -1
      )
        continue;

      const params: ParameterInfo[] = (operation.parameters || []).map(
        (p: any) => {
          const resolved = p.$ref ? resolveRef(p.$ref, spec) : p;
          return {
            name: resolved.name || "",
            in: resolved.in || "",
            required: resolved.required || false,
            type: resolved.schema?.type || resolved.type || "",
            description: resolved.description || "",
          };
        },
      );

      let requestBody = "";
      if (operation.requestBody) {
        const content = operation.requestBody.content || {};
        const jsonSchema = content["application/json"]?.schema;
        if (jsonSchema) {
          requestBody = extractSchemaPreview(jsonSchema, spec);
        }
      }
      if (!requestBody) {
        const bodyParam = (operation.parameters || []).find(
          (p: any) => p.in === "body",
        );
        if (bodyParam?.schema) {
          requestBody = extractSchemaPreview(bodyParam.schema, spec);
        }
      }

      const responses: Record<string, string> = {};
      for (const [code, resp] of Object.entries(
        operation.responses || {},
      ) as [string, any][]) {
        const schema =
          resp.content?.["application/json"]?.schema || resp.schema;
        if (schema) {
          responses[code] = extractSchemaPreview(schema, spec);
        } else {
          responses[code] = resp.description || "";
        }
      }

      result.push({
        method: method.toUpperCase(),
        path,
        summary: operation.summary || "",
        description: operation.description || "",
        tags: operation.tags || [],
        operationId: operation.operationId || "",
        parameters: params,
        requestBody,
        responses,
      });
    }
  }

  return result;
}

async function loadSpec(): Promise<void> {
  try {
    let specUrls: string[] = [];
    try {
      const res = await fetch(`${BASE_URL}/swagger-resources`);
      if (res.ok) {
        const resources = (await res.json()) as SwaggerResource[];
        specUrls = resources.map((r) => r.url || r.location);
        if (resources.length > 0 && resources[0].name) {
          groupName = resources[0].name;
        }
      }
    } catch {
      // Not a Knife4j server, try common paths
    }

    if (specUrls.length === 0) {
      specUrls = [
        "/v2/api-docs",
        "/v3/api-docs",
        "/v2/api-docs?group=default",
      ];
    }

    for (const url of specUrls) {
      try {
        const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
        const res = await fetch(fullUrl);
        if (!res.ok) continue;
        const spec = await res.json();
        rawSpecs.push(spec);
        const parsed = parseEndpoints(spec);
        endpoints.push(...parsed);
      } catch {
        continue;
      }
    }

    tags = new Map();
    for (const ep of endpoints) {
      for (const tag of ep.tags) {
        if (!tags.has(tag)) tags.set(tag, []);
        tags.get(tag)!.push(`${ep.method} ${ep.path}`);
      }
    }

    process.stderr.write(
      `Loaded ${endpoints.length} API endpoints, ${tags.size} tags\n`,
    );
  } catch (e: any) {
    loadError = e.message;
    process.stderr.write(`Failed to load spec: ${e.message}\n`);
  }
}

// ─── TypeScript Type Generator ──────────────────────────────────

function findRawOperation(
  path: string,
  method: string,
): { operation: any; spec: any } | null {
  for (const spec of rawSpecs) {
    const op = spec.paths?.[path]?.[method.toLowerCase()];
    if (op) return { operation: op, spec };
  }
  return null;
}

function toPascalCase(str: string): string {
  const result = str
    .replace(/[«»<>]/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, " ")
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");
  return /^[0-9]/.test(result) ? `_${result}` : result;
}

function operationToTypeName(ep: ApiEndpoint): string {
  if (ep.operationId) return toPascalCase(ep.operationId);
  const parts = ep.path
    .split("/")
    .filter(Boolean)
    .map((s) => s.replace(/[{}]/g, ""));
  return toPascalCase(`${ep.method.toLowerCase()}_${parts.join("_")}`);
}

function schemaToTs(
  schema: any,
  spec: any,
  namedTypes: Map<string, string>,
  indent: string,
  depth: number,
): string {
  if (!schema || depth > 8) return "unknown";

  if (schema.$ref) {
    const refName = schema.$ref.split("/").pop()!;
    const tsName = toPascalCase(refName);
    if (!namedTypes.has(tsName)) {
      namedTypes.set(tsName, "");
      const resolved = resolveRef(schema.$ref, spec);
      if (resolved) {
        namedTypes.set(
          tsName,
          buildInterfaceBody(resolved, spec, namedTypes, 0),
        );
      }
    }
    return tsName;
  }

  if (schema.allOf) {
    const parts = schema.allOf
      .map((s: any) => schemaToTs(s, spec, namedTypes, indent, depth + 1))
      .filter((p: string) => p !== "unknown");
    return parts.length > 0 ? parts.join(" & ") : "unknown";
  }

  if (schema.oneOf || schema.anyOf) {
    return (schema.oneOf || schema.anyOf)
      .map((s: any) => schemaToTs(s, spec, namedTypes, indent, depth + 1))
      .join(" | ");
  }

  if (schema.enum) {
    return schema.enum
      .map((v: any) => (typeof v === "string" ? `'${v}'` : String(v)))
      .join(" | ");
  }

  if (schema.type === "array") {
    if (!schema.items) return "unknown[]";
    const itemType = schemaToTs(
      schema.items,
      spec,
      namedTypes,
      indent,
      depth + 1,
    );
    return itemType.includes("|") || itemType.includes("&")
      ? `(${itemType})[]`
      : `${itemType}[]`;
  }

  if (schema.type === "object" || schema.properties) {
    if (!schema.properties) {
      if (
        schema.additionalProperties &&
        typeof schema.additionalProperties === "object"
      ) {
        const vt = schemaToTs(
          schema.additionalProperties,
          spec,
          namedTypes,
          indent + "  ",
          depth + 1,
        );
        return `Record<string, ${vt}>`;
      }
      return "Record<string, unknown>";
    }
    const lines: string[] = [];
    const req = new Set<string>(schema.required || []);
    for (const [key, val] of Object.entries(schema.properties) as [
      string,
      any,
    ][]) {
      const ps = val.$ref ? resolveRef(val.$ref, spec) || val : val;
      if (ps.description) lines.push(`${indent}/** ${ps.description} */`);
      const opt = req.has(key) ? "" : "?";
      const t = schemaToTs(val, spec, namedTypes, indent + "  ", depth + 1);
      lines.push(`${indent}${key}${opt}: ${t}`);
    }
    const closing = indent.length >= 2 ? indent.slice(2) : "";
    return `{\n${lines.join("\n")}\n${closing}}`;
  }

  switch (schema.type) {
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "file":
      return "File";
    default:
      return "unknown";
  }
}

function buildInterfaceBody(
  schema: any,
  spec: any,
  namedTypes: Map<string, string>,
  depth: number,
): string {
  if (!schema || depth > 8) return "";
  if (schema.$ref) schema = resolveRef(schema.$ref, spec);
  if (!schema?.properties) return "";

  const lines: string[] = [];
  const req = new Set<string>(schema.required || []);
  for (const [key, val] of Object.entries(schema.properties) as [
    string,
    any,
  ][]) {
    const ps = val.$ref ? resolveRef(val.$ref, spec) || val : val;
    if (ps.description) lines.push(`  /** ${ps.description} */`);
    const opt = req.has(key) ? "" : "?";
    const t = schemaToTs(val, spec, namedTypes, "    ", depth + 1);
    lines.push(`  ${key}${opt}: ${t}`);
  }
  return lines.join("\n");
}

function generateTsForEndpoint(
  ep: ApiEndpoint,
  namedTypes: Map<string, string>,
): string {
  const raw = findRawOperation(ep.path, ep.method);
  if (!raw) return `// Could not find raw spec for ${ep.method} ${ep.path}`;
  const { operation, spec } = raw;
  const sections: string[] = [];
  const baseName = operationToTypeName(ep);

  const resps = operation.responses || {};
  const okResp: any =
    resps["200"] || resps["201"] || Object.values(resps)[0];
  if (okResp) {
    const schema =
      okResp.content?.["application/json"]?.schema || okResp.schema;
    if (schema) {
      const tsType = schemaToTs(schema, spec, namedTypes, "  ", 0);
      const name = `${baseName}Response`;
      sections.push(
        tsType.startsWith("{")
          ? `export interface ${name} ${tsType}`
          : `export type ${name} = ${tsType}`,
      );
    }
  }

  let reqSchema: any = null;
  if (operation.requestBody) {
    reqSchema = operation.requestBody.content?.["application/json"]?.schema;
  }
  if (!reqSchema) {
    const bp = (operation.parameters || []).find(
      (p: any) => p.in === "body",
    );
    if (bp?.schema) reqSchema = bp.schema;
  }
  if (reqSchema) {
    const tsType = schemaToTs(reqSchema, spec, namedTypes, "  ", 0);
    const name = `${baseName}Request`;
    sections.push(
      tsType.startsWith("{")
        ? `export interface ${name} ${tsType}`
        : `export type ${name} = ${tsType}`,
    );
  }

  const header = `// ${ep.method} ${ep.path}${ep.summary ? `  ${ep.summary}` : ""}`;
  return [header, ...sections].join("\n");
}

function generateTsTypes(
  path?: string,
  method?: string,
  tag?: string,
): string {
  if (loadError)
    return JSON.stringify({ error: `Failed to load spec: ${loadError}` });
  if (endpoints.length === 0)
    return JSON.stringify({ error: "No endpoints loaded." });

  let targets: ApiEndpoint[] = [];

  if (path) {
    targets = endpoints.filter((ep) => {
      const pm = ep.path === path || ep.path.endsWith(path);
      return method ? pm && ep.method === method.toUpperCase() : pm;
    });
    if (targets.length === 0) {
      const fuzzy = endpoints.filter((ep) =>
        ep.path.toLowerCase().includes(path.toLowerCase()),
      );
      return JSON.stringify({
        error: "Path not found." + (fuzzy.length > 0 ? " Did you mean:" : ""),
        ...(fuzzy.length > 0 && {
          suggestions: fuzzy
            .slice(0, 5)
            .map((e) => `${e.method} ${e.path}`),
        }),
      });
    }
  } else if (tag) {
    targets = endpoints.filter((ep) =>
      ep.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase())),
    );
    if (targets.length === 0)
      return JSON.stringify({
        error: `No endpoints found for tag: ${tag}`,
      });
  } else {
    return JSON.stringify({
      error: 'Provide "path" or "tag" to generate types.',
    });
  }

  const namedTypes = new Map<string, string>();
  const sections = targets.map((ep) =>
    generateTsForEndpoint(ep, namedTypes),
  );

  const models: string[] = [];
  for (const [name, body] of namedTypes) {
    models.push(
      body
        ? `export interface ${name} {\n${body}\n}`
        : `export type ${name} = Record<string, unknown>`,
    );
  }

  return [...models, "", ...sections].filter(Boolean).join("\n\n");
}

// ─── Tool Definitions ───────────────────────────────────────────

const TOOLS = [
  {
    name: "search_api",
    description:
      'Search backend API endpoints by keyword or semantic similarity. mode: "keyword" (exact), "semantic" (embedding), "auto" (keyword first, semantic fallback, default).',
    inputSchema: {
      type: "object" as const,
      properties: {
        keyword: {
          type: "string",
          description: "Search query — keyword or natural language description",
        },
        mode: {
          type: "string",
          description:
            '"keyword" | "semantic" | "auto" (default)',
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
    description:
      "List all API tags/groups with endpoint counts.",
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
    name: "generate_ts_types",
    description:
      "Generate TypeScript interface/type definitions from API endpoint response and request body schemas. Resolves all $ref references recursively. Provide path (single endpoint) or tag (all endpoints in a group).",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: 'API path to generate types for, e.g. "/api/v1/users"',
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
      },
    },
  },
];

// ─── Tool Implementations ───────────────────────────────────────

function keywordSearch(keyword: string, tag?: string): ApiEndpoint[] {
  const kw = keyword.toLowerCase();
  let results = endpoints.filter((ep) => {
    const haystack = [
      ep.path,
      ep.summary,
      ep.description,
      ep.operationId,
      ...ep.tags,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(kw);
  });
  if (tag) {
    results = results.filter((ep) =>
      ep.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase())),
    );
  }
  return results;
}

async function searchApi(
  keyword: string,
  mode = "auto",
  tag?: string,
  limit = 10,
): Promise<string> {
  if (loadError)
    return JSON.stringify({ error: `Failed to load spec: ${loadError}` });
  if (endpoints.length === 0)
    return JSON.stringify({
      error: "No endpoints loaded. Check SWAGGER_BASE_URL.",
    });

  if (mode === "keyword") {
    const results = keywordSearch(keyword, tag).slice(0, limit);
    return JSON.stringify({
      mode: "keyword",
      total: results.length,
      results: results.map((ep) => ({
        method: ep.method,
        path: ep.path,
        summary: ep.summary,
        tags: ep.tags,
        doc_url: buildDocUrl(ep),
      })),
    });
  }

  if (mode === "semantic") {
    if (!embeddingReady) {
      return JSON.stringify({
        error:
          "Semantic search not available. Set OPENAI_API_KEY to enable.",
      });
    }
    try {
      let scored = await semanticSearch(keyword, limit * 2);
      if (tag) {
        scored = scored.filter((s) =>
          s.endpoint.tags.some((t) =>
            t.toLowerCase().includes(tag!.toLowerCase()),
          ),
        );
      }
      const top = scored.slice(0, limit);
      return JSON.stringify({
        mode: "semantic",
        total: top.length,
        results: top.map((s) => ({
          method: s.endpoint.method,
          path: s.endpoint.path,
          summary: s.endpoint.summary,
          tags: s.endpoint.tags,
          score: Math.round(s.score * 1000) / 1000,
          doc_url: buildDocUrl(s.endpoint),
        })),
      });
    } catch (e: any) {
      return JSON.stringify({
        error: `Semantic search failed: ${e.message}`,
      });
    }
  }

  // Auto mode
  const kwResults = keywordSearch(keyword, tag);
  if (kwResults.length >= 3) {
    const limited = kwResults.slice(0, limit);
    return JSON.stringify({
      mode: "keyword",
      total: kwResults.length,
      results: limited.map((ep) => ({
        method: ep.method,
        path: ep.path,
        summary: ep.summary,
        tags: ep.tags,
        doc_url: buildDocUrl(ep),
      })),
    });
  }

  if (embeddingReady) {
    try {
      let scored = await semanticSearch(keyword, limit * 2);
      if (tag) {
        scored = scored.filter((s) =>
          s.endpoint.tags.some((t) =>
            t.toLowerCase().includes(tag!.toLowerCase()),
          ),
        );
      }
      const kwPaths = new Set(
        kwResults.map((ep) => `${ep.method} ${ep.path}`),
      );
      const merged: {
        endpoint: ApiEndpoint;
        score: number;
        exact: boolean;
      }[] = [];
      for (const ep of kwResults) {
        merged.push({ endpoint: ep, score: 1.0, exact: true });
      }
      for (const s of scored) {
        const key = `${s.endpoint.method} ${s.endpoint.path}`;
        if (!kwPaths.has(key)) {
          merged.push({ endpoint: s.endpoint, score: s.score, exact: false });
        }
      }
      const top = merged.slice(0, limit);
      return JSON.stringify({
        mode: "auto (semantic fallback)",
        total: top.length,
        results: top.map((s) => ({
          method: s.endpoint.method,
          path: s.endpoint.path,
          summary: s.endpoint.summary,
          tags: s.endpoint.tags,
          score: Math.round(s.score * 1000) / 1000,
          exact_match: s.exact || undefined,
          doc_url: buildDocUrl(s.endpoint),
        })),
      });
    } catch {
      // fall through to keyword-only
    }
  }

  const limited = kwResults.slice(0, limit);
  return JSON.stringify({
    mode: "keyword (semantic unavailable)",
    total: kwResults.length,
    results: limited.map((ep) => ({
      method: ep.method,
      path: ep.path,
      summary: ep.summary,
      tags: ep.tags,
      doc_url: buildDocUrl(ep),
    })),
  });
}

function getApiDetail(path: string, method?: string): string {
  if (loadError)
    return JSON.stringify({ error: `Failed to load spec: ${loadError}` });

  const matches = endpoints.filter((ep) => {
    const pathMatch = ep.path === path || ep.path.endsWith(path);
    if (!method) return pathMatch;
    return pathMatch && ep.method === method.toUpperCase();
  });

  if (matches.length === 0) {
    const fuzzy = endpoints.filter((ep) =>
      ep.path.toLowerCase().includes(path.toLowerCase()),
    );
    if (fuzzy.length > 0) {
      return JSON.stringify({
        error: "Exact path not found. Did you mean one of these?",
        suggestions: fuzzy
          .slice(0, 5)
          .map((ep) => `${ep.method} ${ep.path}`),
      });
    }
    return JSON.stringify({ error: `No endpoint found for path: ${path}` });
  }

  return JSON.stringify(
    matches.map((ep) => ({
      method: ep.method,
      path: ep.path,
      summary: ep.summary,
      description: ep.description,
      tags: ep.tags,
      parameters: ep.parameters,
      requestBody: ep.requestBody || undefined,
      responses: ep.responses,
      doc_url: buildDocUrl(ep),
    })),
  );
}

function listTags(): string {
  if (loadError)
    return JSON.stringify({ error: `Failed to load spec: ${loadError}` });

  const result: Record<string, number> = {};
  for (const [tag, paths] of tags.entries()) {
    result[tag] = paths.length;
  }
  return JSON.stringify({ total_endpoints: endpoints.length, tags: result });
}

function listTagApis(tag: string): string {
  if (loadError)
    return JSON.stringify({ error: `Failed to load spec: ${loadError}` });

  const matching = endpoints.filter((ep) =>
    ep.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase())),
  );

  if (matching.length === 0) {
    return JSON.stringify({ error: `No endpoints found for tag: ${tag}` });
  }

  return JSON.stringify({
    tag,
    count: matching.length,
    endpoints: matching.map((ep) => ({
      method: ep.method,
      path: ep.path,
      summary: ep.summary,
      doc_url: buildDocUrl(ep),
    })),
  });
}

function openApiDoc(path: string, method?: string): string {
  if (loadError)
    return JSON.stringify({ error: `Failed to load spec: ${loadError}` });

  const matches = endpoints.filter((ep) => {
    const pathMatch = ep.path === path || ep.path.endsWith(path);
    if (!method) return pathMatch;
    return pathMatch && ep.method === method.toUpperCase();
  });

  if (matches.length === 0) {
    return JSON.stringify({ error: `No endpoint found for path: ${path}` });
  }

  const ep = matches[0];
  const url = buildDocUrl(ep);

  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? "open"
      : platform === "win32"
        ? "start"
        : "xdg-open";
  exec(`${cmd} "${url}"`);

  return JSON.stringify({
    opened: true,
    method: ep.method,
    path: ep.path,
    summary: ep.summary,
    doc_url: url,
  });
}

async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
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
    case "generate_ts_types":
      return generateTsTypes(
        args.path as string | undefined,
        args.method as string | undefined,
        args.tag as string | undefined,
      );
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// ─── JSON-RPC / MCP stdio transport ─────────────────────────────

type JsonRpcMessage = {
  jsonrpc: "2.0";
  id?: number;
  method: string;
  params?: Record<string, unknown>;
};

function send(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function handleMessage(msg: JsonRpcMessage): void {
  if (msg.id === undefined) return;

  switch (msg.method) {
    case "initialize":
      send({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "mcp-swagger", version: "0.1.0" },
        },
      });
      break;

    case "tools/list":
      send({
        jsonrpc: "2.0",
        id: msg.id,
        result: { tools: TOOLS },
      });
      break;

    case "tools/call": {
      const params = msg.params as
        | { name: string; arguments: Record<string, unknown> }
        | undefined;
      if (!params) {
        send({
          jsonrpc: "2.0",
          id: msg.id,
          error: { code: -32602, message: "Missing params" },
        });
        return;
      }
      handleToolCall(params.name, params.arguments ?? {}).then((text) => {
        send({
          jsonrpc: "2.0",
          id: msg.id,
          result: { content: [{ type: "text", text }] },
        });
      });
      break;
    }

    default:
      send({
        jsonrpc: "2.0",
        id: msg.id,
        error: {
          code: -32601,
          message: `Method not found: ${msg.method}`,
        },
      });
  }
}

// ─── Main ───────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const msg = JSON.parse(trimmed) as JsonRpcMessage;
    handleMessage(msg);
  } catch {
    // Ignore malformed input
  }
});

loadSpec()
  .then(() => buildEmbeddingIndex())
  .then(() => {
    process.stderr.write(`mcp-swagger ready (${BASE_URL})\n`);
  });
