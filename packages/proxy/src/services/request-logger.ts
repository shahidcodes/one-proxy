import { db } from "../db.js";
import { requestLogs } from "@one-proxy/shared";
import { v4 as uuid } from "uuid";

export interface LogEntry {
  modelSlug?: string;
  providerId?: string;
  providerKeyLabel?: string;
  proxyKeyLabel?: string;
  inboundProtocol?: string;
  routeMode?: string;
  latencyMs?: number;
  statusCode?: number;
  inputTokens?: number;
  outputTokens?: number;
  errorSummary?: string;
}

export function logRequest(entry: LogEntry) {
  try {
    db.insert(requestLogs).values({
      id: uuid(),
      timestamp: new Date().toISOString(),
      modelSlug: entry.modelSlug || null,
      providerId: entry.providerId || null,
      providerKeyLabel: entry.providerKeyLabel || null,
      proxyKeyLabel: entry.proxyKeyLabel || null,
      inboundProtocol: entry.inboundProtocol || null,
      routeMode: entry.routeMode || null,
      latencyMs: entry.latencyMs ?? null,
      statusCode: entry.statusCode ?? null,
      inputTokens: entry.inputTokens ?? null,
      outputTokens: entry.outputTokens ?? null,
      errorSummary: entry.errorSummary || null,
    }).run();
  } catch (err) {
    console.error("Failed to log request:", err);
  }
}
