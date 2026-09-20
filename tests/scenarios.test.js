import test from "node:test";
import assert from "node:assert/strict";
import { EVENTS } from "../src/constants.js";
import {
  eventWeights,
  innovationWeight,
  traitUnlocked,
} from "../src/geology.js";
import {
  ARENA_ARCHETYPES,
  ARENA_RECESSIVE_COUNT,
  ARENA_TRAIT_BUDGET,
  arenaGenomeValid,
  arenaInterventionCount,
  arenaRecessivePairs,
} from "../src/arena.js";
import {
  createArenaState,
  createArenaSuccessorState,
  createCampaignState,
  createPeriodState,
  createState,
  createSuccessorState,
  newPiece,
} from "../src/state.js";
import { deserialize } from "../src/storage.js";
import { hiddenRecessiveTraits } from "../src/reproductive-genetics.js";
import {
  genomeFromTraits,
  genomeSignature,
  syncGenomePhenotype,
} from "../src/genetics.js";

test("new campaigns default to Vida na Terra while low-level legacy states stay alternative", () => {
  assert.equal(createCampaignState(1).scenario, "earth");
  assert.equal(createState(1).scenario, "alternative");
});

test("Vida na Terra restricts first appearances to their historical period and rewards direct sequences", () => {
  const jurassic = createPeriodState("jurassic", 2, null, "earth"),
    nocturnal = jurassic.pieces.find(
      (piece) =>
        piece.owner === "blue" &&
        piece.traits.includes("Notívago"),
    );
  assert.ok(nocturnal);
  assert.equal(traitUnlocked(jurassic, "Visão Noturna", nocturnal), true);
  assert.equal(innovationWeight(jurassic, "Visão Noturna", nocturnal), 4);
  assert.equal(traitUnlocked(jurassic, "Carapaça", nocturnal), false);

  const permian = createPeriodState("permian", 3, null, "earth"),
    herbivore = newPiece(permian, "blue", 4, 4, {
      traits: ["Predação", "Multicelularismo", "Herbívoro"],
      ancestry: ["Predação", "Multicelularismo", "Herbívoro"],
    });
  assert.equal(traitUnlocked(permian, "Pele grossa", herbivore), true);
  assert.equal(innovationWeight(permian, "Pele grossa", herbivore), 3);
});

test("alternative and arena scenarios use period-independent uniform ecological event weights", () => {
  for (const scenario of ["alternative", "arena"]) {
    const state = createState(4, { scenario });
    const weights = eventWeights(state);
    assert.deepEqual(
      Object.keys(weights).sort(),
      EVENTS.map((event) => event.id).sort(),
    );
    assert.ok(Object.values(weights).every((weight) => weight === 1));
  }

  const earth = createCampaignState(5, "earth"),
    weights = eventWeights(earth);
  assert.ok(Object.keys(weights).length < EVENTS.length);
  assert.ok(Object.values(weights).some((weight) => weight !== 1));
});

test("all built-in Arena archetypes respect the six-mutation budget and admit two safe recessives", () => {
  for (const genome of ARENA_ARCHETYPES) {
    assert.equal(genome.length, ARENA_TRAIT_BUDGET);
    assert.equal(arenaGenomeValid(genome, ARENA_TRAIT_BUDGET), true);
    assert.ok(arenaRecessivePairs(genome).length > 0);
    assert.ok(
      arenaRecessivePairs(genome).every(
        (pair) => pair.length === ARENA_RECESSIVE_COUNT,
      ),
    );
  }
});

test("Vida na Terra seeds post-sexual founders with historical recessive variation", () => {
  const state = createPeriodState("ediacaran", 51, null, "earth");
  assert.ok(state.pieces.every((piece) => piece.genome));
  assert.ok(
    state.pieces.some((piece) => hiddenRecessiveTraits(piece).length > 0),
  );
  assert.ok(
    state.pieces.every(
      (piece) => hiddenRecessiveTraits(piece).length <= 2,
    ),
  );
  for (const piece of state.pieces)
    assert.ok(
      hiddenRecessiveTraits(piece).every(
        (trait) => !piece.traits.includes(trait),
      ),
    );
});

test("Cenários Alternativos preserve the survivor genome between cycles", () => {
  const state = createState(52, { scenario: "alternative" });
  const blue = state.pieces.filter((piece) => piece.owner === "blue");
  for (const piece of blue) {
    piece.genome = genomeFromTraits(
      ["Respiração anaeróbia", "Multicelularismo", "Predação"],
      ["Camuflagem"],
    );
    syncGenomePhenotype(piece, "Predação");
    piece.ancestry = [
      "Respiração anaeróbia",
      "Multicelularismo",
      "Predação",
      "Camuflagem",
    ];
  }
  state.result = { winner: "blue", reason: "Extinção total." };
  state.phase = "over";
  const expected = genomeSignature(blue[0].genome),
    next = createSuccessorState(state, 53);
  assert.ok(
    next.pieces.some(
      (piece) =>
        genomeSignature(piece.genome) === expected &&
        hiddenRecessiveTraits(piece).includes("Camuflagem"),
    ),
  );
});

test("Arena starts with four engineered founders and ignores geological chronology for later mutations", () => {
  const state = createArenaState(
    {
      blue: [ARENA_ARCHETYPES[0], ARENA_ARCHETYPES[1]],
      amber: [ARENA_ARCHETYPES[4], ARENA_ARCHETYPES[5]],
    },
    6,
  );
  assert.equal(state.version, 13);
  assert.equal(state.scenario, "arena");
  assert.equal(state.arenaPhase, 1);
  assert.equal(state.pieces.length, 4);

  state.geologicalStage = "archean";
  const predator = state.pieces.find(
    (piece) =>
      piece.owner === "blue" &&
      piece.ancestry.includes("Carnívoro"),
  );
  assert.ok(predator);
  assert.equal(traitUnlocked(state, "Visão Binocular", predator), true);
});

test("Arena founders carry exactly two randomly recessive characteristics per lineage", () => {
  const state = createArenaState(
    {
      blue: [ARENA_ARCHETYPES[0], ARENA_ARCHETYPES[1]],
      amber: [ARENA_ARCHETYPES[4], ARENA_ARCHETYPES[7]],
    },
    606,
  );
  for (const piece of state.pieces) {
    const recessives = hiddenRecessiveTraits(piece),
      genome = piece.ancestry.filter(
        (trait) => trait !== "Respiração anaeróbia",
      );
    assert.equal(genome.length, ARENA_TRAIT_BUDGET);
    assert.equal(recessives.length, ARENA_RECESSIVE_COUNT);
    assert.ok(recessives.every((trait) => genome.includes(trait)));
    assert.ok(recessives.every((trait) => !piece.traits.includes(trait)));
  }
  const blueHidden = state.pieces
    .filter((piece) => piece.owner === "blue")
    .map((piece) => hiddenRecessiveTraits(piece));
  const amberHidden = state.pieces
    .filter((piece) => piece.owner === "amber")
    .map((piece) => hiddenRecessiveTraits(piece));
  assert.equal(blueHidden.length, 2);
  assert.equal(amberHidden.length, 2);
});

test("Arena carries survivor piece forms into the next engineered phase", () => {
  const state = createArenaState(
    {
      blue: [ARENA_ARCHETYPES[0], ARENA_ARCHETYPES[1]],
      amber: [ARENA_ARCHETYPES[4], ARENA_ARCHETYPES[5]],
    },
    8,
  );
  for (const piece of state.pieces.filter((candidate) => candidate.owner === "blue"))
    piece.rank = 3;
  const next = createArenaSuccessorState(
    state,
    {
      blue: [ARENA_ARCHETYPES[0], ARENA_ARCHETYPES[1]],
      amber: [ARENA_ARCHETYPES[4], ARENA_ARCHETYPES[5]],
    },
    9,
  );
  assert.deepEqual(
    next.pieces
      .filter((piece) => piece.owner === "blue")
      .map((piece) => piece.rank),
    [3, 3],
  );
  assert.equal(next.arenaPhase, 2);
});

test("Vida na Terra keeps prior dominant lineages as a fossil record", () => {
  const state = createPeriodState("paleogene", 10, null, "earth");
  state.result = { winner: "blue", reason: "Extinção total." };
  state.phase = "over";
  const next = createSuccessorState(state, 11);
  assert.equal(next.scenario, "earth");
  assert.ok(next.fossilRecord.length >= 2);
  assert.ok(
    next.fossilRecord.some(
      (entry) =>
        entry.geologicalStage === "paleogene" &&
        entry.owner === "blue" &&
        entry.winner,
    ),
  );
});

test("Arena engineering counts substitutions rather than raw edits", () => {
  const before = [
      [...ARENA_ARCHETYPES[0]],
      [...ARENA_ARCHETYPES[4]],
    ],
    after = [
      ARENA_ARCHETYPES[0].map((trait) =>
        trait === "Visão Binocular" ? "Camuflagem" : trait,
      ),
      [...ARENA_ARCHETYPES[4]],
    ],
    changes = arenaInterventionCount(before, after);
  assert.equal(changes.substitutions, 1);
  assert.equal(changes.valid, true);
});

test("v11 saves migrate to Cenários Alternativos", () => {
  const legacy = createState(7);
  legacy.version = 11;
  delete legacy.scenario;
  delete legacy.arenaPhase;
  delete legacy.arenaFounders;
  const migrated = deserialize(JSON.stringify(legacy));
  assert.equal(migrated.version, 13);
  assert.equal(migrated.scenario, "alternative");
});
