import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { simulate } from "../src/engine.js";
import { dormant, movesFor } from "../src/moves.js";

test("fresh predation fertility stays active before remains appear", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 4,
      traits: ["Predação"],
    },
    { owner: "amber", r: 4, c: 4, rank: 4 },
    { owner: "amber", r: 3, c: 4, rank: 4 },
  ]);

  const predator = state.pieces[0];
  state = simulate(state, move(predator, 4, 4));

  const survivor = state.pieces.find((piece) => piece.id === predator.id);
  assert.equal(state.board[36], "fertile");
  assert.equal(state.captureDisturbances.length, 0);
  assert.equal(state.carcasses.length, 0);
  assert.equal(survivor.predationEnergy, true);
  assert.ok(
    movesFor(state, survivor).some(
      (target) => target.r === 3 && target.c === 4 && target.capture,
    ),
  );
});

test("Dormência has no active-piece state", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 3,
        rank: 4,
        traits: ["Dormência", "Predação"],
      },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    piece = state.pieces[0];
  state.board[piece.r * 8 + piece.c] = "hostile";

  assert.equal(piece.traits.includes("Dormência"), false);
  assert.equal(dormant(state, piece), false);
});
