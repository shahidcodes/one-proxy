import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { db } from "../../db.js";
import { providers, models, proxyKeys, usageCounters } from "@one-proxy/shared";
import { eq } from "drizzle-orm";
import type { Config } from "../../config.js";

export function createAdminSettingsRoutes(config: Config, auth: MiddlewareHandler): Hono {
  const app = new Hono();
  app.use("*", auth);

  app.get("/api/admin/settings", (c) => {
    return c.json({
      proxyPublicUrl: config.proxyPublicUrl,
      translationFallback: config.translationFallback,
      debugLogBodies: config.debugLogBodies,
      encryptionKeySet: !!process.env.ENCRYPTION_KEY,
      version: config.version,
    });
  });

  app.post("/api/admin/settings/export", (c) => {
    const allProviders = db.select().from(providers).all().map(p => ({
      ...p,
      supportedProtocols: JSON.parse(p.supportedProtocols),
    }));
    const allModels = db.select().from(models).all();
    const allProxyKeys = db.select().from(proxyKeys).all();

    return c.json({
      providers: allProviders,
      models: allModels,
      proxyKeys: allProxyKeys,
    });
  });

  app.post("/api/admin/settings/import", async (c) => {
    const body = await c.req.json();
    return c.json({ success: true, message: "Import endpoint - implement with upsert logic" });
  });

  app.post("/api/admin/settings/reset-usage", (c) => {
    db.update(usageCounters).set({
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
      resetAt: new Date().toISOString(),
    }).run();
    return c.json({ success: true });
  });

  return app;
}
