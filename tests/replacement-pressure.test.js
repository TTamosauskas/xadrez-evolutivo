import test from "node:test";
import assert from "node:assert/strict";
import {
  replacementPressure,
  recordDemographicDelta,
} from "../src/state.js";
import { replacementReproductionPressure } from "../src/reproduction.js";

function population(count, blue = Math.ceil(count / 2)) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    owner: index < blue ? "blue" : "amber",
  }));
}

test("replacement pressure detects high churn even with zero net growth", () => {
  const state = {
    turn: 40,
    pieces: population(28, 14),
    demographicHistory: [
      { round: 17, births: 5, deaths: 5 },
      { round: 20, births: 5, deaths: 5 },
    ],
  };
  const pressure = replacementPressure(state);
  assert.equal(pressure.net, 0);
  assert.equal(pressure.churn, 10);
  assert.equal(pressure.level, 2);
});

test("replacement pressure reaches level 3 and locks reproduction after turn 160", () => {
  const state = {
    turn: 160,
    pieces: population(32, 16),
    demographicHistory: [
      { round: 76, births: 7, deaths: 7 },
      { round: 80, births: 7, deaths: 7 },
    ],
  };
  const policy = replacementReproductionPressure(state, state.pieces[0]);
  assert.equal(policy.level, 3);
  assert.equal(policy.cooldown, 3);
  assert.equal(policy.limit, 0);
  assert.equal(policy.suppressPredation, true);
});

test("level 3 replacement pressure slows but does not lock reproduction before turn 160", () => {
  const state = {
    turn: 158,
    pieces: population(32, 16),
    demographicHistory: [
      { round: 75, births: 8, deaths: 7 },
      { round: 79, births: 7, deaths: 7 },
    ],
  };
  const policy = replacementReproductionPressure(state, state.pieces[0]);
  assert.equal(policy.level, 3);
  assert.equal(policy.cooldown, 3);
  assert.equal(policy.limit, Infinity);
});

test("demographic tracking treats thanatosis as continued existence", () => {
  const previous = {
      turn: 20,
      pieces: [{ id: 1 }, { id: 2 }],
      thanatosis: [],
      demographicHistory: [],
    },
    state = {
      turn: 20,
      pieces: [{ id: 1 }],
      thanatosis: [{ piece: { id: 2 } }],
      demographicHistory: [],
    };
  const delta = recordDemographicDelta(state, previous);
  assert.deepEqual(delta, { births: 0, deaths: 0 });
  assert.deepEqual(state.demographicHistory, []);
});

test("demographic history records births and deaths in the rolling window", () => {
  const previous = {
      turn: 20,
      pieces: [{ id: 1 }, { id: 2 }],
      thanatosis: [],
      demographicHistory: [{ round: 0, births: 99, deaths: 99 }],
    },
    state = {
      turn: 20,
      pieces: [{ id: 1 }, { id: 3 }, { id: 4 }],
      thanatosis: [],
      demographicHistory: [{ round: 0, births: 99, deaths: 99 }],
    };
  const delta = recordDemographicDelta(state, previous);
  assert.deepEqual(delta, { births: 2, deaths: 1 });
  assert.deepEqual(state.demographicHistory, [
    { round: 10, births: 2, deaths: 1 },
  ]);
});
