export type SupportedProtocol = "openai" | "anthropic";
export type BalancingStrategy = "round_robin" | "random" | "ordered_failover";
export type InboundProtocol = "openai_chat" | "openai_responses" | "anthropic_messages";
export type RouteMode = "native_passthrough" | "translated";
export type TranslationFallback = "drop" | "error";

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  anthropicBaseUrl?: string | null;
  authType: string;
  supportedProtocols: SupportedProtocol[];
  timeoutMs: number;
  enabled: boolean;
  balancingStrategy: BalancingStrategy;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderKey {
  id: string;
  providerId: string;
  label: string;
  keyLast4: string;
  enabled: boolean;
  priority: number;
  createdAt: string;
}

export interface Model {
  id: string;
  publicSlug: string;
  providerId: string;
  upstreamModelId: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
  maxOutputTokens: number;
  capStreaming: boolean;
  capTools: boolean;
  capVision: boolean;
  capJsonMode: boolean;
  capCaching: boolean;
  capThinking: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProxyKey {
  id: string;
  label: string;
  keyPrefix: string;
  enabled: boolean;
  createdAt: string;
}

export interface RequestLog {
  id: string;
  timestamp: string;
  modelSlug: string | null;
  providerId: string | null;
  providerKeyLabel: string | null;
  proxyKeyLabel: string | null;
  inboundProtocol: string | null;
  routeMode: string | null;
  latencyMs: number | null;
  statusCode: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorSummary: string | null;
}

export interface UsageCounter {
  id: string;
  modelSlug: string;
  providerId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  resetAt: string;
}

export interface CreateProviderInput {
  name: string;
  baseUrl: string;
  anthropicBaseUrl?: string | null;
  authType?: string;
  supportedProtocols: SupportedProtocol[];
  timeoutMs?: number;
  balancingStrategy?: BalancingStrategy;
}

export interface UpdateProviderInput {
  name?: string;
  baseUrl?: string;
  anthropicBaseUrl?: string | null;
  authType?: string;
  supportedProtocols?: SupportedProtocol[];
  timeoutMs?: number;
  enabled?: boolean;
  balancingStrategy?: BalancingStrategy;
}

export interface CreateProviderKeyInput {
  label: string;
  secret: string;
  enabled?: boolean;
  priority?: number;
}

export interface CreateModelInput {
  publicSlug: string;
  providerId: string;
  upstreamModelId: string;
  inputPrice?: number;
  outputPrice?: number;
  contextWindow?: number;
  maxOutputTokens?: number;
  capStreaming?: boolean;
  capTools?: boolean;
  capVision?: boolean;
  capJsonMode?: boolean;
  capCaching?: boolean;
  capThinking?: boolean;
}

export interface UpdateModelInput {
  publicSlug?: string;
  upstreamModelId?: string;
  inputPrice?: number;
  outputPrice?: number;
  contextWindow?: number;
  maxOutputTokens?: number;
  capStreaming?: boolean;
  capTools?: boolean;
  capVision?: boolean;
  capJsonMode?: boolean;
  capCaching?: boolean;
  capThinking?: boolean;
  enabled?: boolean;
}

export interface CreateProxyKeyInput {
  label: string;
}

export interface ProxyKeyCreated {
  id: string;
  label: string;
  key: string;
  keyPrefix: string;
  createdAt: string;
}

export interface AdminAuthResponse {
  token: string;
}

export interface HealthResponse {
  status: "ok";
  version: string;
  uptime: number;
}

export interface DashboardStats {
  totalRequests: number;
  activeProviders: number;
  activeModels: number;
  recentErrors: RequestLog[];
  usageCounters: UsageCounter[];
}

export interface PaginatedLogs {
  logs: RequestLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LogFilters {
  modelSlug?: string;
  providerId?: string;
  statusCode?: number;
  startDate?: string;
  endDate?: string;
}

export interface ConfigBackup {
  providers: Omit<Provider, "id" | "createdAt" | "updatedAt">[];
  models: Omit<Model, "id" | "createdAt" | "updatedAt">[];
  proxyKeys: Omit<ProxyKey, "id" | "createdAt">[];
}
