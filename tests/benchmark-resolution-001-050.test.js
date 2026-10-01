import test from "node:test";
import assert from "node:assert/strict";
import { createState, assertState } from "../src/state.js";
import { transition } from "../src/engine.js";
import { chooseAction } from "../src/ai.js";
import { legalActions } from "../src/moves.js";

const START = 1;
const END = 50;
const TURN_LIMIT = 200;
const COMMAND_LIMIT = 4000;

test("benchmark pós-resolução seeds 1–50", { timeout: 360000 }, () => {
  const decisiveTurns = [];
  let over200 = 0, technicalCaps = 0, drawsWithin200 = 0;
  const byPolicy = Object.fromEntries(
    ["random", "easy", "medium", "hard"].map((policy) => [
      policy, { games: 0, decisiveWithin200: 0, over200: 0, draws: 0 },
    ]),
  );

  for (let seed = START; seed <= END; seed++) {
    let state = createState(seed), random = seed, commands = 0;
    const policy = seed % 4 === 0 ? "random" : ["easy", "medium", "hard"][seed % 3];
    byPolicy[policy].games++;

    while (!state.result && state.turn < TURN_LIMIT && commands < COMMAND_LIMIT) {
      if (state.notices.length) {
        state = transition(state, { type: "ACK_NOTICE", id: state.notices[0].id });
        commands++;
        continue;
      }
      const actions = legalActions(state);
      let action;
      if (seed % 4 === 0) {
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
        action = actions[random % actions.length] ?? { type: "PASS" };
      } else {
        action = chooseAction(state, ["easy", "medium", "hard"][seed % 3], {
          budget: 5,
          maxNodes: 30,
        });
      }
      state = transition(state, action);
      assertState(state);
      commands++;
    }

    if (commands >= COMMAND_LIMIT && !state.result && state.turn < TURN_LIMIT) {
      technicalCaps++;
      continue;
    }
    if (!state.result) {
      over200++;
      byPolicy[policy].over200++;
      continue;
    }
    if (state.result.winner) {
      decisiveTurns.push(state.turn);
      byPolicy[policy].decisiveWithin200++;
    } else {
      drawsWithin200++;
      byPolicy[policy].draws++;
    }
  }

  console.log("WIN_TURNS_COHORT " + JSON.stringify({
    start: START,
    end: END,
    decisiveTurns,
    decisiveWithin200: decisiveTurns.length,
    over200,
    drawsWithin200,
    technicalCaps,
    byPolicy,
  }));
  assert.equal(technicalCaps, 0);
});
