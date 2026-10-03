import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AI_ACTION_TYPES,
  AI_SEARCH_PROFILES,
  chooseAction,
  captureGeometryPriority,
  evaluateForAI,
  actionPriority,
  strategicPieceValue,
} from "../src/ai.js";
import { genomeFromTraits } from "../src/genetics.js";
import { arenaAISide, arenaSetupGenomeValid } from "../src/arena.js";
import { legalActions, movesFor } from "../src/moves.js";
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


test("medium and hard perform a shallow evaluation of every legal root before deepening", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 4, rank: 4 },
      { owner: "blue", r: 6, c: 1, rank: 2 },
      { owner: "amber", r: 1, c: 4, rank: 4 },
      { owner: "amber", r: 1, c: 1, rank: 2 },
    ], 9501),
    roots = legalActions(state).length;

  for (const difficulty of ["medium", "hard"]) {
    const stats = {};
    let tick = 0;
    chooseAction(state, difficulty, {
      now: () => tick++ * 1000,
      budget: 1,
      maxNodes: 1,
      stats,
    });
    assert.equal(stats.completedRoots, roots);
    assert.equal(stats.rootActions, roots);
    assert.equal(stats.rootCoverage, 1);
    assert.ok(stats.nodes >= roots);
  }
});

test("Haustorio is evaluated as a drain action rather than a destructive capture", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 0,
        traits: [
          "Respiração anaeróbia",
          "Fotossíntese",
          "Embriófitas",
          "Traqueófitas",
          "Gimnospermas",
          "Angiospermas",
          "Haustório",
        ],
      },
      {
        owner: "amber",
        r: 4,
        c: 5,
        rank: 0,
        traits: ["Respiração anaeróbia", "Fotossíntese"],
      },
    ], 9502),
    plant = state.pieces[0];
  state.board[4 * 8 + 5] = "fertile";
  state.turn = 200;
  state.lastSuccessfulCaptureRound = 0;

  const target = movesFor(state, plant).find((entry) => entry.haustoriumDrain);
  assert.ok(target);
  const action = { type: "MOVE", id: plant.id, r: target.r, c: target.c };
  assert.equal(
    actionPriority(state, action, { resolutionLevel: 3 }),
    actionPriority(state, action, { resolutionLevel: 0 }),
  );
});

test("Micorrizas receives explicit strategic value during root ordering", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 0,
        traits: [
          "Respiração anaeróbia",
          "Fotossíntese",
          "Embriófitas",
          "Micorrizas",
        ],
      },
      { owner: "amber", r: 0, c: 0, rank: 0, traits: ["Fotossíntese"] },
    ], 9503),
    plant = state.pieces[0];
  plant.energy = 20;
  plant.energyCapacitySnapshot = 20;
  const target = movesFor(state, plant).find((entry) => entry.mycorrhiza);
  assert.ok(target);
  const action = { type: "MOVE", id: plant.id, r: target.r, c: target.c };
  assert.ok(actionPriority(state, action) >= 10);
});
