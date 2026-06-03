import type { Config } from "../config.js";
import type { ResolvedRoute } from "../services/model-resolver.js";
import { selectKey, getNextFailoverKey, markKeyDegraded, type SelectedKey } from "../services/key-pool.js";
import { translateOpenAIToAnthropic, translateAnthropicResponseToOpenAI } from "../translation/openai-to-anthropic.js";
import { translateAnthropicToOpenAI, translateOpenAIResponseToAnthropic } from "../translation/anthropic-to-openai.js";
import { StreamOpenAIToAnthropic } from "../translation/stream-openai-to-anthropic.js";
import { StreamAnthropicToOpenAI } from "../translation/stream-anthropic-to-openai.js";
import { MAX_FAILOVER_RETRIES } from "@one-proxy/shared";
import type { InboundProtocol } from "@one-proxy/shared";
import { logger } from "../logger.js";

function getUpstreamUrl(route: ResolvedRoute, targetProtocol: string): string {
  const base = (targetProtocol === "anthropic" && route.provider.anthropicBaseUrl
    ? route.provider.anthropicBaseUrl
    : route.provider.baseUrl
  ).replace(/\/$/, "");
  switch (targetProtocol) {
    case "anthropic": return `${base}/v1/messages`;
    case "openai":
    default: return `${base}/v1/chat/completions`;
  }
}

function getInboundProtocol(path: string): InboundProtocol {
  if (path.includes("/messages")) return "anthropic_messages";
  if (path.includes("/responses")) return "openai_responses";
  return "openai_chat";
}

export interface ForwardResult {
  response: Response;
  providerKeyLabel: string;
  routeMode: string;
  inboundProtocol: string;
}

export async function forwardRequest(
  body: any,
  path: string,
  route: ResolvedRoute,
  config: Config,
  isStreaming: boolean,
): Promise<ForwardResult> {
  const inboundProtocol = getInboundProtocol(path);
  const routeMode = route.isNative ? "native_passthrough" : "translated";

  let upstreamBody: any;
  let upstreamUrl: string;
  let upstreamHeaders: Record<string, string> = { "Content-Type": "application/json" };

  if (route.isNative) {
    upstreamBody = { ...body };
    if (route.targetProtocol === "anthropic") {
      upstreamUrl = getUpstreamUrl(route, "anthropic");
    } else {
      upstreamUrl = getUpstreamUrl(route, "openai");
    }
    upstreamBody.model = route.model.upstreamModelId;
  } else {
    if (inboundProtocol === "openai_chat" && route.targetProtocol === "anthropic") {
      upstreamBody = translateOpenAIToAnthropic(body, config.translationFallback);
      upstreamBody.model = route.model.upstreamModelId;
      upstreamUrl = getUpstreamUrl(route, "anthropic");
    } else if (inboundProtocol === "anthropic_messages" && route.targetProtocol === "openai") {
      upstreamBody = translateAnthropicToOpenAI(body, config.translationFallback);
      upstreamBody.model = route.model.upstreamModelId;
      upstreamUrl = getUpstreamUrl(route, "openai");
    } else {
      upstreamBody = { ...body };
      upstreamBody.model = route.model.upstreamModelId;
      upstreamUrl = getUpstreamUrl(route, route.targetProtocol);
    }
  }

  if (route.targetProtocol === "anthropic") {
    upstreamHeaders["anthropic-version"] = "2023-06-01";
  }

  let retries = 0;
  let selectedKey: SelectedKey | null = null;

  while (retries <= MAX_FAILOVER_RETRIES) {
    selectedKey = retries === 0
      ? selectKey(route.provider.id, route.provider.balancingStrategy, config.encryptionKey)
      : getNextFailoverKey(route.provider.id, selectedKey!.id, route.provider.balancingStrategy, config.encryptionKey);

    if (!selectedKey) {
      throw new Error("No active API keys available");
    }

    if (route.targetProtocol === "anthropic") {
      upstreamHeaders["x-api-key"] = selectedKey.secret;
    } else {
      upstreamHeaders["Authorization"] = `Bearer ${selectedKey.secret}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), route.provider.timeoutMs);

    try {
      const response = await fetch(upstreamUrl, {
        method: "POST",
        headers: upstreamHeaders,
        body: JSON.stringify(upstreamBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if ((response.status === 429 || response.status >= 500) && retries < MAX_FAILOVER_RETRIES) {
        markKeyDegraded(selectedKey.id);
        retries++;
        logger.warn({ key: selectedKey.label, status: response.status, retry: retries }, "Upstream error, retrying with next key");
        continue;
      }

      if (route.isNative) {
        return {
          response,
          providerKeyLabel: selectedKey.label,
          routeMode,
          inboundProtocol,
        };
      }

      if (isStreaming && response.ok) {
        const translatedStream = translateStream(response, route, inboundProtocol, config);
        return {
          response: new Response(translatedStream, {
            status: response.status,
            headers: getStreamHeaders(inboundProtocol),
          }),
          providerKeyLabel: selectedKey.label,
          routeMode,
          inboundProtocol,
        };
      }

      if (response.ok) {
        const responseBody = await response.json();
        const translated = translateResponse(responseBody, route, inboundProtocol);
        return {
          response: new Response(JSON.stringify(translated), {
            status: response.status,
            headers: { "Content-Type": "application/json" },
          }),
          providerKeyLabel: selectedKey.label,
          routeMode,
          inboundProtocol,
        };
      }

      return {
        response,
        providerKeyLabel: selectedKey.label,
        routeMode,
        inboundProtocol,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        markKeyDegraded(selectedKey.id);
        if (retries < MAX_FAILOVER_RETRIES) {
          retries++;
          continue;
        }
        throw new Error("Request timed out");
      }
      throw err;
    }
  }

  throw new Error("All retries exhausted");
}

function translateStream(response: Response, route: ResolvedRoute, inboundProtocol: InboundProtocol, config: Config): ReadableStream {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  if (inboundProtocol === "openai_chat" && route.targetProtocol === "anthropic") {
    const translator = new StreamOpenAIToAnthropic(route.model.publicSlug);
    return new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) { controller.close(); break; }
            const chunk = decoder.decode(value, { stream: true });
            for (const translated of translator.translate(chunk)) {
              controller.enqueue(new TextEncoder().encode(translated));
            }
          }
        } catch (e) {
          controller.error(e);
        }
      },
    });
  }

  if (inboundProtocol === "anthropic_messages" && route.targetProtocol === "openai") {
    const translator = new StreamAnthropicToOpenAI(route.model.publicSlug);
    return new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) { controller.close(); break; }
            const chunk = decoder.decode(value, { stream: true });
            for (const translated of translator.translate(chunk)) {
              controller.enqueue(new TextEncoder().encode(translated));
            }
          }
        } catch (e) {
          controller.error(e);
        }
      },
    });
  }

  return response.body!;
}

function translateResponse(body: any, route: ResolvedRoute, inboundProtocol: InboundProtocol): any {
  if (inboundProtocol === "openai_chat" && route.targetProtocol === "anthropic") {
    return translateAnthropicResponseToOpenAI(body);
  }
  if (inboundProtocol === "anthropic_messages" && route.targetProtocol === "openai") {
    return translateOpenAIResponseToAnthropic(body, route.model.publicSlug);
  }
  return body;
}

function getStreamHeaders(inboundProtocol: InboundProtocol): Record<string, string> {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  };
}
