import { state } from "../state.js";

interface CallApiArgs {
  url: string;
  method?: string;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
}

export async function callApi(args: CallApiArgs): Promise<string> {
  const { url, body, query, timeout = 30000 } = args;
  const method = (args.method || inferMethod(url) || "GET").toUpperCase();

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...args.headers,
  };

  const fullUrl = appendQuery(url, query);

  const fetchOptions: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(timeout),
  };

  if (body && !["GET", "HEAD"].includes(method)) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const start = Date.now();
    const res = await fetch(fullUrl, fetchOptions);
    const elapsed = Date.now() - start;

    const contentType = res.headers.get("content-type") || "";
    let responseBody: unknown;

    if (contentType.includes("application/json")) {
      responseBody = await res.json();
    } else {
      const text = await res.text();
      responseBody =
        text.length > 5000 ? `${text.slice(0, 5000)}... (truncated)` : text;
    }

    return JSON.stringify(
      {
        request: {
          method,
          url: fullUrl,
          headers,
        },
        status: res.status,
        statusText: res.statusText,
        elapsed_ms: elapsed,
        body: responseBody,
      },
      null,
      2,
    );
  } catch (e: any) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      return JSON.stringify({ error: `Request timed out after ${timeout}ms` });
    }
    return JSON.stringify({ error: `Request failed: ${e.message}` });
  }
}

function inferMethod(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const match = state.endpoints.find(
      (ep) => pathname === ep.path || pathname.endsWith(ep.path),
    );
    return match?.method;
  } catch {
    return undefined;
  }
}

function appendQuery(
  url: string,
  query?: Record<string, unknown>,
): string {
  if (!query || Object.keys(query).length === 0) return url;
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      parsed.searchParams.set(key, String(value));
    }
  }
  return parsed.toString();
}
