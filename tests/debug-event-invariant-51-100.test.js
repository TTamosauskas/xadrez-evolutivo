import test from "node:test";
import { createState, assertState } from "../src/state.js";
import { transition } from "../src/engine.js";
import { chooseAction } from "../src/ai.js";
import { legalActions } from "../src/moves.js";

test("diagnóstico de evento inválido seeds 51–100", { timeout: 360000 }, () => {
  for (let seed = 51; seed <= 100; seed++) {
    let state = createState(seed), random = seed, commands = 0;
    while (!state.result && state.turn < 200 && commands < 4000) {
      let action;
      if (state.notices.length) {
        action = { type: "ACK_NOTICE", id: state.notices[0].id };
      } else {
        const actions = legalActions(state);
        if (seed % 4 === 0) {
          random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
          action = actions[random % actions.length] ?? { type: "PASS" };
        } else {
          action = chooseAction(state, ["easy", "medium", "hard"][seed % 3], {
            budget: 5,
            maxNodes: 30,
          });
        }
      }
      try {
        state = transition(state, action);
        assertState(state);
      } catch (error) {
        console.log("EVENT_INVARIANT_FAILURE " + JSON.stringify({
          seed,
          turn: state.turn,
          commands,
          current: state.current,
          phase: state.phase,
          geologicalStage: state.geologicalStage,
          population: state.pieces.length,
          lastSuccessfulCaptureRound: state.lastSuccessfulCaptureRound,
          action,
          event: state.event,
          message: error?.message ?? String(error),
        }));
        throw error;
      }
      commands++;
    }
  }
});
