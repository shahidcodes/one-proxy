import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { db } from "../../db.js";
import { providers, providerKeys } from "@one-proxy/shared";
import { encrypt, decrypt } from "@one-proxy/shared";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Config } from "../../config.js";

export function createAdminProviderRoutes(config: Config, auth: MiddlewareHandler): Hono {
  const app = new Hono();
  app.use("*", auth);

  app.get("/api/admin/providers", (c) => {
    const all = db.select().from(providers).all();
    return c.json(all.map(p => ({
      ...p,
      supportedProtocols: JSON.parse(p.supportedProtocols),
      enabled: p.enabled === 1,
    })));
  });

  app.get("/api/admin/providers/:id", (c) => {
    const p = db.select().from(providers).where(eq(providers.id, c.req.param("id"))).get();
    if (!p) return c.json({ error: "Not found" }, 404);
    return c.json({
      ...p,
      supportedProtocols: JSON.parse(p.supportedProtocols),
      enabled: p.enabled === 1,
    });
  });

  app.post("/api/admin/providers", async (c) => {
    const body = await c.req.json();
    const now = new Date().toISOString();
    const id = uuid();

    db.insert(providers).values({
      id,
      name: body.name,
      baseUrl: body.baseUrl,
      anthropicBaseUrl: body.anthropicBaseUrl || null,
      authType: body.authType || "bearer",
      supportedProtocols: JSON.stringify(body.supportedProtocols || ["openai"]),
      timeoutMs: body.timeoutMs || 120000,
      enabled: body.enabled !== false ? 1 : 0,
      balancingStrategy: body.balancingStrategy || "round_robin",
      createdAt: now,
      updatedAt: now,
    }).run();

    const created = db.select().from(providers).where(eq(providers.id, id)).get();
    return c.json({
      ...created!,
      supportedProtocols: JSON.parse(created!.supportedProtocols),
      enabled: created!.enabled === 1,
    }, 201);
  });

  app.put("/api/admin/providers/:id", async (c) => {
    const body = await c.req.json();
    const now = new Date().toISOString();
    const updates: any = { updatedAt: now };

    if (body.name !== undefined) updates.name = body.name;
    if (body.baseUrl !== undefined) updates.baseUrl = body.baseUrl;
    if (body.anthropicBaseUrl !== undefined) updates.anthropicBaseUrl = body.anthropicBaseUrl || null;
    if (body.authType !== undefined) updates.authType = body.authType;
    if (body.supportedProtocols !== undefined) updates.supportedProtocols = JSON.stringify(body.supportedProtocols);
    if (body.timeoutMs !== undefined) updates.timeoutMs = body.timeoutMs;
    if (body.enabled !== undefined) updates.enabled = body.enabled ? 1 : 0;
    if (body.balancingStrategy !== undefined) updates.balancingStrategy = body.balancingStrategy;

    db.update(providers).set(updates).where(eq(providers.id, c.req.param("id"))).run();

    const updated = db.select().from(providers).where(eq(providers.id, c.req.param("id"))).get();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json({
      ...updated,
      supportedProtocols: JSON.parse(updated.supportedProtocols),
      enabled: updated.enabled === 1,
    });
  });

  app.delete("/api/admin/providers/:id", (c) => {
    db.delete(providers).where(eq(providers.id, c.req.param("id"))).run();
    return c.json({ success: true });
  });

  app.post("/api/admin/providers/:id/test-url", async (c) => {
    const p = db.select().from(providers).where(eq(providers.id, c.req.param("id"))).get();
    if (!p) return c.json({ error: "Not found" }, 404);

    try {
      const res = await fetch(p.baseUrl, { method: "GET", signal: AbortSignal.timeout(5000) });
      return c.json({ reachable: true, status: res.status });
    } catch {
      return c.json({ reachable: false });
    }
  });

  return app;
}
