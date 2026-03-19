import { state, buildDocUrl } from "../state.js";

export function listTags(): string {
  if (state.loadError)
    return JSON.stringify({
      error: `Failed to load spec: ${state.loadError}`,
    });

  const result: Record<string, number> = {};
  for (const [tag, paths] of state.tags.entries()) {
    result[tag] = paths.length;
  }
  return JSON.stringify({
    total_endpoints: state.endpoints.length,
    tags: result,
  });
}

export function listTagApis(tag: string): string {
  if (state.loadError)
    return JSON.stringify({
      error: `Failed to load spec: ${state.loadError}`,
    });

  const matching = state.endpoints.filter((ep) =>
    ep.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase())),
  );

  if (matching.length === 0) {
    return JSON.stringify({
      error: `No endpoints found for tag: ${tag}`,
    });
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
