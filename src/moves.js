import { inside, has, distance, square } from "./constants.js";
import {
  at,
  eggAt,
  plantSeedAt,
  barrierAt,
  builtBarrierAt,
  naturalBarrierAt,
  terrain,
  round,
  juvenile,
  reproductionReady,
  fertilityPaused,
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
export const decompositionImmune = (state, p) =>
  p?.decompositionImmunity?.cell === square(p.r, p.c) &&
  state.turn <= p.decompositionImmunity.throughTurn;
export const dormant = (state, p) =>
  has(p, "Dormência") &&
  terrain(state, p.r, p.c) === "hostile" &&
  !decompositionImmune(state, p);
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
      builtBarrier = builtBarrierAt(state, r, c),
      naturalBarrier = naturalBarrierAt(state, r, c),
      cannibal =
        victim?.owner === p.owner &&
        victim.id !== p.id &&
        has(p, "Canibalismo") &&
        reproductionReady(state, p);
    if ((victim?.owner === p.owner && !cannibal) || egg?.owner === p.owner)
      return;
    if (
      victim &&
      victim.owner !== p.owner &&
      !captureUnlocked(state, p) &&
      !(has(p, "Haustório") && distance(p, victim) === 1)
    )
      return;
    if (builtBarrier && !has(p, "Escavador")) return;
    if (
      naturalBarrier &&
      !has(p, "Escavador") &&
      !has(p, "Escalador")
    )
      return;
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
        const builtBarrier = builtBarrierAt(state, r, c),
          naturalBarrier = naturalBarrierAt(state, r, c),
          occupied = occupiedTarget(r, c);
        if (builtBarrier) {
          if (!captureOnly && has(p, "Escavador")) add(r, c, [...path]);
          if (!has(p, "Voo") && !has(p, "Escavador")) break;
        } else if (naturalBarrier) {
          if (
            !captureOnly &&
            (has(p, "Escavador") || has(p, "Escalador"))
          )
            add(r, c, [...path]);
          if (
            !has(p, "Voo") &&
            !has(p, "Escavador") &&
            !has(p, "Escalador")
          )
            break;
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
  if (has(p, "Haustório") && has(p, "Fotossíntese"))
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const r = p.r + dr,
          c = p.c + dc,
          victim = at(state, r, c);
        if (victim && victim.owner !== p.owner)
          add(r, c, [[r, c]], { haustorium: true });
      }
  const collector = has(p, "Coletor"),
    canUseFertility =
      has(p, "Respiração anaeróbia") &&
      (!has(p, "Carnívoro") || has(p, "Onívoro")),
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
    has(p, "Respiração Cutânea") &&
    !has(p, "Fotossíntese")
  )
    for (const [dr, dc] of ORTH) {
      const r = p.r + dr,
        c = p.c + dc;
      if (
        inside(r, c) &&
        terrain(state, r, c) === "fertile" &&
        !at(state, r, c) &&
        !eggAt(state, r, c) &&
        !plantSeedAt(state, r, c) &&
        !barrierAt(state, r, c)
      ) {
        const existing = targets.find(
          (target) => target.r === r && target.c === c,
        );
        if (existing)
          Object.assign(existing, {
            path: [],
            stay: true,
            cutaneous: true,
            capture: false,
          });
        else
          targets.push({
            r,
            c,
            path: [],
            stay: true,
            cutaneous: true,
            capture: false,
          });
      }
    }
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
        if (
          inside(r, c) &&
          terrain(state, r, c) === "fertile" &&
          (!barrierAt(state, r, c) || has(p, "Trepadeira"))
        )
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

function emptyEggTarget(state, r, c) {
  return (
    inside(r, c) &&
    !at(state, r, c) &&
    !eggAt(state, r, c) &&
    !plantSeedAt(state, r, c) &&
    !barrierAt(state, r, c)
  );
}

export function domesticPlacementTargets(state) {
  const pending = state.domesticPlacement;
  if (state.phase !== "domestic-placement" || !pending) return [];
  const cells = [];
  for (let dr = -2; dr <= 2; dr++)
    for (let dc = -2; dc <= 2; dc++) {
      if (!dr && !dc) continue;
      const r = pending.origin.r + dr,
        c = pending.origin.c + dc;
      if (
        distance(pending.origin, { r, c }) <= 2 &&
        emptyEggTarget(state, r, c)
      )
        cells.push({ r, c });
    }
  return cells;
}

export function socialDefenseTargets(state) {
  if (state.phase !== "social-defense" || !state.socialDefense) return [];
  const ids = new Set(state.socialDefense.memberIds ?? []);
  return state.pieces.filter((piece) => ids.has(piece.id));
}

export function eggPlacementTargets(state) {
  const pending = state.eggPlacement;
  if (state.phase !== "egg-placement" || !pending) return [];
  const cells = [];
  for (let dr = -3; dr <= 3; dr++)
    for (let dc = -3; dc <= 3; dc++) {
      if (!dr && !dc) continue;
      const r = pending.origin.r + dr,
        c = pending.origin.c + dc;
      if (
        distance(pending.origin, { r, c }) <= 3 &&
        emptyEggTarget(state, r, c)
      )
        cells.push({ r, c });
    }
  return cells;
}

export function ovoviviparousPlacementTargets(state, p) {
  if (
    state.phase !== "move" ||
    state.chain ||
    !p ||
    p.owner !== state.current ||
    resting(state, p) ||
    dormant(state, p) ||
    !(p.pregnancies ?? []).some(
      (pregnancy) =>
        pregnancy.kind === "ovoviviparous" &&
        pregnancy.dueRound <= round(state),
    )
  )
    return [];
  const cells = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = p.r + dr,
        c = p.c + dc;
      if (emptyEggTarget(state, r, c)) cells.push({ r, c });
    }
  return cells;
}

export function canParasitize(state, p) {
  if (
    state.phase !== "move" ||
    state.chain ||
    !p ||
    p.owner !== state.current ||
    !has(p, "Parasitismo") ||
    resting(state, p) ||
    dormant(state, p)
  )
    return false;
  const canFertilize =
      !fertilityPaused(state) && terrain(state, p.r, p.c) !== "fertile",
    canAttackHabitat = state.pieces.some(
      (otherPiece) =>
        otherPiece.owner !== p.owner &&
        distance(p, otherPiece) === 1 &&
        terrain(state, otherPiece.r, otherPiece.c) !== "hostile",
    );
  return canFertilize || canAttackHabitat;
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
  if (state.phase === "egg-placement")
    return eggPlacementTargets(state).map((target) => ({
      type: "PLACE_EGG",
      r: target.r,
      c: target.c,
    }));
  if (state.phase === "domestic-placement")
    return domesticPlacementTargets(state).map((target) => ({
      type: "PLACE_DOMESTIC",
      r: target.r,
      c: target.c,
    }));
  if (state.phase === "social-defense")
    return socialDefenseTargets(state).map((piece) => ({
      type: "SOCIAL_SACRIFICE",
      id: piece.id,
    }));
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
      ...ovoviviparousPlacementTargets(state, p).map((target) => ({
        type: "LAY_OVOVIVIPAROUS",
        id: p.id,
        r: target.r,
        c: target.c,
      })),
      ...(canParasitize(state, p)
        ? [{ type: "PARASITIZE", id: p.id }]
        : []),
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
