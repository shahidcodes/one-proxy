import { db } from "../db.js";
import { usageCounters } from "@one-proxy/shared";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export function trackUsage(modelSlug: string, providerId: string, inputTokens: number, outputTokens: number) {
  try {
    const existing = db.select().from(usageCounters)
      .where(and(eq(usageCounters.modelSlug, modelSlug), eq(usageCounters.providerId, providerId)))
      .get();

    if (existing) {
      db.update(usageCounters)
        .set({
          totalInputTokens: existing.totalInputTokens + inputTokens,
          totalOutputTokens: existing.totalOutputTokens + outputTokens,
          totalRequests: existing.totalRequests + 1,
        })
        .where(eq(usageCounters.id, existing.id))
        .run();
    } else {
      db.insert(usageCounters).values({
        id: uuid(),
        modelSlug,
        providerId,
        totalInputTokens: inputTokens,
        totalOutputTokens: outputTokens,
        totalRequests: 1,
        resetAt: new Date().toISOString(),
      }).run();
    }
  } catch (err) {
    console.error("Failed to track usage:", err);
  }
}
