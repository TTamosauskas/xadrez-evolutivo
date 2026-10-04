import test from "node:test";
import assert from "node:assert/strict";
import {
  createCampaignState,
  createState,
  newPiece,
  round,
} from "../src/state.js";
import { context, transition } from "../src/engine.js";
import { reproduce } from "../src/reproduction.js";
import { move } from "./helpers.js";

const tutorialEffects = (state, outcome) =>
  (state.passiveEffects ?? []).filter(
    (effect) =>
      effect.theme === "tutorial-tooltip" &&
      (!outcome || effect.outcome === outcome),
  );

test("first click on the grey ancestral King emits the Vivification ring tooltip and not the old reproduction toast", () => {
  let state = createCampaignState(1701, "earth");
  const origin = { ...state.origin };

  state = transition(state, {
    type: "ORIGIN_CLICK",
    revision: state.revision,
  });

  const effects = tutorialEffects(state, "tutorial-vivification-ring");
  assert.equal(effects.length, 1);
  assert.equal(
    effects[0].text,
    "Clique em Vivificar para tentar uma reprodução.",
  );
  assert.equal(effects[0].inlineVivificationRing, true);
  assert.deepEqual(
    [effects[0].targetR, effects[0].targetC],
    [origin.r, origin.c],
  );

  state = transition(state, {
    type: "ORIGIN_CLICK",
    revision: state.revision,
  });
  assert.equal(
    state.passiveEffects.some(
      (effect) => effect.text === "Primeira Reprodução feita.",
    ),
    false,
  );
});

test("first infruitful reproduction emits one anchored tooltip and later failures do not repeat it", () => {
  const state = createState(1702, {
      geologicalStage: "eoarchean",
      naturalBarriers: false,
    }),
    parent = newPiece(state, "blue", 4, 4, { rank: 0 });
  state.pieces = [parent, newPiece(state, "amber", 0, 0, { rank: 4 })];
  state.phase = "move";
  state.origin = null;
  state.reproductions = { blue: 2, amber: 2 };
  state.disableReproductiveSuccessPressure = false;

  const nextRoll = (seed) =>
    ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  let seed = 1;
  while (nextRoll(seed) < 0.9) seed++;
  state.rng = seed;

  assert.equal(
    reproduce(context(state), parent, null, "teste", {
      forcedCount: 1,
      immediateDevelopment: true,
      ignoreReadiness: true,
    }),
    0,
  );
  let effects = tutorialEffects(state, "tutorial-infruitful-reproduction");
  assert.equal(effects.length, 1);
  assert.equal(
    effects[0].text,
    "Reprodução infrutífera. Vivificar recuperou energia",
  );
  assert.equal(effects[0].inlineVivificationRing, true);
  assert.deepEqual([effects[0].targetR, effects[0].targetC], [4, 4]);

  state.rng = seed;
  reproduce(context(state), parent, null, "teste", {
    forcedCount: 1,
    immediateDevelopment: true,
    ignoreReadiness: true,
  });
  effects = tutorialEffects(state, "tutorial-infruitful-reproduction");
  assert.equal(effects.length, 1);
});

test("first predation feeding site emits a one-time fertility tooltip", () => {
  let state = createState(1703, {
    geologicalStage: "cambrian",
    naturalBarriers: false,
  });
  state.board.fill("fertile");
  state.phase = "move";
  state.origin = null;
  state.current = "blue";
  const predator = newPiece(state, "blue", 4, 4, {
      rank: 4,
      traits: ["Predação", "Multicelularismo", "Ingestão"],
    }),
    prey = newPiece(state, "amber", 3, 4, {
      rank: 4,
      traits: ["Fotossíntese"],
    }),
    reserve = newPiece(state, "amber", 0, 0, {
      rank: 4,
      traits: ["Fotossíntese"],
    });
  state.pieces = [predator, prey, reserve];

  state = transition(state, {
    type: "MOVE",
    id: predator.id,
    r: prey.r,
    c: prey.c,
    revision: state.revision,
  });

  const effects = tutorialEffects(state, "tutorial-predation-fertility");
  assert.equal(effects.length, 1);
  assert.equal(effects[0].text, "Predação fertilizou a casa");
  const survivor = state.pieces.find((piece) => piece.id === predator.id);
  assert.deepEqual(
    [effects[0].targetR, effects[0].targetC],
    [survivor.r, survivor.c],
  );
});

test("hostile and lethal terrain lessons are tooltips, not blocking notices", () => {
  let hostile = createState(1704, {
    geologicalStage: "cambrian",
    naturalBarriers: false,
  });
  hostile.phase = "move";
  hostile.origin = null;
  hostile.current = "blue";
  hostile.board.fill("neutral");
  hostile.board[3 * 8 + 4] = "hostile";
  const mover = newPiece(hostile, "blue", 4, 4, {
      rank: 4,
      traits: [
        "Predação",
        "Locomoção Primitiva",
        "Vertebrado",
        "Locomoção Articulada",
        "Locomoção Terrestre",
      ],
    }),
    amber = newPiece(hostile, "amber", 0, 0, { rank: 4 });
  hostile.pieces = [mover, amber];

  hostile = transition(hostile, {
    ...move(mover, 3, 4),
    revision: hostile.revision,
  });
  const hostileEffect = tutorialEffects(
    hostile,
    "tutorial-hostile-cell",
  )[0];
  assert.ok(hostileEffect);
  assert.equal(
    hostileEffect.text,
    "Casa hostil 🟥 oferece perigo de morte",
  );
  assert.equal(
    hostile.notices.some((notice) => notice.title === "Casas hostis"),
    false,
  );

  let lethal = createState(1705, {
    geologicalStage: "eoarchean",
    naturalBarriers: false,
  });
  lethal.phase = "move";
  lethal.origin = null;
  lethal.current = "blue";
  lethal.board.fill("neutral");
  const doomed = newPiece(lethal, "blue", 1, 1, {
      rank: 4,
      traits: [
        "Predação",
        "Locomoção Primitiva",
        "Vertebrado",
        "Locomoção Articulada",
        "Locomoção Terrestre",
      ],
    }),
    other = newPiece(lethal, "amber", 5, 5, { rank: 4 });
  lethal.pieces = [doomed, other];
  // Early Earth corners are lethal independently of ordinary terrain.
  lethal = transition(lethal, {
    ...move(doomed, 0, 0),
    revision: lethal.revision,
  });
  const lethalEffect = tutorialEffects(lethal, "tutorial-lethal-cell")[0];
  assert.ok(lethalEffect);
  assert.equal(
    lethalEffect.text,
    "Casa letal ☠️ implica em morte imediata",
  );
  assert.equal(
    lethal.notices.some((notice) => notice.title === "Casa letal"),
    false,
  );
  assert.ok(
    Number.isInteger(
      lethal.pieces.find((piece) => piece.id === doomed.id)?.lethalDeathRound,
    ),
  );
});
