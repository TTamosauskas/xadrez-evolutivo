import assert from "node:assert/strict";
import {
  GEOLOGICAL_STAGES,
  TRAIT_STAGE,
  geologicalStage,
} from "../src/geology.js";
import { createState, clone, assertState, round } from "../src/state.js";
import { transition, mutuallyBlocked } from "../src/engine.js";
import { chooseAction } from "../src/ai.js";
import { legalActions } from "../src/moves.js";
import { distance, square } from "../src/constants.js";

const TARGETS = new Set(["ediacaran", "silurian", "devonian"]),
  gamesPerStage = Number(process.env.DIAGNOSTIC_GAMES ?? 24),
  limit = Number(process.env.DIAGNOSTIC_LIMIT ?? 1200),
  tailRounds = Number(process.env.DIAGNOSTIC_TAIL ?? 100);

const stageIndex = (id) => geologicalStage(id).index,
  available = (trait, stage) =>
    stageIndex(TRAIT_STAGE[trait] ?? "archean") <= stage.index;

function plantTraits(stage, game) {
  return [
    "Fotossíntese",
    ...(available("Multicelularismo", stage) ? ["Multicelularismo"] : []),
    ...(available("Embriófitas", stage) ? ["Embriófitas"] : []),
    ...(available("Traqueófitas", stage) ? ["Traqueófitas"] : []),
    ...(available("Espinhos", stage) ? ["Espinhos"] : []),
    ...(available("Gimnospermas", stage) ? ["Gimnospermas"] : []),
    ...(available("Trepadeira", stage) && game % 2 === 0 ? ["Trepadeira"] : []),
    ...(available("Angiospermas", stage) ? ["Angiospermas"] : []),
  ];
}

function animalTraits(stage, game) {
  const traits = [
    "Predação",
    ...(available("Multicelularismo", stage) ? ["Multicelularismo"] : []),
  ];
  if (available("Carnívoro", stage)) traits.push("Carnívoro");
  if (available("Locomoção", stage)) traits.push("Locomoção");
  if (available("Escavador", stage) && game % 2 === 1) traits.push("Escavador");
  if (available("Respiração Cutânea", stage)) traits.push("Respiração Cutânea");
  if (available("Onívoro", stage)) traits.push("Onívoro");
  if (available("Escalador", stage) && game % 2 === 0) traits.push("Escalador");
  if (available("Carapaça", stage)) traits.push("Carapaça");
  if (available("Ovíparo", stage) && !available("Ovíparos Amniotas", stage))
    traits.push("Ovíparo");
  return traits;
}

function historyThrough(stage) {
  return [
    ...new Set(
      GEOLOGICAL_STAGES.slice(0, stage.index + 1).flatMap(
        (entry) => entry.required,
      ),
    ),
  ];
}

function policyFor(seed) {
  return seed % 4 === 0
    ? "random"
    : ["easy", "medium", "hard"][seed % 3];
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
  return Math.min(
    ...blue.flatMap((a) => amber.map((b) => distance(a, b))),
  );
}

function snapshot(state) {
  const blueActions = actionsForOwner(state, "blue"),
    amberActions = actionsForOwner(state, "amber"),
    fertile = state.board.filter((cell) => cell === "fertile").length,
    hostile = state.board.filter((cell) => cell === "hostile").length,
    occupied = new Set([
      ...state.pieces.map((piece) => square(piece.r, piece.c)),
      ...state.eggs.map((egg) => square(egg.r, egg.c)),
      ...state.plantSeeds.map((seed) => square(seed.r, seed.c)),
    ]),
    freeFertile = state.board.reduce(
      (count, cell, index) =>
        count + (cell === "fertile" && !occupied.has(index) ? 1 : 0),
      0,
    ),
    blue = state.pieces.filter((piece) => piece.owner === "blue").length,
    amber = state.pieces.filter((piece) => piece.owner === "amber").length;
  return {
    round: round(state),
    blue,
    amber,
    total: blue + amber,
    gap: Math.abs(blue - amber),
    fertile,
    freeFertile,
    hostile,
    eggs: state.eggs.length,
    seeds: state.plantSeeds.length,
    diseases: state.diseases.length,
    minDistance: minEnemyDistance(state),
    legalActions: blueActions.length + amberActions.length,
    captureOptions:
      blueActions.filter((action) => isCaptureAction(state, action)).length +
      amberActions.filter((action) => isCaptureAction(state, action)).length,
  };
}

function mean(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length
    ? Number((usable.reduce((a, b) => a + b, 0) / usable.length).toFixed(2))
    : null;
}

function pct(value, total) {
  return total ? Number((value / total).toFixed(3)) : 0;
}

function summarizeSamples(samples) {
  if (!samples.length) return {};
  return {
    rounds: samples.length,
    population: mean(samples.map((x) => x.total)),
    blue: mean(samples.map((x) => x.blue)),
    amber: mean(samples.map((x) => x.amber)),
    gap: mean(samples.map((x) => x.gap)),
    fertile: mean(samples.map((x) => x.fertile)),
    freeFertile: mean(samples.map((x) => x.freeFertile)),
    hostile: mean(samples.map((x) => x.hostile)),
    eggs: mean(samples.map((x) => x.eggs)),
    seeds: mean(samples.map((x) => x.seeds)),
    diseases: mean(samples.map((x) => x.diseases)),
    minDistance: mean(samples.map((x) => x.minDistance)),
    legalActions: mean(samples.map((x) => x.legalActions)),
    captureOptions: mean(samples.map((x) => x.captureOptions)),
    captureOpportunityRounds: pct(
      samples.filter((x) => x.captureOptions > 0).length,
      samples.length,
    ),
    bands: {
      under16: pct(samples.filter((x) => x.total < 16).length, samples.length),
      from16to23: pct(
        samples.filter((x) => x.total >= 16 && x.total < 24).length,
        samples.length,
      ),
      from24to31: pct(
        samples.filter((x) => x.total >= 24 && x.total < 32).length,
        samples.length,
      ),
      from32to39: pct(
        samples.filter((x) => x.total >= 32 && x.total < 40).length,
        samples.length,
      ),
      atLeast40: pct(
        samples.filter((x) => x.total >= 40).length,
        samples.length,
      ),
    },
  };
}

function classify(run) {
  const tail = run.tail;
  if (run.conwaySteps > run.commands * 0.2) return "conway_lock";
  if (
    tail.captureOpportunityRounds >= 0.25 &&
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
    tail.population >= 16 &&
    tail.population < 32 &&
    tail.captureOpportunityRounds < 0.1 &&
    tail.minDistance >= 3
  )
    return "low_contact_mid_population";
  if (tail.bands?.from24to31 >= 0.5) return "resource_pressure_plateau";
  return "mixed";
}

function runGame(initial, seed) {
  let state = clone(initial),
    pseudo = seed ^ 0x9e3779b9,
    commands = 0,
    notices = 0,
    conwaySteps = 0,
    passes = 0,
    births = 0,
    deaths = 0,
    captureAttempts = 0,
    successfulCaptures = 0,
    nonCaptureWithCaptureAvailable = 0,
    severeEvents = 0,
    pathogenOutbreaks = 0,
    fertilityDepleted = 0,
    naturalDeaths = 0,
    lastSampleRound = -1;
  const samples = [],
    policy = policyFor(seed);

  const collect = () => {
    const now = round(state);
    if (state.phase === "move" && now !== lastSampleRound) {
      samples.push(snapshot(state));
      lastSampleRound = now;
    }
  };
  collect();

  while (!state.result && commands < limit) {
    if (state.notices.length) {
      state = transition(state, {
        type: "ACK_NOTICE",
        id: state.notices[0].id,
      });
      notices++;
      continue;
    }

    let action;
    const captureOptions = actionsForOwner(state, state.current).filter(
      (candidate) => isCaptureAction(state, candidate),
    );
    if (mutuallyBlocked(state)) {
      action = { type: "CONWAY_STEP" };
      conwaySteps++;
    } else if (policy === "random") {
      const actions = legalActions(state);
      pseudo = (Math.imul(pseudo, 1664525) + 1013904223) >>> 0;
      action = actions[pseudo % actions.length] ?? { type: "PASS" };
    } else {
      action = chooseAction(state, policy, {
        budget: 5,
        maxNodes: 30,
      });
    }

    const captureAttempt = isCaptureAction(state, action),
      victim = captureAttempt
        ? state.pieces.find(
            (piece) =>
              piece.r === action.r &&
              piece.c === action.c &&
              piece.owner !== state.current,
          )
        : null,
      beforeIds = new Set(state.pieces.map((piece) => piece.id)),
      beforeLogLength = state.logs.length;

    if (captureAttempt) captureAttempts++;
    else if (captureOptions.length) nonCaptureWithCaptureAvailable++;
    if (action.type === "PASS") passes++;

    const next = transition(state, action);
    assert.notEqual(next, state);
    assertState(next);

    const afterIds = new Set(next.pieces.map((piece) => piece.id));
    for (const id of afterIds) if (!beforeIds.has(id)) births++;
    for (const id of beforeIds) if (!afterIds.has(id)) deaths++;
    if (victim && !afterIds.has(victim.id)) successfulCaptures++;

    for (const entry of next.logs.slice(0, next.logs.length - beforeLogLength)) {
      if (entry.text.includes("desencadearam um evento severo")) severeEvents++;
      if (entry.text.includes("Pressão demográfica: diferença"))
        pathogenOutbreaks++;
      if (entry.text.includes("perderam uma peça por morte natural"))
        naturalDeaths++;
      const depleted = entry.text.match(/Superpopulação esgotou (\d+) casa/);
      if (depleted) fertilityDepleted += Number(depleted[1]);
    }

    state = next;
    commands++;
    collect();
  }

  const finalRound = round(state),
    tailStart = Math.max(0, finalRound - tailRounds),
    tailSamples = samples.filter((sample) => sample.round >= tailStart),
    run = {
      seed,
      policy,
      finished: !!state.result,
      winner: state.result?.winner ?? null,
      commands,
      rounds: finalRound,
      notices,
      conwaySteps,
      passes,
      births,
      deaths,
      captureAttempts,
      successfulCaptures,
      nonCaptureWithCaptureAvailable,
      severeEvents,
      pathogenOutbreaks,
      fertilityDepleted,
      naturalDeaths,
      overall: summarizeSamples(samples),
      tail: summarizeSamples(tailSamples),
      final: snapshot(state),
    };
  run.loop = run.finished ? "decisive" : classify(run);
  return run;
}

function aggregate(runs) {
  const capped = runs.filter((run) => !run.finished),
    finished = runs.filter((run) => run.finished),
    byPolicy = Object.fromEntries(
      ["random", "easy", "medium", "hard"].map((policy) => {
        const group = runs.filter((run) => run.policy === policy);
        return [
          policy,
          {
            games: group.length,
            capped: group.filter((run) => !run.finished).length,
            cappedRate: pct(
              group.filter((run) => !run.finished).length,
              group.length,
            ),
            medianFinishedRounds: (() => {
              const values = group
                .filter((run) => run.finished)
                .map((run) => run.rounds)
                .sort((a, b) => a - b);
              return values.length ? values[Math.floor(values.length / 2)] : null;
            })(),
          },
        ];
      }),
    ),
    loops = {};
  for (const run of capped) loops[run.loop] = (loops[run.loop] ?? 0) + 1;

  const sum = (key, group = capped) =>
    group.reduce((total, run) => total + run[key], 0);
  return {
    games: runs.length,
    decisive: finished.length,
    capped: capped.length,
    cappedRate: pct(capped.length, runs.length),
    decisiveWithin200: finished.filter((run) => run.rounds <= 200).length,
    cappedFinalRounds: mean(capped.map((run) => run.rounds)),
    loops,
    byPolicy,
    cappedRatesPer100Rounds: {
      births: mean(capped.map((run) => (run.births * 100) / Math.max(1, run.rounds))),
      deaths: mean(capped.map((run) => (run.deaths * 100) / Math.max(1, run.rounds))),
      captures: mean(
        capped.map(
          (run) => (run.successfulCaptures * 100) / Math.max(1, run.rounds),
        ),
      ),
      passes: mean(capped.map((run) => (run.passes * 100) / Math.max(1, run.rounds))),
      conway: mean(
        capped.map((run) => (run.conwaySteps * 100) / Math.max(1, run.rounds)),
      ),
    },
    cappedBehavior: {
      captureAttempts: sum("captureAttempts"),
      successfulCaptures: sum("successfulCaptures"),
      nonCaptureWithCaptureAvailable: sum("nonCaptureWithCaptureAvailable"),
      severeEvents: sum("severeEvents"),
      pathogenOutbreaks: sum("pathogenOutbreaks"),
      fertilityDepleted: sum("fertilityDepleted"),
      naturalDeaths: sum("naturalDeaths"),
    },
    cappedOverall: summarizeSamples(capped.flatMap((run) => {
      const marker = run.overall;
      return marker?.rounds ? [] : [];
    })),
    cappedTailMeans: {
      population: mean(capped.map((run) => run.tail.population)),
      gap: mean(capped.map((run) => run.tail.gap)),
      fertile: mean(capped.map((run) => run.tail.fertile)),
      freeFertile: mean(capped.map((run) => run.tail.freeFertile)),
      hostile: mean(capped.map((run) => run.tail.hostile)),
      eggs: mean(capped.map((run) => run.tail.eggs)),
      seeds: mean(capped.map((run) => run.tail.seeds)),
      diseases: mean(capped.map((run) => run.tail.diseases)),
      minDistance: mean(capped.map((run) => run.tail.minDistance)),
      legalActions: mean(capped.map((run) => run.tail.legalActions)),
      captureOptions: mean(capped.map((run) => run.tail.captureOptions)),
      captureOpportunityRounds: mean(
        capped.map((run) => run.tail.captureOpportunityRounds),
      ),
      under16: mean(capped.map((run) => run.tail.bands?.under16)),
      from16to23: mean(capped.map((run) => run.tail.bands?.from16to23)),
      from24to31: mean(capped.map((run) => run.tail.bands?.from24to31)),
      from32to39: mean(capped.map((run) => run.tail.bands?.from32to39)),
      atLeast40: mean(capped.map((run) => run.tail.bands?.atLeast40)),
    },
    cappedRuns: capped.map((run) => ({
      seed: run.seed,
      policy: run.policy,
      rounds: run.rounds,
      loop: run.loop,
      births: run.births,
      deaths: run.deaths,
      captures: run.successfulCaptures,
      passes: run.passes,
      conway: run.conwaySteps,
      nonCaptureWithCaptureAvailable: run.nonCaptureWithCaptureAvailable,
      severeEvents: run.severeEvents,
      pathogenOutbreaks: run.pathogenOutbreaks,
      fertilityDepleted: run.fertilityDepleted,
      naturalDeaths: run.naturalDeaths,
      tail: run.tail,
      final: run.final,
    })),
  };
}

const report = {
  gamesPerStage,
  limit,
  tailRounds,
  stages: [],
};
const started = performance.now();

for (const stage of GEOLOGICAL_STAGES.filter((stage) => TARGETS.has(stage.id))) {
  const withBarriers = [],
    withoutBarriers = [];
  for (let game = 1; game <= gamesPerStage; game++) {
    const seed = (stage.index + 1) * 10000 + game,
      traits = animalTraits(stage, game),
      base = createState(seed, {
        geologicalStage: stage.id,
        historicalTraits: [
          ...new Set([
            ...historyThrough(stage),
            ...plantTraits(stage, game),
            ...traits,
          ]),
        ],
        canonicalPair: true,
        founders: {
          blue: { rank: 0, traits: plantTraits(stage, game) },
          amber: { rank: 0, traits },
        },
      }),
      noRelief = clone(base);
    noRelief.naturalBarriers = [];
    assertState(base);
    assertState(noRelief);
    withBarriers.push(runGame(base, seed));
    withoutBarriers.push(runGame(noRelief, seed));
  }
  const row = {
    id: stage.id,
    period: stage.period,
    withBarriers: aggregate(withBarriers),
    withoutBarriers: aggregate(withoutBarriers),
  };
  report.stages.push(row);
  console.log("STALL_STAGE " + JSON.stringify(row));
}

report.elapsedSeconds = Number(
  ((performance.now() - started) / 1000).toFixed(2),
);
console.log("STALL_DIAGNOSTIC_REPORT");
console.log(JSON.stringify(report, null, 2));
