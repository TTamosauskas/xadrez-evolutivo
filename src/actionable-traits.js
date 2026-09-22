import { has, distance, square } from "./constants.js";
import {
  at,
  barrierAt,
  naturalBarrierAt,
  eventBarrierAt,
  terrain,
  reproductionReady,
} from "./state.js";
import { movesFor, actionsForPiece } from "./moves.js";
import { paedogenesisReady } from "./reproduction-traits.js";

const firstExplicitTrait = (piece, traits) =>
  traits.find((trait) => (piece?.traits ?? []).includes(trait)) ?? null;

export function actionableTraitsForPiece(state, piece) {
  const actionable = new Set();
  if (
    !piece ||
    state.result ||
    state.phase !== "move" ||
    piece.owner !== state.current
  )
    return actionable;

  const actions = actionsForPiece(state, piece);
  if (!actions.length) return actionable;

  const targets = movesFor(state, piece),
    reproductiveReady =
      reproductionReady(state, piece) || paedogenesisReady(state, piece),
    locomotionTrait = firstExplicitTrait(piece, [
      "Locomoção Avançada",
      "Locomoção Terrestre",
      "Locomoção Articulada",
      "Locomoção Primitiva",
    ]),
    respiratoryTrait = firstExplicitTrait(piece, [
      "Respiração aeróbia",
      "Respiração anaeróbia",
    ]),
    hasDecompositionAt = (r, c) => {
      const cell = square(r, c);
      return (
        state.deathSites.some((site) => site.cell === cell) ||
        state.fertileTraces.some((trace) => trace.cell === cell)
      );
    };

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
        (piece.traits ?? []).includes("Coletor") &&
        (piece.seeds ?? 0) > 0 &&
        terrain(state, piece.r, piece.c) !== "fertile"
      )
        actionable.add("Coletor");
    }

    if (reproductiveReady && hasDecompositionAt(target.r, target.c)) {
      const scavengerTrait = firstExplicitTrait(piece, [
        "Necrófago",
        "Onívoro Oportunista",
      ]);
      if (scavengerTrait) actionable.add(scavengerTrait);
    }

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
        hasDecompositionAt(target.r, target.c),
    )
  )
    actionable.add("Pedogênese");

  return actionable;
}
