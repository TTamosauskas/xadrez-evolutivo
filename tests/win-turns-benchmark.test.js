import test from "node:test";
import assert from "node:assert/strict";
import { createState, assertState } from "../src/state.js";
import { transition } from "../src/engine.js";
import { chooseAction } from "../src/ai.js";
import { legalActions } from "../src/moves.js";

const GAMES = 50;
const TURN_LIMIT = 200;
const COMMAND_LIMIT = 4000;

function stats(values) {
  if (!values.length)
    return { count: 0, mean: null, median: null, mode: null, modes: [] };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const median =
    sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const frequencies = new Map();
  for (const value of values)
    frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
  const maxFrequency = Math.max(...frequencies.values());
  const modes = [...frequencies.entries()]
    .filter(([, count]) => count === maxFrequency)
    .map(([value]) => value)
    .sort((a, b) => a - b);
  return {
    count: values.length,
    mean: Number(mean.toFixed(2)),
    median,
    mode: modes.length === 1 ? modes[0] : null,
    modes,
    modeFrequency: maxFrequency,
    min: sorted[0],
    max: sorted.at(-1),
  };
}

test("benchmark de turnos até vitória com corte em 200", { timeout: 120000 }, () => {
  const decisiveTurns = [];
  let over200 = 0,
    drawsWithin200 = 0,
    technicalCaps = 0,
    blueWins = 0,
    amberWins = 0;

  for (let seed = 1; seed <= GAMES; seed++) {
    let state = createState(seed),
      random = seed,
      commands = 0;

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
      continue;
    }

    if (state.result.winner) {
      decisiveTurns.push(state.turn);
      if (state.result.winner === "blue") blueWins++;
      if (state.result.winner === "amber") amberWins++;
    } else {
      drawsWithin200++;
    }
  }

  const report = {
    games: GAMES,
    turnLimit: TURN_LIMIT,
    decisiveWithin200: decisiveTurns.length,
    drawsWithin200,
    over200,
    technicalCaps,
    blueWins,
    amberWins,
    decisiveTurnStats: stats(decisiveTurns),
  };

  console.log("WIN_TURNS_BENCHMARK " + JSON.stringify(report));
  assert.equal(technicalCaps, 0);
});
