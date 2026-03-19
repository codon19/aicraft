import { state, buildDocUrl } from "../state.js";

export function getApiDetail(path: string, method?: string): string {
  if (state.loadError)
    return JSON.stringify({
      error: `Failed to load spec: ${state.loadError}`,
    });

  const matches = state.endpoints.filter((ep) => {
    const pathMatch = ep.path === path || ep.path.endsWith(path);
    if (!method) return pathMatch;
    return pathMatch && ep.method === method.toUpperCase();
  });

  if (matches.length === 0) {
    const fuzzy = state.endpoints.filter((ep) =>
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
    return JSON.stringify({
      error: `No endpoint found for path: ${path}`,
    });
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
