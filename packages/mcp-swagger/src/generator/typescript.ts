import type { ApiEndpoint } from "../types.js";
import { resolveRef } from "../parser.js";
import { findRawOperation, toPascalCase, operationToTypeName } from "./utils.js";

export function schemaToTs(
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

export function buildInterfaceBody(
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

export function generateTsForEndpoint(
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
