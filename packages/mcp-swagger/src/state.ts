import type { ApiEndpoint } from "./types.js";
import { BASE_URL } from "./config.js";

export const state = {
  endpoints: [] as ApiEndpoint[],
  tags: new Map<string, string[]>(),
  loadError: "",
  embeddingIndex: [] as number[][],
  embeddingReady: false,
  rawSpecs: [] as any[],
  lastLoadedAt: 0,
  loading: false,
};

export function resetState(): void {
  state.endpoints = [];
  state.tags = new Map();
  state.loadError = "";
  state.embeddingIndex = [];
  state.embeddingReady = false;
  state.rawSpecs = [];
}

export function buildDocUrl(ep: ApiEndpoint): string {
  const group = encodeURIComponent(ep.groupName || "default");
  const tag = encodeURIComponent(ep.tags[0] || "default");
  const opId = encodeURIComponent(ep.operationId);
  return `${BASE_URL}/doc.html#/${group}/${tag}/${opId}`;
}
