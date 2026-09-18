import assert from "node:assert/strict";
import { createState, assertState } from "../src/state.js";
import { transition } from "../src/engine.js";
import { chooseAction } from "../src/ai.js";
import { legalActions } from "../src/moves.js";
const count = Number(process.env.GAMES ?? 200),
  limit = 600;
const report = {
  games: count,
  finished: 0,
  capped: 0,
  actions: 0,
  notices: 0,
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
  while (!s.result && steps < limit) {
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
    report.maxPopulation = Math.max(report.maxPopulation, s.pieces.length);
    if (s.event)
      report.events[s.event.id] = (report.events[s.event.id] ?? 0) + 1;
    for (const d of s.diseases) seenDiseases.add(d.id);
  }
  report.diseases += seenDiseases.size;
  s.result ? report.finished++ : report.capped++;
  if (seed % 25 === 0) console.log(`Completed ${seed}/${count} games`);
}
report.elapsedSeconds = (performance.now() - started) / 1000;
console.log(JSON.stringify(report, null, 2));
