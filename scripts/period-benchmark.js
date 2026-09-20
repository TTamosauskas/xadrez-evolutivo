import assert from "node:assert/strict";
import {
  GEOLOGICAL_STAGES,
  TRAIT_STAGE,
  geologicalStage,
} from "../src/geology.js";
import { createState, clone, assertState } from "../src/state.js";
import { transition, mutuallyBlocked } from "../src/engine.js";
import { chooseAction } from "../src/ai.js";
import { legalActions } from "../src/moves.js";

const gamesPerStage = Number(process.env.GAMES_PER_STAGE ?? 6),
  limit = Number(process.env.LIMIT ?? 1200),
  goalRounds = Number(process.env.GOAL_ROUNDS ?? 200);

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
  if (available("Ovíparos Amniotas", stage) && !available("Ovovivíparo", stage))
    traits.push("Ovíparos Amniotas");
  if (available("Ovovivíparo", stage) && !available("Vivíparo", stage))
    traits.push("Ovovivíparo");
  if (available("Vivíparo", stage)) traits.push("Vivíparo");
  if (available("Voo", stage)) traits.push("Voo");
  if (available("Sacos Aéreos", stage)) traits.push("Sacos Aéreos");
  if (available("Visão Noturna", stage)) traits.push("Visão Noturna");
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

function percentile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    index = Math.floor((sorted.length - 1) * q);
  return sorted[index];
}

function summarize(runs) {
  const finished = runs.filter((run) => run.finished),
    decisive = finished.filter((run) => run.winner),
    turns = finished.map((run) => run.turns),
    rounds = finished.map((run) => run.rounds),
    goalMet = decisive.filter((run) => run.rounds <= goalRounds),
    commands = finished.map((run) => run.commands);
  return {
    games: runs.length,
    finished: finished.length,
    decisive: decisive.length,
    draws: finished.length - decisive.length,
    capped: runs.length - finished.length,
    finishRate: Number((finished.length / runs.length).toFixed(3)),
    turns: {
      min: turns.length ? Math.min(...turns) : null,
      p25: percentile(turns, 0.25),
      median: percentile(turns, 0.5),
      p75: percentile(turns, 0.75),
      max: turns.length ? Math.max(...turns) : null,
      mean: turns.length
        ? Number((turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1))
        : null,
    },
    rounds: {
      min: rounds.length ? Math.min(...rounds) : null,
      p25: percentile(rounds, 0.25),
      median: percentile(rounds, 0.5),
      p75: percentile(rounds, 0.75),
      max: rounds.length ? Math.max(...rounds) : null,
      mean: rounds.length
        ? Number((rounds.reduce((a, b) => a + b, 0) / rounds.length).toFixed(1))
        : null,
    },
    goal: {
      rounds: goalRounds,
      met: goalMet.length,
      rate: Number((goalMet.length / runs.length).toFixed(3)),
    },
    commandsMean: commands.length
      ? Number(
          (commands.reduce((a, b) => a + b, 0) / commands.length).toFixed(1),
        )
      : null,
    finishedWithin: {
      80: finished.filter((run) => run.turns <= 80).length,
      120: finished.filter((run) => run.turns <= 120).length,
      200: finished.filter((run) => run.turns <= 200).length,
      600: finished.filter((run) => run.turns <= 600).length,
    },
    blocks: {
      mutualMean: Number(
        (
          runs.reduce((sum, run) => sum + run.mutualBlocks, 0) / runs.length
        ).toFixed(1),
      ),
      conwayMean: Number(
        (
          runs.reduce((sum, run) => sum + run.conwaySteps, 0) / runs.length
        ).toFixed(1),
      ),
      passMean: Number(
        (runs.reduce((sum, run) => sum + run.passes, 0) / runs.length).toFixed(
          1,
        ),
      ),
      autoBlockedMean: Number(
        (
          runs.reduce((sum, run) => sum + run.autoBlocked, 0) / runs.length
        ).toFixed(1),
      ),
    },
    populationMax: Math.max(...runs.map((run) => run.maxPopulation)),
    pressure: {
      naturalDeaths: runs.reduce(
        (sum, run) => sum + run.naturalDeaths,
        0,
      ),
      fertileDepleted: runs.reduce(
        (sum, run) => sum + run.fertileDepleted,
        0,
      ),
      populationPathogens: runs.reduce(
        (sum, run) => sum + run.populationPathogens,
        0,
      ),
      pathogenGapMean: (() => {
        const gaps = runs.flatMap((run) => run.pathogenGaps);
        return gaps.length
          ? Number((gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1))
          : null;
      })(),
      conwayFinalRepairs: runs.reduce(
        (sum, run) => sum + run.conwayFinalRepairs,
        0,
      ),
      conwayCorridorCells: runs.reduce(
        (sum, run) => sum + run.conwayCorridorCells,
        0,
      ),
    },
    naturalBarriers: {
      initialMean: Number(
        (
          runs.reduce((sum, run) => sum + run.initialNaturalBarriers, 0) /
          runs.length
        ).toFixed(1),
      ),
      max: Math.max(...runs.map((run) => run.maxNaturalBarriers)),
      created: runs.reduce((sum, run) => sum + run.barriersCreated, 0),
      removed: runs.reduce((sum, run) => sum + run.barriersRemoved, 0),
    },
  };
}

function runGame(initial, seed) {
  let s = clone(initial),
    random = seed ^ 0x9e3779b9,
    commands = 0,
    notices = 0,
    mutualBlocks = 0,
    conwaySteps = 0,
    passes = 0,
    autoBlocked = 0,
    maxPopulation = s.pieces.length,
    maxNaturalBarriers = s.naturalBarriers.length,
    barriersCreated = 0,
    barriersRemoved = 0,
    naturalDeaths = 0,
    fertileDepleted = 0,
    populationPathogens = 0,
    pathogenGaps = [],
    conwayFinalRepairs = 0,
    conwayCorridorCells = 0;
  const initialNaturalBarriers = s.naturalBarriers.length;

  while (!s.result && commands < limit) {
    if (s.notices.length) {
      s = transition(s, { type: "ACK_NOTICE", id: s.notices[0].id });
      notices++;
      continue;
    }

    let action;
    if (mutuallyBlocked(s)) {
      mutualBlocks++;
      action = { type: "CONWAY_STEP" };
      conwaySteps++;
    } else {
      const actions = legalActions(s);
      if (seed % 4 === 0) {
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
        action = actions[random % actions.length] ?? { type: "PASS" };
      } else
        action = chooseAction(s, ["easy", "medium", "hard"][seed % 3], {
          budget: 5,
          maxNodes: 30,
        });
      if (action.type === "PASS") passes++;
    }

    const beforeNatural = new Set(s.naturalBarriers),
      beforeLogLength = s.logs.length,
      next = transition(s, action);
    assert.notEqual(next, s);
    assertState(next);

    const afterNatural = new Set(next.naturalBarriers);
    for (const cell of afterNatural)
      if (!beforeNatural.has(cell)) barriersCreated++;
    for (const cell of beforeNatural)
      if (!afterNatural.has(cell)) barriersRemoved++;
    for (const entry of next.logs.slice(0, next.logs.length - beforeLogLength)) {
      if (entry.text.includes("passaram automaticamente por bloqueio"))
        autoBlocked++;
      if (entry.text.includes("perderam uma peça por morte natural"))
        naturalDeaths++;
      const depleted = entry.text.match(
        /Superpopulação esgotou (\d+) casa/,
      );
      if (depleted) fertileDepleted += Number(depleted[1]);
      const pathogen = entry.text.match(
        /Pressão demográfica: diferença (\d+)/,
      );
      if (pathogen) {
        populationPathogens++;
        pathogenGaps.push(Number(pathogen[1]));
      }
      const corridor = entry.text.match(
        /abriu caminho entre organismos adversários próximos, alterando (\d+) casa/,
      );
      if (corridor) {
        conwayFinalRepairs++;
        conwayCorridorCells += Number(corridor[1]);
      }
    }

    s = next;
    commands++;
    maxPopulation = Math.max(maxPopulation, s.pieces.length);
    maxNaturalBarriers = Math.max(maxNaturalBarriers, s.naturalBarriers.length);
  }

  return {
    finished: !!s.result,
    winner: s.result?.winner ?? null,
    turns: s.turn,
    rounds: Math.ceil(s.turn / 2),
    commands,
    notices,
    mutualBlocks,
    conwaySteps,
    passes,
    autoBlocked,
    maxPopulation,
    initialNaturalBarriers,
    maxNaturalBarriers,
    barriersCreated,
    barriersRemoved,
    naturalDeaths,
    fertileDepleted,
    populationPathogens,
    pathogenGaps,
    conwayFinalRepairs,
    conwayCorridorCells,
  };
}

const report = {
  gamesPerStage,
  paired: true,
  capCommands: limit,
  goalRounds,
  stages: [],
};
const started = performance.now();

for (const stage of GEOLOGICAL_STAGES) {
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
    barrierRange: stage.habitat.naturalBarriers,
    withBarriers: summarize(withBarriers),
    withoutBarriers: summarize(withoutBarriers),
  };
  report.stages.push(row);
  console.log(
    JSON.stringify({
      period: row.period,
      range: row.barrierRange,
      with: row.withBarriers,
      without: row.withoutBarriers,
    }),
  );
}
report.elapsedSeconds = Number(
  ((performance.now() - started) / 1000).toFixed(2),
);
console.log("PERIOD_BENCHMARK_REPORT");
console.log(JSON.stringify(report, null, 2));
