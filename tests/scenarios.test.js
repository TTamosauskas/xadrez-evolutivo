import test from "node:test";
import assert from "node:assert/strict";
import { EVENTS, STATE_VERSION } from "../src/constants.js";
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
  completeArenaGenome,
  arenaRecessivePairs,
  arenaTraitCost,
} from "../src/arena.js";
import {
  createArenaState,
  createArenaSuccessorState,
  createCampaignState,
  createPeriodState,
  createState,
  createSuccessorState,
  earthFounderStarts,
  CANONICAL_FOUNDER_CELLS,
  canonicalFounderStarts,
  dominantLineage,
  registerDiscoveries,
  newPiece,
} from "../src/state.js";
import { deserialize } from "../src/storage.js";
import { hiddenRecessiveTraits } from "../src/reproductive-genetics.js";
import { movesFor } from "../src/moves.js";
import {
  genomeFromTraits,
  genomeSignature,
  syncGenomePhenotype,
} from "../src/genetics.js";

test("new campaigns default to Vida na Terra while low-level legacy states stay alternative", () => {
  assert.equal(createCampaignState(1).scenario, "earth");
  assert.equal(createState(1).scenario, "alternative");
});

test("Vida na Terra disperses aquatic founders progressively through early geological stages", () => {
  const seeds = [1, 500, 1500],
    distance = (starts) => {
      const blue = starts.filter(([owner]) => owner === "blue"),
        amber = starts.filter(([owner]) => owner === "amber");
      return Math.min(
        ...blue.flatMap(([, br, bc]) =>
          amber.map(([, ar, ac]) => Math.max(Math.abs(br - ar), Math.abs(bc - ac))),
        ),
      );
    };

  for (const cycle of [1, 2, 3]) {
    const layouts = seeds.map((rng) =>
      earthFounderStarts("archean", cycle, { rng }),
    );
    assert.equal(
      new Set(layouts.map((layout) => JSON.stringify(layout))).size,
      3,
      `Arqueano · ${cycle}º Ciclo deve variar com a semente`,
    );
    for (const layout of layouts) {
      assert.equal(new Set(layout.map(([, r, c]) => `${r},${c}`)).size, 4);
      assert.equal(layout.filter(([owner]) => owner === "blue").length, 2);
      assert.equal(layout.filter(([owner]) => owner === "amber").length, 2);
      const min = cycle === 1 ? 2 : 1,
        max = cycle === 1 ? 5 : 6;
      assert.ok(
        layout.every(([, r, col]) => r >= min && r <= max && col >= min && col <= max),
      );
    }
  }
  assert.ok(
    distance(earthFounderStarts("archean", 1, { rng: 1 })) <
      distance(earthFounderStarts("archean", 3, { rng: 1500 })),
  );

  assert.deepEqual(earthFounderStarts("proterozoic", 1), [
    ["blue", 5, 2, "primary"],
    ["blue", 5, 3, "companion"],
    ["amber", 2, 4, "primary"],
    ["amber", 2, 5, "companion"],
  ]);
  assert.deepEqual(earthFounderStarts("ediacaran", 1), [
    ["blue", 6, 2, "primary"],
    ["blue", 6, 3, "companion"],
    ["amber", 1, 4, "primary"],
    ["amber", 1, 5, "companion"],
  ]);
  assert.equal(earthFounderStarts("cambrian", 1), null);
  assert.equal(earthFounderStarts("ordovician", 1), null);

  const coords = (state) =>
    state.pieces.map((piece) => [piece.owner, piece.r, piece.c]);

  assert.deepEqual(coords(createPeriodState("proterozoic", 701)), [
    ["blue", 5, 2],
    ["blue", 5, 3],
    ["amber", 2, 4],
    ["amber", 2, 5],
  ]);
  assert.deepEqual(coords(createPeriodState("ediacaran", 702)), [
    ["blue", 6, 2],
    ["blue", 6, 3],
    ["amber", 1, 4],
    ["amber", 1, 5],
  ]);
  const canonicalPool = new Set(
    CANONICAL_FOUNDER_CELLS.map(({ r, c }) => `${r},${c}`),
  );
  for (const stage of ["cambrian", "ordovician"]) {
    const state = createPeriodState(stage, 703),
      positions = coords(state);
    assert.equal(positions.length, 4);
    assert.equal(
      new Set(positions.map(([, r, c]) => `${r},${c}`)).size,
      4,
    );
    assert.ok(
      positions.every(([, r, c]) => canonicalPool.has(`${r},${c}`)),
    );
  }

  const prior = createState(704, {
    scenario: "earth",
    geologicalStage: "archean",
    cycle: 1,
    totalCycles: 1,
    historicalTraits: ["Fotossíntese", "Predação"],
    founders: {
      primary: {
        rank: 4,
        traits: ["Fotossíntese"],
        ancestry: ["Fotossíntese"],
      },
      companion: {
        rank: 4,
        traits: ["Predação"],
        ancestry: ["Predação"],
      },
    },
    canonicalPair: true,
  });
  prior.result = { winner: "blue", reason: "Extinção total." };
  prior.phase = "over";
  const archeanCycle2 = createSuccessorState(prior, 705);
  assert.equal(archeanCycle2.geologicalStage, "archean");
  assert.equal(archeanCycle2.cycle, 2);
  const expectedCycle2 = earthFounderStarts("archean", 2, { rng: 705 }).map(
    ([owner, r, col]) => [owner, r, col],
  );
  assert.deepEqual(coords(archeanCycle2), expectedCycle2);
  assert.ok(
    archeanCycle2.pieces.every(
      (piece) => archeanCycle2.board[piece.r * 8 + piece.c] === "fertile",
    ),
  );
});

test("derived lineages outrank larger basal clone groups when choosing a founder", () => {
  const s = createState(706, {
    geologicalStage: "archean",
    naturalBarriers: false,
  });
  s.pieces = [];
  s.nextId = 1;
  const weakA = newPiece(s, "blue", 4, 2, {
      rank: 4,
      traits: ["Predação"],
      ancestry: ["Respiração anaeróbia", "Predação"],
      generation: 1,
    }),
    weakB = newPiece(s, "blue", 4, 3, {
      rank: 4,
      traits: ["Predação"],
      ancestry: ["Respiração anaeróbia", "Predação"],
      generation: 1,
    }),
    derived = newPiece(s, "blue", 5, 2, {
      rank: 4,
      traits: ["Predação", "Reparo Celular"],
      ancestry: ["Respiração anaeróbia", "Predação", "Reparo Celular"],
      generation: 2,
    });
  s.pieces.push(weakA, weakB, derived);

  const selected = dominantLineage(
    s,
    "blue",
    (piece) => piece.traits.includes("Predação"),
  );
  assert.equal(selected.piece.id, derived.id);
  assert.equal(selected.count, 1);
});

test("Vida na Terra carries living and remembered energy branches into the next Archean cycle", () => {
  const prior = createState(707, {
    scenario: "earth",
    geologicalStage: "archean",
    cycle: 1,
    totalCycles: 1,
    historicalTraits: [
      "Respiração anaeróbia",
      "Fotossíntese",
      "Predação",
    ],
    naturalBarriers: false,
  });
  prior.pieces = [];
  prior.nextId = 1;
  prior.energyBranchRepresentatives = {
    Fotossíntese: null,
    Predação: null,
  };

  const extinctPlant = newPiece(prior, "blue", 4, 2, {
      rank: 4,
      traits: ["Fotossíntese", "Reparo Celular"],
      ancestry: [
        "Respiração anaeróbia",
        "Fotossíntese",
        "Reparo Celular",
      ],
      generation: 3,
    }),
    livingPredator = newPiece(prior, "amber", 3, 5, {
      rank: 4,
      traits: ["Predação", "Transferência Horizontal"],
      ancestry: [
        "Respiração anaeróbia",
        "Predação",
        "Transferência Horizontal",
      ],
      generation: 4,
    });
  prior.pieces.push(extinctPlant, livingPredator);
  registerDiscoveries(prior, extinctPlant);
  registerDiscoveries(prior, livingPredator);
  prior.pieces = [livingPredator];
  prior.result = { winner: "amber", reason: "Extinção total." };
  prior.phase = "over";

  const next = createSuccessorState(prior, 708),
    plants = next.pieces.filter((piece) => piece.traits.includes("Fotossíntese")),
    predators = next.pieces.filter((piece) => piece.traits.includes("Predação"));

  assert.equal(next.geologicalStage, "archean");
  assert.equal(next.cycle, 2);
  assert.equal(plants.length, 2);
  assert.equal(predators.length, 2);
  assert.ok(plants.every((piece) => piece.traits.includes("Reparo Celular")));
  assert.ok(
    predators.every((piece) =>
      piece.traits.includes("Transferência Horizontal"),
    ),
  );
  assert.ok(next.historicalTraits.includes("Fotossíntese"));
  assert.ok(next.historicalTraits.includes("Predação"));
});

test("first Archean successor supplies a missing fundamental branch as a final fixation fallback", () => {
  const prior = createState(709, {
    scenario: "earth",
    geologicalStage: "archean",
    cycle: 1,
    totalCycles: 1,
    historicalTraits: ["Respiração anaeróbia", "Fotossíntese"],
    naturalBarriers: false,
  });
  prior.pieces = prior.pieces.filter((piece) =>
    piece.traits.includes("Fotossíntese"),
  );
  prior.result = { winner: "blue", reason: "Extinção total." };
  prior.phase = "over";

  const next = createSuccessorState(prior, 710);
  assert.equal(
    next.pieces.filter((piece) => piece.traits.includes("Fotossíntese")).length,
    2,
  );
  assert.equal(
    next.pieces.filter((piece) => piece.traits.includes("Predação")).length,
    2,
  );
  assert.ok(next.historicalTraits.includes("Fotossíntese"));
  assert.ok(next.historicalTraits.includes("Predação"));
});

test("canonical founder pool prevents immediate queen and knight captures", () => {
  assert.deepEqual(
    CANONICAL_FOUNDER_CELLS.map(({ label }) => label),
    ["a1", "b5", "c8", "d6", "e3", "f7", "g2", "h4"],
  );
  const pool = new Set(
      CANONICAL_FOUNDER_CELLS.map(({ r, c }) => `${r},${c}`),
    ),
    capacity = ({ r, c }) =>
      (1 + Number(r > 0) + Number(r < 7)) *
        (1 + Number(c > 0) + Number(c < 7)) -
      1,
    traits = [
      "Reparo Celular",
      "Multicelularismo",
      "Predação",
      "Simetria Bilateral",
      "Locomoção Primitiva",
      "Vertebrado",
      "Locomoção Articulada",
      "Percepção Espacial",
    ],
    seen = new Set();

  for (let seed = 1; seed <= 1024; seed++)
    for (const [, r, c] of canonicalFounderStarts({ rng: seed }, false))
      seen.add(`${r},${c}`);

  for (const rank of [1, 5])
    for (let seed = 1; seed <= 32; seed++) {
      const state = createState(seed, {
          scenario: "alternative",
          founder: { rank, traits, ancestry: traits },
          naturalBarriers: false,
        }),
        blue = state.pieces.filter((piece) => piece.owner === "blue"),
        amber = state.pieces.filter((piece) => piece.owner === "amber");

      assert.equal(state.pieces.length, 4);
      assert.equal(
        new Set(state.pieces.map((piece) => `${piece.r},${piece.c}`)).size,
        4,
      );
      for (const piece of state.pieces) {
        assert.ok(pool.has(`${piece.r},${piece.c}`));
        seen.add(`${piece.r},${piece.c}`);
        assert.equal(
          movesFor(state, piece).some((target) => target.capture),
          false,
          `rank ${rank}, seed ${seed}`,
        );
      }

      const blueCapacity = blue.reduce((sum, piece) => sum + capacity(piece), 0),
        amberCapacity = amber.reduce(
          (sum, piece) => sum + capacity(piece),
          0,
        );
      assert.ok(Math.abs(blueCapacity - amberCapacity) <= 1);
    }

  assert.deepEqual([...seen].sort(), [...pool].sort());
});

test("canonical founders receive nearby fertile access outside aquatic stages", () => {
  for (const [stage, seed] of [
    ["silurian", 811],
    ["devonian", 812],
    ["permian", 813],
    ["quaternary", 814],
  ]) {
    const state = createPeriodState(stage, seed),
      nearbyFertile = (piece) => {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const r = piece.r + dr,
              c = piece.c + dc;
            if (
              r >= 0 &&
              r < 8 &&
              c >= 0 &&
              c < 8 &&
              state.board[r * 8 + c] === "fertile"
            )
              return true;
          }
        return false;
      };
    assert.ok(
      state.pieces.every(nearbyFertile),
      `${stage} deixou fundador sem recurso fértil próximo`,
    );
  }
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
  assert.deepEqual(weights, {});
});

test("Arena completes Carnívoro with its multicellular foundation", () => {
  const completed = completeArenaGenome(["Predação", "Carnívoro"], "Carnívoro");
  assert.ok(completed.includes("Predação"));
  assert.ok(completed.includes("Multicelularismo"));
  assert.ok(completed.includes("Carnívoro"));
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
  assert.equal(state.version, STATE_VERSION);
  assert.equal(state.scenario, "arena");
  assert.equal(state.arenaPhase, 1);
  assert.equal(state.pieces.length, 4);

  state.geologicalStage = "archean";
  const predator = state.pieces.find(
    (piece) =>
      piece.owner === "blue" &&
      piece.traits.includes("Predação"),
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
    assert.equal(arenaTraitCost(genome), ARENA_TRAIT_BUDGET);
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
    [3, 2],
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
        trait === "Percepção Espacial" ? "Camuflagem" : trait,
      ),
      [...ARENA_ARCHETYPES[4]],
    ],
    changes = arenaInterventionCount(before, after);
  assert.equal(changes.substitutions, 1);
  assert.equal(changes.valid, true);
});

test("obsolete development saves are rejected instead of migrated", () => {
  const legacy = createState(7);
  legacy.version = 11;
  assert.throws(
    () => deserialize(JSON.stringify(legacy)),
    /incompatível/i,
  );
});
