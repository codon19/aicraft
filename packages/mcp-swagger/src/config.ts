export const BASE_URL = process.env.SWAGGER_BASE_URL;
if (!BASE_URL) {
  process.stderr.write(
    "Error: SWAGGER_BASE_URL environment variable is required.\n",
  );
  process.exit(1);
}

export const EMBEDDING_API_KEY = process.env.OPENAI_API_KEY || "";
export const EMBEDDING_BASE_URL =
  process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "text-embedding-3-small";

/** Auto-refresh interval in minutes. 0 = disabled (default). */
export const REFRESH_INTERVAL_MIN = Number(
  process.env.SWAGGER_REFRESH_INTERVAL || "0",
);

/** Max retry attempts when loading spec fails at startup. */
export const LOAD_RETRY_COUNT = Number(
  process.env.SWAGGER_LOAD_RETRIES || "3",
);

/**
 * Throttle freshness checks between tool calls (ms).
 * 0 = check on every tool call (default, recommended for internal networks).
 * Set to a positive value (e.g. 30000) for remote/slow backends.
 */
export const FRESHNESS_THROTTLE_MS = Number(
  process.env.SWAGGER_FRESHNESS_THROTTLE_MS || "0",
);
