import assert from "node:assert/strict";
import { createState, assertState } from "../src/state.js";
import { transition, mutuallyBlocked } from "../src/engine.js";
import { chooseAction } from "../src/ai.js";
import { legalActions } from "../src/moves.js";
import { distance } from "../src/constants.js";

const count = Number(process.env.GAMES ?? 200),
  goalTurns = Number(process.env.GOAL_TURNS ?? 200),
  turnLimit = Number(process.env.TURN_LIMIT ?? 300),
  commandLimit = Number(process.env.COMMAND_LIMIT ?? turnLimit * 4);

function mean(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length
    ? Number((usable.reduce((sum, value) => sum + value, 0) / usable.length).toFixed(2))
    : null;
}

function minEnemyDistance(state) {
  const blue = state.pieces.filter((piece) => piece.owner === "blue"),
    amber = state.pieces.filter((piece) => piece.owner === "amber");
  if (!blue.length || !amber.length) return null;
  return Math.min(...blue.flatMap((a) => amber.map((b) => distance(a, b))));
}

function isCaptureAction(state, action) {
  if (action.type !== "MOVE") return false;
  const actor = state.pieces.find((piece) => piece.id === action.id);
  if (!actor) return false;
  return state.pieces.some(
    (piece) =>
      piece.owner !== actor.owner &&
      piece.r === action.r &&
      piece.c === action.c,
  );
}

function actionsForOwner(state, owner) {
  if (state.phase !== "move") return [];
  const current = state.current;
  state.current = owner;
  const actions = legalActions(state);
  state.current = current;
  return actions;
}

function captureOptions(state) {
  return ["blue", "amber"].reduce(
    (count, owner) =>
      count +
      actionsForOwner(state, owner).filter((action) =>
        isCaptureAction(state, action),
      ).length,
    0,
  );
}

function branchCounts(state) {
  const result = {};
  for (const owner of ["blue", "amber"]) {
    const pieces = state.pieces.filter((piece) => piece.owner === owner);
    result[owner] = {
      population: pieces.length,
      photosynthetic: pieces.filter((piece) =>
        piece.traits.includes("Fotossíntese"),
      ).length,
      predatory: pieces.filter((piece) =>
        piece.traits.includes("Predação"),
      ).length,
      basal: pieces.filter(
        (piece) =>
          !piece.traits.includes("Fotossíntese") &&
          !piece.traits.includes("Predação"),
      ).length,
    };
  }
  return result;
}

function summarizeTail(samples) {
  return {
    samples: samples.length,
    population: mean(samples.map((sample) => sample.population)),
    distance: mean(samples.map((sample) => sample.distance)),
    captureOptions: mean(samples.map((sample) => sample.captureOptions)),
    captureOpportunityRate: samples.length
      ? Number(
          (
            samples.filter((sample) => sample.captureOptions > 0).length /
            samples.length
          ).toFixed(3),
        )
      : 0,
  };
}

function classify(run) {
  if (!Number.isFinite(run.discoveryTurns.Predação))
    return "predation_not_discovered";
  if (run.firstContactTurn === null)
    return "fronts_never_contact";
  if (
    run.tail.captureOpportunityRate >= 0.25 &&
    run.captureAttempts < 3
  )
    return "capture_avoidance";
  if (
    run.births >= 10 &&
    run.deaths >= 10 &&
    Math.abs(run.births - run.deaths) <= Math.max(5, run.births * 0.2)
  )
    return "replacement_equilibrium";
  if ((run.tail.distance ?? 0) >= 2 && run.tail.captureOpportunityRate < 0.1)
    return "low_contact_after_expansion";
  return "mixed";
}

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

const runs = [],
  started = performance.now();
for (let seed = 1; seed <= count; seed++) {
  let s = createState(seed),
    random = seed,
    steps = 0,
    births = 0,
    deaths = 0,
    captureAttempts = 0,
    successfulCaptures = 0,
    firstCaptureTurn = null,
    firstContactTurn = null,
    minDistanceEver = minEnemyDistance(s),
    lastTailTurn = -1;
  const seenDiseases = new Set(),
    initialHistory = new Set(s.historicalTraits),
    discoveryTurns = {},
    tailSamples = [];

  for (const trait of initialHistory) discoveryTurns[trait] = 0;

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
    if (mutuallyBlocked(s)) {
      action = { type: "CONWAY_STEP" };
    } else if (seed % 4 === 0) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      action = actions[random % actions.length] ?? { type: "PASS" };
    } else
      action = chooseAction(s, ["easy", "medium", "hard"][seed % 3], {
        budget: 5,
        maxNodes: 30,
      });

    const captureAttempt = isCaptureAction(s, action),
      victim = captureAttempt
        ? s.pieces.find(
            (piece) =>
              piece.r === action.r &&
              piece.c === action.c &&
              piece.owner !== s.current,
          )
        : null,
      beforeIds = new Set(s.pieces.map((piece) => piece.id)),
      beforeHistory = new Set(s.historicalTraits),
      t = performance.now(),
      next = transition(s, action);
    report.maxActionMs = Math.max(report.maxActionMs, performance.now() - t);
    assert.notEqual(next, s);
    assertState(next);

    const afterIds = new Set(next.pieces.map((piece) => piece.id));
    for (const id of afterIds) if (!beforeIds.has(id)) births++;
    for (const id of beforeIds) if (!afterIds.has(id)) deaths++;
    if (captureAttempt) captureAttempts++;
    if (victim && !afterIds.has(victim.id)) {
      successfulCaptures++;
      if (firstCaptureTurn === null) firstCaptureTurn = next.turn;
    }
    for (const trait of next.historicalTraits)
      if (!beforeHistory.has(trait) && discoveryTurns[trait] === undefined)
        discoveryTurns[trait] = next.turn;

    s = next;
    steps++;
    report.actions++;
    report.maxTurns = Math.max(report.maxTurns, s.turn);
    report.maxPopulation = Math.max(report.maxPopulation, s.pieces.length);
    if (s.event)
      report.events[s.event.id] = (report.events[s.event.id] ?? 0) + 1;
    for (const d of s.diseases) seenDiseases.add(d.id);

    const currentDistance = minEnemyDistance(s);
    if (Number.isFinite(currentDistance)) {
      minDistanceEver = Number.isFinite(minDistanceEver)
        ? Math.min(minDistanceEver, currentDistance)
        : currentDistance;
      if (currentDistance <= 1 && firstContactTurn === null)
        firstContactTurn = s.turn;
    }

    if (s.turn >= 200 && s.turn !== lastTailTurn && s.phase === "move") {
      tailSamples.push({
        turn: s.turn,
        population: s.pieces.length,
        distance: currentDistance,
        captureOptions: captureOptions(s),
      });
      lastTailTurn = s.turn;
    }
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

  const run = {
    seed,
    policy: seed % 4 === 0 ? "random" : ["easy", "medium", "hard"][seed % 3],
    finished: !!s.result,
    turns: s.turn,
    cycle: s.cycle,
    stage: s.geologicalStage,
    births,
    deaths,
    captureAttempts,
    successfulCaptures,
    firstCaptureTurn,
    firstContactTurn,
    minDistanceEver,
    finalDistance: minEnemyDistance(s),
    finalPopulation: s.pieces.length,
    reproductions: { ...s.reproductions },
    discoveryTurns: {
      Fotossíntese: discoveryTurns["Fotossíntese"] ?? null,
      Predação: discoveryTurns["Predação"] ?? null,
      Dormência: discoveryTurns["Dormência"] ?? null,
    },
    historicalTraits: [...s.historicalTraits],
    branches: branchCounts(s),
    fertileCells: s.board.filter((cell) => cell === "fertile").length,
    tail: summarizeTail(tailSamples),
  };
  run.classification = run.finished ? "decisive" : classify(run);
  runs.push(run);

  if (seed % 25 === 0) console.log(`Completed ${seed}/${count} games`);
}

const stalledRuns = runs.filter((run) => !run.finished),
  classifications = {};
for (const run of stalledRuns)
  classifications[run.classification] =
    (classifications[run.classification] ?? 0) + 1;

report.archeanDiagnostics = {
  stage: "archean",
  cycle: 1,
  stalledGames: stalledRuns.length,
  discovery: {
    photosynthesisMeanTurn: mean(
      runs.map((run) => run.discoveryTurns.Fotossíntese),
    ),
    predationMeanTurn: mean(
      runs.map((run) => run.discoveryTurns.Predação),
    ),
    dormancyMeanTurn: mean(
      runs.map((run) => run.discoveryTurns.Dormência),
    ),
    photosynthesisMissing: runs.filter(
      (run) => run.discoveryTurns.Fotossíntese === null,
    ).length,
    predationMissing: runs.filter(
      (run) => run.discoveryTurns.Predação === null,
    ).length,
    dormancyMissing: runs.filter(
      (run) => run.discoveryTurns.Dormência === null,
    ).length,
  },
  behavior: {
    birthsMean: mean(stalledRuns.map((run) => run.births)),
    deathsMean: mean(stalledRuns.map((run) => run.deaths)),
    capturesMean: mean(stalledRuns.map((run) => run.successfulCaptures)),
    firstContactMeanTurn: mean(
      stalledRuns.map((run) => run.firstContactTurn),
    ),
    firstCaptureMeanTurn: mean(
      stalledRuns.map((run) => run.firstCaptureTurn),
    ),
    minDistanceMean: mean(stalledRuns.map((run) => run.minDistanceEver)),
    finalPopulationMean: mean(
      stalledRuns.map((run) => run.finalPopulation),
    ),
    fertileCellsMean: mean(stalledRuns.map((run) => run.fertileCells)),
    tailPopulationMean: mean(
      stalledRuns.map((run) => run.tail.population),
    ),
    tailDistanceMean: mean(
      stalledRuns.map((run) => run.tail.distance),
    ),
    tailCaptureOptionsMean: mean(
      stalledRuns.map((run) => run.tail.captureOptions),
    ),
    tailCaptureOpportunityRateMean: mean(
      stalledRuns.map((run) => run.tail.captureOpportunityRate),
    ),
  },
  classifications,
  representativeStalls: stalledRuns.slice(0, 12),
};

report.elapsedSeconds = (performance.now() - started) / 1000;
console.log(JSON.stringify(report, null, 2));

if (report.stalled || report.commandCapped) {
  console.error(
    `Simulation envelope failed: ${report.stalled} game(s) reached ${turnLimit} turns and ${report.commandCapped} hit the technical command cap.`,
  );
  process.exitCode = 1;
}
