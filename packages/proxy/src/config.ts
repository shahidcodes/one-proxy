import { generateEncryptionKey, generatePassword } from "@one-proxy/shared";
import fs from "fs";
import path from "path";

export interface Config {
  port: number;
  encryptionKey: string;
  adminPassword: string;
  proxyPublicUrl: string;
  translationFallback: "drop" | "error";
  debugLogBodies: boolean;
  dbPath: string;
  version: string;
}

export function loadConfig(): Config {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  let encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    encryptionKey = generateEncryptionKey();
    console.log(`[One Proxy] Generated ENCRYPTION_KEY: ${encryptionKey}`);
    console.log("[One Proxy] Save this to your .env file to persist across restarts.");
  }

  let adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    adminPassword = generatePassword();
    console.log(`[One Proxy] Generated ADMIN_PASSWORD: ${adminPassword}`);
    console.log("[One Proxy] Save this to your .env file to persist across restarts.");
  }

  let version = "0.1.0";
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    version = pkg.version || version;
  } catch {}

  return {
    port: parseInt(process.env.PORT || "15000", 10),
    encryptionKey,
    adminPassword,
    proxyPublicUrl: process.env.PROXY_PUBLIC_URL || "http://localhost:15000",
    translationFallback: (process.env.TRANSLATION_FALLBACK as "drop" | "error") || "drop",
    debugLogBodies: process.env.DEBUG_LOG_BODIES === "true",
    dbPath: path.join(dataDir, "one-proxy.db"),
    version,
  };
}
