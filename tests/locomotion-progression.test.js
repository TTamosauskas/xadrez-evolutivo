import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.js";
import { movesFor, serotoninRepositionTargets } from "../src/moves.js";
import { GEOLOGICAL_STAGES } from "../src/geology.js";
import { terrain } from "../src/state.js";

function exactTraits(piece, traits) {
  piece.traits = [...traits];
  piece.ancestry = [...traits];
  piece.somaticMutations = [];
  return piece;
}

function targetKeys(state, piece) {
  return movesFor(state, piece)
    .map((target) => `${target.r},${target.c}`)
    .sort();
}

test("Locomoção Primitiva universally moves only one cell and only to fertile terrain", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 3, rank: 5 },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    piece = exactTraits(state.pieces[0], [
      "Predação",
      "Locomoção Primitiva",
    ]);
  state.geologicalStage = "ediacaran";
  state.board.fill("neutral");
  state.board[4 * 8 + 4] = "fertile";
  state.board[3 * 8 + 2] = "fertile";
  state.board[4 * 8 + 5] = "fertile";

  const targets = movesFor(state, piece).filter((target) => !target.capture);

  assert.ok(targets.some((target) => target.r === 4 && target.c === 4));
  assert.ok(targets.some((target) => target.r === 3 && target.c === 2));
  assert.equal(
    targets.some((target) => target.r === 4 && target.c === 5),
    false,
  );
  assert.ok(
    targets.every(
      (target) =>
        Math.max(
          Math.abs(target.r - piece.r),
          Math.abs(target.c - piece.c),
        ) === 1 &&
        terrain(state, target.r, target.c) === "fertile",
    ),
  );
});

test("Locomoção Articulada restores full piece geometry but still requires a fertile destination", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 0, rank: 5 },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ]),
    piece = exactTraits(state.pieces[0], [
      "Predação",
      "Locomoção Articulada",
    ]);
  state.geologicalStage = "cambrian";
  state.board.fill("neutral");
  state.board[4 * 8 + 5] = "fertile";
  state.board[1 * 8 + 3] = "fertile";

  const targets = movesFor(state, piece).filter((target) => !target.capture);

  assert.ok(targets.some((target) => target.r === 4 && target.c === 5));
  assert.ok(targets.some((target) => target.r === 1 && target.c === 3));
  assert.equal(
    targets.some((target) => target.r === 4 && target.c === 1),
    false,
  );
  assert.ok(
    targets.every(
      (target) => terrain(state, target.r, target.c) === "fertile",
    ),
  );
});

test("Ordovician articulated Knights retain their complete chess geometry on the aquatic board", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 4, rank: 1 },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    piece = exactTraits(state.pieces[0], [
      "Predação",
      "Locomoção Articulada",
    ]);
  state.geologicalStage = "ordovician";
  state.board.fill("fertile");

  const targets = movesFor(state, piece).filter((target) => !target.capture);
  assert.equal(targets.length, 8);
});

test("Locomoção Terrestre removes the fertile landing restriction without changing geometry", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 0, rank: 5 },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ]),
    piece = exactTraits(state.pieces[0], [
      "Predação",
      "Locomoção Terrestre",
    ]);
  state.geologicalStage = "silurian";
  state.board.fill("neutral");
  state.board[4 * 8 + 5] = "hostile";

  const targets = movesFor(state, piece).filter((target) => !target.capture);

  assert.ok(targets.some((target) => target.r === 4 && target.c === 1));
  assert.ok(targets.some((target) => target.r === 4 && target.c === 5));
});

test("the locomotion landing rule is independent of geological period and cycle", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 0, rank: 3 },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ]),
    piece = exactTraits(state.pieces[0], [
      "Predação",
      "Locomoção Articulada",
    ]);
  state.board.fill("neutral");
  for (const c of [1, 3, 5, 7]) state.board[4 * 8 + c] = "fertile";

  state.geologicalStage = "ediacaran";
  state.cycle = 1;
  const early = targetKeys(state, piece);

  state.geologicalStage = "silurian";
  state.cycle = 9;
  const late = targetKeys(state, piece);

  assert.deepEqual(late, early);
});

test("Serotonina follows the same universal fertile landing rule before the Silurian", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 4, rank: 4 },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    piece = exactTraits(state.pieces[0], [
      "Predação",
      "Locomoção Primitiva",
      "Serotonina",
    ]);
  state.geologicalStage = "ediacaran";
  state.board.fill("neutral");
  state.board[4 * 8 + 5] = "fertile";
  state.phase = "serotonin-reposition";
  state.serotoninReposition = {
    id: piece.id,
    defense: "teste",
  };

  assert.deepEqual(serotoninRepositionTargets(state), [{ r: 4, c: 5 }]);
});

test("aquatic stages through the Ordovician remain fully fertile for the new progression", () => {
  const stages = ["ediacaran", "cambrian", "ordovician"].map((id) =>
    GEOLOGICAL_STAGES.find((stage) => stage.id === id),
  );
  assert.ok(stages.every((stage) => stage?.habitat?.fertile === 64));
  assert.deepEqual(
    GEOLOGICAL_STAGES.find((stage) => stage.id === "silurian")?.required,
    ["Locomoção Terrestre", "Coletor"],
  );
});
