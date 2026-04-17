import { z } from "zod";
import type { Credential } from "./credential.js";

const EVENTS_API_URL =
  "https://cursor.com/api/dashboard/get-filtered-usage-events";
const SUMMARY_API_URL = "https://cursor.com/api/usage-summary";

const TokenUsageSchema = z.object({
  inputTokens: z.number().default(0),
  outputTokens: z.number().default(0),
  cacheWriteTokens: z.number().default(0),
  cacheReadTokens: z.number().default(0),
  totalCents: z.number().default(0),
});

const UsageEventSchema = z.object({
  timestamp: z.string(),
  model: z.string().default("unknown"),
  kind: z.string().default(""),
  requestsCosts: z.number().default(0),
  usageBasedCosts: z.string().default("$0.00"),
  isTokenBasedCall: z.boolean().default(false),
  tokenUsage: TokenUsageSchema.optional().nullable(),
  owningUser: z.string().default(""),
  owningTeam: z.string().default(""),
  cursorTokenFee: z.number().default(0),
  isChargeable: z.boolean().default(false),
  isHeadless: z.boolean().default(false),
  chargedCents: z.number().default(0),
});

const ApiResponseSchema = z.object({
  totalUsageEventsCount: z.number(),
  usageEventsDisplay: z.array(UsageEventSchema),
});

export type UsageEvent = z.infer<typeof UsageEventSchema>;
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

export interface FetchOptions {
  startDate: Date;
  endDate: Date;
  page?: number;
  pageSize?: number;
}

async function fetchPage(
  cred: Credential,
  opts: FetchOptions,
): Promise<z.infer<typeof ApiResponseSchema>> {
  const body = JSON.stringify({
    teamId: cred.teamId ?? 0,
    startDate: String(opts.startDate.getTime()),
    endDate: String(opts.endDate.getTime()),
    userId: cred.userId,
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 200,
  });

  const res = await fetch(EVENTS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://cursor.com",
      Referer: "https://cursor.com/cn/dashboard/usage",
      Cookie: cred.cookie,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cursor API ${res.status}: ${text}`);
  }

  const json = await res.json();
  return ApiResponseSchema.parse(json);
}

export async function fetchAllEvents(
  cred: Credential,
  opts: Omit<FetchOptions, "page" | "pageSize">,
): Promise<UsageEvent[]> {
  const PAGE_SIZE = 200;
  const all: UsageEvent[] = [];
  let page = 1;

  while (true) {
    const resp = await fetchPage(cred, {
      ...opts,
      page,
      pageSize: PAGE_SIZE,
    });
    all.push(...resp.usageEventsDisplay);

    if (all.length >= resp.totalUsageEventsCount || resp.usageEventsDisplay.length < PAGE_SIZE) {
      break;
    }
    page++;
  }

  return all;
}

// ─── Usage Summary (billing cycle totals from /api/usage-summary) ───

const UsageSummarySchema = z.object({
  billingCycleStart: z.string(),
  billingCycleEnd: z.string(),
  membershipType: z.string(),
  individualUsage: z.object({
    plan: z.object({
      used: z.number(),
      limit: z.number(),
      remaining: z.number(),
    }),
    onDemand: z.object({
      enabled: z.boolean(),
      used: z.number(),
    }),
  }),
  teamUsage: z.object({
    onDemand: z.object({
      enabled: z.boolean(),
      used: z.number(),
      limit: z.number().nullable(),
      remaining: z.number().nullable(),
    }),
  }).optional(),
});

export type UsageSummary = z.infer<typeof UsageSummarySchema>;

function apiHeaders(cred: Credential) {
  return {
    "Content-Type": "application/json",
    Origin: "https://cursor.com",
    Referer: "https://cursor.com/cn/dashboard/usage",
    Cookie: cred.cookie,
  };
}

export async function fetchUsageSummary(
  cred: Credential,
): Promise<UsageSummary> {
  const res = await fetch(SUMMARY_API_URL, {
    headers: apiHeaders(cred),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cursor Summary API ${res.status}: ${text}`);
  }

  const json = await res.json();
  return UsageSummarySchema.parse(json);
}

// ─── Auto-discovery of userId/teamId from cookie ───

/**
 * Try multiple known Cursor endpoints to discover the numeric userId.
 * Returns null if none of them yielded a numeric user id.
 */
export async function discoverIdsFromCookie(
  cookie: string,
): Promise<{ userId: number | null; teamId: number | null }> {
  const headers = {
    "Content-Type": "application/json",
    Origin: "https://cursor.com",
    Referer: "https://cursor.com/cn/dashboard/usage",
    Cookie: cookie,
  };

  // Extract numeric id from an arbitrary JSON blob by walking common field names.
  const pickNumber = (obj: unknown, keys: string[]): number | null => {
    if (!obj || typeof obj !== "object") return null;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (keys.includes(k) && typeof v === "number" && Number.isFinite(v)) {
        return v;
      }
      if (v && typeof v === "object") {
        const nested = pickNumber(v, keys);
        if (nested !== null) return nested;
      }
    }
    return null;
  };

  const candidateEndpoints = [
    // Most likely to carry userId
    { url: "https://cursor.com/api/auth/me", method: "GET" as const },
    { url: "https://cursor.com/api/usage-summary", method: "GET" as const },
    { url: "https://cursor.com/api/dashboard/get-user-info", method: "POST" as const, body: "{}" },
  ];

  let userId: number | null = null;
  let teamId: number | null = null;

  for (const ep of candidateEndpoints) {
    try {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers,
        ...(ep.method === "POST" ? { body: ep.body } : {}),
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (userId === null) {
        userId = pickNumber(json, ["userId", "user_id", "id"]);
      }
      if (teamId === null) {
        teamId = pickNumber(json, ["teamId", "team_id"]);
      }
      if (userId !== null && teamId !== null) break;
    } catch {
      // try next
    }
  }

  return { userId, teamId };
}

/**
 * Verify a cookie works by calling the summary endpoint (cheapest, no ids required).
 */
export async function verifyCookie(cookie: string): Promise<boolean> {
  try {
    const res = await fetch(SUMMARY_API_URL, {
      headers: {
        "Content-Type": "application/json",
        Origin: "https://cursor.com",
        Referer: "https://cursor.com/cn/dashboard/usage",
        Cookie: cookie,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Per-model aggregation from events ───

const KIND_USAGE_BASED = "USAGE_EVENT_KIND_USAGE_BASED";

export function isOnDemand(event: UsageEvent): boolean {
  return event.kind === KIND_USAGE_BASED;
}

export interface ModelSummary {
  model: string;
  requests: number;
  onDemandRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  chargedCents: number;
}

export function aggregateByModel(events: UsageEvent[]): ModelSummary[] {
  const map = new Map<string, ModelSummary>();

  for (const e of events) {
    let entry = map.get(e.model);
    if (!entry) {
      entry = {
        model: e.model,
        requests: 0,
        onDemandRequests: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        chargedCents: 0,
      };
      map.set(e.model, entry);
    }

    entry.requests++;
    if (e.tokenUsage) {
      const t = e.tokenUsage;
      entry.inputTokens += t.inputTokens;
      entry.outputTokens += t.outputTokens;
      entry.totalTokens +=
        t.inputTokens + t.outputTokens + t.cacheReadTokens + t.cacheWriteTokens;
    }

    if (isOnDemand(e)) {
      entry.onDemandRequests++;
      entry.chargedCents += e.chargedCents;
    }
  }

  return [...map.values()].sort((a, b) => b.chargedCents - a.chargedCents);
}

export interface EventsSummary {
  totalRequests: number;
  onDemandRequests: number;
  includedRequests: number;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalChargedCents: number;
}

export function summarizeEvents(events: UsageEvent[]): EventsSummary {
  const result: EventsSummary = {
    totalRequests: events.length,
    onDemandRequests: 0,
    includedRequests: 0,
    totalTokens: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalChargedCents: 0,
  };

  for (const e of events) {
    if (e.tokenUsage) {
      const t = e.tokenUsage;
      result.totalInputTokens += t.inputTokens;
      result.totalOutputTokens += t.outputTokens;
      result.totalTokens +=
        t.inputTokens + t.outputTokens + t.cacheReadTokens + t.cacheWriteTokens;
    }

    if (isOnDemand(e)) {
      result.onDemandRequests++;
      result.totalChargedCents += e.chargedCents;
    } else {
      result.includedRequests++;
    }
  }

  return result;
}
