import { db } from "../db.js";
import { proxyKeys, generateApiKey, hashKey } from "@one-proxy/shared";
import { v4 as uuid } from "uuid";
import type { ProxyKeyCreated } from "@one-proxy/shared";

export function createProxyKey(label: string): ProxyKeyCreated {
  const key = generateApiKey();
  const keyHash = hashKey(key);
  const keyPrefix = key.slice(0, 8);
  const id = uuid();
  const now = new Date().toISOString();

  db.insert(proxyKeys).values({
    id,
    label,
    keyHash,
    keyPrefix,
    enabled: 1,
    createdAt: now,
  }).run();

  return { id, label, key, keyPrefix, createdAt: now };
}
