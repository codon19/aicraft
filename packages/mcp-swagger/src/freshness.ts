/**
 * Freshness check — uses HTTP conditional GET (If-None-Match / If-Modified-Since)
 * to detect upstream spec changes with near-zero overhead when unchanged.
 *
 * Flow:
 *   1. For each cached resource, issue a conditional GET in parallel.
 *   2. 304 Not Modified → unchanged.
 *   3. 200 OK → compare sha256 of body against cached hash.
 *      - Hash differs → changed, capture new body for reload.
 *      - Hash matches → unchanged (upstream ignored our validators).
 *   4. If any resource changed, call loadSpec() to fully rebuild state, then
 *      buildEmbeddingIndex().
 *   5. Return { reloaded, diff } — diff lists added/removed endpoint paths.
 *
 * Network errors are swallowed: we fall back to the cached spec so tool calls
 * never fail due to transient connectivity issues.
 */

import { FRESHNESS_THROTTLE_MS } from "./config.js";
import { state } from "./state.js";
import { loadSpec, sha256 } from "./parser.js";
import { buildEmbeddingIndex } from "./embedding.js";

export interface SpecDiff {
  added: string[];
  removed: string[];
}

export interface EnsureFreshResult {
  reloaded: boolean;
  skipped?: "throttled" | "no-fingerprints" | "loading";
  diff?: SpecDiff;
  error?: string;
}

interface ResourceCheck {
  url: string;
  changed: boolean;
  status: number;
}

async function checkOneResource(
  fp: (typeof state.resourceFingerprints)[number],
): Promise<ResourceCheck> {
  const headers: Record<string, string> = {};
  if (fp.etag) headers["If-None-Match"] = fp.etag;
  if (fp.lastModified) headers["If-Modified-Since"] = fp.lastModified;

  const res = await fetch(fp.url, { headers });

  if (res.status === 304) {
    return { url: fp.url, changed: false, status: 304 };
  }
  if (!res.ok) {
    // Non-2xx, non-304 → treat as "can't tell", keep cache.
    return { url: fp.url, changed: false, status: res.status };
  }

  const bodyText = await res.text();
  const newHash = sha256(bodyText);
  const changed = newHash !== fp.contentHash;
  return { url: fp.url, changed, status: 200 };
}

let inflight: Promise<EnsureFreshResult> | null = null;

/**
 * Check upstream for changes and reload spec if anything differs.
 * Safe to call concurrently — parallel callers share the same inflight promise.
 */
export async function ensureFresh(): Promise<EnsureFreshResult> {
  if (inflight) return inflight;

  if (state.loading) {
    return { reloaded: false, skipped: "loading" };
  }
  if (state.resourceFingerprints.length === 0) {
    return { reloaded: false, skipped: "no-fingerprints" };
  }
  if (
    FRESHNESS_THROTTLE_MS > 0 &&
    Date.now() - state.lastFreshnessCheckAt < FRESHNESS_THROTTLE_MS
  ) {
    return { reloaded: false, skipped: "throttled" };
  }

  inflight = (async () => {
    state.lastFreshnessCheckAt = Date.now();

    try {
      const checks = await Promise.all(
        state.resourceFingerprints.map(checkOneResource),
      );
      const anyChanged = checks.some((c) => c.changed);
      if (!anyChanged) return { reloaded: false };

      const oldPaths = new Set(
        state.endpoints.map((e) => `${e.method} ${e.path}`),
      );

      const result = await loadSpec();
      if (!result.ok) {
        return { reloaded: false, error: result.message };
      }
      await buildEmbeddingIndex();

      const newPaths = new Set(
        state.endpoints.map((e) => `${e.method} ${e.path}`),
      );
      const diff: SpecDiff = {
        added: [...newPaths].filter((p) => !oldPaths.has(p)).sort(),
        removed: [...oldPaths].filter((p) => !newPaths.has(p)).sort(),
      };

      process.stderr.write(
        `Spec changed: +${diff.added.length} / -${diff.removed.length}\n`,
      );
      return { reloaded: true, diff };
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      process.stderr.write(`Freshness check failed: ${msg}\n`);
      return { reloaded: false, error: msg };
    }
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
