import type { MiddlewareHandler } from "hono";
import { logger } from "../logger.js";

export const loggingMiddleware: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  const latency = Date.now() - start;
  logger.info({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    latency_ms: latency,
  }, "request");
};
