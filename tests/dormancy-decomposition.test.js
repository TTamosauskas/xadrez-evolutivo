import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { simulate } from "../src/engine.js";
import { movesFor } from "../src/moves.js";

test("decomposition immunity keeps a dormant predator active after capture", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 4,
      traits: ["Dormência", "Predação"],
    },
    { owner: "amber", r: 4, c: 4, rank: 4 },
    { owner: "amber", r: 3, c: 4, rank: 4 },
  ]);

  const predator = state.pieces[0];
  state = simulate(state, move(predator, 4, 4));

  const survivor = state.pieces.find((piece) => piece.id === predator.id);
  assert.equal(state.board[36], "hostile");
  assert.equal(survivor.decompositionImmunity.cell, 36);
  assert.ok(
    movesFor(state, survivor).some(
      (target) => target.r === 3 && target.c === 4 && target.capture,
    ),
  );
});
