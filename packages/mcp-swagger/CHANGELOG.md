# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.6] - 2026-04-01

### Added

- `reload_spec` tool — hot-reload OpenAPI spec without restarting the MCP server
- Startup retry with exponential backoff (default 3 attempts) when spec loading fails
- `SWAGGER_REFRESH_INTERVAL` env var — auto-refresh spec on a timer (in minutes)
- `SWAGGER_LOAD_RETRIES` env var — configure max startup retry attempts

### Changed

- Reload is safe: on failure, previous endpoint data is preserved instead of being wiped
- Better error logging: failed spec fetches now report the URL and specific error reason

## [0.1.5] - 2026-03-23

### Added

- `call_api` tool — make real HTTP requests to any URL with auto-detected HTTP method from Swagger spec

## [0.1.4] - 2026-03-19

### Changed

- Refactor single-file architecture (1414 lines) into modular structure with 15 focused modules

### Fixed

- Fix incorrect Knife4j doc URLs when multiple swagger-resources exist — each endpoint now tracks its own group name instead of using a global one

## [0.1.3] - 2026-03-18

### Added

- Dart class generation with `fromJson()` / `toJson()` support
- Semantic search with OpenAI embeddings (optional)

### Changed

- Improve README with configuration examples

## [0.1.2] - 2026-03-17

### Changed

- Update README with clearer setup instructions

## [0.1.1] - 2026-03-16

### Added

- TypeScript interface generation from API response schemas
- Recursive `$ref` resolution for nested types

## [0.1.0] - 2026-03-15

### Added

- Initial release
- `search_api` — keyword and semantic search for API endpoints
- `get_api_detail` — full endpoint details with parameters and schemas
- `list_api_tags` / `list_tag_apis` — browse endpoints by tag
- `open_api_doc` — open Knife4j documentation page in browser
- Support for Knife4j, Swagger 2.0, OpenAPI 3.0
