import { createState, assertState } from "../src/state.js";
import { transition, mutuallyBlocked } from "../src/engine.js";
import { chooseAction } from "../src/ai.js";
import { legalActions } from "../src/moves.js";
import { GEOLOGICAL_STAGES } from "../src/geology.js";

const stageIds = [
    "archean",
    "proterozoic",
    "cambrian",
    "devonian",
    "carboniferous",
    "cretaceous",
    "quaternary",
  ],
  gamesPerStage = 16,
  cap = 1200;

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[index];
}

function priorHistory(stageIndex) {
  return GEOLOGICAL_STAGES.slice(0, stageIndex).flatMap((stage) => stage.required);
}

function seedRepresentativeBranches(state, stageIndex) {
  if (stageIndex === 0) return;
  const blue = state.pieces.find((piece) => piece.owner === "blue"),
    amber = state.pieces.find((piece) => piece.owner === "amber");
  blue.traits = ["Fotossíntese"];
  amber.traits = ["Predação"];
  if (priorHistory(stageIndex).includes("Locomoção")) amber.traits.push("Locomoção");
}

const results = [];
for (const stageId of stageIds) {
  const stageIndex = GEOLOGICAL_STAGES.findIndex((stage) => stage.id === stageId),
    stage = GEOLOGICAL_STAGES[stageIndex],
    historicalTraits = priorHistory(stageIndex),
    turns = [],
    stepsList = [];
  let capped = 0,
    within80 = 0,
    within120 = 0,
    within200 = 0,
    within600 = 0;

  for (let game = 1; game <= gamesPerStage; game++) {
    const seed = stageIndex * 1000 + game;
    let s = createState(seed, {
        geologicalStage: stageId,
        historicalTraits,
        canonicalPair: true,
      }),
      random = seed,
      steps = 0;
    seedRepresentativeBranches(s, stageIndex);
    assertState(s);

    while (!s.result && steps < cap) {
      if (s.notices.length) {
        s = transition(s, { type: "ACK_NOTICE", id: s.notices[0].id });
        continue;
      }
      let action;
      if (mutuallyBlocked(s)) action = { type: "CONWAY_STEP" };
      else if (game % 4 === 0) {
        const actions = legalActions(s);
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
        action = actions[random % actions.length] ?? { type: "PASS" };
      } else
        action = chooseAction(s, ["easy", "medium", "hard"][game % 3], {
          budget: 5,
          maxNodes: 30,
        });

      s = transition(s, action);
      assertState(s);
      steps++;
    }

    if (!s.result) {
      capped++;
      continue;
    }
    turns.push(s.turn);
    stepsList.push(steps);
    if (s.turn <= 80) within80++;
    if (s.turn <= 120) within120++;
    if (s.turn <= 200) within200++;
    if (s.turn <= 600) within600++;
  }

  results.push({
    id: stage.id,
    period: `${stage.group} · ${stage.period}`,
    games: gamesPerStage,
    finished: turns.length,
    cappedAt1200Actions: capped,
    within80Turns: within80,
    within120Turns: within120,
    within200Turns: within200,
    within600Turns: within600,
    minTurns: turns.length ? Math.min(...turns) : null,
    p25Turns: percentile(turns, 0.25),
    medianTurns: percentile(turns, 0.5),
    p75Turns: percentile(turns, 0.75),
    maxTurns: turns.length ? Math.max(...turns) : null,
    meanTurns: turns.length
      ? Math.round(turns.reduce((sum, value) => sum + value, 0) / turns.length)
      : null,
    meanActions: stepsList.length
      ? Math.round(stepsList.reduce((sum, value) => sum + value, 0) / stepsList.length)
      : null,
  });
  console.log(JSON.stringify(results.at(-1)));
}
console.log("PERIOD_BENCHMARK");
console.log(JSON.stringify(results, null, 2));
