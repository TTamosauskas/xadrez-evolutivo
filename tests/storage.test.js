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

test("deserialize rejects malformed, invalid and obsolete development saves", () => {
  assert.throws(() => deserialize("{"), /inválido/i);

  const obsolete = createState(4);
  obsolete.version = STATE_VERSION - 1;
  assert.throws(
    () => deserialize(JSON.stringify(obsolete)),
    /incompatível/i,
  );

  const invalid = clone(createState(5));
  invalid.pieces[1].r = invalid.pieces[0].r;
  invalid.pieces[1].c = invalid.pieces[0].c;
  assert.throws(() => deserialize(JSON.stringify(invalid)), /Ocupação/);
});

test("save and load use only the current development key", () => {
  const entries = new Map([
      ["xadrez-evolutivo-save-v16", JSON.stringify(createState(6))],
    ]),
    storage = {
      setItem: (key, value) => entries.set(key, value),
      getItem: (key) => entries.get(key) ?? null,
    };

  assert.throws(() => load(storage), /Nenhuma partida salva nesta versão/);

  const state = createState(7);
  save(storage, state);
  assert.ok(entries.has(SAVE_KEY));
  assert.deepEqual(load(storage), state);
});

test("save key follows the centralized state version", () => {
  assert.equal(SAVE_KEY, `xadrez-evolutivo-save-v${STATE_VERSION}`);
});
