import { describe, expect, it } from "vite-plus/test";
import {
  normalizeChromiumExpiration,
  normalizeChromiumSameSite,
} from "../../src/cookies/utils/chromium-normalize";

describe("normalizeChromiumExpiration", () => {
  it("returns undefined for undefined input", () => {
    expect(normalizeChromiumExpiration(undefined)).toBeUndefined();
  });

  it("returns undefined for zero", () => {
    expect(normalizeChromiumExpiration(0)).toBeUndefined();
    expect(normalizeChromiumExpiration(0n)).toBeUndefined();
    expect(normalizeChromiumExpiration("0")).toBeUndefined();
  });

  it("returns undefined for negative numbers", () => {
    expect(normalizeChromiumExpiration(-1)).toBeUndefined();
    expect(normalizeChromiumExpiration(-1n)).toBeUndefined();
    expect(normalizeChromiumExpiration("-100")).toBeUndefined();
  });

  it("returns undefined for NaN-yielding strings", () => {
    expect(normalizeChromiumExpiration("not-a-number")).toBeUndefined();
  });

  it("clamps values above the max unix epoch (year 9999)", () => {
    expect(normalizeChromiumExpiration(999_999_999_999_999_999_999_999)).toBeUndefined();
  });

  it("returns seconds unchanged when input is already seconds-since-epoch", () => {
    expect(normalizeChromiumExpiration(1_700_000_000)).toBe(1_700_000_000);
  });

  it("converts millisecond inputs to seconds", () => {
    expect(normalizeChromiumExpiration(1_700_000_000_000)).toBe(1_700_000_000);
  });

  it("converts Chrome microsecond epoch (since 1601-01-01) to unix seconds", () => {
    const chromeMicroseconds = 13_350_000_000_000_000;
    const result = normalizeChromiumExpiration(chromeMicroseconds);
    const expected = Math.round(chromeMicroseconds / 1_000_000 - 11_644_473_600);
    expect(result).toBe(expected);
  });

  it("handles bigint input in seconds range", () => {
    expect(normalizeChromiumExpiration(BigInt(1_700_000_000))).toBe(1_700_000_000);
  });

  it("handles bigint input in millisecond range", () => {
    expect(normalizeChromiumExpiration(BigInt(1_700_000_000_000))).toBe(1_700_000_000);
  });

  it("handles bigint input in Chrome microsecond range", () => {
    const chromeMicroseconds = BigInt(13_350_000_000_000_000);
    const result = normalizeChromiumExpiration(chromeMicroseconds);
    expect(result).toBe(Number(chromeMicroseconds / BigInt(1_000_000)) - 11_644_473_600);
  });

  it("parses string inputs as numbers", () => {
    expect(normalizeChromiumExpiration("1700000000")).toBe(1_700_000_000);
    expect(normalizeChromiumExpiration("1700000000000")).toBe(1_700_000_000);
  });

  it("rounds fractional seconds", () => {
    expect(normalizeChromiumExpiration(1_700_000_000.7)).toBe(1_700_000_001);
  });
});

describe("normalizeChromiumSameSite", () => {
  it("maps 0 to 'None'", () => {
    expect(normalizeChromiumSameSite(0)).toBe("None");
  });

  it("maps 1 to 'Lax'", () => {
    expect(normalizeChromiumSameSite(1)).toBe("Lax");
  });

  it("maps 2 to 'Strict'", () => {
    expect(normalizeChromiumSameSite(2)).toBe("Strict");
  });

  it("maps bigint values", () => {
    expect(normalizeChromiumSameSite(0n)).toBe("None");
    expect(normalizeChromiumSameSite(1n)).toBe("Lax");
    expect(normalizeChromiumSameSite(2n)).toBe("Strict");
  });

  it("returns undefined for unknown numeric values", () => {
    expect(normalizeChromiumSameSite(-1)).toBeUndefined();
    expect(normalizeChromiumSameSite(3)).toBeUndefined();
    expect(normalizeChromiumSameSite(99)).toBeUndefined();
  });

  it("returns undefined for non-numeric inputs", () => {
    expect(normalizeChromiumSameSite("Strict")).toBeUndefined();
    expect(normalizeChromiumSameSite(null)).toBeUndefined();
    expect(normalizeChromiumSameSite(undefined)).toBeUndefined();
    expect(normalizeChromiumSameSite({})).toBeUndefined();
  });
});
