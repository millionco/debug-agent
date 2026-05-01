import type { Locator, Page } from "playwright";
import type { Cookie } from "./cookies/types";

export type AriaRole = Parameters<Page["getByRole"]>[0];

export interface SnapshotOptions {
  timeout?: number;
  interactive?: boolean;
  compact?: boolean;
  maxDepth?: number;
  selector?: string;
}

export interface RefEntry {
  role: string;
  name: string;
  nth?: number;
  selector?: string;
}

export interface RefMap {
  [ref: string]: RefEntry;
}

export interface SnapshotStats {
  lines: number;
  characters: number;
  estimatedTokens: number;
  totalRefs: number;
  interactiveRefs: number;
}

export interface SnapshotResult {
  tree: string;
  refs: RefMap;
  stats: SnapshotStats;
  /** Resolves a ref to a Playwright Locator. Throws RefNotFoundError if missing. */
  locator: (ref: string) => Locator;
}

export type BrowserEngine = "chromium" | "webkit" | "firefox";

export interface CreatePageOptions {
  headed?: boolean;
  executablePath?: string;
  cookies?: boolean | Cookie[];
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  videoOutputDir?: string;
  cdpUrl?: string;
  browserType?: BrowserEngine;
}

export interface SnapshotDiff {
  diff: string;
  additions: number;
  removals: number;
  unchanged: number;
  changed: boolean;
}
