import type { ApiEndpoint } from "./types.js";
import { BASE_URL } from "./config.js";

export const state = {
  endpoints: [] as ApiEndpoint[],
  tags: new Map<string, string[]>(),
  groupName: "default",
  loadError: "",
  embeddingIndex: [] as number[][],
  embeddingReady: false,
  rawSpecs: [] as any[],
};

export function buildDocUrl(ep: ApiEndpoint): string {
  const tag = encodeURIComponent(ep.tags[0] || "default");
  const opId = encodeURIComponent(ep.operationId);
  return `${BASE_URL}/doc.html#/${state.groupName}/${tag}/${opId}`;
}
