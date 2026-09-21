import assert from "node:assert/strict";
import { createState, assertState } from "../src/state.js";
import { transition } from "../src/engine.js";
import { chooseAction } from "../src/ai.js";
import { legalActions } from "../src/moves.js";

const count = Number(process.env.GAMES ?? 200),
  goalTurns = Number(process.env.GOAL_TURNS ?? 200),
  turnLimit = Number(process.env.TURN_LIMIT ?? 300),
  commandLimit = Number(process.env.COMMAND_LIMIT ?? turnLimit * 4);

const report = {
  games: count,
  goalTurns,
  turnLimit,
  commandLimit,
  finished: 0,
  finishedWithinGoal: 0,
  stalled: 0,
  commandCapped: 0,
  actions: 0,
  notices: 0,
  maxTurns: 0,
  maxActionMs: 0,
  maxPopulation: 0,
  events: {},
  diseases: 0,
};

const started = performance.now();
for (let seed = 1; seed <= count; seed++) {
  let s = createState(seed),
    random = seed,
    steps = 0;
  const seenDiseases = new Set();

  while (
    !s.result &&
    s.turn < turnLimit &&
    steps < commandLimit
  ) {
    if (s.notices.length) {
      s = transition(s, { type: "ACK_NOTICE", id: s.notices[0].id });
      report.notices++;
      continue;
    }

    const actions = legalActions(s);
    let action;
    if (seed % 4 === 0) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      action = actions[random % actions.length] ?? { type: "PASS" };
    } else
      action = chooseAction(s, ["easy", "medium", "hard"][seed % 3], {
        budget: 5,
        maxNodes: 30,
      });

    const t = performance.now(),
      next = transition(s, action);
    report.maxActionMs = Math.max(report.maxActionMs, performance.now() - t);
    assert.notEqual(next, s);
    assertState(next);
    s = next;
    steps++;
    report.actions++;
    report.maxTurns = Math.max(report.maxTurns, s.turn);
    report.maxPopulation = Math.max(report.maxPopulation, s.pieces.length);
    if (s.event)
      report.events[s.event.id] = (report.events[s.event.id] ?? 0) + 1;
    for (const d of s.diseases) seenDiseases.add(d.id);
  }

  report.diseases += seenDiseases.size;
  if (s.result) {
    report.finished++;
    if (s.turn <= goalTurns) report.finishedWithinGoal++;
  } else if (s.turn >= turnLimit) {
    report.stalled++;
  } else {
    report.commandCapped++;
  }

  if (seed % 25 === 0) console.log(`Completed ${seed}/${count} games`);
}

report.elapsedSeconds = (performance.now() - started) / 1000;
console.log(JSON.stringify(report, null, 2));

if (report.stalled || report.commandCapped) {
  console.error(
    `Simulation envelope failed: ${report.stalled} game(s) reached ${turnLimit} turns and ${report.commandCapped} hit the technical command cap.`,
  );
  process.exitCode = 1;
}
