import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { db } from "../../db.js";
import { providers, models, requestLogs, usageCounters } from "@one-proxy/shared";
import { eq, and, desc, sql } from "drizzle-orm";

export function createAdminDashboardRoutes(auth: MiddlewareHandler): Hono {
  const app = new Hono();
  app.use("*", auth);

  app.get("/api/admin/dashboard", (c) => {
    const totalRequestsResult = db.select({ count: sql<number>`count(*)` }).from(requestLogs).get();
    const totalRequests = totalRequestsResult?.count || 0;

    const activeProviders = db.select().from(providers).where(eq(providers.enabled, 1)).all().length;
    const activeModels = db.select().from(models).where(eq(models.enabled, 1)).all().length;

    const recentErrors = db.select().from(requestLogs)
      .where(sql`${requestLogs.statusCode} >= 400`)
      .orderBy(desc(requestLogs.timestamp))
      .limit(10)
      .all();

    const counters = db.select().from(usageCounters).all();

    return c.json({
      totalRequests,
      activeProviders,
      activeModels,
      recentErrors,
      usageCounters: counters,
    });
  });

  return app;
}
