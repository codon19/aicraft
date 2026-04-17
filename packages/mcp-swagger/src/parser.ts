import { createHash } from "node:crypto";
import type { ApiEndpoint, ParameterInfo, SwaggerResource } from "./types.js";
import { BASE_URL, LOAD_RETRY_COUNT } from "./config.js";
import { state, resetState } from "./state.js";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function resolveRef(ref: string, spec: any): any {
  const parts = ref.replace(/^#\//, "").split("/");
  let current = spec;
  for (const part of parts) {
    current = current?.[part];
  }
  return current;
}

export function extractSchemaPreview(
  schema: any,
  spec: any,
  depth = 0,
): string {
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

export function parseEndpoints(spec: any, groupName: string): ApiEndpoint[] {
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
        groupName,
      });
    }
  }

  return result;
}

async function loadSpecOnce(): Promise<void> {
  let resourceEntries: { url: string; groupName: string }[] = [];

  try {
    const res = await fetch(`${BASE_URL}/swagger-resources`);
    if (res.ok) {
      const resources = (await res.json()) as SwaggerResource[];
      resourceEntries = resources.map((r) => ({
        url: r.url || r.location,
        groupName: r.name || "default",
      }));
    }
  } catch {
    // Not a Knife4j server, try common paths
  }

  if (resourceEntries.length === 0) {
    resourceEntries = [
      { url: "/v2/api-docs", groupName: "default" },
      { url: "/v3/api-docs", groupName: "default" },
      { url: "/v2/api-docs?group=default", groupName: "default" },
    ];
  }

  const errors: string[] = [];
  for (const entry of resourceEntries) {
    try {
      const fullUrl = entry.url.startsWith("http")
        ? entry.url
        : `${BASE_URL}${entry.url}`;
      const res = await fetch(fullUrl);
      if (!res.ok) {
        errors.push(`${fullUrl} → HTTP ${res.status}`);
        continue;
      }
      const bodyText = await res.text();
      const spec = JSON.parse(bodyText);
      state.rawSpecs.push(spec);
      state.resourceFingerprints.push({
        url: fullUrl,
        groupName: entry.groupName,
        etag: res.headers.get("etag") ?? undefined,
        lastModified: res.headers.get("last-modified") ?? undefined,
        contentHash: sha256(bodyText),
      });
      const parsed = parseEndpoints(spec, entry.groupName);
      state.endpoints.push(...parsed);
    } catch (e: any) {
      errors.push(`${entry.url} → ${e.message}`);
      continue;
    }
  }

  if (state.endpoints.length === 0) {
    const detail = errors.length ? `: ${errors.join("; ")}` : "";
    throw new Error(`No endpoints loaded from any spec${detail}`);
  }

  state.tags = new Map();
  for (const ep of state.endpoints) {
    for (const tag of ep.tags) {
      if (!state.tags.has(tag)) state.tags.set(tag, []);
      state.tags.get(tag)!.push(`${ep.method} ${ep.path}`);
    }
  }
}

/**
 * Load (or reload) the OpenAPI spec.
 * On first call, retries up to LOAD_RETRY_COUNT with exponential backoff.
 * On subsequent calls (reload), tries once and preserves the old data on failure.
 */
export async function loadSpec(
  opts: { retry?: boolean } = {},
): Promise<{ ok: boolean; message: string }> {
  if (state.loading) {
    return { ok: false, message: "A load is already in progress" };
  }
  state.loading = true;

  const isReload = state.lastLoadedAt > 0;
  const maxRetries = opts.retry !== false && !isReload ? LOAD_RETRY_COUNT : 0;
  const prevEndpoints = state.endpoints;
  const prevTags = state.tags;
  const prevSpecs = state.rawSpecs;

  try {
    resetState();

    let lastErr: Error | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(1000 * 2 ** (attempt - 1), 15_000);
        process.stderr.write(
          `Spec load failed, retrying in ${delay}ms (${attempt}/${maxRetries})…\n`,
        );
        await new Promise((r) => setTimeout(r, delay));
        resetState();
      }
      try {
        await loadSpecOnce();
        lastErr = undefined;
        break;
      } catch (e: any) {
        lastErr = e;
      }
    }

    if (lastErr) {
      if (isReload && prevEndpoints.length > 0) {
        state.endpoints = prevEndpoints;
        state.tags = prevTags;
        state.rawSpecs = prevSpecs;
        const msg = `Reload failed: ${lastErr.message}. Kept previous ${prevEndpoints.length} endpoints.`;
        process.stderr.write(msg + "\n");
        state.loadError = "";
        return { ok: false, message: msg };
      }
      state.loadError = lastErr.message;
      process.stderr.write(`Failed to load spec: ${lastErr.message}\n`);
      return { ok: false, message: lastErr.message };
    }

    state.loadError = "";
    state.lastLoadedAt = Date.now();
    const msg = `Loaded ${state.endpoints.length} endpoints, ${state.tags.size} tags`;
    process.stderr.write(msg + "\n");
    return { ok: true, message: msg };
  } finally {
    state.loading = false;
  }
}
