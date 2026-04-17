import { state } from "../state.js";
import { ensureFresh } from "../freshness.js";

export async function checkUpdates(): Promise<string> {
  const result = await ensureFresh();

  return JSON.stringify(
    {
      ok: !result.error,
      changed: result.reloaded,
      skipped: result.skipped,
      added: result.diff?.added ?? [],
      removed: result.diff?.removed ?? [],
      addedCount: result.diff?.added.length ?? 0,
      removedCount: result.diff?.removed.length ?? 0,
      endpoints: state.endpoints.length,
      tags: state.tags.size,
      lastCheckedAt: state.lastFreshnessCheckAt
        ? new Date(state.lastFreshnessCheckAt).toISOString()
        : null,
      lastLoadedAt: state.lastLoadedAt
        ? new Date(state.lastLoadedAt).toISOString()
        : null,
      error: result.error,
    },
    null,
    2,
  );
}
