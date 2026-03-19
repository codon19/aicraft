import type { ApiEndpoint } from "../types.js";
import { state } from "../state.js";

export function findRawOperation(
  path: string,
  method: string,
): { operation: any; spec: any } | null {
  for (const spec of state.rawSpecs) {
    const op = spec.paths?.[path]?.[method.toLowerCase()];
    if (op) return { operation: op, spec };
  }
  return null;
}

export function toPascalCase(str: string): string {
  const result = str
    .replace(/[«»<>]/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, " ")
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");
  return /^[0-9]/.test(result) ? `_${result}` : result;
}

export function operationToTypeName(ep: ApiEndpoint): string {
  if (ep.operationId) return toPascalCase(ep.operationId);
  const parts = ep.path
    .split("/")
    .filter(Boolean)
    .map((s) => s.replace(/[{}]/g, ""));
  return toPascalCase(`${ep.method.toLowerCase()}_${parts.join("_")}`);
}
