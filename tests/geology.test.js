import test from "node:test";
import assert from "node:assert/strict";
import { TRAITS, EVENTS, has, STATE_VERSION } from "../src/constants.js";
import {
  GEOLOGICAL_STAGES,
  TRAIT_STAGE,
  ACTIVE_TRAIT_FAMILIES,
  applyTraitLoss,
  applyTraitMutation,
  captureUnlocked,
  currentGeologicalStage,
  availablePathogenAgents,
  sexualPathogenUnlocked,
  fecalPathogenUnlocked,
  sporePathogenUnlocked,
  aquaticTerrainCell,
  conwayUnlocked,
  deleteriousMutationUnlocked,
  NEGATIVE_TRAITS,
  NEGATIVE_TRAIT_RULES,
  eventWeights,
  innovationWeight,
  cyclePositiveInnovationMultiplier,
  CYCLE_POSITIVE_INNOVATION_MULTIPLIERS,
  missingInnovations,
  periodInnovations,
  periodCompletionInnovations,
  normalizeActiveTraits,
  pawnMutationUnlocked,
  stageComplete,
  traitUnlocked,
  traitLossAllowed,
  PLANT_DERIVED_TRAITS,
  MULTICELLULAR_DEPENDENT_TRAITS,
} from "../src/geology.js";
import {
  assertState,
  consumeFertileTerrain,
  createPeriodState,
  createState,
  createSuccessorState,
  strongestSurvivor,
  newPiece,
  registerDiscoveries,
  restoreAquaticFertility,
  lethalHazardAt,
} from "../src/state.js";
import { movesFor } from "../src/moves.js";
import { context } from "../src/engine.js";
import { tickEnvironment } from "../src/environment.js";

test("geological timeline assigns every positive mutation to one stage", () => {
  const positive = Object.keys(TRAITS).filter((trait) => !NEGATIVE_TRAITS.has(trait));
  assert.deepEqual(
    [...new Set(Object.keys(TRAIT_STAGE))].sort(),
    [...positive].sort(),
  );
  const required = GEOLOGICAL_STAGES.flatMap((stage) => stage.required);
  assert.equal(required.length, new Set(required).size);
  for (const trait of required) assert.equal(TRAIT_STAGE[trait] !== undefined, true);
});

test("every negative mutation has an explicit valid debut phase", () => {
  const validStages = new Set(GEOLOGICAL_STAGES.map((stage) => stage.id));
  for (const [trait, rule] of Object.entries(NEGATIVE_TRAIT_RULES)) {
    assert.ok(rule.stage, trait);
    assert.ok(validStages.has(rule.stage), `${trait}: ${rule.stage}`);
  }
  for (const trait of ["Esterilidade", "Mutação Letal", "Mutação Disfuncional"])
    assert.equal(NEGATIVE_TRAIT_RULES[trait].stage, "eoarchean");
  assert.equal(NEGATIVE_TRAIT_RULES["Mutação Mutadora"].stage, "mesoarchean");
  assert.equal(NEGATIVE_TRAIT_RULES.Subfertilidade.stage, "calymmian");
  assert.equal(NEGATIVE_TRAIT_RULES["Anemia Falciforme"].stage, "pleistocene");

  const state = createState(1001, {
      scenario: "earth",
      geologicalStage: "eoarchean",
      totalCycles: 1,
    }),
    piece = state.pieces[0];
  assert.equal(traitUnlocked(state, "Esterilidade", piece), false);
  state.totalCycles = 2;
  assert.equal(traitUnlocked(state, "Esterilidade", piece), true);
});
test("new positive discoveries become progressively rarer and stop after six per cycle", () => {
  const s = createState(1004, {
      scenario: "earth",
      geologicalStage: "proterozoic",
    }),
    trait = "Brotamento",
    fillers = [
      "Fotossíntese",
      "Predação",
      "Reparo Celular",
      "Dormência",
      "Multicelularismo",
      "Resistência",
    ];

  assert.deepEqual(CYCLE_POSITIVE_INNOVATION_MULTIPLIERS, [
    1,
    1,
    0.6,
    0.35,
    0.2,
    0.1,
  ]);

  const expected = [1, 1, 0.6, 0.35, 0.2, 0.1, 0];
  for (let count = 0; count <= 6; count++) {
    s.cyclePositiveInnovations = fillers.slice(0, count);
    assert.equal(
      cyclePositiveInnovationMultiplier(s, trait),
      expected[count],
      `count ${count}`,
    );
  }

  s.cyclePositiveInnovations = [...fillers];
  s.historicalTraits.push(trait);
  assert.equal(cyclePositiveInnovationMultiplier(s, trait), 1);

  s.historicalTraits = s.historicalTraits.filter(
    (candidate) => candidate !== trait,
  );
  s.cyclePositiveInnovations = [trait, ...fillers.slice(0, 5)];
  assert.equal(cyclePositiveInnovationMultiplier(s, trait), 1);

  s.scenario = "arena";
  s.cyclePositiveInnovations = [...fillers];
  assert.equal(cyclePositiveInnovationMultiplier(s, trait), 1);
});

test("cycle transition resets hidden positive-innovation pressure inside a multi-cycle phase", () => {
  const prior = GEOLOGICAL_STAGES.slice(
      0,
      GEOLOGICAL_STAGES.findIndex((stage) => stage.id === "ediacaran"),
    ).flatMap((stage) => stage.required),
    state = createState(1005, {
      scenario: "earth",
      geologicalStage: "ediacaran",
      cycle: 1,
      totalCycles: 14,
      historicalTraits: [...prior, "Simetria Bilateral", "Locomoção Primitiva"],
      cyclePositiveInnovations: [
        "Fotossíntese", "Predação", "Reparo Celular",
        "Dormência", "Multicelularismo", "Resistência",
      ],
    });
  state.openingMutationSatisfied = { blue: true, amber: true };
  state.result = { winner: "blue", reason: "teste" };
  state.phase = "over";

  const next = createSuccessorState(state, 1006);
  assert.equal(next.geologicalStage, "ediacaran");
  assert.equal(next.cycle, 2);
  assert.deepEqual(next.cyclePositiveInnovations, []);
  assert.deepEqual(next.openingMutationSatisfied, { blue: false, amber: false });
  assert.equal(cyclePositiveInnovationMultiplier(next, "Zoorremediação"), 1);
});
test("geological phases follow the expanded didactic sequence and declare mandatory cycles", () => {
  assert.deepEqual(
    GEOLOGICAL_STAGES.map((stage) => stage.id),
    [
      "hadean",
      "eoarchean", "paleoarchean", "mesoarchean", "neoarchean",
      "siderian", "rhyacian", "orosirian", "statherian",
      "calymmian", "ectasian", "stenian", "tonian", "cryogenian", "ediacaran",
      "cambrian", "ordovician", "silurian", "devonian", "carboniferous", "permian",
      "triassic", "jurassic", "cretaceous",
      "paleocene", "eocene", "oligocene",
      "miocene", "pliocene", "pleistocene", "holocene",
    ],
  );

  const byId = Object.fromEntries(GEOLOGICAL_STAGES.map((stage) => [stage.id, stage]));
  assert.deepEqual(byId.eoarchean.cycles, [["Quimiossíntese"]]);
  assert.deepEqual(byId.paleoarchean.cycles, [["Fotossíntese", "Predação"]]);
  assert.deepEqual(byId.mesoarchean.cycles, [["Reparo Celular"]]);
  assert.deepEqual(byId.neoarchean.cycles, [["Dormência"]]);
  assert.deepEqual(byId.ediacaran.cycles, [
    ["Simetria Bilateral", "Locomoção Primitiva"],
    ["Escavador", "Construtor de Nicho"],
    ["Biomineralização"],
  ]);
  assert.deepEqual(byId.cambrian.cycles, [
    ["Locomoção Articulada", "Percepção Espacial"],
    ["Carapaça", "Camuflagem"],
    ["Toxicidade"],
  ]);
  assert.deepEqual(byId.silurian.cycles, [["Locomoção Terrestre"], ["Coletor"]]);
  assert.deepEqual(byId.devonian.cycles, [["Respiração Pulmonar"], ["Onívoro"]]);
  assert.deepEqual(byId.pliocene.cycles, [["Polegar Opositor"], ["Córtex Pré-Frontal"]]);
  for (const stage of GEOLOGICAL_STAGES.filter((entry) => entry.cycles?.length))
    assert.deepEqual(
      [...new Set(stage.cycles.flat())].sort(),
      [...new Set(stage.required)].sort(),
      stage.id,
    );
});
test("Hadean respiration precedes Eoarchean chemosynthesis and Paleoarchean energy branches", () => {
  const basal = {
      traits: ["Respiração anaeróbia"],
      ancestry: ["Respiração anaeróbia"],
    },
    eo = createState(109, {
      scenario: "earth",
      geologicalStage: "eoarchean",
      historicalTraits: ["Respiração anaeróbia"],
    });
  assert.equal(TRAIT_STAGE["Respiração anaeróbia"], "hadean");
  assert.equal(traitUnlocked(eo, "Quimiossíntese", basal), true);
  assert.equal(traitUnlocked(eo, "Fotossíntese", basal), false);
  assert.equal(traitUnlocked(eo, "Predação", basal), false);

  const paleo = createState(110, {
    scenario: "earth",
    geologicalStage: "paleoarchean",
    historicalTraits: ["Respiração anaeróbia", "Quimiossíntese"],
  });
  assert.equal(traitUnlocked(paleo, "Fotossíntese", basal), true);
  assert.equal(traitUnlocked(paleo, "Predação", basal), true);
  assert.equal(traitUnlocked(paleo, "Reparo Celular", basal), false);

  const siderian = createState(111, {
    scenario: "earth",
    geologicalStage: "siderian",
    historicalTraits: GEOLOGICAL_STAGES.slice(
      0,
      GEOLOGICAL_STAGES.findIndex((stage) => stage.id === "siderian"),
    ).flatMap((stage) => stage.required),
  });
  assert.equal(traitUnlocked(siderian, "Respiração aeróbia", basal), true);
  const aerobic = applyTraitMutation(basal.traits, "Respiração aeróbia");
  assert.ok(aerobic.includes("Respiração aeróbia"));
  assert.equal(aerobic.includes("Respiração anaeróbia"), false);
  assert.equal(has({ traits: aerobic }, "Respiração anaeróbia"), true);
});
test("Ectasian Ingestão gates predation and Stenian Carnívoro builds on it", () => {
  const historyBefore = (id) =>
      GEOLOGICAL_STAGES.slice(
        0,
        GEOLOGICAL_STAGES.findIndex((stage) => stage.id === id),
      ).flatMap((stage) => stage.required),
    predator = {
      traits: ["Predação", "Multicelularismo"],
      ancestry: ["Respiração anaeróbia", "Predação", "Multicelularismo"],
    },
    ectasian = createState(114, {
      scenario: "earth",
      geologicalStage: "ectasian",
      historicalTraits: historyBefore("ectasian"),
    });
  assert.equal(traitUnlocked(ectasian, "Ingestão", predator), true);
  assert.equal(traitUnlocked(ectasian, "Carnívoro", predator), false);

  predator.traits.push("Ingestão");
  predator.ancestry.push("Ingestão");
  const stenian = createState(115, {
    scenario: "earth",
    geologicalStage: "stenian",
    historicalTraits: [...historyBefore("stenian"), "Ingestão"],
  });
  assert.equal(traitUnlocked(stenian, "Carnívoro", predator), true);
});
test("Archean subdivisions open chemosynthesis, energy branches, repair and dormancy in order", () => {
  const basal = {
      traits: ["Respiração anaeróbia"],
      ancestry: ["Respiração anaeróbia"],
    },
    stateAt = (id, historicalTraits) =>
      createState(110, { scenario: "earth", geologicalStage: id, historicalTraits });

  const eo = stateAt("eoarchean", ["Respiração anaeróbia"]);
  assert.equal(traitUnlocked(eo, "Quimiossíntese", basal), true);
  assert.equal(traitUnlocked(eo, "Fotossíntese", basal), false);

  const paleo = stateAt("paleoarchean", ["Respiração anaeróbia", "Quimiossíntese"]);
  assert.equal(traitUnlocked(paleo, "Fotossíntese", basal), true);
  assert.equal(traitUnlocked(paleo, "Predação", basal), true);
  assert.equal(traitUnlocked(paleo, "Reparo Celular", basal), false);

  const meso = stateAt("mesoarchean", [
    "Respiração anaeróbia", "Quimiossíntese", "Fotossíntese", "Predação",
  ]);
  assert.equal(traitUnlocked(meso, "Reparo Celular", basal), true);
  assert.equal(traitUnlocked(meso, "Dormência", basal), false);

  const neo = stateAt("neoarchean", [
    "Respiração anaeróbia", "Quimiossíntese", "Fotossíntese", "Predação", "Reparo Celular",
  ]);
  assert.equal(traitUnlocked(neo, "Dormência", basal), true);
});
test("Transferência Horizontal is confined to the Mesoarchean window", () => {
  const predator = {
      traits: ["Respiração anaeróbia", "Predação"],
      ancestry: ["Respiração anaeróbia", "Predação"],
    },
    paleo = createState(111, {
      scenario: "earth",
      geologicalStage: "paleoarchean",
      historicalTraits: ["Respiração anaeróbia", "Quimiossíntese"],
    }),
    meso = createState(112, {
      scenario: "earth",
      geologicalStage: "mesoarchean",
      historicalTraits: [
        "Respiração anaeróbia", "Quimiossíntese", "Fotossíntese", "Predação",
      ],
    });
  assert.equal(traitUnlocked(paleo, "Transferência Horizontal", predator), false);
  assert.equal(traitUnlocked(meso, "Transferência Horizontal", predator), true);
});
test("Earth exposes required innovations only in their detailed phase window", () => {
  const basal = {
      traits: ["Respiração anaeróbia"],
      ancestry: ["Respiração anaeróbia"],
    },
    eo = createState(112, {
      scenario: "earth",
      geologicalStage: "eoarchean",
      historicalTraits: ["Respiração anaeróbia"],
    });
  assert.equal(traitUnlocked(eo, "Quimiossíntese", basal), true);
  assert.equal(traitUnlocked(eo, "Fotossíntese", basal), false);

  const paleo = createState(113, {
    scenario: "earth",
    geologicalStage: "paleoarchean",
    historicalTraits: ["Respiração anaeróbia", "Quimiossíntese"],
  });
  assert.equal(traitUnlocked(paleo, "Quimiossíntese", basal), false);
  assert.equal(traitUnlocked(paleo, "Fotossíntese", basal), true);
  assert.equal(traitUnlocked(paleo, "Reparo Celular", basal), false);
});
test("cellular repair and bilateral symmetry gate complex body plans", () => {
  const s = createState(113),
    p = s.pieces[0];

  s.geologicalStage = "proterozoic";
  s.historicalTraits = [
    "Respiração anaeróbia",
    "Quimiossíntese",
    "Fotossíntese",
    "Predação",
    "Reparo Celular",
    "Dormência",
    "Eucarionte",
    "Respiração aeróbia",
    "Endossimbiose",
  ];
  p.traits = ["Predação"];
  p.ancestry = ["Respiração anaeróbia", "Predação"];
  assert.equal(traitUnlocked(s, "Multicelularismo", p), false);

  p.traits.push("Reparo Celular");
  p.ancestry.push("Reparo Celular");
  assert.equal(traitUnlocked(s, "Multicelularismo", p), true);

  s.geologicalStage = "ediacaran";
  s.historicalTraits.push("Multicelularismo", "Biomineralização");
  p.traits.push("Multicelularismo");
  p.ancestry.push("Multicelularismo");
  assert.equal(traitUnlocked(s, "Simetria Bilateral", p), true);

  s.geologicalStage = "cambrian";
  p.traits.push("Locomoção Primitiva");
  p.ancestry.push("Locomoção Primitiva");
  assert.equal(traitUnlocked(s, "Vertebrado", p), false);
  p.traits.push("Simetria Bilateral");
  p.ancestry.push("Simetria Bilateral");
  assert.equal(traitUnlocked(s, "Vertebrado", p), true);
  assert.equal(traitUnlocked(s, "Artrópode", p), true);
});

test("geological event pools gain pathogen outbreaks from the Proterozoic onward", () => {
  const ids = new Set(EVENTS.map((event) => event.id));
  for (const stage of GEOLOGICAL_STAGES)
    for (const [id, weight] of Object.entries(stage.events)) {
      assert.ok(ids.has(id), `${stage.id} references ${id}`);
      assert.ok(weight > 0);
    }

  const archean = createState(70, {
      scenario: "earth",
      geologicalStage: "archean",
    }),
    proterozoic = createState(71, {
      scenario: "earth",
      geologicalStage: "proterozoic",
    });
  assert.equal(eventWeights(archean).pathogen ?? 0, 0);
  assert.ok(eventWeights(proterozoic).pathogen > 0);
});

test("Eoarchean starts on its volcanic-ocean custom board", () => {
  const state = createPeriodState("eoarchean", 101, null, "earth"),
    profile = habitatProfile("eoarchean");
  assert.equal(state.version, STATE_VERSION);
  assert.equal(state.geologicalStage, "eoarchean");
  assert.equal(state.cycle, 1);
  assert.equal(state.board.filter((terrain) => terrain === "fertile").length, profile.fertile);
  assert.equal(state.board.filter((terrain) => terrain === "hostile").length, profile.hostile);
  assert.deepEqual(state.naturalBarriers, []);
  assert.ok(state.pieces.every((piece) => !lethalHazardAt(state, piece.r, piece.c)));
  assertState(state);
});
test("Silurian is a stable coast and Devonian starts Conway terrain evolution", () => {
  const s = createPeriodState("silurian", 1201, null, "earth"),
    shoreFertileRows = new Set([0, 2, 5, 7]);

  for (let r = 0; r < 8; r++) {
    for (let col = 0; col < 3; col++)
      assert.equal(s.board[r * 8 + col], "fertile", `Silurian water ${r},${col}`);
    assert.equal(
      s.board[r * 8 + 3],
      shoreFertileRows.has(r) ? "fertile" : "neutral",
      `Silurian shore ${r},3`,
    );
  }
  const fertileCount = s.board.filter(
    (terrain) => terrain === "fertile",
  ).length;
  assert.ok(
    fertileCount >= 28 && fertileCount <= 32,
    `Silurian fertility normalized to ${fertileCount}`,
  );
  assert.equal(
    s.board.filter((terrain) => terrain === "hostile").length,
    7,
  );
  const landFertility = Array.from({ length: 8 }, (_, r) =>
    Array.from({ length: 4 }, (_, offset) => ({
      r,
      c: 4 + offset,
      terrain: s.board[r * 8 + 4 + offset],
    })),
  )
    .flat()
    .filter(({ terrain }) => terrain === "fertile");
  assert.ok(
    landFertility.every(({ r, c }) =>
      s.pieces.some(
        (piece) =>
          Math.max(Math.abs(piece.r - r), Math.abs(piece.c - c)) <= 1,
      ),
    ),
    "Silurian land fertility must stay confined to founder refuges",
  );
  assert.ok(s.naturalBarriers.every((cell) => cell % 8 >= 4));

  assert.equal(aquaticTerrainCell(s, 4, 1), true);
  assert.equal(aquaticTerrainCell(s, 0, 3), true);
  assert.equal(aquaticTerrainCell(s, 1, 3), false);
  assert.equal(aquaticTerrainCell(s, 4, 5), false);
  assert.equal(conwayUnlocked(s), false);
  assert.equal(conwayUnlocked("devonian"), true);

  const waterCell = 4 * 8 + 1;
  assert.equal(consumeFertileTerrain(s, waterCell), true);
  assert.equal(s.board[waterCell], "neutral");
  s.turn += 3;
  assert.equal(restoreAquaticFertility(s), 1);
  assert.equal(s.board[waterCell], "fertile");

  s.maxGenerationReached = 3;
  const before = [...s.board],
    nextHabitat = s.nextHabitatGeneration;
  tickEnvironment(context(s));
  assert.deepEqual(s.board, before);
  assert.equal(s.nextHabitatGeneration, nextHabitat);

  const d = createPeriodState("devonian", 1202, null, "earth");
  d.maxGenerationReached = 3;
  const devonianNext = d.nextHabitatGeneration;
  tickEnvironment(context(d));
  assert.equal(d.nextHabitatGeneration, devonianNext + 2);
  assertState(s);
  assertState(d);
});

test("Locomoção Terrestre universally removes the fertile landing gate", () => {
  const historyBeforeSilurian = GEOLOGICAL_STAGES.slice(
      0,
      GEOLOGICAL_STAGES.findIndex((stage) => stage.id === "silurian"),
    ).flatMap((stage) => stage.required),
    s = createState(1205, {
      geologicalStage: "silurian",
      historicalTraits: historyBeforeSilurian,
      naturalBarriers: false,
    });
  s.board.fill("neutral");
  s.pieces = [];
  s.nextId = 1;
  s.notices = [];
  s.board[4 * 8 + 4] = "fertile";
  s.board[4 * 8 + 3] = "fertile";
  s.board[5 * 8 + 4] = "hostile";

  const animal = newPiece(s, "blue", 4, 4, {
      rank: 4,
      traits: [
        "Multicelularismo",
        "Predação",
        "Ingestão",
        "Locomoção Primitiva",
        "Vertebrado",
        "Locomoção Articulada",
      ],
      ancestry: [
        "Predação",
        "Locomoção Primitiva",
        "Vertebrado",
        "Locomoção Articulada",
      ],
    }),
    prey = newPiece(s, "amber", 3, 4, {
      rank: 4,
      traits: ["Multicelularismo", "Predação"],
    });
  s.pieces.push(animal, prey);

  assert.equal(traitUnlocked(s, "Locomoção Terrestre", animal), true);
  assert.equal(traitUnlocked(s, "Coletor", animal), false);

  let targets = movesFor(s, animal);
  assert.ok(targets.some((target) => target.r === 4 && target.c === 3));
  assert.ok(!targets.some((target) => target.r === 3 && target.c === 4));
  assert.ok(!targets.some((target) => target.r === 5 && target.c === 4));

  animal.traits = applyTraitMutation(animal.traits, "Locomoção Terrestre");
  animal.ancestry.push("Locomoção Terrestre");
  assert.ok(animal.traits.includes("Locomoção Terrestre"));
  assert.equal(animal.traits.includes("Locomoção Articulada"), false);
  assert.equal(has(animal, "Locomoção Articulada"), true);

  targets = movesFor(s, animal);
  assert.ok(
    targets.some(
      (target) => target.r === 3 && target.c === 4 && target.capture,
    ),
  );
  assert.ok(targets.some((target) => target.r === 5 && target.c === 4));

  s.historicalTraits.push("Locomoção Terrestre");
  s.cycle = 2;
  assert.equal(traitUnlocked(s, "Coletor", animal), true);

  const cambrian = createState(1206, {
    geologicalStage: "cambrian",
    naturalBarriers: false,
  });
  cambrian.board.fill("neutral");
  cambrian.pieces = [];
  cambrian.nextId = 1;
  const marine = newPiece(cambrian, "blue", 4, 4, {
    rank: 4,
    traits: [
      "Multicelularismo",
      "Predação",
      "Locomoção Primitiva",
      "Vertebrado",
      "Locomoção Articulada",
    ],
  });
  cambrian.pieces.push(marine);
  assert.equal(
    movesFor(cambrian, marine).some(
      (target) => target.r === 3 && target.c === 4,
    ),
    false,
  );
  cambrian.board[3 * 8 + 4] = "fertile";
  assert.ok(
    movesFor(cambrian, marine).some(
      (target) => target.r === 3 && target.c === 4,
    ),
  );
});

test("Predação enables capture and is an individual prerequisite for Locomoção", () => {
  const history = GEOLOGICAL_STAGES.slice(0, 2).flatMap((stage) => stage.required),
    s = createState(102, {
      geologicalStage: "ediacaran",
      historicalTraits: history,
      naturalBarriers: false,
    });
  s.pieces = [];
  s.nextId = 1;
  s.board.fill("neutral");
  const blue = newPiece(s, "blue", 4, 0, {
      rank: 3,
      traits: ["Predação", "Locomoção Primitiva"],
    }),
    amber = newPiece(s, "amber", 4, 1, { traits: [] });
  s.pieces.push(blue, amber);
  s.board[4 * 8 + 1] = "fertile";
  assert.equal(captureUnlocked(s, blue), true);
  assert.ok(movesFor(s, blue).some((target) => target.c === 1));

  const ancestral = { traits: [] };
  assert.equal(traitUnlocked(s, "Locomoção Primitiva", ancestral), false);
  ancestral.traits.push("Predação", "Multicelularismo");
  assert.equal(traitUnlocked(s, "Locomoção Primitiva", ancestral), false);
  s.historicalTraits.push("Biomineralização", "Simetria Bilateral");
  ancestral.traits.push("Simetria Bilateral");
  assert.equal(traitUnlocked(s, "Locomoção Primitiva", ancestral), true);
});

test("registering a new evolutionary discovery does not open a Marco Evolutivo modal", () => {
  const s = createState(116),
    p = s.pieces[0];
  p.traits.push("Fotossíntese");
  registerDiscoveries(s, p);
  assert.ok(s.historicalTraits.includes("Fotossíntese"));
  assert.ok(!s.notices.some((notice) => notice.title === "Marco Evolutivo"));
});

test("Archean advances through four detailed phases after each mandatory set appears", () => {
  let state = createPeriodState("eoarchean", 103, null, "earth");
  state.pieces[0].traits.push("Quimiossíntese");
  registerDiscoveries(state, state.pieces[0]);
  assert.equal(stageComplete(state), true);
  state.result = { winner: "blue", reason: "teste" };
  state.phase = "over";

  state = createSuccessorState(state, 104);
  assert.equal(state.geologicalStage, "paleoarchean");
  const plant = state.pieces.find((piece) => piece.owner === "blue"),
    predator = state.pieces.find((piece) => piece.owner === "amber");
  plant.traits.push("Fotossíntese");
  predator.traits.push("Predação");
  registerDiscoveries(state, plant);
  registerDiscoveries(state, predator);
  assert.equal(stageComplete(state), true);
  state.result = { winner: "blue", reason: "teste" };
  state.phase = "over";

  state = createSuccessorState(state, 105);
  assert.equal(state.geologicalStage, "mesoarchean");
  state.pieces[0].traits.push("Reparo Celular");
  registerDiscoveries(state, state.pieces[0]);
  assert.equal(stageComplete(state), true);
  state.result = { winner: "blue", reason: "teste" };
  state.phase = "over";

  state = createSuccessorState(state, 106);
  assert.equal(state.geologicalStage, "neoarchean");
  state.pieces[0].traits.push("Dormência");
  registerDiscoveries(state, state.pieces[0]);
  assert.equal(stageComplete(state), true);
  state.result = { winner: "blue", reason: "teste" };
  state.phase = "over";

  state = createSuccessorState(state, 107);
  assert.equal(state.geologicalStage, "siderian");
  assert.equal(state.cycle, 1);
});
test("optional innovations do not add cycles once the mandatory phase set is complete", () => {
  const state = createState(1002, {
    scenario: "earth",
    geologicalStage: "mesoarchean",
    cycle: 1,
    totalCycles: 3,
    historicalTraits: [
      "Respiração anaeróbia", "Quimiossíntese",
      "Fotossíntese", "Predação", "Reparo Celular",
    ],
  });
  assert.ok(periodInnovations(state).includes("Transferência Horizontal"));
  assert.equal(periodCompletionInnovations(state).includes("Transferência Horizontal"), false);
  assert.deepEqual(missingInnovations(state), []);
  assert.equal(stageComplete(state), true);
});
test("Earth successors preserve strongest living forms while fresh detailed phases use canonical founders", () => {
  const state = createPeriodState("ediacaran", 198, null, "earth"),
    bestPhoto = strongestSurvivor(
      state, null, (piece) => piece.traits.includes("Fotossíntese"),
    ).piece,
    bestNonPhoto = strongestSurvivor(
      state, null, (piece) => !piece.traits.includes("Fotossíntese"),
    ).piece;
  state.result = { winner: "blue", reason: "teste" };
  state.phase = "over";

  const next = createSuccessorState(state, 199);
  assert.equal(next.geologicalStage, "ediacaran");
  assert.equal(next.cycle, 2);
  if (bestPhoto)
    assert.ok(
      next.pieces
        .filter((piece) => piece.traits.includes("Fotossíntese"))
        .every((piece) => piece.rank === bestPhoto.rank),
    );
  if (bestNonPhoto)
    assert.ok(
      next.pieces
        .filter((piece) => !piece.traits.includes("Fotossíntese"))
        .every((piece) => piece.rank === bestNonPhoto.rank),
    );

  for (const id of ["siderian", "cryogenian", "cambrian", "eocene", "holocene"]) {
    const fresh = createPeriodState(
      id,
      200 + GEOLOGICAL_STAGES.findIndex((stage) => stage.id === id),
    );
    assert.equal(fresh.geologicalStage, id);
    assert.equal(fresh.pieces.length, 4);
    assertState(fresh);
  }
});
test("successor gives both sides the winner's dominant lineage and its photosynthetic counterpart", () => {
  const s = createState(119);
  s.pieces = [];
  s.nextId = 1;
  const add = (owner, r, c, traits, generation = 0) =>
    s.pieces.push(newPiece(s, owner, r, c, { rank: 4, traits, generation }));

  add("amber", 0, 0, ["Predação"]);
  add("amber", 0, 1, ["Predação"]);
  add("amber", 0, 2, []);
  add("blue", 7, 0, ["Fotossíntese"]);
  add("blue", 7, 1, ["Fotossíntese"]);
  add("blue", 7, 2, ["Fotossíntese", "Dormência"]);
  s.result = { winner: "amber", reason: "teste" };
  s.phase = "over";

  const next = createSuccessorState(s, 120);
  assert.equal(next.totalCycles, 2);
  assert.equal(next.pieces.length, 4);
  for (const owner of ["blue", "amber"]) {
    const founders = next.pieces.filter((piece) => piece.owner === owner);
    assert.equal(founders.length, 2);
    assert.equal(
      founders.filter((piece) => piece.traits.includes("Predação")).length,
      1,
    );
    assert.equal(
      founders.filter((piece) => piece.traits.includes("Fotossíntese")).length,
      1,
    );
  }
  assert.ok(
    next.logs.some((entry) =>
      entry.text.includes("Dupla fundadora simétrica"),
    ),
  );
});

test("a photosynthetic winner also gives both sides the strongest non-photosynthetic counterpart", () => {
  const s = createState(121);
  s.pieces = [];
  s.nextId = 1;
  const add = (owner, r, c, traits) =>
    s.pieces.push(newPiece(s, owner, r, c, { rank: 4, traits }));

  add("blue", 7, 0, ["Fotossíntese"]);
  add("blue", 7, 1, ["Fotossíntese"]);
  add("blue", 7, 2, ["Fotossíntese"]);
  add("amber", 0, 0, ["Predação"]);
  add("amber", 0, 1, ["Predação"]);
  add("amber", 0, 2, []);
  s.result = { winner: "blue", reason: "teste" };
  s.phase = "over";

  const next = createSuccessorState(s, 122);
  assert.equal(next.pieces.length, 4);
  for (const owner of ["blue", "amber"]) {
    const founders = next.pieces.filter((piece) => piece.owner === owner);
    assert.equal(
      founders.filter((piece) => piece.traits.includes("Fotossíntese")).length,
      1,
    );
    assert.equal(
      founders.filter((piece) => piece.traits.includes("Predação")).length,
      1,
    );
  }
  assert.ok(
    next.logs.some((entry) =>
      entry.text.includes("Dupla fundadora simétrica"),
    ),
  );
});

test("a missing ecological branch is restored while the strongest living counterpart is preserved", () => {
  const s = createState(123);
  s.pieces = [];
  s.nextId = 1;
  s.pieces.push(
    newPiece(s, "blue", 7, 0, { rank: 4, traits: ["Predação"] }),
    newPiece(s, "blue", 7, 1, { rank: 1, traits: ["Predação"] }),
    newPiece(s, "amber", 0, 0, { rank: 0, traits: [] }),
  );
  s.result = { winner: "blue", reason: "teste" };
  s.phase = "over";

  const next = createSuccessorState(s, 124);
  assert.equal(next.pieces.length, 4);
  for (const owner of ["blue", "amber"]) {
    const founders = next.pieces.filter((piece) => piece.owner === owner);
    assert.equal(founders.length, 2);
    assert.equal(
      founders.filter((piece) => piece.traits.includes("Fotossíntese")).length,
      1,
    );
    const nonPhoto = founders.find(
      (piece) => !piece.traits.includes("Fotossíntese"),
    );
    assert.ok(nonPhoto);
    assert.ok(nonPhoto.traits.includes("Predação"));
    assert.equal(nonPhoto.rank, 1);
  }
});

test("late-period founders separate compact active phenotype from full ancestry", () => {
  const s = createPeriodState("quaternary", 147),
    founders = s.pieces;
  assert.ok(founders.length >= 2);
  let compacted = 0;
  for (const piece of founders) {
    assert.ok(piece.ancestry.length >= piece.traits.length);
    if (piece.ancestry.length > piece.traits.length) compacted++;
    for (const family of ACTIVE_TRAIT_FAMILIES)
      assert.ok(
        family.traits.filter((trait) => piece.traits.includes(trait)).length <= 1,
        family.id,
      );
  }
  assert.ok(compacted > 0);
});

test("evolutionary dependencies follow lineage ancestry without cumulative traits", () => {
  const s = createState(107, {
      geologicalStage: "ediacaran",
      historicalTraits: [
        ...GEOLOGICAL_STAGES.slice(0, 2).flatMap((stage) => stage.required),
        "Biomineralização",
        "Simetria Bilateral",
        "Locomoção Primitiva",
      ],
    }),
    p = s.pieces[0],
    unrelated = { traits: [], ancestry: [] };
  s.cycle = 2;

  p.ancestry = [
    "Predação",
    "Reparo Celular",
    "Multicelularismo",
    "Simetria Bilateral",
    "Locomoção Primitiva",
  ];
  p.traits = ["Multicelularismo"];
  assert.equal(traitUnlocked(s, "Escavador", p), true);
  assert.equal(traitUnlocked(s, "Escavador", unrelated), false);

  s.historicalTraits.push("Escavador");
  p.ancestry.push("Escavador");
  assert.equal(traitUnlocked(s, "Construtor de Nicho", p), true);
  assert.equal(traitUnlocked(s, "Construtor de Nicho", unrelated), false);
  p.ancestry.push("Construtor de Nicho");
  assert.equal(traitUnlocked(s, "Zoorremediação", p), true);
  assert.equal(traitUnlocked(s, "Zoorremediação", unrelated), false);
  assert.equal(periodCompletionInnovations(s).includes("Zoorremediação"), false);

  s.geologicalStage = "devonian";
  s.cycle = 2;
  s.historicalTraits = [
    ...new Set([
      ...GEOLOGICAL_STAGES.slice(0, 6).flatMap((stage) => stage.required),
    ]),
  ];
  p.ancestry.push(
    "Construtor de Nicho",
    "Vertebrado",
    "Locomoção Articulada",
    "Locomoção Terrestre",
    "Respiração aeróbia",
  );
  p.ancestry.push("Carnívoro");
  assert.equal(traitUnlocked(s, "Onívoro", p), true);

  p.traits = ["Multicelularismo", "Predação", "Vertebrado"];
  assert.equal(traitUnlocked(s, "Respiração Pulmonar", p), true);
  p.traits = ["Multicelularismo", "Predação", "Artrópode"];
  assert.equal(traitUnlocked(s, "Respiração Pulmonar", p), false);
  p.traits = ["Multicelularismo", "Predação"];
  assert.equal(traitUnlocked(s, "Respiração Pulmonar", p), false);

  s.geologicalStage = "triassic";
  p.ancestry.push("Ovíparos Amniotas");
  assert.equal(traitUnlocked(s, "Vivíparo", p), true);

  s.geologicalStage = "holocene";
  s.historicalTraits = [
    ...new Set([
      ...GEOLOGICAL_STAGES.slice(0, 14).flatMap((stage) => stage.required),
    ]),
  ];
  p.ancestry.push("Polegar Opositor");
  assert.equal(traitUnlocked(s, "Antropização", p), false);
  s.historicalTraits.push("Neocórtex Desenvolvido");
  p.ancestry.push("Neocórtex Desenvolvido");
  assert.equal(traitUnlocked(s, "Antropização", p), true);
  assert.equal(traitUnlocked(s, "Antropização", unrelated), false);
});

test("campaign history from another lineage does not satisfy ancestry prerequisites", () => {
  const s = createState(121, {
      geologicalStage: "proterozoic",
      historicalTraits: [
        "Fotossíntese",
        "Predação",
        "Dormência",
        "Multicelularismo",
        "Resistência",
        "Regeneração",
        "Reprodução Sexuada",
      ],
    }),
    descendant = {
      traits: ["Multicelularismo", "Ingestão"],
      ancestry: ["Predação", "Multicelularismo", "Ingestão"],
    },
    predatoryOutsider = { traits: [], ancestry: ["Predação"] },
    outsider = { traits: [], ancestry: [] };
  assert.equal(traitUnlocked(s, "Carnívoro", descendant), true);
  assert.equal(traitUnlocked(s, "Carnívoro", predatoryOutsider), false);
  assert.equal(traitUnlocked(s, "Carnívoro", outsider), false);
});

test("evolutionary precedence changes eligibility while missing innovations stay phase-local", () => {
  const eo = createState(108, {
      scenario: "earth",
      geologicalStage: "eoarchean",
      historicalTraits: ["Respiração anaeróbia"],
    }),
    basal = { traits: [], ancestry: ["Respiração anaeróbia"] };
  assert.equal(innovationWeight(eo, "Quimiossíntese", basal), 4);
  assert.deepEqual(missingInnovations(eo), ["Quimiossíntese"]);

  const paleo = createState(109, {
    scenario: "earth",
    geologicalStage: "paleoarchean",
    historicalTraits: ["Respiração anaeróbia", "Quimiossíntese"],
  });
  assert.equal(traitUnlocked(paleo, "Fotossíntese", basal), true);
  assert.equal(traitUnlocked(paleo, "Predação", basal), true);
  assert.deepEqual(missingInnovations(paleo), ["Fotossíntese", "Predação"]);
});
test("Paleoarchean energy branches remain parallel after ancestral Quimiossíntese", () => {
  const state = createState(114, {
      scenario: "earth",
      geologicalStage: "paleoarchean",
      cycle: 1,
      historicalTraits: ["Respiração anaeróbia", "Quimiossíntese"],
    }),
    piece = {
      traits: ["Respiração anaeróbia"],
      ancestry: ["Respiração anaeróbia", "Quimiossíntese"],
    };

  assert.equal(traitUnlocked(state, "Fotossíntese", piece), true);
  assert.equal(traitUnlocked(state, "Predação", piece), true);
  state.historicalTraits.push("Fotossíntese");
  assert.equal(traitUnlocked(state, "Predação", piece), true);
});
test("deleterious mutations unlock only from the second campaign cycle", () => {
  const s = createState(115);
  assert.equal(deleteriousMutationUnlocked(s), false);
  s.totalCycles = 2;
  assert.equal(deleteriousMutationUnlocked(s), true);
});

test("Pawn mutation unlocks only after primitive locomotion in the lineage", () => {
  const state = createState(113),
    basal = {
      traits: ["Predação"],
      ancestry: ["Respiração anaeróbia", "Predação"],
    },
    mobile = {
      traits: ["Predação", "Locomoção Primitiva"],
      ancestry: ["Respiração anaeróbia", "Predação", "Locomoção Primitiva"],
    },
    descendant = {
      traits: ["Predação"],
      ancestry: ["Respiração anaeróbia", "Predação", "Locomoção Primitiva"],
    };

  state.totalCycles = 20;
  assert.equal(pawnMutationUnlocked(state), false);
  assert.equal(pawnMutationUnlocked(state, basal), false);
  assert.equal(pawnMutationUnlocked(state, mobile), true);
  assert.equal(pawnMutationUnlocked(state, descendant), true);

  state.scenario = "arena";
  assert.equal(pawnMutationUnlocked(state, basal), false);
  assert.equal(pawnMutationUnlocked(state, mobile), true);
});

test("active phenotype families replace older expressions without erasing ancestry", () => {
  const raw = [
    "Predação",
    "Carnívoro",
    "Herbívoro",
    "Onívoro",
    "Locomoção Primitiva",
    "Locomoção Articulada",
    "Locomoção Terrestre",
    "Embriófitas",
    "Traqueófitas",
    "Gimnospermas",
    "Angiospermas",
    "Sociabilidade",
    "Eusocialidade",
  ];
  const active = normalizeActiveTraits(raw, "Predação");

  assert.ok(ACTIVE_TRAIT_FAMILIES.length >= 6);
  assert.ok(active.includes("Predação"));
  assert.ok(active.includes("Onívoro"));
  assert.ok(active.includes("Locomoção Terrestre"));
  assert.ok(active.includes("Angiospermas"));
  assert.ok(active.includes("Eusocialidade"));
  for (const suppressed of [
    "Carnívoro",
    "Herbívoro",
    "Locomoção Articulada",
    "Embriófitas",
    "Traqueófitas",
    "Gimnospermas",
    "Sociabilidade",
  ])
    assert.equal(active.includes(suppressed), false, suppressed);

  assert.deepEqual(
    applyTraitMutation(["Predação", "Carnívoro"], "Onívoro"),
    ["Predação", "Onívoro"],
  );
  assert.deepEqual(
    applyTraitLoss(
      ["Predação", "Onívoro"],
      ["Predação", "Carnívoro", "Onívoro"],
      "Onívoro",
    ),
    ["Predação", "Carnívoro"],
  );
});

test("later active phenotypes retain capabilities of the form they replaced", () => {
  const vascularSeedPlant = { traits: ["Gimnospermas"] },
    flowering = { traits: ["Angiospermas"] },
    omnivore = { traits: ["Onívoro"] },
    eusocial = { traits: ["Eusocialidade"] };

  assert.equal(has(vascularSeedPlant, "Embriófitas"), true);
  assert.equal(has(vascularSeedPlant, "Traqueófitas"), true);
  assert.equal(has(flowering, "Embriófitas"), true);
  assert.equal(has(flowering, "Traqueófitas"), true);
  assert.equal(has(omnivore, "Carnívoro"), true);
  assert.equal(has(omnivore, "Herbívoro"), true);
  assert.equal(has(eusocial, "Sociabilidade"), true);
});

test("Fotossíntese and Predação remain fixed hereditary energy branches", () => {
  const s = createState(111, { geologicalStage: "archean", cycle: 2 });
  s.historicalTraits = ["Respiração anaeróbia", "Quimiossíntese", "Fotossíntese"];
  const ancestral = {
      traits: ["Respiração anaeróbia"],
      ancestry: ["Respiração anaeróbia"],
    },
    photosynthetic = {
      traits: ["Respiração anaeróbia", "Fotossíntese"],
      ancestry: ["Respiração anaeróbia", "Fotossíntese"],
    };
  assert.equal(traitUnlocked(s, "Predação", ancestral), true);
  assert.equal(traitUnlocked(s, "Predação", photosynthetic), false);

  s.historicalTraits.push("Predação");
  const predatory = {
    traits: [
      "Respiração anaeróbia",
      "Predação",
      "Locomoção Primitiva",
      "Carnívoro",
      "Onívoro",
    ],
    ancestry: [
      "Respiração anaeróbia",
      "Predação",
      "Locomoção Primitiva",
      "Carnívoro",
      "Onívoro",
    ],
  };
  assert.equal(traitUnlocked(s, "Fotossíntese", predatory), false);
});

test("all photosynthetic innovations after Fotossíntese require Multicelularismo", () => {
  const s = createState(144, {
      geologicalStage: "quaternary",
      historicalTraits: GEOLOGICAL_STAGES.flatMap((stage) => stage.required),
    }),
    unicellularPlant = {
      traits: ["Fotossíntese"],
      ancestry: [
        "Fotossíntese",
        "Embriófitas",
        "Traqueófitas",
        "Gimnospermas",
      ],
    };

  for (const trait of PLANT_DERIVED_TRAITS) {
    assert.ok(MULTICELLULAR_DEPENDENT_TRAITS.has(trait), trait);
    assert.equal(traitUnlocked(s, trait, unicellularPlant), false, trait);
  }
});

test("Herbívoro unlocks in the Ordovician and Onívoro can descend from either diet branch", () => {
  const prior = GEOLOGICAL_STAGES.slice(
      0,
      GEOLOGICAL_STAGES.findIndex((stage) => stage.id === "ordovician"),
    ).flatMap((stage) => stage.required),
    s = createState(145, {
      geologicalStage: "ordovician",
      historicalTraits: prior,
    }),
    predator = {
      traits: ["Multicelularismo", "Predação", "Ingestão"],
      ancestry: ["Predação", "Multicelularismo", "Ingestão"],
    };

  assert.equal(traitUnlocked(s, "Herbívoro", predator), true);
  predator.traits.push("Carnívoro");
  assert.equal(traitUnlocked(s, "Herbívoro", predator), false);

  s.geologicalStage = "devonian";
  s.cycle = 2;
  s.historicalTraits = GEOLOGICAL_STAGES.slice(0, 6).flatMap(
    (stage) => stage.required,
  );
  const herbivore = {
      traits: ["Multicelularismo", "Predação", "Ingestão", "Herbívoro"],
      ancestry: ["Predação", "Multicelularismo", "Ingestão", "Herbívoro"],
    },
    carnivore = {
      traits: ["Multicelularismo", "Predação", "Ingestão", "Carnívoro"],
      ancestry: ["Predação", "Multicelularismo", "Ingestão", "Carnívoro"],
    };
  assert.equal(traitUnlocked(s, "Onívoro", herbivore), true);
  assert.equal(traitUnlocked(s, "Onívoro", carnivore), true);
});

test("new combat specializations unlock in the intended periods and lineages", () => {
  const historyBefore = (id) => {
      const index = GEOLOGICAL_STAGES.findIndex((stage) => stage.id === id);
      return GEOLOGICAL_STAGES.slice(0, index).flatMap((stage) => stage.required);
    },
    predator = {
      traits: ["Multicelularismo", "Predação", "Locomoção Primitiva", "Vertebrado"],
      ancestry: ["Predação", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre"],
    },
    herbivore = {
      traits: ["Multicelularismo", "Predação", "Herbívoro", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre"],
      ancestry: ["Predação", "Herbívoro", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre"],
    },
    carnivore = {
      traits: ["Multicelularismo", "Predação", "Carnívoro", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre"],
      ancestry: ["Predação", "Carnívoro", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre"],
    };

  const devonian = createState(181, {
    geologicalStage: "devonian",
    historicalTraits: historyBefore("devonian"),
  });
  assert.equal(traitUnlocked(devonian, "Visão Binocular", predator), true);
  assert.equal(traitUnlocked(devonian, "Velocidade", predator), false);

  const carboniferous = createState(182, {
    geologicalStage: "carboniferous",
    historicalTraits: historyBefore("carboniferous"),
  });
  assert.equal(traitUnlocked(carboniferous, "Velocidade", predator), true);

  const permian = createState(183, {
    geologicalStage: "permian",
    historicalTraits: historyBefore("permian"),
  });
  assert.equal(traitUnlocked(permian, "Pele grossa", herbivore), true);
  assert.equal(traitUnlocked(permian, "Presas", carnivore), false);
  const toothedCarnivore = {
    ...carnivore,
    ancestry: [...carnivore.ancestry, "Mandíbula", "Dentes"],
  };
  assert.equal(traitUnlocked(permian, "Presas", toothedCarnivore), true);
  assert.equal(traitUnlocked(permian, "Pele grossa", carnivore), false);
  assert.equal(traitUnlocked(permian, "Presas", herbivore), false);

  const triassic = createState(184, {
    geologicalStage: "triassic",
    cycle: 2,
    historicalTraits: [...historyBefore("triassic"), "Vivíparo"],
  });
  assert.equal(traitUnlocked(triassic, "Notívago", herbivore), true);

  const jurassic = createState(185, {
    geologicalStage: "jurassic",
    historicalTraits: historyBefore("jurassic"),
  });
  const nocturnal = {
    traits: ["Multicelularismo", "Predação", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Notívago"],
    ancestry: ["Predação", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Notívago"],
  };
  assert.equal(traitUnlocked(jurassic, "Visão Noturna", nocturnal), true);
  assert.equal(traitUnlocked(jurassic, "Visão Noturna", predator), false);
});

test("pathogen agents unlock progressively by geological period", () => {
  const stateAt = (geologicalStage) =>
    createState(1170, { geologicalStage, scenario: "earth" });

  assert.deepEqual(availablePathogenAgents(stateAt("archean")), []);
  assert.deepEqual(availablePathogenAgents(stateAt("proterozoic")), [
    "virus",
  ]);
  assert.deepEqual(availablePathogenAgents(stateAt("ediacaran")), [
    "virus",
    "bacteria",
  ]);
  assert.deepEqual(availablePathogenAgents(stateAt("cambrian")), [
    "virus",
    "bacteria",
    "fungus",
  ]);
});

test("sexual pathogen route unlocks only on the cycle after Reprodução Sexuada appears", () => {
  const s = createState(1171, {
      scenario: "earth",
      geologicalStage: "proterozoic",
      totalCycles: 4,
      historicalTraits: [
        "Respiração anaeróbia",
        "Reparo Celular",
        "Multicelularismo",
      ],
    }),
    carrier = newPiece(s, "blue", 4, 4, {
      traits: [
        "Respiração anaeróbia",
        "Reparo Celular",
        "Multicelularismo",
        "Predação",
        "Reprodução Sexuada",
      ],
      ancestry: [
        "Respiração anaeróbia",
        "Reparo Celular",
        "Multicelularismo",
        "Predação",
        "Reprodução Sexuada",
      ],
    });

  assert.equal(s.sexualPathogenUnlockTotalCycle, null);
  registerDiscoveries(s, carrier);
  assert.equal(s.sexualPathogenUnlockTotalCycle, 5);
  assert.equal(sexualPathogenUnlocked(s), false);

  s.totalCycles = 5;
  assert.equal(sexualPathogenUnlocked(s), true);

  const later = createState(1172, {
    scenario: "earth",
    geologicalStage: "ediacaran",
    totalCycles: 6,
    historicalTraits: ["Reprodução Sexuada"],
  });
  assert.equal(later.sexualPathogenUnlockTotalCycle, 6);
  assert.equal(sexualPathogenUnlocked(later), true);
});

test("fecal pathogen route begins in the Silurian", () => {
  const cambrian = createState(1173, {
      scenario: "earth",
      geologicalStage: "cambrian",
    }),
    ordovician = createState(1174, {
      scenario: "earth",
      geologicalStage: "ordovician",
    }),
    silurian = createState(1175, {
      scenario: "earth",
      geologicalStage: "silurian",
    });

  assert.equal(fecalPathogenUnlocked(cambrian), false);
  assert.equal(fecalPathogenUnlocked(ordovician), false);
  assert.equal(fecalPathogenUnlocked(silurian), true);

  const arena = createState(1176, { scenario: "arena" });
  assert.equal(fecalPathogenUnlocked(arena), true);
});

test("pathogen profile lock resets when a new cycle begins", () => {
  const s = createState(1180, {
    scenario: "earth",
    geologicalStage: "devonian",
    cycle: 1,
    totalCycles: 8,
  });
  s.cyclePathogenProfile = {
    agent: "bacteria",
    transmission: "fecal",
  };
  const next = createSuccessorState(s, 1181);
  assert.equal(next.cycle, 2);
  assert.equal(next.totalCycles, 9);
  assert.equal(next.cyclePathogenProfile, null);
  assertState(next);
});

test("fungal spore route begins in the Devonian", () => {
  const silurian = createState(1177, {
      scenario: "earth",
      geologicalStage: "silurian",
    }),
    devonian = createState(1178, {
      scenario: "earth",
      geologicalStage: "devonian",
    });

  assert.equal(sporePathogenUnlocked(silurian), false);
  assert.equal(sporePathogenUnlocked(devonian), true);

  const arena = createState(1179, { scenario: "arena" });
  assert.equal(sporePathogenUnlocked(arena), true);
});

test("Vetor Patógeno is a Cretaceous specialization of Parasitismo", () => {
  let s = createState(171, {
    geologicalStage: "jurassic",
    historicalTraits: GEOLOGICAL_STAGES.slice(0, 11).flatMap(
      (stage) => stage.required,
    ),
  });
  const p = newPiece(s, "blue", 4, 4, {
    traits: ["Multicelularismo", "Predação", "Parasitismo"],
    ancestry: ["Multicelularismo", "Predação", "Parasitismo"],
  });
  assert.equal(traitUnlocked(s, "Vetor Patógeno", p), false);

  s.geologicalStage = "cretaceous";
  assert.equal(traitUnlocked(s, "Vetor Patógeno", p), true);
  const active = applyTraitMutation(p.traits, "Vetor Patógeno");
  assert.ok(active.includes("Vetor Patógeno"));
  assert.equal(active.includes("Parasitismo"), false);
});

test("plant innovations unlock in their geological periods without becoming mandatory stage gates", () => {
  const s = createState(118, {
      geologicalStage: "ordovician",
      historicalTraits: [
        ...GEOLOGICAL_STAGES.slice(0, 4).flatMap((stage) => stage.required),
        "Fotossíntese",
      ],
    }),
    plant = { traits: ["Fotossíntese", "Multicelularismo"] };

  assert.equal(traitUnlocked(s, "Embriófitas", plant), true);
  assert.equal(traitUnlocked(s, "Traqueófitas", plant), false);

  plant.traits.push("Embriófitas");
  s.historicalTraits.push("Embriófitas");
  s.geologicalStage = "silurian";
  assert.equal(traitUnlocked(s, "Traqueófitas", plant), true);

  plant.traits.push("Traqueófitas");
  s.historicalTraits.push("Traqueófitas");
  s.geologicalStage = "devonian";
  assert.equal(traitUnlocked(s, "Espinhos", plant), true);
  assert.equal(traitUnlocked(s, "Gimnospermas", plant), false);
  assert.equal(traitUnlocked(s, "Trepadeira", plant), false);

  s.geologicalStage = "carboniferous";
  assert.equal(traitUnlocked(s, "Gimnospermas", plant), true);
  assert.equal(traitUnlocked(s, "Trepadeira", plant), true);
  assert.equal(
    traitUnlocked(s, "Trepadeira", {
      traits: ["Fotossíntese", "Embriófitas"],
    }),
    false,
  );
  plant.traits.push("Gimnospermas");
  s.historicalTraits.push("Gimnospermas");

  s.geologicalStage = "cretaceous";
  assert.equal(traitUnlocked(s, "Angiospermas", plant), true);

  for (const stage of GEOLOGICAL_STAGES)
    assert.ok(
      !stage.required.some((trait) =>
        ["Embriófitas", "Traqueófitas", "Espinhos", "Gimnospermas", "Trepadeira", "Angiospermas"].includes(trait),
      ),
    );
});

test("plant innovations require the photosynthetic lineage and exclude animal specializations", () => {
  const s = createState(117, {
      geologicalStage: "cretaceous",
      historicalTraits: [
        ...GEOLOGICAL_STAGES.slice(0, 11).flatMap((stage) => stage.required),
        "Embriófitas",
        "Traqueófitas",
        "Gimnospermas",
      ],
    }),
    plant = {
      traits: [
        "Respiração anaeróbia",
        "Fotossíntese",
        "Multicelularismo",
        "Embriófitas",
        "Traqueófitas",
        "Gimnospermas",
      ],
    };

  assert.equal(traitUnlocked(s, "Angiospermas", plant), true);
  for (const trait of [
    "Locomoção Primitiva",
    "Vertebrado",
    "Artrópode",
    "Locomoção Articulada",
    "Locomoção Terrestre",
    "Percepção Espacial",
    "Escavador",
    "Escalador",
    "Respiração Cutânea",
    "Respiração Pulmonar",
    "Sacos Aéreos",
    "Necrófago",
    "Coprofagia",
    "Ovíparo",
    "Ovíparos Amniotas",
    "Vivíparo",
    "Voo",
    "Visão Noturna",
    "Eusocialidade",
    "Chifre",
    "Construtor de Nicho",
    "Polegar Opositor",
    "Neocórtex Desenvolvido",
    "Antropização",
  ])
    assert.equal(traitUnlocked(s, trait, plant), false, trait);

  assert.equal(traitUnlocked(s, "Predação", plant), false);
});

test("switching into Fotossíntese removes animal-only traits", () => {
  const animal = [
    "Predação",
    "Locomoção Primitiva",
    "Vertebrado",
    "Locomoção Articulada",
    "Locomoção Terrestre",
    "Percepção Espacial",
    "Escavador",
    "Escalador",
    "Carnívoro",
    "Onívoro",
    "Necrófago",
    "Coprofagia",
    "Voo",
    "Chifre",
    "Construtor de Nicho",
    "Polegar Opositor",
    "Neocórtex Desenvolvido",
  ];
  assert.deepEqual(applyTraitMutation(animal, "Fotossíntese"), [
    "Fotossíntese",
  ]);
});

test("Coprofagia is a Cretaceous predatory specialization incompatible with Mixotrofia", () => {
  const s = createState(118, {
      geologicalStage: "cretaceous",
      historicalTraits: ["Predação", "Multicelularismo", "Locomoção Terrestre"],
    }),
    eligible = {
      traits: ["Predação", "Multicelularismo", "Locomoção Terrestre"],
      ancestry: ["Predação", "Multicelularismo", "Locomoção Terrestre"],
    },
    aquatic = {
      traits: ["Predação", "Multicelularismo"],
      ancestry: ["Predação", "Multicelularismo"],
    },
    mixotroph = {
      traits: [
        "Predação",
        "Multicelularismo",
        "Locomoção Terrestre",
        "Mixotrofia",
      ],
      ancestry: [
        "Predação",
        "Multicelularismo",
        "Locomoção Terrestre",
        "Mixotrofia",
      ],
    };

  assert.equal(TRAIT_STAGE.Coprofagia, "cretaceous");
  assert.equal(traitUnlocked(s, "Coprofagia", eligible), true);
  assert.equal(traitUnlocked(s, "Coprofagia", aquatic), false);
  assert.equal(traitUnlocked(s, "Coprofagia", mixotroph), false);

  const mutated = applyTraitMutation(
    ["Predação", "Multicelularismo", "Locomoção Terrestre", "Mixotrofia"],
    "Coprofagia",
  );
  assert.ok(mutated.includes("Coprofagia"));
  assert.ok(!mutated.includes("Mixotrofia"));
});

test("Neurodivergência is an optional Pliocene specialization of spatial and prefrontal cognition", () => {
  const prior = GEOLOGICAL_STAGES.slice(
      0,
      GEOLOGICAL_STAGES.findIndex((stage) => stage.id === "pliocene"),
    ).flatMap((stage) => stage.required),
    state = createState(2402, {
      geologicalStage: "pliocene",
      cycle: 2,
      historicalTraits: [...prior, "Polegar Opositor", "Córtex Pré-Frontal"],
    }),
    piece = state.pieces[0];

  piece.traits = ["Multicelularismo", "Predação", "Córtex Pré-Frontal"];
  piece.ancestry = [
    ...new Set([
      ...(piece.ancestry ?? []),
      "Percepção Espacial", "Polegar Opositor", "Córtex Pré-Frontal",
    ]),
  ];

  assert.equal(TRAIT_STAGE.Neurodivergência, "pliocene");
  assert.equal(traitUnlocked(state, "Neurodivergência", piece), true);
  assert.equal(periodCompletionInnovations(state).includes("Neurodivergência"), false);

  const missingSpatial = {
    ...piece,
    ancestry: piece.ancestry.filter((trait) => trait !== "Percepção Espacial"),
  };
  assert.equal(traitUnlocked(state, "Neurodivergência", missingSpatial), false);
});
test("Paleogene epochs split optional innovations without mandatory gates", () => {
  const expected = {
    paleocene: ["Ruminante", "Garras", "Monogamia", "Roedor"],
    eocene: ["Predação em Massa", "Ovulação Induzida", "Ecolocalização", "Caça Cooperativa", "Epizoocoria"],
    oligocene: ["Eletrodescarga", "Interceptação preditiva", "Superorganismo", "Sinzoocoria", "Mirmecocoria"],
  };
  for (const [id, traits] of Object.entries(expected)) {
    const prior = GEOLOGICAL_STAGES.slice(
        0,
        GEOLOGICAL_STAGES.findIndex((stage) => stage.id === id),
      ).flatMap((stage) => stage.required),
      state = createState(109, {
        scenario: "earth",
        geologicalStage: id,
        historicalTraits: prior,
      });
    assert.deepEqual(periodInnovations(state), traits);
    assert.deepEqual(periodCompletionInnovations(state), []);
    assert.equal(stageComplete(state), true);
    assert.deepEqual(eventWeights(state), {
      ...currentGeologicalStage(state).events,
      pathogen: 1,
    });
  }
});
test("new social, mimicry and domestication mutations unlock in the intended periods", () => {
  const historyThrough = (id) => {
      const index = GEOLOGICAL_STAGES.findIndex((stage) => stage.id === id);
      return GEOLOGICAL_STAGES.slice(0, index + 1).flatMap(
        (stage) => stage.required,
      );
    },
    s = createState(130, {
      geologicalStage: "permian",
      historicalTraits: historyThrough("permian"),
    }),
    animal = {
      traits: ["Predação", "Multicelularismo"],
      ancestry: ["Incubação", "Camuflagem"],
    },
    plant = {
      traits: ["Fotossíntese", "Multicelularismo"],
      ancestry: ["Fotossíntese"],
    };

  assert.equal(traitUnlocked(s, "Mimetismo", animal), true);
  assert.equal(traitUnlocked(s, "Sociabilidade", animal), false);

  s.geologicalStage = "jurassic";
  s.historicalTraits = historyThrough("jurassic");
  assert.equal(traitUnlocked(s, "Sociabilidade", animal), true);

  s.geologicalStage = "quaternary";
  s.historicalTraits = historyThrough("neogene");
  assert.equal(traitUnlocked(s, "Plantas Domesticadas", plant), false);
  assert.equal(traitUnlocked(s, "Animais Domésticos", animal), false);
  s.historicalTraits.push("Neocórtex Desenvolvido");
  assert.equal(traitUnlocked(s, "Plantas Domesticadas", plant), true);
  assert.equal(traitUnlocked(s, "Animais Domésticos", animal), true);
  assert.equal(traitUnlocked(s, "Plantas Domesticadas", animal), false);
  assert.equal(traitUnlocked(s, "Animais Domésticos", plant), false);

  const anthropic = {
    traits: ["Multicelularismo"],
    ancestry: ["Neocórtex Desenvolvido"],
  };
  assert.equal(traitUnlocked(s, "Antropização", anthropic), true);
  assert.equal(
    traitUnlocked(s, "Antropização", {
      traits: ["Multicelularismo"],
      ancestry: ["Construtor de Nicho"],
    }),
    false,
  );
});


test("Haustório is a Cretaceous photosynthetic innovation after Angiospermas", () => {
  const s = createState(141, {
      geologicalStage: "cretaceous",
      historicalTraits: GEOLOGICAL_STAGES.slice(0, 12).flatMap(
        (stage) => stage.required,
      ),
    }),
    plant = {
      traits: ["Respiração anaeróbia", "Fotossíntese", "Multicelularismo"],
      ancestry: [
        "Respiração anaeróbia",
        "Fotossíntese",
        "Embriófitas",
        "Traqueófitas",
        "Gimnospermas",
        "Angiospermas",
      ],
    },
    exPlant = {
      traits: ["Respiração anaeróbia", "Predação", "Multicelularismo"],
      ancestry: [
        "Respiração anaeróbia",
        "Fotossíntese",
        "Embriófitas",
        "Traqueófitas",
        "Gimnospermas",
        "Angiospermas",
        "Predação",
      ],
    };
  assert.equal(traitUnlocked(s, "Haustório", plant), true);
  assert.equal(traitUnlocked(s, "Haustório", exPlant), false);
});

test("Parasitismo becomes available in the Cambrian only outside the photosynthetic branch", () => {
  const s = createState(142, {
      geologicalStage: "cambrian",
      historicalTraits: GEOLOGICAL_STAGES.slice(0, 4).flatMap(
        (stage) => stage.required,
      ),
    }),
    animal = {
      traits: ["Predação", "Multicelularismo"],
      ancestry: ["Predação"],
    },
    plant = {
      traits: ["Fotossíntese", "Multicelularismo"],
      ancestry: ["Fotossíntese"],
    };
  assert.equal(traitUnlocked(s, "Parasitismo", animal), true);
  assert.equal(traitUnlocked(s, "Parasitismo", plant), false);
});


test("Multicelularismo is required for complex traits and cannot be lost while they remain", () => {
  const s = createState(143, {
      geologicalStage: "ediacaran",
      historicalTraits: GEOLOGICAL_STAGES.slice(
        0,
        GEOLOGICAL_STAGES.findIndex((stage) => stage.id === "ediacaran") + 1,
      ).flatMap((stage) => stage.required),
    }),
    simple = { traits: ["Predação"], ancestry: ["Predação"] },
    complex = {
      traits: ["Predação", "Multicelularismo"],
      ancestry: ["Predação"],
    };

  assert.equal(traitUnlocked(s, "Locomoção Primitiva", simple), false);
  assert.equal(traitUnlocked(s, "Locomoção Primitiva", complex), true);
  assert.equal(
    traitLossAllowed(
      { traits: ["Multicelularismo", "Locomoção Primitiva"] },
      "Multicelularismo",
    ),
    false,
  );
  assert.equal(
    traitLossAllowed({ traits: ["Multicelularismo"] }, "Multicelularismo"),
    true,
  );
});

test("severe events are distributed across the expanded geological chronology", () => {
  const byStage = Object.fromEntries(
    GEOLOGICAL_STAGES.map((stage) => [stage.id, stage.events]),
  );
  assert.ok(byStage.eoarchean.volcano > 0);
  assert.ok(byStage.cryogenian.ice > 0);
  assert.ok(byStage.ordovician.ice > 0);
  assert.ok(byStage.permian.warming > 0);
  assert.ok(byStage.cretaceous.meteor > 0);
  assert.ok(byStage.paleocene.warming > 0);
  assert.ok(byStage.miocene.warming > 0);
  assert.ok(byStage.pleistocene.ice > 0);
  assert.ok(byStage.holocene.warming > 0);
});
test("gamma-ray bursts remain concentrated in early Earth history and the Ordovician", () => {
  const events = Object.fromEntries(
    GEOLOGICAL_STAGES.map((stage) => [stage.id, stage.events]),
  );
  assert.ok(events.eoarchean.grb > 0);
  assert.ok(events.neoarchean.grb > 0);
  assert.ok(events.ordovician.grb > 0);
  assert.equal(events.cretaceous.grb, undefined);
  assert.equal(events.holocene.grb, undefined);
});
