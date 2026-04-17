# AGENTS.md — `@codon/mcp-swagger`

## Purpose

MCP server that turns a Swagger 2.0 / OpenAPI 3.0 / Knife4j spec into structured tools (search, detail, listing, type generation, update detection, direct call). Consumed by MCP clients (Cursor, Claude Desktop, Continue).

## Read first

1. `README.md` in this package (setup, env vars, examples)
2. `../../docs/product-specs/mcp-swagger.md` (capabilities, boundaries, acceptance)
3. `../../AGENTS.md` (monorepo-wide rules)
4. Any active plan in `../../docs/exec-plans/active/` whose name contains `swagger`

## Hard constraints

- All MCP tool inputs are declared with `zod`. Do not hand-roll JSON Schema or skip validation.
- When adding, removing, or renaming a tool, update **three** places in the same PR:
  1. This package's `README.md` (Features table)
  2. `../../docs/product-specs/mcp-swagger.md` (Core capabilities table)
  3. Package version bump (minor for breaking, patch for additive)
- **Do not** trigger the automatic freshness check inside these three tools: `check_updates`, `reload_spec`, `call_api`. This is a load-bearing invariant — violating it causes recursive reloads and broken diff semantics.
- **Do not** introduce new runtime env vars without documenting them in `README.md`'s env var table.
- Embedding search (`search_api` semantic mode) must gracefully degrade to keyword search when `OPENAI_API_KEY` is absent — never throw.
- Generated code output (`generate_types`) must resolve `$ref` recursively and never emit `any` / `dynamic` where the spec provides a concrete type.
- No version-suffix names (`v2`, `v3`, `Legacy`) in source identifiers. Rename with semantic names instead.

## Common task entrypoints

- **Adding a new tool**: start from `../../docs/templates/exec-plan-template.md`, file a plan under `../../docs/exec-plans/active/`, wait for clarification, then implement.
- **Changing an existing tool's schema**: check if consumers rely on the current shape; if yes, minor bump + changelog in README.
- **Debugging freshness behavior**: `SWAGGER_FRESHNESS_THROTTLE_MS` is the throttle knob; do not repurpose it for other caching.

## Out of scope for this package

- API mocking / fake server
- gRPC / GraphQL / AsyncAPI support (open a separate package if ever needed)
- Spec editing or visualization UI
