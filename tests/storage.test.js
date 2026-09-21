import test from "node:test";
import assert from "node:assert/strict";
import {
  deserialize,
  save,
  load,
  LEGACY_KEY,
  SAVE_KEY,
  V14_KEY,
  V12_KEY,
  V11_KEY,
  V9_KEY,
  V8_KEY,
  V6_KEY,
  V5_KEY,
  V4_KEY,
  V3_KEY,
  V2_KEY,
} from "../src/storage.js";
import { createState, clone, assertState } from "../src/state.js";
import { has } from "../src/constants.js";
import { ancestralReproGenes } from "../src/reproductive-genetics.js";
import { GEOLOGICAL_STAGES } from "../src/geology.js";
import {
  cloneGenome,
  dispersalMode,
  genomeFromTraits,
  hiddenRecessiveTraits,
  syncGenomePhenotype,
} from "../src/genetics.js";
test("round trip saves deterministic state and rejects duplicate occupancy", () => {
  const s = createState(3);
  assert.deepEqual(deserialize(JSON.stringify(s)), s);
  const bad = clone(s);
  bad.pieces[1].r = bad.pieces[0].r;
  bad.pieces[1].c = bad.pieces[0].c;
  assert.throws(() => deserialize(JSON.stringify(bad)), /Ocupação/);
});
test("older v7 saves restore existing pieces as mature and off cooldown", () => {
  const s = createState(44);
  s.turn = 12;
  for (const piece of s.pieces) {
    delete piece.maturesRound;
    delete piece.nextReproductionRound;
    delete piece.ancestry;
  }
  const restored = deserialize(JSON.stringify(s));
  for (const piece of restored.pieces) {
    assert.equal(piece.maturesRound, 6);
    assert.equal(piece.nextReproductionRound, 6);
    assert.deepEqual(piece.ancestry, piece.traits);
  }
  assertState(restored);
});

test("v7 saves initialize the population and Conway controls", () => {
  const s = createState(31);
  s.version = 7;
  delete s.conwayWatchUntil;
  delete s.conwayStagnation;
  delete s.populationDiseaseCooldownUntil;
  delete s.severePopulationLatched;
  const restored = deserialize(JSON.stringify(s));
  assert.equal(restored.conwayWatchUntil, null);
  assert.equal(restored.conwayStagnation, null);
  assert.equal(restored.populationDiseaseCooldownUntil, 0);
  assert.equal(restored.severePopulationLatched, false);
  assertState(restored);
});

test("plant seeds survive save round trip", () => {
  const s = createState(30),
    parent = s.pieces[0];
  s.plantSeeds.push({
    id: s.nextPlantSeed++,
    owner: parent.owner,
    r: 3,
    c: 3,
    parentId: parent.id,
    movesRemaining: 2,
    profile: {
      owner: parent.owner,
      rank: parent.rank,
      traits: [...parent.traits],
      ancestry: [...parent.ancestry],
      genome: cloneGenome(parent.genome),
      mutations: 4,
      generation: 1,
      parentId: parent.id,
    },
  });
  s.maxGenerationReached = 1;
  assertState(s);
  assert.deepEqual(deserialize(JSON.stringify(s)), s);
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

test("load migrates v14 saves to the new normalization traits", () => {
  const old = createState(60, {
      geologicalStage: "cambrian",
      historicalTraits: [
        "Respiração anaeróbia",
        "Fotossíntese",
        "Predação",
        "Dormência",
        "Multicelularismo",
        "Locomoção Primitiva",
      ],
      founder: {
        rank: 0,
        traits: [
          "Predação",
          "Multicelularismo",
          "Locomoção Primitiva",
          "Vertebrado",
          "Locomoção Articulada",
        ],
      },
    }),
    piece = old.pieces[0];
  old.version = 14;
  old.historicalTraits = old.historicalTraits.filter(
    (trait) => !["Reparo Celular", "Simetria Bilateral"].includes(trait),
  );
  piece.traits = piece.traits.filter(
    (trait) => !["Reparo Celular", "Simetria Bilateral"].includes(trait),
  );
  piece.ancestry = piece.ancestry.filter(
    (trait) => !["Reparo Celular", "Simetria Bilateral"].includes(trait),
  );
  delete piece.genome["Reparo Celular"];
  delete piece.genome["Simetria Bilateral"];

  const raw = JSON.stringify(old),
    entries = new Map([[V14_KEY, raw]]),
    storage = {
      setItem: (key, value) => entries.set(key, value),
      getItem: (key) => entries.get(key) ?? null,
    },
    migrated = load(storage),
    restored = migrated.pieces.find((candidate) => candidate.id === piece.id);

  assert.equal(migrated.version, 15);
  assert.equal(entries.get(V14_KEY), raw);
  assert.ok(restored.traits.includes("Reparo Celular"));
  assert.ok(restored.traits.includes("Simetria Bilateral"));
  assert.ok(migrated.historicalTraits.includes("Reparo Celular"));
  assert.ok(migrated.historicalTraits.includes("Simetria Bilateral"));
  assertState(migrated);
});

test("load migrates v12 saves to the universal genome without overwriting the old key", () => {
  const old = createState(61);
  old.version = 12;
  for (const piece of old.pieces) delete piece.genome;
  const raw = JSON.stringify(old),
    entries = new Map([[V12_KEY, raw]]),
    storage = {
      setItem: (key, value) => entries.set(key, value),
      getItem: (key) => entries.get(key) ?? null,
    },
    migrated = load(storage);
  assert.equal(migrated.version, 15);
  assert.equal(entries.get(V12_KEY), raw);
  assert.ok(migrated.pieces.every((piece) => piece.genome));
  assertState(migrated);
});

test("load migrates v11 browser saves into Cenários Alternativos", () => {
  const old = createState(6);
  old.version = 11;
  delete old.scenario;
  delete old.arenaPhase;
  delete old.arenaFounders;
  delete old.fossilRecord;
  const raw = JSON.stringify(old),
    entries = new Map([[V11_KEY, raw]]),
    storage = {
      setItem: (key, value) => entries.set(key, value),
      getItem: (key) => entries.get(key) ?? null,
    },
    migrated = load(storage);
  assert.equal(migrated.version, 15);
  assert.equal(migrated.scenario, "alternative");
  assert.deepEqual(migrated.fossilRecord, []);
  assert.equal(entries.get(V11_KEY), raw);
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
  assert.equal(migrated.version, 15);
  assert.equal(entries.get(V2_KEY), raw);
  assert.ok(migrated.pieces.every((p) => has(p, "Locomoção Primitiva")));
  assert.ok(migrated.pieces.every((p) => p.traits.includes("Predação")));
});

test("v9 cumulative phenotypes migrate to active families while preserving ancestry", () => {
  const old = createState(82, {
    geologicalStage: "quaternary",
  });
  old.version = 9;
  old.pieces[0].traits = [
    "Multicelularismo",
    "Predação",
    "Carnívoro",
    "Onívoro",
    "Locomoção",
    "Locomoção Avançada",
    "Sociabilidade",
    "Eusocialidade",
  ];
  old.pieces[0].ancestry = [...old.pieces[0].traits];

  const raw = JSON.stringify(old),
    entries = new Map([[V9_KEY, raw]]),
    storage = {
      setItem: (key, value) => entries.set(key, value),
      getItem: (key) => entries.get(key) ?? null,
    },
    migrated = load(storage),
    piece = migrated.pieces[0];

  assert.equal(migrated.version, 15);
  assert.ok(piece.traits.includes("Onívoro"));
  assert.ok(piece.traits.includes("Locomoção Avançada"));
  assert.ok(piece.traits.includes("Eusocialidade"));
  assert.equal(piece.traits.includes("Carnívoro"), false);
  assert.equal(piece.traits.includes("Locomoção"), false);
  assert.equal(piece.traits.includes("Sociabilidade"), false);
  assert.ok(piece.ancestry.includes("Carnívoro"));
  assert.ok(piece.ancestry.includes("Locomoção Articulada"));
  assert.ok(piece.ancestry.includes("Locomoção Primitiva"));
  assert.ok(piece.ancestry.includes("Sociabilidade"));
  assertState(migrated);
});

test("v8 complex lineages migrate to Multicelularismo without instant senescence", () => {
  const old = createState(81, {
    geologicalStage: "devonian",
    historicalTraits: GEOLOGICAL_STAGES.slice(0, 7).flatMap(
      (stage) => stage.required,
    ),
  });
  old.version = 8;
  old.turn = 100;
  old.pieces[0].traits = ["Predação", "Locomoção"];
  old.pieces[0].ancestry = ["Predação", "Locomoção"];
  old.pieces[0].bornRound = 0;
  old.pieces[0].maturesRound = 0;

  const raw = JSON.stringify(old),
    entries = new Map([[V8_KEY, raw]]),
    storage = {
      setItem: (key, value) => entries.set(key, value),
      getItem: (key) => entries.get(key) ?? null,
    },
    migrated = load(storage),
    piece = migrated.pieces[0];

  assert.equal(migrated.version, 15);
  assert.ok(piece.traits.includes("Multicelularismo"));
  assert.ok(piece.ancestry.includes("Multicelularismo"));
  assert.equal(piece.bornRound, 50);
  assert.equal(piece.maturesRound, 50);
  assert.ok(migrated.historicalTraits.includes("Multicelularismo"));
  assertState(migrated);
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
  assert.equal(migrated.version, 15);
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
  assert.equal(migrated.version, 15);
  assert.deepEqual(migrated.pieces[0].traits, [
    "Respiração anaeróbia",
    "Fotossíntese",
  ]);
  assert.ok(migrated.pieces[1].traits.includes("Predação"));
  assert.ok(migrated.pieces[1].traits.includes("Locomoção Articulada"));
  assert.ok(migrated.pieces[1].traits.includes("Locomoção Primitiva"));
  assert.ok(!migrated.pieces[1].traits.includes("Fotossíntese"));
  assert.deepEqual(migrated.historicalTraits, [
    "Respiração anaeróbia",
    "Fotossíntese",
    "Predação",
  ]);
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
  assert.equal(migrated.version, 15);
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
  assert.equal(migrated.version, 15);
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
  assert.ok(has(s.pieces[0], "Locomoção Primitiva"));
  assert.ok(["silurian", "devonian", "carboniferous", "permian", "triassic", "jurassic", "cretaceous", "paleogene", "neogene", "quaternary"].includes(s.geologicalStage));
  assert.equal(s.turn, 3);
  assert.equal(s.pieces[0].venom.remaining, 2);
});
test("v2 saves retire obsolete Ovos genes while preserving old locomotion semantics", () => {
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
  assert.equal(s.version, 15);
  assert.deepEqual(s.eggs, []);
  assert.equal(s.nextEgg, 1);
  assert.equal(dispersalMode(s.pieces[0]), "local");
  assert.ok(!s.pieces[0].traits.includes("Ovos"));
  assert.equal(s.pieces[0].traits.includes("Locomoção"), false);
  assert.ok(s.pieces[0].traits.includes("Locomoção Avançada"));
  assert.ok(s.pieces.every((p) => has(p, "Locomoção Primitiva")));
  assert.ok(s.pieces.every((p) => Array.isArray(p.pregnancies)));
  assert.equal(s.totalCycles, 4);
  assert.ok(s.historicalTraits.includes("Locomoção Articulada"));
  assert.ok(s.historicalTraits.includes("Locomoção Primitiva"));
});

test("v12 saves drop obsolete Ovos history discoveries and alleles", () => {
  const old = createState(91);
  old.version = 12;
  for (const piece of old.pieces) delete piece.genome;
  old.historicalTraits.push("Ovos");
  old.seenMutations.push("Ovos", "Perda de Ovos");
  old.discoveries.mutations.push("Ovos");
  old.discoveries.read.push("mutations:Ovos");
  old.pieces[0].traits.push("Ovos");
  old.pieces[0].reproGenes = ancestralReproGenes();
  old.pieces[0].reproGenes.dispersal = [
    { value: "eggs", dominance: "dominant" },
    { value: "spores", dominance: "recessive" },
  ];
  const restored = deserialize(JSON.stringify(old));
  assert.ok(!restored.historicalTraits.includes("Ovos"));
  assert.ok(!restored.seenMutations.includes("Ovos"));
  assert.ok(!restored.seenMutations.includes("Perda de Ovos"));
  assert.ok(!restored.discoveries.mutations.includes("Ovos"));
  assert.ok(!restored.discoveries.read.includes("mutations:Ovos"));
  assert.ok(!restored.pieces[0].traits.includes("Ovos"));
  assert.equal(dispersalMode(restored.pieces[0]), "local");
  assert.ok(!hiddenRecessiveTraits(restored.pieces[0]).includes("Esporos"));
  assert.equal(restored.pieces[0].reproGenes, undefined);
  assert.equal(restored.pieces[0].recessiveTraits, undefined);
  assertState(restored);
});

test("v7 saves rename Construção de Nicho and preserve it as lineage ancestry", () => {
  const old = createState(122),
    piece = old.pieces[0];
  old.version = 7;
  for (const candidate of old.pieces) delete candidate.genome;
  old.totalCycles = 2;
  old.cycle = 2;
  piece.traits = ["Construção de Nicho"];
  delete piece.ancestry;
  old.historicalTraits = ["Construção de Nicho"];
  old.seenMutations = ["Construção de Nicho", "Perda de Construção de Nicho"];
  old.discoveries.mutations = ["Construção de Nicho"];
  old.discoveries.read = ["mutations:Construção de Nicho"];

  const restored = deserialize(JSON.stringify(old)),
    migrated = restored.pieces[0];
  assert.ok(migrated.traits.includes("Construtor de Nicho"));
  assert.ok(migrated.traits.includes("Multicelularismo"));
  assert.ok(migrated.ancestry.includes("Construtor de Nicho"));
  assert.ok(migrated.ancestry.includes("Respiração anaeróbia"));
  assert.deepEqual(restored.historicalTraits, [
    "Respiração anaeróbia",
    "Construtor de Nicho",
  ]);
  assert.ok(restored.seenMutations.includes("Construtor de Nicho"));
  assert.ok(restored.seenMutations.includes("Perda de Construtor de Nicho"));
  assert.ok(restored.discoveries.mutations.includes("Construtor de Nicho"));
  assert.ok(restored.discoveries.read.includes("mutations:Construtor de Nicho"));
  assertState(restored);
});

test("legacy amniotic eggs migrate to fixed eggs that hatch next round", () => {
  const old = createState(92),
    parent = old.pieces[0];
  old.eggs.push({
    id: old.nextEgg++,
    owner: parent.owner,
    r: 3,
    c: 3,
    hatchRound: 5,
    parentId: parent.id,
    brood: [
      {
        owner: parent.owner,
        rank: parent.rank,
        traits: [...parent.traits],
        reproGenes: ancestralReproGenes(),
        mutations: 0,
        generation: 1,
        parentId: parent.id,
      },
    ],
    dispersal: "local",
  });
  old.maxGenerationReached = 1;
  const restored = deserialize(JSON.stringify(old)),
    egg = restored.eggs[0];
  assert.equal(egg.mode, "amniote");
  assert.equal(egg.lifecycle, "fixed");
  assert.equal(egg.laidRound, 0);
  assert.equal(egg.hatchRound, 1);
  assert.equal(egg.expireRound, 1);
  assertState(restored);
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


test("v7 saves migrate Construtor Avançado to Antropização and initialize new phases", () => {
  const old = createState(132);
  old.version = 7;
  for (const piece of old.pieces) delete piece.genome;
  old.pieces[0].traits = ["Construtor Avançado"];
  old.pieces[0].ancestry = ["Construtor Avançado"];
  old.historicalTraits = ["Construtor Avançado"];
  delete old.domesticPlacement;
  delete old.socialDefense;
  const restored = deserialize(JSON.stringify(old));
  assert.ok(restored.pieces[0].traits.includes("Antropização"));
  assert.ok(restored.pieces[0].traits.includes("Multicelularismo"));
  assert.ok(restored.pieces[0].ancestry.includes("Antropização"));
  assert.ok(restored.pieces[0].ancestry.includes("Respiração anaeróbia"));
  assert.deepEqual(restored.historicalTraits, [
    "Respiração anaeróbia",
    "Antropização",
  ]);
  assert.equal(restored.domesticPlacement, null);
  assert.equal(restored.socialDefense, null);
  assertState(restored);
});


test("current saves normalize derived photosynthetic forms back to Pawn", () => {
  const s = createState(150);
  s.pieces[0].rank = 5;
  s.pieces[0].genome = genomeFromTraits([
    "Respiração anaeróbia",
    "Fotossíntese",
  ]);
  syncGenomePhenotype(s.pieces[0], "Fotossíntese");
  s.pieces[0].ancestry = ["Respiração anaeróbia", "Fotossíntese"];
  const restored = deserialize(JSON.stringify(s));
  assert.equal(restored.pieces[0].rank, 0);
  assert.deepEqual(restored.pieces[0].traits, [
    "Respiração anaeróbia",
    "Fotossíntese",
  ]);
  assertState(restored);
});
