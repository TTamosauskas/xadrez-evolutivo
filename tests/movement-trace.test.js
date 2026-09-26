import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { simulate } from "../src/engine.js";
import { carcassAt } from "../src/state.js";

test("long movements expose the resolved path for interface animation", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 0, rank: 3 },
    { owner: "amber", r: 0, c: 7, rank: 4 },
  ]);
  const actor = state.pieces[0];

  state = simulate(state, move(actor, 4, 4));

  assert.deepEqual(state.movementTrace, {
    pieceId: actor.id,
    owner: "blue",
    rank: 3,
    origin: { r: 4, c: 0 },
    path: [
      { r: 4, c: 1 },
      { r: 4, c: 2 },
      { r: 4, c: 3 },
      { r: 4, c: 4 },
    ],
    stop: { r: 4, c: 4 },
    outcome: "moved",
    kind: "move",
    jumpedCell: null,
    knightCorrection: false,
  });
});

test("death while crossing hostile terrain stops the visual path and leaves a carcass there", () => {
  let state = fixture(
    [
      { owner: "blue", r: 4, c: 0, rank: 3 },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ],
    0,
  );
  const actor = state.pieces[0];
  state.board[4 * 8 + 1] = "hostile";

  state = simulate(state, move(actor, 4, 4));

  assert.equal(state.pieces.some((piece) => piece.id === actor.id), false);
  assert.deepEqual(state.movementTrace?.stop, { r: 4, c: 1 });
  assert.equal(state.movementTrace?.outcome, "died-hostile");
  assert.deepEqual(state.movementTrace?.path, [{ r: 4, c: 1 }]);
  assert.ok(carcassAt(state, 4, 1));
});

test("Regeneração prevents an environmental carcass when it prevents the death", () => {
  let state = fixture(
    [
      {
        owner: "blue",
        r: 4,
        c: 0,
        rank: 3,
        traits: ["Regeneração"],
      },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ],
    0,
  );
  const actor = state.pieces[0];
  state.board[4 * 8 + 1] = "hostile";

  state = simulate(state, move(actor, 4, 4));

  assert.ok(state.pieces.some((piece) => piece.id === actor.id));
  assert.equal(carcassAt(state, 4, 1), null);
});


test("Bishop, Rook and Queen expose every traversed square in order", () => {
  const cases = [
    {
      rank: 2,
      origin: [5, 1],
      target: [2, 4],
      path: [[4, 2], [3, 3], [2, 4]],
    },
    {
      rank: 3,
      origin: [4, 0],
      target: [4, 4],
      path: [[4, 1], [4, 2], [4, 3], [4, 4]],
    },
    {
      rank: 5,
      origin: [6, 1],
      target: [2, 5],
      path: [[5, 2], [4, 3], [3, 4], [2, 5]],
    },
  ];

  for (const entry of cases) {
    let state = fixture([
      {
        owner: "blue",
        r: entry.origin[0],
        c: entry.origin[1],
        rank: entry.rank,
      },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ]);
    const actor = state.pieces[0];
    state = simulate(state, move(actor, entry.target[0], entry.target[1]));
    assert.deepEqual(
      state.movementTrace?.path,
      entry.path.map(([r, c]) => ({ r, c })),
      `rank ${entry.rank}`,
    );
    assert.equal(state.movementTrace?.kind, "move", `rank ${entry.rank}`);
  }
});

test("Knight long displacement is animated as a jump even with a one-cell logical path", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 1 },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const actor = state.pieces[0];

  state = simulate(state, move(actor, 2, 3));

  assert.deepEqual(state.movementTrace?.origin, { r: 4, c: 4 });
  assert.deepEqual(state.movementTrace?.path, [{ r: 2, c: 3 }]);
  assert.deepEqual(state.movementTrace?.stop, { r: 2, c: 3 });
  assert.equal(state.movementTrace?.kind, "knight");
});

test("ordinary one-cell Pawn and King moves do not create long-movement traces", () => {
  for (const spec of [
    { rank: 0, r: 6, c: 3, target: [5, 3], pawnDir: -1 },
    { rank: 4, r: 4, c: 4, target: [4, 5] },
  ]) {
    let state = fixture([
      {
        owner: "blue",
        r: spec.r,
        c: spec.c,
        rank: spec.rank,
        pawnDir: spec.pawnDir,
      },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]);
    const actor = state.pieces[0];
    state = simulate(state, move(actor, spec.target[0], spec.target[1]));
    assert.equal(state.movementTrace, null, `rank ${spec.rank}`);
  }
});
