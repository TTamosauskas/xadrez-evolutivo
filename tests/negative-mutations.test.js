import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.js";
import { context } from "../src/engine.js";
import { createState, newPiece } from "../src/state.js";
import { movesFor } from "../src/moves.js";
import {
  applyRegressionEffect,
  consumeReproductionResource,
  negativeMutationChance,
  reproduce,
  tickReproduction,
} from "../src/reproduction.js";
import {
  negativeTraitUnlocked,
  SOMATIC_NEGATIVE_TRAITS,
} from "../src/geology.js";
import {
  pathogenMortalityChance,
} from "../src/disease.js";
import { square } from "../src/constants.js";

const animalTraits = [
  "Reparo Celular",
  "Multicelularismo",
  "Predação",
  "Simetria Bilateral",
  "Locomoção Primitiva",
  "Vertebrado",
  "Locomoção Articulada",
  "Percepção Espacial",
];

function rangedState(extra = [], enemyDistance = 4) {
  const s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 1,
      rank: 3,
      traits: [...animalTraits, ...extra],
    },
    { owner: "amber", r: 4, c: 1 + enemyDistance, rank: 0 },
  ]);
  s.geologicalStage = "devonian";
  s.totalCycles = 2;
  s.cycle = 2;
  return s;
}

test("negative mutation periods and somatic eligibility follow their rules", () => {
  const s = rangedState();
  s.geologicalStage = "ediacaran";
  const p = s.pieces[0];

  assert.equal(negativeTraitUnlocked(s, "Deficiência Motora", p), true);
  assert.equal(negativeTraitUnlocked(s, "Deficiência Sensorial", p), false);
  s.geologicalStage = "cambrian";
  assert.equal(negativeTraitUnlocked(s, "Deficiência Sensorial", p), true);
  assert.equal(SOMATIC_NEGATIVE_TRAITS.has("Deficiência Motora"), true);
  assert.equal(SOMATIC_NEGATIVE_TRAITS.has("Nanismo"), false);
  assert.equal(SOMATIC_NEGATIVE_TRAITS.has("Mutação Mutadora"), false);
});

test("motor and sensory deficiencies constrain movement and capture", () => {
  const normal = rangedState(),
    normalPiece = normal.pieces[0];
  assert.ok(
    movesFor(normal, normalPiece).some(
      (target) => target.r === 4 && target.c === 5 && target.capture,
    ),
  );

  const sensory = rangedState(["Deficiência Sensorial"]),
    sensoryPiece = sensory.pieces[0];
  assert.equal(
    movesFor(sensory, sensoryPiece).some(
      (target) => target.r === 4 && target.c === 5 && target.capture,
    ),
    false,
  );
  assert.ok(
    movesFor(sensory, sensoryPiece).some(
      (target) => target.r === 4 && target.c === 4 && !target.capture,
    ),
  );

  const motor = rangedState(["Deficiência Motora"]),
    motorPiece = motor.pieces[0],
    motorMoves = movesFor(motor, motorPiece);
  assert.ok(motorMoves.some((target) => target.r === 4 && target.c === 2));
  assert.equal(
    motorMoves.some((target) => target.r === 4 && target.c === 3),
    false,
  );
});

test("gigantism halves long-range locomotion but preserves capture range", () => {
  const s = rangedState(["Gigantismo"]),
    p = s.pieces[0],
    moves = movesFor(s, p);
  assert.ok(moves.some((target) => target.r === 4 && target.c === 4));
  assert.equal(
    moves.some((target) => target.r === 4 && target.c === 5 && !target.capture),
    false,
  );
  assert.ok(
    moves.some((target) => target.r === 4 && target.c === 5 && target.capture),
  );
});

test("nanism forces pawn form", () => {
  const s = createState(9, {
      geologicalStage: "cambrian",
      naturalBarriers: false,
    }),
    p = newPiece(s, "blue", 4, 4, {
      rank: 5,
      traits: [...animalTraits, "Nanismo"],
    });
  assert.equal(p.rank, 0);
});

test("only-child is a lifetime one-offspring limit and respiratory insufficiency slows recovery", () => {
  const only = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 0,
        traits: ["Reparo Celular", "Multicelularismo", "Filho único"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    onlyParent = only.pieces[0];
  assert.equal(
    reproduce(context(only), onlyParent, null, "teste", { forcedCount: 4 }),
    1,
  );
  assert.equal(onlyParent.lifetimeOffspring, 1);
  only.turn = onlyParent.nextReproductionRound * 2;
  assert.equal(
    reproduce(context(only), onlyParent, null, "teste", { forcedCount: 4 }),
    0,
  );
  assert.ok(only.pieces.some((piece) => piece.id === onlyParent.id));

  const respiratory = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 5,
        traits: [
          "Reparo Celular",
          "Multicelularismo",
          "Insuficiência Respiratória",
        ],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    respiratoryParent = respiratory.pieces[0];
  assert.equal(
    reproduce(context(respiratory), respiratoryParent, null, "teste", {
      forcedCount: 1,
      fertileReproduction: true,
    }),
    1,
  );
  assert.equal(respiratoryParent.nextReproductionRound, 12);

  const predator = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 5,
        traits: [
          "Reparo Celular",
          "Multicelularismo",
          "Predação",
          "Insuficiência Respiratória",
        ],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    predatorParent = predator.pieces[0];
  assert.equal(
    reproduce(context(predator), predatorParent, null, "predação", {
      forcedCount: 1,
    }),
    1,
  );
  assert.equal(predatorParent.nextReproductionRound, 12);
});

test("only-child sexual partner becomes unavailable after one descendant", () => {
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
        traits: ["Reprodução Sexuada", "Filho único"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0],
    mate = s.pieces[1];

  assert.equal(
    reproduce(context(s), parent, mate, "teste", {
      forcedCount: 4,
      ignoreReadiness: true,
      immediateDevelopment: true,
    }),
    1,
  );
  assert.equal(mate.lifetimeOffspring, 1);
  assert.ok(s.pieces.some((piece) => piece.id === mate.id));
  assert.equal(
    reproduce(context(s), parent, mate, "teste", {
      forcedCount: 1,
      ignoreReadiness: true,
      immediateDevelopment: true,
    }),
    0,
  );
});

test("subfertility can spend a reproductive attempt without offspring", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 5,
        traits: [
          "Reparo Celular",
          "Multicelularismo",
          "Reprodução Sexuada",
          "Subfertilidade",
        ],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0];
  s.rng = 0;
  assert.equal(
    reproduce(context(s), parent, null, "teste", { forcedCount: 1 }),
    0,
  );
  assert.equal(parent.nextReproductionRound, 6);
});

test("malabsorption consumes one additional adjacent fertile resource", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: [
          "Reparo Celular",
          "Multicelularismo",
          "Predação",
          "Má absorção Alimentar",
        ],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0],
    primary = square(4, 4),
    extra = square(4, 5);
  s.board.fill("neutral");
  s.board[primary] = "fertile";
  s.board[extra] = "fertile";
  assert.equal(consumeReproductionResource(s, parent, primary), 2);
  assert.equal(s.board[primary], "neutral");
  assert.equal(s.board[extra], "neutral");
});

test("malabsorption doubles recovery after reproductive predation", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 5,
        traits: [
          "Reparo Celular",
          "Multicelularismo",
          "Predação",
          "Má absorção Alimentar",
        ],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0];

  assert.equal(
    reproduce(context(s), parent, null, "predação", { forcedCount: 1 }),
    1,
  );
  assert.equal(parent.nextReproductionRound, 12);
});

test("semelparity kills the parent after the first successful reproduction", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 5,
        traits: ["Reparo Celular", "Multicelularismo", "Semelparidade"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0],
    id = parent.id;

  assert.equal(
    reproduce(context(s), parent, null, "teste", { forcedCount: 1 }),
    1,
  );
  assert.equal(parent.lifetimeReproductions, 1);
  assert.equal(s.pieces.some((piece) => piece.id === id), false);
});

test("viviparous semelparity waits for the final brood before death", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 5,
        traits: [
          "Reparo Celular",
          "Multicelularismo",
          "Ovíparo",
          "Ovíparos Amniotas",
          "Vivíparo",
          "Semelparidade",
        ],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0],
    id = parent.id;

  assert.equal(
    reproduce(context(s), parent, null, "teste", { forcedCount: 1 }),
    1,
  );
  assert.equal(s.pieces.some((piece) => piece.id === id), true);
  assert.equal(parent.semelparityDeathPending, true);
  assert.equal(parent.pregnancies.length, 1);

  s.turn = 6;
  const before = s.pieces.length;
  tickReproduction(context(s));
  assert.equal(s.pieces.some((piece) => piece.id === id), false);
  assert.ok(s.pieces.length >= before);
});

test("immunodeficiency cancels Resistance against pathogens", () => {
  const disease = { mortality: 40, source: "population", agent: "virus" };
  assert.equal(
    pathogenMortalityChance({ traits: ["Resistência"] }, disease),
    0.1,
  );
  assert.equal(
    pathogenMortalityChance(
      { traits: ["Resistência", "Imunodeficiência"] },
      disease,
    ),
    0.4,
  );
});

test("regression hides about half of eligible active positive phenotypes", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: [
          "Reparo Celular",
          "Multicelularismo",
          "Resistência",
          "Regeneração",
          "Reprodução Sexuada",
          "Regressão Evolutiva",
        ],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    p = s.pieces[0],
    before = new Set(p.traits);
  s.rng = 0;
  const hidden = applyRegressionEffect(s, p);
  assert.ok(hidden.length >= 1);
  for (const trait of hidden) assert.equal(p.traits.includes(trait), false);
  for (const trait of hidden) {
    const pair = p.genome[trait];
    assert.equal(
      pair.some(
        (allele) =>
          allele.value === "derived" && allele.dominance === "recessive",
      ),
      true,
    );
  }
  assert.ok(before.has("Regressão Evolutiva"));
  assert.ok(p.traits.includes("Regressão Evolutiva"));
});

test("mutator mutation doubles the current negative-mutation chance", () => {
  assert.equal(
    negativeMutationChance({
      rank: 0,
      traits: ["Reparo Celular", "Mutação Mutadora"],
    }),
    2 / 5,
  );
  assert.equal(
    negativeMutationChance({
      rank: 4,
      traits: ["Reparo Celular", "Mutação Mutadora"],
    }),
    2 / 3,
  );
  assert.equal(
    negativeMutationChance({
      rank: 4,
      traits: ["Mutação Mutadora"],
    }),
    1,
  );
});
