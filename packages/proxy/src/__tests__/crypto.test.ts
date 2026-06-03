import { describe, it, expect } from "vitest";
import { encrypt, decrypt, hashKey, generateApiKey, generateEncryptionKey } from "@one-proxy/shared";

describe("Crypto utilities", () => {
  const testKey = generateEncryptionKey();

  it("should encrypt and decrypt correctly", () => {
    const plaintext = "sk-ant-api03-test-key-12345";
    const encrypted = encrypt(plaintext, testKey);
    const decrypted = decrypt(encrypted, testKey);
    expect(decrypted).toBe(plaintext);
  });

  it("should produce different ciphertexts for same plaintext", () => {
    const plaintext = "same-key";
    const enc1 = encrypt(plaintext, testKey);
    const enc2 = encrypt(plaintext, testKey);
    expect(enc1).not.toBe(enc2);
  });

  it("should hash keys consistently", () => {
    const key = "test-key-value";
    const hash1 = hashKey(key);
    const hash2 = hashKey(key);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("should generate API keys with correct prefix", () => {
    const key = generateApiKey();
    expect(key.startsWith("op-")).toBe(true);
    expect(key.length).toBeGreaterThan(10);
  });

  it("should generate encryption keys of correct length", () => {
    const key = generateEncryptionKey();
    expect(key).toHaveLength(64);
  });
});
