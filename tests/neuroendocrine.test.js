import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import {
  clone,
  newPiece,
  assertState,
} from "../src/state.js";
import { context, simulate, transition } from "../src/engine.js";
import { legalActions } from "../src/moves.js";
import {
  reproduce,
  dopaminePressureReductionAvailable,
} from "../src/reproduction.js";
import {
  ACTIVE_TRAIT_FAMILIES,
  applyTraitLoss,
  normalizeActiveTraits,
} from "../src/geology.js";
import {
  corticalActionBonus,
  corticalMoveSuggestions,
  offspringPlacementPreference,
} from "../src/positioning.js";
import { deserialize } from "../src/storage.js";
import { has } from "../src/constants.js";

test("new loci keep one active evasion, offspring orientation and cognitive phenotype", () => {
  assert.ok(
    ACTIVE_TRAIT_FAMILIES.some(
      (family) =>
        family.id === "evasion" &&
        family.traits.join("|") ===
          "Adrenalina|Velocidade|Movimento proteano",
    ),
  );
  assert.deepEqual(
    normalizeActiveTraits(["Adrenalina", "Velocidade"]),
    ["Velocidade"],
  );
  assert.deepEqual(
    applyTraitLoss(
      ["Velocidade"],
      ["Adrenalina", "Velocidade"],
      "Velocidade",
    ),
    ["Adrenalina"],
  );
  assert.deepEqual(
    normalizeActiveTraits(["Testosterona", "Corticosteroides"]),
    ["Corticosteroides"],
  );
  assert.deepEqual(
    normalizeActiveTraits(["Córtex Pré-Frontal", "Neocórtex Desenvolvido"]),
    ["Neocórtex Desenvolvido"],
  );
  assert.equal(
    has({ traits: ["Neocórtex Desenvolvido"] }, "Córtex Pré-Frontal"),
    true,
  );
  assert.deepEqual(
    normalizeActiveTraits([
      "Neocórtex Desenvolvido",
      "Neurodivergência",
    ]),
    ["Neocórtex Desenvolvido", "Neurodivergência"],
  );
});

test("Neurodivergência grants exactly one full second action when starting without adjacent allies", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Neurodivergência"],
    },
    { owner: "blue", r: 0, c: 0, rank: 4 },
    { owner: "amber", r: 0, c: 7, rank: 4 },
  ]);
  const actor = s.pieces[0],
    otherBlue = s.pieces[1];

  s = simulate(s, move(actor, 4, 5));
  assert.equal(s.current, "blue");
  assert.equal(s.turn, 0);
  assert.equal(s.neurofocus, actor.id);
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Neurodivergência" &&
        effect.outcome === "neurodivergent-hyperfocus",
    ),
  );
  assert.ok(
    legalActions(s).every(
      (action) =>
        (action.id ?? action.parentId ?? actor.id) === actor.id,
    ),
  );
  assert.equal(
    legalActions(s).some(
      (action) => action.id === otherBlue.id || action.parentId === otherBlue.id,
    ),
    false,
  );

  const focused = s.pieces.find((piece) => piece.id === actor.id);
  s = simulate(s, move(focused, 4, 6));
  assert.equal(s.current, "amber");
  assert.equal(s.turn, 1);
  assert.equal(s.neurofocus, null);
  assert.equal(s.neurodivergenceAction, null);
  assertState(s);
});

test("Neurodivergência is neutral with exactly one adjacent ally", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Neurodivergência"],
    },
    { owner: "blue", r: 4, c: 5, rank: 4 },
    { owner: "amber", r: 0, c: 7, rank: 4 },
  ]);
  const actor = s.pieces[0];
  s = simulate(s, move(actor, 3, 4));
  const moved = s.pieces.find((piece) => piece.id === actor.id);
  assert.equal(s.current, "amber");
  assert.equal(s.turn, 1);
  assert.equal(s.neurofocus, null);
  assert.equal(moved.neurodivergenceRestThroughRound, null);
  assertState(s);
});

test("Neurodivergência overload pauses two own turns after acting with two adjacent allies", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Neurodivergência"],
    },
    { owner: "blue", r: 4, c: 5, rank: 4 },
    { owner: "blue", r: 5, c: 4, rank: 4 },
    { owner: "amber", r: 0, c: 7, rank: 4 },
  ]);
  const actorId = s.pieces[0].id;
  s = simulate(s, move(s.pieces[0], 3, 4));
  let actor = s.pieces.find((piece) => piece.id === actorId);
  assert.equal(actor.neurodivergenceRestThroughRound, 2);
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Neurodivergência" &&
        effect.outcome === "neurodivergent-overload" &&
        effect.value === 2,
    ),
  );

  s = simulate(s, { type: "PASS" });
  assert.equal(s.current, "blue");
  assert.equal(
    legalActions(s).some(
      (action) => action.id === actorId || action.parentId === actorId,
    ),
    false,
  );
  s = simulate(s, { type: "PASS" });
  s = simulate(s, { type: "PASS" });
  assert.equal(s.current, "blue");
  assert.equal(
    legalActions(s).some(
      (action) => action.id === actorId || action.parentId === actorId,
    ),
    false,
  );
  s = simulate(s, { type: "PASS" });
  s = simulate(s, { type: "PASS" });
  actor = s.pieces.find((piece) => piece.id === actorId);
  assert.equal(s.current, "blue");
  assert.ok(
    legalActions(s).some(
      (action) => action.id === actorId || action.parentId === actorId,
    ),
  );
  assertState(s);
});

test("Neocórtex Desenvolvido reduces Neurodivergência overload from two own turns to one", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Neurodivergência", "Neocórtex Desenvolvido"],
    },
    { owner: "blue", r: 4, c: 5, rank: 4 },
    { owner: "blue", r: 5, c: 4, rank: 4 },
    { owner: "amber", r: 0, c: 7, rank: 4 },
  ]);
  const actorId = s.pieces[0].id;
  s = simulate(s, move(s.pieces[0], 3, 4));
  const actor = s.pieces.find((piece) => piece.id === actorId);
  assert.equal(actor.neurodivergenceRestThroughRound, 1);
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Neocórtex Desenvolvido" &&
        effect.outcome === "reduced-neurodivergent-overload",
    ),
  );

  s = simulate(s, { type: "PASS" });
  assert.equal(
    legalActions(s).some(
      (action) => action.id === actorId || action.parentId === actorId,
    ),
    false,
  );
  s = simulate(s, { type: "PASS" });
  s = simulate(s, { type: "PASS" });
  assert.equal(s.current, "blue");
  assert.ok(
    legalActions(s).some(
      (action) => action.id === actorId || action.parentId === actorId,
    ),
  );
  assertState(s);
});

test("Serotonina opens an optional reposition after a resisted capture", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 4,
      traits: ["Serotonina"],
    },
    {
      owner: "amber",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Pele grossa"],
    },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const attackerId = s.pieces[0].id,
    victimId = s.pieces[1].id;
  s.rng = 0;

  s = simulate(s, move(s.pieces[0], 4, 4));

  assert.equal(s.phase, "serotonin-reposition");
  assert.equal(s.current, "blue");
  assert.equal(s.serotoninReposition?.id, attackerId);
  assert.ok(s.pieces.some((piece) => piece.id === victimId));
  const choices = legalActions(s).filter(
    (action) => action.type === "SEROTONIN_REPOSITION",
  );
  assert.ok(choices.length > 0);

  const chosen = choices[0];
  s = transition(s, chosen);
  const attacker = s.pieces.find((piece) => piece.id === attackerId);
  assert.deepEqual([attacker.r, attacker.c], [chosen.r, chosen.c]);
  assert.equal(s.phase, "move");
  assert.equal(s.current, "amber");
  assert.equal(s.serotoninReposition, null);
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Serotonina" &&
        effect.outcome === "adaptive-reposition",
    ),
  );
  assertState(s);
});

test("Serotonina phase survives serialization and old current saves default it to null", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4, traits: ["Serotonina"] },
    { owner: "amber", r: 4, c: 4, rank: 4, traits: ["Pele grossa"] },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  s.rng = 0;
  s = simulate(s, move(s.pieces[0], 4, 4));
  const restored = deserialize(JSON.stringify(s));
  assert.equal(restored.phase, "serotonin-reposition");
  assert.equal(restored.serotoninReposition?.id, s.serotoninReposition.id);

  const ordinary = fixture();
  delete ordinary.serotoninReposition;
  const normalized = deserialize(JSON.stringify(ordinary));
  assert.equal(normalized.serotoninReposition, null);
  assertState(normalized);
});

test("Adrenalina can move the victim diagonally while the attacker advances", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4 },
    { owner: "amber", r: 4, c: 4, rank: 4, traits: ["Adrenalina"] },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const attackerId = s.pieces[0].id,
    victimId = s.pieces[1].id;
  s.rng = 1972;

  s = simulate(s, move(s.pieces[0], 4, 4));

  const attacker = s.pieces.find((piece) => piece.id === attackerId),
    victim = s.pieces.find((piece) => piece.id === victimId);
  assert.deepEqual([attacker.r, attacker.c], [4, 4]);
  assert.equal(Math.abs(victim.r - 4), 1);
  assert.equal(Math.abs(victim.c - 4), 1);
  assert.equal(s.current, "amber");
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Adrenalina" &&
        effect.outcome === "escaped-capture",
    ),
  );
  assertState(s);
});

function crowdedReproductionState(dopamine) {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 5,
        traits: dopamine ? ["Dopamina"] : [],
      },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    parent = s.pieces[0];
  const occupied = new Set(s.pieces.map((piece) => `${piece.r},${piece.c}`));
  for (let r = 0; r < 8 && s.pieces.length < 18; r++)
    for (let c = 0; c < 8 && s.pieces.length < 18; c++) {
      if (Math.max(Math.abs(r - parent.r), Math.abs(c - parent.c)) <= 1)
        continue;
      const key = `${r},${c}`;
      if (occupied.has(key)) continue;
      occupied.add(key);
      s.pieces.push(
        newPiece(s, s.pieces.length % 2 ? "blue" : "amber", r, c, {
          rank: 4,
          traits: ["Respiração anaeróbia"],
          ancestry: ["Respiração anaeróbia"],
        }),
      );
    }
  s.populationLatched = { blue: true, amber: true };
  return { s, parent };
}

test("Dopamina discounts reproductive pressure without changing metabolism", () => {
  const baseline = crowdedReproductionState(false),
    rewarded = crowdedReproductionState(true);

  assert.equal(
    dopaminePressureReductionAvailable(rewarded.s, rewarded.parent),
    true,
  );
  assert.equal(
    reproduce(context(baseline.s), baseline.parent, null, "teste", {
      forcedCount: 1,
      ignoreReadiness: true,
      immediateDevelopment: true,
      resourceKind: "prey",
    }),
    1,
  );
  assert.equal(
    reproduce(context(rewarded.s), rewarded.parent, null, "teste", {
      forcedCount: 1,
      ignoreReadiness: true,
      immediateDevelopment: true,
      resourceKind: "prey",
    }),
    1,
  );

  assert.equal(
    baseline.parent.nextReproductionRound -
      rewarded.parent.nextReproductionRound,
    1,
  );
  assert.ok(
    rewarded.s.passiveEffects.some(
      (effect) =>
        effect.trait === "Dopamina" &&
        effect.outcome === "reduced-reproductive-pressure",
    ),
  );
  assertState(baseline.s);
  assertState(rewarded.s);
});

function placementFixture() {
  const s = fixture([
    { owner: "blue", r: 4, c: 4, rank: 4 },
    { owner: "amber", r: 4, c: 6, rank: 3 },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  return s;
}

const placementProfile = (trait) => ({
  owner: "blue",
  rank: 3,
  traits: [
    "Respiração anaeróbia",
    "Predação",
    "Multicelularismo",
    "Ingestão",
    "Simetria Bilateral",
    "Locomoção Primitiva",
    "Vertebrado",
    "Locomoção Articulada",
    "Locomoção Terrestre",
    "Percepção Espacial",
    trait,
  ],
  ancestry: [],
  somaticMutations: [],
  pregnancies: [],
});

test("Testosterona, Corticosteroides and Ocitocina rank offspring cells by distinct goals", () => {
  const s = placementFixture(),
    offensiveCells = [
      { r: 4, c: 5 },
      { r: 5, c: 4 },
    ],
    testosterone = offspringPlacementPreference(
      s,
      offensiveCells,
      s.pieces[0],
      placementProfile("Testosterona"),
    ),
    corticosteroids = offspringPlacementPreference(
      s,
      offensiveCells,
      s.pieces[0],
      placementProfile("Corticosteroides"),
    );

  assert.deepEqual(testosterone.cells, [{ r: 4, c: 5 }]);
  assert.ok(testosterone.appliedTraits.includes("Testosterona"));
  assert.deepEqual(corticosteroids.cells, [{ r: 5, c: 4 }]);
  assert.ok(corticosteroids.appliedTraits.includes("Corticosteroides"));

  s.pieces.push(
    newPiece(s, "blue", 5, 5, {
      rank: 4,
      traits: ["Respiração anaeróbia"],
      ancestry: ["Respiração anaeróbia"],
    }),
  );
  const social = offspringPlacementPreference(
    s,
    [
      { r: 5, c: 4 },
      { r: 2, c: 2 },
    ],
    s.pieces[0],
    placementProfile("Ocitocina"),
  );
  assert.deepEqual(social.cells, [{ r: 5, c: 4 }]);
  assert.ok(social.appliedTraits.includes("Ocitocina"));
});

test("Córtex Pré-Frontal produces deterministic suggestions without mutating state", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 3,
        traits: ["Córtex Pré-Frontal", "Percepção Espacial"],
      },
      { owner: "amber", r: 4, c: 6, rank: 4 },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    actor = s.pieces[0],
    before = clone(s),
    suggestions = corticalMoveSuggestions(s, actor);

  assert.ok(suggestions?.offensive);
  assert.ok(suggestions?.defensive);
  assert.deepEqual(
    [suggestions.offensive.r, suggestions.offensive.c],
    [4, 6],
  );
  assert.ok(
    corticalActionBonus(s, {
      type: "MOVE",
      id: actor.id,
      r: suggestions.offensive.r,
      c: suggestions.offensive.c,
    }) > 0,
  );
  assert.deepEqual(s, before);
});
