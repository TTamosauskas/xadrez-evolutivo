import assert from "node:assert/strict";
import {
  GEOLOGICAL_STAGES,
  TRAIT_STAGE,
  geologicalStage,
} from "../src/geology.js";
import {
  createState,
  clone,
  assertState,
  newPiece,
  round,
} from "../src/state.js";
import {
  transition,
  simulate,
  mutuallyBlocked,
  context,
} from "../src/engine.js";
import { chooseAction } from "../src/ai.js";
import { legalActions, movesFor } from "../src/moves.js";
import { checkPopulation } from "../src/disease.js";
import { reproduce } from "../src/reproduction.js";
import { square } from "../src/constants.js";

const stage = geologicalStage("devonian"),
  gamesPerScenario = Number(process.env.DEVONIAN_GAMES ?? 16),
  limit = Number(process.env.DEVONIAN_LIMIT ?? 1200),
  tailRounds = Number(process.env.DEVONIAN_TAIL ?? 100);

const OPTIONAL_TRACKED = [
  "Locomoção Avançada",
  "Coletor",
  "Necrófago",
  "Resistência",
  "Regeneração",
  "Camuflagem",
  "Construtor de Nicho",
  "Canibalismo",
  "Parasitismo",
  "Reprodução Sexuada",
  "Precocidade Sexual",
  "Veneno",
  "Fertilidade",
  "Dormência",
];

const historyThrough = (target) => [
  ...new Set(
    GEOLOGICAL_STAGES.slice(0, target.index + 1).flatMap(
      (entry) => entry.required,
    ),
  ),
];

function plantTraits() {
  return ["Fotossíntese", "Embriófitas", "Traqueófitas", "Espinhos"];
}

function baselineAnimalTraits(game) {
  return [
    "Predação",
    "Carnívoro",
    "Locomoção",
    "Respiração Cutânea",
    "Onívoro",
    "Carapaça",
    "Ovíparo",
    ...(game % 2 ? ["Escavador"] : ["Escalador"]),
  ];
}

function add(traits, ...names) {
  return [...new Set([...traits, ...names])];
}

function remove(traits, ...names) {
  const blocked = new Set(names);
  return traits.filter((trait) => !blocked.has(trait));
}

const SCENARIOS = [
  { id: "baseline", label: "Baseline atual" },
  {
    id: "no_omnivore",
    label: "Sem Onívoro",
    animal: (traits) => remove(traits, "Onívoro"),
  },
  {
    id: "no_cutaneous",
    label: "Sem Respiração Cutânea",
    animal: (traits) => remove(traits, "Respiração Cutânea"),
  },
  {
    id: "no_carapace",
    label: "Sem Carapaça",
    animal: (traits) => remove(traits, "Carapaça"),
  },
  {
    id: "no_oviparous",
    label: "Sem Ovíparo",
    animal: (traits) => remove(traits, "Ovíparo"),
  },
  {
    id: "no_spines",
    label: "Sem Espinhos na linhagem vegetal",
    plant: (traits) => remove(traits, "Espinhos"),
  },
  {
    id: "no_barrier_adaptation",
    label: "Sem Escavador/Escalador",
    animal: (traits) => remove(traits, "Escavador", "Escalador"),
  },
  {
    id: "advanced_locomotion",
    label: "Com Locomoção Avançada desde o início",
    animal: (traits) => add(traits, "Locomoção Avançada"),
  },
  {
    id: "collector",
    label: "Com Coletor",
    animal: (traits) => add(traits, "Coletor"),
  },
  {
    id: "scavenger",
    label: "Com Necrófago",
    animal: (traits) => add(traits, "Necrófago"),
  },
  {
    id: "resistance",
    label: "Com Resistência",
    animal: (traits) => add(traits, "Resistência"),
  },
  {
    id: "regeneration",
    label: "Com Regeneração",
    animal: (traits) => add(traits, "Regeneração"),
  },
  {
    id: "camouflage",
    label: "Com Camuflagem",
    animal: (traits) => add(traits, "Camuflagem"),
  },
  {
    id: "niche_builder",
    label: "Com Escavador + Construtor de Nicho",
    animal: (traits) => add(traits, "Escavador", "Construtor de Nicho"),
  },
  {
    id: "cannibalism",
    label: "Com Canibalismo",
    animal: (traits) => add(traits, "Canibalismo"),
  },
  {
    id: "parasitism",
    label: "Com Parasitismo",
    animal: (traits) => add(traits, "Parasitismo"),
  },
  {
    id: "collector_omnivore",
    label: "Coletor + Onívoro",
    animal: (traits) => add(traits, "Coletor", "Onívoro"),
  },
  {
    id: "resistance_regeneration",
    label: "Resistência + Regeneração",
    animal: (traits) => add(traits, "Resistência", "Regeneração"),
  },
  {
    id: "camouflage_carapace",
    label: "Camuflagem + Carapaça",
    animal: (traits) => add(traits, "Camuflagem", "Carapaça"),
  },
  {
    id: "baseline_no_barriers",
    label: "Baseline sem barreiras",
    removeBarriers: true,
  },
];

function policyFor(seed) {
  return seed % 4 === 0
    ? "random"
    : ["easy", "medium", "hard"][seed % 3];
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

function ownerTraitFractions(state, owner) {
  const pieces = state.pieces.filter((piece) => piece.owner === owner);
  return Object.fromEntries(
    OPTIONAL_TRACKED.map((trait) => [
      trait,
      pieces.length
        ? pieces.filter((piece) => piece.traits.includes(trait)).length /
          pieces.length
        : 0,
    ]),
  );
}

function snapshot(state) {
  const blueActions = (() => {
      const current = state.current;
      state.current = "blue";
      const actions = state.phase === "move" ? legalActions(state) : [];
      state.current = current;
      return actions;
    })(),
    amberActions = (() => {
      const current = state.current;
      state.current = "amber";
      const actions = state.phase === "move" ? legalActions(state) : [];
      state.current = current;
      return actions;
    })(),
    blue = state.pieces.filter((piece) => piece.owner === "blue").length,
    amber = state.pieces.filter((piece) => piece.owner === "amber").length;
  return {
    round: round(state),
    total: blue + amber,
    blue,
    amber,
    captureOptions:
      blueActions.filter((action) => isCaptureAction(state, action)).length +
      amberActions.filter((action) => isCaptureAction(state, action)).length,
    amberTraits: ownerTraitFractions(state, "amber"),
  };
}

function mean(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length
    ? Number((usable.reduce((sum, value) => sum + value, 0) / usable.length).toFixed(3))
    : null;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
}

function pct(value, total) {
  return total ? Number((value / total).toFixed(3)) : 0;
}

function buildInitial(seed, game, scenario) {
  const plants = scenario.plant
      ? scenario.plant(plantTraits(), game)
      : plantTraits(),
    animals = scenario.animal
      ? scenario.animal(baselineAnimalTraits(game), game)
      : baselineAnimalTraits(game),
    historicalTraits = [
      ...new Set([...historyThrough(stage), ...plants, ...animals]),
    ],
    state = createState(seed, {
      geologicalStage: "devonian",
      historicalTraits,
      canonicalPair: true,
      founders: {
        blue: { rank: 0, traits: plants },
        amber: { rank: 0, traits: animals },
      },
    });
  if (scenario.removeBarriers) state.naturalBarriers = [];
  assertState(state);
  return state;
}

function runGame(initial, seed) {
  let state = clone(initial),
    pseudo = seed ^ 0x9e3779b9,
    commands = 0,
    births = 0,
    deaths = 0,
    successfulCaptures = 0,
    captureAttempts = 0,
    lastSampleRound = -1;
  const samples = [],
    counters = {
      regenerationSaves: 0,
      populationPathogens: 0,
      collectorHarvests: 0,
      cutaneousReproductions: 0,
      scavengerReproductions: 0,
      hostileDeaths: 0,
      thornDefenses: 0,
      nicheNeutralizations: 0,
      cannibalReproductions: 0,
    },
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
      continue;
    }

    let action;
    if (mutuallyBlocked(state)) action = { type: "CONWAY_STEP" };
    else if (policy === "random") {
      const actions = legalActions(state);
      pseudo = (Math.imul(pseudo, 1664525) + 1013904223) >>> 0;
      action = actions[pseudo % actions.length] ?? { type: "PASS" };
    } else {
      action = chooseAction(state, policy, {
        budget: 5,
        maxNodes: 30,
      });
    }

    const beforeIds = new Set(state.pieces.map((piece) => piece.id)),
      beforeLogs = state.logs.length,
      captureAttempt = isCaptureAction(state, action),
      victim = captureAttempt
        ? state.pieces.find(
            (piece) =>
              piece.owner !== state.current &&
              piece.r === action.r &&
              piece.c === action.c,
          )
        : null;

    if (captureAttempt) captureAttempts++;
    const next = transition(state, action);
    assert.notEqual(next, state);
    assertState(next);

    const afterIds = new Set(next.pieces.map((piece) => piece.id));
    for (const id of afterIds) if (!beforeIds.has(id)) births++;
    for (const id of beforeIds) if (!afterIds.has(id)) deaths++;
    if (victim && !afterIds.has(victim.id)) successfulCaptures++;

    for (const entry of next.logs.slice(0, next.logs.length - beforeLogs)) {
      const text = entry.text;
      if (text.includes("Regeneração evitou a morte")) counters.regenerationSaves++;
      if (text.includes("Pressão demográfica: diferença")) counters.populationPathogens++;
      if (text.includes("Coletor recolheu")) counters.collectorHarvests++;
      if (text.includes("Respiração Cutânea consumiu")) counters.cutaneousReproductions++;
      if (text.includes("por necrofagia")) counters.scavengerReproductions++;
      if (text.includes("morte por casa hostil") || text.includes("deslocamento em casa hostil"))
        counters.hostileDeaths++;
      if (text.includes("Espinhos matou o agressor")) counters.thornDefenses++;
      if (text.includes("Construtor de Nicho neutralizou")) counters.nicheNeutralizations++;
      if (text.includes("Canibalismo converteu")) counters.cannibalReproductions++;
    }

    state = next;
    commands++;
    collect();
  }

  const finalRound = round(state),
    tailStart = Math.max(0, finalRound - tailRounds),
    tail = samples.filter((sample) => sample.round >= tailStart),
    traitMeans = Object.fromEntries(
      OPTIONAL_TRACKED.map((trait) => [
        trait,
        mean(tail.map((sample) => sample.amberTraits[trait])),
      ]),
    );

  return {
    seed,
    policy,
    finished: !!state.result,
    rounds: finalRound,
    commands,
    births,
    deaths,
    captureAttempts,
    successfulCaptures,
    counters,
    tailPopulation: mean(tail.map((sample) => sample.total)),
    tail2431: pct(
      tail.filter((sample) => sample.total >= 24 && sample.total < 32).length,
      tail.length,
    ),
    tailCaptureOptions: mean(tail.map((sample) => sample.captureOptions)),
    traits: traitMeans,
  };
}

function aggregate(runs) {
  const finished = runs.filter((run) => run.finished),
    capped = runs.filter((run) => !run.finished),
    sum = (selector, group = runs) =>
      group.reduce((total, run) => total + selector(run), 0),
    traitMeans = (group) =>
      Object.fromEntries(
        OPTIONAL_TRACKED.map((trait) => [
          trait,
          mean(group.map((run) => run.traits[trait])),
        ]),
      );
  return {
    games: runs.length,
    decisive: finished.length,
    capped: capped.length,
    cappedRate: pct(capped.length, runs.length),
    decisiveWithin200: finished.filter((run) => run.rounds <= 200).length,
    within200Rate: pct(
      finished.filter((run) => run.rounds <= 200).length,
      runs.length,
    ),
    medianFinishedRounds: median(finished.map((run) => run.rounds)),
    meanFinishedRounds: mean(finished.map((run) => run.rounds)),
    birthsPer100: mean(
      runs.map((run) => (run.births * 100) / Math.max(1, run.rounds)),
    ),
    deathsPer100: mean(
      runs.map((run) => (run.deaths * 100) / Math.max(1, run.rounds)),
    ),
    capturesPer100: mean(
      runs.map(
        (run) => (run.successfulCaptures * 100) / Math.max(1, run.rounds),
      ),
    ),
    tailPopulation: mean(runs.map((run) => run.tailPopulation)),
    tail2431: mean(runs.map((run) => run.tail2431)),
    tailCaptureOptions: mean(runs.map((run) => run.tailCaptureOptions)),
    counters: Object.fromEntries(
      Object.keys(runs[0]?.counters ?? {}).map((key) => [
        key,
        sum((run) => run.counters[key]),
      ]),
    ),
    traitPrevalence: {
      capped: traitMeans(capped),
      decisive: traitMeans(finished),
    },
  };
}

function microMechanismTests() {
  {
    const s = createState(901, {
      geologicalStage: "devonian",
      historicalTraits: historyThrough(stage),
      naturalBarriers: false,
    });
    s.pieces = [];
    s.nextId = 1;
    const p = newPiece(s, "blue", 4, 4, {
      rank: 0,
      traits: ["Predação", "Carnívoro", "Locomoção", "Onívoro", "Coletor"],
    });
    p.seeds = 1;
    s.pieces.push(p);
    const blocked = new Set();
    for (let r = 3; r <= 5; r++)
      for (let c = 3; c <= 5; c++) blocked.add(square(r, c));
    for (let cell = 0; s.pieces.length < 28 && cell < 64; cell++) {
      if (blocked.has(cell)) continue;
      s.pieces.push(
        newPiece(
          s,
          s.pieces.length % 2 ? "amber" : "blue",
          Math.floor(cell / 8),
          cell % 8,
          { traits: ["Predação", "Locomoção"] },
        ),
      );
    }
    s.current = "blue";
    s.board.fill("neutral");
    const stay = legalActions(s).find(
      (action) => action.type === "MOVE" && action.id === p.id && action.r === 4 && action.c === 4,
    );
    assert.ok(stay, "Coletor + Onívoro deve conseguir usar semente armazenada em população 28");
    const next = simulate(s, stay);
    assert.equal(next.pieces.length, 29);
    assert.equal(next.pieces.find((piece) => piece.id === p.id).seeds, 0);
  }

  {
    const s = createState(902, {
      geologicalStage: "devonian",
      historicalTraits: historyThrough(stage),
      naturalBarriers: false,
    });
    s.pieces = [];
    s.nextId = 1;
    const p = newPiece(s, "blue", 4, 4, {
      traits: ["Predação", "Carnívoro", "Locomoção", "Onívoro", "Respiração Cutânea"],
    });
    s.pieces.push(p, newPiece(s, "amber", 0, 0, { traits: ["Predação", "Locomoção"] }));
    s.board.fill("neutral");
    s.board[square(4, 5)] = "fertile";
    const cutaneous = movesFor(s, p).find((target) => target.cutaneous);
    assert.ok(cutaneous, "Onívoro + Respiração Cutânea deve reproduzir sem deslocar");
    const next = simulate(s, {
      type: "MOVE",
      id: p.id,
      r: cutaneous.r,
      c: cutaneous.c,
    });
    assert.equal(next.board[square(4, 5)], "neutral");
    assert.ok(next.pieces.length > s.pieces.length);
  }

  {
    const s = createState(903, {
      geologicalStage: "devonian",
      historicalTraits: historyThrough(stage),
      naturalBarriers: false,
    });
    s.pieces = [];
    s.nextId = 1;
    const p = newPiece(s, "blue", 4, 4, {
      traits: ["Predação", "Locomoção", "Necrófago"],
    });
    s.pieces.push(p);
    for (let cell = 0; s.pieces.length < 28 && cell < 64; cell++) {
      if (cell === square(4, 4)) continue;
      s.pieces.push(
        newPiece(
          s,
          s.pieces.length % 2 ? "amber" : "blue",
          Math.floor(cell / 8),
          cell % 8,
          { traits: ["Predação", "Locomoção"] },
        ),
      );
    }
    const before = s.pieces.length,
      born = reproduce(context(s), p, null, "necrofagia");
    assert.equal(born, 1);
    assert.equal(s.pieces.length, before + 1);
  }

  {
    const s = createState(904, {
      geologicalStage: "devonian",
      historicalTraits: historyThrough(stage),
      naturalBarriers: false,
    });
    s.pieces = [];
    s.nextId = 1;
    for (let i = 0; i < 18; i++)
      s.pieces.push(
        newPiece(s, "blue", Math.floor(i / 8) + 3, i % 8, {
          traits: ["Predação", "Locomoção", "Resistência"],
        }),
      );
    s.pieces.push(
      newPiece(s, "amber", 0, 0, { traits: ["Predação", "Locomoção"] }),
      newPiece(s, "amber", 0, 1, { traits: ["Predação", "Locomoção"] }),
    );
    s.turn = 2;
    s.rng = 1972;
    checkPopulation(s);
    assert.equal(s.diseases.length, 0, "Resistência total deve bloquear o surto demográfico");
  }

  {
    const s = createState(905, {
      geologicalStage: "devonian",
      historicalTraits: historyThrough(stage),
      naturalBarriers: false,
    });
    s.pieces = [];
    s.nextId = 1;
    const p = newPiece(s, "blue", 4, 4, {
      traits: ["Predação", "Locomoção", "Regeneração"],
    });
    s.pieces.push(p);
    assert.equal(context(s).kill(p.id, "Patógeno Virulento"), false);
    assert.equal(s.pieces.length, 1);
    assert.equal(context(s).kill(p.id, "Patógeno Virulento"), true);
    assert.equal(s.pieces.length, 0);
  }

  {
    const s = createState(906, {
      geologicalStage: "devonian",
      historicalTraits: historyThrough(stage),
      naturalBarriers: false,
    });
    s.pieces = [];
    s.nextId = 1;
    const rook = newPiece(s, "blue", 4, 0, {
        rank: 3,
        traits: ["Predação", "Locomoção"],
      }),
      camo = newPiece(s, "amber", 4, 4, {
        traits: ["Predação", "Locomoção", "Camuflagem"],
      });
    s.pieces.push(rook, camo);
    assert.ok(
      !movesFor(s, rook).some((target) => target.r === 4 && target.c === 4),
      "Camuflagem deve bloquear captura a distância no Devoniano",
    );
    rook.c = 3;
    assert.ok(
      movesFor(s, rook).some((target) => target.r === 4 && target.c === 4),
      "Camuflagem não deve bloquear captura adjacente",
    );
  }

  return true;
}

microMechanismTests();

const results = [];
for (const scenario of SCENARIOS) {
  const runs = [];
  for (let game = 1; game <= gamesPerScenario; game++) {
    const seed = 70000 + game,
      initial = buildInitial(seed, game, scenario);
    runs.push(runGame(initial, seed));
  }
  const summary = aggregate(runs);
  results.push({ id: scenario.id, label: scenario.label, ...summary });
  console.log(
    "DEVONIAN_MUTATION_SCENARIO " +
      JSON.stringify({ id: scenario.id, label: scenario.label, ...summary }),
  );
}

const baseline = results.find((row) => row.id === "baseline");
const comparisons = results
  .filter((row) => row.id !== "baseline")
  .map((row) => ({
    id: row.id,
    label: row.label,
    cappedDelta: row.capped - baseline.capped,
    within200Delta: row.decisiveWithin200 - baseline.decisiveWithin200,
    birthsPer100Delta:
      row.birthsPer100 === null || baseline.birthsPer100 === null
        ? null
        : Number((row.birthsPer100 - baseline.birthsPer100).toFixed(3)),
    deathsPer100Delta:
      row.deathsPer100 === null || baseline.deathsPer100 === null
        ? null
        : Number((row.deathsPer100 - baseline.deathsPer100).toFixed(3)),
    capturesPer100Delta:
      row.capturesPer100 === null || baseline.capturesPer100 === null
        ? null
        : Number((row.capturesPer100 - baseline.capturesPer100).toFixed(3)),
    tail2431Delta:
      row.tail2431 === null || baseline.tail2431 === null
        ? null
        : Number((row.tail2431 - baseline.tail2431).toFixed(3)),
  }));

console.log("DEVONIAN_MUTATION_DIAGNOSTIC_REPORT");
console.log(
  JSON.stringify(
    {
      gamesPerScenario,
      limit,
      tailRounds,
      baseline,
      comparisons,
      results,
    },
    null,
    2,
  ),
);
