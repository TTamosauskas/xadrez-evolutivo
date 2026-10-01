import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AI_ACTION_TYPES,
  AI_SEARCH_PROFILES,
  chooseAction,
  captureGeometryPriority,
  evaluateForAI,
  strategicPieceValue,
} from "../src/ai.js";
import { genomeFromTraits } from "../src/genetics.js";
import { arenaAISide, arenaSetupGenomeValid } from "../src/arena.js";
import { fixture } from "./helpers.js";

test("AI explicitly tracks every legal action type exposed by moves.js", () => {
  const source = readFileSync(new URL("../src/moves.js", import.meta.url), "utf8"),
    actionTypes = [
      ...new Set(
        [...source.matchAll(/type:\s*"([A-Z][A-Z0-9_-]+)"/g)].map(
          (match) => match[1],
        ),
      ),
    ].sort(),
    known = new Set(AI_ACTION_TYPES);

  assert.ok(actionTypes.length >= 25);
  assert.deepEqual(
    actionTypes.filter((type) => !known.has(type)),
    [],
  );
});

test("hard search is materially deeper and larger than medium search", () => {
  const medium = AI_SEARCH_PROFILES.medium,
    hard = AI_SEARCH_PROFILES.hard;

  assert.equal(medium.depth, 1);
  assert.ok(hard.depth >= 3);
  assert.ok(hard.budget >= medium.budget * 4);
  assert.ok(hard.maxNodes >= medium.maxNodes * 4);
  assert.ok(hard.branchWidth >= 8);
});

test("AI valuation penalizes deleterious genetics instead of rewarding trait count", () => {
  const state = fixture([
      { owner: "blue", r: 6, c: 2, rank: 2 },
      { owner: "amber", r: 1, c: 5, rank: 2 },
    ], 9201),
    blue = state.pieces.find((piece) => piece.owner === "blue"),
    amber = state.pieces.find((piece) => piece.owner === "amber"),
    baselineBlue = strategicPieceValue(state, blue),
    baselineAmber = strategicPieceValue(state, amber);

  assert.equal(baselineBlue, baselineAmber);

  blue.traits.push("Esterilidade");
  blue.genome = genomeFromTraits(blue.traits);
  assert.ok(strategicPieceValue(state, blue) < baselineBlue);
  assert.ok(evaluateForAI(state, "blue") < 0);
});

test("hard mode performs a bounded multi-ply search while medium remains one-ply", () => {
  const state = fixture([
      { owner: "blue", r: 5, c: 2, rank: 3 },
      { owner: "blue", r: 6, c: 5, rank: 1 },
      { owner: "amber", r: 2, c: 2, rank: 3 },
      { owner: "amber", r: 1, c: 5, rank: 1 },
    ], 9202),
    mediumStats = {},
    hardStats = {};

  chooseAction(state, "medium", {
    now: () => 0,
    maxNodes: 80,
    stats: mediumStats,
  });
  chooseAction(state, "hard", {
    now: () => 0,
    maxNodes: 240,
    stats: hardStats,
  });

  assert.equal(mediumStats.depth, 1);
  assert.equal(hardStats.depth, 3);
  assert.ok(hardStats.nodes > mediumStats.nodes);
});


test("hard Arena setup can add a legal counter that is absent from static presets", () => {
  const opponent = [
      ["Predação", "Multicelularismo"],
      ["Fotossíntese", "Multicelularismo"],
    ],
    hard = arenaAISide("hard", opponent, 9301);

  assert.equal(hard.length, 2);
  assert.ok(hard[0].includes("Herbívoro"));
  assert.ok(arenaSetupGenomeValid(hard[0], "animal"));
  assert.ok(arenaSetupGenomeValid(hard[1], "plant"));
});


test("capture geometry rewards moves that create a concrete next-turn capture", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 4, rank: 3 },
      { owner: "amber", r: 1, c: 5, rank: 0 },
    ], 9401),
    rook = state.pieces[0],
    attacking = { type: "MOVE", id: rook.id, r: 4, c: 5 },
    drifting = { type: "MOVE", id: rook.id, r: 4, c: 3 };

  assert.ok(
    captureGeometryPriority(state, rook, attacking) >
      captureGeometryPriority(state, rook, drifting),
  );
});

test("capture geometry gains extra weight in late stalled positions", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 4, rank: 3 },
      { owner: "amber", r: 1, c: 5, rank: 0 },
      { owner: "blue", r: 7, c: 0 },
      { owner: "blue", r: 7, c: 1 },
      { owner: "blue", r: 7, c: 2 },
      { owner: "blue", r: 7, c: 3 },
      { owner: "amber", r: 0, c: 0 },
      { owner: "amber", r: 0, c: 1 },
      { owner: "amber", r: 0, c: 2 },
      { owner: "amber", r: 0, c: 3 },
    ], 9402),
    rook = state.pieces[0],
    action = { type: "MOVE", id: rook.id, r: 4, c: 5 };

  state.turn = 20;
  state.lastSuccessfulCaptureRound = 10;
  const early = captureGeometryPriority(state, rook, action);

  state.turn = 160;
  state.lastSuccessfulCaptureRound = 40;
  const stalled = captureGeometryPriority(state, rook, action);

  assert.ok(stalled > early);
});
