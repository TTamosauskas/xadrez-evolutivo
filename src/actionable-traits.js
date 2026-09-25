import { has, distance, square } from "./constants.js";
import {
  at,
  eggAt,
  plantSeedAt,
  barrierAt,
  naturalBarrierAt,
  eventBarrierAt,
  terrain,
  reproductionReady,
  photosynthesisAvailable,
  organicResidueAt,
  carcassAt,
  round,
  lethalHazardAt,
} from "./state.js";
import {
  movesFor,
  actionsForPiece,
  dormant,
  pieceActionState,
} from "./moves.js";
import {
  paedogenesisReady,
  buddingCanProgress,
  monogamySurvivalBonus,
} from "./reproduction-traits.js";

const firstExplicitTrait = (piece, traits) =>
  traits.find((trait) => (piece?.traits ?? []).includes(trait)) ?? null;

function photosynthesisStationaryContext(state, piece) {
  const context = {
    extra: false,
    alliedExtra: false,
    barrierSupport: barrierAt(state, piece.r, piece.c),
  };
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = piece.r + dr,
        c = piece.c + dc;
      if (
        r < 0 ||
        r >= 8 ||
        c < 0 ||
        c >= 8 ||
        terrain(state, r, c) !== "neutral"
      )
        continue;
      const occupant = at(state, r, c);
      if (
        (piece.traits ?? []).includes("Angiospermas") &&
        occupant?.owner === piece.owner
      ) {
        context.extra = true;
        context.alliedExtra = true;
        continue;
      }
      if (
        !occupant &&
        !eggAt(state, r, c) &&
        !plantSeedAt(state, r, c) &&
        (!barrierAt(state, r, c) ||
          (piece.traits ?? []).includes("Trepadeira"))
      ) {
        context.extra = true;
        if (barrierAt(state, r, c)) context.barrierSupport = true;
      }
    }
  return context;
}

function addStationaryActionableTraits(state, piece, actionable) {
  if (photosynthesisAvailable(state, piece)) {
    const photosyntheticTrait = firstExplicitTrait(piece, [
      "Fotossíntese",
      "Mixotrofia",
    ]);
    if (photosyntheticTrait) actionable.add(photosyntheticTrait);

    const context = photosynthesisStationaryContext(state, piece);
    if (
      context.extra &&
      (piece.traits ?? []).includes("Embriófitas")
    )
      actionable.add("Embriófitas");
    if (
      context.alliedExtra &&
      (piece.traits ?? []).includes("Angiospermas")
    )
      actionable.add("Angiospermas");
    if (
      context.barrierSupport &&
      (piece.traits ?? []).includes("Trepadeira")
    )
      actionable.add("Trepadeira");
  }

  const cell = square(piece.r, piece.c);
  if (
    (piece.traits ?? []).includes("Extremófitas") &&
    terrain(state, piece.r, piece.c) === "hostile" &&
    !state.event?.hazards?.includes(cell) &&
    !(state.extremophyteFertility ?? []).some(
      (entry) => entry.cell === cell,
    )
  )
    actionable.add("Extremófitas");

  if (
    (piece.traits ?? []).includes("Dormência") &&
    dormant(state, piece)
  )
    actionable.add("Dormência");

  if (buddingCanProgress(state, piece))
    actionable.add("Brotamento");
}

export function actionableTraitsForPiece(state, piece) {
  const actionable = new Set();
  if (
    !piece ||
    state.result ||
    state.phase !== "move" ||
    piece.owner !== state.current
  )
    return actionable;

  addStationaryActionableTraits(state, piece, actionable);

  const actions = actionsForPiece(state, piece);
  if (!actions.length) return actionable;

  const targets = movesFor(state, piece),
    reproductiveReady =
      reproductionReady(state, piece) || paedogenesisReady(state, piece),
    locomotionTrait = firstExplicitTrait(piece, [
      "Locomoção Terrestre",
      "Locomoção Articulada",
      "Locomoção Primitiva",
    ]),
    respiratoryTrait = firstExplicitTrait(piece, [
      "Respiração aeróbia",
      "Respiração anaeróbia",
    ]),
    hasDetritusAt = (r, c) =>
      !!organicResidueAt(state, r, c) || !!carcassAt(state, r, c);

  if (
    locomotionTrait &&
    targets.some(
      (target) =>
        !target.capture &&
        !target.eggCapture &&
        !target.stay &&
        !at(state, target.r, target.c),
    )
  )
    actionable.add(locomotionTrait);

  for (const target of targets) {
    const victim = at(state, target.r, target.c);

    if (target.botanicalPredation)
      actionable.add(target.botanicalPredation);
    if (target.cannibal) actionable.add("Canibalismo");

    if (target.eggCapture) {
      const eggTrait = firstExplicitTrait(piece, [
        "Ovífagia",
        "Onívoro Oportunista",
      ]);
      if (eggTrait) actionable.add(eggTrait);
    }

    if (
      target.capture &&
      victim &&
      victim.owner !== piece.owner &&
      !target.botanicalPredation
    ) {
      const captureTrait = firstExplicitTrait(piece, [
        "Predação",
        "Mixotrofia",
      ]);
      if (captureTrait) actionable.add(captureTrait);

      if (
        distance(piece, victim) > 1 &&
        (piece.traits ?? []).includes("Percepção Espacial")
      )
        actionable.add("Percepção Espacial");
      if (
        distance(piece, victim) > 1 &&
        has(victim, "Camuflagem") &&
        (piece.traits ?? []).includes("Visão Binocular")
      )
        actionable.add("Visão Binocular");
      if (
        has(victim, "Notívago") &&
        (round(state) + 1) % 2 === 0 &&
        (piece.traits ?? []).includes("Visão Noturna")
      )
        actionable.add("Visão Noturna");
      if (
        has(victim, "Velocidade") &&
        (piece.traits ?? []).includes("Velocidade")
      )
        actionable.add("Velocidade");
      if (
        has(victim, "Pele grossa") &&
        (piece.traits ?? []).includes("Presas")
      )
        actionable.add("Presas");
      if (
        has(victim, "Chifre") &&
        (piece.traits ?? []).includes("Carapaça")
      )
        actionable.add("Carapaça");

      if (reproductiveReady) {
        const photosyntheticPrey = has(victim, "Fotossíntese");
        if ((piece.traits ?? []).includes("Onívoro"))
          actionable.add("Onívoro");
        else if (
          !photosyntheticPrey &&
          (piece.traits ?? []).includes("Carnívoro")
        )
          actionable.add("Carnívoro");
        else if (
          photosyntheticPrey &&
          (piece.traits ?? []).includes("Herbívoro")
        )
          actionable.add("Herbívoro");
      }
    }

    if (target.cutaneous) actionable.add("Respiração Cutânea");
    if (target.vascular) actionable.add("Traqueófitas");

    if (
      target.stay &&
      !target.capture &&
      !target.cutaneous &&
      !target.vascular
    ) {
      if (respiratoryTrait) actionable.add(respiratoryTrait);
      if (
        (piece.traits ?? []).includes("Respiração Pulmonar") &&
        (piece.traits ?? []).includes("Locomoção Terrestre")
      )
        actionable.add("Respiração Pulmonar");
      if (
        (piece.traits ?? []).includes("Coletor") &&
        (piece.seeds ?? 0) > 0 &&
        terrain(state, piece.r, piece.c) !== "fertile"
      )
        actionable.add("Coletor");
    }

    if (reproductiveReady && carcassAt(state, target.r, target.c)) {
      const scavengerTrait = firstExplicitTrait(piece, [
        "Necrófago",
        "Onívoro Oportunista",
      ]);
      if (scavengerTrait) actionable.add(scavengerTrait);
    }
    if (
      reproductiveReady &&
      organicResidueAt(state, target.r, target.c) &&
      (piece.traits ?? []).includes("Coprofagia")
    )
      actionable.add("Coprofagia");

    if (
      (piece.traits ?? []).includes("Locomoção Terrestre") &&
      !target.stay &&
      terrain(state, target.r, target.c) !== "fertile"
    )
      actionable.add("Locomoção Terrestre");

    if ((piece.traits ?? []).includes("Escavador")) {
      const crossesBarrier = (target.path ?? []).some(([r, c]) =>
        barrierAt(state, r, c),
      );
      if (crossesBarrier) actionable.add("Escavador");
    }

    if ((piece.traits ?? []).includes("Escalador")) {
      const crossesNaturalBarrier = (target.path ?? []).some(
        ([r, c]) =>
          naturalBarrierAt(state, r, c) || eventBarrierAt(state, r, c),
      );
      if (crossesNaturalBarrier) actionable.add("Escalador");
    }

    if ((piece.traits ?? []).includes("Voo")) {
      const crossesObstacle = (target.path ?? []).some(
        ([r, c]) =>
          terrain(state, r, c) === "hostile" || barrierAt(state, r, c),
      );
      if (crossesObstacle) actionable.add("Voo");
    }
  }

  for (const action of actions) {
    if (action.type === "PARTNER") actionable.add("Reprodução Sexuada");
    else if (action.type === "NURSE") actionable.add("Lactação");
    else if (action.type === "LAY_OVOVIVIPAROUS")
      actionable.add("Ovovivíparo");
    else if (action.type === "PARASITIZE") {
      const parasiteTrait = firstExplicitTrait(piece, [
        "Vetor Patógeno",
        "Parasitismo",
      ]);
      if (parasiteTrait) actionable.add(parasiteTrait);
    } else if (action.type === "BUD") actionable.add("Brotamento");
    else if (action.type === "PUPATE") actionable.add("Metamorfose");
  }

  if (
    paedogenesisReady(state, piece) &&
    targets.some(
      (target) =>
        target.stay ||
        target.capture ||
        target.eggCapture ||
        hasDetritusAt(target.r, target.c),
    )
  )
    actionable.add("Pedogênese");

  return actionable;
}


const ACTIVE_WAIT_TRAITS = Object.freeze({
  "Dormência em terreno hostil": "Dormência",
  Metamorfose: "Metamorfose",
  "Recuperação por Regeneração": "Regeneração",
  "Descanso por Mutação Disfuncional": "Mutação Disfuncional",
});

function sociableGroup(state, victim) {
  if (!victim || !has(victim, "Sociabilidade")) return [];
  const eligible = state.pieces.filter(
      (piece) =>
        piece.owner === victim.owner && has(piece, "Sociabilidade"),
    ),
    seen = new Set([victim.id]),
    queue = [victim];
  while (queue.length) {
    const current = queue.shift();
    for (const piece of eligible)
      if (!seen.has(piece.id) && distance(current, piece) === 1) {
        seen.add(piece.id);
        queue.push(piece);
      }
  }
  return eligible.filter((piece) => seen.has(piece.id));
}

function addActiveStateTraits(state, piece, traits) {
  const actionState = pieceActionState(state, piece),
    waitingTrait = ACTIVE_WAIT_TRAITS[actionState.reason];
  if (waitingTrait && has(piece, waitingTrait))
    traits.add(waitingTrait);

  const cell = square(piece.r, piece.c);
  if (
    (piece.traits ?? []).includes("Extremófitas") &&
    terrain(state, piece.r, piece.c) === "hostile" &&
    !state.event?.hazards?.includes(cell) &&
    !(state.extremophyteFertility ?? []).some(
      (entry) => entry.cell === cell,
    )
  )
    traits.add("Extremófitas");

  if (buddingCanProgress(state, piece)) traits.add("Brotamento");

  if (
    state.phase === "social-defense" &&
    state.socialDefense?.memberIds?.includes(piece.id) &&
    has(piece, "Sociabilidade")
  )
    traits.add("Sociabilidade");
}

function stateWithoutCamouflage(state, victim) {
  const replacement = {
    ...victim,
    traits: (victim.traits ?? []).filter((trait) => trait !== "Camuflagem"),
    somaticMutations: (victim.somaticMutations ?? []).filter(
      (trait) => trait !== "Camuflagem",
    ),
  };
  return {
    ...state,
    pieces: state.pieces.map((piece) =>
      piece.id === victim.id ? replacement : piece,
    ),
  };
}

function camouflageBlocksCurrentAttack(state, victim, attackers) {
  if (
    !has(victim, "Camuflagem") ||
    victim.owner === state.current
  )
    return false;
  const unmasked = stateWithoutCamouflage(state, victim);
  return attackers.some((attacker) => {
    if (
      has(attacker, "Visão Binocular") ||
      distance(attacker, victim) <= 1
    )
      return false;
    return movesFor(unmasked, attacker).some(
      (target) =>
        target.capture &&
        target.r === victim.r &&
        target.c === victim.c,
    );
  });
}

const CAUSAL_ACTION_TRAITS = Object.freeze([
  "Escalador",
  "Voo",
  "Locomoção Terrestre",
  "Percepção Espacial",
  "Visão Binocular",
]);

function stateWithPiece(state, piece) {
  return {
    ...state,
    pieces: state.pieces.map((candidate) =>
      candidate.id === piece.id ? piece : candidate,
    ),
  };
}

function withoutActiveTrait(piece, trait) {
  return {
    ...piece,
    traits: (piece.traits ?? []).filter((candidate) => candidate !== trait),
    somaticMutations: (piece.somaticMutations ?? []).filter(
      (candidate) => candidate !== trait,
    ),
  };
}

function moveFingerprint(target) {
  return JSON.stringify({
    r: target.r,
    c: target.c,
    path: target.path ?? [],
    capture: !!target.capture,
    cannibal: !!target.cannibal,
    eggCapture: target.eggCapture ?? null,
    botanicalPredation: target.botanicalPredation ?? null,
    stay: !!target.stay,
    cutaneous: !!target.cutaneous,
    vascular: !!target.vascular,
  });
}

function actionFingerprint(action) {
  return JSON.stringify({
    type: action.type,
    id: action.id ?? null,
    parentId: action.parentId ?? null,
    childId: action.childId ?? null,
    targetId: action.targetId ?? null,
    r: action.r ?? null,
    c: action.c ?? null,
  });
}

function legalPossibilityFingerprint(state, piece) {
  return JSON.stringify({
    moves: movesFor(state, piece).map(moveFingerprint).sort(),
    actions: actionsForPiece(state, piece).map(actionFingerprint).sort(),
  });
}

function flightHasIndependentEnvironmentalEffect(state, piece) {
  if (!has(piece, "Voo")) return false;
  return movesFor(state, piece).some((target) =>
    (target.path ?? []).some(([r, c]) => {
      const landing = r === target.r && c === target.c;
      return (
        !landing &&
        (terrain(state, r, c) === "hostile" ||
          lethalHazardAt(state, r, c))
      );
    }),
  );
}

function pruneRedundantActionTraits(state, piece, contextual) {
  if (!piece || !contextual?.size) return contextual;

  let workingPiece = piece,
    workingState = state;
  for (const trait of CAUSAL_ACTION_TRAITS) {
    if (!contextual.has(trait) || !has(workingPiece, trait)) continue;

    // Voo também altera o risco ambiental de trajetórias hostis/letais,
    // mesmo quando outra mutação já oferece o mesmo destino legal.
    if (
      trait === "Voo" &&
      flightHasIndependentEnvironmentalEffect(workingState, workingPiece)
    )
      continue;

    const baseline = legalPossibilityFingerprint(workingState, workingPiece),
      candidatePiece = withoutActiveTrait(workingPiece, trait),
      candidateState = stateWithPiece(workingState, candidatePiece),
      candidate = legalPossibilityFingerprint(candidateState, candidatePiece);

    if (candidate !== baseline) continue;
    contextual.delete(trait);
    workingPiece = candidatePiece;
    workingState = candidateState;
  }
  return contextual;
}

function markCaptureContext(state, attacker, victim, byId) {
  const attackerTraits = byId.get(attacker.id),
    victimTraits = byId.get(victim.id);
  if (!attackerTraits || !victimTraits) return;

  if (has(victim, "Espinhos")) victimTraits.add("Espinhos");

  if (has(victim, "Chifre")) {
    victimTraits.add("Chifre");
    if (has(attacker, "Carapaça")) attackerTraits.add("Carapaça");
  }

  if (
    has(victim, "Mimetismo") &&
    state.pieces.some(
      (piece) => piece.id !== victim.id && distance(piece, victim) === 1,
    )
  )
    victimTraits.add("Mimetismo");

  if (victim.owner !== attacker.owner) {
    const social = sociableGroup(state, victim);
    if (social.length >= 4)
      for (const member of social)
        byId.get(member.id)?.add("Sociabilidade");

    const nocturnal =
      has(victim, "Notívago") && (round(state) + 1) % 2 === 0;
    if (nocturnal) {
      victimTraits.add("Notívago");
      if (has(attacker, "Visão Noturna"))
        attackerTraits.add("Visão Noturna");
    }

    const nocturnalEvasion =
      nocturnal && !has(attacker, "Visão Noturna");
    if (!nocturnalEvasion && has(victim, "Velocidade")) {
      victimTraits.add("Velocidade");
      if (has(attacker, "Velocidade"))
        attackerTraits.add("Velocidade");
    }

    if (has(victim, "Pele grossa")) {
      victimTraits.add("Pele grossa");
      if (has(attacker, "Presas")) attackerTraits.add("Presas");
    }

    if (has(victim, "Madeira")) victimTraits.add("Madeira");
    if (monogamySurvivalBonus(state, victim) > 0)
      victimTraits.add("Monogamia");
  }

  if (has(victim, "Veneno")) victimTraits.add("Veneno");
  if (has(victim, "Fragmentação")) victimTraits.add("Fragmentação");
  if (has(victim, "Ooteca") && victim.oothecaPrimed)
    victimTraits.add("Ooteca");

  if (
    has(victim, "Camuflagem") &&
    distance(attacker, victim) > 1
  ) {
    victimTraits.add("Camuflagem");
    if (has(attacker, "Visão Binocular"))
      attackerTraits.add("Visão Binocular");
  }
}

export function contextualTraitsForBoard(state) {
  const byId = new Map(
    (state?.pieces ?? []).map((piece) => [piece.id, new Set()]),
  );
  if (!state) return byId;

  for (const piece of state.pieces ?? []) {
    const traits = byId.get(piece.id);
    addActiveStateTraits(state, piece, traits);
    if (
      !state.result &&
      state.phase === "move" &&
      piece.owner === state.current
    )
      for (const trait of actionableTraitsForPiece(state, piece))
        traits.add(trait);
    pruneRedundantActionTraits(state, piece, traits);
  }

  if (state.result || state.phase !== "move") return byId;

  const attackers = (state.pieces ?? []).filter(
    (piece) => piece.owner === state.current,
  );
  for (const attacker of attackers)
    for (const target of movesFor(state, attacker)) {
      if (!target.capture) continue;
      const victim = at(state, target.r, target.c);
      if (victim && victim.id !== attacker.id)
        markCaptureContext(state, attacker, victim, byId);
    }

  for (const victim of state.pieces ?? [])
    if (camouflageBlocksCurrentAttack(state, victim, attackers))
      byId.get(victim.id)?.add("Camuflagem");

  return byId;
}
