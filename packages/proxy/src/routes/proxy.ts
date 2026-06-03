import { Hono } from "hono";
import type { Config } from "../config.js";
import { proxyAuthMiddleware } from "../middleware/auth.js";
import { resolveModel } from "../services/model-resolver.js";
import { forwardRequest } from "../forwarding/forward.js";
import { logRequest } from "../services/request-logger.js";
import { trackUsage } from "../services/usage-tracker.js";
import { db } from "../db.js";
import { models } from "@one-proxy/shared";
import { eq } from "drizzle-orm";

export function createProxyRoutes(config: Config): Hono {
  const app = new Hono();

  app.use("/v1/*", proxyAuthMiddleware);

  app.get("/v1/models", (c) => {
    const allModels = db.select().from(models).where(eq(models.enabled, 1)).all();
    return c.json({
      object: "list",
      data: allModels.map(m => ({
        id: m.publicSlug,
        object: "model",
        created: Math.floor(new Date(m.createdAt).getTime() / 1000),
        owned_by: m.publicSlug.split("/")[0],
      })),
    });
  });

  const handleProxyRequest = async (c: any) => {
    const start = Date.now();
    const path = c.req.path;
    let body: any;

    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { message: "Invalid JSON body", type: "invalid_request_error", code: "invalid_request" } }, 400);
    }

    const modelSlug = body.model;
    if (!modelSlug) {
      return c.json({ error: { message: "Missing model field", type: "invalid_request_error", code: "invalid_request" } }, 400);
    }

    const route = resolveModel(modelSlug, path);
    if (!route) {
      const isAnthropic = path.includes("/messages");
      if (isAnthropic) {
        return c.json({ type: "error", error: { type: "not_found_error", message: `Model '${modelSlug}' not found or disabled` } }, 404);
      }
      return c.json({ error: { message: `Model '${modelSlug}' not found or disabled`, type: "invalid_request_error", code: "model_not_found" } }, 404);
    }

    const isStreaming = body.stream === true;

    try {
      const result = await forwardRequest(body, path, route, config, isStreaming);
      const latency = Date.now() - start;

      logRequest({
        modelSlug,
        providerId: route.provider.id,
        providerKeyLabel: result.providerKeyLabel,
        proxyKeyLabel: c.get("proxyKeyLabel"),
        inboundProtocol: result.inboundProtocol,
        routeMode: result.routeMode,
        latencyMs: latency,
        statusCode: result.response.status,
      });

      return result.response;
    } catch (err: any) {
      const latency = Date.now() - start;
      logRequest({
        modelSlug,
        proxyKeyLabel: c.get("proxyKeyLabel"),
        latencyMs: latency,
        statusCode: 502,
        errorSummary: err.message,
      });

      const isAnthropic = path.includes("/messages");
      if (isAnthropic) {
        return c.json({ type: "error", error: { type: "api_error", message: err.message } }, 502);
      }
      return c.json({ error: { message: err.message, type: "api_error", code: "upstream_error" } }, 502);
    }
  };

  app.post("/v1/chat/completions", handleProxyRequest);
  app.post("/v1/responses", handleProxyRequest);
  app.post("/v1/messages", handleProxyRequest);

  return app;
}
