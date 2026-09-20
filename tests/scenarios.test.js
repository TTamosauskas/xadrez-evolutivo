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
  ARENA_TRAIT_BUDGET,
  arenaGenomeValid,
  arenaInterventionCount,
} from "../src/arena.js";
import {
  createArenaState,
  createCampaignState,
  createPeriodState,
  createState,
  newPiece,
} from "../src/state.js";
import { deserialize } from "../src/storage.js";

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

test("all built-in Arena archetypes respect the six-mutation budget and dependency tree", () => {
  for (const genome of ARENA_ARCHETYPES) {
    assert.equal(genome.length, ARENA_TRAIT_BUDGET);
    assert.equal(arenaGenomeValid(genome, ARENA_TRAIT_BUDGET), true);
  }
});

test("Arena starts with four engineered founders and ignores geological chronology for later mutations", () => {
  const state = createArenaState(
    {
      blue: [ARENA_ARCHETYPES[0], ARENA_ARCHETYPES[1]],
      amber: [ARENA_ARCHETYPES[4], ARENA_ARCHETYPES[5]],
    },
    6,
  );
  assert.equal(state.version, 12);
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
  assert.equal(migrated.version, 12);
  assert.equal(migrated.scenario, "alternative");
});
