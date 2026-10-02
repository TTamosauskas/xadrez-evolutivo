import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { context, transition } from "../src/engine.js";
import {
  partnersFor,
  legalActions,
} from "../src/moves.js";
import {
  metabolicReproductionCooldown,
  reproduce,
} from "../src/reproduction.js";
import { mutualismPartner } from "../src/reproduction-traits.js";
import {
  offspringPlacementPreference,
} from "../src/positioning.js";
import {
  hierarchySacrificeRecommendation,
  superorganismRecommendation,
} from "../src/ai.js";
import {
  ACTIVE_TRAIT_FAMILIES,
  TRAIT_STAGE,
  normalizeActiveTraits,
  negativeTraitUnlocked,
} from "../src/geology.js";
import { assertState, clone, round } from "../src/state.js";
import { square, TRAITS, STATE_VERSION } from "../src/constants.js";
import { deserialize } from "../src/storage.js";

test("Tropismo directs photosynthetic offspring toward another fertile cell", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 3, traits: ["Fotossíntese"] },
      { owner: "amber", r: 0, c: 0 },
    ]);
  s.board.fill("neutral");
  s.board[square(4, 6)] = "fertile";
  const origin = { r: 4, c: 3 },
    result = offspringPlacementPreference(
      s,
      [
        { r: 4, c: 4 },
        { r: 1, c: 1 },
      ],
      origin,
      {
        id: -1,
        owner: "blue",
        traits: ["Fotossíntese", "Tropismo"],
      },
    );
  assert.deepEqual(result.cells, [{ r: 4, c: 4 }]);
  assert.ok(result.appliedTraits.includes("Tropismo"));
});

test("Forrageamento directs offspring toward allied photosynthetic organisms", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 3, traits: ["Herbívoro"] },
      { owner: "blue", r: 5, c: 5, traits: ["Fotossíntese"] },
      { owner: "amber", r: 0, c: 0 },
    ]),
    result = offspringPlacementPreference(
      s,
      [
        { r: 5, c: 4 },
        { r: 1, c: 1 },
      ],
      s.pieces[0],
      {
        id: -1,
        owner: "blue",
        traits: ["Herbívoro", "Forrageamento"],
      },
    );
  assert.deepEqual(result.cells, [{ r: 5, c: 4 }]);
  assert.ok(result.appliedTraits.includes("Forrageamento"));
});

test("Forrageamento joins the offspring-orientation locus", () => {
  const family = ACTIVE_TRAIT_FAMILIES.find(
    (candidate) => candidate.id === "offspring-orientation",
  );
  assert.deepEqual(family?.traits, [
    "Testosterona",
    "Corticosteroides",
    "Forrageamento",
  ]);
  assert.deepEqual(
    normalizeActiveTraits([
      "Testosterona",
      "Corticosteroides",
      "Forrageamento",
    ]),
    ["Forrageamento"],
  );
});

test("Hierarquia recommends an unavailable reproducer before more useful members", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 4, rank: 0, traits: ["Sociabilidade", "Hierarquia"] },
      { owner: "blue", r: 4, c: 5, rank: 5, traits: ["Sociabilidade"] },
      { owner: "blue", r: 5, c: 4, rank: 3, traits: ["Sociabilidade"] },
      { owner: "blue", r: 5, c: 5, rank: 1, traits: ["Sociabilidade"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    unavailable = s.pieces[1];
  unavailable.energy = 0;
  s.phase = "social-defense";
  s.socialDefense = {
    attackerId: s.pieces[4].id,
    victimId: s.pieces[0].id,
    attackerOwner: "amber",
    memberIds: s.pieces.slice(0, 4).map((piece) => piece.id),
  };
  s.current = "blue";

  assert.equal(hierarchySacrificeRecommendation(s)?.id, unavailable.id);
});

test("Superorganismo recommends the member with the strongest AI-priority move", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 3,
        rank: 2,
        traits: ["Artrópode", "Eusocialidade", "Percepção Espacial", "Superorganismo"],
      },
      {
        owner: "blue",
        r: 7,
        c: 7,
        rank: 0,
        traits: ["Artrópode", "Eusocialidade", "Percepção Espacial", "Superorganismo"],
      },
      { owner: "amber", r: 1, c: 6, rank: 4 },
      { owner: "amber", r: 0, c: 0, rank: 0 },
    ]),
    recommendation = superorganismRecommendation(s, s.pieces[0]);
  assert.equal(recommendation?.memberId, s.pieces[0].id);
  assert.deepEqual(
    [recommendation?.action.r, recommendation?.action.c],
    [1, 6],
  );
});

test("Caça Cooperativa neutralizes Chifre when two hunters surround the prey", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Caça Cooperativa"] },
    { owner: "blue", r: 3, c: 4, rank: 0, traits: ["Caça Cooperativa"] },
    { owner: "amber", r: 4, c: 4, rank: 0, traits: ["Chifre"] },
    { owner: "amber", r: 0, c: 0, rank: 0 },
  ]);
  const attackerId = s.pieces[0].id,
    victimId = s.pieces[2].id;
  s = transition(s, move(s.pieces[0], 4, 4));
  assert.ok(s.pieces.some((piece) => piece.id === attackerId));
  assert.equal(s.pieces.some((piece) => piece.id === victimId), false);
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Caça Cooperativa" &&
        effect.outcome === "neutralized-horn",
    ),
  );
  assertState(s);
});

test("Mutualismo links adjacent opposite energy branches and reduces metabolic recovery by one", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Mutualismo"] },
      {
        owner: "blue",
        r: 4,
        c: 5,
        rank: 0,
        traits: ["Fotossíntese", "Mutualismo"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0];
  assert.equal(mutualismPartner(s, parent)?.id, s.pieces[1].id);
  assert.equal(
    reproduce(context(s), parent, null, "teste", {
      forcedCount: 1,
      immediateDevelopment: true,
    }),
    1,
  );
  assert.equal(
    energyValue(parent),
    energyCapacity(parent) - reproductionEnergyCost(parent) + 1,
  );
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Mutualismo" &&
        effect.outcome === "reduced-reproductive-energy",
    ),
  );
  assertState(s);
});

test("Assimetria Flutuante cannot be chosen as a sexual partner but can initiate mating", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Reprodução Sexuada"],
      },
      {
        owner: "blue",
        r: 4,
        c: 5,
        traits: ["Reprodução Sexuada", "Assimetria Flutuante"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    normal = s.pieces[0],
    asymmetric = s.pieces[1];
  assert.equal(
    partnersFor(s, normal, { requireResource: false }).some(
      (piece) => piece.id === asymmetric.id,
    ),
    false,
  );
  assert.equal(
    partnersFor(s, asymmetric, { requireResource: false }).some(
      (piece) => piece.id === normal.id,
    ),
    true,
  );
});

test("Ataxia can redirect MOVE to another legal destination of the same creature", () => {
  const base = fixture([
    { owner: "blue", r: 4, c: 4, rank: 4, traits: ["Ataxia"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  let redirected = null;
  for (let seed = 1; seed < 20000 && !redirected; seed++) {
    const s = clone(base);
    s.rng = seed;
    const actor = s.pieces[0],
      requested = legalActions(s).find(
        (action) =>
          action.type === "MOVE" &&
          action.id === actor.id &&
          action.r === 4 &&
          action.c === 5,
      );
    if (!requested) continue;
    const next = transition(s, requested);
    if (
      next.passiveEffects.some(
        (effect) =>
          effect.trait === "Ataxia" &&
          effect.outcome === "redirected-move",
      )
    )
      redirected = next;
  }
  assert.ok(redirected);
  const actor = redirected.pieces[0];
  assert.notDeepEqual([actor.r, actor.c], [4, 5]);
  assertState(redirected);
});

test("Anemia Falciforme removes only the aerobic one-round metabolic advantage", () => {
  const aerobic = {
      rank: 5,
      traits: ["Respiração anaeróbia", "Respiração aeróbia"],
    },
    anemia = {
      rank: 5,
      traits: [
        "Respiração anaeróbia",
        "Respiração aeróbia",
        "Anemia Falciforme",
      ],
    };
  assert.equal(metabolicReproductionCooldown(aerobic), 5);
  assert.equal(metabolicReproductionCooldown(anemia), 6);
});

test("negative impairment loci are autoexclusive", () => {
  assert.deepEqual(
    normalizeActiveTraits(["Deficiência Motora", "Ataxia"]),
    ["Ataxia"],
  );
  assert.deepEqual(
    normalizeActiveTraits([
      "Insuficiência Respiratória",
      "Anemia Falciforme",
    ]),
    ["Anemia Falciforme"],
  );
});

test("new traits keep their approved chronology and negative availability", () => {
  assert.equal(TRAIT_STAGE.Tropismo, "ordovician");
  assert.equal(TRAIT_STAGE.Forrageamento, "devonian");
  assert.equal(TRAIT_STAGE.Mutualismo, "devonian");
  assert.equal(TRAIT_STAGE.Hierarquia, "cretaceous");
  assert.equal(TRAIT_STAGE.Superorganismo, "oligocene");
  assert.equal(TRAIT_STAGE["Caça Cooperativa"], "eocene");

  const s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      traits: ["Locomoção Articulada", "Simetria Bilateral"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.totalCycles = 2;
  s.cycle = 2;
  s.geologicalStage = "cambrian";
  assert.equal(negativeTraitUnlocked(s, "Ataxia", s.pieces[0]), true);
  s.geologicalStage = "ediacaran";
  assert.equal(
    negativeTraitUnlocked(s, "Assimetria Flutuante", s.pieces[0]),
    true,
  );
  s.geologicalStage = "quaternary";
  s.pieces[0].traits.push("Respiração aeróbia");
  s.pieces[0].ancestry.push("Respiração aeróbia");
  assert.equal(
    negativeTraitUnlocked(s, "Anemia Falciforme", s.pieces[0]),
    true,
  );
});

test("approved icons are registered", () => {
  assert.equal(TRAITS.Tropismo[0], "🌻");
  assert.equal(TRAITS.Forrageamento[0], "🐔");
  assert.equal(TRAITS.Hierarquia[0], "🐃");
  assert.equal(TRAITS.Superorganismo[0], "🐝");
  assert.equal(TRAITS["Caça Cooperativa"][0], "🐬");
  assert.equal(TRAITS.Mutualismo[0], "🫂");
  assert.equal(TRAITS["Assimetria Flutuante"][0], "👹");
  assert.equal(TRAITS.Ataxia[0], "🥴");
  assert.equal(TRAITS["Anemia Falciforme"][0], "🛑");
});


test("v25 saves migrate to v26 with ancestral loci for the new traits", () => {
  const legacy = fixture([
    { owner: "blue", r: 4, c: 4, rank: 4 },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  legacy.version = 25;
  for (const piece of legacy.pieces)
    for (const trait of [
      "Tropismo",
      "Forrageamento",
      "Hierarquia",
      "Superorganismo",
      "Caça Cooperativa",
      "Mutualismo",
      "Assimetria Flutuante",
      "Ataxia",
      "Anemia Falciforme",
    ])
      delete piece.genome[trait];

  const restored = deserialize(JSON.stringify(legacy));
  assert.equal(restored.version, STATE_VERSION);
  for (const piece of restored.pieces)
    for (const trait of [
      "Tropismo",
      "Forrageamento",
      "Hierarquia",
      "Superorganismo",
      "Caça Cooperativa",
      "Mutualismo",
      "Assimetria Flutuante",
      "Ataxia",
      "Anemia Falciforme",
    ]) {
      assert.ok(Array.isArray(piece.genome[trait]));
      assert.ok(
        piece.genome[trait].every(
          (allele) => allele.value === "ancestral",
        ),
      );
    }
  assertState(restored);
});
