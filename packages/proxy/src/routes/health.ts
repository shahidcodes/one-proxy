import { Hono } from "hono";
import type { Config } from "../config.js";

const startTime = Date.now();

export function createHealthRoute(config: Config): Hono {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      version: config.version,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    });
  });

  return app;
}
