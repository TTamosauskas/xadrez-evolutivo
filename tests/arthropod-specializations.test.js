import test from "node:test";
import assert from "node:assert/strict";
import { TRAITS } from "../src/constants.js";
import { context, simulate } from "../src/engine.js";
import { traitUnlocked } from "../src/geology.js";
import { movesFor } from "../src/moves.js";
import { tickReproduction } from "../src/reproduction.js";
import { assertState, round } from "../src/state.js";
import { fixture, move } from "./helpers.js";

function exactTraits(piece, traits) {
  piece.traits = [...traits];
  piece.ancestry = [...traits];
  piece.somaticMutations = [];
  return piece;
}

function arthropodTraits(extra = []) {
  return [
    "Respiração anaeróbia",
    "Multicelularismo",
    "Predação",
    "Ingestão",
    "Simetria Bilateral",
    "Artrópode",
    "Locomoção Articulada",
    "Locomoção Terrestre",
    "Percepção Espacial",
    ...extra,
  ];
}

test("Ooteca exige Artrópode e Ovíparo", () => {
  const state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 2 },
    { owner: "amber", r: 0, c: 0, rank: 2 },
  ]);
  state.scenario = "arena";
  const piece = state.pieces[0];

  exactTraits(piece, [
    "Respiração anaeróbia",
    "Multicelularismo",
    "Predação",
    "Ingestão",
    "Simetria Bilateral",
    "Ovíparo",
  ]);
  assert.equal(traitUnlocked(state, "Ooteca", piece), false);

  exactTraits(piece, arthropodTraits(["Ovíparo"]));
  assert.equal(traitUnlocked(state, "Ooteca", piece), true);
});

test("Hipermetamorfose concede uma única geometria complementar após a pupa", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 1 },
    { owner: "amber", r: 2, c: 3, rank: 0 },
  ]);
  const actor = exactTraits(
    state.pieces[0],
    arthropodTraits(["Ovíparo", "Metamorfose", "Hipermetamorfose"]),
  );
  actor.pupaUntilRound = round(state);
  actor.metamorphosisUsed = true;

  tickReproduction(context(state));

  let evolved = state.pieces.find((piece) => piece.id === actor.id);
  assert.equal(evolved.rank, 2);
  assert.equal(evolved.hypermetamorphosisReady, true);

  const special = movesFor(state, evolved).find(
    (target) =>
      target.r === 2 &&
      target.c === 3 &&
      target.capture &&
      target.hypermetamorphosis,
  );
  assert.ok(special);

  state = simulate(state, move(evolved, 2, 3));
  evolved = state.pieces.find((piece) => piece.id === actor.id);
  assert.equal(evolved.hypermetamorphosisReady, false);
  assert.deepEqual([evolved.r, evolved.c], [2, 3]);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Hipermetamorfose" &&
        effect.outcome === "dispersal-used",
    ),
  );
  assertState(state);
});

test("Recrutamento em Massa cria captura curta alinhada com apoio junto à presa", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 2 },
    { owner: "blue", r: 3, c: 6, rank: 0 },
    { owner: "amber", r: 4, c: 6, rank: 0 },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const traits = arthropodTraits([
      "Ovíparo",
      "Incubação",
      "Sociabilidade",
      "Eusocialidade",
      "Recrutamento em Massa",
    ]),
    actor = exactTraits(state.pieces[0], traits),
    supporter = exactTraits(state.pieces[1], traits),
    victimId = state.pieces[2].id;

  const target = movesFor(state, actor).find(
    (candidate) =>
      candidate.r === 4 &&
      candidate.c === 6 &&
      candidate.capture &&
      candidate.massRecruitment,
  );
  assert.ok(target);
  assert.deepEqual(target.path, [
    [4, 5],
    [4, 6],
  ]);

  state = simulate(state, move(actor, 4, 6));
  const moved = state.pieces.find((piece) => piece.id === actor.id);
  assert.deepEqual([moved.r, moved.c], [4, 6]);
  assert.equal(state.pieces.some((piece) => piece.id === victimId), false);
  assert.ok(state.pieces.some((piece) => piece.id === supporter.id));
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Recrutamento em Massa" &&
        effect.outcome === "collective-capture",
    ),
  );
  assertState(state);
});

test("Recrutamento em Massa não atravessa organismo intermediário", () => {
  const state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 2 },
    { owner: "blue", r: 3, c: 6, rank: 0 },
    { owner: "blue", r: 4, c: 5, rank: 0 },
    { owner: "amber", r: 4, c: 6, rank: 0 },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const traits = arthropodTraits([
    "Ovíparo",
    "Incubação",
    "Sociabilidade",
    "Eusocialidade",
    "Recrutamento em Massa",
  ]);
  exactTraits(state.pieces[0], traits);
  exactTraits(state.pieces[1], traits);

  assert.equal(
    movesFor(state, state.pieces[0]).some(
      (candidate) =>
        candidate.r === 4 &&
        candidate.c === 6 &&
        candidate.massRecruitment,
    ),
    false,
  );
});

test("emojis das novas mutações são únicos no catálogo", () => {
  const hyper = TRAITS.Hipermetamorfose[0],
    recruitment = TRAITS["Recrutamento em Massa"][0],
    otherIcons = Object.entries(TRAITS)
      .filter(
        ([trait]) =>
          !["Hipermetamorfose", "Recrutamento em Massa"].includes(trait),
      )
      .map(([, definition]) => definition[0]);

  assert.equal(hyper, "🐞");
  assert.equal(recruitment, "📣");
  assert.notEqual(hyper, recruitment);
  assert.equal(otherIcons.includes(hyper), false);
  assert.equal(otherIcons.includes(recruitment), false);
});
