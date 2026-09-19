import { inside, has, distance, square } from "./constants.js";
import {
  at,
  eggAt,
  barrierAt,
  terrain,
  round,
  juvenile,
  reproductionReady,
} from "./state.js";
import { captureUnlocked } from "./geology.js";
const ORTH = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ],
  DIAG = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
export const dysfunctionalResting = (state, p) =>
  has(p, "Mutação Disfuncional") &&
  Number.isInteger(p.lastMoveRound) &&
  round(state) + 1 <= p.lastMoveRound + 1;
export const regenerationResting = (state, p) =>
  Number.isInteger(p.regenerationRestThroughRound) &&
  round(state) <= p.regenerationRestThroughRound;
export const dormant = (state, p) =>
  has(p, "Dormência") && terrain(state, p.r, p.c) === "hostile";
export const resting = (state, p) =>
  dysfunctionalResting(state, p) || regenerationResting(state, p);

export function manipulationTargets(state) {
  const pending = state.manipulation;
  if (state.phase !== "manipulate" || !pending) return [];
  const origin = {
      r: Math.floor(pending.origin / 8),
      c: pending.origin % 8,
    },
    targets = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = origin.r + dr,
        c = origin.c + dc;
      if (
        inside(r, c) &&
        terrain(state, r, c) === "neutral" &&
        !barrierAt(state, r, c)
      )
        targets.push({ r, c });
    }
  return targets;
}

export function constructionTargets(state) {
  const pending = state.building;
  if (state.phase !== "build" || !pending) return [];
  const parent = state.pieces.find((piece) => piece.id === pending.id);
  if (!parent) return [];
  const decomposition = new Set([
      ...state.deathSites.map((site) => site.cell),
      ...state.fertileTraces.map((trace) => trace.cell),
    ]),
    targets = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = parent.r + dr,
        c = parent.c + dc,
        cell = square(r, c);
      if (
        inside(r, c) &&
        !at(state, r, c) &&
        !eggAt(state, r, c) &&
        !barrierAt(state, r, c) &&
        !decomposition.has(cell)
      )
        targets.push({ r, c });
    }
  return targets;
}
export function movesFor(state, p, { ignoreChain = false } = {}) {
  if (
    !p ||
    state.result ||
    !state.pieces.some((x) => x.id === p.id) ||
    resting(state, p) ||
    dormant(state, p)
  )
    return [];
  if (!ignoreChain && state.chain && state.chain !== p.id) return [];
  const targets = [];
  function add(r, c, path, extra = {}) {
    if (!inside(r, c)) return;
    const victim = at(state, r, c),
      egg = eggAt(state, r, c),
      cannibal =
        victim?.owner === p.owner &&
        victim.id !== p.id &&
        has(p, "Canibalismo") &&
        reproductionReady(state, p);
    if ((victim?.owner === p.owner && !cannibal) || egg?.owner === p.owner)
      return;
    if (victim && victim.owner !== p.owner && !captureUnlocked(state, p))
      return;
    if (barrierAt(state, r, c) && !has(p, "Chifre")) return;
    if (egg) {
      const parent = state.pieces.find((piece) => piece.id === egg.parentId),
        protectedEgg =
          parent &&
          has(parent, "Cuidado Parental") &&
          distance(parent, egg) === 1;
      if (!has(p, "Ovífagia") || protectedEgg) return;
    }
    if (
      victim &&
      has(victim, "Camuflagem") &&
      distance(p, victim) > 1 &&
      !has(p, "Visão Noturna")
    )
      return;
    targets.push({
      r,
      c,
      path,
      capture: !!victim,
      cannibal,
      eggCapture: egg?.id ?? null,
      ...extra,
    });
  }
  const occupiedTarget = (r, c) => !!at(state, r, c) || !!eggAt(state, r, c);
  function ray(directions, captureOnly = false) {
    for (const [dr, dc] of directions) {
      const path = [];
      for (let n = 1; n < 8; n++) {
        const r = p.r + dr * n,
          c = p.c + dc * n;
        if (!inside(r, c)) break;
        path.push([r, c]);
        const barrier = barrierAt(state, r, c),
          occupied = occupiedTarget(r, c);
        if (barrier) {
          if (!captureOnly && has(p, "Chifre")) add(r, c, [...path]);
          if (!has(p, "Voo") && !has(p, "Chifre")) break;
        } else if (!captureOnly || occupied) add(r, c, [...path]);
        if (occupied) break;
      }
    }
  }
  function chessTargets(captureOnly = false) {
    if (p.rank === 0) {
      const dir = p.r === 0 ? 1 : p.r === 7 ? -1 : p.pawnDir,
        r = p.r + dir;
      if (
        !captureOnly &&
        inside(r, p.c) &&
        !at(state, r, p.c) &&
        !eggAt(state, r, p.c)
      )
        add(r, p.c, [[r, p.c]]);
      for (const c of [p.c - 1, p.c + 1]) {
        const victim = at(state, r, c),
          egg = eggAt(state, r, c);
        if (
          inside(r, c) &&
          ((victim?.owner &&
            (victim.owner !== p.owner ||
              (victim.id !== p.id &&
                has(p, "Canibalismo") &&
                reproductionReady(state, p)))) ||
            (egg?.owner && egg.owner !== p.owner && has(p, "Ovífagia")))
        )
          add(r, c, [[r, c]]);
      }
    } else if (p.rank === 1) {
      for (const [dr, dc] of [
        [-2, -1],
        [-2, 1],
        [2, -1],
        [2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
      ]) {
        const r = p.r + dr,
          c = p.c + dc;
        if (!captureOnly || occupiedTarget(r, c)) add(r, c, [[r, c]]);
      }
    } else if (p.rank === 2) ray(DIAG, captureOnly);
    else if (p.rank === 3) ray(ORTH, captureOnly);
    else if (p.rank === 4) {
      for (const [dr, dc] of [...ORTH, ...DIAG]) {
        const r = p.r + dr,
          c = p.c + dc;
        if (!captureOnly || occupiedTarget(r, c)) add(r, c, [[r, c]]);
      }
    } else ray([...ORTH, ...DIAG], captureOnly);
  }
  const mobile = has(p, "Locomoção") || has(p, "Locomoção Avançada");
  if (mobile) chessTargets(false);
  else if (has(p, "Predação")) chessTargets(true);
  const collector = has(p, "Coletor"),
    canUseFertility = !has(p, "Carnívoro") || has(p, "Onívoro"),
    canReproduce = reproductionReady(state, p);
  if (
    canReproduce &&
    canUseFertility &&
    (terrain(state, p.r, p.c) === "fertile" || (collector && p.seeds > 0)) &&
    (!collector || (!has(p, "Esterilidade") && p.seedUsedTurn !== state.turn))
  )
    targets.push({ r: p.r, c: p.c, path: [], stay: true, capture: false });
  if (
    canReproduce &&
    canUseFertility &&
    has(p, "Traqueófitas") &&
    !has(p, "Esterilidade")
  )
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const r = p.r + dr,
          c = p.c + dc;
        if (inside(r, c) && terrain(state, r, c) === "fertile")
          targets.push({
            r,
            c,
            path: [],
            stay: true,
            vascular: true,
            capture: false,
          });
      }
  return targets;
}
export function partnersFor(state, p) {
  if (!reproductionReady(state, p)) return [];
  return state.pieces.filter(
    (x) =>
      x.id !== p.id &&
      x.owner === p.owner &&
      reproductionReady(state, x) &&
      !dormant(state, x) &&
      distance(p, x) === 1,
  );
}

export function nursingTargets(state, p) {
  if (
    state.phase !== "move" ||
    state.chain ||
    !p ||
    p.owner !== state.current ||
    !has(p, "Lactação") ||
    resting(state, p) ||
    dormant(state, p)
  )
    return [];
  return state.pieces.filter(
    (child) =>
      child.id !== p.id &&
      child.owner === p.owner &&
      child.parentId === p.id &&
      juvenile(state, child) &&
      distance(p, child) === 1,
  );
}
export function legalActions(state) {
  if (state.result) return [];
  if (state.phase === "manipulate")
    return [
      ...manipulationTargets(state).map((target) => ({
        type: "MANIPULATE",
        r: target.r,
        c: target.c,
      })),
      { type: "SKIP_MANIPULATION" },
    ];
  if (state.phase === "build")
    return [
      ...constructionTargets(state).map((target) => ({
        type: "BUILD",
        r: target.r,
        c: target.c,
      })),
      { type: "SKIP_BUILD" },
    ];
  if (state.phase === "partner") {
    const p = state.pieces.find((x) => x.id === state.partner.id);
    return partnersFor(state, p).map((m) => ({ type: "PARTNER", id: m.id }));
  }
  return state.pieces
    .filter((p) => p.owner === state.current)
    .flatMap((p) => [
      ...movesFor(state, p).map((t) => ({
        type: "MOVE",
        id: p.id,
        r: t.r,
        c: t.c,
      })),
      ...nursingTargets(state, p).map((child) => ({
        type: "NURSE",
        id: p.id,
        childId: child.id,
      })),
    ]);
}
export function canWaitForRest(state, owner) {
  return state.pieces.some(
    (p) => p.owner === owner && (resting(state, p) || dormant(state, p)),
  );
}
export function canWaitForBirth(state, owner) {
  return (
    state.eggs.some((egg) => egg.owner === owner) ||
    state.plantSeeds.some((seed) => seed.owner === owner) ||
    state.pieces.some(
      (p) => p.owner === owner && (p.pregnancies?.length ?? 0) > 0,
    )
  );
}
