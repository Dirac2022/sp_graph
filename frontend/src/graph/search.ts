/**
 * Pure, case-insensitive ranked search across SP names.
 *
 * Scoring (lower is better):
 * - Exact match: 0
 * - Prefix match: 1 + position
 * - Substring match: 10 + position
 *
 * Returns up to {@link MAX_SUGGESTIONS} names, original casing preserved.
 */

import type { SpNode } from "./types";

/** Maximum suggestions surfaced under the search bar (spec FR-011 / US2-AS1). */
export const MAX_SUGGESTIONS = 10;

interface Scored {
  readonly name: string;
  readonly score: number;
}

/**
 * Return the top {@link MAX_SUGGESTIONS} matches for `query`, ranked by the
 * scoring rule documented above.
 *
 * @param query - The user's input. Whitespace at the edges is trimmed.
 * @param names - The complete list of SP names; usually `data.nodes.map(n=>n.id)`.
 */
export const searchSps = (
  query: string,
  names: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const trimmed = query.trim();
  if (trimmed === "") return [];
  const needle = trimmed.toLowerCase();

  const scored: Scored[] = [];
  for (const name of names) {
    const lower = name.toLowerCase();
    let score: number;
    if (lower === needle) {
      score = 0;
    } else if (lower.startsWith(needle)) {
      score = 1;
    } else {
      const idx = lower.indexOf(needle);
      if (idx === -1) continue;
      score = 10 + idx;
    }
    scored.push({ name, score });
  }

  scored.sort((a, b) =>
    a.score === b.score ? a.name.localeCompare(b.name) : a.score - b.score,
  );

  return scored.slice(0, MAX_SUGGESTIONS).map((s) => s.name);
};

/** Convenience overload accepting an array of {@link SpNode}. */
export const searchSpsByNode = (
  query: string,
  nodes: ReadonlyArray<SpNode>,
): ReadonlyArray<string> => searchSps(query, nodes.map((n) => n.id));
