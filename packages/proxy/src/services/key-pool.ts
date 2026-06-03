import { db } from "../db.js";
import { providerKeys, providers } from "@one-proxy/shared";
import { decrypt } from "@one-proxy/shared";
import { eq, and } from "drizzle-orm";
import { KEY_DEGRADATION_COOLDOWN_MS, MAX_FAILOVER_RETRIES } from "@one-proxy/shared";
import type { BalancingStrategy } from "@one-proxy/shared";

interface KeyState {
  degradedUntil: number;
}

const keyStates = new Map<string, KeyState>();
const roundRobinCounters = new Map<string, number>();

export function resetKeyPoolState() {
  keyStates.clear();
  roundRobinCounters.clear();
}

export function markKeyDegraded(keyId: string) {
  keyStates.set(keyId, { degradedUntil: Date.now() + KEY_DEGRADATION_COOLDOWN_MS });
}

function isKeyDegraded(keyId: string): boolean {
  const state = keyStates.get(keyId);
  if (!state) return false;
  if (Date.now() > state.degradedUntil) {
    keyStates.delete(keyId);
    return false;
  }
  return true;
}

export interface SelectedKey {
  id: string;
  label: string;
  secret: string;
}

export function selectKey(providerId: string, strategy: BalancingStrategy, encryptionKey: string): SelectedKey | null {
  const keys = db.select().from(providerKeys)
    .where(and(eq(providerKeys.providerId, providerId), eq(providerKeys.enabled, 1)))
    .all();

  if (keys.length === 0) return null;

  const activeKeys = keys.filter(k => !isKeyDegraded(k.id));
  const pool = activeKeys.length > 0 ? activeKeys : keys;

  let selected: typeof pool[0];

  switch (strategy) {
    case "round_robin": {
      const counter = roundRobinCounters.get(providerId) || 0;
      selected = pool[counter % pool.length];
      roundRobinCounters.set(providerId, counter + 1);
      break;
    }
    case "random": {
      selected = pool[Math.floor(Math.random() * pool.length)];
      break;
    }
    case "ordered_failover": {
      const sorted = [...pool].sort((a, b) => a.priority - b.priority);
      selected = sorted[0];
      break;
    }
    default:
      selected = pool[0];
  }

  return {
    id: selected.id,
    label: selected.label,
    secret: decrypt(selected.encryptedSecret, encryptionKey),
  };
}

export function getNextFailoverKey(providerId: string, currentKeyId: string, strategy: BalancingStrategy, encryptionKey: string): SelectedKey | null {
  markKeyDegraded(currentKeyId);

  const keys = db.select().from(providerKeys)
    .where(and(eq(providerKeys.providerId, providerId), eq(providerKeys.enabled, 1)))
    .all();

  const activeKeys = keys.filter(k => !isKeyDegraded(k.id) && k.id !== currentKeyId);
  if (activeKeys.length === 0) return null;

  const selected = activeKeys[0];
  return {
    id: selected.id,
    label: selected.label,
    secret: decrypt(selected.encryptedSecret, encryptionKey),
  };
}
