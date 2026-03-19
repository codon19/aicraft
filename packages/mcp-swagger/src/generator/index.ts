import type { ApiEndpoint } from "../types.js";
import { state } from "../state.js";
import { generateTsForEndpoint } from "./typescript.js";
import { generateDartForEndpoint } from "./dart.js";

export function generateTypes(
  path?: string,
  method?: string,
  tag?: string,
  language = "typescript",
): string {
  if (state.loadError)
    return JSON.stringify({
      error: `Failed to load spec: ${state.loadError}`,
    });
  if (state.endpoints.length === 0)
    return JSON.stringify({ error: "No endpoints loaded." });

  let targets: ApiEndpoint[] = [];

  if (path) {
    targets = state.endpoints.filter((ep) => {
      const pm = ep.path === path || ep.path.endsWith(path);
      return method ? pm && ep.method === method.toUpperCase() : pm;
    });
    if (targets.length === 0) {
      const fuzzy = state.endpoints.filter((ep) =>
        ep.path.toLowerCase().includes(path.toLowerCase()),
      );
      return JSON.stringify({
        error:
          "Path not found." + (fuzzy.length > 0 ? " Did you mean:" : ""),
        ...(fuzzy.length > 0 && {
          suggestions: fuzzy
            .slice(0, 5)
            .map((e) => `${e.method} ${e.path}`),
        }),
      });
    }
  } else if (tag) {
    targets = state.endpoints.filter((ep) =>
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

  if (language === "dart") {
    const dartNamed = new Map<string, string>();
    const dartSections = targets.map((ep) =>
      generateDartForEndpoint(ep, dartNamed),
    );
    const dartModels: string[] = [];
    for (const [, body] of dartNamed) {
      if (body) dartModels.push(body);
    }
    return [...dartModels, "", ...dartSections]
      .filter(Boolean)
      .join("\n\n");
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
