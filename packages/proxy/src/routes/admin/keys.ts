import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { db } from "../../db.js";
import { providerKeys, providers, proxyKeys } from "@one-proxy/shared";
import { encrypt, decrypt, hashKey, generateApiKey } from "@one-proxy/shared";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Config } from "../../config.js";

export function createAdminKeyRoutes(config: Config, auth: MiddlewareHandler): Hono {
  const app = new Hono();
  app.use("*", auth);

  app.get("/api/admin/provider-keys", (c) => {
    const providerId = c.req.query("providerId");
    const query = providerId
      ? db.select().from(providerKeys).where(eq(providerKeys.providerId, providerId))
      : db.select().from(providerKeys);
    const all = query.all();
    return c.json(all.map(k => ({
      ...k,
      enabled: k.enabled === 1,
    })));
  });

  app.post("/api/admin/provider-keys", async (c) => {
    const body = await c.req.json();
    const now = new Date().toISOString();
    const id = uuid();
    const encrypted = encrypt(body.secret, config.encryptionKey);
    const last4 = body.secret.slice(-4);

    db.insert(providerKeys).values({
      id,
      providerId: body.providerId,
      label: body.label,
      encryptedSecret: encrypted,
      keyLast4: last4,
      enabled: body.enabled !== false ? 1 : 0,
      priority: body.priority || 0,
      createdAt: now,
    }).run();

    const created = db.select().from(providerKeys).where(eq(providerKeys.id, id)).get();
    return c.json({ ...created!, enabled: created!.enabled === 1 }, 201);
  });

  app.put("/api/admin/provider-keys/:id", async (c) => {
    const body = await c.req.json();
    const updates: any = {};
    if (body.label !== undefined) updates.label = body.label;
    if (body.enabled !== undefined) updates.enabled = body.enabled ? 1 : 0;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.secret) {
      updates.encryptedSecret = encrypt(body.secret, config.encryptionKey);
      updates.keyLast4 = body.secret.slice(-4);
    }

    db.update(providerKeys).set(updates).where(eq(providerKeys.id, c.req.param("id"))).run();
    const updated = db.select().from(providerKeys).where(eq(providerKeys.id, c.req.param("id"))).get();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json({ ...updated, enabled: updated.enabled === 1 });
  });

  app.delete("/api/admin/provider-keys/:id", (c) => {
    db.delete(providerKeys).where(eq(providerKeys.id, c.req.param("id"))).run();
    return c.json({ success: true });
  });

  app.post("/api/admin/provider-keys/:id/test", async (c) => {
    const key = db.select().from(providerKeys).where(eq(providerKeys.id, c.req.param("id"))).get();
    if (!key) return c.json({ error: "Not found" }, 404);

    const provider = db.select().from(providers).where(eq(providers.id, key.providerId)).get();
    if (!provider) return c.json({ error: "Provider not found" }, 404);

    const secret = decrypt(key.encryptedSecret, config.encryptionKey);
    const protocols: string[] = JSON.parse(provider.supportedProtocols);

    try {
      let testResult: Response;
      if (protocols.includes("openai")) {
        testResult = await fetch(`${provider.baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
          body: JSON.stringify({ model: "gpt-3.5-turbo", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
          signal: AbortSignal.timeout(10000),
        });
      } else {
        const anthropicBase = provider.anthropicBaseUrl || provider.baseUrl;
        testResult = await fetch(`${anthropicBase}/v1/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": secret, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-3-haiku-20240307", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
          signal: AbortSignal.timeout(10000),
        });
      }
      return c.json({ success: testResult.ok, status: testResult.status });
    } catch (err: any) {
      return c.json({ success: false, error: err.message });
    }
  });

  app.get("/api/admin/proxy-keys", (c) => {
    const all = db.select().from(proxyKeys).all();
    return c.json(all.map(k => ({ ...k, enabled: k.enabled === 1 })));
  });

  app.post("/api/admin/proxy-keys", async (c) => {
    const body = await c.req.json();
    const key = generateApiKey();
    const keyHash = hashKey(key);
    const keyPrefix = key.slice(0, 8);
    const id = uuid();
    const now = new Date().toISOString();

    db.insert(proxyKeys).values({
      id,
      label: body.label,
      keyHash,
      keyPrefix,
      enabled: 1,
      createdAt: now,
    }).run();

    return c.json({ id, label: body.label, key, keyPrefix, createdAt: now }, 201);
  });

  app.put("/api/admin/proxy-keys/:id", async (c) => {
    const body = await c.req.json();
    const updates: any = {};
    if (body.label !== undefined) updates.label = body.label;
    if (body.enabled !== undefined) updates.enabled = body.enabled ? 1 : 0;

    db.update(proxyKeys).set(updates).where(eq(proxyKeys.id, c.req.param("id"))).run();
    const updated = db.select().from(proxyKeys).where(eq(proxyKeys.id, c.req.param("id"))).get();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json({ ...updated, enabled: updated.enabled === 1 });
  });

  app.delete("/api/admin/proxy-keys/:id", (c) => {
    db.delete(proxyKeys).where(eq(proxyKeys.id, c.req.param("id"))).run();
    return c.json({ success: true });
  });

  return app;
}
