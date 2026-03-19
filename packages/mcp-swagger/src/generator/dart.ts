import type { ApiEndpoint } from "../types.js";
import { resolveRef } from "../parser.js";
import { findRawOperation, toPascalCase, operationToTypeName } from "./utils.js";

export function schemaToDartType(
  schema: any,
  spec: any,
  namedTypes: Map<string, string>,
  depth: number,
): string {
  if (!schema || depth > 8) return "dynamic";

  if (schema.$ref) {
    const refName = schema.$ref.split("/").pop()!;
    const dartName = toPascalCase(refName);
    if (!namedTypes.has(dartName)) {
      namedTypes.set(dartName, "");
      const resolved = resolveRef(schema.$ref, spec);
      if (resolved) {
        namedTypes.set(
          dartName,
          buildDartClass(dartName, resolved, spec, namedTypes),
        );
      }
    }
    return dartName;
  }

  if (schema.allOf) {
    for (const s of schema.allOf) {
      if (s.$ref) return schemaToDartType(s, spec, namedTypes, depth + 1);
    }
    return "Map<String, dynamic>";
  }

  if (schema.type === "array") {
    if (!schema.items) return "List<dynamic>";
    const itemType = schemaToDartType(
      schema.items,
      spec,
      namedTypes,
      depth + 1,
    );
    return `List<${itemType}>`;
  }

  if (schema.type === "object" || schema.properties) {
    if (!schema.properties) {
      if (
        schema.additionalProperties &&
        typeof schema.additionalProperties === "object"
      ) {
        const vt = schemaToDartType(
          schema.additionalProperties,
          spec,
          namedTypes,
          depth + 1,
        );
        return `Map<String, ${vt}>`;
      }
      return "Map<String, dynamic>";
    }
    return "Map<String, dynamic>";
  }

  switch (schema.type) {
    case "string":
      return "String";
    case "integer":
      return "int";
    case "number":
      return "double";
    case "boolean":
      return "bool";
    default:
      return "dynamic";
  }
}

function dartFromJsonExpr(
  schema: any,
  spec: any,
  namedTypes: Map<string, string>,
  access: string,
  required: boolean,
  depth: number,
): string {
  if (!schema || depth > 8) return access;

  if (schema.$ref) {
    const dartName = toPascalCase(schema.$ref.split("/").pop()!);
    schemaToDartType(schema, spec, namedTypes, 0);
    return required
      ? `${dartName}.fromJson(${access} as Map<String, dynamic>)`
      : `${access} != null ? ${dartName}.fromJson(${access} as Map<String, dynamic>) : null`;
  }

  if (schema.type === "array") {
    if (schema.items?.$ref) {
      const itemName = toPascalCase(schema.items.$ref.split("/").pop()!);
      schemaToDartType(schema.items, spec, namedTypes, 0);
      const inner = `.map((e) => ${itemName}.fromJson(e as Map<String, dynamic>)).toList()`;
      return required
        ? `(${access} as List<dynamic>)${inner}`
        : `(${access} as List<dynamic>?)?.map((e) => ${itemName}.fromJson(e as Map<String, dynamic>)).toList()`;
    }
    const itemType = schemaToDartType(
      schema.items || {},
      spec,
      namedTypes,
      depth + 1,
    );
    if (["String", "int", "double", "bool"].includes(itemType)) {
      return required
        ? `(${access} as List<dynamic>).cast<${itemType}>()`
        : `(${access} as List<dynamic>?)?.cast<${itemType}>()`;
    }
    return `${access} as List<dynamic>${required ? "" : "?"}`;
  }

  if (schema.type === "number") {
    return required
      ? `(${access} as num).toDouble()`
      : `(${access} as num?)?.toDouble()`;
  }

  const dartType = schemaToDartType(schema, spec, namedTypes, depth);
  return `${access} as ${dartType}${required ? "" : "?"}`;
}

function dartToJsonExpr(schema: any, valueName: string): string {
  if (schema?.$ref) return `${valueName}?.toJson()`;
  if (schema?.type === "array" && schema.items?.$ref)
    return `${valueName}?.map((e) => e.toJson()).toList()`;
  return valueName;
}

export function buildDartClass(
  className: string,
  schema: any,
  spec: any,
  namedTypes: Map<string, string>,
): string {
  if (!schema?.properties) return `class ${className} {}`;

  const req = new Set<string>(schema.required || []);
  const fields: {
    name: string;
    type: string;
    nullable: boolean;
    desc?: string;
    schema: any;
  }[] = [];

  for (const [key, val] of Object.entries(schema.properties) as [
    string,
    any,
  ][]) {
    const ps = val.$ref ? resolveRef(val.$ref, spec) || val : val;
    const nullable = !req.has(key);
    const type = schemaToDartType(val, spec, namedTypes, 0);
    fields.push({
      name: key,
      type,
      nullable,
      desc: ps.description || val.description,
      schema: val,
    });
  }

  const lines: string[] = [];
  lines.push(`class ${className} {`);

  for (const f of fields) {
    if (f.desc) lines.push(`  /// ${f.desc}`);
    lines.push(`  final ${f.type}${f.nullable ? "?" : ""} ${f.name};`);
  }

  lines.push("");
  lines.push(`  const ${className}({`);
  for (const f of fields) {
    lines.push(
      f.nullable ? `    this.${f.name},` : `    required this.${f.name},`,
    );
  }
  lines.push("  });");

  lines.push("");
  lines.push(
    `  factory ${className}.fromJson(Map<String, dynamic> json) {`,
  );
  lines.push(`    return ${className}(`);
  for (const f of fields) {
    const expr = dartFromJsonExpr(
      f.schema,
      spec,
      namedTypes,
      `json['${f.name}']`,
      !f.nullable,
      0,
    );
    lines.push(`      ${f.name}: ${expr},`);
  }
  lines.push("    );");
  lines.push("  }");

  lines.push("");
  lines.push("  Map<String, dynamic> toJson() {");
  lines.push("    return {");
  for (const f of fields) {
    const expr = dartToJsonExpr(f.schema, f.name);
    lines.push(`      '${f.name}': ${expr},`);
  }
  lines.push("    };");
  lines.push("  }");

  lines.push("}");
  return lines.join("\n");
}

export function generateDartForEndpoint(
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
      if (schema.$ref) {
        schemaToDartType(schema, spec, namedTypes, 0);
        const typeName = toPascalCase(schema.$ref.split("/").pop()!);
        sections.push(`typedef ${baseName}Response = ${typeName};`);
      } else {
        const dartType = schemaToDartType(schema, spec, namedTypes, 0);
        sections.push(`typedef ${baseName}Response = ${dartType};`);
      }
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
    if (reqSchema.$ref) {
      schemaToDartType(reqSchema, spec, namedTypes, 0);
      const typeName = toPascalCase(reqSchema.$ref.split("/").pop()!);
      sections.push(`typedef ${baseName}Request = ${typeName};`);
    } else if (reqSchema.properties) {
      sections.push(
        buildDartClass(`${baseName}Request`, reqSchema, spec, namedTypes),
      );
    }
  }

  const header = `// ${ep.method} ${ep.path}${ep.summary ? `  ${ep.summary}` : ""}`;
  return [header, ...sections].join("\n");
}
