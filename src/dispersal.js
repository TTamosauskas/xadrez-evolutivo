import { distance } from "./constants.js";
import { pick } from "./state.js";

/**
 * Selects cells that maximize distance from existing anchors and from cells
 * already selected in this pass. This preserves the former long-range spore
 * dispersion geometry without tying it to a genetic trait.
 */
export function chooseDistantCells(state, cells, anchors = [], count = 1) {
  const pool = [...cells],
    chosen = [],
    fixed = [...anchors];
  while (chosen.length < count && pool.length) {
    let best = -1,
      candidates = [];
    for (const cell of pool) {
      const references = [...fixed, ...chosen],
        score = references.length
          ? Math.min(...references.map((other) => distance(cell, other)))
          : 0;
      if (score > best) {
        best = score;
        candidates = [cell];
      } else if (score === best) candidates.push(cell);
    }
    const selected = pick(state, candidates),
      index = pool.indexOf(selected);
    chosen.push(selected);
    pool.splice(index, 1);
  }
  return chosen;
}
