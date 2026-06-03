import type { MiddlewareHandler } from "hono";
import { db } from "../db.js";
import { proxyKeys } from "@one-proxy/shared";
import { hashKey } from "@one-proxy/shared";
import { eq } from "drizzle-orm";

export const proxyAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: { message: "Missing or invalid Authorization header", type: "invalid_request_error", code: "invalid_api_key" } }, 401);
  }

  const key = authHeader.slice(7);
  const keyHash = hashKey(key);

  const found = db.select().from(proxyKeys).where(eq(proxyKeys.keyHash, keyHash)).get();
  if (!found || !found.enabled) {
    return c.json({ error: { message: "Invalid API key", type: "invalid_request_error", code: "invalid_api_key" } }, 401);
  }

  c.set("proxyKeyLabel", found.label);
  c.set("proxyKeyId", found.id);
  await next();
};
