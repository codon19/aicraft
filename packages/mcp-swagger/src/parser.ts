import type { ApiEndpoint, ParameterInfo, SwaggerResource } from "./types.js";
import { BASE_URL } from "./config.js";
import { state } from "./state.js";

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

export async function loadSpec(): Promise<void> {
  try {
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

    for (const entry of resourceEntries) {
      try {
        const fullUrl = entry.url.startsWith("http")
          ? entry.url
          : `${BASE_URL}${entry.url}`;
        const res = await fetch(fullUrl);
        if (!res.ok) continue;
        const spec = await res.json();
        state.rawSpecs.push(spec);
        const parsed = parseEndpoints(spec, entry.groupName);
        state.endpoints.push(...parsed);
      } catch {
        continue;
      }
    }

    state.tags = new Map();
    for (const ep of state.endpoints) {
      for (const tag of ep.tags) {
        if (!state.tags.has(tag)) state.tags.set(tag, []);
        state.tags.get(tag)!.push(`${ep.method} ${ep.path}`);
      }
    }

    process.stderr.write(
      `Loaded ${state.endpoints.length} API endpoints, ${state.tags.size} tags\n`,
    );
  } catch (e: any) {
    state.loadError = e.message;
    process.stderr.write(`Failed to load spec: ${e.message}\n`);
  }
}
