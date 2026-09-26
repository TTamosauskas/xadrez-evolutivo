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
