import { inside, square } from "./constants.js";
import { random } from "./state.js";

export const CELLULAR_RULES = Object.freeze({
  CLASSIC: Object.freeze({ birth: [3], survive: [2, 3], code: "B3/S23" }),
  TWO_BY_TWO: Object.freeze({ birth: [3, 6], survive: [1, 2, 5], code: "B36/S125" }),
  MAZECTRIC: Object.freeze({ birth: [3], survive: [1, 2, 3, 4], code: "B3/S1234" }),
  SEEDS: Object.freeze({ birth: [2], survive: [], code: "B2/S" }),
  CORROSION: Object.freeze({ birth: [3], survive: [1, 2, 4], code: "B3/S124" }),
  LIFE_WITHOUT_DEATH: Object.freeze({
    birth: [3],
    survive: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    code: "B3/S012345678",
  }),
});

const allCells = () => Array.from({ length: 64 }, (_, i) => i);
const asSet = (value) => (value instanceof Set ? value : new Set(value ?? []));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function neighborCount(mask, cell) {
  const r = Math.floor(cell / 8),
    c = cell % 8;
  let total = 0;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      if (!inside(r + dr, c + dc)) continue;
      if (mask.has(square(r + dr, c + dc))) total++;
    }
  return total;
}

function preferenceScore(cell, preferred, avoided) {
  let score = 0;
  if (preferred.has(cell)) score += 12;
  if (avoided.has(cell)) score -= 12;
  const r = Math.floor(cell / 8),
    c = cell % 8;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr,
        cc = c + dc;
      if (!inside(rr, cc)) continue;
      const neighbor = square(rr, cc);
      if (preferred.has(neighbor)) score += 2;
      if (avoided.has(neighbor)) score -= 2;
    }
  return score;
}

function ranked(state, cells, score) {
  return cells
    .map((cell) => ({ cell, score: score(cell), jitter: random(state) }))
    .sort((a, b) => b.score - a.score || a.jitter - b.jitter || a.cell - b.cell)
    .map((entry) => entry.cell);
}

function evolveMask(beforeMask, rule, eligible, protectedCells) {
  const after = new Set();
  for (const cell of allCells()) {
    if (protectedCells.has(cell)) {
      if (beforeMask.has(cell)) after.add(cell);
      continue;
    }
    if (!eligible.has(cell)) continue;
    const neighbors = neighborCount(beforeMask, cell);
    if (
      beforeMask.has(cell)
        ? rule.survive.includes(neighbors)
        : rule.birth.includes(neighbors)
    )
      after.add(cell);
  }
  return after;
}

function normalizeMask(
  state,
  beforeMask,
  candidateMask,
  {
    target,
    eligible,
    protectedCells,
    preferred,
    avoided,
    changeLimit = Infinity,
  },
) {
  const fixed = new Set(
      [...beforeMask].filter((cell) => protectedCells.has(cell)),
    ),
    removable = [...beforeMask].filter((cell) => !protectedCells.has(cell)),
    additions = [...candidateMask].filter(
      (cell) => !beforeMask.has(cell) && eligible.has(cell),
    ),
    removals = removable.filter((cell) => !candidateMask.has(cell)),
    desiredChanges = Math.min(
      changeLimit,
      additions.length,
      removals.length,
    ),
    next = new Set(beforeMask);

  const rankedRemovals = ranked(
      state,
      removals,
      (cell) =>
        -preferenceScore(cell, preferred, avoided) -
        neighborCount(beforeMask, cell),
    ),
    rankedAdditions = ranked(
      state,
      additions,
      (cell) =>
        preferenceScore(cell, preferred, avoided) +
        neighborCount(candidateMask, cell),
    );

  for (let i = 0; i < desiredChanges; i++) {
    next.delete(rankedRemovals[i]);
    next.add(rankedAdditions[i]);
  }

  const normalizedTarget = Math.max(target, fixed.size),
    remainingLimit = Number.isFinite(changeLimit)
      ? Math.max(0, changeLimit - desiredChanges)
      : Infinity;
  if (next.size > normalizedTarget) {
    const extra = ranked(
        state,
        [...next].filter((cell) => !protectedCells.has(cell)),
        (cell) =>
          -preferenceScore(cell, preferred, avoided) -
          neighborCount(next, cell),
      ),
      removeCount = Math.min(
        next.size - normalizedTarget,
        remainingLimit,
      );
    for (const cell of extra.slice(0, removeCount)) next.delete(cell);
  }

  if (next.size < normalizedTarget) {
    const pool = ranked(
        state,
        [...eligible].filter((cell) => !next.has(cell)),
        (cell) =>
          preferenceScore(cell, preferred, avoided) +
          neighborCount(next, cell),
      ),
      addCount = Math.min(
        normalizedTarget - next.size,
        remainingLimit,
      );
    for (const cell of pool.slice(0, addCount)) next.add(cell);
  }

  return next;
}

export function advanceCellularTerrain(
  state,
  {
    type,
    rule,
    min = 0,
    max = 64,
    steps = 1,
    changeLimit = Infinity,
    protectedCells = [],
    preferredCells = [],
    avoidedCells = [],
    eligibleCells = null,
    targetCount = null,
  },
) {
  if (!["fertile", "hostile"].includes(type))
    throw Error("Tipo de terreno celular inválido.");
  if (!rule?.birth || !rule?.survive)
    throw Error("Regra celular inválida.");

  const protectedSet = asSet(protectedCells),
    preferred = asSet(preferredCells),
    avoided = asSet(avoidedCells),
    eligible = new Set(
      eligibleCells ??
        allCells().filter(
          (cell) =>
            state.board[cell] === "neutral" || state.board[cell] === type,
        ),
    );
  for (const cell of protectedSet)
    if (state.board[cell] === type) eligible.add(cell);

  let mask = new Set(
    allCells().filter((cell) => state.board[cell] === type),
  );
  const initialCount = mask.size,
    target = clamp(
      targetCount ?? initialCount,
      Math.max(0, min),
      Math.min(64, max),
    );

  for (let step = 0; step < Math.max(1, steps); step++) {
    const candidate = evolveMask(mask, rule, eligible, protectedSet);
    mask = normalizeMask(state, mask, candidate, {
      target,
      eligible,
      protectedCells: protectedSet,
      preferred,
      avoided,
      changeLimit,
    });
  }

  const before = [...state.board];
  for (const cell of eligible) {
    if (protectedSet.has(cell)) continue;
    if (mask.has(cell)) state.board[cell] = type;
    else if (state.board[cell] === type) state.board[cell] = "neutral";
  }

  const changed = [];
  for (let cell = 0; cell < 64; cell++)
    if (before[cell] !== state.board[cell])
      changed.push({ cell, from: before[cell], to: state.board[cell] });
  return changed;
}
