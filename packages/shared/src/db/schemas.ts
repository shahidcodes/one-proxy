import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const providers = sqliteTable("providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  anthropicBaseUrl: text("anthropic_base_url"),
  authType: text("auth_type").notNull().default("bearer"),
  supportedProtocols: text("supported_protocols").notNull().default("[]"),
  timeoutMs: integer("timeout_ms").notNull().default(120000),
  enabled: integer("enabled").notNull().default(1),
  balancingStrategy: text("balancing_strategy").notNull().default("round_robin"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const providerKeys = sqliteTable("provider_keys", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  encryptedSecret: text("encrypted_secret").notNull(),
  keyLast4: text("key_last4").notNull(),
  enabled: integer("enabled").notNull().default(1),
  priority: integer("priority").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const models = sqliteTable("models", {
  id: text("id").primaryKey(),
  publicSlug: text("public_slug").notNull().unique(),
  providerId: text("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  upstreamModelId: text("upstream_model_id").notNull(),
  inputPrice: real("input_price").notNull().default(0),
  outputPrice: real("output_price").notNull().default(0),
  contextWindow: integer("context_window").notNull().default(128000),
  maxOutputTokens: integer("max_output_tokens").notNull().default(8192),
  capStreaming: integer("cap_streaming").notNull().default(1),
  capTools: integer("cap_tools").notNull().default(0),
  capVision: integer("cap_vision").notNull().default(0),
  capJsonMode: integer("cap_json_mode").notNull().default(0),
  capCaching: integer("cap_caching").notNull().default(0),
  capThinking: integer("cap_thinking").notNull().default(0),
  enabled: integer("enabled").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const proxyKeys = sqliteTable("proxy_keys", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  enabled: integer("enabled").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

export const requestLogs = sqliteTable("request_logs", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  modelSlug: text("model_slug"),
  providerId: text("provider_id"),
  providerKeyLabel: text("provider_key_label"),
  proxyKeyLabel: text("proxy_key_label"),
  inboundProtocol: text("inbound_protocol"),
  routeMode: text("route_mode"),
  latencyMs: integer("latency_ms"),
  statusCode: integer("status_code"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  errorSummary: text("error_summary"),
});

export const usageCounters = sqliteTable("usage_counters", {
  id: text("id").primaryKey(),
  modelSlug: text("model_slug").notNull(),
  providerId: text("provider_id").notNull(),
  totalInputTokens: integer("total_input_tokens").notNull().default(0),
  totalOutputTokens: integer("total_output_tokens").notNull().default(0),
  totalRequests: integer("total_requests").notNull().default(0),
  resetAt: text("reset_at").notNull(),
});
