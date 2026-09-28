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
  assert.equal(doomed.lethalDeathTurn, landed.turn);
  assert.equal(lethalDeathsDue(landed), true);
  assert.ok(landed.logs.some((entry) => /letal/.test(entry.text)));

  const next = simulate(landed, { type: "RESOLVE_LETHAL" });
  assert.equal(next.pieces.some((piece) => piece.id === mover.id), false);
  assert.ok(next.pieces.some((piece) => piece.id === blueAlly.id));
  assert.ok(next.pieces.some((piece) => piece.id === amber.id));
  assertState(next);
});

test("a capture into a lethal Hadean cell removes the victim but leaves the doomed attacker visible", () => {
  const state = earlyEarthState("hadean", 9502);
  state.hadeanTutorial = {
    moved: true,
    divided: true,
    captured: false,
    dividedAtTurn: 0,
  };
  state.hadeanPredationGranted = { blue: true, amber: true };
  state.hadeanCaptureUnlocked = true;

  const attacker = newPiece(state, "blue", 2, 2, {
      rank: 4,
      traits: ["Predação"],
      ancestry: ["Respiração anaeróbia", "Fotossíntese", "Predação"],
    }),
    blueAlly = newPiece(state, "blue", 5, 2, {
      rank: 4,
      traits: ["Fotossíntese"],
      ancestry: ["Respiração anaeróbia", "Fotossíntese"],
    }),
    victim = newPiece(state, "amber", 1, 1, {
      rank: 4,
      traits: ["Fotossíntese"],
      ancestry: ["Respiração anaeróbia", "Fotossíntese"],
    }),
    amberAlly = newPiece(state, "amber", 2, 5, {
      rank: 4,
      traits: ["Fotossíntese"],
      ancestry: ["Respiração anaeróbia", "Fotossíntese"],
    });
  state.pieces.push(attacker, blueAlly, victim, amberAlly);

  assert.ok(
    movesFor(state, attacker).some(
      (target) => target.r === 1 && target.c === 1 && target.capture,
    ),
  );
  const landed = simulate(state, move(attacker, 1, 1)),
    doomed = landed.pieces.find((piece) => piece.id === attacker.id);

  assert.equal(landed.pieces.some((piece) => piece.id === victim.id), false);
  assert.ok(doomed);
  assert.deepEqual([doomed.r, doomed.c], [1, 1]);
  assert.equal(lethalDeathsDue(landed), true);
  assert.equal(landed.hadeanTutorial.captured, true);

  const next = simulate(landed, { type: "RESOLVE_LETHAL" });
  assert.equal(next.pieces.some((piece) => piece.id === attacker.id), false);
  assert.ok(next.pieces.some((piece) => piece.id === blueAlly.id));
  assert.ok(next.pieces.some((piece) => piece.id === amberAlly.id));
  assertState(next);
});

test("Hadean reproduction may place a newborn in a lethal cell and keeps it visible until resolution", () => {
  const state = earlyEarthState("hadean", 9503);
  state.hadeanTutorial = {
    moved: true,
    divided: true,
    captured: false,
    dividedAtTurn: 0,
  };
  const parent = newPiece(state, "blue", 2, 2, {
      rank: 4,
      traits: ["Fotossíntese"],
      ancestry: ["Respiração anaeróbia", "Fotossíntese"],
    }),
    amber = newPiece(state, "amber", 5, 5, {
      rank: 4,
      traits: ["Fotossíntese"],
      ancestry: ["Respiração anaeróbia", "Fotossíntese"],
    });
  state.pieces.push(parent, amber);
  state.board[square(parent.r, parent.c)] = "fertile";
  parent.nextReproductionRound = round(state);
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = parent.r + dr,
        c = parent.c + dc;
      if (r === 1 && c === 1) continue;
      state.barriers.push(square(r, c));
    }

  const beforeNextId = state.nextId,
    landed = simulate(state, move(parent, parent.r, parent.c)),
    newborn = landed.pieces.find((piece) => piece.id >= beforeNextId);

  assert.ok(landed.nextId > beforeNextId);
  assert.ok(newborn);
  assert.deepEqual([newborn.r, newborn.c], [1, 1]);
  assert.equal(lethalDeathsDue(landed), true);
  assert.ok(landed.logs.some((entry) => /letal/.test(entry.text)));

  const next = simulate(landed, { type: "RESOLVE_LETHAL" });
  assert.equal(
    next.pieces.some((piece) => piece.id === newborn.id),
    false,
  );
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
