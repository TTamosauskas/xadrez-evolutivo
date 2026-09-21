import assert from "node:assert/strict";
import { createPeriodState, clone, assertState } from "../src/state.js";
import { transition, mutuallyBlocked } from "../src/engine.js";
import { chooseAction } from "../src/ai.js";
import { legalActions } from "../src/moves.js";

const GAMES = Number(process.env.LAND_TRANSITION_GAMES ?? 12);
const GOAL = Number(process.env.GOAL_TURNS ?? 200);
const LIMIT = Number(process.env.LAND_TRANSITION_TURN_LIMIT ?? 330);
const COMMAND_LIMIT = LIMIT * 6;
const STAGES = ["silurian", "devonian"];

function run(initial, seed) {
  let state = clone(initial),
    pseudo = seed ^ 0x9e3779b9,
    commands = 0;
  while (!state.result && state.turn < LIMIT && commands < COMMAND_LIMIT) {
    let action;
    if (state.notices.length)
      action = { type: "ACK_NOTICE", id: state.notices[0].id };
    else if (state.phase === "collapse")
      action = { type: "DOMAIN_COLLAPSE" };
    else if (mutuallyBlocked(state))
      action = { type: "CONWAY_STEP" };
    else {
      const actions = legalActions(state);
      if (seed % 4 === 0) {
        pseudo = (Math.imul(pseudo, 1664525) + 1013904223) >>> 0;
        action = actions[pseudo % actions.length] ?? { type: "PASS" };
      } else
        action = chooseAction(
          state,
          ["easy", "medium", "hard"][seed % 3],
          { now: () => 0, budget: 5, maxNodes: 12 },
        );
    }
    const next = transition(state, action);
    assert.notEqual(next, state);
    assertState(next);
    state = next;
    commands++;
  }
  return {
    finished: !!state.result,
    within200: !!state.result && state.turn <= GOAL,
    stalled: !state.result && state.turn >= LIMIT,
    technical: !state.result && commands >= COMMAND_LIMIT,
    turns: state.turn,
    domainWin: /Domínio Ecológico/.test(state.result?.reason ?? ""),
  };
}

function mean(values) {
  return values.length
    ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
    : null;
}

function summarize(runs) {
  const finished = runs.filter((run) => run.finished);
  return {
    games: runs.length,
    within200: runs.filter((run) => run.within200).length,
    finished330: finished.length,
    stalled330: runs.filter((run) => run.stalled).length,
    technical: runs.filter((run) => run.technical).length,
    domainWins: finished.filter((run) => run.domainWin).length,
    meanFinishedTurn: mean(finished.map((run) => run.turns)),
    maxFinishedTurn: finished.length
      ? Math.max(...finished.map((run) => run.turns))
      : null,
  };
}

let technicalFailures = 0;
for (const stage of STAGES) {
  const withBarriers = [],
    withoutBarriers = [];
  for (let game = 1; game <= GAMES; game++) {
    const seed = 980000 + STAGES.indexOf(stage) * 10000 + game,
      base = createPeriodState(stage, seed, null, "earth"),
      open = clone(base);
    open.naturalBarriers = [];
    withBarriers.push(run(base, seed));
    withoutBarriers.push(run(open, seed));
  }
  const row = {
    stage,
    withBarriers: summarize(withBarriers),
    withoutBarriers: summarize(withoutBarriers),
  };
  technicalFailures +=
    row.withBarriers.technical + row.withoutBarriers.technical;
  console.log("LAND_TRANSITION_REPORT " + JSON.stringify(row));
}

if (technicalFailures)
  throw Error(
    `Land transition benchmark had ${technicalFailures} technical failure(s).`,
  );
