import * as crypto from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { decryptAes128Cbc, decryptAes256Gcm, deriveKey } from "../../src/cookies/utils/crypto";

const PBKDF2_SALT = "saltysalt";
const PBKDF2_KEY_LENGTH_BYTES = 16;
const PBKDF2_IV_FILL = 0x20;
const COOKIE_PREFIX_V10 = "v10";
const COOKIE_PREFIX_V11 = "v11";

const encryptAes128Cbc = (plaintext: Buffer, key: Buffer): Buffer => {
  const iv = Buffer.alloc(PBKDF2_KEY_LENGTH_BYTES, PBKDF2_IV_FILL);
  const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
};

const encryptAes256Gcm = (plaintext: Buffer, masterKey: Buffer): Buffer => {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, ciphertext, tag]);
};

describe("deriveKey", () => {
  it("derives a 16-byte key matching PBKDF2-SHA1 with 'saltysalt'", () => {
    const key = deriveKey("peanuts", 1);
    expect(key.length).toBe(PBKDF2_KEY_LENGTH_BYTES);

    const expected = crypto.pbkdf2Sync("peanuts", PBKDF2_SALT, 1, PBKDF2_KEY_LENGTH_BYTES, "sha1");
    expect(key.equals(expected)).toBe(true);
  });

  it("uses iteration count (darwin uses 1003)", () => {
    const fast = deriveKey("password", 1);
    const slow = deriveKey("password", 1003);
    expect(fast.equals(slow)).toBe(false);
  });

  it("produces different keys for different passwords", () => {
    const a = deriveKey("alpha", 1);
    const b = deriveKey("bravo", 1);
    expect(a.equals(b)).toBe(false);
  });
});

describe("decryptAes128Cbc", () => {
  it("returns undefined for buffers smaller than the prefix length", () => {
    expect(decryptAes128Cbc(new Uint8Array([0x01, 0x02]), [], false)).toBeUndefined();
  });

  it("decodes plain (unprefixed) cookies as UTF-8 directly", () => {
    const result = decryptAes128Cbc(Buffer.from("plaintext value"), [], false);
    expect(result).toBe("plaintext value");
  });

  it("strips low control bytes from leading edge of plain cookies", () => {
    const buffer = Buffer.concat([Buffer.from([0x00, 0x01, 0x02, 0x10]), Buffer.from("hello")]);
    const result = decryptAes128Cbc(buffer, [], false);
    expect(result).toBe("hello");
  });

  it("returns empty string for v10/v11 prefix with no ciphertext", () => {
    expect(decryptAes128Cbc(Buffer.from(COOKIE_PREFIX_V10), [], false)).toBe("");
    expect(decryptAes128Cbc(Buffer.from(COOKIE_PREFIX_V11), [], false)).toBe("");
  });

  it("decrypts a v10-prefixed PKCS7-padded ciphertext using the matching key", () => {
    const plaintext = Buffer.from("super-secret-cookie-value");
    const padBytes = 16 - (plaintext.length % 16);
    const padded = Buffer.concat([plaintext, Buffer.alloc(padBytes, padBytes)]);

    const key = deriveKey("peanuts", 1);
    const ciphertext = encryptAes128Cbc(padded, key);
    const encrypted = Buffer.concat([Buffer.from(COOKIE_PREFIX_V10), ciphertext]);

    expect(decryptAes128Cbc(encrypted, [key], false)).toBe(plaintext.toString("utf8"));
  });

  it("tries multiple key candidates and returns first successful decode", () => {
    const plaintext = Buffer.from("hello world");
    const padBytes = 16 - (plaintext.length % 16);
    const padded = Buffer.concat([plaintext, Buffer.alloc(padBytes, padBytes)]);

    const correctKey = deriveKey("peanuts", 1);
    const wrongKey = deriveKey("nope", 1);
    const ciphertext = encryptAes128Cbc(padded, correctKey);
    const encrypted = Buffer.concat([Buffer.from(COOKIE_PREFIX_V10), ciphertext]);

    expect(decryptAes128Cbc(encrypted, [wrongKey, correctKey], false)).toBe("hello world");
  });

  it("strips 32-byte hash prefix when stripHashPrefix is true", () => {
    const hashPrefix = crypto.randomBytes(32);
    const realValue = Buffer.from("actual-cookie");
    const plaintext = Buffer.concat([hashPrefix, realValue]);
    const padBytes = 16 - (plaintext.length % 16);
    const padded = Buffer.concat([plaintext, Buffer.alloc(padBytes, padBytes)]);

    const key = deriveKey("peanuts", 1);
    const ciphertext = encryptAes128Cbc(padded, key);
    const encrypted = Buffer.concat([Buffer.from(COOKIE_PREFIX_V10), ciphertext]);

    expect(decryptAes128Cbc(encrypted, [key], true)).toBe("actual-cookie");
  });

  it("returns undefined when no key candidate works", () => {
    const padded = Buffer.alloc(16, 0x10);
    const wrongKey = deriveKey("wrong", 1);
    const realKey = deriveKey("real", 1);
    const ciphertext = encryptAes128Cbc(padded, realKey);
    const encrypted = Buffer.concat([Buffer.from(COOKIE_PREFIX_V10), ciphertext]);

    expect(decryptAes128Cbc(encrypted, [wrongKey], false)).toBeUndefined();
  });
});

describe("decryptAes256Gcm", () => {
  it("returns undefined for buffers smaller than the prefix length", () => {
    expect(decryptAes256Gcm(new Uint8Array([0x01]), Buffer.alloc(32), false)).toBeUndefined();
  });

  it("returns undefined when the prefix is not v10/v11", () => {
    const buffer = Buffer.concat([Buffer.from("xyz"), Buffer.alloc(28)]);
    expect(decryptAes256Gcm(buffer, Buffer.alloc(32), false)).toBeUndefined();
  });

  it("returns undefined when the payload is shorter than nonce+tag minimum", () => {
    const buffer = Buffer.concat([Buffer.from(COOKIE_PREFIX_V10), Buffer.alloc(20)]);
    expect(decryptAes256Gcm(buffer, Buffer.alloc(32), false)).toBeUndefined();
  });

  it("decrypts a valid v10-prefixed AES-256-GCM payload", () => {
    const masterKey = crypto.randomBytes(32);
    const plaintext = Buffer.from("gcm-cookie-value");
    const payload = encryptAes256Gcm(plaintext, masterKey);
    const encrypted = Buffer.concat([Buffer.from(COOKIE_PREFIX_V10), payload]);

    expect(decryptAes256Gcm(encrypted, masterKey, false)).toBe("gcm-cookie-value");
  });

  it("strips 32-byte hash prefix when stripHashPrefix is true", () => {
    const masterKey = crypto.randomBytes(32);
    const hashPrefix = crypto.randomBytes(32);
    const realValue = Buffer.from("real-value");
    const plaintext = Buffer.concat([hashPrefix, realValue]);
    const payload = encryptAes256Gcm(plaintext, masterKey);
    const encrypted = Buffer.concat([Buffer.from(COOKIE_PREFIX_V10), payload]);

    expect(decryptAes256Gcm(encrypted, masterKey, true)).toBe("real-value");
  });

  it("returns undefined when the auth tag verification fails (wrong key)", () => {
    const realKey = crypto.randomBytes(32);
    const wrongKey = crypto.randomBytes(32);
    const payload = encryptAes256Gcm(Buffer.from("secret"), realKey);
    const encrypted = Buffer.concat([Buffer.from(COOKIE_PREFIX_V10), payload]);

    expect(decryptAes256Gcm(encrypted, wrongKey, false)).toBeUndefined();
  });
});
