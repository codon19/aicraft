# AGENTS.md — `@codon/mcporter-bridge-lite`

## Purpose

A deliberately **lite** MCP stdio server that bridges MCP clients (Cursor, Claude Desktop, Continue) to the [`mcporter`](https://github.com/nicepkg/mcporter) CLI. Exposes only three tools: list servers, get help/schema for one, call any of its tools.

## Read first

1. `README.md` in this package (setup, env vars, tool list)
2. `../../docs/product-specs/mcporter-bridge-lite.md` (boundaries, acceptance)
3. `../../AGENTS.md` (monorepo-wide rules)
4. Any active plan in `../../docs/exec-plans/active/` whose name contains `bridge` or `mcporter`

## Hard constraints

- **Stay lite.** This package must not grow business logic, caches, rewrites, or policy layers. If you need those, create a new `mcporter-bridge` or `mcporter-gateway` package and leave this one alone.
- All tool inputs use `zod` schemas. No hand-rolled JSON Schema.
- **Do not** cache tool schemas returned by `mcporter_help`. Every call goes through the CLI to keep consistency with whatever mcporter currently sees.
- **Do not** parse or reshape `mcporter_call_tool` results. Pass through what the CLI returns verbatim (wrap in MCP response envelope only).
- On startup, verify the `mcporter` binary (respecting `MCPORTER_BIN`) is reachable. If not, fail fast with an error message that names the env var.
- Adding or renaming any of the three tools is a breaking change: bump minor, update README Tools table, and update `../../docs/product-specs/mcporter-bridge-lite.md` in the same PR.
- No version-suffix names (`v2`, `v3`, `Legacy`) in source identifiers.

## Common task entrypoints

- **Adjusting timeout / bin resolution**: stays inside this package, no exec-plan needed; just update README env var table if a new knob is introduced.
- **Supporting new mcporter CLI subcommand**: re-evaluate whether it belongs here or in a heavier gateway package; if here, file a plan under `../../docs/exec-plans/active/`.
- **Responding to mcporter upstream changes**: pin expected CLI version range in README and add an `MCPORTER_EXPECTED_VERSION` guard only if breakage becomes real.

## Out of scope for this package

- Any MCP tool that is not a direct bridge to mcporter
- Caching layers, request coalescing, retry policies
- Installing / upgrading `mcporter` itself (user responsibility)
