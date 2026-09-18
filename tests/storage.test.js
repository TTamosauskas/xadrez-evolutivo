import test from "node:test";
import assert from "node:assert/strict";
import {
  deserialize,
  save,
  load,
  LEGACY_KEY,
  SAVE_KEY,
} from "../src/storage.js";
import { createState, clone } from "../src/state.js";
import { reproPhenotype } from "../src/reproductive-genetics.js";
test("round trip saves deterministic state and rejects duplicate occupancy", () => {
  const s = createState(3);
  assert.deepEqual(deserialize(JSON.stringify(s)), s);
  const bad = clone(s);
  bad.pieces[1].r = bad.pieces[0].r;
  bad.pieces[1].c = bad.pieces[0].c;
  assert.throws(() => deserialize(JSON.stringify(bad)), /Ocupação/);
});
test("save version uses separate key and preserves original save", () => {
  const entries = new Map([[LEGACY_KEY, "original"]]);
  const storage = {
    setItem: (k, v) => entries.set(k, v),
    getItem: (k) => entries.get(k) ?? null,
  };
  const s = createState(1);
  save(storage, s);
  assert.equal(entries.get(LEGACY_KEY), "original");
  assert.deepEqual(load(storage), s);
  assert.ok(entries.has(SAVE_KEY));
});
test("imports legacy positions, specialization loss, seeds, poison and timers", () => {
  const old = {
    turn: 3,
    current: "amber",
    board: Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => ({ terrain: "neutral" })),
    ),
    organisms: [
      {
        id: 9,
        owner: "blue",
        r: 5,
        c: 3,
        lineage: "A",
        collectorSeeds: 3,
        venomPoison: { remaining: 2, infectedAtTurn: 2 },
      },
      { id: 10, owner: "amber", r: 2, c: 4, lineage: "A" },
    ],
    lineages: {
      blue: {
        A: {
          pieceRank: 2,
          traits: [],
          mutationStack: [
            { kind: "trait", name: "Coletor" },
            { kind: "trait", name: "Camuflagem" },
            { kind: "trait-loss", name: "Camuflagem" },
          ],
        },
      },
      amber: { A: { pieceRank: 0, traits: [] } },
    },
  };
  const s = deserialize(JSON.stringify(old));
  assert.equal(s.pieces[0].seeds, 3);
  assert.deepEqual(s.pieces[0].traits, ["Coletor"]);
  assert.equal(s.turn, 3);
  assert.equal(s.pieces[0].venom.remaining, 2);
});
test("v2 saves migrate old Ovos trait into reproductive genes", () => {
  const old = createState(9);
  delete old.eggs;
  delete old.nextEgg;
  for (const piece of old.pieces) {
    delete piece.reproGenes;
    delete piece.pregnancies;
  }
  old.pieces[0].traits = ["Ovos"];

  const s = deserialize(JSON.stringify(old));
  assert.deepEqual(s.eggs, []);
  assert.equal(s.nextEgg, 1);
  assert.equal(reproPhenotype(s.pieces[0].reproGenes).dispersal, "eggs");
  assert.ok(s.pieces[0].traits.includes("Ovos"));
  assert.ok(s.pieces.every((p) => Array.isArray(p.pregnancies)));
});

test("malformed nested disease and event data are rejected before replacing state", () => {
  const s = createState(1);
  s.diseases = [{ id: 1 }];
  assert.throws(() => deserialize(JSON.stringify(s)));
  const b = createState(1);
  b.event = {
    id: "ice",
    startRound: 1,
    hazards: [],
    snapshots: {},
    rows: 1000,
    cols: 1,
  };
  assert.throws(() => deserialize(JSON.stringify(b)));
});
