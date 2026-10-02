import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { movesFor } from "../src/moves.js";
import { transition } from "../src/engine.js";
import { round } from "../src/state.js";
import {
  GEOLOGICAL_STAGES,
  TRAIT_STAGE,
  TRAIT_DEPENDENCIES,
  PLANT_INCOMPATIBLE_TRAITS,
} from "../src/geology.js";

function pursuitState() {
  const state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      traits: ["Cefalização"],
    },
    {
      owner: "amber",
      r: 2,
      c: 4,
    },
  ]);
  state.turn = 24;
  state.current = "blue";
  state.lastSuccessfulCaptureRound = 0;
  return state;
}

test("Cefalização belongs to the Ediacaran predatory bilateral lineage", () => {
  assert.equal(TRAIT_STAGE.Cefalização, "ediacaran");
  assert.deepEqual(
    TRAIT_DEPENDENCIES.Cefalização.lineage,
    [
      "Predação",
      "Multicelularismo",
      "Simetria Bilateral",
      "Locomoção Primitiva",
    ],
  );
});

test("Cefalização is mandatory in the Ediacaran and precedes both Cambrian body plans", () => {
  const ediacaran = GEOLOGICAL_STAGES.find((stage) => stage.id === "ediacaran");

  assert.ok(ediacaran.required.includes("Cefalização"));
  assert.deepEqual(
    ediacaran.cycles[0],
    ["Simetria Bilateral", "Locomoção Primitiva", "Cefalização"],
  );
  assert.ok(TRAIT_DEPENDENCIES.Vertebrado.lineage.includes("Cefalização"));
  assert.ok(TRAIT_DEPENDENCIES["Artrópode"].lineage.includes("Cefalização"));
  assert.ok(PLANT_INCOMPATIBLE_TRAITS.has("Cefalização"));
});

test("Cefalização creates a pursuit capture exactly two cells away after 12 stalled rounds", () => {
  const state = pursuitState(),
    predator = state.pieces.find((piece) => piece.owner === "blue"),
    target = movesFor(state, predator).find(
      (candidate) => candidate.r === 2 && candidate.c === 4,
    );

  assert.ok(target);
  assert.equal(target.capture, true);
  assert.equal(target.cephalization, true);
  assert.equal(target.noContinuation, true);
  assert.deepEqual(target.path, [
    [3, 4],
    [2, 4],
  ]);
});

test("Cefalização does not activate before offensive stagnation reaches 12 rounds", () => {
  const state = pursuitState(),
    predator = state.pieces.find((piece) => piece.owner === "blue");
  state.turn = 22;

  assert.equal(round(state), 11);
  assert.equal(
    movesFor(state, predator).some(
      (target) => target.r === 2 && target.c === 4 && target.cephalization,
    ),
    false,
  );
});

test("Cefalização requires a free valid intermediate cell", () => {
  const state = pursuitState(),
    predator = state.pieces.find((piece) => piece.owner === "blue");
  state.barriers.push(3 * 8 + 4);

  assert.equal(
    movesFor(state, predator).some(
      (target) => target.r === 2 && target.c === 4 && target.cephalization,
    ),
    false,
  );
});

test("Cefalização resolves through the normal move-capture path and occupies the prey cell", () => {
  const state = pursuitState(),
    predator = state.pieces.find((piece) => piece.owner === "blue"),
    prey = state.pieces.find((piece) => piece.owner === "amber"),
    next = transition(state, move(predator, prey.r, prey.c)),
    moved = next.pieces.find((piece) => piece.id === predator.id);

  assert.ok(moved);
  assert.equal(moved.r, prey.r);
  assert.equal(moved.c, prey.c);
  assert.equal(next.pieces.some((piece) => piece.id === prey.id), false);
  assert.equal(next.lastSuccessfulCaptureRound, 12);
  assert.equal(
    next.passiveEffects.some(
      (effect) =>
        effect.trait === "Cefalização" &&
        effect.outcome === "cephalization-pursuit-capture",
    ),
    true,
  );
});
