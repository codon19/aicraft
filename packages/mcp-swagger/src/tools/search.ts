import type { ApiEndpoint } from "../types.js";
import { state, buildDocUrl } from "../state.js";
import { semanticSearch } from "../embedding.js";

function keywordSearch(keyword: string, tag?: string): ApiEndpoint[] {
  const kw = keyword.toLowerCase();
  let results = state.endpoints.filter((ep) => {
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

export async function searchApi(
  keyword: string,
  mode = "auto",
  tag?: string,
  limit = 10,
): Promise<string> {
  if (state.loadError)
    return JSON.stringify({
      error: `Failed to load spec: ${state.loadError}`,
    });
  if (state.endpoints.length === 0)
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
    if (!state.embeddingReady) {
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

  if (state.embeddingReady) {
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
          merged.push({
            endpoint: s.endpoint,
            score: s.score,
            exact: false,
          });
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
