import type { Locator, Page } from "playwright";
import { RefNotFoundError } from "../errors";
import type { RefMap } from "../types";
import { resolveLocator } from "./resolve-locator";

export const createLocator =
  (page: Page, refs: RefMap) =>
  (ref: string): Locator => {
    const entry = refs[ref];
    if (!entry) throw new RefNotFoundError(ref, Object.keys(refs));
    return resolveLocator(page, entry);
  };
