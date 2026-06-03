import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { loadConfig } from "./config.js";
import { initDatabase } from "./db.js";
import { logger } from "./logger.js";
import { corsMiddleware } from "./middleware/cors.js";
import { loggingMiddleware } from "./middleware/logging.js";
import { createAdminAuthMiddleware } from "./middleware/admin-auth.js";
import { createHealthRoute } from "./routes/health.js";
import { createProxyRoutes } from "./routes/proxy.js";
import { createAdminAuthRoute } from "./routes/admin/auth.js";
import { createAdminProviderRoutes } from "./routes/admin/providers.js";
import { createAdminModelRoutes } from "./routes/admin/models.js";
import { createAdminKeyRoutes } from "./routes/admin/keys.js";
import { createAdminLogRoutes } from "./routes/admin/logs.js";
import { createAdminDashboardRoutes } from "./routes/admin/dashboard.js";
import { createAdminSettingsRoutes } from "./routes/admin/settings.js";
import path from "path";
import fs from "fs";

const config = loadConfig();
initDatabase(config);

const app = new Hono();

app.use("*", corsMiddleware);
app.use("*", loggingMiddleware);

app.route("/", createHealthRoute(config));
app.route("/", createProxyRoutes(config));

const adminAuth = createAdminAuthMiddleware(config);

app.route("/", createAdminAuthRoute(config));
app.route("/", createAdminProviderRoutes(config, adminAuth));
app.route("/", createAdminModelRoutes(adminAuth));
app.route("/", createAdminKeyRoutes(config, adminAuth));
app.route("/", createAdminLogRoutes(adminAuth));
app.route("/", createAdminDashboardRoutes(adminAuth));
app.route("/", createAdminSettingsRoutes(config, adminAuth));

const uiDistPath = path.join(process.cwd(), "..", "ui", "dist");
if (fs.existsSync(uiDistPath)) {
  app.get("*", async (c) => {
    const filePath = path.join(uiDistPath, c.req.path === "/" ? "index.html" : c.req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const content = fs.readFileSync(filePath);
      const ext = path.extname(filePath);
      const mimeTypes: Record<string, string> = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".ico": "image/x-icon",
      };
      return c.body(content, 200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    }
    const indexPath = path.join(uiDistPath, "index.html");
    if (fs.existsSync(indexPath)) {
      return c.html(fs.readFileSync(indexPath, "utf8"));
    }
    return c.text("UI not built yet. Run 'pnpm --filter @one-proxy/ui build' first.", 404);
  });
}

const server = serve({
  fetch: app.fetch,
  port: config.port,
});

logger.info({ port: config.port, version: config.version }, "One Proxy started");

let shuttingDown = false;
function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down gracefully...");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
