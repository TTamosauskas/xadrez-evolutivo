import test from "node:test";
import assert from "node:assert/strict";
import {
  deserialize,
  save,
  load,
  LEGACY_KEY,
  SAVE_KEY,
  V6_KEY,
  V5_KEY,
  V4_KEY,
  V3_KEY,
  V2_KEY,
} from "../src/storage.js";
import { createState, clone, assertState } from "../src/state.js";
import { reproPhenotype } from "../src/reproductive-genetics.js";
test("round trip saves deterministic state and rejects duplicate occupancy", () => {
  const s = createState(3);
  assert.deepEqual(deserialize(JSON.stringify(s)), s);
  const bad = clone(s);
  bad.pieces[1].r = bad.pieces[0].r;
  bad.pieces[1].c = bad.pieces[0].c;
  assert.throws(() => deserialize(JSON.stringify(bad)), /Ocupação/);
});
test("loading a save discards obsolete Marco Evolutivo notices", () => {
  const s = createState(18);
  s.notices.push({
    id: s.nextNotice++,
    title: "Marco Evolutivo",
    lines: ["Fotossíntese surgiu pela primeira vez."],
  });
  const restored = deserialize(JSON.stringify(s));
  assert.ok(!restored.notices.some((notice) => notice.title === "Marco Evolutivo"));
  assertState(restored);
});

test("load falls back to v2 key and migrates without overwriting it", () => {
  const old = createState(7);
  old.version = 2;
  old.era = 2;
  delete old.geologicalStage;
  delete old.cycle;
  delete old.totalCycles;
  delete old.historicalTraits;
  const raw = JSON.stringify(old),
    entries = new Map([[V2_KEY, raw]]),
    storage = {
      setItem: (k, v) => entries.set(k, v),
      getItem: (k) => entries.get(k) ?? null,
    };
  const migrated = load(storage);
  assert.equal(migrated.version, 7);
  assert.equal(entries.get(V2_KEY), raw);
  assert.ok(migrated.pieces.every((p) => p.traits.includes("Locomoção")));
  assert.ok(migrated.pieces.every((p) => p.traits.includes("Predação")));
});

test("first-cycle saves discard deleterious mutations from the old rules", () => {
  const old = createState(17);
  old.totalCycles = 1;
  old.cycle = 1;
  old.pieces[0].traits.push("Mutação Deletéria", "Mutação Disfuncional");
  old.pieces[0].deleteriousDue = 3;
  old.pieces[0].lastMoveRound = 1;
  old.seenMutations.push(
    "Mutação Deletéria",
    "Mutação Disfuncional",
    "Perda de Fotossíntese",
  );
  old.discoveries.mutations.push("Mutação Deletéria", "Mutação Disfuncional");
  old.discoveries.read.push(
    "mutations:Mutação Deletéria",
    "mutations:Mutação Disfuncional",
  );
  const migrated = deserialize(JSON.stringify(old));
  assert.ok(!migrated.pieces[0].traits.includes("Mutação Deletéria"));
  assert.ok(!migrated.pieces[0].traits.includes("Mutação Disfuncional"));
  assert.equal(migrated.pieces[0].deleteriousDue, undefined);
  assert.equal(migrated.pieces[0].lastMoveRound, undefined);
  assert.ok(!migrated.seenMutations.includes("Mutação Deletéria"));
  assert.ok(!migrated.seenMutations.includes("Mutação Disfuncional"));
  assert.ok(!migrated.seenMutations.includes("Perda de Fotossíntese"));
  assert.ok(!migrated.discoveries.mutations.includes("Mutação Deletéria"));
  assert.ok(!migrated.discoveries.mutations.includes("Mutação Disfuncional"));
  assertState(migrated);
});

test("v6 saves migrate without an origin prelude", () => {
  const old = createState(16);
  old.version = 6;
  delete old.origin;
  const raw = JSON.stringify(old),
    entries = new Map([[V6_KEY, raw]]),
    storage = {
      setItem: (k, v) => entries.set(k, v),
      getItem: (k) => entries.get(k) ?? null,
    },
    migrated = load(storage);
  assert.equal(migrated.version, 7);
  assert.equal(migrated.origin, null);
  assert.equal(migrated.phase, "move");
  assert.equal(entries.get(V6_KEY), raw);
});

test("v5 saves split invalid Fotossíntese + Predação hybrids during migration", () => {
  const old = createState(15);
  old.version = 5;
  old.historicalTraits = ["Fotossíntese", "Predação"];
  old.pieces[0].traits = ["Fotossíntese", "Predação"];
  old.pieces[1].traits = ["Fotossíntese", "Predação", "Locomoção"];
  const raw = JSON.stringify(old),
    entries = new Map([[V5_KEY, raw]]),
    storage = {
      setItem: (k, v) => entries.set(k, v),
      getItem: (k) => entries.get(k) ?? null,
    },
    migrated = load(storage);
  assert.equal(migrated.version, 7);
  assert.deepEqual(migrated.pieces[0].traits, ["Fotossíntese"]);
  assert.ok(migrated.pieces[1].traits.includes("Predação"));
  assert.ok(migrated.pieces[1].traits.includes("Locomoção"));
  assert.ok(!migrated.pieces[1].traits.includes("Fotossíntese"));
  assert.deepEqual(migrated.historicalTraits, ["Fotossíntese", "Predação"]);
  assert.equal(entries.get(V5_KEY), raw);
});

test("v4 saves migrate discoveries without creating unread backlog", () => {
  const old = createState(14);
  old.version = 4;
  delete old.discoveries;
  old.historicalTraits.push("Fotossíntese");
  old.seenMutations.push("Fotossíntese");
  const raw = JSON.stringify(old),
    entries = new Map([[V4_KEY, raw]]),
    storage = {
      setItem: (k, v) => entries.set(k, v),
      getItem: (k) => entries.get(k) ?? null,
    },
    migrated = load(storage);
  assert.equal(migrated.version, 7);
  assert.ok(migrated.discoveries.geology.includes("archean"));
  assert.ok(migrated.discoveries.mutations.includes("Fotossíntese"));
  assert.equal(
    migrated.discoveries.read.length,
    migrated.discoveries.geology.length +
      migrated.discoveries.events.length +
      migrated.discoveries.mutations.length,
  );
  assert.equal(entries.get(V4_KEY), raw);
});

test("v3 saves rename Predador to Carnívoro and preserve capture with Predação", () => {
  const old = createState(8);
  old.version = 3;
  delete old.barriers;
  delete old.building;
  old.pieces[0].traits.push("Predador");
  old.historicalTraits = ["Predador", "Locomoção"];
  const raw = JSON.stringify(old),
    entries = new Map([[V3_KEY, raw]]),
    storage = {
      setItem: (k, v) => entries.set(k, v),
      getItem: (k) => entries.get(k) ?? null,
    },
    migrated = load(storage);
  assert.equal(migrated.version, 7);
  assert.ok(migrated.pieces[0].traits.includes("Carnívoro"));
  assert.ok(migrated.pieces[0].traits.includes("Predação"));
  assert.ok(!migrated.pieces[0].traits.includes("Predador"));
  assert.ok(migrated.historicalTraits.includes("Carnívoro"));
  assert.ok(migrated.historicalTraits.includes("Predação"));
  assert.deepEqual(migrated.barriers, []);
  assert.equal(migrated.building, null);
  assert.equal(entries.get(V3_KEY), raw);
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
  assert.ok(s.pieces[0].traits.includes("Coletor"));
  assert.ok(s.pieces[0].traits.includes("Locomoção"));
  assert.ok(["silurian", "devonian", "carboniferous", "permian", "triassic", "jurassic", "cretaceous", "paleogene", "neogene", "quaternary"].includes(s.geologicalStage));
  assert.equal(s.turn, 3);
  assert.equal(s.pieces[0].venom.remaining, 2);
});
test("v2 saves migrate old locomotion semantics and Ovos genes into v6", () => {
  const old = createState(9);
  old.version = 2;
  old.era = 4;
  delete old.geologicalStage;
  delete old.cycle;
  delete old.totalCycles;
  delete old.historicalTraits;
  delete old.eggs;
  delete old.nextEgg;
  for (const piece of old.pieces) {
    delete piece.reproGenes;
    delete piece.pregnancies;
  }
  old.pieces[0].traits = ["Ovos", "Locomoção"];

  const s = deserialize(JSON.stringify(old));
  assert.equal(s.version, 7);
  assert.deepEqual(s.eggs, []);
  assert.equal(s.nextEgg, 1);
  assert.equal(reproPhenotype(s.pieces[0].reproGenes).dispersal, "eggs");
  assert.ok(s.pieces[0].traits.includes("Ovos"));
  assert.ok(s.pieces[0].traits.includes("Locomoção"));
  assert.ok(s.pieces[0].traits.includes("Locomoção Avançada"));
  assert.ok(s.pieces.every((p) => p.traits.includes("Locomoção")));
  assert.ok(s.pieces.every((p) => Array.isArray(p.pregnancies)));
  assert.equal(s.totalCycles, 4);
  assert.ok(s.historicalTraits.includes("Locomoção"));
});

test("barriers and construction phase survive save round trip", () => {
  const s = createState(13),
    p = s.pieces.find((piece) => piece.owner === "blue");
  s.barriers = [18, 19];
  s.phase = "build";
  s.building = {
    id: p.id,
    second: false,
    locomotion: false,
  };
  assert.deepEqual(deserialize(JSON.stringify(s)), s);
});

test("terrain manipulation phase survives save round trip", () => {
  const s = createState(12),
    p = s.pieces.find((piece) => piece.owner === "blue");
  s.phase = "manipulate";
  s.manipulation = {
    id: p.id,
    origin: p.r * 8 + p.c,
    terrain: "hostile",
    second: false,
    locomotion: false,
  };
  assert.deepEqual(deserialize(JSON.stringify(s)), s);
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
