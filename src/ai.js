import { legalActions, movesFor, actionsForPiece } from "./moves.js";
import { simulate } from "./engine.js";
import {
  has,
  other,
  square,
  distance,
  canPhotosynthesize,
} from "./constants.js";
import {
  eggAt,
  barrierAt,
  organicResidueAt,
  carcassAt,
  captureDisturbanceAt,
  lethalHazardAt,
  reproductionReady,
  terrain,
  round,
  strongestSurvivor,
  survivorPieceValue,
  expressedPositiveGenes,
  carriedNegativeMutations,
  hiddenPositiveRecessives,
} from "./state.js";
import {
  canUseBasalFertility,
  predatoryReproductionAvailable,
} from "./reproduction-traits.js";
import { corticalActionBonus } from "./positioning.js";

export const AI_ACTION_TYPES = Object.freeze([
  "MOVE",
  "PARTNER",
  "AGGRESSIVE_MATE",
  "CHEMOSYNTHESIS",
  "FIX_NITROGEN",
  "PARTHENOGENESIS",
  "NURSE",
  "LAY_OVOVIVIPAROUS",
  "EXTENDED_CAPTURE",
  "RHIZOME",
  "HEMATOPHAGY",
  "BROOD_PARASITIZE",
  "REJECT_BROOD_PARASITE",
  "BIO_PROJECTILE",
  "ELECTRODISCHARGE",
  "FEEDING_REACH",
  "PARASITIZE",
  "BUD",
  "PUPATE",
  "NICHE_BUILD",
  "SEROTONIN_REPOSITION",
  "SKIP_SEROTONIN_REPOSITION",
  "MANIPULATE",
  "SKIP_MANIPULATION",
  "BUILD",
  "SKIP_BUILD",
  "PLACE_EGG",
  "PLACE_DOMESTIC",
  "SOCIAL_SACRIFICE",
  "PASS",
]);

export const AI_SEARCH_PROFILES = Object.freeze({
  easy: Object.freeze({ budget: 0, maxNodes: 0, depth: 0, branchWidth: 0 }),
  medium: Object.freeze({ budget: 180, maxNodes: 320, depth: 1, branchWidth: 16 }),
  hard: Object.freeze({ budget: 900, maxNodes: 1800, depth: 3, branchWidth: 12 }),
});

const CORTICAL_SEARCH_PROFILE = Object.freeze({
  budget: 240,
  maxNodes: 420,
  depth: 2,
  branchWidth: 10,
});

export function fallbackAction(state) {
  const actions = legalActions(state);
  return (
    actions.sort((a, b) => actionPriority(state, b) - actionPriority(state, a))[0] ?? {
      type: "PASS",
    }
  );
}

function futureCaptureOptions(state, piece, action) {
  if (
    !piece ||
    action.type !== "MOVE" ||
    !Number.isInteger(action.r) ||
    !Number.isInteger(action.c)
  )
    return 0;
  const occupied = state.pieces.find(
    (otherPiece) =>
      otherPiece.id !== piece.id &&
      otherPiece.r === action.r &&
      otherPiece.c === action.c,
  );
  if (occupied) return 0;
  const moved = { ...piece, r: action.r, c: action.c },
    hypothetical = {
      ...state,
      chain: null,
      pieces: state.pieces.map((otherPiece) =>
        otherPiece.id === piece.id ? moved : otherPiece,
      ),
    };
  return movesFor(hypothetical, moved, { ignoreChain: true }).filter(
    (target) => {
      if (!target.capture) return false;
      const victim = hypothetical.pieces.find(
        (otherPiece) =>
          otherPiece.id !== moved.id &&
          otherPiece.r === target.r &&
          otherPiece.c === target.c,
      );
      return victim && victim.owner !== moved.owner;
    },
  ).length;
}

export function crowdingPenalty(count) {
  return count > 12 ? Math.min(36, (count - 12) * 2) : 0;
}

const compressedRankValue = (piece) =>
  Math.log2(Math.max(0, survivorPieceValue(piece)) + 1) * 4;

export function strategicPieceValue(state, piece) {
  if (!piece) return 0;
  const positive = expressedPositiveGenes(piece),
    negative = carriedNegativeMutations(piece),
    hiddenPositive = hiddenPositiveRecessives(piece),
    currentRound = round(state),
    unavailable =
      (piece.maturesRound ?? 0) > currentRound ||
      (piece.nextReproductionRound ?? 0) > currentRound,
    impaired =
      (piece.pupaUntilRound ?? 0) > currentRound ||
      (piece.neurodivergenceRestThroughRound ?? -1) >= currentRound ||
      (piece.intoxicationRestThroughRound ?? -1) >= currentRound ||
      !!piece.webTrapped,
    terrainPenalty = lethalHazardAt(state, piece.r, piece.c)
      ? 18
      : terrain(state, piece.r, piece.c) === "hostile"
        ? has(piece, "Dormência") ||
          has(piece, "Endotermia") ||
          has(piece, "Extremotolerância")
          ? 0.75
          : 2.5
        : 0;
  return (
    8 +
    compressedRankValue(piece) +
    positive * 1.35 -
    negative * 2.75 -
    hiddenPositive * 0.45 -
    (piece.infection ? 5 : 0) -
    (piece.venom ? 5 : 0) -
    (piece.broodParasite ? 2 : 0) -
    (piece.autotomyRecovery ? 1.5 : 0) -
    (unavailable ? 1.25 : 0) -
    (impaired ? 2 : 0) -
    terrainPenalty
  );
}

function nearestEnemyDistance(state, owner, r, c) {
  const enemies = state.pieces.filter((piece) => piece.owner !== owner);
  return enemies.length
    ? Math.min(...enemies.map((piece) => distance({ r, c }, piece)))
    : 8;
}

function adjacentBalance(state, owner, r, c) {
  let allies = 0,
    enemies = 0;
  for (const piece of state.pieces) {
    if (distance({ r, c }, piece) !== 1) continue;
    if (piece.owner === owner) allies++;
    else enemies++;
  }
  return { allies, enemies };
}

function placementPriority(state, action, owner = state.current) {
  if (!Number.isInteger(action.r) || !Number.isInteger(action.c)) return 0;
  if (lethalHazardAt(state, action.r, action.c)) return -10000;
  const targetTerrain = terrain(state, action.r, action.c),
    balance = adjacentBalance(state, owner, action.r, action.c),
    enemyDistance = nearestEnemyDistance(state, owner, action.r, action.c);
  return (
    (targetTerrain === "fertile" ? 3 : targetTerrain === "hostile" ? -3 : 0) +
    balance.allies * 1.5 -
    balance.enemies * 2 +
    Math.min(6, enemyDistance) * 0.35
  );
}

function barrierPriority(state, action) {
  if (!Number.isInteger(action.r) || !Number.isInteger(action.c)) return 0;
  const balance = adjacentBalance(state, state.current, action.r, action.c);
  return 3 + balance.enemies * 2 - balance.allies;
}

export function actionPriority(state, a) {
  if (a.type === "CHEMOSYNTHESIS") return 13;
  if (a.type === "FIX_NITROGEN")
    return 8 + placementPriority(state, a);
  if (a.type === "EXTENDED_CAPTURE") {
    const target = state.pieces.find((piece) => piece.id === a.targetId);
    return (a.trait === "Tromba" ? 16 : 13) + strategicPieceValue(state, target) * 0.16;
  }
  if (a.type === "RHIZOME") return 10 + placementPriority(state, a);
  if (a.type === "HEMATOPHAGY") {
    const actor = state.pieces.find((piece) => piece.id === a.id),
      target = state.pieces.find((piece) => piece.id === a.targetId);
    return (
      (actor?.autotomyRecovery ? 22 : 14) +
      strategicPieceValue(state, target) * 0.12
    );
  }
  if (a.type === "BROOD_PARASITIZE") {
    const target = state.pieces.find((piece) => piece.id === a.targetId);
    return 11 + strategicPieceValue(state, target) * 0.08;
  }
  if (a.type === "REJECT_BROOD_PARASITE") return 14;
  if (a.type === "ELECTRODISCHARGE") {
    const target = state.pieces.find((piece) => piece.id === a.targetId);
    return 19 + strategicPieceValue(state, target) * 0.18;
  }
  if (a.type === "FEEDING_REACH") {
    const target = state.pieces.find((piece) => piece.id === a.targetId);
    return 15 + strategicPieceValue(state, target) * 0.17;
  }
  if (a.type === "BIO_PROJECTILE") {
    const target = state.pieces.find((piece) => piece.id === a.targetId);
    return 9 + strategicPieceValue(state, target) * 0.1;
  }
  if (a.type === "PARASITIZE") {
    const target = state.pieces.find((piece) => piece.id === a.targetId);
    return target
      ? 9 + strategicPieceValue(state, target) * 0.08
      : 7;
  }
  if (a.type === "BUD") return 13;
  if (a.type === "PUPATE") return 5;
  if (a.type === "PARTNER") {
    const mate = state.pieces.find((piece) => piece.id === a.id);
    return 8 + strategicPieceValue(state, mate) * 0.08;
  }
  if (a.type === "PARTHENOGENESIS") return 9;
  if (a.type === "AGGRESSIVE_MATE")
    return 9 + strategicPieceValue(
      state,
      state.pieces.find((piece) => piece.id === a.id),
    ) * 0.06;
  if (a.type === "NURSE") {
    const child = state.pieces.find((piece) => piece.id === a.childId);
    return 7 + strategicPieceValue(state, child) * 0.08;
  }
  if (a.type === "PLACE_EGG" || a.type === "LAY_OVOVIVIPAROUS") {
    let free = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const r = a.r + dr,
          c = a.c + dc;
        if (
          r >= 0 &&
          r < 8 &&
          c >= 0 &&
          c < 8 &&
          !state.pieces.some((piece) => piece.r === r && piece.c === c) &&
          !state.eggs.some((egg) => egg.r === r && egg.c === c) &&
          !state.plantSeeds.some(
            (seed) => !seed.transport && seed.r === r && seed.c === c,
          ) &&
          !barrierAt(state, r, c)
        )
          free++;
      }
    return 8 + free * 1.5 + placementPriority(state, a);
  }
  if (a.type === "PLACE_DOMESTIC")
    return 12 + placementPriority(state, a);
  if (a.type === "NICHE_BUILD") return 5 + barrierPriority(state, a);
  if (a.type === "BUILD") return 4 + barrierPriority(state, a);
  if (a.type === "SKIP_BUILD") return -1;
  if (a.type === "MANIPULATE") {
    const pending = state.manipulation,
      balance = adjacentBalance(state, state.current, a.r, a.c);
    return pending?.terrain === "hostile"
      ? 6 + balance.enemies * 2 - balance.allies
      : 6 + balance.allies * 2 - balance.enemies;
  }
  if (a.type === "SKIP_MANIPULATION") return -2;
  if (a.type === "SEROTONIN_REPOSITION")
    return 8 + placementPriority(state, a);
  if (a.type === "SKIP_SEROTONIN_REPOSITION") return -3;
  if (a.type === "SOCIAL_SACRIFICE") {
    const sacrifice = state.pieces.find((piece) => piece.id === a.id),
      recommended = hierarchySacrificeRecommendation(state);
    return (
      18 -
      strategicPieceValue(state, sacrifice) * 0.3 +
      (recommended?.id === a.id ? 8 : 0)
    );
  }

  const p = state.pieces.find(
      (piece) => piece.id === (a.id ?? state.serotoninReposition?.id),
    ),
    moveTarget =
      a.type === "MOVE" && p
        ? movesFor(state, p).find(
            (target) => target.r === a.r && target.c === a.c,
          )
        : null,
    victim = state.pieces.find(
      (piece) => piece.r === a.r && piece.c === a.c && piece.id !== p?.id,
    ),
    enemyVictim = victim?.owner !== undefined && victim.owner !== state.current,
    alliedVictim = victim?.owner === state.current,
    familyReproductionBonus = moveTarget?.filialCannibal
      ? 10
      : moveTarget?.matriphagy
        ? 11
        : 0,
    egg = eggAt(state, a.r, a.c),
    targetCell =
      Number.isInteger(a.r) && Number.isInteger(a.c) ? square(a.r, a.c) : null,
    targetTerrain = targetCell === null ? null : state.board[targetCell],
    enemies = p
      ? state.pieces.filter((piece) => piece.owner !== p.owner)
      : [],
    ownPopulation = state.pieces.filter(
      (piece) => piece.owner === state.current,
    ).length,
    hunt =
      p &&
      (has(p, "Predação") || has(p, "Mixotrofia")) &&
      enemies.length &&
      Number.isInteger(a.r) &&
      !enemyVictim
        ? Math.min(14, futureCaptureOptions(state, p, a) * 4)
        : 0,
    captureValue = enemyVictim
      ? 10 +
        strategicPieceValue(state, victim) * 0.45 +
        (has(victim, "Fotossíntese") ? 5 : 0) +
        (predatoryReproductionAvailable(p, victim) ? 7 : 0) +
        (targetTerrain === "fertile" ? 3 : 0) +
        (enemies.length <= 2 ? 30 : 0)
      : 0,
    cannibalValue = alliedVictim
      ? ownPopulation > 12
        ? 4 + (ownPopulation - 12) * 2 - strategicPieceValue(state, victim) * 0.1
        : -10 - strategicPieceValue(state, victim) * 0.15
      : 0,
    fertileValue =
      !victim && targetTerrain === "fertile" && canUseBasalFertility(state, p)
        ? 5
        : 0,
    fecalValue =
      p && targetCell !== null && organicResidueAt(state, a.r, a.c)
        ? canPhotosynthesize(p)
          ? 8
          : has(p, "Coprofagia")
            ? 7
            : -8
        : 0,
    carcassValue =
      p && targetCell !== null && carcassAt(state, a.r, a.c)
        ? has(p, "Necrófago")
          ? 9
          : has(p, "Onívoro Oportunista")
            ? 7
            : 0
        : 0,
    scavengerSafe =
      p &&
      targetCell !== null &&
      !!carcassAt(state, a.r, a.c) &&
      (has(p, "Necrófago") || has(p, "Onívoro Oportunista")),
    disturbancePenalty =
      targetCell !== null &&
      captureDisturbanceAt(state, a.r, a.c) &&
      !scavengerSafe
        ? 8
        : 0,
    lethalPenalty =
      targetCell !== null && lethalHazardAt(state, a.r, a.c) ? 10000 : 0,
    hostilePenalty =
      targetTerrain === "hostile" &&
      !has(p, "Dormência") &&
      !has(p, "Endotermia") &&
      !has(p, "Extremotolerância")
        ? 8
        : 0;
  return (
    familyReproductionBonus +
    hunt +
    captureValue +
    cannibalValue +
    fertileValue +
    fecalValue +
    carcassValue +
    corticalActionBonus(state, a) +
    placementPriority(state, a, p?.owner ?? state.current) * 0.25 +
    (egg && egg.owner !== state.current ? 6 + egg.brood.length : 0) -
    hostilePenalty -
    disturbancePenalty -
    lethalPenalty
  );
}

function evaluationStateForPiece(state, piece) {
  return {
    ...state,
    current: piece.owner,
    phase: "move",
    chain: null,
    chainTrait: null,
    chainOptions: [],
    chainOrigin: null,
    neurofocus: null,
    neurodivergenceAction: null,
    socialDefense: null,
    serotoninReposition: null,
    manipulation: null,
    building: null,
    eggPlacement: null,
    domesticPlacement: null,
  };
}

export function bestMoveSuggestion(state, piece) {
  if (!piece) return null;
  const hypothetical = evaluationStateForPiece(state, piece),
    candidate = hypothetical.pieces.find((entry) => entry.id === piece.id);
  if (!candidate) return null;
  const moves = actionsForPiece(hypothetical, candidate, {
      ignoreTurn: true,
    }).filter((action) => action.type === "MOVE");
  if (!moves.length) return null;
  let best = null,
    bestScore = -Infinity;
  for (const action of moves) {
    const score = actionPriority(hypothetical, action);
    if (
      score > bestScore ||
      (score === bestScore &&
        (!best ||
          action.r < best.r ||
          (action.r === best.r && action.c < best.c)))
    ) {
      best = action;
      bestScore = score;
    }
  }
  return best ? { action: best, score: bestScore } : null;
}

export function superorganismRecommendation(state, selected) {
  if (!selected || !has(selected, "Superorganismo")) return null;
  const members = state.pieces.filter(
    (piece) =>
      piece.owner === selected.owner && has(piece, "Superorganismo"),
  );
  let best = null;
  for (const member of members) {
    const suggestion = bestMoveSuggestion(state, member);
    if (!suggestion) continue;
    if (
      !best ||
      suggestion.score > best.score ||
      (suggestion.score === best.score && member.id < best.memberId)
    )
      best = {
        memberId: member.id,
        action: suggestion.action,
        score: suggestion.score,
      };
  }
  return best;
}

function compareSacrificeVectors(a, b) {
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta) return delta;
  }
  return 0;
}

export function hierarchySacrificeRecommendation(state) {
  if (state.phase !== "social-defense" || !state.socialDefense) return null;
  const ids = new Set(state.socialDefense.memberIds ?? []),
    members = state.pieces.filter((piece) => ids.has(piece.id));
  if (!members.some((piece) => has(piece, "Hierarquia"))) return null;

  let chosen = null,
    chosenVector = null;
  for (const piece of members) {
    const negatives = carriedNegativeMutations(piece),
      positives = expressedPositiveGenes(piece),
      bestMove = bestMoveSuggestion(state, piece),
      vector = [
        reproductionReady(state, piece) ? 0 : 1,
        -survivorPieceValue(piece),
        negatives,
        -positives,
        hiddenPositiveRecessives(piece),
        -(bestMove?.score ?? -100000),
      ];
    if (
      chosenVector === null ||
      compareSacrificeVectors(vector, chosenVector) > 0 ||
      (compareSacrificeVectors(vector, chosenVector) === 0 &&
        piece.id < chosen.id)
    ) {
      chosen = piece;
      chosenVector = vector;
    }
  }
  return chosen;
}


function founderBranchValue(state, owner, photosynthetic) {
  const piece = strongestSurvivor(
    state,
    owner,
    photosynthetic
      ? (candidate) => canPhotosynthesize(candidate)
      : (candidate) => !canPhotosynthesize(candidate),
  ).piece;
  if (!piece) return -12;
  return (
    8 +
    compressedRankValue(piece) * 0.7 +
    expressedPositiveGenes(piece) * 0.8 -
    carriedNegativeMutations(piece) * 1.4 -
    hiddenPositiveRecessives(piece) * 0.35
  );
}

function pendingBroodValue(state, owner) {
  let value = 0;
  for (const egg of state.eggs ?? [])
    if (egg.owner === owner)
      value += 2 + Math.min(6, (egg.brood ?? []).length * 1.4);
  for (const seed of state.plantSeeds ?? [])
    if (seed.owner === owner) value += seed.transport ? 0.75 : 2;
  for (const fragment of state.fragments ?? [])
    if (fragment.owner === owner) value += 1.5;
  for (const piece of state.pieces)
    if (piece.owner === owner) {
      value += Math.min(3, piece.seeds ?? 0) * 0.75;
      value += Math.min(
        8,
        (piece.pregnancies ?? []).reduce(
          (sum, pregnancy) => sum + (pregnancy.brood?.length ?? 0) * 1.4,
          0,
        ),
      );
      value += Math.min(5, (piece.marsupialPouch ?? []).length * 1.2);
    }
  return value;
}

function sideValue(state, owner) {
  const pieces = state.pieces
      .filter((piece) => piece.owner === owner)
      .reduce((sum, piece) => sum + strategicPieceValue(state, piece), 0),
    population = state.pieces.filter((piece) => piece.owner === owner).length,
    branchValue =
      founderBranchValue(state, owner, true) +
      founderBranchValue(state, owner, false),
    brood = pendingBroodValue(state, owner);
  return pieces + branchValue * 0.45 + brood - crowdingPenalty(population);
}

export function evaluateForAI(state, owner) {
  if (state.result)
    return state.result.winner === owner
      ? 100000
      : state.result.winner
        ? -100000
        : 0;
  return sideValue(state, owner) - sideValue(state, other(owner));
}

function orderedActions(state, limit = Infinity) {
  return legalActions(state)
    .sort(
      (a, b) =>
        actionPriority(state, b) - actionPriority(state, a) ||
        String(a.type).localeCompare(String(b.type)) ||
        (a.id ?? 0) - (b.id ?? 0) ||
        (a.r ?? 0) - (b.r ?? 0) ||
        (a.c ?? 0) - (b.c ?? 0),
    )
    .slice(0, limit);
}

function searchValue(
  state,
  owner,
  depth,
  context,
  alpha = -Infinity,
  beta = Infinity,
  continuationSteps = 8,
) {
  if (
    state.result ||
    state.notices?.length ||
    depth <= 0 ||
    continuationSteps <= 0 ||
    context.nodes >= context.maxNodes ||
    context.now() > context.deadline
  )
    return evaluateForAI(state, owner);

  const actions = orderedActions(state, context.branchWidth);
  if (!actions.length) return evaluateForAI(state, owner);

  const maximizing = state.current === owner;
  let best = maximizing ? -Infinity : Infinity;
  for (const action of actions) {
    if (
      context.nodes >= context.maxNodes ||
      context.now() > context.deadline
    )
      break;
    const beforeOwner = state.current,
      next = simulate(state, action),
      turnAdvanced = next.current !== beforeOwner,
      nextDepth = Math.max(0, depth - (turnAdvanced ? 1 : 0));
    context.nodes++;
    const value = searchValue(
      next,
      owner,
      nextDepth,
      context,
      alpha,
      beta,
      continuationSteps - 1,
    );
    if (maximizing) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return Number.isFinite(best) ? best : evaluateForAI(state, owner);
}

function profileFor(difficulty, cortexAvailable, options) {
  const base =
      difficulty === "easy" && cortexAvailable
        ? CORTICAL_SEARCH_PROFILE
        : AI_SEARCH_PROFILES[difficulty] ?? AI_SEARCH_PROFILES.medium,
    override = (key) =>
      Number.isFinite(options?.[key]) ? options[key] : base[key];
  return {
    budget: override("budget"),
    maxNodes: override("maxNodes"),
    depth: override("depth"),
    branchWidth: override("branchWidth"),
  };
}

/** Bounded search runs only inside a worker. The UI has its own independent timeout. */
export function chooseAction(
  state,
  difficulty = "medium",
  {
    now = () => performance.now(),
    budget,
    maxNodes,
    depth,
    branchWidth,
    stats = null,
  } = {},
) {
  const actions = orderedActions(state);
  if (!actions.length) return { type: "PASS" };

  const cortexAvailable = actions.some(
    (action) =>
      action.type === "MOVE" &&
      has(
        state.pieces.find((piece) => piece.id === action.id),
        "Neocórtex Desenvolvido",
      ),
  );

  if (difficulty === "easy" && !cortexAvailable)
    return state.scenario === "arena"
      ? actions[(state.rng >>> 0) % actions.length]
      : actions[(state.rng >>> 0) % Math.min(actions.length, 3)];

  const profile = profileFor(
      difficulty,
      cortexAvailable,
      { budget, maxNodes, depth, branchWidth },
    ),
    deadline = now() + profile.budget,
    owner = state.current,
    context = {
      now,
      deadline,
      maxNodes: profile.maxNodes,
      branchWidth: profile.branchWidth,
      nodes: 0,
    };

  let best = actions[0],
    score = -Infinity,
    completedRoots = 0;
  for (const action of actions) {
    if (context.nodes >= context.maxNodes || now() > deadline) break;
    const next = simulate(state, action),
      turnAdvanced = next.current !== state.current,
      actor =
        action.type === "MOVE"
          ? state.pieces.find((piece) => piece.id === action.id)
          : null,
      rootDepth =
        difficulty === "medium" && has(actor, "Neocórtex Desenvolvido")
          ? Math.max(2, profile.depth)
          : profile.depth,
      remainingDepth = Math.max(0, rootDepth - (turnAdvanced ? 1 : 0));
    context.nodes++;

    let value =
      remainingDepth > 0 || next.current === state.current
        ? searchValue(next, owner, remainingDepth, context)
        : evaluateForAI(next, owner);
    value += actionPriority(state, action) * 0.08;

    if (value > score) {
      score = value;
      best = action;
    }
    completedRoots++;
  }

  if (stats && typeof stats === "object")
    Object.assign(stats, {
      nodes: context.nodes,
      completedRoots,
      depth: profile.depth,
      branchWidth: profile.branchWidth,
      budget: profile.budget,
    });
  return best;
}
