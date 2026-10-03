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

  state.geologicalStage = "permian";
  assert.equal(traitUnlocked(state, "Extremófitas", plant), true);

  state.geologicalStage = "cretaceous";
  assert.equal(traitUnlocked(state, "Haustório", plant), true);
  assert.equal(traitUnlocked(state, "Perfume Floral", plant), true);

  const animal = {
    traits: ["Multicelularismo", "Predação"],
    ancestry: plantLineage(["Predação"]),
  };
  assert.equal(traitUnlocked(state, "Madeira", animal), false);
});

test("Haustório drains fertile terrain under an adjacent photosynthetic enemy without killing it", () => {
  let state = blankState(702),
    attacker = newPiece(state, "blue", 4, 4, {
      traits: plantLineage(["Haustório"]),
    }),
    plantHost = newPiece(state, "amber", 3, 4, {
      traits: plantLineage(),
    }),
    animal = newPiece(state, "amber", 4, 5, {
      rank: 4,
      traits: ["Multicelularismo", "Predação"],
    });
  state.pieces.push(attacker, plantHost, animal);
  state.board[plantHost.r * 8 + plantHost.c] = "fertile";

  const targets = movesFor(state, attacker);
  assert.ok(
    targets.some(
      (target) =>
        target.r === plantHost.r &&
        target.c === plantHost.c &&
        target.haustoriumDrain &&
        !target.capture,
    ),
  );
  assert.equal(
    targets.some((target) => target.r === animal.r && target.c === animal.c),
    false,
  );

  state = transition(state, {
    type: "MOVE",
    id: attacker.id,
    r: plantHost.r,
    c: plantHost.c,
  });
  const survivor = state.pieces.find((piece) => piece.id === attacker.id);
  assert.deepEqual([survivor.r, survivor.c], [4, 4]);
  assert.ok(state.pieces.some((piece) => piece.id === plantHost.id));
  assert.ok(state.pieces.some((piece) => piece.id === animal.id));
  assert.equal(state.board[plantHost.r * 8 + plantHost.c], "neutral");
  assert.equal(!!survivor.predationEnergy, false);
  assert.ok(
    state.logs.some((entry) => entry.text.includes("Haustório drenou")),
  );
});

test("Madeira blocks one quarter of capture attempts before the victim is removed", () => {
  const state = blankState(704),
    attacker = newPiece(state, "blue", 4, 4, {
      rank: 4,
      traits: [
        "Multicelularismo",
        "Predação",
        "Ingestão",
        "Locomoção Primitiva",
        "Vertebrado",
        "Locomoção Terrestre",
      ],
      ancestry: [
        "Predação",
        "Locomoção Primitiva",
        "Vertebrado",
        "Locomoção Articulada",
        "Locomoção Terrestre",
      ],
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

test("seed waits three reproductive rounds, sprouts on empty fertile terrain, then establishes one round later", () => {
  const state = blankState(706, "carboniferous"),
    profile = newPiece(state, "blue", 0, 0, {
      traits: plantLineage(),
    });
  state.pieces = [];
  state.nextId = 1;
  state.board[4 * 8 + 4] = "fertile";
  state.plantSeeds.push({
    id: state.nextPlantSeed++,
    owner: "blue",
    r: 4,
    c: 4,
    parentId: null,
    profile,
    age: 0,
    movesRemaining: 3,
    sprouting: false,
    sproutReadyRound: null,
  });

  tickReproduction(context(state));
  assert.equal(state.plantSeeds[0].age, 1);
  assert.equal(state.plantSeeds[0].sprouting, false);

  state.turn = 2;
  tickReproduction(context(state));
  assert.equal(state.plantSeeds[0].age, 2);
  assert.equal(state.plantSeeds[0].sprouting, false);

  state.turn = 4;
  tickReproduction(context(state));
  assert.equal(state.plantSeeds[0].age, 3);
  assert.equal(state.plantSeeds[0].sprouting, true);
  assert.equal(state.pieces.length, 0);

  state.turn = 6;
  tickReproduction(context(state));
  assert.equal(state.plantSeeds.length, 0);
  assert.equal(state.pieces.length, 1);
  assert.deepEqual([state.pieces[0].r, state.pieces[0].c], [4, 4]);
});

test("mature seed waits under an occupant and starts sprouting after the fertile cell becomes empty", () => {
  const state = blankState(707, "carboniferous"),
    occupant = newPiece(state, "amber", 4, 4, {
      traits: ["Multicelularismo", "Predação"],
    }),
    profile = newPiece(state, "blue", 0, 0, {
      traits: plantLineage(),
    });
  state.pieces = [occupant];
  state.nextId = occupant.id + 1;
  state.board[4 * 8 + 4] = "fertile";
  state.plantSeeds.push({
    id: state.nextPlantSeed++,
    owner: "blue",
    r: 4,
    c: 4,
    parentId: null,
    profile,
    age: 3,
    movesRemaining: 0,
    sprouting: false,
    sproutReadyRound: null,
  });

  tickReproduction(context(state));
  assert.equal(state.plantSeeds[0].sprouting, false);
  assert.equal(state.pieces.length, 1);

  state.pieces = [];
  state.turn = 2;
  tickReproduction(context(state));
  assert.equal(state.plantSeeds[0].sprouting, true);

  state.turn = 4;
  tickReproduction(context(state));
  assert.equal(state.plantSeeds.length, 0);
  assert.equal(state.pieces.length, 1);
});

test("mature seed on non-fertile terrain keeps dispersing until it reaches fertile terrain", () => {
  const state = blankState(708, "carboniferous"),
    profile = newPiece(state, "blue", 0, 0, {
      traits: plantLineage(),
    });
  state.pieces = [];
  state.nextId = 1;
  state.board.fill("neutral");
  state.board[4 * 8 + 5] = "fertile";
  state.plantSeeds.push({
    id: state.nextPlantSeed++,
    owner: "blue",
    r: 4,
    c: 4,
    parentId: null,
    profile,
    age: 3,
    movesRemaining: 0,
    sprouting: false,
    sproutReadyRound: null,
  });

  tickReproduction(context(state));
  assert.deepEqual(
    [state.plantSeeds[0].r, state.plantSeeds[0].c],
    [4, 5],
  );
  assert.equal(state.plantSeeds[0].sprouting, false);

  state.turn = 2;
  tickReproduction(context(state));
  assert.equal(state.plantSeeds[0].sprouting, true);
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
