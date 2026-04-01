import { state } from "../state.js";
import { loadSpec } from "../parser.js";
import { buildEmbeddingIndex } from "../embedding.js";

export async function reloadSpec(): Promise<string> {
  const result = await loadSpec();

  if (result.ok) {
    await buildEmbeddingIndex();
  }

  return JSON.stringify({
    ok: result.ok,
    message: result.message,
    endpoints: state.endpoints.length,
    tags: state.tags.size,
    lastLoadedAt: state.lastLoadedAt
      ? new Date(state.lastLoadedAt).toISOString()
      : null,
    embeddingReady: state.embeddingReady,
  });
}
