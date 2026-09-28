# One Proxy

A self-hosted LLM gateway for coding agents. Configure providers, models and API keys once; point Claude Code, Codex, Cursor, Cline or Aider at one endpoint.

It is a single Docker container with a SQLite file and an admin UI. The full product spec, including non-goals, is in [PRD.md](PRD.md).

## Design decisions

**Pass-through before translation.** If the upstream provider speaks the client's protocol, the request is forwarded with only the model ID rewritten. Translation happens only when protocols differ. Every mutation is a chance to break a tool call or a cache hit, so the default path does none.

**Cache safety.** OpenAI caches identical prompt prefixes and Anthropic caches explicitly marked sections. The proxy keeps message order and structure stable so that routing through it doesn't lower cache hit rates. `cache_control` markers survive native pass-through; they are lost only when translating to OpenAI, which has no equivalent.

**Explicit fallback for untranslatable features.** `TRANSLATION_FALLBACK=drop` logs and removes a feature the target protocol can't express (unknown params, thinking config); `error` rejects the request instead of silently changing its meaning.

**Key pools with failover.** Each provider holds several API keys, selected by round-robin, random, or ordered failover. A `429` or `5xx` marks the key degraded for five minutes and retries on the next healthy key (up to two retries). If every key is degraded, the pool falls back to all keys rather than failing closed.

**Secrets at rest.** Provider keys are stored AES-256-GCM encrypted. Client keys (`op-…`) are stored only as SHA-256 hashes.

## Protocol support

| Inbound | Endpoint | Upstream |
|---|---|---|
| OpenAI Chat Completions | `POST /v1/chat/completions` | native, or translated to Anthropic Messages |
| Anthropic Messages | `POST /v1/messages` | native, or translated to OpenAI Chat |
| OpenAI Responses | `POST /v1/responses` | pass-through only |

Translation covers system prompts, multi-turn messages, tools and tool results, images and sampling params, for both buffered and SSE-streamed responses.

## Layout

```
packages/
  proxy/    Hono server: routing, translation, streaming, key pools, admin API
  shared/   Drizzle schema, crypto, types
  ui/       React admin: providers, models, key pools, client setup, request logs
```

## Running

```bash
docker compose up -d        # http://localhost:15000
```

Set `ENCRYPTION_KEY` (32 bytes, hex) and `ADMIN_PASSWORD`. Without an `ENCRYPTION_KEY` the proxy generates one at startup, and stored keys become unreadable after a restart.

Development:

```bash
pnpm install
pnpm --filter @one-proxy/proxy test
pnpm dev
```

## Status

Personal project, V1 in progress. Not implemented yet: Responses API translation, rate limiting, per-key budget enforcement.
