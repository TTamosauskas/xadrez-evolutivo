import test from "node:test";
import assert from "node:assert/strict";
import { createState } from "../src/state.js";
import {
  CELLULAR_RULES,
  advanceCellularTerrain,
} from "../src/cellular-terrain.js";

const neutralBoard = () => Array(64).fill("neutral");

test("classic B3/S23 evolves a blinker while preserving the normalized count", () => {
  const state = createState(7101, { geologicalStage: "devonian" });
  state.board = neutralBoard();
  for (const cell of [27, 28, 29]) state.board[cell] = "hostile";

  advanceCellularTerrain(state, {
    type: "hostile",
    rule: CELLULAR_RULES.CLASSIC,
    min: 3,
    max: 3,
  });

  assert.deepEqual(
    state.board
      .map((terrain, cell) => (terrain === "hostile" ? cell : null))
      .filter((cell) => cell !== null)
      .sort((a, b) => a - b),
    [20, 28, 36],
  );
});

test("protected cellular terrain survives normalization", () => {
  const state = createState(7102, { geologicalStage: "devonian" });
  state.board = neutralBoard();
  state.board[0] = "fertile";
  state.board[27] = "fertile";
  state.board[28] = "fertile";
  state.board[29] = "fertile";

  advanceCellularTerrain(state, {
    type: "fertile",
    rule: CELLULAR_RULES.MAZECTRIC,
    min: 4,
    max: 4,
    protectedCells: [0],
    changeLimit: 2,
  });

  assert.equal(state.board[0], "fertile");
  assert.equal(
    state.board.filter((terrain) => terrain === "fertile").length,
    4,
  );
});

test("preference cells steer normalized terrain without changing its total", () => {
  const state = createState(7103, { geologicalStage: "devonian" });
  state.board = neutralBoard();
  for (const cell of [9, 10, 17, 18]) state.board[cell] = "hostile";
  const before = state.board.filter((terrain) => terrain === "hostile").length;

  advanceCellularTerrain(state, {
    type: "hostile",
    rule: CELLULAR_RULES.SEEDS,
    min: before,
    max: before,
    preferredCells: [36, 37, 44, 45],
    changeLimit: 4,
  });

  assert.equal(
    state.board.filter((terrain) => terrain === "hostile").length,
    before,
  );
});
