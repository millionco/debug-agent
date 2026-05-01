import { ESTIMATED_CHARS_PER_TOKEN, INTERACTIVE_ROLES } from "../constants";
import type { RefMap, SnapshotStats } from "../types";

export const computeSnapshotStats = (tree: string, refs: RefMap): SnapshotStats => {
  const entries = Object.values(refs);
  const lines = tree.split("\n").length;

  return {
    lines,
    characters: tree.length,
    estimatedTokens: Math.ceil(tree.length / ESTIMATED_CHARS_PER_TOKEN),
    totalRefs: entries.length,
    interactiveRefs: entries.filter((entry) => INTERACTIVE_ROLES.has(entry.role)).length,
  };
};
