# AGENTS.md — @codon/cursor-usage

## What this package does

CLI tool that fetches and displays Cursor IDE token usage and costs by calling the Cursor dashboard API (`/api/dashboard/get-filtered-usage-events`).

## Hard constraints

- ESM only (`"type": "module"`).
- All API response schemas validated with `zod` — never trust raw JSON.
- Credentials stored at `~/.config/cursor-usage/credentials.json` with `0600` permissions.
- Never log or print the session cookie to stdout.
- API calls must include `Origin` and `Referer` headers (CSRF protection).

## Architecture

```
src/
├── cli.ts          # CLI entry — arg parsing, date ranges, output routing
├── credential.ts   # Cookie storage, interactive login flow
├── cursor-api.ts   # API client — fetch, pagination, aggregation
└── format.ts       # Terminal table rendering
```

## Key decisions

- Fetches real usage data via the same API that `cursor.com/cn/dashboard/usage` uses.
- Authentication is cookie-based (`WorkosCursorSessionToken` + `team_id`).
- Pagination: auto-fetches all pages (200 events/page) until exhausted.
- Date filtering is local — `--today`, `--week`, `--month`, or `--since`/`--until`.
