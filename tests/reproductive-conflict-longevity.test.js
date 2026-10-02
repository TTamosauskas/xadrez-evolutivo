import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { transition } from "../src/engine.js";
import {
  movesFor,
  legalActions,
  partnersFor,
  aggressivePartnersFor,
  parthenogenesisAvailable,
} from "../src/moves.js";
import {
  naturalDeathChance,
  deterministicDeathNextTurn,
  reproductionReady,
  round,
  assertState,
} from "../src/state.js";
import {
  ACTIVE_TRAIT_FAMILIES,
  TRAIT_STAGE,
  normalizeActiveTraits,
  traitCombinationValid,
} from "../src/geology.js";
import { TRAITS, STATE_VERSION, square } from "../src/constants.js";
import { energyValue, reproductionEnergyCost } from "../src/energy.js";
import { deserialize } from "../src/storage.js";

test("approved icons reserve 🕷️ for Matrifagia and move Ooteca to 🪩", () => {
  assert.equal(TRAITS.Matrifagia[0], "🕷️");
  assert.equal(TRAITS.Ooteca[0], "🪩");
});

test("new reproductive and longevity loci are autoexclusive where intended", () => {
  const sexualConflict = ACTIVE_TRAIT_FAMILIES.find(
      (family) => family.id === "sexual-conflict",
    ),
    juvenileStrategy = ACTIVE_TRAIT_FAMILIES.find(
      (family) => family.id === "juvenile-strategy",
    ),
    naturalMortality = ACTIVE_TRAIT_FAMILIES.find(
      (family) => family.id === "natural-mortality",
    );
  assert.deepEqual(sexualConflict?.traits, [
    "Canibalismo Sexual",
    "Cópula Agressiva",
  ]);
  assert.deepEqual(juvenileStrategy?.traits, ["Pedogênese", "Matrifagia"]);
  assert.deepEqual(naturalMortality?.traits, [
    "Longevidade",
    "Imortalidade Biológica",
  ]);
  assert.deepEqual(
    normalizeActiveTraits(["Canibalismo Sexual", "Cópula Agressiva"]),
    ["Cópula Agressiva"],
  );
  assert.deepEqual(
    normalizeActiveTraits(["Pedogênese", "Matrifagia"]),
    ["Matrifagia"],
  );
  assert.equal(
    traitCombinationValid(["Imortalidade Biológica", "Simetria Bilateral"]),
    false,
  );
  assert.equal(
    traitCombinationValid(["Canibalismo Sexual", "Acasalamento Múltiplo"]),
    false,
  );
});

test("chronology matches the approved reproductive and longevity design", () => {
  assert.equal(TRAIT_STAGE.Partenogênese, "cambrian");
  assert.equal(TRAIT_STAGE["Canibalismo Sexual"], "carboniferous");
  assert.equal(TRAIT_STAGE["Canibalismo Filial"], "permian");
  assert.equal(TRAIT_STAGE.Matrifagia, "jurassic");
  assert.equal(TRAIT_STAGE["Cópula Agressiva"], "cretaceous");
  assert.equal(TRAIT_STAGE["Imortalidade Biológica"], "ediacaran");
  assert.equal(TRAIT_STAGE["Fertilidade Longeva"], "triassic");
  assert.equal(TRAIT_STAGE.Longevidade, "jurassic");
});

test("Partenogênese is available only as a no-partner fallback and generates one offspring", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Herbívoro", "Reprodução Sexuada", "Partenogênese"],
    },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  s.board[square(4, 4)] = "fertile";
  const parent = s.pieces[0];
  assert.equal(partnersFor(s, parent, { requireResource: false }).length, 0);
  assert.equal(parthenogenesisAvailable(s, parent), true);
  const action = legalActions(s).find(
    (candidate) =>
      candidate.type === "PARTHENOGENESIS" && candidate.id === parent.id,
  );
  assert.ok(action);

  s = transition(s, action);
  assert.equal(s.pieces.filter((piece) => piece.owner === "blue").length, 2);
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Partenogênese" &&
        effect.outcome === "asexual-fallback" &&
        effect.value === 1,
    ),
  );
  assertState(s);
});

test("Partenogênese disappears when a legal sexual partner exists", () => {
  const s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      traits: ["Reprodução Sexuada", "Partenogênese"],
    },
    {
      owner: "blue",
      r: 4,
      c: 5,
      traits: ["Reprodução Sexuada"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[square(4, 4)] = "fertile";
  assert.ok(partnersFor(s, s.pieces[0], { requireResource: false }).length);
  assert.equal(parthenogenesisAvailable(s, s.pieces[0]), false);
});

test("Canibalismo Filial consumes a direct juvenile child and restores reproductive Energy", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Canibalismo", "Canibalismo Filial"],
      energy: 2,
    },
    {
      owner: "blue",
      r: 4,
      c: 5,
      rank: 0,
      parentId: 1,
      parentIds: [1],
      maturesRound: 5,
    },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const parentId = s.pieces[0].id,
    childId = s.pieces[1].id,
    target = movesFor(s, s.pieces[0]).find(
      (candidate) => candidate.r === 4 && candidate.c === 5,
    );
  assert.equal(target?.filialCannibal, true);

  s = transition(s, move(s.pieces[0], 4, 5));
  const parent = s.pieces.find((piece) => piece.id === parentId);
  assert.ok(parent);
  assert.equal(energyValue(parent), reproductionEnergyCost(parent));
  assert.equal(s.pieces.some((piece) => piece.id === childId), false);
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Canibalismo Filial" &&
        effect.outcome === "restored-reproductive-energy",
    ),
  );
  assertState(s);
});

test("Canibalismo Filial is unavailable while an enemy capture exists", () => {
  const s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Canibalismo", "Canibalismo Filial"],
      energy: 2,
    },
    {
      owner: "blue",
      r: 4,
      c: 5,
      rank: 0,
      parentId: 1,
      parentIds: [1],
      maturesRound: 5,
    },
    { owner: "amber", r: 3, c: 4, rank: 0 },
  ]);
  assert.equal(
    movesFor(s, s.pieces[0]).some((target) => target.filialCannibal),
    false,
  );
});

test("Matrifagia lets a juvenile consume its primary parent and mature immediately", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Canibalismo", "Matrifagia"],
      parentId: 2,
      parentIds: [2],
      maturesRound: 5,
    },
    { owner: "blue", r: 4, c: 5, rank: 4 },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const childId = s.pieces[0].id,
    parentId = s.pieces[1].id,
    target = movesFor(s, s.pieces[0]).find(
      (candidate) => candidate.r === 4 && candidate.c === 5,
    );
  assert.equal(target?.matriphagy, true);

  s = transition(s, move(s.pieces[0], 4, 5));
  const child = s.pieces.find((piece) => piece.id === childId);
  assert.ok(child);
  assert.equal(child.maturesRound, round(s));
  assert.equal(s.pieces.some((piece) => piece.id === parentId), false);
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Matrifagia" &&
        effect.outcome === "accelerated-maturity",
    ),
  );
  assertState(s);
});

test("Canibalismo Sexual consumes the mate and produces a two-offspring biparental brood", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: [
        "Herbívoro",
        "Reprodução Sexuada",
        "Canibalismo",
        "Canibalismo Sexual",
      ],
    },
    {
      owner: "blue",
      r: 4,
      c: 5,
      rank: 4,
      traits: ["Reprodução Sexuada"],
    },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  s.board[square(4, 4)] = "fertile";
  const parentId = s.pieces[0].id,
    mateId = s.pieces[1].id;
  s = transition(s, { type: "PARTNER", parentId, id: mateId });
  assert.equal(s.pieces.some((piece) => piece.id === mateId), false);
  const children = s.pieces.filter(
    (piece) => (piece.parentIds ?? []).includes(parentId) &&
      (piece.parentIds ?? []).includes(mateId),
  );
  assert.equal(children.length, 2);
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Canibalismo Sexual" &&
        effect.outcome === "consumed-sexual-partner",
    ),
  );
  assertState(s);
});

test("Cópula Agressiva uses an enemy as genetic partner but keeps the offspring on the attacker side", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Herbívoro", "Reprodução Sexuada", "Cópula Agressiva"],
    },
    {
      owner: "amber",
      r: 4,
      c: 5,
      rank: 4,
      traits: ["Reprodução Sexuada"],
    },
  ]);
  s.board[square(4, 4)] = "fertile";
  const parent = s.pieces[0],
    mate = s.pieces[1];
  assert.ok(
    aggressivePartnersFor(s, parent).some(
      (candidate) => candidate.id === mate.id,
    ),
  );
  s = transition(s, {
    type: "AGGRESSIVE_MATE",
    parentId: parent.id,
    id: mate.id,
  });
  assert.ok(s.pieces.some((piece) => piece.id === mate.id));
  const children = s.pieces.filter(
    (piece) =>
      piece.owner === "blue" &&
      (piece.parentIds ?? []).includes(parent.id) &&
      (piece.parentIds ?? []).includes(mate.id),
  );
  assert.equal(children.length, 1);
  assertState(s);
});

test("mutual Cópula Agressiva kills the attacker before reproduction", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      traits: ["Herbívoro", "Reprodução Sexuada", "Cópula Agressiva"],
    },
    {
      owner: "amber",
      r: 4,
      c: 5,
      traits: ["Reprodução Sexuada", "Cópula Agressiva"],
    },
  ]);
  s.board[square(4, 4)] = "fertile";
  const attackerId = s.pieces[0].id,
    targetId = s.pieces[1].id;
  s = transition(s, {
    type: "AGGRESSIVE_MATE",
    parentId: attackerId,
    id: targetId,
  });
  assert.equal(s.pieces.some((piece) => piece.id === attackerId), false);
  assert.ok(s.pieces.some((piece) => piece.id === targetId));
  assert.equal(
    s.pieces.some((piece) => (piece.parentIds ?? []).includes(attackerId)),
    false,
  );
  assertState(s);
});

test("Longevidade halves natural mortality while Imortalidade Biológica removes it", () => {
  const state = { turn: 96 },
    base = {
      traits: ["Multicelularismo", "Simetria Bilateral"],
      bornRound: 0,
    },
    longLived = {
      ...base,
      traits: [...base.traits, "Longevidade"],
    },
    immortal = {
      traits: ["Multicelularismo", "Imortalidade Biológica"],
      bornRound: 0,
    };
  assert.equal(naturalDeathChance(state, base), 1);
  assert.equal(naturalDeathChance(state, longLived), 0.5);
  assert.equal(naturalDeathChance(state, immortal), 0);
  assert.equal(deterministicDeathNextTurn(state, longLived), null);
  assert.equal(deterministicDeathNextTurn(state, immortal), null);
});

test("Fertilidade Longeva cancels only age-based infertility", () => {
  const state = { turn: 80 },
    base = {
      traits: ["Respiração anaeróbia", "Multicelularismo", "Simetria Bilateral"],
      bornRound: 0,
      maturesRound: 0,
      nextReproductionRound: 0,
      pregnancies: [],
      lifetimeOffspring: 0,
    };
  assert.equal(reproductionReady(state, base), false);
  assert.equal(
    reproductionReady(state, {
      ...base,
      traits: [...base.traits, "Fertilidade Longeva"],
    }),
    true,
  );
  assert.equal(
    reproductionReady(state, {
      ...base,
      traits: [...base.traits, "Fertilidade Longeva", "Esterilidade"],
    }),
    false,
  );
});

test("v26 saves migrate to v27 with the new loci ancestral", () => {
  const legacy = fixture([
    { owner: "blue", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  legacy.version = 26;
  const newTraits = [
    "Partenogênese",
    "Canibalismo Filial",
    "Canibalismo Sexual",
    "Matrifagia",
    "Cópula Agressiva",
    "Longevidade",
    "Fertilidade Longeva",
    "Imortalidade Biológica",
  ];
  for (const piece of legacy.pieces) {
    delete piece.biologicalImmortalityTriggered;
    for (const trait of newTraits) delete piece.genome[trait];
  }

  const restored = deserialize(JSON.stringify(legacy));
  assert.equal(restored.version, STATE_VERSION);
  for (const piece of restored.pieces) {
    assert.equal(piece.biologicalImmortalityTriggered, false);
    for (const trait of newTraits)
      assert.ok(
        piece.genome[trait].every(
          (allele) => allele.value === "ancestral",
        ),
      );
  }
  assertState(restored);
});
