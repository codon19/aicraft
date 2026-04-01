#!/usr/bin/env node
/**
 * MCP Server — Swagger/OpenAPI documentation search.
 *
 * Fetches the OpenAPI spec from a Knife4j / Swagger backend,
 * builds an in-memory index, and exposes search + browse tools via MCP (stdio).
 *
 * Environment variables:
 *   SWAGGER_BASE_URL  — required, e.g. http://10.15.10.9:18888
 *   OPENAI_API_KEY    — optional, enables semantic (embedding) search
 *   OPENAI_BASE_URL   — optional, default https://api.openai.com/v1
 *   EMBEDDING_MODEL   — optional, default text-embedding-3-small
 */

import * as readline from "node:readline";
import { BASE_URL, REFRESH_INTERVAL_MIN } from "./config.js";
import { handleMessage } from "./server.js";
import { loadSpec } from "./parser.js";
import { buildEmbeddingIndex } from "./embedding.js";
import type { JsonRpcMessage } from "./types.js";

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const msg = JSON.parse(trimmed) as JsonRpcMessage;
    handleMessage(msg);
  } catch {
    // Ignore malformed input
  }
});

loadSpec()
  .then(() => buildEmbeddingIndex())
  .then(() => {
    process.stderr.write(`mcp-swagger ready (${BASE_URL})\n`);

    if (REFRESH_INTERVAL_MIN > 0) {
      const ms = REFRESH_INTERVAL_MIN * 60_000;
      setInterval(async () => {
        process.stderr.write("Auto-refreshing spec…\n");
        const result = await loadSpec();
        if (result.ok) await buildEmbeddingIndex();
      }, ms);
      process.stderr.write(
        `Auto-refresh enabled: every ${REFRESH_INTERVAL_MIN} min\n`,
      );
    }
  });
