import { has, inside, square, TRAITS, EVENTS } from "./constants.js";
import {
  GEOLOGICAL_STAGES,
  currentGeologicalStage,
  nextGeologicalStage,
  geologicalLabel,
  habitatProfile,
  aquaticFertilityRegime,
  normalizeActiveTraits,
  normalizePhotosyntheticRank,
  PLANT_DERIVED_TRAITS,
  PLANT_INCOMPATIBLE_TRAITS,
  recordHistoricalTraits,
  stageComplete,
  traitCombinationValid,
} from "./geology.js";
import {
  cloneDiscoveries,
  recordDiscovery,
  validDiscoveries,
} from "./discoveries.js";
import {
  cloneGenome,
  genomeCarriedTraits,
  genomeFromLegacyProfile,
  genomeSignature,
  hiddenRecessiveTraits,
  syncGenomePhenotype,
  validGenome,
  withoutGenomeTraits,
} from "./genetics.js";
import {
  DEFAULT_SCENARIO,
  EARTH_FOUNDER_GENOMES,
  validScenario,
} from "./scenarios.js";
import {
  ARENA_RECESSIVE_COUNT,
  arenaProfile,
  chooseArenaRecessives,
  completeArenaGenome,
} from "./arena.js";
export const clone = (value) => structuredClone(value);
export function random(state) {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}
export const pick = (state, items) =>
  items.length ? items[Math.floor(random(state) * items.length)] : null;
export function shuffle(state, items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export const at = (state, r, c) =>
  state.pieces.find((p) => p.r === r && p.c === c);
export const eggAt = (state, r, c) =>
  state.eggs?.find((egg) => egg.r === r && egg.c === c);
export const plantSeedAt = (state, r, c) =>
  state.plantSeeds?.find((seed) => seed.r === r && seed.c === c);
export const builtBarrierAt = (state, r, c) =>
  state.barriers?.includes(square(r, c)) ?? false;
export const naturalBarrierAt = (state, r, c) =>
  state.naturalBarriers?.includes(square(r, c)) ?? false;
export const barrierAt = (state, r, c) =>
  builtBarrierAt(state, r, c) || naturalBarrierAt(state, r, c);
export const terrain = (state, r, c) => state.board[square(r, c)];
export const round = (state) => Math.floor(state.turn / 2);
export const ECOLOGICAL_DOMAIN_START_TURN = 200;
export const ECOLOGICAL_DOMAIN_REQUIRED_TURNS = 3;
export const ECOLOGICAL_DOMAIN_REQUIRED_QUADRANTS = 3;
export const ecologicalQuadrant = (r, c) =>
  (r >= 4 ? 2 : 0) + (c >= 4 ? 1 : 0);
export const createEcologicalDomain = () => ({
  active: false,
  quadrants: Array.from({ length: 4 }, () => ({
    owner: null,
    progress: 0,
    consolidated: false,
  })),
});
export function ecologicalDomainBlocked(state, owner, r, c) {
  if (!owner || !inside(r, c)) return false;
  const quadrant = state.ecologicalDomain?.quadrants?.[ecologicalQuadrant(r, c)];
  return !!(
    quadrant?.consolidated &&
    quadrant.owner &&
    quadrant.owner !== owner
  );
}
// O desfecho e a pressão ecológica consideram apenas organismos já ativos.
// Ovos e sementes continuam recursos reprodutivos, sem sustentar uma linhagem.
export const activePopulation = (state) => state.pieces.length;
export const fertilityPaused = (state) => activePopulation(state) >= 24;

export function consumeFertileTerrain(state, cell) {
  if (state.board[cell] !== "fertile") return false;
  state.board[cell] = "neutral";
  if (aquaticFertilityRegime(state)) {
    state.fertilityRecovery ??= [];
    const dueTurn = state.turn + 3,
      existing = state.fertilityRecovery.find((entry) => entry.cell === cell);
    if (existing) existing.dueTurn = Math.max(existing.dueTurn, dueTurn);
    else state.fertilityRecovery.push({ cell, dueTurn });
  }
  return true;
}

export function restoreAquaticFertility(state) {
  if (!Array.isArray(state.fertilityRecovery)) state.fertilityRecovery = [];
  if (!aquaticFertilityRegime(state)) {
    state.fertilityRecovery = [];
    return 0;
  }
  let restored = 0;
  state.fertilityRecovery = state.fertilityRecovery.filter((entry) => {
    if (entry.dueTurn > state.turn) return true;
    if (state.board[entry.cell] === "fertile") return false;
    if (
      state.board[entry.cell] !== "neutral" ||
      state.barriers?.includes(entry.cell) ||
      state.naturalBarriers?.includes(entry.cell) ||
      state.deathSites?.some((site) => site.cell === entry.cell) ||
      state.event?.hazards?.includes(entry.cell)
    )
      return true;
    state.board[entry.cell] = "fertile";
    restored++;
    return false;
  });
  return restored;
}

export function photosynthesisDelayTurns(state, piece = null) {
  const population = activePopulation(state),
    preArticulated =
      piece &&
      !(piece.traits ?? []).includes("Locomoção Articulada") &&
      !(piece.ancestry ?? []).includes("Locomoção Articulada");
  if (population >= 24) return preArticulated ? 12 : null;
  if (population <= 11) return 6;
  if (population <= 17) return 8;
  return 10;
}
export const SENESCENCE_AGE = 25;
export const MAX_NATURAL_AGE = 48;
export const multicellular = (piece) =>
  !!piece && (piece.traits ?? []).includes("Multicelularismo");
export const pieceAge = (state, piece) =>
  piece && Number.isInteger(piece.bornRound)
    ? Math.max(0, round(state) - piece.bornRound)
    : 0;
export const senescent = (state, piece) =>
  multicellular(piece) && pieceAge(state, piece) >= SENESCENCE_AGE;
export function naturalDeathChance(state, piece) {
  if (!multicellular(piece)) return 0;
  const age = pieceAge(state, piece);
  if (age < SENESCENCE_AGE) return 0;
  if (age < 33) return 0.05;
  if (age < 41) return 0.1;
  if (age < MAX_NATURAL_AGE) return 0.2;
  return 1;
}
export const juvenile = (state, piece) =>
  multicellular(piece) &&
  Number.isInteger(piece.maturesRound) &&
  round(state) < piece.maturesRound;
export const reproductionReady = (state, piece) =>
  !!piece &&
  !juvenile(state, piece) &&
  !(piece.traits ?? []).includes("Esterilidade") &&
  !(piece.pregnancies ?? []).some(
    (pregnancy) => pregnancy.kind === "ovoviviparous",
  ) &&
  round(state) >= (piece.nextReproductionRound ?? 0);
export function log(state, text) {
  state.logs.unshift({ turn: state.turn, text });
  state.logs.length = Math.min(state.logs.length, 160);
}
export function notice(state, title, lines, key = null) {
  if (key && state.seen.includes(key)) return;
  if (key) state.seen.push(key);
  const pending = state.notices.find((n) => n.title === title);
  if (pending) {
    for (const line of lines)
      if (!pending.lines.includes(line)) pending.lines.push(line);
  } else
    state.notices.push({
      id: state.nextNotice++,
      title,
      lines: [...new Set(lines)],
    });
}
export function newPiece(state, owner, r, c, source = {}) {
  const bornRound = round(state),
    basalTraits = ["Respiração anaeróbia", ...(source.traits ?? [])],
    legacyProfile = {
      ...source,
      traits: basalTraits,
    },
    piece = {
      id: state.nextId++,
      owner,
      r,
      c,
      rank: source.rank ?? 0,
      traits: normalizeActiveTraits(basalTraits),
      ancestry: [
        ...new Set([
          "Respiração anaeróbia",
          ...(source.ancestry ?? []),
          ...(source.traits ?? []),
        ]),
      ],
      genome: source.genome
        ? cloneGenome(source.genome)
        : genomeFromLegacyProfile(legacyProfile),
      mutations: source.mutations ?? 0,
      generation: source.generation ?? 0,
      parentId: source.parentId ?? null,
      pawnDir: owner === "blue" ? -1 : 1,
      seeds: 0,
      pregnancies: [],
      bornRound: source.bornRound ?? bornRound,
      maturesRound: source.maturesRound ?? bornRound,
      nextReproductionRound: source.nextReproductionRound ?? bornRound,
      oothecaPrimed: source.oothecaPrimed ?? false,
    };
  const preferredEnergy = source.traits?.includes("Predação")
    ? "Predação"
    : source.traits?.includes("Fotossíntese")
      ? "Fotossíntese"
      : null;
  syncGenomePhenotype(piece, preferredEnergy);
  if (has(piece, "Artrópode") && ![0, 1, 2, 4].includes(piece.rank))
    piece.rank = 2;
  return normalizePhotosyntheticRank(piece);
}

export function registerDiscoveries(state, piece) {
  const added = recordHistoricalTraits(state, piece);
  if (!added.length) return added;
  for (const trait of added)
    recordDiscovery(state, "mutations", trait);
  return added;
}

const ORTHOGONAL = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function connectedOpenFraction(blocked) {
  const open = Array.from({ length: 64 }, (_, cell) => cell).filter(
    (cell) => !blocked.has(cell),
  );
  if (!open.length) return 0;
  const seen = new Set([open[0]]),
    queue = [open[0]];
  while (queue.length) {
    const cell = queue.shift(),
      r = Math.floor(cell / 8),
      c = cell % 8;
    for (const [dr, dc] of ORTHOGONAL) {
      const rr = r + dr,
        cc = c + dc,
        next = square(rr, cc);
      if (
        inside(rr, cc) &&
        !blocked.has(next) &&
        !seen.has(next)
      ) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size / open.length;
}

function seedNaturalBarriers(state) {
  const [min = 0, max = min] =
      habitatProfile(state).naturalBarriers ?? [0, 0],
    target = min + Math.floor(random(state) * (max - min + 1)),
    protectedCells = new Set(),
    founders = [
      ...state.pieces.map((piece) => ({ r: piece.r, c: piece.c })),
      ...(state.origin ? [{ r: state.origin.r, c: state.origin.c }] : []),
    ];
  for (const founder of founders)
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const r = founder.r + dr,
          c = founder.c + dc;
        if (inside(r, c)) protectedCells.add(square(r, c));
      }
  const barriers = new Set(),
    all = Array.from({ length: 64 }, (_, cell) => cell).filter(
      (cell) => !protectedCells.has(cell),
    );
  let attempts = 0;
  while (barriers.size < target && attempts++ < 256) {
    const clustered =
        barriers.size > 0 && random(state) < 0.72
          ? all.filter((cell) => {
              const r = Math.floor(cell / 8),
                c = cell % 8;
              return [...barriers].some((other) => {
                const rr = Math.floor(other / 8),
                  cc = other % 8;
                return Math.max(Math.abs(r - rr), Math.abs(c - cc)) === 1;
              });
            })
          : [],
      pool = (clustered.length ? clustered : all).filter(
        (cell) => !barriers.has(cell),
      ),
      cell = pick(state, pool);
    if (cell === null) break;
    const proposed = new Set(barriers);
    proposed.add(cell);
    if (connectedOpenFraction(proposed) < 0.8) continue;
    barriers.add(cell);
  }
  state.naturalBarriers = [...barriers].sort((a, b) => a - b);
}

function habitatCount(state, value) {
  if (!Array.isArray(value)) return value ?? 0;
  const [min = 0, max = min] = value;
  return min + Math.floor(random(state) * (max - min + 1));
}

function clusteredSelection(state, candidates, count, groups = 3) {
  const pool = new Set(candidates),
    selected = [];
  for (const seed of shuffle(state, candidates).slice(0, Math.min(groups, count))) {
    if (!pool.has(seed)) continue;
    selected.push(seed);
    pool.delete(seed);
  }
  while (selected.length < count && pool.size) {
    const frontier = [...pool].filter((cell) => {
      const r = Math.floor(cell / 8),
        c = cell % 8;
      return selected.some((other) => {
        const rr = Math.floor(other / 8),
          cc = other % 8;
        return Math.max(Math.abs(r - rr), Math.abs(c - cc)) === 1;
      });
    });
    const cell = pick(state, frontier.length ? frontier : [...pool]);
    if (cell === null) break;
    selected.push(cell);
    pool.delete(cell);
  }
  return selected;
}

function habitatSelection(state, candidates, count, pattern, type) {
  if (!count || !candidates.length) return [];
  const limited = Math.min(count, candidates.length);
  if (pattern === "corridors") {
    const horizontal = random(state) < 0.5,
      axes = random(state) < 0.5 ? [2, 5] : [1, 6],
      score = (cell) => {
        const r = Math.floor(cell / 8),
          c = cell % 8,
          coordinate = horizontal ? r : c,
          distanceToCorridor = Math.min(...axes.map((axis) => Math.abs(coordinate - axis)));
        return type === "fertile" ? distanceToCorridor : -distanceToCorridor;
      };
    return shuffle(state, candidates)
      .sort((a, b) => score(a) - score(b))
      .slice(0, limited);
  }
  if (pattern === "islands")
    return clusteredSelection(state, candidates, limited, type === "fertile" ? 3 : 2);
  if (pattern === "forest" || pattern === "dense" || pattern === "clusters")
    return clusteredSelection(state, candidates, limited, type === "fertile" ? 4 : 3);
  if (pattern === "arid")
    return clusteredSelection(state, candidates, limited, type === "fertile" ? 2 : 4);
  if (pattern === "fragmented")
    return clusteredSelection(state, candidates, limited, 5);
  return shuffle(state, candidates).slice(0, limited);
}

function seedStandardHabitat(state, profile, founderCells) {
  const empty = shuffle(
    state,
    Array.from({ length: 64 }, (_, i) => i).filter(
      (i) => !founderCells.has(i) && !state.naturalBarriers.includes(i),
    ),
  );
  for (const i of empty.slice(0, profile.fertile)) state.board[i] = "fertile";
  const safe = new Set([3, 4, 11, 12, 51, 52, 59, 60]);
  for (const i of empty
    .filter((i) => !safe.has(i) && state.board[i] === "neutral")
    .slice(0, profile.hostile))
    state.board[i] = "hostile";
  for (const c of [3, 4]) {
    for (let r = 1; r <= 6; r++)
      if (terrain(state, r, c) === "fertile")
        state.board[square(r, c)] = "neutral";
    for (const rows of [
      [1, 2, 3],
      [4, 5, 6],
    ]) {
      const candidates = rows.filter(
        (r) =>
          terrain(state, r, c) === "neutral" &&
          !naturalBarrierAt(state, r, c),
      );
      const fallback = rows.filter(
        (r) => !naturalBarrierAt(state, r, c),
      );
      const chosen = pick(
        state,
        candidates.length ? candidates : fallback,
      );
      if (chosen !== null) state.board[square(chosen, c)] = "fertile";
    }
  }
  const mobileFounder = state.pieces.some(
    (piece) =>
      has(piece, "Locomoção Primitiva"),
  );
  if (!mobileFounder)
    for (const cell of founderCells) state.board[cell] = "fertile";
}

function seedHabitat(state) {
  const profile = habitatProfile(state),
    pattern = profile.pattern ?? "mosaic";
  if (aquaticFertilityRegime(state)) {
    state.board.fill("fertile");
    return;
  }
  state.board.fill("neutral");
  const founderCells = new Set([
      ...state.pieces.map((p) => square(p.r, p.c)),
      ...(state.origin ? [square(state.origin.r, state.origin.c)] : []),
    ]);
  if (
    profile.standard &&
    (pattern === "mosaic" || pattern === "balanced")
  ) {
    seedStandardHabitat(state, profile, founderCells);
    return;
  }
  const mobileFounder = state.pieces.some(
      (piece) =>
        has(piece, "Locomoção Primitiva"),
    ),
    keepFoundersFertile = profile.founderFertile || !mobileFounder;

  if (keepFoundersFertile)
    for (const cell of founderCells) state.board[cell] = "fertile";

  const fertileTarget = habitatCount(state, profile.fertile),
    fertileNeeded = Math.max(
      0,
      fertileTarget - state.board.filter((cell) => cell === "fertile").length,
    ),
    fertileCandidates = Array.from({ length: 64 }, (_, cell) => cell).filter(
      (cell) =>
        state.board[cell] === "neutral" &&
        !state.naturalBarriers.includes(cell),
    );
  for (const cell of habitatSelection(
    state,
    fertileCandidates,
    fertileNeeded,
    pattern,
    "fertile",
  ))
    state.board[cell] = "fertile";

  const hostileTarget = habitatCount(state, profile.hostile),
    hostileCandidates = Array.from({ length: 64 }, (_, cell) => cell).filter(
      (cell) =>
        state.board[cell] === "neutral" &&
        !founderCells.has(cell) &&
        !state.naturalBarriers.includes(cell),
    );
  for (const cell of habitatSelection(
    state,
    hostileCandidates,
    hostileTarget,
    pattern,
    "hostile",
  ))
    state.board[cell] = "hostile";
}

export function createState(seed = Date.now(), options = {}) {
  const founder = options.founder ?? null,
    founders = options.founders ?? null,
    ownerFounders = options.ownerFounders ?? null,
    originPrelude = !!options.originPrelude,
    canonicalPair = !!options.canonicalPair,
    scenario = options.scenario ?? "alternative";
  const state = {
    version: 13,
    scenario,
    arenaPhase: options.arenaPhase ?? 0,
    arenaFounders: options.arenaFounders ?? null,
    rng: seed >>> 0,
    revision: 0,
    turn: 0,
    current: "blue",
    phase: originPrelude ? "origin" : "move",
    origin: null,
    chain: null,
    partner: null,
    manipulation: null,
    building: null,
    eggPlacement: null,
    domesticPlacement: null,
    socialDefense: null,
    nextId: 1,
    nextNotice: 1,
    board: Array(64).fill("neutral"),
    pieces: [],
    reproductions: { blue: 0, amber: 0 },
    notices: [],
    seen: [],
    seenMutations: [],
    historicalTraits: [
      ...new Set(["Respiração anaeróbia", ...(options.historicalTraits ?? [])]),
    ],
    fossilRecord: structuredClone(options.fossilRecord ?? []),
    discoveries: cloneDiscoveries(options.discoveries),
    logs: [],
    event: null,
    previousEvent: null,
    geologicalStage: options.geologicalStage ?? "archean",
    cycle: options.cycle ?? 1,
    totalCycles: options.totalCycles ?? 1,
    generationOffset: options.generationOffset ?? 0,
    maxGenerationReached: 0,
    nextHabitatGeneration: 3,
    nextEventGeneration: 4,
    pendingEcologicalEvents: 0,
    conwayWatchUntil: null,
    conwayStagnation: null,
    lastSuccessfulCaptureRound: 0,
    offensiveStagnation: null,
    deathSites: [],
    fertileTraces: [],
    fertilityRecovery: [],
    extremophyteFertility: [],
    diseases: [],
    nextDisease: 1,
    nextEgg: 1,
    eggs: [],
    nextPlantSeed: 1,
    plantSeeds: [],
    barriers: [],
    naturalBarriers: [],
    populationLatched: { blue: false, amber: false },
    populationDiseaseCooldownUntil: 0,
    severePopulationLatched: false,
    ecologicalDomain: createEcologicalDomain(),
    result: null,
  };
  if (originPrelude) {
    const cell = pick(state, [27, 28, 35, 36]);
    state.origin = {
      r: Math.floor(cell / 8),
      c: cell % 8,
      selected: false,
    };
  } else {
    const balancedPair =
        canonicalPair && founders?.primary && founders?.companion,
      ownerPair =
        ownerFounders?.blue?.primary &&
        ownerFounders?.blue?.companion &&
        ownerFounders?.amber?.primary &&
        ownerFounders?.amber?.companion,
      starts = balancedPair || ownerPair
        ? [
            ["blue", 7, 3, "primary"],
            ["blue", 7, 4, "companion"],
            ["amber", 0, 3, "primary"],
            ["amber", 0, 4, "companion"],
          ]
        : canonicalPair
          ? [
              ["blue", 7, 4, null],
              ["amber", 0, 4, null],
            ]
          : [
              ["blue", 7, 3, null],
              ["blue", 7, 4, null],
              ["amber", 0, 3, null],
              ["amber", 0, 4, null],
            ];
    for (const [owner, r, c, slot] of starts) {
      const source = ownerPair
        ? ownerFounders[owner][slot]
        : balancedPair
          ? founders[slot]
          : founders?.[owner] ?? founder;
      state.pieces.push(
        newPiece(
          state,
          owner,
          r,
          c,
          source
            ? {
                rank: source.rank,
                traits: source.traits,
                ancestry: source.ancestry,
                genome: source.genome,
                reproGenes: source.reproGenes,
                recessiveTraits: source.recessiveTraits,
                mutations: 0,
                generation: 0,
              }
            : {},
        ),
      );
    }
  }
  if (options.naturalBarriers !== false && !aquaticFertilityRegime(state))
    seedNaturalBarriers(state);
  seedHabitat(state);
  recordDiscovery(state, "mutations", "Respiração anaeróbia");
  if (scenario !== "arena") recordDiscovery(state, "geology", state.geologicalStage);
  log(
    state,
    originPrelude
      ? "Origem da campanha: o ancestral comum aguarda a separação das linhagens."
      : scenario === "arena"
        ? `Arena · Fase ${state.arenaPhase || state.cycle} começa com duas linhagens de cada lado.`
        : `${geologicalLabel(state)} · ${state.cycle}º Ciclo começa com um organismo de cada lado.`,
  );
  return state;
}

export function createCampaignState(
  seed = Date.now(),
  scenario = DEFAULT_SCENARIO,
) {
  return createState(seed, { originPrelude: true, scenario });
}

function earthFounderRecessives(historicalTraits, activeTraits, plant) {
  const active = new Set(activeTraits);
  return [...new Set(historicalTraits)]
    .filter(
      (trait) =>
        TRAITS[trait] &&
        !active.has(trait) &&
        trait !== "Respiração anaeróbia" &&
        (plant
          ? trait !== "Predação" && !PLANT_INCOMPATIBLE_TRAITS.has(trait)
          : trait !== "Fotossíntese" && !PLANT_DERIVED_TRAITS.has(trait)),
    )
    .slice(-2);
}

function previewFounderProfiles(stageIndex) {
  const stage = GEOLOGICAL_STAGES[stageIndex],
    curated = EARTH_FOUNDER_GENOMES[stage?.id],
    primitiveLocomotionStageIndex = GEOLOGICAL_STAGES.findIndex((entry) =>
      entry.required.includes("Locomoção Primitiva"),
    ),
    prePrimitiveLocomotion = stageIndex <= primitiveLocomotionStageIndex;
  if (curated) {
    const historicalTraits = [
      ...new Set([
        ...GEOLOGICAL_STAGES.slice(0, stageIndex).flatMap(
          (entry) => entry.required,
        ),
        ...curated.plant,
        ...curated.animal,
      ]),
    ];
    return {
      historicalTraits,
      primary: {
        rank: prePrimitiveLocomotion ? 4 : 0,
        traits: normalizeActiveTraits(curated.plant, "Fotossíntese"),
        ancestry: [...new Set(curated.plant)],
        recessiveTraits: earthFounderRecessives(
          historicalTraits,
          curated.plant,
          true,
        ),
      },
      companion: {
        rank: prePrimitiveLocomotion ? 4 : (curated.rank ?? 0),
        traits: normalizeActiveTraits(curated.animal, "Predação"),
        ancestry: [...new Set(curated.animal)],
        recessiveTraits: earthFounderRecessives(
          historicalTraits,
          curated.animal,
          false,
        ),
      },
    };
  }
  const historicalTraits = GEOLOGICAL_STAGES.slice(0, stageIndex).flatMap(
      (stage) => stage.required,
    ),
    plantTraits = [
      "Fotossíntese",
      ...historicalTraits.filter(
        (trait) =>
          trait !== "Predação" && !PLANT_INCOMPATIBLE_TRAITS.has(trait),
      ),
    ],
    animalTraits = historicalTraits.filter(
      (trait) =>
        trait !== "Fotossíntese" && !PLANT_DERIVED_TRAITS.has(trait),
    );
  if (!animalTraits.includes("Predação")) animalTraits.unshift("Predação");
  const derivedRanks = [1, 2, 3, 5],
    animalRank = prePrimitiveLocomotion
      ? 4
      : stageIndex <= 3
        ? 0
        : derivedRanks[Math.min(derivedRanks.length - 1, stageIndex - 4)];
  return {
    historicalTraits: [...new Set(historicalTraits)],
    primary: {
      rank: prePrimitiveLocomotion ? 4 : 0,
      traits: normalizeActiveTraits(plantTraits, "Fotossíntese"),
      ancestry: [...new Set(plantTraits)],
      recessiveTraits: earthFounderRecessives(
        historicalTraits,
        plantTraits,
        true,
      ),
    },
    companion: {
      rank: animalRank,
      traits: normalizeActiveTraits(animalTraits, "Predação"),
      ancestry: [...new Set(animalTraits)],
      recessiveTraits: earthFounderRecessives(
        historicalTraits,
        animalTraits,
        false,
      ),
    },
  };
}

export function createPeriodState(
  geologicalStage,
  seed = Date.now(),
  discoveries = null,
  scenario = "earth",
) {
  const stageIndex = GEOLOGICAL_STAGES.findIndex(
    (stage) => stage.id === geologicalStage,
  );
  if (stageIndex < 0) throw Error("Período geológico inválido.");
  if (stageIndex === 0)
    return createState(seed, {
      originPrelude: true,
      geologicalStage,
      cycle: 1,
      totalCycles: 1,
      discoveries,
      scenario,
    });
  const preview = previewFounderProfiles(stageIndex),
    completedCycles = GEOLOGICAL_STAGES.slice(0, stageIndex).reduce(
      (sum, stage) => sum + (stage.cycles?.length ?? 1),
      0,
    );
  return createState(seed, {
    scenario,
    geologicalStage,
    cycle: 1,
    totalCycles: completedCycles + 1,
    historicalTraits: preview.historicalTraits,
    discoveries,
    founders: { primary: preview.primary, companion: preview.companion },
    canonicalPair: true,
  });
}

export function activateOrigin(state) {
  if (state.phase !== "origin" || !state.origin)
    throw Error("Origem indisponível.");
  if (!state.origin.selected) {
    state.origin.selected = true;
    return false;
  }
  const directions = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
      [1, 0],
      [1, -1],
      [0, -1],
    ],
    primaryIndex = Math.floor(random(state) * directions.length),
    companionIndex = (primaryIndex + 1) % directions.length,
    oppositePrimaryIndex = (primaryIndex + 4) % directions.length,
    oppositeCompanionIndex = (companionIndex + 4) % directions.length,
    position = (index) => ({
      r: state.origin.r + directions[index][0],
      c: state.origin.c + directions[index][1],
    }),
    bluePlant = position(primaryIndex),
    bluePredator = position(companionIndex),
    amberPlant = position(oppositePrimaryIndex),
    amberPredator = position(oppositeCompanionIndex),
    founders = [
      ["blue", bluePlant, "Fotossíntese"],
      ["blue", bluePredator, "Predação"],
      ["amber", amberPlant, "Fotossíntese"],
      ["amber", amberPredator, "Predação"],
    ];
  for (const [owner, cell, trait] of founders) {
    state.pieces.push(
      newPiece(state, owner, cell.r, cell.c, {
        rank: 4,
        traits: [trait],
        ancestry: [trait],
      }),
    );
    state.board[square(cell.r, cell.c)] = "fertile";
  }
  state.origin = null;
  state.phase = "move";
  log(
    state,
    `${geologicalLabel(state)} · 1º Ciclo começa com a separação do ancestral comum; cada lado recebe dois Reis primordiais, um fotossintético e um predatório.`,
  );
  return true;
}
export function signature(p) {
  const ancestry = [...(p.ancestry ?? p.traits ?? [])].sort().join("|");
  return `${p.rank}|${[...p.traits].sort().join("|")}|${ancestry}|${genomeSignature(p.genome)}`;
}
export function dominantLineage(state, owner = null, predicate = null) {
  const pieces = state.pieces.filter(
      (piece) =>
        (!owner || piece.owner === owner) &&
        (!predicate || predicate(piece)),
    ),
    groups = new Map();
  for (const piece of pieces) {
    const key = signature(piece),
      group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { piece, count: 1 });
  }
  const selected = [...groups.values()].sort(
    (a, b) =>
      b.count - a.count ||
      b.piece.generation - a.piece.generation ||
      signature(a.piece).localeCompare(signature(b.piece), "pt-BR"),
  )[0];
  return selected
    ? { ...selected, total: pieces.length }
    : { piece: null, count: 0, total: pieces.length };
}
function fossilEntries(previous) {
  return ["blue", "amber"].flatMap((owner) => {
    const selected = dominantLineage(previous, owner);
    if (!selected.piece) return [];
    return [{
      geologicalStage: previous.geologicalStage,
      cycle: previous.cycle,
      owner,
      winner: previous.result?.winner === owner,
      rank: selected.piece.rank,
      traits: [...selected.piece.traits],
      ancestry: [...new Set(selected.piece.ancestry ?? selected.piece.traits)],
      genome: cloneGenome(selected.piece.genome),
      count: selected.count,
      total: selected.total,
    }];
  });
}

function founderProfile(previous, piece) {
  if (!piece) return null;
  const excluded = new Set(["Esterilidade", "Mutação Deletéria"]),
    genome = withoutGenomeTraits(piece.genome, [...excluded]),
    profile = {
      rank: piece.rank,
      traits: piece.traits.filter((trait) => !excluded.has(trait)),
      ancestry: [
        ...new Set([...(piece.ancestry ?? piece.traits ?? []), ...piece.traits]),
      ],
      genome,
    };
  return syncGenomePhenotype(profile);
}

function cleanArenaGenome(piece) {
  const excluded = new Set([
    "Respiração anaeróbia",
    "Esterilidade",
    "Mutação Deletéria",
    "Mutação Disfuncional",
  ]);
  const preferred = piece?.traits?.includes("Fotossíntese")
    ? "Fotossíntese"
    : piece?.traits?.includes("Predação")
      ? "Predação"
      : null;
  return completeArenaGenome(
    genomeCarriedTraits(piece?.genome).filter(
      (trait) => !excluded.has(trait),
    ),
    preferred,
  );
}

function arenaSurvivorEntries(state, owner) {
  const groups = new Map();
  for (const piece of state.pieces.filter((candidate) => candidate.owner === owner)) {
    const key = signature(piece),
      group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { piece, count: 1 });
  }
  const selected = [...groups.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.piece.generation - a.piece.generation ||
        signature(a.piece).localeCompare(signature(b.piece), "pt-BR"),
    )
    .slice(0, 2)
    .map(({ piece }) => ({ source: piece, genome: cleanArenaGenome(piece) }));
  const fallback = state.arenaFounders?.[owner]
    ? [
        state.arenaFounders[owner].primary,
        state.arenaFounders[owner].companion,
      ].map((source) => ({ source, genome: cleanArenaGenome(source) }))
    : [];
  for (const entry of fallback)
    if (selected.length < 2 && entry.genome.length) selected.push(entry);
  if (!selected.length)
    selected.push({
      source: { rank: 4 },
      genome: ["Multicelularismo"],
    });
  while (selected.length < 2)
    selected.push({
      source: selected[0].source,
      genome: [...selected[0].genome],
    });
  return selected.slice(0, 2);
}

export function arenaSurvivorGenomes(state, owner) {
  return arenaSurvivorEntries(state, owner).map(({ genome }) => genome);
}

function arenaProfiles(
  ownerGenomes,
  survivorEntries = null,
  seed = Date.now(),
) {
  return Object.fromEntries(
    ["blue", "amber"].map((owner, ownerIndex) => {
      const genomes = ownerGenomes[owner],
        sources = survivorEntries?.[owner] ?? [],
        profileFor = (index) => {
          const source = sources[index]?.source ?? null,
            preferred = source ? hiddenRecessiveTraits(source) : [],
            recessives = chooseArenaRecessives(
              genomes[index],
              (seed + ownerIndex * 101 + index * 17) >>> 0,
              preferred,
            );
          if (recessives.length !== ARENA_RECESSIVE_COUNT)
            throw Error(
              "Genoma da Arena não permite dois genes recessivos sem quebrar dependências.",
            );
          return arenaProfile(
            genomes[index],
            source?.rank ?? 4,
            recessives,
          );
        };
      return [
        owner,
        {
          primary: profileFor(0),
          companion: profileFor(1),
        },
      ];
    }),
  );
}

export function createArenaState(
  ownerGenomes,
  seed = Date.now(),
  discoveries = null,
) {
  const profiles = arenaProfiles(ownerGenomes, null, seed),
    historicalTraits = [
      ...new Set([
        "Respiração anaeróbia",
        ...Object.values(ownerGenomes).flat(2),
      ]),
    ];
  return createState(seed, {
    scenario: "arena",
    geologicalStage: "quaternary",
    cycle: 1,
    totalCycles: 1,
    arenaPhase: 1,
    historicalTraits,
    discoveries,
    ownerFounders: profiles,
    arenaFounders: profiles,
    naturalBarriers: true,
  });
}

export function createArenaSuccessorState(
  previous,
  ownerGenomes = null,
  seed = Date.now(),
) {
  const survivorEntries = {
      blue: arenaSurvivorEntries(previous, "blue"),
      amber: arenaSurvivorEntries(previous, "amber"),
    },
    genomes =
      ownerGenomes ?? {
        blue: survivorEntries.blue.map(({ genome }) => genome),
        amber: survivorEntries.amber.map(({ genome }) => genome),
      },
    profiles = arenaProfiles(genomes, survivorEntries, seed),
    state = createState(seed, {
      scenario: "arena",
      geologicalStage: "quaternary",
      cycle: previous.cycle + 1,
      totalCycles: previous.totalCycles + 1,
      arenaPhase: (previous.arenaPhase || previous.cycle || 1) + 1,
      generationOffset:
        previous.generationOffset + previous.maxGenerationReached + 1,
      historicalTraits: [
        ...new Set([
          ...previous.historicalTraits,
          ...Object.values(genomes).flat(2),
        ]),
      ],
      fossilRecord: [
        ...(previous.fossilRecord ?? []),
        ...fossilEntries(previous),
      ],
      discoveries: previous.discoveries,
      ownerFounders: profiles,
      arenaFounders: profiles,
      naturalBarriers: true,
    });
  log(
    state,
    `Arena · Fase ${state.arenaPhase}: sobreviventes e engenharia genética definiram os novos fundadores.`,
  );
  return state;
}

function createEarthSuccessorState(previous, seed) {
  const priorStage = currentGeologicalStage(previous),
    candidate = stageComplete(previous)
      ? nextGeologicalStage(priorStage.id)
      : priorStage,
    advanced = candidate.id !== priorStage.id,
    cycle = advanced ? 1 : previous.cycle + 1,
    totalCycles = previous.totalCycles + 1,
    stageIndex = GEOLOGICAL_STAGES.findIndex((stage) => stage.id === candidate.id),
    preview = previewFounderProfiles(stageIndex),
    state = createState(seed, {
      scenario: "earth",
      geologicalStage: candidate.id,
      cycle,
      totalCycles,
      generationOffset:
        previous.generationOffset + previous.maxGenerationReached + 1,
      historicalTraits: [
        ...new Set([...previous.historicalTraits, ...preview.historicalTraits]),
      ],
      fossilRecord: [
        ...(previous.fossilRecord ?? []),
        ...fossilEntries(previous),
      ],
      discoveries: previous.discoveries,
      founders: { primary: preview.primary, companion: preview.companion },
      canonicalPair: true,
    });
  log(
    state,
    advanced
      ? `Vida na Terra: inicia-se ${candidate.group} · ${candidate.period} com linhagens canônicas do período.`
      : `Vida na Terra: ${candidate.period} continua no ${cycle}º Ciclo com fundadores canônicos.`,
  );
  return state;
}

export function createSuccessorState(previous, seed = Date.now()) {
  if (previous.scenario === "earth")
    return createEarthSuccessorState(previous, seed);
  if (previous.scenario === "arena")
    return createArenaSuccessorState(previous, null, seed);
  const winner = previous.result?.winner ?? null,
    selected = dominantLineage(previous, winner),
    founder = founderProfile(previous, selected.piece),
    founderIsPhotosynthetic = founder?.traits.includes("Fotossíntese") ?? false,
    counterpart = dominantLineage(
      previous,
      null,
      founderIsPhotosynthetic
        ? (piece) => !piece.traits.includes("Fotossíntese")
        : (piece) => piece.traits.includes("Fotossíntese"),
    ),
    companion =
      counterpart.piece &&
      (!selected.piece ||
        signature(counterpart.piece) !== signature(selected.piece))
        ? founderProfile(previous, counterpart.piece)
        : null,
    founders =
      founder && companion
        ? { primary: founder, companion }
        : null,
    priorStage = currentGeologicalStage(previous),
    candidate = stageComplete(previous)
      ? nextGeologicalStage(priorStage.id)
      : priorStage,
    advanced = candidate.id !== priorStage.id,
    geologicalStage = candidate.id,
    cycle = advanced ? 1 : previous.cycle + 1,
    totalCycles = previous.totalCycles + 1,
    generationOffset =
      previous.generationOffset + previous.maxGenerationReached + 1;
  const state = createState(seed, {
    scenario: "alternative",
    geologicalStage,
    cycle,
    totalCycles,
    generationOffset,
    historicalTraits: previous.historicalTraits,
    fossilRecord: [
      ...(previous.fossilRecord ?? []),
      ...fossilEntries(previous),
    ],
    discoveries: previous.discoveries,
    founder,
    founders,
    canonicalPair: true,
  });
  if (companion)
    log(
      state,
      "Dupla fundadora simétrica: ambos os lados começam com uma linhagem fotossintética e uma não fotossintética, preservando a dominante e sua contraparte evolutiva.",
    );
  log(
    state,
    advanced
      ? `Transição Evolutiva: inicia-se ${candidate.group} · ${candidate.period}.`
      : `A vida persiste em ${candidate.period}; inicia-se o ${cycle}º Ciclo.`,
  );
  return state;
}
export function summary(state, owner) {
  const pieces = state.pieces.filter((p) => p.owner === owner),
    profiles = new Map(pieces.map((p) => [signature(p), p]));
  return {
    pieces: pieces.length,
    generations: state.reproductions[owner],
    mutations: [...profiles.values()].reduce((n, p) => n + p.mutations, 0),
    lineages: profiles.size,
  };
}
export function assertState(state) {
  const integer = (n, min = 0, max = Number.MAX_SAFE_INTEGER) =>
      Number.isSafeInteger(n) && n >= min && n <= max,
    validBroodProfile = (profile, owner = null) =>
      !!profile &&
      (!owner || profile.owner === owner) &&
      ["blue", "amber"].includes(profile.owner) &&
      integer(profile.rank, 0, 5) &&
      Array.isArray(profile.traits) &&
      profile.traits.every((t) => TRAITS[t]) &&
      (profile.ancestry === undefined ||
        (Array.isArray(profile.ancestry) &&
          profile.ancestry.every((t) => TRAITS[t]) &&
          new Set(profile.ancestry).size === profile.ancestry.length)) &&
      validGenome(profile.genome) &&
      integer(profile.mutations) &&
      integer(profile.generation);
  if (!state || typeof state !== "object") throw Error("Partida inválida.");
  if (
    state.ecologicalDomain !== undefined &&
    (!state.ecologicalDomain ||
      typeof state.ecologicalDomain.active !== "boolean" ||
      !Array.isArray(state.ecologicalDomain.quadrants) ||
      state.ecologicalDomain.quadrants.length !== 4 ||
      state.ecologicalDomain.quadrants.some(
        (quadrant) =>
          !quadrant ||
          ![null, "blue", "amber"].includes(quadrant.owner) ||
          !integer(quadrant.progress, 0, ECOLOGICAL_DOMAIN_REQUIRED_TURNS) ||
          typeof quadrant.consolidated !== "boolean" ||
          (quadrant.consolidated &&
            (!quadrant.owner ||
              quadrant.progress !== ECOLOGICAL_DOMAIN_REQUIRED_TURNS)),
      ))
  )
    throw Error("Domínio ecológico inválido.");
  if (
    !integer(state.revision) ||
    !integer(state.nextNotice, 1) ||
    !integer(state.nextDisease, 1) ||
    !integer(state.nextEgg, 1) ||
    !integer(state.nextPlantSeed, 1) ||
    !validScenario(state.scenario) ||
    !integer(state.arenaPhase ?? 0, 0) ||
    !GEOLOGICAL_STAGES.some((stage) => stage.id === state.geologicalStage) ||
    !integer(state.cycle, 1) ||
    !integer(state.totalCycles, 1) ||
    state.totalCycles < state.cycle ||
    !integer(state.generationOffset) ||
    !integer(state.maxGenerationReached) ||
    !integer(state.nextHabitatGeneration, 3) ||
    !integer(state.nextEventGeneration, 4) ||
    !integer(state.pendingEcologicalEvents) ||
    !(
      state.conwayWatchUntil === null ||
      integer(state.conwayWatchUntil, state.turn)
    ) ||
    !(
      state.conwayStagnation === null ||
      (integer(state.conwayStagnation?.startedTurn, 0) &&
        integer(state.conwayStagnation?.level, 0, 2))
    ) ||
    !(
      state.lastSuccessfulCaptureRound === undefined ||
      integer(state.lastSuccessfulCaptureRound, 0)
    ) ||
    !(
      state.offensiveStagnation === undefined ||
      state.offensiveStagnation === null ||
      (integer(state.offensiveStagnation?.startedRound, 0) &&
        integer(state.offensiveStagnation?.level, 0, 2))
    ) ||
    !integer(state.populationDiseaseCooldownUntil, 0) ||
    typeof state.severePopulationLatched !== "boolean" ||
    !Array.isArray(state.seen) ||
    !Array.isArray(state.seenMutations) ||
    state.seenMutations.some((m) => typeof m !== "string") ||
    !Array.isArray(state.historicalTraits) ||
    state.historicalTraits.some((trait) => !TRAITS[trait]) ||
    new Set(state.historicalTraits).size !== state.historicalTraits.length ||
    !Array.isArray(state.fossilRecord) ||
    state.fossilRecord.some(
      (entry) =>
        !entry ||
        !GEOLOGICAL_STAGES.some((stage) => stage.id === entry.geologicalStage) ||
        !integer(entry.cycle, 1) ||
        !["blue", "amber"].includes(entry.owner) ||
        typeof entry.winner !== "boolean" ||
        !integer(entry.rank, 0, 5) ||
        !Array.isArray(entry.traits) ||
        entry.traits.some((trait) => !TRAITS[trait]) ||
        !Array.isArray(entry.ancestry) ||
        entry.ancestry.some((trait) => !TRAITS[trait]) ||
        !integer(entry.count, 1) ||
        !integer(entry.total, entry.count)
    ) ||
    !validDiscoveries(state.discoveries) ||
    !Array.isArray(state.deathSites) ||
    !Array.isArray(state.fertileTraces) ||
    !Array.isArray(state.fertilityRecovery) ||
    !Array.isArray(state.extremophyteFertility) ||
    !Array.isArray(state.eggs) ||
    !Array.isArray(state.plantSeeds) ||
    !Array.isArray(state.barriers) ||
    state.barriers.some((cell) => !integer(cell, 0, 63)) ||
    new Set(state.barriers).size !== state.barriers.length ||
    !Array.isArray(state.naturalBarriers) ||
    state.naturalBarriers.some((cell) => !integer(cell, 0, 63)) ||
    new Set(state.naturalBarriers).size !== state.naturalBarriers.length ||
    state.naturalBarriers.some((cell) => state.barriers.includes(cell)) ||
    state.fertileTraces.some(
      (t) =>
        !integer(t.cell, 0, 63) ||
        !integer(t.clearAfterTurn) ||
        !["neutral", "fertile", "hostile"].includes(t.base),
    ) ||
    state.fertilityRecovery.some(
      (entry) =>
        !integer(entry.cell, 0, 63) ||
        !integer(entry.dueTurn, 0),
    ) ||
    new Set(state.fertilityRecovery.map((entry) => entry.cell)).size !==
      state.fertilityRecovery.length ||
    state.extremophyteFertility.some(
      (entry) =>
        !integer(entry.cell, 0, 63) ||
        entry.base !== "hostile",
    ) ||
    new Set(state.extremophyteFertility.map((entry) => entry.cell)).size !==
      state.extremophyteFertility.length ||
    state.deathSites.some(
      (d) =>
        !integer(d.cell, 0, 63) ||
        !integer(d.dueRound, 1) ||
        !["neutral", "fertile", "hostile"].includes(d.base),
    ) ||
    new Set(state.deathSites.map((d) => d.cell)).size !== state.deathSites.length ||
    !(
      state.eggPlacement === null ||
      (state.eggPlacement &&
        state.eggPlacement.kind === "amniote" &&
        integer(state.eggPlacement.parentId, 1) &&
        ["blue", "amber"].includes(state.eggPlacement.owner) &&
        inside(state.eggPlacement.origin?.r, state.eggPlacement.origin?.c) &&
        Array.isArray(state.eggPlacement.brood) &&
        state.eggPlacement.brood.length > 0 &&
        ["local", "spores"].includes(state.eggPlacement.dispersal))
    ) ||
    state.seen.some((s) => typeof s !== "string")
  )
    throw Error("Metadados inválidos.");
  if (
    !state.reproductions ||
    !["blue", "amber"].every(
      (o) =>
        integer(state.reproductions[o]) &&
        typeof state.populationLatched?.[o] === "boolean",
    )
  )
    throw Error("Contadores inválidos.");

  if (
    state.version !== 13 ||
    !Array.isArray(state.board) ||
    state.board.length !== 64 ||
    !state.board.every((t) => ["neutral", "fertile", "hostile"].includes(t))
  )
    throw Error("Tabuleiro inválido.");
  if (
    !["blue", "amber"].includes(state.current) ||
    !Number.isInteger(state.turn) ||
    state.turn < 0 ||
    !Number.isInteger(state.rng)
  )
    throw Error("Turno inválido.");
  if (
    ![
      "origin",
      "move",
      "partner",
      "manipulate",
      "build",
      "egg-placement",
      "domestic-placement",
      "social-defense",
      "over",
    ].includes(state.phase)
  )
    throw Error("Fase inválida.");
  if (
    state.origin !== null &&
    (!state.origin ||
      !inside(state.origin.r, state.origin.c) ||
      typeof state.origin.selected !== "boolean")
  )
    throw Error("Origem inválida.");
  if (
    (state.phase === "origin" && (!state.origin || state.pieces.length)) ||
    (state.phase !== "origin" && state.origin)
  )
    throw Error("Fase de origem inválida.");
  if (
    (state.phase === "egg-placement" && !state.eggPlacement) ||
    (state.phase !== "egg-placement" && state.eggPlacement)
  )
    throw Error("Fase de postura inválida.");
  if (
    (state.phase === "domestic-placement" && !state.domesticPlacement) ||
    (state.phase !== "domestic-placement" && state.domesticPlacement)
  )
    throw Error("Fase de domesticação inválida.");
  if (
    state.domesticPlacement &&
    (!integer(state.domesticPlacement.parentId, 1) ||
      !["blue", "amber"].includes(state.domesticPlacement.owner) ||
      !inside(
        state.domesticPlacement.origin?.r,
        state.domesticPlacement.origin?.c,
      ) ||
      !Array.isArray(state.domesticPlacement.brood) ||
      !state.domesticPlacement.brood.length ||
      !state.domesticPlacement.brood.every((profile) =>
        validBroodProfile(profile, state.domesticPlacement.owner),
      ))
  )
    throw Error("Domesticação inválida.");
  if (
    (state.phase === "social-defense" && !state.socialDefense) ||
    (state.phase !== "social-defense" && state.socialDefense)
  )
    throw Error("Fase de Sociabilidade inválida.");
  if (
    state.socialDefense &&
    (!integer(state.socialDefense.attackerId, 1) ||
      !integer(state.socialDefense.victimId, 1) ||
      !["blue", "amber"].includes(state.socialDefense.attackerOwner) ||
      !Array.isArray(state.socialDefense.memberIds) ||
      state.socialDefense.memberIds.length < 4 ||
      state.socialDefense.memberIds.some((id) => !integer(id, 1)))
  )
    throw Error("Sociabilidade inválida.");
  if (!Array.isArray(state.pieces) || state.pieces.length > 64)
    throw Error("População inválida.");
  const ids = new Set(),
    cells = new Set();
  for (const p of state.pieces) {
    if (
      !Number.isInteger(p.id) ||
      ids.has(p.id) ||
      !inside(p.r, p.c) ||
      cells.has(square(p.r, p.c)) ||
      (state.naturalBarriers.includes(square(p.r, p.c)) &&
        !p.traits?.includes("Escalador") &&
        !p.traits?.includes("Trepadeira")) ||
      (state.barriers.includes(square(p.r, p.c)) &&
        !p.traits?.includes("Trepadeira"))
    )
      throw Error("Ocupação inválida.");
    if (
      !["blue", "amber"].includes(p.owner) ||
      !Number.isInteger(p.rank) ||
      p.rank < 0 ||
      p.rank > 5 ||
      !Array.isArray(p.traits) ||
      p.traits.some((t) => !TRAITS[t]) ||
      !traitCombinationValid(p.traits) ||
      !Array.isArray(p.ancestry) ||
      p.ancestry.some((t) => !TRAITS[t]) ||
      new Set(p.ancestry).size !== p.ancestry.length ||
      !validGenome(p.genome) ||
      !Array.isArray(p.pregnancies)
    )
      throw Error("Peça inválida.");
    if (
      !integer(p.mutations) ||
      !integer(p.seeds) ||
      !integer(p.generation) ||
      !integer(p.bornRound) ||
      !integer(p.maturesRound) ||
      !integer(p.nextReproductionRound) ||
      ![1, -1].includes(p.pawnDir) ||
      (p.regenerationUsed !== undefined &&
        typeof p.regenerationUsed !== "boolean") ||
      (p.regenerationRestThroughRound !== undefined &&
        !integer(p.regenerationRestThroughRound)) ||
      (p.photosynthesisCell !== undefined &&
        !integer(p.photosynthesisCell, 0, 63)) ||
      (p.photosynthesisSinceTurn !== undefined &&
        !integer(p.photosynthesisSinceTurn)) ||
      (p.extremophyteCell !== undefined &&
        !integer(p.extremophyteCell, 0, 63)) ||
      (p.extremophyteSinceRound !== undefined &&
        !integer(p.extremophyteSinceRound)) ||
      ((p.extremophyteCell === undefined) !==
        (p.extremophyteSinceRound === undefined)) ||
      (p.extremophyteCell !== undefined &&
        p.extremophyteCell !== square(p.r, p.c)) ||
      typeof p.oothecaPrimed !== "boolean"
    )
      throw Error("Perfil inválido.");
    ids.add(p.id);
    cells.add(square(p.r, p.c));
  }
  const eggIds = new Set();
  for (const egg of state.eggs) {
    const cell = square(egg.r, egg.c);
    if (
      !integer(egg.id, 1) ||
      eggIds.has(egg.id) ||
      !["blue", "amber"].includes(egg.owner) ||
      !inside(egg.r, egg.c) ||
      cells.has(cell) ||
      !integer(egg.laidRound) ||
      !integer(egg.hatchRound, egg.laidRound + 1) ||
      !integer(egg.expireRound, egg.hatchRound) ||
      !["basal", "amniote", "ovoviviparous"].includes(egg.mode) ||
      (egg.mode === "basal" && egg.expireRound !== egg.laidRound + 6) ||
      (egg.mode !== "basal" && egg.expireRound !== egg.hatchRound) ||
      (egg.parentId !== undefined && egg.parentId !== null && !integer(egg.parentId, 1)) ||
      !["local", "spores"].includes(egg.dispersal) ||
      !Array.isArray(egg.brood) ||
      !egg.brood.length ||
      !egg.brood.every((profile) => validBroodProfile(profile, egg.owner))
    )
      throw Error("Ovo inválido.");
    eggIds.add(egg.id);
    cells.add(cell);
  }
  if (state.nextEgg <= Math.max(0, ...eggIds))
    throw Error("Identificadores de ovos inválidos.");

  const plantSeedIds = new Set(),
    plantSeedCells = new Set();
  for (const seed of state.plantSeeds) {
    const cell = square(seed.r, seed.c);
    if (
      !integer(seed.id, 1) ||
      plantSeedIds.has(seed.id) ||
      !["blue", "amber"].includes(seed.owner) ||
      !inside(seed.r, seed.c) ||
      !integer(seed.movesRemaining, 0, 3) ||
      !validBroodProfile(seed.profile, seed.owner) ||
      plantSeedCells.has(cell) ||
      ((state.barriers.includes(cell) ||
        state.naturalBarriers.includes(cell)) &&
        !seed.profile.traits.includes("Trepadeira"))
    )
      throw Error("Semente vegetal inválida.");
    plantSeedIds.add(seed.id);
    plantSeedCells.add(cell);
  }
  if (state.nextPlantSeed <= Math.max(0, ...plantSeedIds))
    throw Error("Identificadores de sementes vegetais inválidos.");
  const eggCells = new Set(state.eggs.map((egg) => square(egg.r, egg.c)));
  if (
    state.barriers.some(
      (cell) =>
        state.naturalBarriers.includes(cell) ||
        eggCells.has(cell),
    ) ||
    state.naturalBarriers.some((cell) => eggCells.has(cell)) ||
    (state.origin &&
      (state.naturalBarriers.includes(square(state.origin.r, state.origin.c)) ||
        state.barriers.includes(square(state.origin.r, state.origin.c))))
  )
    throw Error("Barreira sobreposta.");

  for (const p of state.pieces)
    for (const pregnancy of p.pregnancies)
      if (
        !integer(pregnancy.dueRound) ||
        ![undefined, "viviparous", "ovoviviparous"].includes(pregnancy.kind) ||
        (pregnancy.readyLogged !== undefined &&
          typeof pregnancy.readyLogged !== "boolean") ||
        !["local", "spores"].includes(pregnancy.dispersal) ||
        !Array.isArray(pregnancy.brood) ||
        !pregnancy.brood.length ||
        !pregnancy.brood.every((profile) =>
          validBroodProfile(profile, p.owner),
        )
      )
        throw Error("Gestação inválida.");
  if (!Number.isInteger(state.nextId) || state.nextId <= Math.max(0, ...ids))
    throw Error("Identificadores inválidos.");
  const unbornGenerations = [
    ...state.eggs.flatMap((egg) => egg.brood.map((p) => p.generation)),
    ...state.plantSeeds.map((seed) => seed.profile.generation),
    ...(state.domesticPlacement?.brood ?? []).map((p) => p.generation),
    ...state.pieces.flatMap((p) =>
      p.pregnancies.flatMap((pregnancy) =>
        pregnancy.brood.map((child) => child.generation),
      ),
    ),
  ];
  if (
    state.maxGenerationReached <
    Math.max(0, ...state.pieces.map((p) => p.generation), ...unbornGenerations)
  )
    throw Error("Geração histórica inválida.");
  if (
    state.chain &&
    !state.pieces.some((p) => p.id === state.chain && p.owner === state.current)
  )
    throw Error("Locomoção Articulada inválida.");
  if (
    state.phase === "partner" &&
    (!state.partner ||
      !state.pieces.some(
        (p) => p.id === state.partner.id && p.owner === state.current,
      ))
  )
    throw Error("Parceiro inválido.");
  if (
    state.phase === "manipulate" &&
    (!state.manipulation ||
      !state.pieces.some(
        (p) =>
          p.id === state.manipulation.id && p.owner === state.current,
      ) ||
      !integer(state.manipulation.origin, 0, 63) ||
      !["fertile", "hostile"].includes(state.manipulation.terrain) ||
      typeof state.manipulation.second !== "boolean" ||
      typeof state.manipulation.locomotion !== "boolean")
  )
    throw Error("Manipulação inválida.");
  if (state.phase !== "manipulate" && state.manipulation)
    throw Error("Manipulação fora de fase.");
  if (
    state.phase === "build" &&
    (!state.building ||
      !state.pieces.some(
        (p) => p.id === state.building.id && p.owner === state.current,
      ) ||
      typeof state.building.second !== "boolean" ||
      typeof state.building.locomotion !== "boolean")
  )
    throw Error("Construção inválida.");
  if (state.phase !== "build" && state.building)
    throw Error("Construção fora de fase.");

  if (
    !Array.isArray(state.notices) ||
    !Array.isArray(state.diseases) ||
    !Array.isArray(state.logs)
  )
    throw Error("Registro inválido.");
  if (
    state.logs.length > 160 ||
    state.logs.some((l) => !integer(l.turn) || typeof l.text !== "string") ||
    state.notices.length > 100 ||
    state.notices.some(
      (n) =>
        !integer(n.id, 1) ||
        typeof n.title !== "string" ||
        !Array.isArray(n.lines) ||
        n.lines.some((l) => typeof l !== "string"),
    )
  )
    throw Error("Mensagem inválida.");
  if (state.notices.some((n) => n.id >= state.nextNotice))
    throw Error("Sequência de avisos inválida.");
  const diseaseIds = new Set();
  for (const d of state.diseases) {
    if (
      !integer(d.id, 1) ||
      diseaseIds.has(d.id) ||
      d.id >= state.nextDisease ||
      !integer(d.startRound) ||
      !integer(d.endRound) ||
      !integer(d.delay, 2, 6) ||
      !["eco", "population", "vector"].includes(d.source) ||
      !integer(
        d.mortality,
        d.source === "vector" ? 20 : 60,
        d.source === "vector" ? 20 : 100,
      ) ||
      !integer(d.deaths) ||
      !["diagonal", "orthogonal", "omnidirectional"].includes(d.mode) ||
      !Array.isArray(d.infected) ||
      !Array.isArray(d.survivors)
    )
      throw Error("Doença inválida.");
    diseaseIds.add(d.id);
  }
  for (const p of state.pieces) {
    if (
      p.decompositionImmunity &&
      (!integer(p.decompositionImmunity.cell, 0, 63) ||
        !integer(p.decompositionImmunity.throughTurn))
    )
      throw Error("Imunidade de decomposição inválida.");
    if (
      p.infection &&
      (!diseaseIds.has(p.infection.disease) || !integer(p.infection.due))
    )
      throw Error("Infecção inválida.");
    if (
      p.venom &&
      (!integer(p.venom.remaining, 1, 2) || !integer(p.venom.infectedTurn))
    )
      throw Error("Veneno inválido.");
    if (p.traits.includes("Mutação Deletéria") && !integer(p.deleteriousDue))
      throw Error("Tempo de vida inválido.");
  }
  if (state.event) {
    const e = state.event;
    if (
      !EVENTS.some((x) => x.id === e.id) ||
      !integer(e.startRound) ||
      !Array.isArray(e.hazards) ||
      e.hazards.some((i) => !integer(i, 0, 63)) ||
      !e.snapshots ||
      Object.entries(e.snapshots).some(
        ([i, t]) =>
          !integer(Number(i), 0, 63) ||
          !["neutral", "fertile", "hostile"].includes(t),
      )
    )
      throw Error("Evento inválido.");
    if (
      (["ice", "volcano", "meteor", "grb", "warming"].includes(e.id) &&
        !integer(e.startTurn)) ||
      (e.id === "drought" && !integer(e.cap, 1, 64)) ||
      (e.id === "desert" && !integer(e.initial, 1, 64))
    )
      throw Error("Duração do evento inválida.");
  }
  if (
    (state.phase === "over" && !state.result) ||
    (state.result &&
      (!["blue", "amber", null].includes(state.result.winner) ||
        typeof state.result.reason !== "string" ||
        state.phase !== "over"))
  )
    throw Error("Resultado inválido.");

  return state;
}
