import assert from "node:assert/strict";
import {
  createPeriodState,
  createState,
  clone,
  assertState,
} from "../src/state.js";
import { transition, mutuallyBlocked } from "../src/engine.js";
import { chooseAction } from "../src/ai.js";
import { legalActions } from "../src/moves.js";

const GAMES = Number(process.env.AQUATIC_GAMES ?? 8);
const GOAL = Number(process.env.GOAL_TURNS ?? 200);
const LIMIT = Number(process.env.AQUATIC_TURN_LIMIT ?? 330);
const COMMAND_LIMIT = LIMIT * 6;

const CASES = [
  { stage: "archean", cycle: 2, compareLegacy: true },
  { stage: "proterozoic", cycle: 1, compareLegacy: true },
  { stage: "ediacaran", cycle: 1, compareLegacy: true },
  { stage: "cambrian", cycle: 1, compareLegacy: false },
  { stage: "ordovician", cycle: 1, compareLegacy: false },
];

function archeanCycle2(seed) {
  return createState(seed, {
    scenario: "earth",
    geologicalStage: "archean",
    cycle: 2,
    totalCycles: 2,
    historicalTraits: ["Fotossíntese", "Predação"],
    founders: {
      primary: {
        rank: 4,
        traits: ["Fotossíntese"],
        ancestry: ["Fotossíntese"],
      },
      companion: {
        rank: 4,
        traits: ["Predação"],
        ancestry: ["Predação"],
      },
    },
    canonicalPair: true,
  });
}

function initialState(stage, cycle, seed) {
  return stage === "archean" && cycle === 2
    ? archeanCycle2(seed)
    : createPeriodState(stage, seed, null, "earth");
}

function moveToLegacyEdges(state) {
  const targets = [
    ["blue", 7, 3],
    ["blue", 7, 4],
    ["amber", 0, 3],
    ["amber", 0, 4],
  ];
  assert.equal(state.pieces.length, 4);
  for (let i = 0; i < targets.length; i++) {
    assert.equal(state.pieces[i].owner, targets[i][0]);
    state.pieces[i].r = targets[i][1];
    state.pieces[i].c = targets[i][2];
  }
  return state;
}

function policyFor(seed) {
  return seed % 4 === 0
    ? "random"
    : ["easy", "medium", "hard"][seed % 3];
}

function run(initial, seed) {
  let state = clone(initial),
    pseudo = seed ^ 0x9e3779b9,
    commands = 0;
  while (!state.result && state.turn < LIMIT && commands < COMMAND_LIMIT) {
    let action;
    if (state.notices.length)
      action = { type: "ACK_NOTICE", id: state.notices[0].id };
    else if (state.phase === "origin")
      action = { type: "ORIGIN_CLICK" };
    else if (state.phase === "collapse")
      action = { type: "DOMAIN_COLLAPSE" };
    else if (mutuallyBlocked(state))
      action = { type: "CONWAY_STEP" };
    else {
      const actions = legalActions(state);
      if (policyFor(seed) === "random") {
        pseudo = (Math.imul(pseudo, 1664525) + 1013904223) >>> 0;
        action = actions[pseudo % actions.length] ?? { type: "PASS" };
      } else
        action = chooseAction(state, policyFor(seed), {
          now: () => 0,
          budget: 5,
          maxNodes: 12,
        });
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
    reason: state.result?.reason ?? null,
  };
}

function median(values) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor((ordered.length - 1) / 2)];
}

function mean(values) {
  return values.length
    ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
    : null;
}

function summarize(results) {
  const finished = results.filter((result) => result.finished);
  return {
    games: results.length,
    within200: results.filter((result) => result.within200).length,
    finished330: finished.length,
    stalled330: results.filter((result) => result.stalled).length,
    technical: results.filter((result) => result.technical).length,
    domainWins: finished.filter((result) =>
      /Domínio Ecológico/.test(result.reason ?? ""),
    ).length,
    medianFinishedTurn: median(finished.map((result) => result.turns)),
    meanFinishedTurn: mean(finished.map((result) => result.turns)),
  };
}

let technicalFailures = 0;
for (const entry of CASES) {
  const current = [],
    legacy = [];
  for (let game = 0; game < GAMES; game++) {
    const seed = 970000 + entry.cycle * 10000 + CASES.indexOf(entry) * 1000 + game;
    const base = initialState(entry.stage, entry.cycle, seed);
    current.push(run(base, seed));
    if (entry.compareLegacy)
      legacy.push(run(moveToLegacyEdges(clone(base)), seed));
  }
  const row = {
    stage: entry.stage,
    cycle: entry.cycle,
    current: summarize(current),
    legacy: entry.compareLegacy ? summarize(legacy) : null,
  };
  technicalFailures += row.current.technical + (row.legacy?.technical ?? 0);
  console.log("AQUATIC_FOUNDER_REPORT " + JSON.stringify(row));
}

if (technicalFailures)
  throw Error(
    `Aquatic founder benchmark had ${technicalFailures} technical failure(s).`,
  );
