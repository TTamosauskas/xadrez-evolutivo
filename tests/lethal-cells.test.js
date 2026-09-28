import test from "node:test";
import assert from "node:assert/strict";
import { square } from "../src/constants.js";
import { lethalDeathsDue, simulate } from "../src/engine.js";
import { movesFor } from "../src/moves.js";
import {
  assertState,
  createState,
  newPiece,
  round,
} from "../src/state.js";
import { move } from "./helpers.js";

function earlyEarthState(stage, seed) {
  const state = createState(seed, {
    scenario: "earth",
    geologicalStage: stage,
    cycle: 1,
    naturalBarriers: false,
    historicalTraits: [
      "Respiração anaeróbia",
      "Fotossíntese",
      "Predação",
    ],
  });
  state.phase = "move";
  state.origin = null;
  state.notices = [];
  state.pieces = [];
  state.nextId = 1;
  state.board.fill("neutral");
  state.barriers = [];
  state.naturalBarriers = [];
  state.current = "blue";
  return state;
}

test("ordinary movement keeps a piece visible on a lethal cell until the next turn resolves it", () => {
  const state = earlyEarthState("eoarchean", 9501),
    mover = newPiece(state, "blue", 1, 1, {
      rank: 4,
      traits: [
        "Predação",
        "Locomoção Primitiva",
        "Vertebrado",
        "Locomoção Articulada",
        "Locomoção Terrestre",
      ],
      ancestry: [
        "Respiração anaeróbia",
        "Predação",
        "Locomoção Primitiva",
        "Vertebrado",
        "Locomoção Articulada",
        "Locomoção Terrestre",
      ],
    }),
    blueAlly = newPiece(state, "blue", 4, 4, {
      rank: 4,
      traits: ["Fotossíntese"],
      ancestry: ["Respiração anaeróbia", "Fotossíntese"],
    }),
    amber = newPiece(state, "amber", 5, 5, {
      rank: 4,
      traits: ["Predação"],
      ancestry: ["Respiração anaeróbia", "Predação"],
    });
  state.pieces.push(mover, blueAlly, amber);

  assert.ok(
    movesFor(state, mover).some(
      (target) => target.r === 0 && target.c === 0 && !target.capture,
    ),
  );
  const landed = simulate(state, move(mover, 0, 0)),
    doomed = landed.pieces.find((piece) => piece.id === mover.id);

  assert.ok(doomed);
  assert.deepEqual([doomed.r, doomed.c], [0, 0]);
  assert.equal(doomed.lethalDeathRound, round(landed) + 1);
  assert.equal(lethalDeathsDue(landed), false);
  assert.ok(landed.logs.some((entry) => /letal/.test(entry.text)));

  const nextRound = simulate(landed, { type: "PASS" });
  assert.equal(lethalDeathsDue(nextRound), true);
  const next = simulate(nextRound, { type: "RESOLVE_LETHAL" });
  assert.equal(next.pieces.some((piece) => piece.id === mover.id), false);
  assert.ok(next.pieces.some((piece) => piece.id === blueAlly.id));
  assert.ok(next.pieces.some((piece) => piece.id === amber.id));
  assertState(next);
});

test("eventless Hadean generation milestones do not throw Evento inválido", () => {
  const state = earlyEarthState("hadean", 9504),
    blue = newPiece(state, "blue", 5, 2, {
      rank: 4,
      traits: ["Fotossíntese"],
      ancestry: ["Respiração anaeróbia", "Fotossíntese"],
    }),
    amber = newPiece(state, "amber", 2, 5, {
      rank: 4,
      traits: ["Predação"],
      ancestry: ["Respiração anaeróbia", "Predação"],
    });
  state.pieces.push(blue, amber);
  state.hadeanTutorial = {
    moved: true,
    divided: true,
    captured: false,
    dividedAtTurn: 0,
  };
  state.turn = 1;
  state.maxGenerationReached = 4;
  state.nextEventGeneration = 4;
  state.pendingEcologicalEvents = 0;

  const next = simulate(state, { type: "PASS" });

  assert.equal(next.event, null);
  assert.equal(next.pendingEcologicalEvents, 0);
  assert.equal(next.nextEventGeneration, 10);
  assertState(next);
});
