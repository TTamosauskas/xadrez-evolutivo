import { inside, has, distance, square, energyBranch } from "./constants.js";
import {
  at,
  eggAt,
  plantSeedAt,
  fragmentAt,
  barrierAt,
  builtBarrierAt,
  naturalBarrierAt,
  terrain,
  round,
  juvenile,
  reproductionReady,
  fertilityPaused,
  ecologicalDomainBlocked,
} from "./state.js";
import {
  captureUnlocked,
  currentGeologicalStage,
  geologicalStage,
} from "./geology.js";
import {
  canBud,
  canPupate,
  connectedAlliesWithin,
  paedogenesisReady,
  parentalCareProtects,
  sortPreferredMates,
} from "./reproduction-traits.js";
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
export const pupating = (state, p) =>
  Number.isInteger(p?.pupaUntilRound) && round(state) < p.pupaUntilRound;
export const resting = (state, p) =>
  dysfunctionalResting(state, p) ||
  regenerationResting(state, p) ||
  pupating(state, p);

export function manipulationTargets(state) {
  const pending = state.manipulation;
  if (state.phase !== "manipulate" || !pending) return [];
  const parent = state.pieces.find((piece) => piece.id === pending.id);
  if (!parent || ecologicalDomainBlocked(state, parent.owner, parent.r, parent.c))
    return [];
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
        !ecologicalDomainBlocked(state, parent.owner, r, c) &&
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
        !ecologicalDomainBlocked(state, parent.owner, r, c) &&
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
    ecologicalDomainBlocked(state, p.owner, p.r, p.c) ||
    resting(state, p) ||
    dormant(state, p)
  )
    return [];
  if (!ignoreChain && state.chain && state.chain !== p.id) return [];
  const targets = [],
    terrestrialRestriction =
      currentGeologicalStage(state).index >= geologicalStage("silurian").index &&
      !has(p, "Locomoção Terrestre");
  function add(r, c, path, extra = {}) {
    if (!inside(r, c) || ecologicalDomainBlocked(state, p.owner, r, c)) return;
    if (
      terrestrialRestriction &&
      !extra.stay &&
      terrain(state, r, c) !== "fertile"
    )
      return;
    const victim = at(state, r, c),
      egg = eggAt(state, r, c),
      fragment = fragmentAt(state, r, c),
      builtBarrier = builtBarrierAt(state, r, c),
      naturalBarrier = naturalBarrierAt(state, r, c),
      botanicalPredation =
        victim?.owner !== undefined &&
        victim.owner !== p.owner &&
        distance(p, victim) === 1 &&
        has(p, "Fotossíntese") &&
        ((has(p, "Haustório") && has(victim, "Fotossíntese")) ||
          (has(p, "Carnivoria Botânica") &&
            !has(victim, "Fotossíntese"))),
      cannibal =
        victim?.owner === p.owner &&
        victim.id !== p.id &&
        has(p, "Canibalismo") &&
        reproductionReady(state, p);
    if (
      fragment ||
      (victim?.owner === p.owner && !cannibal) ||
      egg?.owner === p.owner
    )
      return;
    if (
      victim &&
      victim.owner !== p.owner &&
      !captureUnlocked(state, p) &&
      !botanicalPredation
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
          has(parent, "Incubação") &&
          distance(parent, egg) === 1;
      if (
        (!has(p, "Ovífagia") && !has(p, "Onívoro Oportunista")) ||
        protectedEgg
      )
        return;
    }
    if (
      victim &&
      victim.owner !== p.owner &&
      parentalCareProtects(state, victim)
    )
      return;
    if (
      victim &&
      has(victim, "Camuflagem") &&
      distance(p, victim) > 1 &&
      !has(p, "Visão Binocular")
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
      let geometricRange = 0;
      while (
        inside(
          p.r + dr * (geometricRange + 1),
          p.c + dc * (geometricRange + 1),
        )
      )
        geometricRange++;
      const movementLimit = has(p, "Deficiência Motora")
          ? 1
          : has(p, "Gigantismo")
            ? Math.max(1, Math.floor(geometricRange / 2))
            : geometricRange,
        captureLimit = has(p, "Deficiência Motora")
          ? 1
          : has(p, "Deficiência Sensorial")
            ? Math.max(1, Math.floor(geometricRange / 2))
            : geometricRange,
        path = [];
      for (let n = 1; n <= geometricRange; n++) {
        const r = p.r + dr * n,
          c = p.c + dc * n;
        if (!inside(r, c)) break;
        path.push([r, c]);
        const builtBarrier = builtBarrierAt(state, r, c),
          naturalBarrier = naturalBarrierAt(state, r, c),
          occupied = occupiedTarget(r, c),
          movementAllowed = n <= movementLimit,
          captureAllowed = n <= captureLimit;
        if (builtBarrier) {
          if (
            !captureOnly &&
            movementAllowed &&
            has(p, "Escavador")
          )
            add(r, c, [...path]);
          if (!has(p, "Voo") && !has(p, "Escavador")) break;
        } else if (naturalBarrier) {
          if (
            !captureOnly &&
            movementAllowed &&
            (has(p, "Escavador") || has(p, "Escalador"))
          )
            add(r, c, [...path]);
          if (
            !has(p, "Voo") &&
            !has(p, "Escavador") &&
            !has(p, "Escalador")
          )
            break;
        } else if (occupied) {
          const distantCapture =
            n > 1 && !has(p, "Percepção Espacial");
          if (!distantCapture && captureAllowed) add(r, c, [...path]);
        } else if (!captureOnly && movementAllowed) {
          add(r, c, [...path]);
        }
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
            (egg?.owner &&
              egg.owner !== p.owner &&
              (has(p, "Ovífagia") || has(p, "Onívoro Oportunista"))))
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
  const mobile = has(p, "Locomoção Primitiva") && !has(p, "Séssil");
  if (mobile) chessTargets(false);
  else if (!has(p, "Séssil") && captureUnlocked(state, p)) chessTargets(true);
  if (
    has(p, "Fotossíntese") &&
    (has(p, "Haustório") || has(p, "Carnivoria Botânica"))
  )
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const r = p.r + dr,
          c = p.c + dc,
          victim = at(state, r, c);
        if (!victim || victim.owner === p.owner) continue;
        const specialization =
          has(victim, "Fotossíntese") && has(p, "Haustório")
            ? "Haustório"
            : !has(victim, "Fotossíntese") &&
                has(p, "Carnivoria Botânica")
              ? "Carnivoria Botânica"
              : null;
        if (specialization)
          add(r, c, [], {
            botanicalPredation: specialization,
            stay: true,
          });
      }
  const collector = has(p, "Coletor"),
    canUseFertility =
      has(p, "Respiração anaeróbia") &&
      (!has(p, "Carnívoro") || has(p, "Onívoro") || has(p, "Mixotrofia")),
    canReproduce =
      reproductionReady(state, p) || paedogenesisReady(state, p);
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
export function sexualReproductionResource(state, parent, mate) {
  const providers = [parent, mate].filter(Boolean);
  for (const provider of providers)
    if (
      has(provider, "Respiração anaeróbia") &&
      terrain(state, provider.r, provider.c) === "fertile"
    )
      return {
        kind: "fertile",
        providerId: provider.id,
        cell: square(provider.r, provider.c),
      };
  for (const provider of providers)
    if (
      has(provider, "Respiração anaeróbia") &&
      has(provider, "Coletor") &&
      (provider.seeds ?? 0) > 0 &&
      provider.seedUsedTurn !== state.turn
    )
      return { kind: "seed", providerId: provider.id };
  return null;
}

export function partnersFor(state, p) {
  if (
    !reproductionReady(state, p) ||
    !has(p, "Reprodução Sexuada") ||
    dormant(state, p)
  )
    return [];
  const branch = energyBranch(p);
  if (!branch) return [];
  let pool;
  if (has(p, "Monogamia") && p.pairedWithId) {
    pool = state.pieces.filter((candidate) => candidate.id === p.pairedWithId);
  } else if (has(p, "Promiscuidade")) {
    pool = connectedAlliesWithin(state, p);
  } else {
    pool = state.pieces;
  }
  let candidates = pool.filter((x) => {
    if (
      x.id === p.id ||
      x.owner !== p.owner ||
      !has(x, "Reprodução Sexuada") ||
      !reproductionReady(state, x) ||
      dormant(state, x) ||
      (!has(p, "Promiscuidade") && distance(p, x) !== 1) ||
      !sexualReproductionResource(state, p, x)
    )
      return false;
    const mateBranch = energyBranch(x);
    return (
      mateBranch === branch ||
      (mateBranch &&
        mateBranch !== branch &&
        has(p, "Mixotrofia") &&
        has(x, "Mixotrofia"))
    );
  });
  if (has(p, "Acasalamento Preferencial"))
    candidates = sortPreferredMates(candidates);
  return candidates;
}

export function nursingTargets(state, p) {
  if (
    state.phase !== "move" ||
    state.chain ||
    !p ||
    p.owner !== state.current ||
    ecologicalDomainBlocked(state, p.owner, p.r, p.c) ||
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

function emptyEggTarget(state, r, c, owner = null) {
  return (
    inside(r, c) &&
    !ecologicalDomainBlocked(state, owner, r, c) &&
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
        emptyEggTarget(state, r, c, pending.owner)
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
        emptyEggTarget(state, r, c, pending.owner)
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
    ecologicalDomainBlocked(state, p.owner, p.r, p.c) ||
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
      if (emptyEggTarget(state, r, c, p.owner)) cells.push({ r, c });
    }
  return cells;
}

export function canParasitize(state, p) {
  if (
    state.phase !== "move" ||
    state.chain ||
    !p ||
    p.owner !== state.current ||
    ecologicalDomainBlocked(state, p.owner, p.r, p.c) ||
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
  if (state.phase === "collapse") return [{ type: "DOMAIN_COLLAPSE" }];
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
    const p = state.pieces.find((x) => x.id === state.partner.id),
      selected = new Set(state.partner.selectedIds ?? []);
    return partnersFor(state, p)
      .filter((mate) => !selected.has(mate.id))
      .map((mate) => ({ type: "PARTNER", id: mate.id }));
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
    .filter(
      (p) =>
        p.owner === state.current &&
        !ecologicalDomainBlocked(state, p.owner, p.r, p.c),
    )
    .flatMap((p) => [
      ...movesFor(state, p).map((t) => ({
        type: "MOVE",
        id: p.id,
        r: t.r,
        c: t.c,
      })),
      ...(has(p, "Acasalamento Preferencial")
        ? partnersFor(state, p).slice(0, 1)
        : partnersFor(state, p)
      ).map((mate) => ({
        type: "PARTNER",
        parentId: p.id,
        id: mate.id,
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
      ...(canBud(state, p) ? [{ type: "BUD", id: p.id }] : []),
      ...(canPupate(state, p) ? [{ type: "PUPATE", id: p.id }] : []),
    ]);
}
export function canWaitForRest(state, owner) {
  return state.pieces.some(
    (p) =>
      p.owner === owner &&
      !ecologicalDomainBlocked(state, p.owner, p.r, p.c) &&
      (resting(state, p) || dormant(state, p)),
  );
}
export function canWaitForBirth(state, owner) {
  return (
    state.eggs.some(
      (egg) =>
        egg.owner === owner &&
        !ecologicalDomainBlocked(state, owner, egg.r, egg.c),
    ) ||
    state.fragments.some(
      (fragment) =>
        fragment.owner === owner &&
        !ecologicalDomainBlocked(state, owner, fragment.r, fragment.c),
    ) ||
    state.pieces.some(
      (piece) =>
        piece.owner === owner &&
        (piece.marsupialPouch?.length ?? 0) > 0,
    ) ||
    state.plantSeeds.some(
      (seed) =>
        seed.owner === owner &&
        !ecologicalDomainBlocked(state, owner, seed.r, seed.c),
    ) ||
    state.pieces.some(
      (p) =>
        p.owner === owner &&
        !ecologicalDomainBlocked(state, p.owner, p.r, p.c) &&
        (p.pregnancies?.length ?? 0) > 0,
    )
  );
}
