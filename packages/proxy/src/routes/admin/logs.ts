import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { db } from "../../db.js";
import { requestLogs } from "@one-proxy/shared";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { LOG_PAGE_SIZE } from "@one-proxy/shared";

export function createAdminLogRoutes(auth: MiddlewareHandler): Hono {
  const app = new Hono();
  app.use("*", auth);

  app.get("/api/admin/logs", (c) => {
    const page = parseInt(c.req.query("page") || "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") || String(LOG_PAGE_SIZE), 10);
    const offset = (page - 1) * pageSize;

    const conditions = [];
    const modelSlug = c.req.query("modelSlug");
    const providerId = c.req.query("providerId");
    const statusCode = c.req.query("statusCode");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    if (modelSlug) conditions.push(eq(requestLogs.modelSlug, modelSlug));
    if (providerId) conditions.push(eq(requestLogs.providerId, providerId));
    if (statusCode) conditions.push(eq(requestLogs.statusCode, parseInt(statusCode, 10)));
    if (startDate) conditions.push(gte(requestLogs.timestamp, startDate));
    if (endDate) conditions.push(lte(requestLogs.timestamp, endDate));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = db.select().from(requestLogs)
      .where(where)
      .orderBy(desc(requestLogs.timestamp))
      .limit(pageSize)
      .offset(offset)
      .all();

    const totalResult = db.select({ count: sql<number>`count(*)` }).from(requestLogs).where(where).get();
    const total = totalResult?.count || 0;

    return c.json({ logs, total, page, pageSize });
  });

  app.delete("/api/admin/logs", (c) => {
    db.delete(requestLogs).run();
    return c.json({ success: true });
  });

  app.post("/api/admin/logs/prune", async (c) => {
    const body = await c.req.json();
    if (body.keepLast) {
      const cutoff = db.select({ timestamp: requestLogs.timestamp })
        .from(requestLogs)
        .orderBy(desc(requestLogs.timestamp))
        .limit(1)
        .offset(body.keepLast - 1)
        .get();

      if (cutoff) {
        db.delete(requestLogs).where(sql`${requestLogs.timestamp} < ${cutoff.timestamp}`).run();
      }
    }
    if (body.keepDays) {
      const cutoffDate = new Date(Date.now() - body.keepDays * 86400000).toISOString();
      db.delete(requestLogs).where(sql`${requestLogs.timestamp} < ${cutoffDate}`).run();
    }
    return c.json({ success: true });
  });

  return app;
}
