import type { MiddlewareHandler } from "hono";
import { SignJWT, jwtVerify } from "jose";
import type { Config } from "../config.js";

const COOKIE_NAME = "one_proxy_session";

export function createAdminAuthMiddleware(config: Config): MiddlewareHandler {
  const secret = new TextEncoder().encode(config.encryptionKey);

  return async (c, next) => {
    if (c.req.path === "/api/admin/auth/login" && c.req.method === "POST") {
      await next();
      return;
    }

    const cookie = c.req.header("Cookie") || "";
    const token = cookie.split(";").map(s => s.trim()).find(s => s.startsWith(`${COOKIE_NAME}=`))?.split("=")[1];

    if (!token) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      await jwtVerify(token, secret);
      await next();
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }
  };
}

export async function createAdminToken(config: Config): Promise<string> {
  const secret = new TextEncoder().encode(config.encryptionKey);
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .setIssuedAt()
    .sign(secret);
}

export { COOKIE_NAME };
