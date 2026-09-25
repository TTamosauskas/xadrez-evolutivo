import test from "node:test";
import assert from "node:assert/strict";
import {
  deserialize,
  save,
  load,
  SAVE_KEY,
} from "../src/storage.js";
import {
  createState,
  clone,
  assertState,
} from "../src/state.js";
import { STATE_VERSION } from "../src/constants.js";
import { genomeFromTraits } from "../src/genetics.js";

test("current save schema round-trips deterministic state", () => {
  const state = createState(3);
  assert.equal(state.version, STATE_VERSION);
  assert.deepEqual(deserialize(JSON.stringify(state)), state);
});

test("current saves without opening mutation state avoid retroactive guarantees", () => {
  const state = createState(13);
  delete state.openingMutationSatisfied;
  const restored = deserialize(JSON.stringify(state));
  assert.deepEqual(restored.openingMutationSatisfied, {
    blue: true,
    amber: true,
  });
  assertState(restored);
});

test("current saves without cycle innovation pressure normalize to an empty cycle", () => {
  const state = createState(14);
  delete state.cyclePositiveInnovations;
  const restored = deserialize(JSON.stringify(state));
  assert.deepEqual(restored.cyclePositiveInnovations, []);
  assertState(restored);
});

test("current saves infer legacy pathogen routes and sexual-pathogen timing", () => {
  const state = createState(15, {
    scenario: "earth",
    geologicalStage: "cambrian",
    totalCycles: 7,
    historicalTraits: ["Reprodução Sexuada"],
  });
  state.diseases.push({
    id: state.nextDisease++,
    source: "eco",
    triggerOwner: null,
    agent: "bacteria",
    transmission: "trail",
    mode: "omnidirectional",
    startRound: 0,
    endRound: 10,
    delay: 3,
    mortality: 60,
    infected: [],
    survivors: [],
    deaths: 0,
    contaminated: [],
  });
  delete state.diseases[0].transmission;
  delete state.sexualPathogenUnlockTotalCycle;
  delete state.cyclePathogenProfile;
  delete state.pathogenSpores;
  delete state.nextPathogenSpore;

  const restored = deserialize(JSON.stringify(state));
  assert.equal(restored.diseases[0].transmission, "trail");
  assert.deepEqual(restored.cyclePathogenProfile, {
    agent: "bacteria",
    transmission: "trail",
  });
  assert.equal(restored.sexualPathogenUnlockTotalCycle, 7);
  assert.deepEqual(restored.pathogenSpores, []);
  assert.equal(restored.nextPathogenSpore, 1);
  assertState(restored);
});

test("current save schema preserves active phases and temporary event data", () => {
  const state = createState(13),
    piece = state.pieces.find((candidate) => candidate.owner === "blue");
  state.phase = "build";
  state.building = {
    id: piece.id,
    second: false,
    locomotion: false,
  };
  state.event = {
    id: "insularization",
    icon: "🏝️",
    name: "Insularização",
    description: "Barreira temporária.",
    startRound: 0,
    hazards: [],
    snapshots: {},
    barriers: [0, 9, 18, 27, 36, 45],
    openings: [54, 63],
  };
  assertState(state);
  assert.deepEqual(deserialize(JSON.stringify(state)), state);
});

test("deserialize migrates v17-v20 and rejects older or invalid saves", () => {
  assert.throws(() => deserialize("{"), /inválido/i);

  const renamed = createState(20),
    renamedPiece = renamed.pieces[0];
  renamedPiece.traits = [...new Set([...renamedPiece.traits, "Mutação Letal"])];
  renamedPiece.ancestry = [...new Set([...renamedPiece.ancestry, "Mutação Letal"])];
  renamedPiece.genome = genomeFromTraits(renamedPiece.traits);
  renamedPiece.deleteriousDue = 6;
  renamedPiece.lifetimeOffspring = undefined;
  renamed.seenMutations = ["Mutação Deletéria"];
  renamedPiece.traits = renamedPiece.traits.map((trait) =>
    trait === "Mutação Letal" ? "Mutação Deletéria" : trait,
  );
  renamedPiece.ancestry = renamedPiece.ancestry.map((trait) =>
    trait === "Mutação Letal" ? "Mutação Deletéria" : trait,
  );
  renamedPiece.genome["Mutação Deletéria"] =
    renamedPiece.genome["Mutação Letal"];
  delete renamedPiece.genome["Mutação Letal"];
  renamed.version = 20;

  const migratedRename = deserialize(JSON.stringify(renamed)),
    migratedPiece = migratedRename.pieces.find(
      (piece) => piece.id === renamedPiece.id,
    );
  assert.equal(migratedRename.version, STATE_VERSION);
  assert.ok(migratedPiece.traits.includes("Mutação Letal"));
  assert.equal(migratedPiece.traits.includes("Mutação Deletéria"), false);
  assert.ok(
    migratedPiece.genome["Mutação Letal"].some(
      (allele) => allele.value === "derived",
    ),
  );
  assert.equal(Object.hasOwn(migratedPiece.genome, "Mutação Deletéria"), false);
  assert.equal(migratedPiece.deleteriousDue, 6);
  assert.equal(migratedPiece.lifetimeOffspring, 0);
  assert.deepEqual(migratedRename.seenMutations, ["Mutação Letal"]);
  assertState(migratedRename);

  const legacy = createState(4);
  legacy.version = 17;
  for (const piece of legacy.pieces) delete piece.genome.Coprofagia;
  legacy.deathSites.push({
    cell: 10,
    dueRound: 3,
    base: "fertile",
  });
  legacy.board[10] = "hostile";
  const migrated = deserialize(JSON.stringify(legacy));
  assert.equal(migrated.version, STATE_VERSION);
  assert.equal(migrated.deathSites.length, 0);
  assert.equal(migrated.carcasses.length, 0);
  assert.equal(migrated.board[10], "fertile");
  assert.ok(
    migrated.pieces.every(
      (piece) =>
        Array.isArray(piece.genome.Coprofagia) &&
        piece.genome.Coprofagia.every(
          (allele) => allele.value === "ancestral",
        ),
    ),
  );

  const oldOrigin = createState(8, {
    originPrelude: true,
    geologicalStage: "archean",
    scenario: "earth",
  });
  oldOrigin.version = 18;
  const migratedOrigin = deserialize(JSON.stringify(oldOrigin));
  assert.equal(migratedOrigin.version, STATE_VERSION);
  assert.equal(migratedOrigin.geologicalStage, "hadean");
  assert.equal(migratedOrigin.cycle, 1);
  assert.equal(migratedOrigin.phase, "origin");
  assert.ok(migratedOrigin.origin);
  assert.equal(migratedOrigin.pieces.length, 0);
  assert.deepEqual(migratedOrigin.discoveries.geology, ["hadean"]);

  const oldHadeanStart = createState(9, {
    geologicalStage: "hadean",
    cycle: 1,
    totalCycles: 1,
    scenario: "earth",
  });
  oldHadeanStart.version = 19;
  const migratedHadeanStart = deserialize(JSON.stringify(oldHadeanStart));
  assert.equal(migratedHadeanStart.version, STATE_VERSION);
  assert.equal(migratedHadeanStart.phase, "origin");
  assert.ok(migratedHadeanStart.origin);
  assert.equal(migratedHadeanStart.pieces.length, 0);

  const obsolete = createState(4);
  obsolete.version = 16;
  assert.throws(
    () => deserialize(JSON.stringify(obsolete)),
    /incompatível/i,
  );

  const invalid = clone(createState(5));
  invalid.pieces[1].r = invalid.pieces[0].r;
  invalid.pieces[1].c = invalid.pieces[0].c;
  assert.throws(() => deserialize(JSON.stringify(invalid)), /Ocupação/);
});

test("load migrates legacy development keys and saves use v21", () => {
  const legacy = createState(6, {
    originPrelude: true,
    geologicalStage: "archean",
    scenario: "earth",
  });
  legacy.version = 18;
  const entries = new Map([
      ["xadrez-evolutivo-save-v18", JSON.stringify(legacy)],
    ]),
    storage = {
      setItem: (key, value) => entries.set(key, value),
      getItem: (key) => entries.get(key) ?? null,
    };

  const migrated = load(storage);
  assert.equal(migrated.version, STATE_VERSION);
  assert.equal(migrated.geologicalStage, "hadean");
  assert.equal(migrated.cycle, 1);
  assert.ok(entries.has(SAVE_KEY));

  const state = createState(7);
  save(storage, state);
  assert.deepEqual(load(storage), state);
});

test("save key follows the centralized state version", () => {
  assert.equal(SAVE_KEY, `xadrez-evolutivo-save-v${STATE_VERSION}`);
});
