export const DEFAULT_PORT = 15000;
export const DEFAULT_TIMEOUT_MS = 120000;
export const DEFAULT_PUBLIC_URL = "http://localhost:15000";
export const DEFAULT_TRANSLATION_FALLBACK = "drop";
export const MAX_BODY_SIZE_MB = 50;
export const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 30000;
export const KEY_DEGRADATION_COOLDOWN_MS = 5 * 60 * 1000;
export const MAX_FAILOVER_RETRIES = 2;
export const LOG_PAGE_SIZE = 50;
export const JWT_EXPIRY_HOURS = 24;

export const SEED_PROVIDERS = [
  {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    supportedProtocols: ["anthropic"] as const,
  },
  {
    name: "OpenAI",
    baseUrl: "https://api.openai.com",
    supportedProtocols: ["openai"] as const,
  },
  {
    name: "Google",
    baseUrl: "https://generativelanguage.googleapis.com",
    supportedProtocols: ["openai"] as const,
  },
];

export const PROTOCOL_ENDPOINTS = {
  openai_chat: "/v1/chat/completions",
  openai_responses: "/v1/responses",
  anthropic_messages: "/v1/messages",
} as const;

export const ERROR_CODES = {
  INVALID_API_KEY: "invalid_api_key",
  MODEL_NOT_FOUND: "model_not_found",
  PROVIDER_DISABLED: "provider_disabled",
  NO_ACTIVE_KEYS: "no_active_keys",
  TRANSLATION_ERROR: "translation_error",
  UPSTREAM_ERROR: "upstream_error",
  UNSUPPORTED_FEATURE: "unsupported_feature",
  INTERNAL_ERROR: "internal_error",
} as const;
