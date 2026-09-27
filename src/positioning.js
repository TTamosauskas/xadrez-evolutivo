import { distance, has } from "./constants.js";
import { at, terrain, lethalHazardAt } from "./state.js";
import { movesFor } from "./moves.js";

const compareVectors = (a, b) => {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta) return delta;
  }
  return 0;
};

const nearestDistance = (pieces, cell, fallback = 8) =>
  pieces.length
    ? Math.min(...pieces.map((piece) => distance(piece, cell)))
    : fallback;

const pieceValue = (piece) =>
  1 + (piece?.rank ?? 0) * 2 + Math.min(4, piece?.traits?.length ?? 0) * 0.25;

function hypotheticalState(state, profile, cell, { removeOccupant = false } = {}) {
  const existingId = Number.isInteger(profile?.id) ? profile.id : null,
    occupant = at(state, cell.r, cell.c),
    pieces = state.pieces.filter(
      (piece) =>
        piece.id !== existingId &&
        (!removeOccupant || piece.id !== occupant?.id),
    ),
    candidate = {
      ...profile,
      id: existingId ?? -1,
      r: cell.r,
      c: cell.c,
      pregnancies: profile?.pregnancies ?? [],
      somaticMutations: profile?.somaticMutations ?? [],
    };
  pieces.push(candidate);
  return {
    ...state,
    chain: null,
    pieces,
  };
}

function captureOptions(state, candidate) {
  return movesFor(state, candidate, { ignoreChain: true }).filter((target) => {
    if (!target.capture) return false;
    const victim = at(state, target.r, target.c);
    return victim && victim.id !== candidate.id && victim.owner !== candidate.owner;
  });
}

export function offensivePositionScore(state, profile, cell, options = {}) {
  const hypothetical = hypotheticalState(state, profile, cell, options),
    candidate = hypothetical.pieces.find(
      (piece) => piece.id === (Number.isInteger(profile?.id) ? profile.id : -1),
    ),
    captures = captureOptions(hypothetical, candidate),
    captureValue = captures.reduce((sum, target) => {
      const victim = at(hypothetical, target.r, target.c);
      return sum + pieceValue(victim);
    }, 0),
    enemies = hypothetical.pieces.filter(
      (piece) => piece.id !== candidate.id && piece.owner !== candidate.owner,
    );
  return [
    captureValue,
    captures.length,
    -nearestDistance(enemies, candidate),
  ];
}

export function defensivePositionScore(state, profile, cell, options = {}) {
  const hypothetical = hypotheticalState(state, profile, cell, options),
    candidate = hypothetical.pieces.find(
      (piece) => piece.id === (Number.isInteger(profile?.id) ? profile.id : -1),
    ),
    enemies = hypothetical.pieces.filter(
      (piece) => piece.id !== candidate.id && piece.owner !== candidate.owner,
    );
  let threatCount = 0,
    threatValue = 0;
  for (const enemy of enemies) {
    const threatened = movesFor(hypothetical, enemy, {
      ignoreChain: true,
    }).some(
      (target) =>
        target.capture &&
        target.r === candidate.r &&
        target.c === candidate.c,
    );
    if (!threatened) continue;
    threatCount++;
    threatValue += pieceValue(enemy);
  }
  const terrainSafety = lethalHazardAt(hypothetical, cell.r, cell.c)
    ? -2
    : terrain(hypothetical, cell.r, cell.c) === "hostile"
      ? -1
      : 0;
  return [
    -threatValue,
    -threatCount,
    terrainSafety,
    nearestDistance(enemies, candidate),
  ];
}

export function socialPositionScore(state, profile, cell) {
  const allies = state.pieces.filter(
      (piece) => piece.owner === profile.owner && piece.id !== profile.id,
    ),
    adjacent = allies.filter((ally) => distance(ally, cell) === 1).length,
    nearby = allies.filter((ally) => distance(ally, cell) <= 2).length;
  return [
    adjacent,
    nearby,
    -nearestDistance(allies, cell),
  ];
}

export function fertileProximityScore(state, cell, origin = null) {
  const fertile = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (
        state.board[r * 8 + c] === "fertile" &&
        !(origin && origin.r === r && origin.c === c)
      )
        fertile.push({ r, c });
  return [-nearestDistance(fertile, cell)];
}

export function photosyntheticAllyProximityScore(state, profile, cell) {
  const plants = state.pieces.filter(
    (piece) =>
      piece.id !== profile.id &&
      piece.owner === profile.owner &&
      has(piece, "Fotossíntese"),
  );
  return [-nearestDistance(plants, cell)];
}

function bestCells(cells, score) {
  if (!cells.length) return [];
  let best = [],
    bestScore = null;
  for (const cell of cells) {
    const current = score(cell);
    const comparison = bestScore === null ? 1 : compareVectors(current, bestScore);
    if (comparison > 0) {
      best = [cell];
      bestScore = current;
    } else if (comparison === 0) {
      best.push(cell);
    }
  }
  return best;
}

export function offspringPlacementPreference(state, cells, origin, profile) {
  let preferred = [...cells];
  const appliedTraits = [];

  if (has(profile, "Testosterona")) {
    const next = bestCells(preferred, (cell) =>
      offensivePositionScore(state, profile, cell),
    );
    if (next.length < preferred.length) appliedTraits.push("Testosterona");
    preferred = next;
  } else if (has(profile, "Corticosteroides")) {
    const next = bestCells(preferred, (cell) =>
      defensivePositionScore(state, profile, cell),
    );
    if (next.length < preferred.length) appliedTraits.push("Corticosteroides");
    preferred = next;
  } else if (has(profile, "Forrageamento")) {
    const plants = state.pieces.filter(
      (piece) =>
        piece.id !== profile.id &&
        piece.owner === profile.owner &&
        has(piece, "Fotossíntese"),
    );
    if (plants.length) {
      const next = bestCells(preferred, (cell) =>
        photosyntheticAllyProximityScore(state, profile, cell),
      );
      if (next.length < preferred.length) appliedTraits.push("Forrageamento");
      preferred = next;
    }
  }

  if (has(profile, "Tropismo")) {
    const fertile = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (
          state.board[r * 8 + c] === "fertile" &&
          !(origin && origin.r === r && origin.c === c)
        )
          fertile.push({ r, c });
    if (fertile.length) {
      const next = bestCells(preferred, (cell) =>
        fertileProximityScore(state, cell, origin),
      );
      if (next.length < preferred.length) appliedTraits.push("Tropismo");
      preferred = next;
    }
  }

  if (has(profile, "Ocitocina")) {
    const next = bestCells(preferred, (cell) =>
      socialPositionScore(state, profile, cell),
    );
    if (next.length < preferred.length) appliedTraits.push("Ocitocina");
    preferred = next;
  }

  return {
    cells: preferred.length ? preferred : cells,
    appliedTraits,
  };
}

function hypotheticalAfterMove(state, piece, target) {
  const victim = at(state, target.r, target.c),
    hypothetical = hypotheticalState(
      state,
      piece,
      { r: target.r, c: target.c },
      { removeOccupant: !!victim && victim.id !== piece.id },
    );
  if (target.eggCapture)
    hypothetical.eggs = state.eggs.filter((egg) => egg.id !== target.eggCapture);
  return hypothetical;
}

function stableTarget(targets) {
  return [...targets].sort((a, b) => a.r - b.r || a.c - b.c)[0] ?? null;
}

export function corticalMoveSuggestions(state, piece) {
  if (!piece || !has(piece, "Córtex Pré-Frontal")) return null;
  const targets = movesFor(state, piece, { ignoreChain: true });
  if (!targets.length) return null;

  const offensive = bestCells(targets, (target) => {
      const victim = at(state, target.r, target.c),
        immediate =
          target.capture && victim?.owner !== piece.owner
            ? 20 + pieceValue(victim) * 4
            : target.eggCapture
              ? 12
              : 0,
        hypothetical = hypotheticalAfterMove(state, piece, target),
        moved = hypothetical.pieces.find((candidate) => candidate.id === piece.id),
        future = offensivePositionScore(
          hypothetical,
          moved,
          { r: moved.r, c: moved.c },
        );
      return [immediate, ...future];
    }),
    defensive = bestCells(targets, (target) => {
      const hypothetical = hypotheticalAfterMove(state, piece, target),
        moved = hypothetical.pieces.find((candidate) => candidate.id === piece.id);
      return defensivePositionScore(
        hypothetical,
        moved,
        { r: moved.r, c: moved.c },
      );
    });

  return {
    offensive: stableTarget(offensive),
    defensive: stableTarget(defensive),
  };
}

export function corticalActionBonus(state, action) {
  if (action?.type !== "MOVE") return 0;
  const piece = state.pieces.find((candidate) => candidate.id === action.id);
  if (!piece || !has(piece, "Córtex Pré-Frontal")) return 0;
  const suggestions = corticalMoveSuggestions(state, piece);
  if (!suggestions) return 0;
  const same = (target) =>
    target && target.r === action.r && target.c === action.c;
  return (same(suggestions.offensive) ? 4 : 0) +
    (same(suggestions.defensive) ? 3 : 0);
}
