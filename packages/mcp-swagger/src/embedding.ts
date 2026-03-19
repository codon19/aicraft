import type { ApiEndpoint } from "./types.js";
import {
  EMBEDDING_API_KEY,
  EMBEDDING_BASE_URL,
  EMBEDDING_MODEL,
} from "./config.js";
import { state } from "./state.js";

function buildSearchText(ep: ApiEndpoint): string {
  return `${ep.method} ${ep.path} ${ep.summary} ${ep.description} ${ep.tags.join(" ")}`;
}

async function callEmbeddingApi(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${EMBEDDING_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${EMBEDDING_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
  };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function buildEmbeddingIndex(): Promise<void> {
  if (!EMBEDDING_API_KEY) {
    process.stderr.write(
      "No OPENAI_API_KEY set, semantic search disabled\n",
    );
    return;
  }

  try {
    const texts = state.endpoints.map(buildSearchText);
    const BATCH_SIZE = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const embeddings = await callEmbeddingApi(batch);
      allEmbeddings.push(...embeddings);
      process.stderr.write(
        `  Embedded ${allEmbeddings.length}/${texts.length} endpoints\n`,
      );
    }

    state.embeddingIndex = allEmbeddings;
    state.embeddingReady = true;
    process.stderr.write(
      `Embedding index ready (${state.embeddingIndex.length} vectors, dim=${state.embeddingIndex[0]?.length})\n`,
    );
  } catch (e: any) {
    process.stderr.write(`Embedding index failed: ${e.message}\n`);
  }
}

export async function semanticSearch(
  query: string,
  limit: number,
): Promise<{ endpoint: ApiEndpoint; score: number }[]> {
  const [queryVec] = await callEmbeddingApi([query]);
  const scored = state.endpoints.map((ep, i) => ({
    endpoint: ep,
    score: cosineSimilarity(queryVec, state.embeddingIndex[i]),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
