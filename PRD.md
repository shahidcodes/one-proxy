# One Proxy — Self-Hosted LLM Proxy for Coding Agents

## Overview

One Proxy is a self-hosted LLM proxy for developers who use multiple coding agents and multiple model providers, and want a single stable endpoint instead of configuring each tool separately. It behaves like a minimal OpenRouter-style gateway, designed for self-hosting, simple model management, protocol-aware forwarding, and operational control over provider accounts and API keys.

The proxy sits between a coding agent and upstream LLM providers: agent requests enter the proxy, the proxy either passes them through or translates them, and the chosen provider handles the final inference. The product must preserve prompt caching whenever possible, because OpenAI prompt caching depends on identical prompt prefixes over a token threshold and Anthropic-style prompt caching depends on stable prompt structure and cacheable prompt sections.

## Problem

Developers who work with Anthropic, OpenAI, Gemini, and other model vendors have to repeat the same configuration work in every coding tool they use. That means duplicating provider URLs, model names, API keys, and provider-specific behavior across editors, CLIs, and coding agents, which creates friction and makes switching providers or models unnecessarily painful.

A second problem is that protocol translation can unintentionally break prompt caching and compatibility-sensitive behaviors. OpenAI prompt caching is automatically applied to prompts longer than 1,024 tokens when the beginning of the prompt is identical, while Anthropic-oriented integrations emphasize explicit cacheable prompt sections and stable reusable prefixes. Unnecessary transformation of messages, tools, or request shape can reduce cache hits, raise cost, and increase latency.

## Product Vision

One Proxy becomes the single source of truth for model access used by coding agents in a self-hosted environment. Instead of configuring each coding tool individually for every provider, the user configures providers and models once inside the proxy, then points each tool at the proxy using a compatible host URL and model name.

The product is intentionally narrow in scope for V1. It is not a marketplace, not a reseller layer, and not a full policy engine; it is a practical compatibility gateway with a UI for provider and model management, a page for easy client setup, and a key-pool page for balancing requests across several API keys per provider.

## Goals

- Provide one self-hosted endpoint for multiple coding agents.
- Centralize provider, model, pricing, and context-window configuration in one UI.
- Prefer protocol-native forwarding over translation when the upstream provider already supports the incoming wire protocol.
- Preserve cacheability by minimizing request mutation and keeping prompt structure stable.
- Generate a setup page with host URL, model name, and copy-pasteable integration details for end users.
- Generate a Markdown skill snippet that users can paste into coding agents or agent configuration flows.
- Support multiple API keys per provider with configurable balancing modes (round-robin, random, ordered failover).

## Non-goals

- Advanced policy engine, org governance, or budget enforcement in V1.
- Cross-provider smart routing based on quality, latency, or price in V1.
- End-user billing, invoicing, or reseller workflows in V1.
- Deep observability, analytics, or evaluation tooling in V1.
- Fine-tuning management, embeddings catalog management, or training workflows in V1.
- WebSocket support in V1.
- Rate limiting (deferred from V1 — upstream providers enforce their own limits).

## Target Users

### Primary user

A technical developer or small engineering team that uses several coding agents and wants one self-hosted LLM entry point with centralized control over providers and models.

### Secondary user

An internal team admin who manages several API keys, rotates traffic between accounts, and publishes a clean connection page so teammates can quickly add models to their coding tools.

## Core Principles

### 1. Client experience must not degrade

Coding agents (Claude Code, Codex, Cursor, Cline, Aider, etc.) must work through the proxy exactly as they would when talking to the provider natively. Any feature the agent uses must either be faithfully translated or — if translation is impossible — handled according to the `TRANSLATION_FALLBACK` env var (`drop` or `error`).

### 2. Cache safety first

The proxy preserves request structure whenever possible because prompt caching depends on prompt-prefix stability and consistent request shape.

### 3. Pass-through before translation

If a provider supports the client's incoming protocol natively, the proxy uses that native endpoint instead of translating the request. This reduces complexity, lowers the chance of semantic mismatches, and preserves compatibility with tools, streaming, and cache-related behavior.

### 4. Self-hosted and simple

The product is deployable by a developer on their own infrastructure with minimal moving parts. A single Docker container, a single SQLite file, no external services required.

## Inbound Protocol Support (V1)

The proxy accepts three inbound protocol families:

| Protocol | Endpoint | Used by |
|----------|----------|---------|
| OpenAI Chat Completions | `POST /v1/chat/completions` | Cursor, Cline, Aider, most agents |
| OpenAI Responses API | `POST /v1/responses` | Codex |
| Anthropic Messages | `POST /v1/messages` | Claude Code, Cline |

Additionally, the proxy exposes:

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/models` | Lists all enabled models in OpenAI format |
| `GET /health` | Health check (unauthenticated) |

## Translation Strategy

### Translation pairs

Only OpenAI ↔ Anthropic translation is supported in V1. Providers must support at least one of these two protocols. Custom/native-only protocols (e.g., raw Google Gemini REST) are out of scope.

### Translation depth: pragmatic middle

The proxy translates core fields that coding agents rely on:

- `messages` (including system messages, multi-turn, tool results)
- `tools` / function-calling definitions and responses
- `max_tokens`, `temperature`, `top_p`, `stream`
- Multi-modal content (image format conversion between OpenAI `image_url` and Anthropic `image` source)
- Thinking/reasoning tokens (when a clean mapping exists)

Features that cannot be cleanly translated:

- Controlled by `TRANSLATION_FALLBACK` env var:
  - `drop` (default): silently drop the unsupported feature, log a warning, fulfill the request
  - `error`: return a protocol-appropriate error to the client
- If dropping the feature would cause the client to misparse the response or behave incorrectly, the proxy errors out regardless of the env var setting

### Specific translation rules

| Feature | OpenAI → Anthropic | Anthropic → OpenAI |
|---------|-------------------|-------------------|
| System messages | Extract from messages array, concatenate with `\n\n` into `system` param | Take `system` param, prepend as `{"role": "system"}` message |
| Tools | `function.name` → `name`, `function.parameters` → `input_schema` | `name` → `function.name`, `input_schema` → `function.parameters` |
| Tool calls | `tool_calls[].function.arguments` (string) → `input` (object) | `input` (object) → `arguments` (string) |
| Tool results | `{"role": "tool", "tool_call_id"}` → `{"type": "tool_result", "tool_use_id"}` | Reverse |
| `cache_control` markers | N/A (OpenAI doesn't have them) | Drop silently, log warning |
| Thinking tokens | Translate text content when clean mapping exists, drop `signature` | Translate text content when clean mapping exists |
| Images | `image_url` (data URL) → `image` source (base64 + media_type) | `image` source → `image_url` (data URL) |

### Streaming translation

Chunk-by-chunk transform (no buffering). A dedicated `StreamTranslator` class per direction maintains minimal state and emits transformed SSE events as they arrive:

- OpenAI → Anthropic: synthesize `content_block_start`, `content_block_delta`, `message_start`, `message_stop` events from flat OpenAI deltas
- Anthropic → OpenAI: collapse Anthropic's multi-event structure into OpenAI's flat delta format

If the upstream stream dies mid-response, forward a protocol-appropriate error event and close the stream. Do not retry mid-stream.

### Error response format

Always match the inbound protocol:

- OpenAI: `{"error": {"message": "...", "type": "...", "code": "..."}}`
- Anthropic: `{"type": "error", "error": {"type": "...", "message": "..."}}`

## Model Mapping

Strict 1:1 in V1 — one public model slug maps to exactly one provider and one upstream model identifier. No fallback chains, no cross-provider routing.

Model slugs are namespaced with provider prefix: `anthropic/claude-sonnet-4-20250514`, `openai/gpt-4o`, `google/gemini-2.5-pro`.

## API Key Pools & Balancing

### Per-provider key pools

Each provider can have multiple API keys. Each key has:

- A human-readable label (e.g., "Personal account", "Team account #2")
- Independent enabled/disabled toggle
- Priority value (for ordered failover)

### Balancing strategies

| Strategy | Behavior |
|----------|----------|
| Round-robin | Each active key is used in sequence |
| Random | Any active key may be selected |
| Ordered failover | Preferred key is used until it fails, then next key |

### State management

Balancing state (round-robin counter, failover position) is **in-memory only**. Resets on restart — this is acceptable because all keys serve the same provider.

### Automatic failover

If a key returns 429 or 500, immediately retry with the next key in the pool (max 2 retries). The failing key is marked as degraded in-memory with a 5-minute cooldown, deprioritized by the balancer.

### Key health

Manual only in V1. No background health checks. A "Test" button in the UI sends a minimal request (1-token completion) to verify a key works. Keys that return 401/403 during real requests are auto-marked as `error` in-memory and skipped.

## Proxy Authentication

Per-user API keys with labels. Generated in the admin UI, given names like "Cursor on MacBook" or "Claude Code on server." Keys are:

- Hashed with SHA-256 before storage (never stored in plaintext)
- Shown once on creation, never retrievable after
- Used via `Authorization: Bearer <key>` header
- Logged by label (not by key value) in request logs

## Admin UI Authentication

Single admin password, set via `ADMIN_PASSWORD` env var. On first boot, if not set, a password is generated and printed to console. Login sets an HTTP-only JWT cookie (signed with `ENCRYPTION_KEY`, 24h expiry). No user management, no roles.

## Admin UI Pages

### Navigation

Sidebar with 6 sections: Dashboard, Providers, Models, Key Pools, Connection, Logs.

### Dashboard

Summary stats: total requests, active providers, active models, recent errors. Onboarding checklist for first-run: "1. Add a provider → 2. Add API keys → 3. Add a model → 4. Connect your coding agent."

### Providers page

CRUD for providers. Shows base URL, protocol support (badges for OpenAI/Anthropic), status. Validates base URL reachability on save (non-blocking warning if unreachable).

### Models page

CRUD for models. Search, filtering, enabled-state toggles. Capability flags displayed as badges. Manual pricing entry + bulk JSON import option (`[{slug, input_price, output_price}]`).

### Key Pools page

Separate from provider editing. Shows all keys per provider, labels, status, balancing strategy, health indicators. Add/remove/enable/disable keys. "Test" button per key.

### Connection page

Per-model details optimized for copy-paste setup:

- Proxy host URL (from `PROXY_PUBLIC_URL` env var, defaults to `http://localhost:15000`)
- Public model name (namespaced slug)
- Auth instructions (`Authorization: Bearer <proxy-api-key>`)
- Sample environment variables for each agent
- Agent-specific skill Markdown snippets for: Claude Code, Cursor, Cline, and a generic fallback

### Logs page

Pagination (50 rows per page, newest first). Filters: model, provider, status, date range. "Clear logs" button. Auto-prune setting (keep last N entries or last N days).

## Request Flow

1. Client sends request to `POST /v1/chat/completions`, `POST /v1/responses`, or `POST /v1/messages`.
2. Proxy authenticates the caller via per-user API key.
3. Proxy resolves the requested public model slug to an internal model record.
4. Proxy selects the mapped provider.
5. Proxy selects an active API key from that provider's key pool per the configured balancing strategy.
6. Proxy checks whether the provider supports the incoming wire protocol natively.
7. If native support exists → forward with minimal mutation (pass-through).
8. If native support does not exist → translate conservatively and forward.
9. Proxy returns the response in the caller's expected wire format.
10. Proxy records a request log with route details and result.

## Data Model

### Provider

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (UUID) | Unique identifier |
| name | TEXT | Human-readable provider name |
| base_url | TEXT | Upstream API base URL |
| auth_type | TEXT | Auth mechanism (bearer token in V1) |
| supported_protocols | TEXT (JSON array) | `["openai", "anthropic"]` |
| timeout_ms | INTEGER | Per-provider request timeout (default 120000) |
| enabled | INTEGER (0/1) | Whether provider is active |
| created_at | TEXT (ISO 8601) | Creation timestamp |
| updated_at | TEXT (ISO 8601) | Last update timestamp |

### ProviderKey

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (UUID) | Unique identifier |
| provider_id | TEXT (FK) | Linked provider |
| label | TEXT | Human-readable label |
| encrypted_secret | TEXT | AES-256-GCM encrypted API key (IV + ciphertext + auth tag) |
| key_last4 | TEXT | Last 4 characters of the key (for display) |
| enabled | INTEGER (0/1) | Whether the key can be selected |
| priority | INTEGER | Order value for failover mode |
| created_at | TEXT (ISO 8601) | Creation timestamp |

### Model

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (UUID) | Unique identifier |
| public_slug | TEXT (UNIQUE) | Namespaced model name (e.g., `anthropic/claude-sonnet-4-20250514`) |
| provider_id | TEXT (FK) | Linked provider |
| upstream_model_id | TEXT | Upstream model identifier |
| input_price | REAL | Input token price (per 1M tokens) |
| output_price | REAL | Output token price (per 1M tokens) |
| context_window | INTEGER | Maximum context size in tokens |
| max_output_tokens | INTEGER | Maximum output size in tokens |
| cap_streaming | INTEGER (0/1) | Supports streaming |
| cap_tools | INTEGER (0/1) | Supports tools/function-calling |
| cap_vision | INTEGER (0/1) | Supports image inputs |
| cap_json_mode | INTEGER (0/1) | Supports structured output / JSON mode |
| cap_caching | INTEGER (0/1) | Supports prompt caching |
| cap_thinking | INTEGER (0/1) | Supports thinking/reasoning tokens |
| enabled | INTEGER (0/1) | Whether model is available |
| created_at | TEXT (ISO 8601) | Creation timestamp |
| updated_at | TEXT (ISO 8601) | Last update timestamp |

### ProxyKey

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (UUID) | Unique identifier |
| label | TEXT | Human-readable label (e.g., "Cursor on MacBook") |
| key_hash | TEXT | SHA-256 hash of the proxy API key |
| key_prefix | TEXT | First 8 characters (for identification) |
| enabled | INTEGER (0/1) | Whether the key is active |
| created_at | TEXT (ISO 8601) | Creation timestamp |

### RequestLog

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (UUID) | Unique identifier |
| timestamp | TEXT (ISO 8601) | Time of request |
| model_slug | TEXT | Public model used |
| provider_id | TEXT | Selected provider |
| provider_key_label | TEXT | Selected key label |
| proxy_key_label | TEXT | Proxy API key label used by client |
| inbound_protocol | TEXT | `openai_chat`, `openai_responses`, or `anthropic_messages` |
| route_mode | TEXT | `native_passthrough` or `translated` |
| latency_ms | INTEGER | End-to-end latency |
| status_code | INTEGER | HTTP result status |
| input_tokens | INTEGER | Input tokens (from upstream response usage) |
| output_tokens | INTEGER | Output tokens (from upstream response usage) |
| error_summary | TEXT | Optional error text |

### UsageCounter

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (UUID) | Unique identifier |
| model_slug | TEXT | Model slug |
| provider_id | TEXT | Provider ID |
| total_input_tokens | INTEGER | Cumulative input tokens |
| total_output_tokens | INTEGER | Cumulative output tokens |
| total_requests | INTEGER | Cumulative request count |
| reset_at | TEXT (ISO 8601) | Last reset timestamp |

## Cache Preservation Rules

- Preserve message order.
- Preserve tool order.
- Preserve text exactly in pass-through mode.
- Preserve cache-related fields when supported by the upstream protocol.
- Avoid injecting extra text, formatting, or metadata into user-visible prompt content.
- Avoid unnecessary normalization of JSON fields if it could affect upstream cache matching.
- Expose cache-related usage metadata in logs where available.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENCRYPTION_KEY` | No (auto-generated on first boot) | — | 32-byte hex key for AES-256-GCM encryption of provider secrets |
| `ADMIN_PASSWORD` | No (auto-generated on first boot) | — | Admin UI login password |
| `PROXY_PUBLIC_URL` | No | `http://localhost:15000` | Public URL used in Connection page snippets |
| `TRANSLATION_FALLBACK` | No | `drop` | `drop` or `error` — behavior when a feature cannot be translated |
| `DEBUG_LOG_BODIES` | No | `false` | When `true`, log full request/response bodies to a separate rotating file |
| `PORT` | No | `15000` | Port the proxy listens on |

## Deployment

### Single Docker container

```
docker run -d \
  -p 15000:15000 \
  -v ./data:/app/data \
  -e ENCRYPTION_KEY=<key> \
  -e ADMIN_PASSWORD=<password> \
  one-proxy
```

The SQLite database lives at `/app/data/one-proxy.db` inside the mounted volume.

### TLS

Delegated to a reverse proxy. Recommended: Caddy with automatic HTTPS.

```
proxy.example.com {
    reverse_proxy localhost:15000
}
```

### Seed data

On first boot, auto-create provider records for Anthropic, OpenAI, and Google with standard base URLs and protocol flags pre-filled. No models are seeded (pricing and availability change too frequently).

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | TypeScript + Hono |
| Database | SQLite (better-sqlite3) |
| ORM | Drizzle ORM + Drizzle Kit (migrations) |
| Frontend | React SPA + Vite |
| UI components | Tailwind CSS + shadcn/ui |
| Monorepo | pnpm workspaces + Nx (`nx tui` for dev) |
| Testing | Vitest |
| Containerization | Docker (single image) |
| License | MIT |

### Project structure

```
one-proxy/
  packages/
    proxy/          # Hono backend, protocol translation, routing
    ui/             # React SPA, admin dashboard
    shared/         # Shared types, Drizzle schemas, API contract types, constants
  docker-compose.yml
  Dockerfile
  nx.json
  pnpm-workspace.yaml
  package.json
```

### API route separation

| Prefix | Purpose | Auth |
|--------|---------|------|
| `/v1/*` | Proxy API (for coding agents) | Per-user API key |
| `/api/admin/*` | Admin CRUD (for the UI) | Admin password cookie |
| `/health` | Health check | None |
| `/` | Static UI files (production) | Admin password cookie |

### Development

```
pnpm install
nx tui                    # Runs proxy + UI concurrently
```

Vite dev server proxies `/v1/*` and `/api/admin/*` to Hono on port 15000. UI runs on port 5173 during dev. In production, Hono serves the built static files directly on port 15000.

### Testing focus

Unit tests for translation logic (O↔A message/tool/stream transforms) — this is the most bug-prone code. Integration tests using in-memory SQLite for the routing/key-selection layer.

## Operational Details

### Request body size limit

50MB max (Hono body limit middleware).

### Upstream timeout

120 seconds default, configurable per-provider. Timeout applies to time-between-chunks for streaming responses, not total response time.

### Graceful shutdown

On SIGTERM/SIGINT: stop accepting new connections, wait up to 30 seconds for in-flight streaming responses to complete, then force-close.

### CORS

- Proxy API (`/v1/*`): `Access-Control-Allow-Origin: *` (open — coding agents may run anywhere)
- Admin API (`/api/admin/*`): same-origin only

### Logging

- Structured JSON to stdout (timestamp, level, msg, contextual fields)
- Pretty-printed in development
- Request logs stored in SQLite as structured records
- Full body logging opt-in via `DEBUG_LOG_BODIES=true` (writes to separate rotating file)

### Usage tracking

Cumulative counters per model and per provider: `total_input_tokens`, `total_output_tokens`, `total_requests`. Displayed on admin dashboard. Reset button available in UI.

### Configuration backup

- JSON export/import for all providers, models, and key pool configs (excludes encrypted secrets — must be re-entered after import)
- SQLite backup download button in settings (triggers `.backup` command)

### Versioning

Version read from `package.json` at build time, injected as a build constant. Displayed in admin UI footer and `/health` endpoint. Git commit hash as secondary identifier in development.

## Risks and Trade-offs

### Protocol mismatch risk

Translating between OpenAI-style and Anthropic-style protocols can create subtle mismatches around tools, streaming events, or request semantics. Native pass-through is always preferred when available.

### Cache degradation risk

Prompt caching can be weakened by even small changes to the beginning of a request or to the structure of cached sections. The proxy minimizes mutation and preserves structure by design.

### Metadata drift risk

Model pricing and context information can become stale if stored manually. Bulk JSON import helps, but operators should periodically verify pricing against provider documentation.

### Scope creep risk

It will be tempting to add policy, spend control, dynamic routing, and agent-specific integrations too early. V1 is a simple, self-hosted, cache-aware compatibility layer.

## Milestones

### Milestone 1: Core proxy

- Hono server with `/v1/chat/completions`, `/v1/responses`, `/v1/messages`, `/v1/models`
- Model resolution (slug → provider + upstream model)
- Provider key pool with round-robin, random, ordered failover
- Native pass-through for all three inbound protocols
- Translation layer (O↔A) for messages, tools, streaming, images, thinking tokens
- Automatic failover within key pool (max 2 retries)
- Request logging to SQLite
- Proxy API key authentication
- Graceful shutdown

### Milestone 2: Admin UI

- Admin password authentication
- Dashboard with summary stats and onboarding checklist
- Providers page (CRUD, URL validation, protocol badges)
- Models page (CRUD, search, filtering, capability flags, pricing import)
- Key Pools page (CRUD, balancing strategy, test button, health indicators)
- Proxy key management (generate, label, revoke)
- Settings page (encryption key status, public URL, translation fallback, backup/restore)

### Milestone 3: Setup experience

- Connection page per model (host URL, model name, auth instructions, env var snippets)
- Agent-specific skill Markdown generator (Claude Code, Cursor, Cline, generic)
- Cumulative usage counters on dashboard

### Milestone 4: Hardening

- Logs page with pagination and filters
- Health indicators and error handling improvements
- Cache-sensitive request validation
- Auto-prune for logs
- `/health` endpoint with version and uptime

## Acceptance Criteria

- An admin can add a provider, save its base URL and protocol support, and enable it.
- An admin can attach multiple keys to the same provider and choose round-robin, random, or ordered failover.
- An admin can add a model with pricing, context window, capability flags, and upstream mapping.
- A user can open a model Connection page and copy the proxy host URL, model name, and setup instructions.
- A coding agent (Claude Code, Codex, Cursor, Cline, Aider) can send a request to the proxy and receive a successful response identical to a native provider connection.
- If the provider supports the inbound wire protocol natively, the proxy uses pass-through instead of translation.
- The proxy preserves request structure sufficiently to avoid unnecessary cache loss.
- The logs page shows whether a request used pass-through or translation and which provider key was selected.
- Translation handles messages, tools, tool results, streaming, images, and thinking tokens between OpenAI and Anthropic formats.
- When translation cannot perfectly preserve a feature, behavior is controlled by `TRANSLATION_FALLBACK` (drop or error).
