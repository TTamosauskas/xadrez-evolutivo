import {
  has,
  canPhotosynthesize,
  inside,
  square,
  TRAITS,
  EVENTS,
  PATHOGEN_AGENT_IDS,
  PATHOGEN_TRANSMISSION_IDS,
  STATE_VERSION,
} from "./constants.js";
import {
  GEOLOGICAL_STAGES,
  currentGeologicalStage,
  nextGeologicalStage,
  geologicalLabel,
  habitatProfile,
  aquaticFertilityRegime,
  aquaticTerrainCell,
  normalizeActiveTraits,
  normalizePhotosyntheticRank,
  PLANT_DERIVED_TRAITS,
  PLANT_INCOMPATIBLE_TRAITS,
  recordHistoricalTraits,
  stageComplete,
  traitCombinationValid,
  NEGATIVE_TRAITS,
  SOMATIC_NEGATIVE_TRAITS,
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
  forceGenomeTrait,
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
export const pathogenSporeAt = (state, r, c) =>
  state.pathogenSpores?.find((spore) => spore.r === r && spore.c === c);
export const fragmentAt = (state, r, c) =>
  state.fragments?.find((fragment) => fragment.r === r && fragment.c === c);
export const builtBarrierAt = (state, r, c) =>
  state.barriers?.includes(square(r, c)) ?? false;
export const naturalBarrierAt = (state, r, c) =>
  state.naturalBarriers?.includes(square(r, c)) ?? false;
export const eventBarrierAt = (state, r, c) =>
  state.event?.id === "insularization" &&
  (state.event.barriers?.includes(square(r, c)) ?? false);
export const barrierAt = (state, r, c) =>
  builtBarrierAt(state, r, c) ||
  naturalBarrierAt(state, r, c) ||
  eventBarrierAt(state, r, c);
export const terrain = (state, r, c) => state.board[square(r, c)];
export const organicResidueAt = (state, r, c) => {
  const cell = square(r, c);
  return (
    state.deathSites?.find((site) => site.cell === cell) ??
    state.fertileTraces?.find((trace) => trace.cell === cell) ??
    null
  );
};
export const fecalResidueAt = organicResidueAt;
export const carcassAt = (state, r, c) =>
  state.carcasses?.find((entry) => entry.cell === square(r, c)) ?? null;
export const captureDisturbanceAt = (state, r, c) =>
  state.captureDisturbances?.find((entry) => entry.cell === square(r, c)) ??
  null;
export const hadeanPlayableCell = (r, c) =>
  r >= 2 && r <= 5 && c >= 2 && c <= 5;
const outerBoardCell = (r, c) => r === 0 || r === 7 || c === 0 || c === 7;
export const lethalHazardAt = (state, r, c) =>
  (state.geologicalStage === "hadean" && !hadeanPlayableCell(r, c)) ||
  (state.geologicalStage === "archean" &&
    state.cycle === 1 &&
    outerBoardCell(r, c)) ||
  (state.event?.lethalHazards?.includes(square(r, c)) ?? false);
export const organicResidueHazardousTo = (piece) =>
  !!piece &&
  !canPhotosynthesize(piece) &&
  !has(piece, "Coprofagia");
export const round = (state) => Math.floor(state.turn / 2);
export const ECOLOGICAL_DOMAIN_START_TURN = 200;
export const ECOLOGICAL_DOMAIN_REQUIRED_TURNS = 3;
export const ECOLOGICAL_DOMAIN_REQUIRED_QUADRANTS = 3;
export const ecologicalQuadrant = (r, c) =>
  (r >= 4 ? 2 : 0) + (c >= 4 ? 1 : 0);
export const createEcologicalDomain = () => ({
  active: false,
  victoryOwner: null,
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
  const r = Math.floor(cell / 8),
    c = cell % 8;
  if (
    state.geologicalStage !== "hadean" &&
    aquaticTerrainCell(state, r, c)
  ) {
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
  let restored = 0;
  state.fertilityRecovery = state.fertilityRecovery.filter((entry) => {
    const r = Math.floor(entry.cell / 8),
      c = entry.cell % 8;
    if (!aquaticTerrainCell(state, r, c)) return false;
    if (entry.dueTurn > state.turn) return true;
    if (state.board[entry.cell] === "fertile") return false;
    if (
      state.board[entry.cell] !== "neutral" ||
      state.barriers?.includes(entry.cell) ||
      state.naturalBarriers?.includes(entry.cell) ||
      state.deathSites?.some((site) => site.cell === entry.cell) ||
      state.carcasses?.some((site) => site.cell === entry.cell) ||
      state.captureDisturbances?.some((item) => item.cell === entry.cell) ||
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
  if (state.geologicalStage === "hadean" && piece) return 2;
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

export function photosynthesisHasSpace(state, piece) {
  if (state.geologicalStage === "hadean")
    return !!piece && hadeanPlayableCell(piece.r, piece.c);
  let free = 0;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = piece.r + dr,
        c = piece.c + dc;
      if (
        inside(r, c) &&
        !at(state, r, c) &&
        !eggAt(state, r, c) &&
        !plantSeedAt(state, r, c) &&
        (!barrierAt(state, r, c) || has(piece, "Trepadeira"))
      ) {
        free++;
        if (free >= 2) return true;
      }
    }
  return false;
}

export function photosynthesisAvailable(state, piece) {
  return !!(
    piece &&
    canPhotosynthesize(piece) &&
    terrain(state, piece.r, piece.c) === "neutral" &&
    photosynthesisDelayTurns(state, piece) !== null &&
    photosynthesisHasSpace(state, piece)
  );
}
export const PRE_BILATERAL_SENESCENCE_AGE = 13;
export const PRE_BILATERAL_NATURAL_INFERTILITY_AGE = 16;
export const PRE_BILATERAL_MAX_NATURAL_AGE = 24;
export const SENESCENCE_AGE = 25;
export const NATURAL_INFERTILITY_AGE = 30;
export const MAX_NATURAL_AGE = 48;
export const multicellular = (piece) =>
  !!piece && (piece.traits ?? []).includes("Multicelularismo");
export const pieceAge = (state, piece) =>
  piece && Number.isInteger(piece.bornRound)
    ? Math.max(0, round(state) - piece.bornRound)
    : 0;
export const bilateralLongevity = (piece) =>
  has(piece, "Fotossíntese") || has(piece, "Simetria Bilateral");
export function naturalAgeProfile(piece) {
  return bilateralLongevity(piece)
    ? { senescence: SENESCENCE_AGE, moderate: 33, high: 41, maximum: MAX_NATURAL_AGE }
    : {
        senescence: PRE_BILATERAL_SENESCENCE_AGE,
        moderate: 17,
        high: 21,
        maximum: PRE_BILATERAL_MAX_NATURAL_AGE,
      };
}
export const senescent = (state, piece) =>
  multicellular(piece) &&
  pieceAge(state, piece) >= naturalAgeProfile(piece).senescence;
export const naturalInfertilityAge = (piece) =>
  bilateralLongevity(piece)
    ? NATURAL_INFERTILITY_AGE
    : PRE_BILATERAL_NATURAL_INFERTILITY_AGE;
export const naturallyInfertile = (state, piece) =>
  multicellular(piece) &&
  pieceAge(state, piece) >= naturalInfertilityAge(piece);
export function naturalDeathChance(state, piece) {
  if (!multicellular(piece)) return 0;
  const age = pieceAge(state, piece),
    profile = naturalAgeProfile(piece);
  if (age < profile.senescence) return 0;
  if (age < profile.moderate) return 0.05;
  if (age < profile.high) return 0.1;
  if (age < profile.maximum) return 0.2;
  return 1;
}
export function deterministicDeathNextTurn(state, piece) {
  if (!piece) return null;

  const now = round(state),
    reachesNextRound = state.turn % 2 === 1,
    regenerationAvailable =
      has(piece, "Regeneração") && !piece.regenerationUsed;

  if (piece.semelparityDeathPending) {
    const pregnancies = piece.pregnancies ?? [];
    if (!pregnancies.length) return "Semelparidade";
    if (
      reachesNextRound &&
      !ecologicalDomainBlocked(state, piece.owner, piece.r, piece.c) &&
      pregnancies.some(
        (pregnancy) =>
          pregnancy.kind !== "ovoviviparous" &&
          pregnancy.dueRound <= now + 1,
      )
    )
      return "Semelparidade";
  }

  if (
    piece.owner === state.current &&
    piece.venom &&
    piece.venom.remaining <= 1 &&
    piece.venom.infectedTurn < state.turn &&
    !regenerationAvailable
  )
    return "Veneno";

  if (!reachesNextRound) return null;

  if (
    multicellular(piece) &&
    pieceAge(state, piece) + 1 >= naturalAgeProfile(piece).maximum
  )
    return "morte natural";

  if (
    has(piece, "Mutação Letal") &&
    Number.isInteger(piece.deleteriousDue) &&
    piece.deleteriousDue <= now + 1 &&
    !regenerationAvailable
  )
    return "Mutação Letal";

  return null;
}
export const juvenile = (state, piece) =>
  multicellular(piece) &&
  Number.isInteger(piece.maturesRound) &&
  round(state) < piece.maturesRound;
export const reproductionReady = (state, piece) =>
  !!piece &&
  has(piece, "Respiração anaeróbia") &&
  !juvenile(state, piece) &&
  !naturallyInfertile(state, piece) &&
  !has(piece, "Esterilidade") &&
  (!has(piece, "Filho único") || (piece.lifetimeOffspring ?? 0) < 1) &&
  !(piece.pregnancies ?? []).some(
    (pregnancy) => pregnancy.kind === "ovoviviparous",
  ) &&
  round(state) >= (piece.nextReproductionRound ?? 0);
export function log(state, text) {
  state.logs.unshift({ turn: state.turn, text });
  state.logs.length = Math.min(state.logs.length, 160);
}
export function emitPassiveEffect(
  state,
  trait,
  text,
  { pieceId = null, outcome = null, value = null, theme = null } = {},
) {
  if (!TRAITS[trait] || typeof text !== "string" || !text) return;
  const effect = {
    id: state.nextPassiveEffect++,
    turn: state.turn,
    trait,
    pieceId: Number.isInteger(pieceId) ? pieceId : null,
    outcome: typeof outcome === "string" ? outcome : null,
    value: Number.isFinite(value) ? value : null,
    text,
  };
  if (typeof theme === "string") effect.theme = theme;
  state.passiveEffects.push(effect);
  if (state.passiveEffects.length > 24) state.passiveEffects.shift();
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
      parentIds: Array.isArray(source.parentIds)
        ? [...new Set(source.parentIds)]
        : source.parentId
          ? [source.parentId]
          : [],
      pawnDir: owner === "blue" ? -1 : 1,
      seeds: 0,
      pregnancies: [],
      bornRound: source.bornRound ?? bornRound,
      maturesRound: source.maturesRound ?? bornRound,
      nextReproductionRound: source.nextReproductionRound ?? bornRound,
      oothecaPrimed: source.oothecaPrimed ?? false,
      somaticMutations: [],
      pathogenMutationDiseases: [],
      pathogenExposureRounds: {},
      lifetimeReproductions: source.lifetimeReproductions ?? 0,
      lifetimeOffspring: source.lifetimeOffspring ?? 0,
      semelparityDeathPending: source.semelparityDeathPending ?? false,
      stationarySinceRound: source.stationarySinceRound ?? bornRound,
      budded: source.budded ?? false,
      colonyId: source.colonyId ?? null,
      paedogenesisUsed: source.paedogenesisUsed ?? false,
      pupaUntilRound: source.pupaUntilRound ?? null,
      metamorphosisUsed: source.metamorphosisUsed ?? false,
      pairedWithId: source.pairedWithId ?? null,
      biparentalGuardCharges: source.biparentalGuardCharges ?? 0,
      marsupialPouch: Array.isArray(source.marsupialPouch)
        ? structuredClone(source.marsupialPouch)
        : [],
    };
  const preferredEnergy = source.traits?.includes("Predação")
    ? "Predação"
    : source.traits?.includes("Fotossíntese")
      ? "Fotossíntese"
      : null;
  syncGenomePhenotype(piece, preferredEnergy);
  if (has(piece, "Nanismo")) piece.rank = 0;
  else if (has(piece, "Artrópode") && ![0, 1, 2, 4].includes(piece.rank))
    piece.rank = 2;
  if (has(piece, "Colônia") && piece.colonyId === null) {
    piece.colonyId = state.nextColonyId++;
    state.colonyCooldowns[piece.colonyId] ??= bornRound;
  }
  return normalizePhotosyntheticRank(piece);
}

export function registerDiscoveries(state, piece) {
  rememberEnergyBranchRepresentative(state, piece);
  const added = recordHistoricalTraits(state, piece);
  if (!added.length) return added;
  for (const trait of added)
    recordDiscovery(state, "mutations", trait);
  if (
    state.scenario !== "arena" &&
    added.includes("Reprodução Sexuada") &&
    !Number.isInteger(state.sexualPathogenUnlockTotalCycle)
  )
    state.sexualPathogenUnlockTotalCycle = state.totalCycles + 1;
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
      (cell) =>
        !protectedCells.has(cell) &&
        (state.geologicalStage !== "silurian" || cell % 8 >= 4),
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

function ensureFounderFertility(state, founderCells) {
  for (const cell of founderCells) {
    const r0 = Math.floor(cell / 8),
      c0 = cell % 8,
      neighbors = [];
    let nearbyFertile = false;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const r = r0 + dr,
          c = c0 + dc;
        if (!inside(r, c)) continue;
        const next = square(r, c);
        if (terrain(state, r, c) === "fertile") nearbyFertile = true;
        if (
          terrain(state, r, c) === "neutral" &&
          !naturalBarrierAt(state, r, c)
        )
          neighbors.push(next);
      }
    if (nearbyFertile) continue;
    const chosen = pick(state, neighbors);
    if (chosen !== null) state.board[chosen] = "fertile";
    else if (!naturalBarrierAt(state, r0, c0)) state.board[cell] = "fertile";
  }
}

function seedStandardHabitat(state, profile, founderCells) {
  const empty = shuffle(
    state,
    Array.from({ length: 64 }, (_, i) => i).filter(
      (i) => !founderCells.has(i) && !state.naturalBarriers.includes(i),
    ),
  );
  for (const i of empty.slice(0, profile.fertile)) state.board[i] = "fertile";
  const safe = new Set(founderCells);
  for (const cell of founderCells) {
    const r0 = Math.floor(cell / 8),
      c0 = cell % 8;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const r = r0 + dr,
          c = c0 + dc;
        if (inside(r, c)) safe.add(square(r, c));
      }
  }
  for (const i of empty
    .filter((i) => !safe.has(i) && state.board[i] === "neutral")
    .slice(0, profile.hostile))
    state.board[i] = "hostile";
  const mobileFounder = state.pieces.some((piece) =>
    has(piece, "Locomoção Primitiva"),
  );
  if (!mobileFounder)
    for (const cell of founderCells) state.board[cell] = "fertile";
  ensureFounderFertility(state, founderCells);
}

function seedSilurianCoast(state, profile, founderCells) {
  state.board.fill("neutral");
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 3; c++) state.board[square(r, c)] = "fertile";
    if (aquaticTerrainCell(state, r, 3))
      state.board[square(r, 3)] = "fertile";
  }

  const hostileCandidates = Array.from({ length: 64 }, (_, cell) => cell).filter(
    (cell) =>
      cell % 8 >= 4 &&
      !founderCells.has(cell) &&
      !state.naturalBarriers.includes(cell),
  );
  for (const cell of habitatSelection(
    state,
    hostileCandidates,
    habitatCount(state, profile.hostile),
    "mosaic",
    "hostile",
  ))
    state.board[cell] = "hostile";
  ensureFounderFertility(state, founderCells);
}

function seedHabitat(state) {
  const profile = habitatProfile(state),
    pattern = profile.pattern ?? "mosaic";
  if (state.geologicalStage === "hadean") {
    state.board.fill("neutral");
    if (state.origin)
      state.board[square(state.origin.r, state.origin.c)] = "fertile";
    return;
  }
  if (state.geologicalStage === "archean") {
    if (state.cycle === 1) {
      state.board.fill("neutral");
      for (let r = 1; r <= 6; r++)
        for (let c = 1; c <= 6; c++)
          state.board[square(r, c)] =
            r === 1 || r === 6 || c === 1 || c === 6
              ? "hostile"
              : "fertile";
      return;
    }
    if (state.cycle === 2) {
      state.board.fill("hostile");
      for (let r = 1; r <= 6; r++)
        for (let c = 1; c <= 6; c++) state.board[square(r, c)] = "fertile";
      return;
    }
    state.board.fill("fertile");
    return;
  }
  if (aquaticFertilityRegime(state)) {
    state.board.fill("fertile");
    return;
  }
  state.board.fill("neutral");
  const founderCells = new Set([
      ...state.pieces.map((p) => square(p.r, p.c)),
      ...(state.origin ? [square(state.origin.r, state.origin.c)] : []),
    ]);
  if (pattern === "coast" && state.geologicalStage === "silurian") {
    seedSilurianCoast(state, profile, founderCells);
    return;
  }
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
  ensureFounderFertility(state, founderCells);
}

export const CANONICAL_FOUNDER_CELLS = Object.freeze([
  Object.freeze({ label: "a1", r: 7, c: 0 }),
  Object.freeze({ label: "b5", r: 3, c: 1 }),
  Object.freeze({ label: "c8", r: 0, c: 2 }),
  Object.freeze({ label: "d6", r: 2, c: 3 }),
  Object.freeze({ label: "e3", r: 5, c: 4 }),
  Object.freeze({ label: "f7", r: 1, c: 5 }),
  Object.freeze({ label: "g2", r: 6, c: 6 }),
  Object.freeze({ label: "h4", r: 4, c: 7 }),
]);

const founderNeighborCapacity = ({ r, c }) =>
  (1 + Number(r > 0) + Number(r < 7)) *
    (1 + Number(c > 0) + Number(c < 7)) -
  1;

const foundersThreatenImmediately = (a, b) => {
  const dr = Math.abs(a.r - b.r),
    dc = Math.abs(a.c - b.c);
  return (
    a.r === b.r ||
    a.c === b.c ||
    dr === dc ||
    (Math.min(dr, dc) === 1 && Math.max(dr, dc) === 2)
  );
};

function canonicalFounderLayouts() {
  const layouts = [];
  for (let a = 0; a < CANONICAL_FOUNDER_CELLS.length; a++)
    for (let b = a + 1; b < CANONICAL_FOUNDER_CELLS.length; b++) {
      const blue = [
        CANONICAL_FOUNDER_CELLS[a],
        CANONICAL_FOUNDER_CELLS[b],
      ];
      for (let c = 0; c < CANONICAL_FOUNDER_CELLS.length; c++)
        for (let d = c + 1; d < CANONICAL_FOUNDER_CELLS.length; d++) {
          if ([a, b].includes(c) || [a, b].includes(d)) continue;
          const amber = [
            CANONICAL_FOUNDER_CELLS[c],
            CANONICAL_FOUNDER_CELLS[d],
          ];
          if (
            blue.some((left) =>
              amber.some((right) => foundersThreatenImmediately(left, right)),
            )
          )
            continue;
          const blueCapacity = blue.reduce(
              (sum, cell) => sum + founderNeighborCapacity(cell),
              0,
            ),
            amberCapacity = amber.reduce(
              (sum, cell) => sum + founderNeighborCapacity(cell),
              0,
            );
          if (Math.abs(blueCapacity - amberCapacity) > 1) continue;
          layouts.push({ blue, amber });
        }
    }
  return layouts;
}

const CANONICAL_FOUNDER_LAYOUTS = Object.freeze(canonicalFounderLayouts());

export function canonicalFounderStarts(state, slots = true) {
  const layout = pick(state, CANONICAL_FOUNDER_LAYOUTS);
  if (!layout) throw Error("Posições canônicas indisponíveis.");
  const blue = shuffle(state, layout.blue),
    amber = shuffle(state, layout.amber),
    names = slots ? ["primary", "companion"] : [null, null];
  return [
    ["blue", blue[0].r, blue[0].c, names[0]],
    ["blue", blue[1].r, blue[1].c, names[1]],
    ["amber", amber[0].r, amber[0].c, names[0]],
    ["amber", amber[1].r, amber[1].c, names[1]],
  ];
}

const ARCHEAN_FOUNDER_LAYOUTS = Object.freeze({
  1: Object.freeze([
    Object.freeze({
      blue: Object.freeze([[5, 2], [5, 3]]),
      amber: Object.freeze([[2, 5], [2, 4]]),
    }),
    Object.freeze({
      blue: Object.freeze([[5, 2], [4, 2]]),
      amber: Object.freeze([[2, 5], [3, 5]]),
    }),
    Object.freeze({
      blue: Object.freeze([[5, 3], [4, 2]]),
      amber: Object.freeze([[2, 4], [3, 5]]),
    }),
  ]),
  2: Object.freeze([
    Object.freeze({
      blue: Object.freeze([[5, 2], [5, 3]]),
      amber: Object.freeze([[2, 5], [2, 4]]),
    }),
    Object.freeze({
      blue: Object.freeze([[6, 2], [5, 3]]),
      amber: Object.freeze([[1, 5], [2, 4]]),
    }),
    Object.freeze({
      blue: Object.freeze([[5, 1], [4, 2]]),
      amber: Object.freeze([[2, 6], [3, 5]]),
    }),
  ]),
  3: Object.freeze([
    Object.freeze({
      blue: Object.freeze([[6, 2], [5, 3]]),
      amber: Object.freeze([[1, 5], [2, 4]]),
    }),
    Object.freeze({
      blue: Object.freeze([[6, 1], [5, 3]]),
      amber: Object.freeze([[1, 6], [2, 4]]),
    }),
    Object.freeze({
      blue: Object.freeze([[6, 3], [5, 1]]),
      amber: Object.freeze([[1, 4], [2, 6]]),
    }),
  ]),
});

function archeanFounderStarts(state, cycle = 1) {
  const band = cycle <= 1 ? 1 : cycle === 2 ? 2 : 3,
    layouts = ARCHEAN_FOUNDER_LAYOUTS[band],
    layout = state ? pick(state, layouts) : layouts[0],
    reverseSlots = state ? pick(state, [false, true]) : false,
    blue = reverseSlots ? [...layout.blue].reverse() : layout.blue,
    amber = reverseSlots ? [...layout.amber].reverse() : layout.amber;
  return [
    ["blue", blue[0][0], blue[0][1], "primary"],
    ["blue", blue[1][0], blue[1][1], "companion"],
    ["amber", amber[0][0], amber[0][1], "primary"],
    ["amber", amber[1][0], amber[1][1], "companion"],
  ];
}

export function earthFounderStarts(geologicalStage, cycle = 1, state = null) {
  if (geologicalStage === "hadean")
    return [
      ["blue", 5, 2, null],
      ["amber", 2, 5, null],
    ];
  if (geologicalStage === "archean")
    return archeanFounderStarts(state, cycle);
  if (geologicalStage === "proterozoic")
    return [
      ["blue", 5, 2, "primary"],
      ["blue", 5, 3, "companion"],
      ["amber", 2, 4, "primary"],
      ["amber", 2, 5, "companion"],
    ];
  if (geologicalStage === "ediacaran")
    return [
      ["blue", 6, 2, "primary"],
      ["blue", 6, 3, "companion"],
      ["amber", 1, 4, "primary"],
      ["amber", 1, 5, "companion"],
    ];
  return null;
}

export function createState(seed = Date.now(), options = {}) {
  const founder = options.founder ?? null,
    founders = options.founders ?? null,
    ownerFounders = options.ownerFounders ?? null,
    originPrelude = !!options.originPrelude,
    canonicalPair = !!options.canonicalPair,
    scenario = options.scenario ?? "alternative",
    geologicalStage = options.geologicalStage ?? "archean",
    totalCycles = options.totalCycles ?? 1,
    historicalTraits = [
      ...new Set([
        "Respiração anaeróbia",
        ...(options.historicalTraits ?? []),
      ]),
    ],
    stageIndex = GEOLOGICAL_STAGES.findIndex(
      (stage) => stage.id === geologicalStage,
    ),
    proterozoicIndex = GEOLOGICAL_STAGES.findIndex(
      (stage) => stage.id === "proterozoic",
    ),
    inferredSexualPathogenUnlock =
      scenario !== "arena" &&
      historicalTraits.includes("Reprodução Sexuada")
        ? stageIndex > proterozoicIndex
          ? totalCycles
          : stageIndex === proterozoicIndex
            ? totalCycles + 1
            : null
        : null;
  const state = {
    version: STATE_VERSION,
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
    nextPassiveEffect: 1,
    board: Array(64).fill("neutral"),
    pieces: [],
    reproductions: { blue: 0, amber: 0 },
    notices: [],
    passiveEffects: [],
    seen: [...new Set(options.seen ?? [])],
    seenMutations:
      originPrelude && (options.geologicalStage ?? "archean") === "hadean"
        ? ["Respiração anaeróbia"]
        : [],
    historicalTraits,
    cyclePositiveInnovations: [
      ...new Set(options.cyclePositiveInnovations ?? []),
    ],
    openingMutationSatisfied: {
      blue: options.openingMutationSatisfied?.blue === true,
      amber: options.openingMutationSatisfied?.amber === true,
    },
    energyBranchRepresentatives: {
      Fotossíntese: options.energyBranchRepresentatives?.Fotossíntese
        ? structuredClone(options.energyBranchRepresentatives.Fotossíntese)
        : null,
      Predação: options.energyBranchRepresentatives?.Predação
        ? structuredClone(options.energyBranchRepresentatives.Predação)
        : null,
    },
    cyclePathogenProfile: options.cyclePathogenProfile
      ? { ...options.cyclePathogenProfile }
      : null,
    fossilRecord: structuredClone(options.fossilRecord ?? []),
    discoveries: cloneDiscoveries(options.discoveries),
    logs: [],
    event: null,
    previousEvent: null,
    geologicalStage,
    cycle: options.cycle ?? 1,
    totalCycles,
    sexualPathogenUnlockTotalCycle:
      options.sexualPathogenUnlockTotalCycle ??
      inferredSexualPathogenUnlock,
    hadeanTutorial:
      options.geologicalStage === "hadean"
        ? {
            moved: false,
            divided: false,
            captured: false,
            ...(options.hadeanTutorial ?? {}),
          }
        : null,
    hadeanCaptureUnlocked: options.hadeanCaptureUnlocked ?? false,
    hadeanPredationGranted:
      options.geologicalStage === "hadean"
        ? {
            blue:
              options.hadeanPredationGranted?.blue === true ||
              options.hadeanCaptureUnlocked === true,
            amber:
              options.hadeanPredationGranted?.amber === true ||
              options.hadeanCaptureUnlocked === true,
          }
        : null,
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
    carcasses: [],
    captureDisturbances: [],
    fertilityRecovery: [],
    extremophyteFertility: [],
    diseases: [],
    nextDisease: 1,
    nextPathogenSpore: 1,
    pathogenSpores: [],
    nextEgg: 1,
    eggs: [],
    nextPlantSeed: 1,
    plantSeeds: [],
    nextFragment: 1,
    fragments: [],
    nextColonyId: 1,
    colonyCooldowns: {},
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
      traits: ["Respiração anaeróbia"],
      ancestry: ["Respiração anaeróbia"],
    };
  } else {
    const balancedPair =
        canonicalPair && founders?.primary && founders?.companion,
      ownerPair =
        ownerFounders?.blue?.primary &&
        ownerFounders?.blue?.companion &&
        ownerFounders?.amber?.primary &&
        ownerFounders?.amber?.companion,
      earthStarts =
        state.geologicalStage === "hadean" && scenario !== "arena"
          ? earthFounderStarts(state.geologicalStage, state.cycle, state)
          : state.geologicalStage === "archean" &&
              scenario !== "arena" &&
              (balancedPair || ownerPair || !founder)
            ? earthFounderStarts(state.geologicalStage, state.cycle, state)
            : scenario === "earth" && (balancedPair || ownerPair)
              ? earthFounderStarts(state.geologicalStage, state.cycle, state)
              : null,
      starts =
        earthStarts ??
        (() => {
          const canonicalStarts = canonicalFounderStarts(
            state,
            balancedPair || ownerPair,
          );
          return canonicalPair && !balancedPair && !ownerPair
            ? [canonicalStarts[0], canonicalStarts[2]]
            : canonicalStarts;
        })();
    for (const [owner, r, c, slot] of starts) {
      const source = ownerPair
        ? ownerFounders[owner][slot]
        : balancedPair
          ? founders[slot]
          : founders?.[owner] ?? founder;
      const piece = newPiece(
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
          : state.geologicalStage === "hadean"
            ? { rank: 4 }
            : {},
      );
      state.pieces.push(piece);
      rememberEnergyBranchRepresentative(state, piece);
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
      ? "Hadeano · 1º Ciclo: o ancestral comum com ⚪ Respiração anaeróbia aguarda a separação das linhagens."
      : scenario === "arena"
        ? `Arena · Fase ${state.arenaPhase || state.cycle} começa com duas linhagens de cada lado.`
        : state.geologicalStage === "hadean"
          ? "Pré-Cambriano · Hadeano começa com dois Reis protocelulares sem Locomoção Primitiva: divida e capture quando houver contato."
          : `${geologicalLabel(state)} · ${state.cycle}º Ciclo começa com um organismo de cada lado.`,
  );
  return state;
}

export function createCampaignState(
  seed = Date.now(),
  scenario = DEFAULT_SCENARIO,
) {
  return createState(seed, {
    geologicalStage: "hadean",
    originPrelude: true,
    scenario,
  });
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
    archeanStageIndex = GEOLOGICAL_STAGES.findIndex(
      (entry) => entry.id === "archean",
    ),
    ordovicianStageIndex = GEOLOGICAL_STAGES.findIndex(
      (entry) => entry.id === "ordovician",
    ),
    cambrianStageIndex = GEOLOGICAL_STAGES.findIndex(
      (entry) => entry.id === "cambrian",
    ),
    prePrimitiveLocomotion = stageIndex <= primitiveLocomotionStageIndex;
  if (stage?.id === "archean") {
    const basal = ["Respiração anaeróbia"];
    return {
      historicalTraits: [...basal],
      primary: {
        rank: 4,
        traits: [],
        ancestry: [],
        recessiveTraits: [],
      },
      companion: {
        rank: 4,
        traits: [],
        ancestry: [],
        recessiveTraits: [],
      },
    };
  }
  if (curated) {
    const inheritedRepair =
        stageIndex > archeanStageIndex ? ["Reparo Celular"] : [],
      inheritedBilateral =
        stageIndex > GEOLOGICAL_STAGES.findIndex((entry) => entry.id === "ediacaran")
          ? ["Simetria Bilateral"]
          : [],
      curatedPlant = [...new Set([...curated.plant, ...inheritedRepair])],
      curatedAnimal = [
        ...new Set([
          ...curated.animal,
          ...inheritedRepair,
          ...inheritedBilateral,
        ]),
      ],
      historicalTraits = [
        ...new Set([
          ...GEOLOGICAL_STAGES.slice(0, stageIndex).flatMap(
            (entry) => entry.required,
          ),
          ...curatedPlant,
          ...curatedAnimal,
        ]),
      ];
    return {
      historicalTraits,
      primary: {
        rank: prePrimitiveLocomotion ? 4 : 0,
        traits: normalizeActiveTraits(curatedPlant, "Fotossíntese"),
        ancestry: [...new Set(curatedPlant)],
        recessiveTraits: earthFounderRecessives(
          historicalTraits,
          curatedPlant,
          true,
        ),
      },
      companion: {
        rank: prePrimitiveLocomotion ? 4 : (curated.rank ?? 0),
        traits: normalizeActiveTraits(curatedAnimal, "Predação"),
        ancestry: [...new Set(curatedAnimal)],
        recessiveTraits: earthFounderRecessives(
          historicalTraits,
          curatedAnimal,
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
      : stageIndex <= cambrianStageIndex
        ? 0
        : derivedRanks[
            Math.min(
              derivedRanks.length - 1,
              Math.max(0, stageIndex - ordovicianStageIndex),
            )
          ];
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
  if (geologicalStage === "hadean")
    return createState(seed, {
      geologicalStage,
      cycle: 1,
      totalCycles: 1,
      discoveries,
      originPrelude: true,
      scenario,
    });
  const preview = previewFounderProfiles(stageIndex),
    completedCycles = GEOLOGICAL_STAGES.slice(0, stageIndex)
      .filter((stage) => stage.id !== "hadean")
      .reduce(
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

export function createPassiveToastTestState(
  seed = Date.now(),
  discoveries = null,
) {
  const state = createState(seed, {
      scenario: "alternative",
      geologicalStage: "quaternary",
      naturalBarriers: false,
      discoveries,
    }),
    baseAnimal = [
      "Reparo Celular",
      "Multicelularismo",
      "Predação",
      "Ingestão",
      "Simetria Bilateral",
      "Vertebrado",
      "Locomoção Primitiva",
      "Locomoção Articulada",
      "Locomoção Terrestre",
    ],
    older = (traits = [], rank = 4) => ({
      rank,
      traits: [...new Set([...baseAnimal, ...traits])],
      bornRound: 0,
      maturesRound: 0,
      nextReproductionRound: 0,
    }),
    add = (role, owner, r, c, source) => {
      const piece = newPiece(state, owner, r, c, source);
      piece.toastTestRole = role;
      state.pieces.push(piece);
      return piece;
    };

  state.turn = 12;
  state.current = "blue";
  state.phase = "move";
  state.result = null;
  state.chain = null;
  state.partner = null;
  state.manipulation = null;
  state.building = null;
  state.eggPlacement = null;
  state.domesticPlacement = null;
  state.socialDefense = null;
  state.pieces = [];
  state.nextId = 1;
  state.board.fill("neutral");
  state.naturalBarriers = [];
  state.barriers = [];
  state.notices = [];
  state.passiveEffects = [];
  state.nextPassiveEffect = 1;
  state.logs = [];
  state.maxGenerationReached = 0;

  const ovulationParent = add(
      "ovulation-parent",
      "blue",
      7,
      0,
      older([
        "Reprodução Sexuada",
        "Herbívoro",
        "Ovíparo",
        "Ovíparos Amniotas",
        "Vivíparo",
        "Ovulação Induzida",
      ]),
    ),
    ovulationMate = add(
      "ovulation-mate",
      "blue",
      7,
      1,
      older([
        "Reprodução Sexuada",
        "Ovíparo",
        "Ovíparos Amniotas",
        "Vivíparo",
      ]),
    );

  add(
    "fangs-attacker",
    "amber",
    0,
    0,
    older(["Carnívoro", "Presas"]),
  );
  add(
    "thick-skin-defender",
    "blue",
    1,
    0,
    older(["Herbívoro", "Pele grossa"]),
  );

  add(
    "night-vision-attacker",
    "blue",
    3,
    2,
    older(["Notívago", "Visão Noturna"]),
  );
  add(
    "nocturnal-defender",
    "amber",
    3,
    3,
    older(["Notívago"]),
  );

  add(
    "carapace-attacker",
    "amber",
    4,
    7,
    older(["Carapaça"]),
  );
  add(
    "horn-defender",
    "blue",
    5,
    7,
    older(["Chifre"]),
  );

  add(
    "binocular-attacker",
    "blue",
    2,
    0,
    older(["Percepção Espacial", "Visão Binocular"], 3),
  );
  add(
    "camouflage-defender",
    "amber",
    2,
    4,
    older(["Camuflagem"]),
  );

  add(
    "biparental-guard-attacker",
    "amber",
    5,
    2,
    older([], 4),
  );
  const juvenile = add(
    "biparental-guard-child",
    "blue",
    5,
    3,
    {
      ...older([], 4),
      bornRound: round(state),
      maturesRound: round(state) + 3,
      biparentalGuardCharges: 1,
    },
  );

  state.board[square(ovulationParent.r, ovulationParent.c)] = "fertile";
  state.board[square(ovulationMate.r, ovulationMate.c)] = "fertile";
  state.toastTest = {
    step: 1,
    roles: Object.fromEntries(
      state.pieces.map((piece) => [piece.toastTestRole, piece.id]),
    ),
  };
  log(
    state,
    "🧪 Fase teste de toasts: siga as seis ações indicadas no Menu; todas foram preparadas para produzir feedback passivo sem depender de sorte.",
  );
  juvenile.stationarySinceRound = round(state);
  return assertState(state);
}

export function hadeanHabitatSaturated(state) {
  if (state?.geologicalStage !== "hadean") return false;
  for (let r = 2; r <= 5; r++)
    for (let c = 2; c <= 5; c++)
      if (!at(state, r, c)) return false;
  return true;
}

export function grantHadeanPredation(state, owner) {
  if (
    state?.geologicalStage !== "hadean" ||
    !["blue", "amber"].includes(owner)
  )
    return null;
  const candidates = state.pieces
    .filter(
      (piece) =>
        piece.owner === owner &&
        !has(piece, "Predação"),
    )
    .sort((a, b) => a.id - b.id);
  const piece =
    candidates.find((candidate) => canPhotosynthesize(candidate)) ??
    candidates[0] ??
    null;
  if (!piece) return null;

  piece.genome = forceGenomeTrait(
    piece.genome,
    "Predação",
    "dominant",
  );
  syncGenomePhenotype(piece, "Predação");
  piece.ancestry = [
    ...new Set([
      ...(piece.ancestry ?? []),
      "Fotossíntese",
      "Predação",
      ...piece.traits,
    ]),
  ];
  piece.mutations = (piece.mutations ?? 0) + 1;
  delete piece.photosynthesisCell;
  delete piece.photosynthesisSinceTurn;
  return piece;
}

export function activateOrigin(state) {
  if (state.phase !== "origin" || !state.origin)
    throw Error("Hadeano indisponível.");
  if (!state.origin.selected) {
    state.origin.selected = true;
    return false;
  }

  const center = { r: state.origin.r, c: state.origin.c },
    blueCell = {
      r: Math.min(5, center.r + 1),
      c: center.c,
    },
    amberCell = {
      r: Math.max(2, center.r - 1),
      c: center.c,
    },
    source = {
      rank: 4,
      mutations: 1,
      traits: ["Fotossíntese"],
      ancestry: ["Respiração anaeróbia", "Fotossíntese"],
    },
    blue = newPiece(state, "blue", blueCell.r, blueCell.c, source),
    amber = newPiece(state, "amber", amberCell.r, amberCell.c, source);

  state.pieces.push(blue, amber);
  state.board[square(center.r, center.c)] = "neutral";
  for (const piece of [blue, amber]) {
    const cell = square(piece.r, piece.c);
    state.board[cell] = "neutral";
    piece.photosynthesisCell = cell;
    piece.photosynthesisSinceTurn = state.turn;
  }
  state.origin = null;
  state.phase = "move";
  state.current = "blue";
  state.hadeanTutorial.divided = true;
  notice(
    state,
    "Fotossíntese",
    [
      "As novas células precisam de tempo para acumular recursos e tornar a própria casa fértil.",
      "Passe a Vez enquanto a casa estiver neutra. Quando ela ficar verde, poderá Vivificar.",
    ],
    "hadean-photosynthesis-wait",
  );
  log(
    state,
    `${geologicalLabel(state)} · 1º Ciclo: o ancestral com ⚪ Respiração anaeróbia consumiu o nicho primordial e se dividiu em dois Reis com 🟢 Fotossíntese, agora sobre casas neutras.`,
  );
  return true;
}

const lineagePositiveTraits = (piece) =>
  (piece?.traits ?? []).filter(
    (trait) => trait !== "Respiração anaeróbia" && !NEGATIVE_TRAITS.has(trait),
  ).length;

const lineagePositiveGenome = (piece) =>
  new Set(
    genomeCarriedTraits(piece?.genome).filter(
      (trait) => trait !== "Respiração anaeróbia" && !NEGATIVE_TRAITS.has(trait),
    ),
  ).size;

const lineagePositiveAncestry = (piece) =>
  new Set(
    (piece?.ancestry ?? piece?.traits ?? []).filter(
      (trait) => trait !== "Respiração anaeróbia" && !NEGATIVE_TRAITS.has(trait),
    ),
  ).size;

function compareLineageStrength(a, b) {
  return (
    lineagePositiveTraits(b) - lineagePositiveTraits(a) ||
    lineagePositiveGenome(b) - lineagePositiveGenome(a) ||
    lineagePositiveAncestry(b) - lineagePositiveAncestry(a) ||
    (b?.generation ?? 0) - (a?.generation ?? 0)
  );
}

function energyRepresentativeSnapshot(piece) {
  if (!piece) return null;
  return {
    rank: piece.rank,
    traits: [...piece.traits],
    ancestry: [...new Set(piece.ancestry ?? piece.traits)],
    genome: cloneGenome(piece.genome),
    mutations: piece.mutations ?? 0,
    generation: piece.generation ?? 0,
  };
}

export function rememberEnergyBranchRepresentative(state, piece) {
  if (!state?.energyBranchRepresentatives || !piece) return false;
  let changed = false;
  for (const branch of ["Fotossíntese", "Predação"]) {
    if (!(piece.traits ?? []).includes(branch)) continue;
    const current = state.energyBranchRepresentatives[branch];
    if (!current || compareLineageStrength(piece, current) < 0) {
      state.energyBranchRepresentatives[branch] =
        energyRepresentativeSnapshot(piece);
      changed = true;
    }
  }
  return changed;
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
      compareLineageStrength(a.piece, b.piece) ||
      b.count - a.count ||
      signature(a.piece).localeCompare(signature(b.piece), "pt-BR"),
  )[0];
  if (selected) return { ...selected, total: pieces.length };
  const extinctionFounder = state.result?.extinctionFounder;
  if (
    extinctionFounder &&
    (!owner || extinctionFounder.owner === owner) &&
    (!predicate || predicate(extinctionFounder))
  )
    return { piece: extinctionFounder, count: 1, total: 1 };
  return { piece: null, count: 0, total: pieces.length };
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
  const excluded = new Set(["Esterilidade", "Mutação Letal"]),
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
    "Mutação Letal",
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
  const extinctionFounder =
      state.result?.extinctionFounder?.owner === owner
        ? state.result.extinctionFounder
        : null;
  if (extinctionFounder)
    selected.unshift({
      source: extinctionFounder,
      genome: cleanArenaGenome(extinctionFounder),
    });
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
      seen: previous.seen,
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

function archeanBranchFallback(branch) {
  return {
    rank: 4,
    traits: [branch],
    ancestry: [branch],
  };
}

function earthBranchFounder(previous, branch, fallback) {
  const living = dominantLineage(
      previous,
      null,
      (piece) => piece.traits?.includes(branch),
    ).piece,
    remembered = previous.energyBranchRepresentatives?.[branch] ?? null,
    source =
      living && remembered
        ? compareLineageStrength(living, remembered) <= 0
          ? living
          : remembered
        : living ?? remembered;
  return founderProfile(previous, source) ?? fallback;
}

function createEarthSuccessorState(previous, seed) {
  const priorStage = currentGeologicalStage(previous),
    candidate = stageComplete(previous)
      ? nextGeologicalStage(priorStage.id)
      : priorStage,
    advanced = candidate.id !== priorStage.id,
    cycle = advanced ? 1 : previous.cycle + 1,
    totalCycles =
      priorStage.id === "hadean"
        ? 1
        : previous.totalCycles + 1,
    stageIndex = GEOLOGICAL_STAGES.findIndex((stage) => stage.id === candidate.id),
    preview = previewFounderProfiles(stageIndex),
    preserveBranches = priorStage.id !== "hadean",
    primaryFallback =
      priorStage.id === "archean" && !preview.primary.traits.includes("Fotossíntese")
        ? archeanBranchFallback("Fotossíntese")
        : preview.primary,
    companionFallback =
      priorStage.id === "archean" && !preview.companion.traits.includes("Predação")
        ? archeanBranchFallback("Predação")
        : preview.companion,
    extinctionFounder = founderProfile(
      previous,
      previous.result?.extinctionFounder,
    ),
    extinctionFounderIsPhotosynthetic =
      extinctionFounder ? canPhotosynthesize(extinctionFounder) : false,
    founders = extinctionFounder
      ? extinctionFounderIsPhotosynthetic
        ? {
            primary: extinctionFounder,
            companion: preserveBranches
              ? earthBranchFounder(
                  previous,
                  "Predação",
                  companionFallback,
                )
              : preview.companion,
          }
        : {
            primary: preserveBranches
              ? earthBranchFounder(
                  previous,
                  "Fotossíntese",
                  primaryFallback,
                )
              : preview.primary,
            companion: extinctionFounder,
          }
      : preserveBranches
        ? {
            primary: earthBranchFounder(
              previous,
              "Fotossíntese",
              primaryFallback,
            ),
            companion: earthBranchFounder(
              previous,
              "Predação",
              companionFallback,
            ),
          }
        : { primary: preview.primary, companion: preview.companion },
    state = createState(seed, {
      scenario: "earth",
      geologicalStage: candidate.id,
      cycle,
      totalCycles,
      generationOffset:
        previous.generationOffset + previous.maxGenerationReached + 1,
      historicalTraits: [
        ...new Set([
          ...previous.historicalTraits,
          ...preview.historicalTraits,
          ...(priorStage.id === "archean"
            ? ["Fotossíntese", "Predação"]
            : []),
        ]),
      ],
      fossilRecord: [
        ...(previous.fossilRecord ?? []),
        ...fossilEntries(previous),
      ],
      discoveries: previous.discoveries,
      seen: previous.seen,
      sexualPathogenUnlockTotalCycle:
        previous.sexualPathogenUnlockTotalCycle ?? null,
      founders,
      canonicalPair: true,
    });
  log(
    state,
    extinctionFounder
      ? advanced
        ? `Vida na Terra: inicia-se ${candidate.group} · ${candidate.period}; a última linhagem extinta vencedora funda a nova geração ao lado da contraparte histórica.`
        : `Vida na Terra: ${candidate.period} continua no ${cycle}º Ciclo; a última linhagem extinta vencedora funda a nova geração ao lado da contraparte histórica.`
      : priorStage.id === "archean" && !advanced
        ? `Vida na Terra: Arqueano continua no ${cycle}º Ciclo preservando as linhagens fotossintética e predatória mais derivadas.`
        : advanced
          ? `Vida na Terra: inicia-se ${candidate.group} · ${candidate.period} preservando as linhagens evolutivas dos ramos fundamentais.`
          : `Vida na Terra: ${candidate.period} continua no ${cycle}º Ciclo com os ramos mais derivados como fundadores.`,
  );
  return state;
}

export function createSuccessorState(previous, seed = Date.now()) {
  if (previous.scenario === "earth")
    return createEarthSuccessorState(previous, seed);
  if (previous.scenario === "arena")
    return createArenaSuccessorState(previous, null, seed);
  if (
    currentGeologicalStage(previous).id === "hadean" &&
    stageComplete(previous)
  ) {
    const candidate = nextGeologicalStage("hadean"),
      stageIndex = GEOLOGICAL_STAGES.findIndex(
        (stage) => stage.id === candidate.id,
      ),
      preview = previewFounderProfiles(stageIndex),
      extinctionFounder = founderProfile(
        previous,
        previous.result?.extinctionFounder,
      ),
      founders = extinctionFounder
        ? {
            primary: extinctionFounder,
            companion: canPhotosynthesize(extinctionFounder)
              ? preview.companion
              : preview.primary,
          }
        : { primary: preview.primary, companion: preview.companion },
      state = createState(seed, {
        scenario: previous.scenario,
        geologicalStage: candidate.id,
        cycle: 1,
        totalCycles: 1,
        generationOffset:
          previous.generationOffset + previous.maxGenerationReached + 1,
        historicalTraits: [
          ...new Set([
            ...previous.historicalTraits,
            ...preview.historicalTraits,
          ]),
        ],
        fossilRecord: [
          ...(previous.fossilRecord ?? []),
          ...fossilEntries(previous),
        ],
        discoveries: previous.discoveries,
        seen: previous.seen,
        founders,
        canonicalPair: true,
      });
    log(
      state,
      "Transição Evolutiva: inicia-se o Arqueano · 1º Ciclo. As linhagens começam apenas com Respiração anaeróbia basal; Fotossíntese e Predação ficam abertas como caminhos metabólicos alternativos.",
    );
    return state;
  }
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
    seen: previous.seen,
    sexualPathogenUnlockTotalCycle:
      previous.sexualPathogenUnlockTotalCycle ?? null,
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
      ![null, "blue", "amber"].includes(
        state.ecologicalDomain.victoryOwner ?? null,
      ) ||
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
    !integer(state.nextPassiveEffect ?? 1, 1) ||
    !integer(state.nextDisease, 1) ||
    !integer(state.nextEgg, 1) ||
    !integer(state.nextPlantSeed, 1) ||
    !integer(state.nextFragment ?? 1, 1) ||
    !integer(state.nextColonyId ?? 1, 1) ||
    !state.colonyCooldowns ||
    typeof state.colonyCooldowns !== "object" ||
    Array.isArray(state.colonyCooldowns) ||
    Object.entries(state.colonyCooldowns).some(
      ([id, readyRound]) =>
        !/^\d+$/.test(id) || !integer(Number(id), 1) || !integer(readyRound),
    ) ||
    !validScenario(state.scenario) ||
    !integer(state.arenaPhase ?? 0, 0) ||
    !GEOLOGICAL_STAGES.some((stage) => stage.id === state.geologicalStage) ||
    !(
      state.geologicalStage === "hadean"
        ? state.hadeanTutorial &&
          typeof state.hadeanTutorial.moved === "boolean" &&
          typeof state.hadeanTutorial.divided === "boolean" &&
          typeof state.hadeanTutorial.captured === "boolean" &&
          (state.hadeanCaptureUnlocked === undefined ||
            typeof state.hadeanCaptureUnlocked === "boolean")
        : state.hadeanTutorial === null ||
          state.hadeanTutorial === undefined
    ) ||
    !integer(state.cycle, 1) ||
    !integer(state.totalCycles, 1) ||
    state.totalCycles < state.cycle ||
    !(
      state.sexualPathogenUnlockTotalCycle === null ||
      integer(state.sexualPathogenUnlockTotalCycle, 1)
    ) ||
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
    !Array.isArray(state.cyclePositiveInnovations) ||
    state.cyclePositiveInnovations.some(
      (trait) => !TRAITS[trait] || NEGATIVE_TRAITS.has(trait),
    ) ||
    new Set(state.cyclePositiveInnovations).size !==
      state.cyclePositiveInnovations.length ||
    state.cyclePositiveInnovations.length > 6 ||
    !state.openingMutationSatisfied ||
    typeof state.openingMutationSatisfied.blue !== "boolean" ||
    typeof state.openingMutationSatisfied.amber !== "boolean" ||
    !state.energyBranchRepresentatives ||
    !["Fotossíntese", "Predação"].every((branch) => {
      const profile = state.energyBranchRepresentatives[branch];
      return (
        profile === null ||
        (Number.isInteger(profile.rank) &&
          profile.rank >= 0 &&
          profile.rank <= 5 &&
          Array.isArray(profile.traits) &&
          profile.traits.includes(branch) &&
          profile.traits.every((trait) => TRAITS[trait]) &&
          traitCombinationValid(profile.traits) &&
          Array.isArray(profile.ancestry) &&
          profile.ancestry.every((trait) => TRAITS[trait]) &&
          new Set(profile.ancestry).size === profile.ancestry.length &&
          validGenome(profile.genome) &&
          integer(profile.mutations ?? 0, 0) &&
          integer(profile.generation ?? 0, 0))
      );
    }) ||
    !(
      state.cyclePathogenProfile === null ||
      (state.cyclePathogenProfile &&
        PATHOGEN_AGENT_IDS.includes(state.cyclePathogenProfile.agent) &&
        PATHOGEN_TRANSMISSION_IDS.includes(
          state.cyclePathogenProfile.transmission,
        ) &&
        ((state.cyclePathogenProfile.agent === "virus" &&
          ["contact", "sexual"].includes(
            state.cyclePathogenProfile.transmission,
          )) ||
          (state.cyclePathogenProfile.agent === "bacteria" &&
            ["trail", "fecal"].includes(
              state.cyclePathogenProfile.transmission,
            )) ||
          (state.cyclePathogenProfile.agent === "fungus" &&
            ["environmental", "spore"].includes(
              state.cyclePathogenProfile.transmission,
            ))))
    ) ||
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
    !Array.isArray(state.carcasses) ||
    !(
      state.captureDisturbances === undefined ||
      Array.isArray(state.captureDisturbances)
    ) ||
    !Array.isArray(state.fertilityRecovery) ||
    !Array.isArray(state.extremophyteFertility) ||
    !Array.isArray(state.eggs) ||
    !Array.isArray(state.plantSeeds) ||
    !Array.isArray(state.pathogenSpores) ||
    !Array.isArray(state.fragments) ||
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
        !["neutral", "fertile", "hostile"].includes(d.base) ||
        !(
          d.pathogenDiseaseIds === undefined ||
          (Array.isArray(d.pathogenDiseaseIds) &&
            d.pathogenDiseaseIds.every((id) => integer(id, 1)) &&
            new Set(d.pathogenDiseaseIds).size ===
              d.pathogenDiseaseIds.length)
        ),
    ) ||
    new Set(state.deathSites.map((d) => d.cell)).size !== state.deathSites.length ||
    state.carcasses.some(
      (entry) =>
        !integer(entry.cell, 0, 63) ||
        !integer(entry.dueRound, 1) ||
        !["neutral", "fertile", "hostile"].includes(entry.base),
    ) ||
    new Set(state.carcasses.map((entry) => entry.cell)).size !==
      state.carcasses.length ||
    (state.captureDisturbances ?? []).some(
      (entry) =>
        !integer(entry.cell, 0, 63) ||
        !integer(entry.dueRound, 1) ||
        !["neutral", "fertile", "hostile"].includes(entry.base) ||
        !(
          entry.sourceId === null ||
          entry.sourceId === undefined ||
          integer(entry.sourceId, 1)
        ),
    ) ||
    new Set((state.captureDisturbances ?? []).map((entry) => entry.cell)).size !==
      (state.captureDisturbances ?? []).length ||
    !(
      state.eggPlacement === null ||
      (state.eggPlacement &&
        state.eggPlacement.kind === "amniote" &&
        integer(state.eggPlacement.parentId, 1) &&
        ["blue", "amber"].includes(state.eggPlacement.owner) &&
        inside(state.eggPlacement.origin?.r, state.eggPlacement.origin?.c) &&
        Array.isArray(state.eggPlacement.brood) &&
        state.eggPlacement.brood.length > 0 &&
        state.eggPlacement.dispersal === "local")
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
    state.version !== STATE_VERSION ||
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
      "collapse",
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
      !Array.isArray(p.parentIds) ||
      p.parentIds.some((id) => !integer(id, 1)) ||
      new Set(p.parentIds).size !== p.parentIds.length ||
      !Array.isArray(p.pregnancies) ||
      !Array.isArray(p.somaticMutations) ||
      p.somaticMutations.some(
        (trait) => !SOMATIC_NEGATIVE_TRAITS.has(trait),
      ) ||
      new Set(p.somaticMutations).size !== p.somaticMutations.length ||
      !Array.isArray(p.pathogenMutationDiseases) ||
      p.pathogenMutationDiseases.some((id) => !integer(id, 1)) ||
      new Set(p.pathogenMutationDiseases).size !==
        p.pathogenMutationDiseases.length ||
      !p.pathogenExposureRounds ||
      typeof p.pathogenExposureRounds !== "object" ||
      Array.isArray(p.pathogenExposureRounds) ||
      Object.entries(p.pathogenExposureRounds).some(
        ([id, exposedRound]) =>
          !/^\d+$/.test(id) ||
          Number(id) < 1 ||
          !integer(exposedRound),
      )
    )
      throw Error("Peça inválida.");
    if (
      !integer(p.mutations) ||
      !integer(p.seeds) ||
      !integer(p.generation) ||
      !integer(p.bornRound) ||
      !integer(p.maturesRound) ||
      !integer(p.nextReproductionRound) ||
      !integer(p.lifetimeReproductions ?? 0, 0) ||
      !integer(p.lifetimeOffspring ?? 0, 0) ||
      typeof (p.semelparityDeathPending ?? false) !== "boolean" ||
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
      typeof p.oothecaPrimed !== "boolean" ||
      !integer(p.stationarySinceRound ?? p.bornRound, 0) ||
      typeof (p.budded ?? false) !== "boolean" ||
      !(p.colonyId === null || p.colonyId === undefined || integer(p.colonyId, 1)) ||
      typeof (p.paedogenesisUsed ?? false) !== "boolean" ||
      !(p.pupaUntilRound === null || p.pupaUntilRound === undefined || integer(p.pupaUntilRound, 0)) ||
      typeof (p.metamorphosisUsed ?? false) !== "boolean" ||
      !(p.pairedWithId === null || p.pairedWithId === undefined || integer(p.pairedWithId, 1)) ||
      !integer(p.biparentalGuardCharges ?? 0, 0) ||
      !Array.isArray(p.marsupialPouch ?? []) ||
      (p.marsupialPouch ?? []).some(
        (entry) =>
          !integer(entry.releaseRound, 0) ||
          !Array.isArray(entry.brood) ||
          !entry.brood.every((profile) => validBroodProfile(profile, p.owner)),
      )
    )
      throw Error("Perfil inválido.");
    ids.add(p.id);
    cells.add(square(p.r, p.c));
  }
  const fragmentIds = new Set();
  for (const fragment of state.fragments) {
    const cell = square(fragment.r, fragment.c);
    if (
      !integer(fragment.id, 1) ||
      fragmentIds.has(fragment.id) ||
      !["blue", "amber"].includes(fragment.owner) ||
      !inside(fragment.r, fragment.c) ||
      !integer(fragment.createdRound, 0) ||
      !integer(fragment.expireRound, fragment.createdRound) ||
      !validBroodProfile(fragment.profile, fragment.owner) ||
      cells.has(cell)
    )
      throw Error("Fragmento inválido.");
    fragmentIds.add(fragment.id);
  }
  if (state.nextFragment <= Math.max(0, ...fragmentIds))
    throw Error("Identificadores de fragmentos inválidos.");

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
      egg.dispersal !== "local" ||
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
  const pathogenSporeIds = new Set();
  for (const spore of state.pathogenSpores) {
    const disease = state.diseases.find(
      (candidate) => candidate.id === spore.diseaseId,
    );
    if (
      !integer(spore.id, 1) ||
      pathogenSporeIds.has(spore.id) ||
      !integer(spore.diseaseId, 1) ||
      !disease ||
      disease.agent !== "fungus" ||
      disease.transmission !== "spore" ||
      !inside(spore.r, spore.c) ||
      !inside(spore.targetR, spore.targetC) ||
      !integer(spore.movesRemaining, 0, 3)
    )
      throw Error("Esporo patogênico inválido.");
    pathogenSporeIds.add(spore.id);
  }
  if (state.nextPathogenSpore <= Math.max(0, ...pathogenSporeIds))
    throw Error("Identificadores de esporos patogênicos inválidos.");

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
        pregnancy.dispersal !== "local" ||
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
    ...state.fragments.map((fragment) => fragment.profile.generation),
    ...(state.domesticPlacement?.brood ?? []).map((p) => p.generation),
    ...state.pieces.flatMap((p) => [
      ...p.pregnancies.flatMap((pregnancy) =>
        pregnancy.brood.map((child) => child.generation),
      ),
      ...(p.marsupialPouch ?? []).flatMap((entry) =>
        entry.brood.map((child) => child.generation),
      ),
    ]),
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
    !Array.isArray(state.passiveEffects ?? []) ||
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
    ) ||
    (state.passiveEffects ?? []).length > 24 ||
    (state.passiveEffects ?? []).some(
      (effect) =>
        !integer(effect.id, 1) ||
        !integer(effect.turn) ||
        !TRAITS[effect.trait] ||
        ![null, "string"].includes(
          effect.outcome === null ? null : typeof effect.outcome,
        ) ||
        ![null, "number"].includes(
          effect.value === null ? null : typeof effect.value,
        ) ||
        ![null, "string"].includes(
          effect.theme == null ? null : typeof effect.theme,
        ) ||
        (effect.value !== null && !Number.isFinite(effect.value)) ||
        (effect.pieceId !== null && !integer(effect.pieceId, 1)) ||
        typeof effect.text !== "string",
    )
  )
    throw Error("Mensagem inválida.");
  if (state.notices.some((n) => n.id >= state.nextNotice))
    throw Error("Sequência de avisos inválida.");
  if (
    (state.passiveEffects ?? []).some(
      (effect) => effect.id >= (state.nextPassiveEffect ?? 1),
    )
  )
    throw Error("Sequência de efeitos passivos inválida.");
  const diseaseIds = new Set();
  for (const d of state.diseases) {
    if (
      !integer(d.id, 1) ||
      diseaseIds.has(d.id) ||
      d.id >= state.nextDisease ||
      !integer(d.startRound) ||
      !integer(d.endRound) ||
      !integer(
        d.delay,
        2,
        d.transmission === "sexual"
          ? 8
          : d.transmission === "fecal"
            ? 5
            : d.transmission === "spore"
              ? 3
              : 6,
      ) ||
      !["eco", "population", "vector"].includes(d.source) ||
      !PATHOGEN_AGENT_IDS.includes(d.agent) ||
      !PATHOGEN_TRANSMISSION_IDS.includes(d.transmission) ||
      !integer(
        d.mortality,
        d.transmission === "sexual"
          ? 15
          : d.transmission === "fecal"
            ? 30
            : d.transmission === "spore"
              ? 45
              : d.source === "vector"
                ? 20
                : 60,
        d.transmission === "sexual"
          ? 15
          : d.transmission === "fecal"
            ? 30
            : d.transmission === "spore"
              ? 45
              : d.source === "vector"
                ? 20
                : 100,
      ) ||
      !integer(d.deaths) ||
      !["diagonal", "orthogonal", "omnidirectional"].includes(d.mode) ||
      !Array.isArray(d.infected) ||
      !Array.isArray(d.survivors) ||
      !Array.isArray(d.contaminated) ||
      d.contaminated.some((cell) => !integer(cell, 0, 63)) ||
      new Set(d.contaminated).size !== d.contaminated.length
    )
      throw Error("Doença inválida.");
    diseaseIds.add(d.id);
  }
  if (
    state.deathSites.some((site) =>
      (site.pathogenDiseaseIds ?? []).some((id) => !diseaseIds.has(id)),
    )
  )
    throw Error("Referência patogênica fecal inválida.");
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
    if (has(p, "Mutação Letal") && !integer(p.deleteriousDue))
      throw Error("Tempo de vida inválido.");
  }
  if (state.event) {
    const e = state.event;
    if (
      !EVENTS.some((x) => x.id === e.id) ||
      !integer(e.startRound) ||
      !Array.isArray(e.hazards) ||
      e.hazards.some((i) => !integer(i, 0, 63)) ||
      !(
        e.lethalHazards === undefined ||
        (Array.isArray(e.lethalHazards) &&
          e.lethalHazards.every(
            (i) => integer(i, 0, 63) && e.hazards.includes(i),
          ) &&
          new Set(e.lethalHazards).size === e.lethalHazards.length)
      ) ||
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
      (e.id === "desert" && !integer(e.initial, 1, 64)) ||
      (e.id === "insularization" &&
        (!Array.isArray(e.barriers) ||
          e.barriers.length !== 6 ||
          new Set(e.barriers).size !== 6 ||
          e.barriers.some((cell) => !integer(cell, 0, 63)) ||
          !Array.isArray(e.openings) ||
          e.openings.length !== 2 ||
          new Set(e.openings).size !== 2 ||
          e.openings.some((cell) => !integer(cell, 0, 63)) ||
          e.openings.some((cell) => e.barriers.includes(cell))))
    )
      throw Error("Duração do evento inválida.");
  }
  if (
    (state.phase === "over" && !state.result) ||
    (state.result &&
      (!["blue", "amber", null].includes(state.result.winner) ||
        typeof state.result.reason !== "string" ||
        state.phase !== "over" ||
        (state.result.extinctionFounder &&
          (state.result.extinctionFounder.owner !== state.result.winner ||
            !Number.isInteger(state.result.extinctionFounder.rank) ||
            state.result.extinctionFounder.rank < 0 ||
            state.result.extinctionFounder.rank > 5 ||
            !Array.isArray(state.result.extinctionFounder.traits) ||
            state.result.extinctionFounder.traits.some(
              (trait) => !TRAITS[trait],
            ) ||
            !Array.isArray(state.result.extinctionFounder.ancestry) ||
            !validGenome(state.result.extinctionFounder.genome)))))
  )
    throw Error("Resultado inválido.");

  return state;
}
