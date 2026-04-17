# AGENTS.md

## Purpose

This repository (`aicraft`) is a **pnpm + turbo monorepo** that builds and publishes MCP (Model Context Protocol) servers under the `@codon/*` scope. Each package in `packages/` is an independently versioned, npm-publishable tool.

The goal is not just to ship tools quickly, but to keep each package's contract (tool names, input/output schemas, env vars) stable and navigable for both humans and agents.

## Read first

Before editing code, read in this order:

1. `README.md` (if present at root) and the target package's own `README.md`
2. `docs/index.md` — the Chinese navigation page for durable project knowledge
3. The target package's `AGENTS.md` (e.g. `packages/mcp-swagger/AGENTS.md`)
4. Any active plan under `docs/exec-plans/active/` that touches the same area

## Source of truth

- Product scope & capability summaries: `docs/product-specs/`
- Work-in-progress execution plans: `docs/exec-plans/active/`
- Completed / archived plans: `docs/exec-plans/completed/`
- Reusable templates (PRD checklist, clarification prompt, exec-plan skeleton): `docs/templates/`
- Third-party library references (llms.txt, etc.): `docs/references/`
- Per-package hard constraints: `packages/*/AGENTS.md`

## Non-negotiable rules

- ESM only. Every package has `"type": "module"` and targets Node `>=18`.
- All MCP tool parameters **must** be declared with `zod` schemas. Do not hand-roll JSON Schema.
- **Do not** import source files across packages. Cross-package consumption must go through the published `@codon/*` package or the workspace protocol against the built `dist/`.
- **Do not** use version-suffixed identifiers (`v2`, `v3`, `New`, `Legacy`) in function, component, variable, or file names. Use semantic names.
- Breaking changes to any MCP tool's input/output schema require a minor version bump and a README changelog entry in the affected package.
- When behavior changes, update the relevant doc under `docs/` or the package `README.md` in the **same** PR.
- For medium/large work (new package, new tool, cross-package refactor), create a plan under `docs/exec-plans/active/` **before** writing code. Follow `docs/templates/exec-plan-template.md`.
- Keep this file short. Do not move full specs here — link into `docs/`.

## Repo map

- `packages/` — publishable MCP servers (`@codon/mcp-swagger`, `@codon/mcporter-bridge-lite`, future ones)
- `docs/` — durable product and engineering knowledge (Chinese; this file and `packages/*/AGENTS.md` stay in English for prompt stability)
- `turbo.json` — build/dev/lint/test task graph (do not add tasks here without updating `docs/`)
- `pnpm-workspace.yaml` — workspace layout (only `packages/*`)

## What good changes look like

- Touch the smallest sensible surface area
- Update the relevant doc or `README.md` in the same PR
- Keep package boundaries cleaner than before, not muddier
- Are easy for the next agent to navigate from `AGENTS.md` alone

## Before opening a PR

- `pnpm build` passes for affected packages
- Types verify (`tsc` is part of `build`)
- README and/or `docs/` updated if behavior or tool schema changed
- If an active exec-plan was used, move it from `docs/exec-plans/active/` to `docs/exec-plans/completed/`
