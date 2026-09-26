import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { simulate } from "../src/engine.js";
import { movesFor } from "../src/moves.js";
import { createState, newPiece } from "../src/state.js";
import { traitUnlocked } from "../src/geology.js";

function crawlerTargets(state, piece) {
  return movesFor(state, piece).filter((target) => target.crawler);
}

test("Rastejante gives Pawn and King adjacent wrap moves across the board edge", () => {
  const pawnState = fixture([
      {
        owner: "blue",
        r: 4,
        c: 0,
        rank: 0,
        traits: ["Rastejante"],
      },
      { owner: "amber", r: 0, c: 4, rank: 4 },
    ]),
    pawn = pawnState.pieces[0],
    pawnWrap = crawlerTargets(pawnState, pawn);

  assert.deepEqual(
    pawnWrap.map((target) => [target.r, target.c]).sort(),
    [[3, 7], [4, 7], [5, 7]],
  );

  const kingState = fixture([
      {
        owner: "blue",
        r: 0,
        c: 0,
        rank: 4,
        traits: ["Rastejante"],
      },
      { owner: "amber", r: 4, c: 4, rank: 4 },
    ]),
    king = kingState.pieces[0],
    kingWrap = crawlerTargets(kingState, king);

  for (const expected of [[7, 0], [0, 7], [7, 7], [7, 1], [1, 7]])
    assert.ok(
      kingWrap.some(
        (target) => target.r === expected[0] && target.c === expected[1],
      ),
      expected.join(","),
    );
});

test("Rastejante keeps Bishop, Rook and Queen constrained to their own geometry", () => {
  const cases = [
    { rank: 2, expected: [[3, 7], [5, 7]], forbidden: [[4, 7]] },
    { rank: 3, expected: [[4, 7]], forbidden: [[3, 7], [5, 7]] },
    { rank: 5, expected: [[3, 7], [4, 7], [5, 7]], forbidden: [] },
  ];

  for (const entry of cases) {
    const state = fixture([
        {
          owner: "blue",
          r: 4,
          c: 0,
          rank: entry.rank,
          traits: ["Rastejante"],
        },
        { owner: "amber", r: 0, c: 4, rank: 4 },
      ]),
      piece = state.pieces[0],
      targets = crawlerTargets(state, piece);

    for (const [r, c] of entry.expected)
      assert.ok(
        targets.some((target) => target.r === r && target.c === c),
        `rank ${entry.rank}: ${r},${c}`,
      );
    for (const [r, c] of entry.forbidden)
      assert.equal(
        targets.some((target) => target.r === r && target.c === c),
        false,
        `rank ${entry.rank}: forbidden ${r},${c}`,
      );
  }
});

test("Rastejante wraps Knight geometry instead of granting adjacent King movement", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 0,
        c: 3,
        rank: 1,
        traits: ["Rastejante"],
      },
      { owner: "amber", r: 4, c: 4, rank: 4 },
    ]),
    knight = state.pieces[0],
    targets = crawlerTargets(state, knight);

  for (const expected of [[6, 2], [6, 4], [7, 1], [7, 5]])
    assert.ok(
      targets.some(
        (target) => target.r === expected[0] && target.c === expected[1],
      ),
      expected.join(","),
    );
  assert.equal(
    targets.some((target) => target.r === 7 && target.c === 3),
    false,
  );
});

test("Rastejante can reach the opposite edge even when the ordinary ray is blocked", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 0,
        rank: 3,
        traits: ["Rastejante"],
      },
      { owner: "blue", r: 4, c: 1, rank: 0 },
      { owner: "amber", r: 0, c: 4, rank: 4 },
    ]),
    rook = state.pieces[0],
    target = movesFor(state, rook).find(
      (candidate) => candidate.r === 4 && candidate.c === 7,
    );

  assert.equal(target?.crawler, true);
  assert.deepEqual(target?.path, [[4, 7]]);
});

test("Rastejante treats the wrapped destination as adjacent for Camuflagem", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 0,
        rank: 3,
        traits: ["Rastejante"],
      },
      {
        owner: "amber",
        r: 4,
        c: 7,
        rank: 0,
        traits: ["Camuflagem"],
      },
    ]),
    rook = state.pieces[0],
    target = movesFor(state, rook).find(
      (candidate) => candidate.r === 4 && candidate.c === 7,
    );

  assert.equal(target?.crawler, true);
  assert.equal(target?.capture, true);
});

test("Rastejante movement creates a crawler trace and contextual effect", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 0,
      rank: 3,
      traits: ["Rastejante"],
    },
    { owner: "blue", r: 4, c: 1, rank: 0 },
    { owner: "amber", r: 0, c: 4, rank: 4 },
  ]);
  const actor = state.pieces[0];

  state = simulate(state, move(actor, 4, 7));

  assert.deepEqual(state.movementTrace?.origin, { r: 4, c: 0 });
  assert.deepEqual(state.movementTrace?.path, [{ r: 4, c: 7 }]);
  assert.equal(state.movementTrace?.kind, "crawler");
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Rastejante" &&
        effect.outcome === "crossed-board-edge",
    ),
  );
});

test("Rastejante debuts in the Carboniferous after Locomoção Terrestre", () => {
  const state = createState(991, {
      geologicalStage: "carboniferous",
      naturalBarriers: false,
    }),
    terrestrial = newPiece(state, "blue", 4, 4, {
      traits: [
        "Reparo Celular",
        "Multicelularismo",
        "Predação",
        "Ingestão",
        "Simetria Bilateral",
        "Locomoção Primitiva",
        "Vertebrado",
        "Locomoção Articulada",
        "Locomoção Terrestre",
      ],
    }),
    articulated = newPiece(state, "blue", 4, 5, {
      traits: [
        "Reparo Celular",
        "Multicelularismo",
        "Predação",
        "Ingestão",
        "Simetria Bilateral",
        "Locomoção Primitiva",
        "Vertebrado",
        "Locomoção Articulada",
      ],
    }),
    plant = newPiece(state, "blue", 4, 6, {
      traits: [
        "Reparo Celular",
        "Multicelularismo",
        "Fotossíntese",
        "Embriófitas",
        "Traqueófitas",
      ],
    });

  assert.equal(traitUnlocked(state, "Rastejante", terrestrial), true);
  assert.equal(traitUnlocked(state, "Rastejante", articulated), false);
  assert.equal(traitUnlocked(state, "Rastejante", plant), false);

  state.geologicalStage = "devonian";
  assert.equal(traitUnlocked(state, "Rastejante", terrestrial), false);
});

test("Deficiência Motora suppresses Rastejante edge targets", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 0,
        rank: 3,
        traits: ["Rastejante", "Deficiência Motora"],
      },
      { owner: "amber", r: 0, c: 4, rank: 4 },
    ]),
    piece = state.pieces[0];

  assert.equal(crawlerTargets(state, piece).length, 0);
});
