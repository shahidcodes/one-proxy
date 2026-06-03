import { Hono } from "hono";
import type { Config } from "../../config.js";
import { createAdminToken, COOKIE_NAME } from "../../middleware/admin-auth.js";

export function createAdminAuthRoute(config: Config): Hono {
  const app = new Hono();

  app.post("/api/admin/auth/login", async (c) => {
    const body = await c.req.json();
    if (body.password !== config.adminPassword) {
      return c.json({ error: "Invalid password" }, 401);
    }

    const token = await createAdminToken(config);
    c.header("Set-Cookie", `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`);
    return c.json({ success: true });
  });

  app.post("/api/admin/auth/logout", (c) => {
    c.header("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`);
    return c.json({ success: true });
  });

  return app;
}
