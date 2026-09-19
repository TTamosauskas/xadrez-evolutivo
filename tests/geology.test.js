import test from "node:test";
import assert from "node:assert/strict";
import { TRAITS, EVENTS } from "../src/constants.js";
import {
  GEOLOGICAL_STAGES,
  TRAIT_STAGE,
  applyTraitMutation,
  captureUnlocked,
  currentGeologicalStage,
  deleteriousMutationUnlocked,
  eventWeights,
  innovationWeight,
  missingInnovations,
  pawnMutationUnlocked,
  stageComplete,
  traitUnlocked,
} from "../src/geology.js";
import {
  createState,
  createSuccessorState,
  newPiece,
  registerDiscoveries,
} from "../src/state.js";
import { movesFor } from "../src/moves.js";

const negatives = new Set([
  "Esterilidade",
  "Mutação Deletéria",
  "Mutação Disfuncional",
]);

test("geological timeline assigns every positive mutation to one stage", () => {
  const positive = Object.keys(TRAITS).filter((trait) => !negatives.has(trait));
  assert.deepEqual(
    [...new Set(Object.keys(TRAIT_STAGE))].sort(),
    [...positive].sort(),
  );
  const required = GEOLOGICAL_STAGES.flatMap((stage) => stage.required);
  assert.equal(required.length, new Set(required).size);
  for (const trait of required) assert.equal(TRAIT_STAGE[trait] !== undefined, true);
});

test("period innovations follow the didactic sequence", () => {
  const required = Object.fromEntries(
    GEOLOGICAL_STAGES.map((stage) => [stage.id, stage.required]),
  );
  assert.deepEqual(required.archean, [
    "Fotossíntese",
    "Predação",
    "Fertilidade",
    "Dormência",
  ]);
  assert.deepEqual(required.proterozoic, [
    "Resistência",
    "Regeneração",
    "Reprodução Sexuada",
    "Esporos",
    "Carnívoro",
  ]);
  assert.deepEqual(required.ediacaran, [
    "Locomoção",
    "Escavador",
    "Construtor de Nicho",
  ]);
  assert.deepEqual(required.ordovician, ["Ovíparo"]);
  assert.deepEqual(required.silurian, ["Coletor"]);
  assert.deepEqual(required.devonian, ["Locomoção Avançada", "Onívoro"]);
  assert.deepEqual(required.carboniferous, ["Ovíparos Amniotas", "Ooteca", "Voo"]);
  assert.deepEqual(required.cretaceous, ["Eusocialidade", "Ovífagia"]);
  assert.deepEqual(required.neogene, ["Chifre", "Polegar Opositor"]);
  assert.deepEqual(required.quaternary, [
    "Neocórtex Desenvolvido",
    "Antropização",
  ]);
});

test("Archean innovations are split across the first two cycles", () => {
  const s = createState(110),
    p = s.pieces[0];
  assert.equal(traitUnlocked(s, "Fotossíntese", p), true);
  assert.equal(traitUnlocked(s, "Predação", p), false);
  assert.equal(traitUnlocked(s, "Fertilidade", p), false);
  assert.equal(traitUnlocked(s, "Dormência", p), false);

  s.historicalTraits.push("Fotossíntese");
  assert.equal(traitUnlocked(s, "Predação", p), true);
  s.historicalTraits.push("Predação");
  assert.equal(traitUnlocked(s, "Fertilidade", p), false);
  assert.equal(traitUnlocked(s, "Dormência", p), false);

  s.cycle = 2;
  assert.equal(traitUnlocked(s, "Fertilidade", p), true);
  assert.equal(traitUnlocked(s, "Dormência", p), false);
  s.historicalTraits.push("Fertilidade");
  assert.equal(traitUnlocked(s, "Dormência", p), true);
});

test("Archean keeps the first wave active in later cycles until it is complete", () => {
  const s = createState(112, { cycle: 2 }),
    p = s.pieces[0];
  assert.equal(traitUnlocked(s, "Fotossíntese", p), true);
  assert.equal(traitUnlocked(s, "Fertilidade", p), false);
  s.historicalTraits.push("Fotossíntese");
  assert.equal(traitUnlocked(s, "Predação", p), true);
  s.historicalTraits.push("Predação");
  assert.equal(traitUnlocked(s, "Fertilidade", p), true);
});

test("geological event pools contain only valid ecological events and no pathogen lottery", () => {
  const ids = new Set(EVENTS.map((event) => event.id));
  for (const stage of GEOLOGICAL_STAGES) {
    for (const [id, weight] of Object.entries(stage.events)) {
      assert.ok(ids.has(id), `${stage.id} references ${id}`);
      assert.ok(weight > 0);
      assert.notEqual(id, "pathogen");
    }
  }
});

test("Archean starts green and stationary", () => {
  const s = createState(101);
  assert.equal(s.version, 7);
  assert.equal(s.geologicalStage, "archean");
  assert.equal(s.cycle, 1);
  assert.equal(s.board.filter((terrain) => terrain === "fertile").length, 52);
  assert.equal(s.board.filter((terrain) => terrain === "hostile").length, 0);
  const actions = movesFor(s, s.pieces[0]);
  assert.ok(actions.length > 0);
  assert.ok(actions.every((target) => target.stay));
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
      traits: ["Predação", "Locomoção"],
    }),
    amber = newPiece(s, "amber", 4, 4, { traits: [] });
  s.pieces.push(blue, amber);
  assert.equal(captureUnlocked(s, blue), true);
  assert.ok(movesFor(s, blue).some((target) => target.c === 4));

  const ancestral = { traits: [] };
  assert.equal(traitUnlocked(s, "Locomoção", ancestral), false);
  ancestral.traits.push("Predação");
  assert.equal(traitUnlocked(s, "Locomoção", ancestral), true);
});

test("registering a new evolutionary discovery does not open a Marco Evolutivo modal", () => {
  const s = createState(116),
    p = s.pieces[0];
  p.traits.push("Fotossíntese");
  registerDiscoveries(s, p);
  assert.ok(s.historicalTraits.includes("Fotossíntese"));
  assert.ok(!s.notices.some((notice) => notice.title === "Marco Evolutivo"));
});

test("Archean advances only after both innovation cycles are complete", () => {
  let s = createState(103);
  const photosynthetic = s.pieces[0],
    predatory = s.pieces[1];
  photosynthetic.traits.push("Fotossíntese");
  registerDiscoveries(s, photosynthetic);
  predatory.traits.push("Predação");
  registerDiscoveries(s, predatory);
  assert.equal(stageComplete(s), false);
  s.notices = [];
  s.result = { winner: "blue", reason: "teste" };
  s.phase = "over";

  let next = createSuccessorState(s, 104);
  assert.equal(next.geologicalStage, "archean");
  assert.equal(next.cycle, 2);
  assert.deepEqual(next.historicalTraits, ["Fotossíntese", "Predação"]);

  const secondCarrier = next.pieces[0];
  secondCarrier.traits.push("Fertilidade", "Dormência");
  registerDiscoveries(next, secondCarrier);
  assert.equal(stageComplete(next), true);
  next.notices = [];
  next.result = { winner: "blue", reason: "teste" };
  next.phase = "over";

  const proterozoic = createSuccessorState(next, 105);
  assert.equal(proterozoic.geologicalStage, "proterozoic");
  assert.equal(proterozoic.cycle, 1);
  assert.equal(proterozoic.totalCycles, 3);
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

test("without a distinct ecological counterpart the dominant founder still seeds both sides", () => {
  const s = createState(123);
  s.pieces = [];
  s.nextId = 1;
  s.pieces.push(
    newPiece(s, "blue", 7, 0, { rank: 4, traits: ["Predação"] }),
    newPiece(s, "blue", 7, 1, { rank: 4, traits: ["Predação"] }),
    newPiece(s, "amber", 0, 0, { rank: 4, traits: [] }),
  );
  s.result = { winner: "blue", reason: "teste" };
  s.phase = "over";

  const next = createSuccessorState(s, 124);
  assert.ok(
    next.pieces.every(
      (piece) =>
        piece.rank === 4 &&
        piece.traits.length === 1 &&
        piece.traits[0] === "Predação",
    ),
  );
});

test("evolutionary dependencies follow lineage ancestry without cumulative traits", () => {
  const s = createState(107, {
      geologicalStage: "ediacaran",
      historicalTraits: [
        ...GEOLOGICAL_STAGES.slice(0, 2).flatMap((stage) => stage.required),
        "Locomoção",
      ],
    }),
    p = s.pieces[0],
    unrelated = { traits: [], ancestry: [] };

  p.ancestry = ["Predação", "Locomoção"];
  p.traits = [];
  assert.equal(traitUnlocked(s, "Escavador", p), true);
  assert.equal(traitUnlocked(s, "Escavador", unrelated), false);

  s.historicalTraits.push("Escavador");
  p.ancestry.push("Escavador");
  assert.equal(traitUnlocked(s, "Construtor de Nicho", p), true);
  assert.equal(traitUnlocked(s, "Construtor de Nicho", unrelated), false);

  s.geologicalStage = "devonian";
  s.historicalTraits = [
    ...new Set([
      ...GEOLOGICAL_STAGES.slice(0, 6).flatMap((stage) => stage.required),
    ]),
  ];
  p.ancestry.push("Construtor de Nicho");
  assert.equal(traitUnlocked(s, "Locomoção Avançada", p), true);
  s.historicalTraits.push("Locomoção Avançada");
  p.ancestry.push("Carnívoro");
  assert.equal(traitUnlocked(s, "Onívoro", p), true);

  s.geologicalStage = "triassic";
  p.ancestry.push("Ovíparos Amniotas");
  assert.equal(traitUnlocked(s, "Vivíparo", p), true);

  s.geologicalStage = "quaternary";
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
        "Fertilidade",
        "Dormência",
        "Resistência",
        "Regeneração",
        "Reprodução Sexuada",
        "Esporos",
      ],
    }),
    descendant = { traits: [], ancestry: ["Predação"] },
    outsider = { traits: [], ancestry: [] };
  assert.equal(traitUnlocked(s, "Carnívoro", descendant), true);
  assert.equal(traitUnlocked(s, "Carnívoro", outsider), false);
});

test("evolutionary precedence changes eligibility but never mutation weight", () => {
  const s = createState(108),
    p = { traits: [] };
  assert.equal(innovationWeight(s, "Fotossíntese", p), 1);
  s.cycle = 4;
  assert.equal(innovationWeight(s, "Fotossíntese", p), 1);
  assert.equal(innovationWeight(s, "Predação", p), 1);
  assert.deepEqual(missingInnovations(s), [
    "Fotossíntese",
    "Predação",
    "Fertilidade",
    "Dormência",
  ]);
});

test("a discovered required innovation pauses new appearances until the next one is discovered", () => {
  const s = createState(114),
    p = { traits: [] };
  s.historicalTraits = ["Fotossíntese"];
  assert.equal(traitUnlocked(s, "Fotossíntese", p), false);
  assert.equal(traitUnlocked(s, "Predação", p), true);
  s.historicalTraits.push("Predação");
  assert.equal(traitUnlocked(s, "Fotossíntese", p), true);
  assert.equal(traitUnlocked(s, "Predação", p), true);
});

test("deleterious mutations unlock only from the second campaign cycle", () => {
  const s = createState(115);
  assert.equal(deleteriousMutationUnlocked(s), false);
  s.totalCycles = 2;
  assert.equal(deleteriousMutationUnlocked(s), true);
});

test("Pawn mutation unlocks only from the second campaign cycle", () => {
  const first = createState(113);
  assert.equal(first.totalCycles, 1);
  assert.equal(pawnMutationUnlocked(first), false);
  first.totalCycles = 2;
  first.cycle = 1;
  assert.equal(pawnMutationUnlocked(first), true);
});

test("Fotossíntese and Predação switch branches by substitutive mutation", () => {
  const s = createState(111);
  s.historicalTraits = ["Fotossíntese"];
  const ancestral = { traits: [] },
    photosynthetic = { traits: ["Fotossíntese"] };
  assert.equal(traitUnlocked(s, "Predação", ancestral), true);
  assert.equal(traitUnlocked(s, "Predação", photosynthetic), true);
  assert.deepEqual(
    applyTraitMutation(photosynthetic.traits, "Predação"),
    ["Predação"],
  );

  s.historicalTraits.push("Predação");
  const predatory = {
    traits: ["Predação", "Locomoção", "Carnívoro", "Onívoro"],
  };
  assert.equal(traitUnlocked(s, "Fotossíntese", predatory), true);
  assert.deepEqual(
    applyTraitMutation(predatory.traits, "Fotossíntese"),
    ["Fotossíntese"],
  );
  assert.equal(
    innovationWeight(s, "Predação", photosynthetic),
    innovationWeight(s, "Predação", ancestral),
  );
});

test("plant innovations unlock in their geological periods without becoming mandatory stage gates", () => {
  const s = createState(118, {
      geologicalStage: "ordovician",
      historicalTraits: [
        ...GEOLOGICAL_STAGES.slice(0, 4).flatMap((stage) => stage.required),
        "Fotossíntese",
      ],
    }),
    plant = { traits: ["Fotossíntese"] };

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
        "Fotossíntese",
        "Embriófitas",
        "Traqueófitas",
        "Gimnospermas",
      ],
    };

  assert.equal(traitUnlocked(s, "Angiospermas", plant), true);
  for (const trait of [
    "Locomoção",
    "Escavador",
    "Escalador",
    "Respiração Cutânea",
    "Sacos Aéreos",
    "Necrófago",
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

  assert.equal(traitUnlocked(s, "Predação", plant), true);
  assert.deepEqual(
    applyTraitMutation(
      [...plant.traits, "Espinhos", "Trepadeira", "Angiospermas"],
      "Predação",
    ),
    ["Predação"],
  );
});

test("switching into Fotossíntese removes animal-only traits", () => {
  const animal = [
    "Predação",
    "Locomoção",
    "Escavador",
    "Escalador",
    "Carnívoro",
    "Onívoro",
    "Necrófago",
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

test("Paleogene is a one-cycle transition stage", () => {
  const prior = GEOLOGICAL_STAGES.slice(
    0,
    GEOLOGICAL_STAGES.findIndex((stage) => stage.id === "paleogene"),
  ).flatMap((stage) => stage.required);
  const s = createState(109, {
    geologicalStage: "paleogene",
    historicalTraits: prior,
  });
  assert.equal(currentGeologicalStage(s).period, "Paleógeno");
  assert.equal(stageComplete(s), true);
  assert.deepEqual(eventWeights(s), currentGeologicalStage(s).events);
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
    animal = { traits: ["Predação"], ancestry: ["Cuidado Parental"] },
    plant = { traits: ["Fotossíntese"], ancestry: ["Fotossíntese"] };

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
    traits: [],
    ancestry: ["Neocórtex Desenvolvido"],
  };
  assert.equal(traitUnlocked(s, "Antropização", anthropic), true);
  assert.equal(
    traitUnlocked(s, "Antropização", {
      traits: [],
      ancestry: ["Construtor de Nicho"],
    }),
    false,
  );
});


test("Haustório is a Cretaceous photosynthetic innovation after Embriófitas", () => {
  const s = createState(141, {
      geologicalStage: "cretaceous",
      historicalTraits: GEOLOGICAL_STAGES.slice(0, 12).flatMap(
        (stage) => stage.required,
      ),
    }),
    plant = {
      traits: ["Fotossíntese"],
      ancestry: ["Fotossíntese", "Embriófitas"],
    },
    exPlant = {
      traits: ["Predação"],
      ancestry: ["Fotossíntese", "Embriófitas", "Predação"],
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
    animal = { traits: ["Predação"], ancestry: ["Predação"] },
    plant = { traits: ["Fotossíntese"], ancestry: ["Fotossíntese"] };
  assert.equal(traitUnlocked(s, "Parasitismo", animal), true);
  assert.equal(traitUnlocked(s, "Parasitismo", plant), false);
});


test("severe events are distributed across geologically appropriate periods", () => {
  const byStage = Object.fromEntries(
    GEOLOGICAL_STAGES.map((stage) => [stage.id, stage.events]),
  );
  assert.ok(byStage.archean.volcano > 0);
  assert.ok(byStage.ordovician.ice > 0);
  assert.ok(byStage.cretaceous.meteor > 0);
  assert.ok(byStage.permian.warming > 0);
  assert.ok(byStage.triassic.warming > 0);
  assert.ok(byStage.cretaceous.warming > 0);
  assert.ok(byStage.paleogene.warming > 0);
  assert.ok(byStage.neogene.warming > 0);
  assert.ok(byStage.quaternary.warming > 0);
});
