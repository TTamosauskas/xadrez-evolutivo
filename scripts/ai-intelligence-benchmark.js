import { createPeriodState } from "../src/state.js";
import { transition, mutuallyBlocked } from "../src/engine.js";
import { chooseAction } from "../src/ai.js";
import { legalActions, movesFor } from "../src/moves.js";

const games = Number(process.env.AI_BENCH_GAMES ?? 1),
  turnLimit = Number(process.env.AI_BENCH_TURN_LIMIT ?? 40),
  commandLimit = Number(process.env.AI_BENCH_COMMAND_LIMIT ?? turnLimit * 5),
  stages = (process.env.AI_BENCH_STAGES ?? "silurian,devonian")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  difficulties = (process.env.AI_BENCH_DIFFICULTIES ?? "easy,medium,hard")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

for (const difficulty of difficulties)
  if (!["easy", "medium", "hard"].includes(difficulty))
    throw Error(`Dificuldade inválida: ${difficulty}`);

const mean = (values) => {
    const usable = values.filter(Number.isFinite);
    return usable.length
      ? Number(
          (usable.reduce((sum, value) => sum + value, 0) / usable.length).toFixed(
            3,
          ),
        )
      : null;
  },
  percentile = (values, q) => {
    if (!values.length) return null;
    const ordered = [...values].sort((a, b) => a - b),
      index = Math.floor((ordered.length - 1) * q);
    return ordered[index];
  },
  pct = (value, total) =>
    total ? Number((value / total).toFixed(3)) : 0;

function moveTargetFor(state, action) {
  if (action.type !== "MOVE") return null;
  const piece = state.pieces.find((candidate) => candidate.id === action.id);
  if (!piece) return null;
  return (
    movesFor(state, piece).find(
      (target) => target.r === action.r && target.c === action.c,
    ) ?? null
  );
}

function directCapture(state, action) {
  return !!moveTargetFor(state, action)?.capture;
}

function mechanicFor(state, action) {
  if (action.type !== "MOVE") return action.type;
  const target = moveTargetFor(state, action);
  if (!target) return "MOVE";
  for (const key of [
    "mycorrhiza",
    "cutaneous",
    "vascular",
    "seedCapture",
    "fruitConsume",
    "synzooCollect",
    "haustoriumDrain",
    "botanicalPredation",
    "botanicalCapture",
    "hypermetamorphosis",
    "massRecruitment",
    "cephalization",
    "phoresy",
    "arboreal",
    "bioadhesion",
    "escalation",
    "serpentine",
    "trailExtension",
    "crawler",
    "lateral",
    "jet",
    "jump",
    "webEscape",
  ])
    if (target[key]) return key;
  return target.capture ? "capture" : "MOVE";
}

function run(stage, difficulty, seed) {
  let state = createPeriodState(stage, seed, null, "earth"),
    commands = 0,
    captures = 0,
    captureOpportunityTurns = 0,
    captureChoices = 0,
    decisions = 0;
  const nodes = [],
    roots = [],
    depths = [],
    decisionMs = [],
    mechanics = {};

  while (
    !state.result &&
    state.turn < turnLimit &&
    commands < commandLimit
  ) {
    let action;
    if (state.notices.length)
      action = { type: "ACK_NOTICE", id: state.notices[0].id };
    else if (state.phase === "origin")
      action = { type: "ORIGIN_CLICK" };
    else if (state.phase === "collapse")
      action = { type: "DOMAIN_COLLAPSE" };
    else if (mutuallyBlocked(state))
      action = { type: "RESOLVE_BLOCKED" };
    else {
      const actions = legalActions(state),
        availableCaptures = actions.filter((candidate) =>
          directCapture(state, candidate),
        ),
        stats = {},
        started = performance.now();

      action = chooseAction(state, difficulty, { stats });
      decisionMs.push(performance.now() - started);
      decisions++;
      if (availableCaptures.length) {
        captureOpportunityTurns++;
        if (directCapture(state, action)) captureChoices++;
      }
      if (directCapture(state, action)) captures++;

      const mechanic = mechanicFor(state, action);
      mechanics[mechanic] = (mechanics[mechanic] ?? 0) + 1;
      if (Number.isFinite(stats.nodes)) nodes.push(stats.nodes);
      if (Number.isFinite(stats.rootActions)) roots.push(stats.rootActions);
      if (Number.isFinite(stats.completedDepth))
        depths.push(stats.completedDepth);
    }

    state = transition(state, action);
    commands++;
  }

  return {
    stage,
    difficulty,
    seed,
    finished: !!state.result,
    winner: state.result?.winner ?? null,
    reason: state.result?.reason ?? null,
    turns: state.turn,
    commands,
    decisions,
    captures,
    captureOpportunityTurns,
    captureChoices,
    captureUseRate: pct(captureChoices, captureOpportunityTurns),
    meanNodes: mean(nodes),
    meanRootActions: mean(roots),
    meanCompletedDepth: mean(depths),
    meanDecisionMs: mean(decisionMs),
    p95DecisionMs: percentile(decisionMs, 0.95),
    finalPopulation: state.pieces.length,
    mechanics,
  };
}

function summarize(runs) {
  const finished = runs.filter((run) => run.finished),
    opportunities = runs.reduce(
      (sum, run) => sum + run.captureOpportunityTurns,
      0,
    ),
    choices = runs.reduce((sum, run) => sum + run.captureChoices, 0),
    mechanics = {};
  for (const run of runs)
    for (const [name, count] of Object.entries(run.mechanics))
      mechanics[name] = (mechanics[name] ?? 0) + count;

  return {
    games: runs.length,
    finished: finished.length,
    finishRate: pct(finished.length, runs.length),
    medianFinishedTurns: percentile(
      finished.map((run) => run.turns),
      0.5,
    ),
    meanTurns: mean(runs.map((run) => run.turns)),
    captures: runs.reduce((sum, run) => sum + run.captures, 0),
    captureOpportunityTurns: opportunities,
    captureChoices: choices,
    captureUseRate: pct(choices, opportunities),
    meanNodes: mean(runs.map((run) => run.meanNodes)),
    meanRootActions: mean(runs.map((run) => run.meanRootActions)),
    meanCompletedDepth: mean(runs.map((run) => run.meanCompletedDepth)),
    meanDecisionMs: mean(runs.map((run) => run.meanDecisionMs)),
    p95DecisionMs: percentile(
      runs.flatMap((run) =>
        Number.isFinite(run.p95DecisionMs) ? [run.p95DecisionMs] : [],
      ),
      0.95,
    ),
    finalPopulationMean: mean(runs.map((run) => run.finalPopulation)),
    mechanics,
    reasons: Object.fromEntries(
      [...new Set(runs.map((run) => run.reason ?? "unfinished"))].map(
        (reason) => [
          reason,
          runs.filter((run) => (run.reason ?? "unfinished") === reason).length,
        ],
      ),
    ),
  };
}

const report = {
  gamesPerCell: games,
  turnLimit,
  commandLimit,
  stages,
  difficulties,
  results: [],
};
for (const stage of stages)
  for (const difficulty of difficulties) {
    const runs = [];
    for (let game = 0; game < games; game++)
      runs.push(
        run(
          stage,
          difficulty,
          990000 + stages.indexOf(stage) * 10000 + game,
        ),
      );
    const result = { stage, difficulty, ...summarize(runs), runs };
    report.results.push(result);
    console.log("AI_INTELLIGENCE_CELL " + JSON.stringify(result));
  }

console.log("AI_INTELLIGENCE_REPORT");
console.log(JSON.stringify(report, null, 2));
