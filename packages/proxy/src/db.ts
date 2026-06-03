import { createDb, type Database } from "@one-proxy/shared";
import { providers, models, providerKeys, proxyKeys, requestLogs, usageCounters } from "@one-proxy/shared";
import { SEED_PROVIDERS } from "@one-proxy/shared";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Config } from "./config.js";

export let db: Database;

export function initDatabase(config: Config) {
  const result = createDb(config.dbPath);
  db = result.db;

  const sqlite = result.sqlite;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      anthropic_base_url TEXT,
      auth_type TEXT NOT NULL DEFAULT 'bearer',
      supported_protocols TEXT NOT NULL DEFAULT '[]',
      timeout_ms INTEGER NOT NULL DEFAULT 120000,
      enabled INTEGER NOT NULL DEFAULT 1,
      balancing_strategy TEXT NOT NULL DEFAULT 'round_robin',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS provider_keys (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      encrypted_secret TEXT NOT NULL,
      key_last4 TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      public_slug TEXT NOT NULL UNIQUE,
      provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      upstream_model_id TEXT NOT NULL,
      input_price REAL NOT NULL DEFAULT 0,
      output_price REAL NOT NULL DEFAULT 0,
      context_window INTEGER NOT NULL DEFAULT 128000,
      max_output_tokens INTEGER NOT NULL DEFAULT 8192,
      cap_streaming INTEGER NOT NULL DEFAULT 1,
      cap_tools INTEGER NOT NULL DEFAULT 0,
      cap_vision INTEGER NOT NULL DEFAULT 0,
      cap_json_mode INTEGER NOT NULL DEFAULT 0,
      cap_caching INTEGER NOT NULL DEFAULT 0,
      cap_thinking INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS proxy_keys (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS request_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      model_slug TEXT,
      provider_id TEXT,
      provider_key_label TEXT,
      proxy_key_label TEXT,
      inbound_protocol TEXT,
      route_mode TEXT,
      latency_ms INTEGER,
      status_code INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      error_summary TEXT
    );
    CREATE TABLE IF NOT EXISTS usage_counters (
      id TEXT PRIMARY KEY,
      model_slug TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      total_input_tokens INTEGER NOT NULL DEFAULT 0,
      total_output_tokens INTEGER NOT NULL DEFAULT 0,
      total_requests INTEGER NOT NULL DEFAULT 0,
      reset_at TEXT NOT NULL
    );
  `);

  migrateAddAnthropicBaseUrl(sqlite);
  seedProviders();
  return db;
}

function migrateAddAnthropicBaseUrl(sqlite: any) {
  const cols = sqlite.prepare("PRAGMA table_info(providers)").all() as { name: string }[];
  if (!cols.some((c: { name: string }) => c.name === "anthropic_base_url")) {
    sqlite.exec("ALTER TABLE providers ADD COLUMN anthropic_base_url TEXT");
  }
}

function seedProviders() {
  const existing = db.select().from(providers).all();
  if (existing.length > 0) return;

  const now = new Date().toISOString();
  for (const seed of SEED_PROVIDERS) {
    db.insert(providers).values({
      id: uuid(),
      name: seed.name,
      baseUrl: seed.baseUrl,
      authType: "bearer",
      supportedProtocols: JSON.stringify(seed.supportedProtocols),
      timeoutMs: 120000,
      enabled: 0,
      balancingStrategy: "round_robin",
      createdAt: now,
      updatedAt: now,
    }).run();
  }
}
