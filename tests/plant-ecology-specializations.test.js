import test from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  newPiece,
  photosynthesisAvailable,
  reproductionReady,
} from "../src/state.js";
import { context, transition } from "../src/engine.js";
import {
  actionsForPiece,
  movesFor,
  partnersFor,
  vivificationActionsForPiece,
} from "../src/moves.js";
import { reproductionEnergyCost } from "../src/energy.js";
import { reproduce } from "../src/reproduction.js";
import { distance } from "../src/constants.js";

function blankState(seed = 1200, stage = "eocene") {
  const state = createState(seed, {
    geologicalStage: stage,
    naturalBarriers: false,
  });
  state.board.fill("neutral");
  state.pieces = [];
  state.nextId = 1;
  state.current = "blue";
  state.turn = 0;
  state.phase = "move";
  state.notices = [];
  state.result = null;
  state.plantSeeds = [];
  state.nextPlantSeed = 1;
  state.passiveEffects = [];
  state.disableReproductiveSuccessPressure = true;
  return state;
}

function plantTraits(extra = []) {
  return [
    "Respiração anaeróbia",
    "Fotossíntese",
    "Multicelularismo",
    "Embriófitas",
    "Traqueófitas",
    "Gimnospermas",
    "Angiospermas",
    ...extra,
  ];
}

function animalTraits(extra = []) {
  return [
    "Respiração anaeróbia",
    "Predação",
    "Multicelularismo",
    "Ingestão",
    "Simetria Bilateral",
    "Locomoção Primitiva",
    "Artrópode",
    "Locomoção Articulada",
    "Locomoção Terrestre",
    ...extra,
  ];
}

function lowRollSeed(firstThreshold, secondThreshold = null) {
  const next = (seed) =>
    ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let seed = 0; seed < 100000; seed++) {
    const first = next(seed);
    if (first >= firstThreshold) continue;
    if (secondThreshold === null) return seed;
    const nextSeed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    if (next(nextSeed) < secondThreshold) return seed;
  }
  throw Error("seed probabilística não encontrada");
}

test("Haustório drena fertilidade, preserva o hospedeiro e remove sua Vivificação", () => {
  let state = blankState(1201, "eocene");
  const attacker = newPiece(state, "blue", 4, 4, {
      traits: plantTraits(["Haustório"]),
    }),
    host = newPiece(state, "amber", 3, 4, {
      traits: plantTraits(),
    }),
    hostCell = host.r * 8 + host.c;
  state.pieces.push(attacker, host);
  state.board[hostCell] = "fertile";
  attacker.energy = Math.max(0, attacker.energy - 1);

  state.current = "amber";
  assert.ok(vivificationActionsForPiece(state, host).length > 0);
  state.current = "blue";

  const target = movesFor(state, attacker).find(
    (candidate) => candidate.r === host.r && candidate.c === host.c,
  );
  assert.equal(target?.haustoriumDrain, true);
  assert.equal(target?.capture, false);

  state = transition(state, {
    type: "MOVE",
    id: attacker.id,
    r: host.r,
    c: host.c,
  });

  const survivingHost = state.pieces.find((piece) => piece.id === host.id),
    survivingAttacker = state.pieces.find((piece) => piece.id === attacker.id);
  assert.ok(survivingHost);
  assert.deepEqual(
    [survivingAttacker.r, survivingAttacker.c],
    [attacker.r, attacker.c],
  );
  assert.equal(state.board[hostCell], "neutral");
  assert.equal(vivificationActionsForPiece(state, survivingHost).length, 0);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Haustório" &&
        effect.outcome === "drained-host-fertility",
    ),
  );
});

test("Hemiepifitismo usa a geometria da forma para capturar fotossintéticos sem Vivificação predatória", () => {
  let state = blankState(1202, "eocene");
  const attacker = newPiece(state, "blue", 4, 2, {
      rank: 3,
      traits: plantTraits(["Trepadeira", "Hemiepifitismo"]),
    }),
    host = newPiece(state, "amber", 4, 6, {
      rank: 3,
      traits: plantTraits(),
    });
  state.pieces.push(attacker, host);

  const target = movesFor(state, attacker).find(
    (candidate) => candidate.r === host.r && candidate.c === host.c,
  );
  assert.equal(target?.botanicalCapture, "Hemiepifitismo");

  state = transition(state, {
    type: "MOVE",
    id: attacker.id,
    r: host.r,
    c: host.c,
  });
  const survivor = state.pieces.find((piece) => piece.id === attacker.id);
  assert.ok(survivor);
  assert.deepEqual([survivor.r, survivor.c], [host.r, host.c]);
  assert.equal(state.pieces.some((piece) => piece.id === host.id), false);
  assert.equal(!!survivor.predationEnergy, false);
  assert.equal(!!survivor.carnivoryNutrition, false);
});

test("Carnivoria captura heterótrofos sem deslocamento e reduz a próxima reprodução em 2 Energia", () => {
  let state = blankState(1203, "eocene");
  const carnivore = newPiece(state, "blue", 4, 4, {
      traits: plantTraits(["Carnivoria"]),
    }),
    prey = newPiece(state, "amber", 4, 5, {
      rank: 4,
      traits: animalTraits(),
    });
  state.pieces.push(carnivore, prey);

  const baseline = reproductionEnergyCost(carnivore);
  const target = movesFor(state, carnivore).find(
    (candidate) => candidate.r === prey.r && candidate.c === prey.c,
  );
  assert.equal(target?.botanicalPredation, "Carnivoria");

  state = transition(state, {
    type: "MOVE",
    id: carnivore.id,
    r: prey.r,
    c: prey.c,
  });
  const survivor = state.pieces.find((piece) => piece.id === carnivore.id);
  assert.deepEqual([survivor.r, survivor.c], [4, 4]);
  assert.equal(state.pieces.some((piece) => piece.id === prey.id), false);
  assert.equal(survivor.carnivoryNutrition, true);
  assert.equal(reproductionEnergyCost(survivor), Math.max(0, baseline - 2));

  survivor.energy = 20;
  survivor.energyCapacitySnapshot = 20;
  reproduce(context(state), survivor, null, "teste Carnivoria", {
    forcedCount: 1,
    immediateDevelopment: true,
    ignoreReadiness: true,
    ignoreSuccessPressure: true,
  });
  assert.equal(!!survivor.carnivoryNutrition, false);
});

test("Mimetismo Sexual usa um Artrópode como ponte espacial entre plantas compatíveis", () => {
  const state = blankState(1204, "eocene"),
    focal = newPiece(state, "blue", 4, 1, {
      traits: plantTraits([
        "Reprodução Sexuada",
        "Perfume Floral",
        "Polinização Deceptiva",
        "Mimetismo Sexual",
      ]),
    }),
    pollinator = newPiece(state, "amber", 4, 3, {
      rank: 1,
      traits: animalTraits(),
    }),
    mate = newPiece(state, "blue", 4, 5, {
      traits: plantTraits(["Reprodução Sexuada"]),
    });
  state.pieces.push(focal, pollinator, mate);
  state.board[focal.r * 8 + focal.c] = "fertile";

  assert.equal(distance(focal, mate), 4);
  assert.equal(distance(focal, pollinator), 2);
  assert.equal(distance(pollinator, mate), 2);
  assert.ok(partnersFor(state, focal).some((piece) => piece.id === mate.id));

  focal.traits = focal.traits.filter((trait) => trait !== "Mimetismo Sexual");
  assert.equal(partnersFor(state, focal).some((piece) => piece.id === mate.id), false);
});

test("Sismonastia bloqueia 25% das capturas e fecha temporariamente reprodução e Fotossíntese", () => {
  const base = blankState(1205, "eocene"),
    attacker = newPiece(base, "blue", 4, 4, {
      rank: 4,
      traits: animalTraits(),
    }),
    victim = newPiece(base, "amber", 3, 4, {
      traits: plantTraits(["Tropismo", "Sismonastia"]),
    });
  base.pieces.push(attacker, victim);

  let state = null;
  for (let seed = 1; seed < 20000 && !state; seed++) {
    const probe = structuredClone(base);
    probe.rng = seed;
    const next = transition(probe, {
      type: "MOVE",
      id: attacker.id,
      r: victim.r,
      c: victim.c,
    });
    if (
      next.passiveEffects.some(
        (effect) => effect.trait === "Sismonastia",
      )
    )
      state = next;
  }
  assert.ok(state);
  const survivor = state.pieces.find((piece) => piece.id === victim.id);
  assert.ok(survivor);
  assert.ok(Number.isInteger(survivor.sismonastiaClosedThroughTurn));
  // The blocked side can be auto-passed by ecological-domain settlement.
  assert.equal(reproductionReady(state, survivor), false);
  assert.equal(photosynthesisAvailable(state, survivor), false);
});

test("Polinização Deceptiva transforma defesa contra Artrópode em uma única prole", () => {
  const base = blankState(1206, "eocene"),
    attacker = newPiece(base, "blue", 4, 4, {
      rank: 4,
      traits: animalTraits(),
    }),
    victim = newPiece(base, "amber", 3, 4, {
      traits: plantTraits([
        "Madeira",
        "Reprodução Sexuada",
        "Perfume Floral",
        "Polinização Deceptiva",
      ]),
    }),
    mate = newPiece(base, "amber", 3, 5, {
      traits: plantTraits(["Reprodução Sexuada"]),
    });
  base.pieces.push(attacker, victim, mate);
  base.board[victim.r * 8 + victim.c] = "fertile";

  let state = null;
  for (let seed = 1; seed < 30000 && !state; seed++) {
    const probe = structuredClone(base);
    probe.rng = seed;
    const next = transition(probe, {
      type: "MOVE",
      id: attacker.id,
      r: victim.r,
      c: victim.c,
    });
    if (
      next.passiveEffects.some(
        (effect) =>
          effect.trait === "Polinização Deceptiva" &&
          effect.outcome === "deceptive-pollination",
      )
    )
      state = next;
  }

  assert.ok(state);
  assert.ok(state.pieces.some((piece) => piece.id === victim.id));
  const offspringCount =
    state.plantSeeds.filter((seed) => seed.parentId === victim.id).length +
    state.pieces.filter((piece) => piece.parentId === victim.id).length;
  assert.equal(offspringCount, 1);
});

test("Armadilha Deceptiva pode contracapturar um agressor após uma defesa bem-sucedida", () => {
  const base = blankState(1207, "miocene"),
    attacker = newPiece(base, "blue", 4, 4, {
      rank: 4,
      traits: animalTraits(),
    }),
    victim = newPiece(base, "amber", 3, 4, {
      traits: plantTraits([
        "Madeira",
        "Carnivoria",
        "Perfume Floral",
        "Armadilha Deceptiva",
      ]),
    });
  base.pieces.push(attacker, victim);

  let state = null;
  for (let seed = 1; seed < 30000 && !state; seed++) {
    const probe = structuredClone(base);
    probe.rng = seed;
    const next = transition(probe, {
      type: "MOVE",
      id: attacker.id,
      r: victim.r,
      c: victim.c,
    });
    if (
      next.passiveEffects.some(
        (effect) =>
          effect.trait === "Armadilha Deceptiva" &&
          effect.outcome === "countercaptured-attacker",
      )
    )
      state = next;
  }

  assert.ok(state);
  const survivor = state.pieces.find((piece) => piece.id === victim.id);
  assert.ok(survivor);
  assert.equal(state.pieces.some((piece) => piece.id === attacker.id), false);
  assert.equal(survivor.carnivoryNutrition, true);
});

test("Monocarpismo acumula Vivificação e converte quatro cargas em até 10 sementes a alcance 3", () => {
  let state = blankState(1208, "eocene");
  const plant = newPiece(state, "blue", 4, 4, {
      traits: plantTraits(["Reprodução Sexuada", "Monocarpismo"]),
    }),
    reserve = newPiece(state, "amber", 0, 0, {
      rank: 4,
      traits: animalTraits(),
    });
  state.pieces.push(plant, reserve);
  state.board[plant.r * 8 + plant.c] = "fertile";

  assert.ok(
    actionsForPiece(state, plant).some(
      (action) => action.type === "MONOCARP_STORE",
    ),
  );
  state = transition(state, { type: "MONOCARP_STORE", id: plant.id });
  let stored = state.pieces.find((piece) => piece.id === plant.id);
  assert.equal(stored.monocarpismCharges, 1);

  stored.monocarpismCharges = 4;
  state.current = "blue";
  state.phase = "move";
  state.turn += 2;
  assert.ok(
    actionsForPiece(state, stored).some(
      (action) => action.type === "MONOCARP_BLOOM",
    ),
  );

  const origin = { r: stored.r, c: stored.c };
  state = transition(state, { type: "MONOCARP_BLOOM", id: stored.id });
  assert.equal(state.pieces.some((piece) => piece.id === stored.id), false);
  assert.ok(state.plantSeeds.length > 0);
  assert.ok(state.plantSeeds.length <= 10);
  assert.ok(
    state.plantSeeds.every((seed) => distance(origin, seed) <= 3),
  );
});
