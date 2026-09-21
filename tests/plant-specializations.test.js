import test from "node:test";
import assert from "node:assert/strict";
import { createState, newPiece } from "../src/state.js";
import { context, transition } from "../src/engine.js";
import { movesFor } from "../src/moves.js";
import { tickReproduction } from "../src/reproduction.js";
import { traitUnlocked } from "../src/geology.js";

function blankState(seed = 700, stage = "paleogene") {
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
  state.extremophyteFertility = [];
  return state;
}

function plantLineage(extra = []) {
  return [
    "Multicelularismo",
    "Fotossíntese",
    "Embriófitas",
    "Traqueófitas",
    "Gimnospermas",
    "Angiospermas",
    ...extra,
  ];
}

test("photosynthetic specializations obey geological periods and lineage precedence", () => {
  const state = createState(701, {
      geologicalStage: "devonian",
      naturalBarriers: false,
    }),
    plant = {
      traits: ["Multicelularismo", "Fotossíntese", "Angiospermas"],
      ancestry: plantLineage(),
    };

  assert.equal(traitUnlocked(state, "Madeira", plant), true);
  assert.equal(traitUnlocked(state, "Extremófitas", plant), false);
  assert.equal(traitUnlocked(state, "Haustório", plant), false);
  assert.equal(traitUnlocked(state, "Perfume Floral", plant), false);
  assert.equal(traitUnlocked(state, "Carnivoria Botânica", plant), false);

  state.geologicalStage = "permian";
  assert.equal(traitUnlocked(state, "Extremófitas", plant), true);

  state.geologicalStage = "cretaceous";
  assert.equal(traitUnlocked(state, "Haustório", plant), true);
  assert.equal(traitUnlocked(state, "Perfume Floral", plant), true);
  assert.equal(traitUnlocked(state, "Carnivoria Botânica", plant), false);

  state.geologicalStage = "paleogene";
  assert.equal(traitUnlocked(state, "Carnivoria Botânica", plant), true);

  const animal = {
    traits: ["Multicelularismo", "Predação"],
    ancestry: plantLineage(["Predação"]),
  };
  assert.equal(traitUnlocked(state, "Madeira", animal), false);
  assert.equal(traitUnlocked(state, "Carnivoria Botânica", animal), false);
});

test("Haustório consumes only adjacent photosynthetic enemies and keeps the plant stationary", () => {
  const state = blankState(702),
    attacker = newPiece(state, "blue", 4, 4, {
      traits: plantLineage(["Haustório"]),
    }),
    plantPrey = newPiece(state, "amber", 3, 4, {
      traits: plantLineage(),
    }),
    animalPrey = newPiece(state, "amber", 4, 5, {
      rank: 4,
      traits: ["Multicelularismo", "Predação"],
    });
  state.pieces.push(attacker, plantPrey, animalPrey);

  const targets = movesFor(state, attacker);
  assert.ok(
    targets.some(
      (target) =>
        target.r === 3 &&
        target.c === 4 &&
        target.botanicalPredation === "Haustório",
    ),
  );
  assert.equal(
    targets.some((target) => target.r === 4 && target.c === 5),
    false,
  );

  const next = transition(state, {
    type: "MOVE",
    id: attacker.id,
    r: plantPrey.r,
    c: plantPrey.c,
  });
  const survivor = next.pieces.find((piece) => piece.id === attacker.id);
  assert.deepEqual([survivor.r, survivor.c], [4, 4]);
  assert.equal(next.pieces.some((piece) => piece.id === plantPrey.id), false);
  assert.equal(next.pieces.some((piece) => piece.id === animalPrey.id), true);
  assert.equal(next.plantSeeds.length, 1);
  assert.ok(
    next.logs.some((entry) => entry.text.includes("Haustório consumiu")),
  );
});

test("Carnivoria Botânica targets heterotrophs and ignores photosynthetic prey", () => {
  const state = blankState(703),
    attacker = newPiece(state, "blue", 4, 4, {
      traits: plantLineage(["Carnivoria Botânica"]),
    }),
    plantPrey = newPiece(state, "amber", 3, 4, {
      traits: plantLineage(),
    }),
    animalPrey = newPiece(state, "amber", 4, 5, {
      rank: 4,
      traits: ["Multicelularismo", "Predação"],
    });
  state.pieces.push(attacker, plantPrey, animalPrey);

  const targets = movesFor(state, attacker);
  assert.equal(
    targets.some((target) => target.r === 3 && target.c === 4),
    false,
  );
  assert.ok(
    targets.some(
      (target) =>
        target.r === 4 &&
        target.c === 5 &&
        target.botanicalPredation === "Carnivoria Botânica",
    ),
  );

  const next = transition(state, {
    type: "MOVE",
    id: attacker.id,
    r: animalPrey.r,
    c: animalPrey.c,
  });
  const survivor = next.pieces.find((piece) => piece.id === attacker.id);
  assert.deepEqual([survivor.r, survivor.c], [4, 4]);
  assert.equal(next.pieces.some((piece) => piece.id === animalPrey.id), false);
  assert.equal(next.pieces.some((piece) => piece.id === plantPrey.id), true);
  assert.equal(next.plantSeeds.length, 1);
});

test("Madeira blocks one quarter of capture attempts before the victim is removed", () => {
  const state = blankState(704),
    attacker = newPiece(state, "blue", 4, 4, {
      rank: 4,
      traits: ["Multicelularismo", "Predação", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada"],
    }),
    defender = newPiece(state, "amber", 3, 4, {
      traits: [
        "Multicelularismo",
        "Fotossíntese",
        "Embriófitas",
        "Traqueófitas",
        "Madeira",
      ],
    }),
    reserve = newPiece(state, "amber", 0, 0, {
      rank: 4,
      traits: ["Multicelularismo", "Predação"],
    });
  state.pieces.push(attacker, defender, reserve);
  state.rng = 0;

  const next = transition(state, {
    type: "MOVE",
    id: attacker.id,
    r: defender.r,
    c: defender.c,
  });
  const survivingAttacker = next.pieces.find((piece) => piece.id === attacker.id),
    survivingDefender = next.pieces.find((piece) => piece.id === defender.id);
  assert.deepEqual(
    [survivingAttacker.r, survivingAttacker.c],
    [attacker.r, attacker.c],
  );
  assert.ok(survivingDefender);
  assert.ok(next.turn >= 1);
  assert.ok(next.logs.some((entry) => entry.text.includes("Madeira resistiu")));
});

test("Perfume Floral guides a seed toward a refuge protected by allied heterotrophs", () => {
  const state = blankState(705),
    protector = newPiece(state, "blue", 4, 7, {
      rank: 4,
      traits: ["Multicelularismo", "Predação"],
    }),
    opponent = newPiece(state, "amber", 0, 0, {
      rank: 4,
      traits: ["Multicelularismo", "Predação"],
    });
  state.pieces.push(protector, opponent);
  state.plantSeeds.push({
    id: state.nextPlantSeed++,
    owner: "blue",
    r: 4,
    c: 4,
    parentId: null,
    profile: { traits: ["Perfume Floral"] },
    movesRemaining: 3,
  });

  tickReproduction(context(state));

  assert.equal(state.plantSeeds.length, 1);
  assert.equal(state.plantSeeds[0].c, 5);
  assert.equal(state.plantSeeds[0].movesRemaining, 2);
});

test("Extremófitas converts survived hostile terrain into temporary fertility and restores hostility when consumed", () => {
  let state = blankState(706, "permian");
  const extremophyte = newPiece(state, "blue", 4, 4, {
      traits: [
        "Multicelularismo",
        "Fotossíntese",
        "Embriófitas",
        "Extremófitas",
      ],
    }),
    opponent = newPiece(state, "amber", 0, 0, {
      rank: 4,
      traits: ["Multicelularismo", "Predação"],
    }),
    cell = 4 * 8 + 4;
  state.pieces.push(extremophyte, opponent);
  state.board[cell] = "hostile";
  state.rng = 0x80000000;

  state = transition(state, { type: "PASS" });
  assert.equal(state.board[cell], "hostile");
  assert.equal(state.pieces.find((piece) => piece.id === extremophyte.id).extremophyteSinceRound, 0);

  state = transition(state, { type: "PASS" });
  assert.equal(state.board[cell], "fertile");
  assert.deepEqual(state.extremophyteFertility, [
    { cell, base: "hostile" },
  ]);

  state.board[cell] = "neutral";
  state = transition(state, { type: "PASS" });
  assert.equal(state.board[cell], "hostile");
  assert.equal(state.extremophyteFertility.length, 0);
});
