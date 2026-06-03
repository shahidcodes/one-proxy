import { db } from "../db.js";
import { models, providers } from "@one-proxy/shared";
import { eq, and } from "drizzle-orm";
import type { Model, Provider, SupportedProtocol, InboundProtocol } from "@one-proxy/shared";

export interface ResolvedRoute {
  model: Model;
  provider: Provider;
  isNative: boolean;
  needsTranslation: boolean;
  targetProtocol: SupportedProtocol;
}

function getInboundProtocolFromPath(path: string): InboundProtocol | null {
  if (path.includes("/chat/completions")) return "openai_chat";
  if (path.includes("/responses")) return "openai_responses";
  if (path.includes("/messages")) return "anthropic_messages";
  return null;
}

function getProtocolFamily(protocol: InboundProtocol): SupportedProtocol {
  return protocol.startsWith("openai") ? "openai" : "anthropic";
}

export function resolveModel(modelSlug: string, requestPath: string): ResolvedRoute | null {
  const modelRow = db.select().from(models)
    .where(and(eq(models.publicSlug, modelSlug), eq(models.enabled, 1)))
    .get();

  if (!modelRow) return null;

  const providerRow = db.select().from(providers)
    .where(and(eq(providers.id, modelRow.providerId), eq(providers.enabled, 1)))
    .get();

  if (!providerRow) return null;

  const provider: Provider = {
    ...providerRow,
    supportedProtocols: JSON.parse(providerRow.supportedProtocols),
    enabled: providerRow.enabled === 1,
    capStreaming: false, capTools: false, capVision: false, capJsonMode: false, capCaching: false, capThinking: false,
  } as any;

  const model: Model = {
    ...modelRow,
    enabled: modelRow.enabled === 1,
    capStreaming: modelRow.capStreaming === 1,
    capTools: modelRow.capTools === 1,
    capVision: modelRow.capVision === 1,
    capJsonMode: modelRow.capJsonMode === 1,
    capCaching: modelRow.capCaching === 1,
    capThinking: modelRow.capThinking === 1,
  };

  const inboundProtocol = getInboundProtocolFromPath(requestPath);
  const inboundFamily = inboundProtocol ? getProtocolFamily(inboundProtocol) : "openai";
  const supportedProtocols: SupportedProtocol[] = provider.supportedProtocols;

  const isNative = supportedProtocols.includes(inboundFamily);
  const targetProtocol: SupportedProtocol = isNative ? inboundFamily : (supportedProtocols[0] || "openai");

  return {
    model,
    provider,
    isNative,
    needsTranslation: !isNative,
    targetProtocol,
  };
}
