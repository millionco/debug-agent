import {
  MS_PER_SECOND,
  SAME_SITE_LAX,
  SAME_SITE_NONE,
  SAME_SITE_STRICT,
} from "../constants";

const MAX_UNIX_EPOCH_SECONDS = 253_402_300_799;
const CHROME_EPOCH_THRESHOLD = 10_000_000_000_000;
const CHROME_EPOCH_MICROSECONDS = 1_000_000;
const CHROME_EPOCH_OFFSET_SECONDS = 11_644_473_600;
const MILLISECOND_THRESHOLD = 10_000_000_000;

const clampExpiration = (value: number): number | undefined =>
  value > 0 && value <= MAX_UNIX_EPOCH_SECONDS ? Math.round(value) : undefined;

export const normalizeChromiumExpiration = (
  expires?: number | bigint | string,
): number | undefined => {
  if (expires === undefined) return undefined;

  if (typeof expires === "string") {
    const parsed = Number(expires);
    if (!Number.isFinite(parsed)) return undefined;
    return normalizeChromiumExpiration(parsed);
  }

  if (typeof expires === "bigint") {
    if (expires <= 0n) return undefined;
    if (expires > BigInt(CHROME_EPOCH_THRESHOLD)) {
      return clampExpiration(
        Number(expires / BigInt(CHROME_EPOCH_MICROSECONDS) - BigInt(CHROME_EPOCH_OFFSET_SECONDS)),
      );
    }
    if (expires > BigInt(MILLISECOND_THRESHOLD))
      return clampExpiration(Number(expires / BigInt(MS_PER_SECOND)));
    return clampExpiration(Number(expires));
  }

  if (!expires || Number.isNaN(expires)) return undefined;
  if (expires <= 0) return undefined;

  if (expires > CHROME_EPOCH_THRESHOLD) {
    return clampExpiration(expires / CHROME_EPOCH_MICROSECONDS - CHROME_EPOCH_OFFSET_SECONDS);
  }
  if (expires > MILLISECOND_THRESHOLD) return clampExpiration(expires / MS_PER_SECOND);
  return clampExpiration(expires);
};

export const normalizeChromiumSameSite = (
  value: unknown,
): "Strict" | "Lax" | "None" | undefined => {
  const numeric =
    typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : undefined;
  if (numeric === undefined) return undefined;
  if (numeric === SAME_SITE_STRICT) return "Strict";
  if (numeric === SAME_SITE_LAX) return "Lax";
  if (numeric === SAME_SITE_NONE) return "None";
  return undefined;
};
