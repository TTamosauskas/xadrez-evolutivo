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

test("current save schema round-trips deterministic state", () => {
  const state = createState(3);
  assert.equal(state.version, STATE_VERSION);
  assert.deepEqual(deserialize(JSON.stringify(state)), state);
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

test("deserialize migrates v17 and rejects older or invalid saves", () => {
  assert.throws(() => deserialize("{"), /inválido/i);

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

test("load migrates the immediately previous development key and saves use v18", () => {
  const legacy = createState(6);
  legacy.version = 17;
  for (const piece of legacy.pieces) delete piece.genome.Coprofagia;
  const entries = new Map([
      ["xadrez-evolutivo-save-v17", JSON.stringify(legacy)],
    ]),
    storage = {
      setItem: (key, value) => entries.set(key, value),
      getItem: (key) => entries.get(key) ?? null,
    };

  const migrated = load(storage);
  assert.equal(migrated.version, STATE_VERSION);
  assert.ok(entries.has(SAVE_KEY));

  const state = createState(7);
  save(storage, state);
  assert.deepEqual(load(storage), state);
});

test("save key follows the centralized state version", () => {
  assert.equal(SAVE_KEY, `xadrez-evolutivo-save-v${STATE_VERSION}`);
});
