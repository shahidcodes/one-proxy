import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { db } from "../../db.js";
import { models } from "@one-proxy/shared";
import { eq, like } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export function createAdminModelRoutes(auth: MiddlewareHandler): Hono {
  const app = new Hono();
  app.use("*", auth);

  app.get("/api/admin/models", (c) => {
    const search = c.req.query("search");
    let query = db.select().from(models);

    const all = search
      ? db.select().from(models).where(like(models.publicSlug, `%${search}%`)).all()
      : db.select().from(models).all();

    return c.json(all.map(m => ({
      ...m,
      enabled: m.enabled === 1,
      capStreaming: m.capStreaming === 1,
      capTools: m.capTools === 1,
      capVision: m.capVision === 1,
      capJsonMode: m.capJsonMode === 1,
      capCaching: m.capCaching === 1,
      capThinking: m.capThinking === 1,
    })));
  });

  app.get("/api/admin/models/:id", (c) => {
    const m = db.select().from(models).where(eq(models.id, c.req.param("id"))).get();
    if (!m) return c.json({ error: "Not found" }, 404);
    return c.json({
      ...m,
      enabled: m.enabled === 1,
      capStreaming: m.capStreaming === 1,
      capTools: m.capTools === 1,
      capVision: m.capVision === 1,
      capJsonMode: m.capJsonMode === 1,
      capCaching: m.capCaching === 1,
      capThinking: m.capThinking === 1,
    });
  });

  app.post("/api/admin/models", async (c) => {
    const body = await c.req.json();
    const now = new Date().toISOString();
    const id = uuid();

    db.insert(models).values({
      id,
      publicSlug: body.publicSlug,
      providerId: body.providerId,
      upstreamModelId: body.upstreamModelId,
      inputPrice: body.inputPrice || 0,
      outputPrice: body.outputPrice || 0,
      contextWindow: body.contextWindow || 128000,
      maxOutputTokens: body.maxOutputTokens || 8192,
      capStreaming: body.capStreaming !== false ? 1 : 0,
      capTools: body.capTools ? 1 : 0,
      capVision: body.capVision ? 1 : 0,
      capJsonMode: body.capJsonMode ? 1 : 0,
      capCaching: body.capCaching ? 1 : 0,
      capThinking: body.capThinking ? 1 : 0,
      enabled: body.enabled !== false ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    }).run();

    const created = db.select().from(models).where(eq(models.id, id)).get();
    return c.json(created, 201);
  });

  app.put("/api/admin/models/:id", async (c) => {
    const body = await c.req.json();
    const now = new Date().toISOString();
    const updates: any = { updatedAt: now };

    const boolFields = ["capStreaming", "capTools", "capVision", "capJsonMode", "capCaching", "capThinking", "enabled"];
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        if (boolFields.includes(key)) {
          updates[key] = value ? 1 : 0;
        } else {
          updates[key] = value;
        }
      }
    }

    db.update(models).set(updates).where(eq(models.id, c.req.param("id"))).run();
    const updated = db.select().from(models).where(eq(models.id, c.req.param("id"))).get();
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  });

  app.delete("/api/admin/models/:id", (c) => {
    db.delete(models).where(eq(models.id, c.req.param("id"))).run();
    return c.json({ success: true });
  });

  app.post("/api/admin/models/bulk-pricing", async (c) => {
    const body = await c.req.json();
    const items: Array<{ slug: string; inputPrice: number; outputPrice: number }> = body.items || body;

    for (const item of items) {
      db.update(models)
        .set({ inputPrice: item.inputPrice, outputPrice: item.outputPrice, updatedAt: new Date().toISOString() })
        .where(eq(models.publicSlug, item.slug))
        .run();
    }

    return c.json({ updated: items.length });
  });

  return app;
}
