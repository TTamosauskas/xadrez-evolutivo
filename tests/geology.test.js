import test from "node:test";
import assert from "node:assert/strict";
import { TRAITS, EVENTS } from "../src/constants.js";
import {
  GEOLOGICAL_STAGES,
  TRAIT_STAGE,
  captureUnlocked,
  currentGeologicalStage,
  eventWeights,
  innovationWeight,
  missingInnovations,
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
    "Fertilidade",
    "Dormência",
    "Fotossíntese",
    "Predação",
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
    "Necrófago",
    "Construção de Nicho",
  ]);
  assert.deepEqual(required.carboniferous, ["Ovíparo", "Ooteca", "Voo"]);
  assert.deepEqual(required.neogene, [
    "Chifre",
    "Construtor Avançado",
    "Polegar Opositor",
  ]);
});

test("only the next required innovation is eligible inside a period", () => {
  const s = createState(110),
    p = s.pieces[0];
  assert.equal(traitUnlocked(s, "Fertilidade", p), true);
  assert.equal(traitUnlocked(s, "Dormência", p), false);
  assert.equal(traitUnlocked(s, "Fotossíntese", p), false);
  assert.equal(traitUnlocked(s, "Predação", p), false);

  s.historicalTraits.push("Fertilidade");
  assert.equal(traitUnlocked(s, "Dormência", p), true);
  s.historicalTraits.push("Dormência");
  assert.equal(traitUnlocked(s, "Fotossíntese", p), true);
  s.historicalTraits.push("Fotossíntese");
  assert.equal(traitUnlocked(s, "Predação", p), true);
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
  assert.equal(s.version, 4);
  assert.equal(s.geologicalStage, "archean");
  assert.equal(s.cycle, 1);
  assert.equal(s.board.filter((terrain) => terrain === "fertile").length, 52);
  assert.equal(s.board.filter((terrain) => terrain === "hostile").length, 0);
  const actions = movesFor(s, s.pieces[0]);
  assert.ok(actions.length > 0);
  assert.ok(actions.every((target) => target.stay));
});

test("Predação enables capture independently of the Cambrian while locomotion enables movement", () => {
  const history = GEOLOGICAL_STAGES.slice(0, 2).flatMap((stage) => stage.required),
    s = createState(102, {
      geologicalStage: "ediacaran",
      historicalTraits: history,
    });
  s.pieces = [];
  s.nextId = 1;
  s.board.fill("neutral");
  const blue = newPiece(s, "blue", 4, 0, {
      rank: 3,
      traits: ["Locomoção"],
    }),
    amber = newPiece(s, "amber", 4, 4, { traits: [] });
  s.pieces.push(blue, amber);
  assert.ok(movesFor(s, blue).some((target) => target.c === 3));
  assert.ok(!movesFor(s, blue).some((target) => target.c === 4));
  assert.equal(captureUnlocked(s, blue), false);
  blue.traits.push("Predação");
  assert.equal(captureUnlocked(s, blue), true);
  assert.ok(movesFor(s, blue).some((target) => target.c === 4));
});

test("stage advances only after every required phenotype has been observed", () => {
  let s = createState(103);
  s.result = { winner: "blue", reason: "teste" };
  s.phase = "over";
  let next = createSuccessorState(s, 104);
  assert.equal(next.geologicalStage, "archean");
  assert.equal(next.cycle, 2);

  s = createState(105);
  const carrier = s.pieces[0];
  carrier.traits.push("Fotossíntese", "Fertilidade", "Dormência", "Predação");
  registerDiscoveries(s, carrier);
  assert.equal(stageComplete(s), true);
  s.notices = [];
  s.result = { winner: "blue", reason: "teste" };
  s.phase = "over";
  next = createSuccessorState(s, 106);
  assert.equal(next.geologicalStage, "proterozoic");
  assert.equal(next.cycle, 1);
  assert.equal(next.totalCycles, 2);
});

test("later innovations obey historical and individual dependencies", () => {
  const s = createState(107, {
    geologicalStage: "devonian",
    historicalTraits: GEOLOGICAL_STAGES.slice(0, 6).flatMap(
      (stage) => stage.required,
    ),
  });
  const p = s.pieces[0];
  s.historicalTraits = s.historicalTraits.filter(
    (trait) => trait !== "Locomoção",
  );
  assert.equal(traitUnlocked(s, "Locomoção Avançada", p), false);
  s.historicalTraits.push("Locomoção");
  assert.equal(traitUnlocked(s, "Locomoção Avançada", p), true);

  s.geologicalStage = "proterozoic";
  s.historicalTraits = s.historicalTraits.filter(
    (trait) => trait !== "Predação",
  );
  assert.equal(traitUnlocked(s, "Carnívoro", p), false);
  s.historicalTraits.push("Predação");
  assert.equal(traitUnlocked(s, "Carnívoro", p), false);
  p.traits.push("Predação");
  assert.equal(traitUnlocked(s, "Carnívoro", p), true);

  s.geologicalStage = "devonian";
  s.historicalTraits.push("Locomoção Avançada");
  p.traits = p.traits.filter((trait) => trait !== "Carnívoro");
  assert.equal(traitUnlocked(s, "Onívoro", p), false);
  p.traits.push("Carnívoro");
  assert.equal(traitUnlocked(s, "Onívoro", p), true);

  s.geologicalStage = "ediacaran";
  s.historicalTraits = s.historicalTraits.filter(
    (trait) => trait !== "Predação",
  );
  assert.equal(traitUnlocked(s, "Locomoção", p), false);
  s.historicalTraits.push("Predação");
  assert.equal(traitUnlocked(s, "Locomoção", p), true);

  s.geologicalStage = "neogene";
  s.historicalTraits.push("Chifre", "Construção de Nicho");
  p.traits = p.traits.filter((trait) => trait !== "Construção de Nicho");
  assert.equal(traitUnlocked(s, "Construtor Avançado", p), false);
  p.traits.push("Construção de Nicho");
  assert.equal(traitUnlocked(s, "Construtor Avançado", p), true);

  s.geologicalStage = "triassic";
  s.historicalTraits = s.historicalTraits.filter((trait) => trait !== "Ovíparo");
  assert.equal(traitUnlocked(s, "Vivíparo", p), false);
  s.historicalTraits.push("Ovíparo");
  assert.equal(traitUnlocked(s, "Vivíparo", p), true);
});

test("missing innovations gain weight across repeated cycles without becoming automatic", () => {
  const s = createState(108);
  const first = innovationWeight(s, "Fotossíntese");
  s.cycle = 4;
  const later = innovationWeight(s, "Fotossíntese");
  assert.ok(later > first);
  assert.ok(later <= 240);
  assert.deepEqual(missingInnovations(s), [
    "Fertilidade",
    "Dormência",
    "Fotossíntese",
    "Predação",
  ]);
});

test("Fotossíntese and Predação strongly antagonize mutation weight", () => {
  const s = createState(111);
  s.historicalTraits = ["Fertilidade", "Dormência", "Fotossíntese"];
  const baseline = innovationWeight(s, "Predação", { traits: [] }),
    photosynthetic = innovationWeight(s, "Predação", {
      traits: ["Fotossíntese"],
    });
  assert.equal(photosynthetic, baseline * 0.2);

  const predatory = innovationWeight(s, "Fotossíntese", {
    traits: ["Predação"],
  });
  assert.equal(predatory, 0.2);
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
