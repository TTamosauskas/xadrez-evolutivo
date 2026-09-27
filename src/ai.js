import { legalActions, movesFor, actionsForPiece } from "./moves.js";
import { simulate } from "./engine.js";
import {
  has,
  other,
  square,
  distance,
  canPhotosynthesize,
  CHESS_PIECE_VALUES,
} from "./constants.js";
import {
  eggAt,
  barrierAt,
  organicResidueAt,
  carcassAt,
  captureDisturbanceAt,
  lethalHazardAt,
  reproductionReady,
} from "./state.js";
import {
  canUseBasalFertility,
  predatoryReproductionAvailable,
} from "./reproduction-traits.js";
import { corticalActionBonus } from "./positioning.js";
import { NEGATIVE_TRAITS } from "./geology.js";
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
    (other) =>
      other.id !== piece.id &&
      other.r === action.r &&
      other.c === action.c,
  );
  if (occupied) return 0;
  const moved = { ...piece, r: action.r, c: action.c },
    hypothetical = {
      ...state,
      chain: null,
      pieces: state.pieces.map((other) =>
        other.id === piece.id ? moved : other,
      ),
    };
  return movesFor(hypothetical, moved, { ignoreChain: true }).filter(
    (target) => {
      if (!target.capture) return false;
      const victim = hypothetical.pieces.find(
        (other) =>
          other.id !== moved.id &&
          other.r === target.r &&
          other.c === target.c,
      );
      return victim && victim.owner !== moved.owner;
    },
  ).length;
}

export function crowdingPenalty(count) {
  return count > 12 ? Math.min(36, (count - 12) * 2) : 0;
}
export function actionPriority(state, a) {
  if (a.type === "CHEMOSYNTHESIS") return 11;
  if (a.type === "EXTENDED_CAPTURE") {
    const target = state.pieces.find((piece) => piece.id === a.targetId);
    return (a.trait === "Tromba" ? 15 : 12) + (target?.rank ?? 0) * 2;
  }
  if (a.type === "RHIZOME") return 8;
  if (a.type === "HEMATOPHAGY") {
    const actor = state.pieces.find((piece) => piece.id === a.id),
      target = state.pieces.find((piece) => piece.id === a.targetId);
    return (actor?.autotomyRecovery ? 22 : 13) + (target?.rank ?? 0);
  }
  if (a.type === "BROOD_PARASITIZE") {
    const target = state.pieces.find((piece) => piece.id === a.targetId);
    return 10 + (target?.rank ?? 0);
  }
  if (a.type === "REJECT_BROOD_PARASITE") return 11;
  if (a.type === "ELECTRODISCHARGE") {
    const target = state.pieces.find((piece) => piece.id === a.targetId);
    return 18 + (target?.rank ?? 0) * 2;
  }
  if (a.type === "FEEDING_REACH") {
    const target = state.pieces.find((piece) => piece.id === a.targetId);
    return 14 + (target?.rank ?? 0) * 2;
  }
  if (a.type === "BIO_PROJECTILE") {
    const target = state.pieces.find((piece) => piece.id === a.targetId);
    return 7 + (target?.rank ?? 0);
  }
  if (a.type === "BUD") return 12;
  if (a.type === "PUPATE") {
    const piece = state.pieces.find((candidate) => candidate.id === a.id);
    return 7 + (piece?.rank ?? 0) * 2;
  }
  if (a.type === "PARTNER")
    return state.pieces.find((p) => p.id === a.id)?.rank * 2 || 0;
  if (a.type === "PARTHENOGENESIS") return 8;
  if (a.type === "AGGRESSIVE_MATE")
    return 8 + (state.pieces.find((p) => p.id === a.id)?.rank ?? 0);
  if (a.type === "NURSE") {
    const child = state.pieces.find((piece) => piece.id === a.childId);
    return 6 + (child?.rank ?? 0);
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
    const enemies = state.pieces.filter(
        (piece) => piece.owner !== state.current,
      ),
      safety = enemies.length
        ? Math.min(
            6,
            Math.min(
              ...enemies.map((enemy) =>
                distance({ r: a.r, c: a.c }, enemy),
              ),
            ),
          )
        : 3;
    return 6 + free * 2 + safety;
  }
  if (a.type === "NICHE_BUILD") return 4;
  if (a.type === "BUILD") return 3;
  if (a.type === "SKIP_BUILD") return 0;
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
        ? Math.min(12, futureCaptureOptions(state, p, a) * 4)
        : 0,
    captureValue = enemyVictim
      ? 10 +
        victim.rank * 2 +
        (has(victim, "Fotossíntese") ? 8 : 0) +
        (predatoryReproductionAvailable(p, victim) ? 6 : 0) +
        (targetTerrain === "fertile" ? 4 : 0) +
        (enemies.length <= 2 ? 30 : 0)
      : 0,
    cannibalValue = alliedVictim
      ? ownPopulation > 12
        ? 4 + (ownPopulation - 12) * 2 - victim.rank
        : -8 - victim.rank
      : 0,
    fertileValue =
      !victim && targetTerrain === "fertile" && canUseBasalFertility(state, p)
        ? 4
        : 0,
    fecalValue =
      p && targetCell !== null && organicResidueAt(state, a.r, a.c)
        ? canPhotosynthesize(p)
          ? 8
          : has(p, "Coprofagia")
            ? 6
            : -8
        : 0,
    carcassValue =
      p && targetCell !== null && carcassAt(state, a.r, a.c)
        ? has(p, "Necrófago")
          ? 8
          : has(p, "Onívoro Oportunista")
            ? 6
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
      targetCell !== null && lethalHazardAt(state, a.r, a.c) ? 10000 : 0;
  return (
    familyReproductionBonus +
    hunt +
    captureValue +
    cannibalValue +
    fertileValue +
    fecalValue +
    carcassValue +
    corticalActionBonus(state, a) +
    (egg && egg.owner !== state.current ? 6 + egg.brood.length : 0) -
    (targetTerrain === "hostile" && !has(p, "Dormência") ? 8 : 0) -
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
    const negatives = (piece.traits ?? []).filter((trait) =>
        NEGATIVE_TRAITS.has(trait),
      ).length,
      positives = (piece.traits ?? []).length - negatives,
      bestMove = bestMoveSuggestion(state, piece),
      vector = [
        reproductionReady(state, piece) ? 0 : 1,
        -(CHESS_PIECE_VALUES[piece.rank] ?? 1),
        negatives,
        -positives,
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

function evaluate(state, owner) {
  if (state.result)
    return state.result.winner === owner
      ? 100000
      : state.result.winner
        ? -100000
        : 0;
  const pieces = state.pieces.reduce(
      (n, p) =>
        n +
        (p.owner === owner ? 1 : -1) *
          (12 +
            p.rank * 2 +
            p.traits.length +
            (p.infection ? -6 : 0) +
            Math.min(3, p.seeds) +
            Math.min(
              4,
              (p.pregnancies ?? []).reduce(
                (sum, pregnancy) => sum + pregnancy.brood.length,
                0,
              ),
            )),
      0,
    ),
    eggs = state.eggs.reduce(
      (n, egg) =>
        n +
        (egg.owner === owner ? 1 : -1) * (1 + Math.min(2, egg.brood.length)),
      0,
    );
  const population = {
      own: state.pieces.filter((piece) => piece.owner === owner).length,
      enemy: state.pieces.filter((piece) => piece.owner !== owner).length,
    },
    crowding = crowdingPenalty;
  return pieces + eggs - crowding(population.own) + crowding(population.enemy);
}
/** Bounded search runs only inside a worker. The UI has its own independent timeout. */
export function chooseAction(
  state,
  difficulty = "medium",
  { now = () => performance.now(), budget = 180, maxNodes = 300 } = {},
) {
  const actions = legalActions(state).sort(
    (a, b) => actionPriority(state, b) - actionPriority(state, a),
  );
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
  const deadline = now() + budget,
    owner = state.current;
  let best = actions[0],
    score = -Infinity,
    nodes = 0;
  for (const action of actions) {
    if (nodes >= maxNodes || now() > deadline) break;
    const next = simulate(state, action);
    nodes++;
    let value = evaluate(next, owner);
    const actor =
      action.type === "MOVE"
        ? state.pieces.find((piece) => piece.id === action.id)
        : null;
    if (
      (difficulty === "hard" || has(actor, "Neocórtex Desenvolvido")) &&
      !next.result
    ) {
      const replies = legalActions(next)
        .sort((a, b) => actionPriority(next, b) - actionPriority(next, a))
        .slice(0, 8);
      let replyScore = next.current === other(owner) ? Infinity : -Infinity;
      for (const reply of replies) {
        if (nodes >= maxNodes || now() > deadline) break;
        const v = evaluate(simulate(next, reply), owner);
        nodes++;
        replyScore =
          next.current === other(owner)
            ? Math.min(replyScore, v)
            : Math.max(replyScore, v);
      }
      if (Number.isFinite(replyScore)) value = replyScore;
    }
    value += actionPriority(state, action) * 0.1;
    if (value > score) {
      score = value;
      best = action;
    }
  }
  return best;
}
