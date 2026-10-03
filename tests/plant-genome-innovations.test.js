import test from "node:test";
import assert from "node:assert/strict";
import { TRAITS, TRAIT_DETAILS } from "../src/constants.js";
import {
  createState,
  newPiece,
  photosynthesisDelayTurns,
  terrain,
} from "../src/state.js";
import { context, transition } from "../src/engine.js";
import { movesFor } from "../src/moves.js";
import { reproduce } from "../src/reproduction.js";
import { traitUnlocked } from "../src/geology.js";

function stateAt(stage = "devonian", seed = 1601) {
  const state = createState(seed, {
    geologicalStage: stage,
    naturalBarriers: false,
  });
  state.board.fill("neutral");
  state.pieces = [];
  state.nextId = 1;
  state.current = "blue";
  state.phase = "move";
  state.result = null;
  state.passiveEffects = [];
  state.disableReproductiveSuccessPressure = true;
  return state;
}

function plantTraits(extra = []) {
  return [
    "Respiração anaeróbia",
    "Reparo Celular",
    "Eucarionte",
    "Multicelularismo",
    "Fotossíntese",
    "Embriófitas",
    "Traqueófitas",
    ...extra,
  ];
}

test("Traqueófitas usa 🪈 e os novos ícones são distintos", () => {
  assert.equal(TRAITS["Traqueófitas"][0], "🪈");
  assert.equal(TRAITS.Micorrizas[0], "🧶");
  assert.equal(TRAITS.Megafilos[0], "🍃");
  assert.equal(TRAITS.Poliploidia[0], "♊");
  assert.equal(new Set(["🪈", "🧶", "🍃", "♊"]).size, 4);
});

test("novas mutações possuem conteúdo Na vida e No jogo", () => {
  for (const trait of ["Micorrizas", "Megafilos", "Poliploidia"]) {
    assert.ok(TRAIT_DETAILS[trait]?.life);
    assert.ok(TRAIT_DETAILS[trait]?.game);
  }
});

test("multicelularidade acrescenta 2 turnos à Fotossíntese e Megafilos restaura o ritmo anterior", () => {
  const state = stateAt("devonian");
  const unicellular = {
      rank: 0,
      traits: ["Respiração anaeróbia", "Fotossíntese"],
      ancestry: ["Respiração anaeróbia", "Fotossíntese"],
    },
    multicellular = {
      rank: 4,
      traits: plantTraits(),
      ancestry: plantTraits(),
    },
    megaphyll = {
      rank: 4,
      traits: plantTraits(["Megafilos"]),
      ancestry: plantTraits(["Megafilos"]),
    };

  const basal = photosynthesisDelayTurns(state, unicellular);
  assert.equal(photosynthesisDelayTurns(state, multicellular), basal + 2);
  assert.equal(photosynthesisDelayTurns(state, megaphyll), basal);
});

test("Micorrizas oferece Casa Neutra adjacente como Vivificação e mantém o terreno", () => {
  let state = stateAt("ordovician", 1602);
  const plant = newPiece(state, "blue", 4, 4, {
    traits: [
      "Respiração anaeróbia",
      "Reparo Celular",
      "Eucarionte",
      "Multicelularismo",
      "Fotossíntese",
      "Embriófitas",
      "Micorrizas",
    ],
  });
  state.pieces.push(plant);
  plant.energy = 20;
  plant.energyCapacitySnapshot = 20;

  const target = movesFor(state, plant).find((candidate) => candidate.mycorrhiza);
  assert.ok(target);
  assert.equal(terrain(state, target.r, target.c), "neutral");

  state = transition(state, {
    type: "MOVE",
    id: plant.id,
    r: target.r,
    c: target.c,
  });

  const survivor = state.pieces.find((piece) => piece.id === plant.id);
  assert.ok(survivor);
  assert.equal(terrain(state, target.r, target.c), "neutral");
  assert.ok((survivor.mycorrhizaReadyRound ?? 0) >= 5);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Micorrizas" &&
        effect.outcome === "mycorrhizal-vivification",
    ),
  );
});

test("Micorrizas, Megafilos e Poliploidia permanecem exclusivas do ramo fotossintético", () => {
  const ord = stateAt("ordovician"),
    dev = stateAt("devonian"),
    plantOrd = { traits: ["Fotossíntese", "Embriófitas"], ancestry: ["Fotossíntese", "Embriófitas"] },
    predator = { traits: ["Predação", "Multicelularismo"], ancestry: ["Predação", "Multicelularismo"] },
    plantDev = {
      traits: plantTraits(),
      ancestry: plantTraits(),
    };

  assert.equal(traitUnlocked(ord, "Micorrizas", plantOrd), true);
  assert.equal(traitUnlocked(ord, "Micorrizas", predator), false);
  assert.equal(traitUnlocked(dev, "Megafilos", plantDev), true);
  assert.equal(traitUnlocked(dev, "Poliploidia", plantDev), true);
  assert.equal(traitUnlocked(dev, "Megafilos", predator), false);
  assert.equal(traitUnlocked(dev, "Poliploidia", predator), false);
});

test("Poliploidia pode gerar no máximo uma inovação positiva extra por reprodução", () => {
  let observed = false;
  for (let seed = 1; seed < 2000 && !observed; seed++) {
    const state = stateAt("devonian", seed),
      parent = newPiece(state, "blue", 4, 4, {
        traits: plantTraits(["Poliploidia"]),
      });
    state.pieces.push(parent);
    parent.energy = 30;
    parent.energyCapacitySnapshot = 30;
    reproduce(context(state), parent, null, "teste Poliploidia", {
      forcedCount: 3,
      immediateDevelopment: true,
      ignoreReadiness: true,
      ignoreSuccessPressure: true,
    });
    const effects = state.passiveEffects.filter(
      (effect) => effect.trait === "Poliploidia",
    );
    assert.ok(effects.length <= 1);
    if (effects.length === 1) observed = true;
  }
  assert.equal(observed, true);
});
