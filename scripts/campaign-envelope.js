import assert from "node:assert/strict";
import { GEOLOGICAL_STAGES } from "../src/geology.js";
import {
  activateOrigin,
  assertState,
  clone,
  createPeriodState,
  createState,
  round,
} from "../src/state.js";
import { transition, mutuallyBlocked } from "../src/engine.js";
import { chooseAction } from "../src/ai.js";
import { legalActions } from "../src/moves.js";
import { distance, square } from "../src/constants.js";

const gamesPerCase = Number(process.env.CAMPAIGN_GAMES ?? 8),
  goalTurns = Number(process.env.GOAL_TURNS ?? 200),
  turnLimit = Number(process.env.TURN_LIMIT ?? 300),
  commandLimit = Number(process.env.COMMAND_LIMIT ?? turnLimit * 4),
  tailRounds = Number(process.env.DIAGNOSTIC_TAIL ?? 100);

function mean(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length
    ? Number((usable.reduce((a, b) => a + b, 0) / usable.length).toFixed(2))
    : null;
}

function median(values) {
  const usable = values.filter(Number.isFinite).sort((a, b) => a - b);
  return usable.length ? usable[Math.floor((usable.length - 1) / 2)] : null;
}

function pct(value, total) {
  return total ? Number((value / total).toFixed(3)) : 0;
}

function policyFor(seed) {
  return seed % 4 === 0
    ? "random"
    : ["easy", "medium", "hard"][seed % 3];
}

function archeanCycleTwo(seed) {
  return createState(seed, {
    scenario: "earth",
    geologicalStage: "archean",
    cycle: 2,
    totalCycles: 2,
    historicalTraits: ["Fotossíntese", "Predação"],
    canonicalPair: true,
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
  });
}

function initialState(stage, cycle, seed) {
  if (stage.id === "archean" && cycle === 2) return archeanCycleTwo(seed);
  const state = createPeriodState(stage.id, seed);
  if (state.phase === "origin") {
    activateOrigin(state);
    activateOrigin(state);
  }
  return state;
}

function actionsForOwner(state, owner) {
  if (state.phase !== "move") return [];
  const current = state.current;
  state.current = owner;
  const actions = legalActions(state);
  state.current = current;
  return actions;
}

function isCaptureAction(state, action) {
  if (action.type !== "MOVE") return false;
  const actor = state.pieces.find((piece) => piece.id === action.id);
  if (!actor) return false;
  return state.pieces.some(
    (piece) =>
      piece.id !== actor.id &&
      piece.owner !== actor.owner &&
      piece.r === action.r &&
      piece.c === action.c,
  );
}

function minEnemyDistance(state) {
  const blue = state.pieces.filter((piece) => piece.owner === "blue"),
    amber = state.pieces.filter((piece) => piece.owner === "amber");
  if (!blue.length || !amber.length) return null;
  return Math.min(...blue.flatMap((a) => amber.map((b) => distance(a, b))));
}

function snapshot(state) {
  const blueActions = actionsForOwner(state, "blue"),
    amberActions = actionsForOwner(state, "amber"),
    occupied = new Set([
      ...state.pieces.map((piece) => square(piece.r, piece.c)),
      ...state.eggs.map((egg) => square(egg.r, egg.c)),
      ...state.plantSeeds.map((seed) => square(seed.r, seed.c)),
    ]),
    fertile = state.board.filter((cell) => cell === "fertile").length,
    freeFertile = state.board.reduce(
      (count, cell, index) =>
        count + (cell === "fertile" && !occupied.has(index) ? 1 : 0),
      0,
    ),
    blue = state.pieces.filter((piece) => piece.owner === "blue").length,
    amber = state.pieces.filter((piece) => piece.owner === "amber").length;
  return {
    round: round(state),
    population: blue + amber,
    gap: Math.abs(blue - amber),
    fertile,
    freeFertile,
    hostile: state.board.filter((cell) => cell === "hostile").length,
    minDistance: minEnemyDistance(state),
    legalActions: blueActions.length + amberActions.length,
    captureOptions:
      blueActions.filter((action) => isCaptureAction(state, action)).length +
      amberActions.filter((action) => isCaptureAction(state, action)).length,
  };
}

function summarizeSamples(samples) {
  return {
    population: mean(samples.map((x) => x.population)),
    gap: mean(samples.map((x) => x.gap)),
    fertile: mean(samples.map((x) => x.fertile)),
    freeFertile: mean(samples.map((x) => x.freeFertile)),
    hostile: mean(samples.map((x) => x.hostile)),
    minDistance: mean(samples.map((x) => x.minDistance)),
    legalActions: mean(samples.map((x) => x.legalActions)),
    captureOptions: mean(samples.map((x) => x.captureOptions)),
    captureOpportunityRate: pct(
      samples.filter((x) => x.captureOptions > 0).length,
      samples.length,
    ),
    population24PlusRate: pct(
      samples.filter((x) => x.population >= 24).length,
      samples.length,
    ),
  };
}

function classify(run) {
  const tail = run.tail;
  if (run.conwaySteps > run.commands * 0.2) return "conway_lock";
  if (
    tail.captureOpportunityRate >= 0.25 &&
    run.captureAttempts < Math.max(3, run.commands * 0.015)
  )
    return "capture_avoidance";
  if (
    run.births >= 10 &&
    run.deaths >= 10 &&
    Math.abs(run.births - run.deaths) <= Math.max(4, run.births * 0.25)
  )
    return "replacement_equilibrium";
  if (
    tail.population >= 24 &&
    tail.captureOpportunityRate < 0.1 &&
    (tail.minDistance ?? 0) >= 3
  )
    return "high_population_low_contact";
  if (
    tail.population >= 16 &&
    tail.captureOpportunityRate < 0.1 &&
    (tail.minDistance ?? 0) >= 3
  )
    return "low_contact";
  if (tail.population24PlusRate >= 0.5 && tail.freeFertile <= 6)
    return "resource_pressure_plateau";
  return "mixed";
}

function runGame(initial, seed) {
  let state = clone(initial),
    pseudo = seed ^ 0x9e3779b9,
    commands = 0,
    births = 0,
    deaths = 0,
    captureAttempts = 0,
    successfulCaptures = 0,
    nonCaptureWithCaptureAvailable = 0,
    conwaySteps = 0,
    passes = 0,
    fertilityDepleted = 0,
    naturalDeaths = 0,
    severeEvents = 0,
    pathogenOutbreaks = 0,
    lastSampleRound = -1;
  const samples = [],
    policy = policyFor(seed);

  function collect() {
    const now = round(state);
    if (state.phase === "move" && now !== lastSampleRound) {
      samples.push(snapshot(state));
      lastSampleRound = now;
    }
  }
  collect();

  while (!state.result && state.turn < turnLimit && commands < commandLimit) {
    if (state.notices.length) {
      state = transition(state, {
        type: "ACK_NOTICE",
        id: state.notices[0].id,
      });
      continue;
    }

    const availableCaptures = actionsForOwner(state, state.current).filter(
      (action) => isCaptureAction(state, action),
    );
    let action;
    if (mutuallyBlocked(state)) {
      action = { type: "CONWAY_STEP" };
      conwaySteps++;
    } else if (policy === "random") {
      const actions = legalActions(state);
      pseudo = (Math.imul(pseudo, 1664525) + 1013904223) >>> 0;
      action = actions[pseudo % actions.length] ?? { type: "PASS" };
    } else {
      action = chooseAction(state, policy, {
        now: () => 0,
        budget: 5,
        maxNodes: 12,
      });
    }

    const captureAttempt = isCaptureAction(state, action),
      victim = captureAttempt
        ? state.pieces.find(
            (piece) =>
              piece.owner !== state.current &&
              piece.r === action.r &&
              piece.c === action.c,
          )
        : null,
      beforeIds = new Set(state.pieces.map((piece) => piece.id)),
      beforeLogLength = state.logs.length;

    if (captureAttempt) captureAttempts++;
    else if (availableCaptures.length) nonCaptureWithCaptureAvailable++;
    if (action.type === "PASS") passes++;

    const next = transition(state, action);
    assert.notEqual(next, state);
    assertState(next);

    const afterIds = new Set(next.pieces.map((piece) => piece.id));
    for (const id of afterIds) if (!beforeIds.has(id)) births++;
    for (const id of beforeIds) if (!afterIds.has(id)) deaths++;
    if (victim && !afterIds.has(victim.id)) successfulCaptures++;

    for (const entry of next.logs.slice(0, next.logs.length - beforeLogLength)) {
      if (entry.text.includes("Superpopulação esgotou")) {
        const match = entry.text.match(/Superpopulação esgotou (\d+) casa/);
        if (match) fertilityDepleted += Number(match[1]);
      }
      if (entry.text.includes("morte natural")) naturalDeaths++;
      if (entry.text.includes("desencadearam um evento severo")) severeEvents++;
      if (entry.text.includes("Pressão demográfica: diferença"))
        pathogenOutbreaks++;
    }

    state = next;
    commands++;
    collect();
  }

  const finalRound = round(state),
    tailStart = Math.max(0, finalRound - tailRounds),
    tail = summarizeSamples(samples.filter((sample) => sample.round >= tailStart)),
    run = {
      seed,
      policy,
      finished: !!state.result,
      turns: state.turn,
      rounds: finalRound,
      stalled: !state.result && state.turn >= turnLimit,
      technicalCapped: !state.result && commands >= commandLimit,
      commands,
      births,
      deaths,
      captureAttempts,
      successfulCaptures,
      nonCaptureWithCaptureAvailable,
      conwaySteps,
      passes,
      fertilityDepleted,
      naturalDeaths,
      severeEvents,
      pathogenOutbreaks,
      tail,
    };
  run.reason = run.finished ? "decisive" : classify(run);
  return run;
}

function aggregate(runs) {
  const withinGoal = runs.filter((run) => run.finished && run.turns <= goalTurns),
    withinTolerance = runs.filter(
      (run) => run.finished && run.turns > goalTurns && run.turns <= turnLimit,
    ),
    stalled = runs.filter((run) => run.stalled),
    technical = runs.filter((run) => run.technicalCapped),
    finished = runs.filter((run) => run.finished),
    loops = {};
  for (const run of runs.filter((run) => !run.finished))
    loops[run.reason] = (loops[run.reason] ?? 0) + 1;

  const status =
    withinGoal.length === runs.length
      ? "goal"
      : stalled.length === 0 && technical.length === 0
        ? "tolerance"
        : "fail";

  return {
    games: runs.length,
    status,
    within200: withinGoal.length,
    between201And300: withinTolerance.length,
    finished: finished.length,
    stalled300: stalled.length,
    technicalCapped: technical.length,
    rateWithin200: pct(withinGoal.length, runs.length),
    finishRate: pct(finished.length, runs.length),
    turnsFinished: {
      median: median(finished.map((run) => run.turns)),
      mean: mean(finished.map((run) => run.turns)),
      max: finished.length ? Math.max(...finished.map((run) => run.turns)) : null,
    },
    loops,
    stalledSignals: {
      birthsPerGame: mean(stalled.map((run) => run.births)),
      deathsPerGame: mean(stalled.map((run) => run.deaths)),
      capturesPerGame: mean(stalled.map((run) => run.successfulCaptures)),
      conwayPerGame: mean(stalled.map((run) => run.conwaySteps)),
      passesPerGame: mean(stalled.map((run) => run.passes)),
      nonCaptureWithCaptureAvailablePerGame: mean(
        stalled.map((run) => run.nonCaptureWithCaptureAvailable),
      ),
      fertilityDepletedPerGame: mean(stalled.map((run) => run.fertilityDepleted)),
      naturalDeathsPerGame: mean(stalled.map((run) => run.naturalDeaths)),
      severeEventsPerGame: mean(stalled.map((run) => run.severeEvents)),
      pathogenOutbreaksPerGame: mean(stalled.map((run) => run.pathogenOutbreaks)),
      tailPopulation: mean(stalled.map((run) => run.tail.population)),
      tailGap: mean(stalled.map((run) => run.tail.gap)),
      tailFreeFertile: mean(stalled.map((run) => run.tail.freeFertile)),
      tailMinDistance: mean(stalled.map((run) => run.tail.minDistance)),
      tailCaptureOptions: mean(stalled.map((run) => run.tail.captureOptions)),
      tailCaptureOpportunityRate: mean(
        stalled.map((run) => run.tail.captureOpportunityRate),
      ),
      tailPopulation24PlusRate: mean(
        stalled.map((run) => run.tail.population24PlusRate),
      ),
    },
  };
}

const cases = GEOLOGICAL_STAGES.flatMap((stage) => {
  const cycles = stage.cycles?.length ?? 1;
  return Array.from({ length: cycles }, (_, index) => ({
    stage,
    cycle: index + 1,
  }));
});

const report = {
  gamesPerCase,
  goalTurns,
  turnLimit,
  cases: [],
};

for (const { stage, cycle } of cases) {
  const runs = [];
  for (let game = 1; game <= gamesPerCase; game++) {
    const seed = (stage.index + 1) * 100000 + cycle * 1000 + game,
      initial = initialState(stage, cycle, seed);
    assertState(initial);
    runs.push(runGame(initial, seed));
  }
  const row = {
    id: stage.id,
    period: stage.period,
    group: stage.group,
    cycle,
    ...aggregate(runs),
  };
  report.cases.push(row);
  console.log("CAMPAIGN_CASE " + JSON.stringify(row));
}

console.log("CAMPAIGN_ENVELOPE_REPORT");
console.log(JSON.stringify(report, null, 2));

const failed = report.cases.filter((row) => row.status === "fail").length;
if (failed) {
  console.error(
    `Campaign envelope: ${failed} case(s) reached the ${turnLimit}-turn cap.`,
  );
  process.exitCode = 1;
}
