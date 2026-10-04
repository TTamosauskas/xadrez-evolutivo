import { EVENTS, inside, square, has, distance } from "./constants.js";
import {
  at,
  eggAt,
  plantSeedAt,
  barrierAt,
  builtBarrierAt,
  naturalBarrierAt,
  pick,
  random,
  shuffle,
  round,
  log,
  notice,
  emitPassiveEffect,
  activePopulation,
  replacementPressure,
  fertilityPaused,
  stomataOpen,
  lethalHazardAt,
} from "./state.js";
import {
  eventWeights,
  habitatProfile,
  currentGeologicalStage,
  aquaticFertilityRegime,
  cellularTerrainUnlocked,
  conwayUnlocked,
  pathogenUnlocked,
} from "./geology.js";
import { movesFor } from "./moves.js";
import { recordDiscovery } from "./discoveries.js";
import { startDisease } from "./disease.js";
import { immediateEventRepeatAllowed } from "./scenarios.js";
import {
  CELLULAR_RULES,
  advanceCellularTerrain,
} from "./cellular-terrain.js";
const allCells = () => Array.from({ length: 64 }, (_, i) => i);
export const SEVERE_EVENT_IDS = new Set(["ice", "volcano", "meteor", "grb", "warming"]);
const SEVERE_HAZARD_COUNT = Math.ceil(64 * 0.95);
export const severeEventActive = (state) =>
  !!state.event && SEVERE_EVENT_IDS.has(state.event.id);

export function fertilityDepletionRate(population) {
  if (population < 24) return 0;
  return Number(
    Math.min(0.3, 0.05 + (population - 24) * 0.0125).toFixed(2),
  );
}

function depletePausedFertility(state) {
  const population = activePopulation(state),
    rate = fertilityDepletionRate(population);
  if (!rate) return 0;

  const occupied = new Set([
      ...state.pieces.map((piece) => square(piece.r, piece.c)),
      ...state.eggs.map((egg) => square(egg.r, egg.c)),
      ...state.plantSeeds
        .filter((seed) => !seed.transport)
        .map((seed) => square(seed.r, seed.c)),
    ]),
    hazards = new Set(state.event?.hazards ?? []),
    eligible = allCells().filter((cell) => {
      const r = Math.floor(cell / 8),
        col = cell % 8;
      return (
        state.board[cell] === "fertile" &&
        !occupied.has(cell) &&
        !hazards.has(cell) &&
        !barrierAt(state, r, col)
      );
    });

  if (!eligible.length) return 0;
  const expected = eligible.length * rate,
    whole = Math.floor(expected),
    count = Math.min(
      eligible.length,
      whole + (random(state) < expected - whole ? 1 : 0),
    );
  if (!count) return 0;

  for (const cell of shuffle(state, eligible).slice(0, count))
    state.board[cell] = "neutral";
  log(
    state,
    `🌾 Superpopulação esgotou ${count} casa(s) fértil(is) desocupada(s).`,
  );
  return count;
}

function weightedEvent(state, candidates, weights) {
  const total = candidates.reduce(
    (sum, event) => sum + (weights[event.id] ?? 0),
    0,
  );
  if (!candidates.length || total <= 0) return null;
  let roll = random(state) * total;
  for (const event of candidates) {
    roll -= weights[event.id] ?? 0;
    if (roll < 0) return event;
  }
  return candidates.at(-1) ?? null;
}

export function severeEventForStage(state) {
  const weights = eventWeights(state),
    severe = EVENTS.filter(
      (event) => SEVERE_EVENT_IDS.has(event.id) && (weights[event.id] ?? 0) > 0,
    ),
    fresh = immediateEventRepeatAllowed(state)
      ? severe
      : severe.filter((event) => event.id !== state.previousEvent);
  return weightedEvent(state, fresh.length ? fresh : severe, weights);
}
const fertile = (state) =>
  allCells().filter((i) => state.board[i] === "fertile");
const ORTHOGONAL = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function openFractionWithNaturalBarriers(state, naturalBarriers) {
  const blocked = new Set([...(state.barriers ?? []), ...naturalBarriers]),
    open = allCells().filter((cell) => !blocked.has(cell));
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

function removeNaturalBarriers(state, cells = null, count = Infinity) {
  const allowed = cells ? new Set(cells) : null,
    candidates = shuffle(
      state,
      state.naturalBarriers.filter((cell) => !allowed || allowed.has(cell)),
    ),
    removed = candidates.slice(0, count);
  if (!removed.length) return [];
  const gone = new Set(removed);
  state.naturalBarriers = state.naturalBarriers.filter(
    (cell) => !gone.has(cell),
  );
  return removed;
}

function addNaturalBarriers(state, count, near = []) {
  const [, stageMax = 0] = habitatProfile(state).naturalBarriers ?? [0, 0],
    hardMax = Math.min(8, stageMax + 2),
    added = [];
  let attempts = 0;
  while (
    added.length < count &&
    state.naturalBarriers.length < hardMax &&
    attempts++ < 128
  ) {
    const occupied = new Set([
        ...state.barriers,
        ...state.naturalBarriers,
        ...state.eggs.map((egg) => square(egg.r, egg.c)),
        ...state.plantSeeds
          .filter((seed) => !seed.transport)
          .map((seed) => square(seed.r, seed.c)),
        ...state.pieces.map((piece) => square(piece.r, piece.c)),
        ...(state.origin ? [square(state.origin.r, state.origin.c)] : []),
        ...state.deathSites.map((site) => site.cell),
        ...state.fertileTraces.map((trace) => trace.cell),
        ...(state.extremophyteFertility ?? []).map((entry) => entry.cell),
        ...(state.event?.hazards ?? []),
      ]),
      candidates = allCells().filter((cell) => !occupied.has(cell)),
      nearCandidates = near.length
        ? candidates.filter((cell) => {
            const point = { r: Math.floor(cell / 8), c: cell % 8 };
            return near.some(
              (other) =>
                distance(point, {
                  r: Math.floor(other / 8),
                  c: other % 8,
                }) <= 2,
            );
          })
        : [],
      clustered = state.naturalBarriers.length
        ? candidates.filter((cell) => {
            const point = { r: Math.floor(cell / 8), c: cell % 8 };
            return state.naturalBarriers.some(
              (other) =>
                distance(point, {
                  r: Math.floor(other / 8),
                  c: other % 8,
                }) === 1,
            );
          })
        : [],
      pool = nearCandidates.length
        ? nearCandidates
        : clustered.length && random(state) < 0.7
          ? clustered
          : candidates,
      cell = pick(state, pool);
    if (cell === null) break;
    const proposed = [...state.naturalBarriers, cell];
    if (openFractionWithNaturalBarriers(state, proposed) < 0.75) {
      const index = candidates.indexOf(cell);
      if (index >= 0) candidates.splice(index, 1);
      if (!candidates.length) break;
      continue;
    }
    state.naturalBarriers.push(cell);
    state.naturalBarriers.sort((a, b) => a - b);
    state.board[cell] = "neutral";
    added.push(cell);
  }
  return added;
}

function recordBarrierChange(event, created = [], removed = []) {
  event.barrierChanges ??= { created: 0, removed: 0 };
  event.barrierChanges.created += created.length;
  event.barrierChanges.removed += removed.length;
}

function deathSiteAt(state, cell) {
  return state.deathSites.find((d) => d.cell === cell);
}
function fertileTraceAt(state, cell) {
  return state.fertileTraces.find((t) => t.cell === cell);
}
function carcassSiteAt(state, cell) {
  return state.carcasses.find((entry) => entry.cell === cell);
}
export function hasOrganicResidue(state, cell) {
  return !!deathSiteAt(state, cell) || !!fertileTraceAt(state, cell);
}
export const hasFecalResidue = hasOrganicResidue;
export const hasDecomposition = hasOrganicResidue;

export function consumeOrganicResidue(state, cell) {
  const site = deathSiteAt(state, cell),
    trace = fertileTraceAt(state, cell);
  if (!site && !trace) return false;
  state.deathSites = state.deathSites.filter((d) => d.cell !== cell);
  state.fertileTraces = state.fertileTraces.filter((t) => t.cell !== cell);
  state.plantSeeds = (state.plantSeeds ?? []).filter(
    (seed) =>
      !(
        seed.transport?.kind === "endozoocoria" &&
        seed.transport.cell === cell
      ),
  );
  return true;
}
export const consumeFecalResidue = consumeOrganicResidue;
export const consumeDecomposition = consumeOrganicResidue;

export function markOrganicResidue(
  state,
  cell,
  pathogenDiseaseIds = [],
) {
  const existing = deathSiteAt(state, cell),
    trace = fertileTraceAt(state, cell),
    base =
      existing?.base ??
      trace?.base ??
      (state.event?.hazards.includes(cell)
        ? state.event.snapshots[cell] ?? "neutral"
        : state.board[cell]),
    dueRound = round(state) + 3,
    diseaseIds = [
      ...new Set([
        ...(existing?.pathogenDiseaseIds ?? []),
        ...pathogenDiseaseIds.filter(Number.isInteger),
      ]),
    ];
  state.fertileTraces = state.fertileTraces.filter((t) => t.cell !== cell);
  state.carcasses = state.carcasses.filter((entry) => entry.cell !== cell);
  if (existing) {
    existing.dueRound = dueRound;
    existing.base = base;
    existing.kind = "fecal";
    existing.pathogenDiseaseIds = diseaseIds;
  } else {
    state.deathSites.push({
      cell,
      dueRound,
      base,
      kind: "fecal",
      pathogenDiseaseIds: diseaseIds,
    });
  }
}
export const markFecalResidue = markOrganicResidue;
export const markDecomposition = markOrganicResidue;

export function markCarcass(state, cell) {
  const existing = carcassSiteAt(state, cell),
    base =
      existing?.base ??
      (state.event?.hazards.includes(cell)
        ? state.event.snapshots[cell] ?? "neutral"
        : state.board[cell]),
    dueRound = round(state) + 3;
  state.deathSites = state.deathSites.filter((site) => site.cell !== cell);
  state.fertileTraces = state.fertileTraces.filter((trace) => trace.cell !== cell);
  if (existing) {
    existing.dueRound = dueRound;
    existing.base = base;
  } else {
    state.carcasses.push({ cell, dueRound, base });
  }
}
export function consumeCarcass(state, cell) {
  if (!carcassSiteAt(state, cell)) return false;
  state.carcasses = state.carcasses.filter((entry) => entry.cell !== cell);
  return true;
}

function restorePredationFeedingBase(state, site) {
  if (state.event?.hazards.includes(site.cell))
    state.event.snapshots[site.cell] = site.base;
  else
    state.board[site.cell] = site.base;
}

export function finalizePredationFeedingSite(state, sourceId) {
  const sites = state.predationFeedingSites ?? [],
    site = sites.find((entry) => entry.sourceId === sourceId);
  if (!site) return false;
  state.predationFeedingSites = sites.filter((entry) => entry !== site);
  restorePredationFeedingBase(state, site);
  markCarcass(state, site.cell);
  const source = state.pieces.find((piece) => piece.id === sourceId);
  if (source) {
    source.predationEnergy = false;
    source.predationEnergyEfficient = false;
  }
  return true;
}

export function beginPredationFeedingSite(state, source, cell) {
  if (!source) return false;
  const previous = (state.predationFeedingSites ?? []).find(
    (entry) => entry.sourceId === source.id,
  );
  if (previous && previous.cell !== cell)
    finalizePredationFeedingSite(state, source.id);

  const occupant = (state.predationFeedingSites ?? []).find(
    (entry) => entry.cell === cell && entry.sourceId !== source.id,
  );
  if (occupant)
    finalizePredationFeedingSite(state, occupant.sourceId);

  state.predationFeedingSites ??= [];
  let site = state.predationFeedingSites.find(
    (entry) => entry.sourceId === source.id,
  );
  if (!site) {
    const base = state.event?.hazards.includes(cell)
      ? state.event.snapshots[cell] ?? "neutral"
      : state.board[cell];
    site = { sourceId: source.id, cell, base };
    state.predationFeedingSites.push(site);
  }
  if (state.event?.hazards.includes(cell))
    state.event.snapshots[cell] = "fertile";
  state.board[cell] = "fertile";
  return true;
}

export function settlePredationFeedingSites(state) {
  for (const site of [...(state.predationFeedingSites ?? [])]) {
    const source = state.pieces.find((piece) => piece.id === site.sourceId);
    if (
      !source ||
      square(source.r, source.c) !== site.cell ||
      !source.predationEnergy
    )
      finalizePredationFeedingSite(state, site.sourceId);
  }
}


function seedCluster(state, type) {
  const candidates = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      for (const [dr, dc] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const cells = [
          [r, c],
          [r + dr, c],
          [r, c + dc],
        ];
        if (
          cells.every(
            ([rr, cc]) =>
              inside(rr, cc) &&
              !at(state, rr, cc) &&
              !barrierAt(state, rr, cc),
          )
        )
          candidates.push(cells.map(([rr, cc]) => square(rr, cc)));
      }
  const score = (cells) =>
    cells.reduce(
      (n, i) =>
        n +
        (state.board[i] === "neutral" ? 0 : state.board[i] === type ? 1 : 10),
      0,
    );
  const min = Math.min(...candidates.map(score)),
    chosen = pick(
      state,
      candidates.filter((c) => score(c) === min),
    );
  for (const i of chosen ?? []) state.board[i] = type;
}
function advancePrimordialConway(ctx) {
  const state = ctx.state,
    event = state.event,
    profile = habitatProfile(state);
  if (event)
    for (const [i, base] of Object.entries(event.snapshots))
      state.board[Number(i)] = base;
  const legacyDeathSites = state.deathSites.filter(
    (site) => site.kind === undefined,
  );
  for (const site of legacyDeathSites) state.board[site.cell] = site.base;

  flowHostileTerrainWithinProfile(state, profile);

  for (const site of legacyDeathSites) {
    if (site.base !== "fertile") site.base = state.board[site.cell];
    if (!event?.hazards.includes(site.cell))
      state.board[site.cell] = site.base === "fertile" ? "fertile" : "hostile";
  }
  if (event)
    for (const key of Object.keys(event.snapshots)) {
      const cell = Number(key);
      event.snapshots[cell] = state.board[cell];
      state.board[cell] = "hostile";
    }

  const doomed = state.pieces
    .filter((piece) => {
      const cell = square(piece.r, piece.c);
      return (
        state.board[cell] === "hostile" &&
        !has(piece, "Voo") &&
        !event?.hazards.includes(cell)
      );
    })
    .map((piece) => piece.id);
  for (const id of doomed) ctx.kill(id, "mudança orgânica do habitat");
}

function habitatRange(value) {
  if (Array.isArray(value)) return [value[0] ?? 0, value[1] ?? value[0] ?? 0];
  const target = value ?? 0;
  return [target, target];
}

function cellularProtectedCells(state) {
  return new Set([
    ...state.barriers,
    ...state.naturalBarriers,
    ...state.deathSites.map((site) => site.cell),
    ...state.fertileTraces.map((trace) => trace.cell),
    ...(state.extremophyteFertility ?? []).map((entry) => entry.cell),
  ]);
}

function hostilePressurePreference(state) {
  const occupied = state.pieces.map((piece) => ({
      cell: square(piece.r, piece.c),
      owner: piece.owner,
      r: piece.r,
      c: piece.c,
    })),
    scores = [];
  for (const cell of allCells()) {
    const r = Math.floor(cell / 8),
      c = cell % 8;
    if (barrierAt(state, r, c) || at(state, r, c)) continue;
    let score = 0;
    for (const piece of occupied) {
      const d = Math.max(Math.abs(piece.r - r), Math.abs(piece.c - c));
      if (d <= 1) score += 5;
      else if (d === 2) score += 2;
      if (
        (piece.owner === "blue" && r > piece.r) ||
        (piece.owner === "amber" && r < piece.r)
      )
        score += 1;
    }
    if (r === 0 || r === 7 || c === 0 || c === 7) score += 1;
    scores.push({ cell, score });
  }
  scores.sort((a, b) => b.score - a.score || a.cell - b.cell);
  return scores.filter((entry) => entry.score > 0).slice(0, 20).map((entry) => entry.cell);
}

function habitatPressureLevel(state) {
  const now = round(state),
    stalledRounds = Math.max(
      0,
      now - (state.lastSuccessfulCaptureRound ?? 0),
    ),
    population = activePopulation(state),
    offensive = offensiveActionCount(state),
    replacement = replacementPressure(state);
  if (
    replacement.level >= 3 ||
    (now >= 70 && offensive <= 2)
  )
    return 3;
  if (
    replacement.level >= 2 ||
    stalledRounds >= 18 ||
    population >= 32 ||
    (now >= 18 && offensive === 0)
  )
    return 2;
  if (replacement.level >= 1 || stalledRounds >= 12) return 1;
  return 0;
}

function habitatIntervalRounds(level) {
  if (level >= 3) return 2;
  if (level >= 2) return 3;
  if (level >= 1) return 4;
  return 5;
}

function applyCellularTerrainConsequences(ctx, before) {
  const state = ctx.state,
    newlyHostile = new Set(
      allCells().filter(
        (cell) => before[cell] !== "hostile" && state.board[cell] === "hostile",
      ),
    );
  if (!newlyHostile.size) return;

  const doomed = state.pieces
    .filter((piece) => {
      const cell = square(piece.r, piece.c);
      return (
        newlyHostile.has(cell) &&
        !has(piece, "Voo") &&
        !state.event?.hazards?.includes(cell)
      );
    })
    .map((piece) => piece.id);
  for (const id of doomed) ctx.kill(id, "mudança orgânica do habitat");

  state.eggs = state.eggs.filter((egg) => {
    const cell = square(egg.r, egg.c);
    return !newlyHostile.has(cell) || random(state) >= 0.5;
  });
  state.plantSeeds = state.plantSeeds.filter((seed) => {
    if (!Number.isInteger(seed.r) || !Number.isInteger(seed.c)) return true;
    const cell = square(seed.r, seed.c);
    return !newlyHostile.has(cell) || random(state) >= 0.5;
  });
}

function evolveCellularTerrain(
  ctx,
  {
    type,
    rule,
    profile = habitatProfile(ctx.state),
    changeLimit = 2,
    preferredCells = [],
    avoidedCells = [],
    targetCount = null,
    protectedCells = cellularProtectedCells(ctx.state),
  },
) {
  const state = ctx.state,
    before = [...state.board],
    [min, max] = habitatRange(profile[type]);
  advanceCellularTerrain(state, {
    type,
    rule,
    min,
    max,
    changeLimit,
    preferredCells,
    avoidedCells,
    targetCount,
    protectedCells,
  });
  applyCellularTerrainConsequences(ctx, before);
}

export function advanceHostileCorrosion(ctx) {
  if (!conwayUnlocked(ctx.state)) return false;
  const state = ctx.state,
    before = [...state.board];
  evolveCellularTerrain(ctx, {
    type: "hostile",
    rule: CELLULAR_RULES.CORROSION,
    profile: habitatProfile(state),
    changeLimit: Infinity,
  });
  return before.some((terrain, cell) => terrain !== state.board[cell]);
}

function advanceBasalCellularHabitat(ctx, pressure = 0) {
  const state = ctx.state,
    stage = currentGeologicalStage(state),
    profile = habitatProfile(state),
    eoarchean = currentGeologicalStage({ geologicalStage: "eoarchean" }).index,
    siderian = currentGeologicalStage({ geologicalStage: "siderian" }).index,
    ordovician = currentGeologicalStage({ geologicalStage: "ordovician" }).index,
    silurian = currentGeologicalStage({ geologicalStage: "silurian" }).index,
    devonian = currentGeologicalStage({ geologicalStage: "devonian" }).index;

  if (stage.index < eoarchean) return;

  if (stage.index < siderian) {
    evolveCellularTerrain(ctx, {
      type: "hostile",
      rule: CELLULAR_RULES.CLASSIC,
      profile,
      changeLimit: 2 + Math.min(pressure, 1),
    });
    return;
  }

  if (stage.index <= ordovician) {
    evolveCellularTerrain(ctx, {
      type: "hostile",
      rule: CELLULAR_RULES.TWO_BY_TWO,
      profile,
      changeLimit: 2 + Math.min(pressure, 1),
    });
    return;
  }

  if (stage.index === silurian) {
    evolveCellularTerrain(ctx, {
      type: "hostile",
      rule: CELLULAR_RULES.TWO_BY_TWO,
      profile,
      changeLimit: 1 + Math.min(pressure, 1),
    });
    return;
  }

  if (stage.index >= devonian) {
    const corridor =
        pressure > 0
          ? nearestPopulationCorridor(state, { requireEdit: false })?.path ?? []
          : [],
      preferredFertile = corridor.slice(1, -1);
    evolveCellularTerrain(ctx, {
      type: "fertile",
      rule: CELLULAR_RULES.MAZECTRIC,
      profile,
      changeLimit: 2 + pressure,
      preferredCells: preferredFertile,
    });

    if (pressure >= 2) {
      evolveCellularTerrain(ctx, {
        type: "hostile",
        rule: CELLULAR_RULES.SEEDS,
        profile,
        changeLimit: 1 + pressure,
        preferredCells: hostilePressurePreference(state),
        avoidedCells: preferredFertile,
      });
    } else {
      const before = [...state.board];
      flowHostileTerrainWithinProfile(state, profile);
      applyCellularTerrainConsequences(ctx, before);
    }
  }
}

function applyEventCellularStep(ctx, event) {
  if (!event?.cellular) return false;
  const state = ctx.state,
    overlay = new Set(event.hazards ?? []);

  for (const [cell, base] of Object.entries(event.snapshots ?? {}))
    state.board[Number(cell)] = base;

  const config = event.cellular,
    profile = habitatProfile(state),
    preferredCells = config.preferredCells ?? [];
  evolveCellularTerrain(ctx, {
    type: config.type,
    rule: CELLULAR_RULES[config.rule],
    profile,
    changeLimit: config.changeLimit ?? 2,
    preferredCells,
    avoidedCells: config.avoidedCells ?? [],
    targetCount: config.targetCount ?? null,
  });

  for (const cell of overlay) {
    event.snapshots[cell] = state.board[cell];
    state.board[cell] = "hostile";
  }
  event.cellular.ticks = (event.cellular.ticks ?? 0) + 1;
  return true;
}

function tickEventCellular(ctx, now) {
  const event = ctx.state.event,
    cellular = event?.cellular;
  if (
    !cellular ||
    (cellular.maxTicks !== undefined && (cellular.ticks ?? 0) >= cellular.maxTicks)
  )
    return;
  cellular.nextRound ??= event.startRound + (cellular.intervalRounds ?? 3);
  while (
    now >= cellular.nextRound &&
    (cellular.maxTicks === undefined || (cellular.ticks ?? 0) < cellular.maxTicks)
  ) {
    applyEventCellularStep(ctx, event);
    cellular.nextRound += cellular.intervalRounds ?? 3;
  }
}

function applyPopulationTerrainPressure(ctx, level) {
  const state = ctx.state,
    profile = habitatProfile(state),
    corridor = nearestPopulationCorridor(state, { requireEdit: false })?.path ?? [];
  evolveCellularTerrain(ctx, {
    type: "hostile",
    rule: level >= 2 ? CELLULAR_RULES.SEEDS : CELLULAR_RULES.TWO_BY_TWO,
    profile,
    changeLimit: level >= 2 ? 4 : 2,
    preferredCells: hostilePressurePreference(state),
    avoidedCells: corridor.slice(1, -1),
  });
}

function terrainNeighborCount(board, cell, type) {
  const r = Math.floor(cell / 8),
    c = cell % 8;
  let count = 0;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++)
      if (
        (dr || dc) &&
        inside(r + dr, c + dc) &&
        board[square(r + dr, c + dc)] === type
      )
        count++;
  return count;
}

function habitatDriftCandidates(state, type) {
  const board = state.board,
    protectedCells = new Set([
      ...state.barriers,
      ...state.naturalBarriers,
      ...state.deathSites.map((site) => site.cell),
      ...state.fertileTraces.map((trace) => trace.cell),
      ...(state.extremophyteFertility ?? []).map((entry) => entry.cell),
    ]),
    current = allCells().filter(
      (cell) => board[cell] === type && !protectedCells.has(cell),
    ),
    frontier = allCells().filter((cell) => {
      if (board[cell] !== "neutral" || protectedCells.has(cell)) return false;
      const r = Math.floor(cell / 8),
        c = cell % 8;
      return (
        !barrierAt(state, r, c) &&
        terrainNeighborCount(board, cell, type) > 0
      );
    });
  return { current, frontier };
}

function chooseHabitatCell(state, cells, type, mode, pattern) {
  if (!cells.length) return null;
  const score = (cell) => terrainNeighborCount(state.board, cell, type),
    ranked = shuffle(state, cells).sort((a, b) => {
      const as = score(a),
        bs = score(b);
      if (mode === "remove") {
        if (pattern === "fragmented") return bs - as;
        if (pattern === "corridors")
          return Math.abs(bs - 2) - Math.abs(as - 2);
        return as - bs;
      }
      if (pattern === "fragmented")
        return Math.abs(as - 1) - Math.abs(bs - 1);
      if (pattern === "corridors")
        return Math.abs(as - 2) - Math.abs(bs - 2);
      if (["forest", "dense", "clusters", "islands"].includes(pattern))
        return bs - as;
      return Math.abs(as - 2) - Math.abs(bs - 2);
    });
  return ranked[0] ?? null;
}

function driftTerrainWithinProfile(state, type, profile) {
  const pattern = profile.pattern ?? "mosaic",
    [min, max] = habitatRange(profile[type]),
    count = state.board.filter((cell) => cell === type).length,
    { current, frontier } = habitatDriftCandidates(state, type),
    changeLimit = pattern === "primordial" ? 1 : 2;

  if (count > max) {
    let remaining = Math.min(changeLimit, count - max);
    const pool = [...current];
    while (remaining-- > 0 && pool.length) {
      const cell = chooseHabitatCell(state, pool, type, "remove", pattern);
      if (cell === null) break;
      state.board[cell] = "neutral";
      pool.splice(pool.indexOf(cell), 1);
    }
    return;
  }

  if (count < min) {
    let remaining = Math.min(changeLimit, min - count);
    while (remaining-- > 0) {
      const candidates = habitatDriftCandidates(state, type).frontier;
      const cell = chooseHabitatCell(
        state,
        candidates,
        type,
        "add",
        pattern,
      );
      if (cell === null) break;
      state.board[cell] = type;
    }
    return;
  }

  if (!current.length || !frontier.length || max === 0) return;
  const from = chooseHabitatCell(state, current, type, "remove", pattern);
  if (from === null) return;
  state.board[from] = "neutral";
  const candidates = habitatDriftCandidates(state, type).frontier;
  const to = chooseHabitatCell(state, candidates, type, "add", pattern);
  if (to === null) {
    state.board[from] = type;
    return;
  }
  state.board[to] = type;
}

function flowHostileTerrainWithinProfile(state, profile) {
  const pattern = profile.pattern ?? "mosaic",
    [min, max] = habitatRange(profile.hostile),
    changeLimit = pattern === "primordial" ? 1 : 2,
    count = state.board.filter((cell) => cell === "hostile").length;

  if (count < min) {
    let remaining = Math.min(changeLimit, min - count);
    while (remaining-- > 0) {
      const candidates = habitatDriftCandidates(state, "hostile").frontier;
      const cell = chooseHabitatCell(
        state,
        candidates,
        "hostile",
        "add",
        "clusters",
      );
      if (cell === null) break;
      state.board[cell] = "hostile";
    }
    return;
  }

  if (count > max) {
    let remaining = Math.min(changeLimit, count - max);
    while (remaining-- > 0) {
      const candidates = habitatDriftCandidates(state, "hostile").current;
      const cell = chooseHabitatCell(
        state,
        candidates,
        "hostile",
        "remove",
        pattern,
      );
      if (cell === null) break;
      state.board[cell] = "neutral";
    }
    return;
  }

  for (let step = 0; step < changeLimit; step++) {
    const frontier = habitatDriftCandidates(state, "hostile").frontier,
      to = chooseHabitatCell(
        state,
        frontier,
        "hostile",
        "add",
        "clusters",
      );
    if (to === null) break;
    state.board[to] = "hostile";

    const tail = habitatDriftCandidates(state, "hostile").current.filter(
        (cell) => cell !== to,
      ),
      from = chooseHabitatCell(
        state,
        tail,
        "hostile",
        "remove",
        pattern,
      );
    if (from === null) {
      state.board[to] = "neutral";
      break;
    }
    state.board[from] = "neutral";
  }
}

function advancePatternedHabitat(ctx) {
  const state = ctx.state,
    event = state.event,
    profile = habitatProfile(state);

  // Evolve the underlying geological preset, never the temporary event overlay.
  if (event)
    for (const [cell, base] of Object.entries(event.snapshots))
      state.board[Number(cell)] = base;
  const legacyDeathSites = state.deathSites.filter(
    (site) => site.kind === undefined,
  );
  for (const site of legacyDeathSites) state.board[site.cell] = site.base;

  driftTerrainWithinProfile(state, "fertile", profile);
  flowHostileTerrainWithinProfile(state, profile);

  for (const site of legacyDeathSites) {
    if (site.base !== "fertile") site.base = state.board[site.cell];
    if (!event?.hazards.includes(site.cell))
      state.board[site.cell] = site.base === "fertile" ? "fertile" : "hostile";
  }
  if (event)
    for (const key of Object.keys(event.snapshots)) {
      const cell = Number(key);
      event.snapshots[cell] = state.board[cell];
      state.board[cell] = "hostile";
    }

  const doomed = state.pieces
    .filter((piece) => {
      const cell = square(piece.r, piece.c);
      return (
        state.board[cell] === "hostile" &&
        !has(piece, "Voo") &&
        !event?.hazards.includes(cell)
      );
    })
    .map((piece) => piece.id);
  for (const id of doomed) ctx.kill(id, "mudança orgânica do habitat");
}

function advanceBlockedConway(ctx) {
  const state = ctx.state,
    event = state.event;
  if (currentGeologicalStage(state).chronology?.eon === "Proterozoico")
    return advancePrimordialConway(ctx);

  if (event)
    for (const [cell, base] of Object.entries(event.snapshots))
      state.board[Number(cell)] = base;
  const legacyDeathSites = state.deathSites.filter(
    (site) => site.kind === undefined,
  );
  for (const site of legacyDeathSites) state.board[site.cell] = site.base;

  const before = [...state.board],
    alive = (cell, type) => {
      const r = Math.floor(cell / 8),
        c = cell % 8;
      let neighbors = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (
            (dr || dc) &&
            inside(r + dr, c + dc) &&
            before[square(r + dr, c + dc)] === type
          )
            neighbors++;
      return neighbors === 3 || (before[cell] === type && neighbors === 2);
    };

  state.board = before.map((terrain, cell) =>
    alive(cell, "fertile")
      ? "fertile"
      : terrain === "hostile"
        ? "hostile"
        : "neutral",
  );
  for (const cell of state.naturalBarriers)
    state.board[cell] = before[cell] === "fertile" ? "fertile" : "neutral";

  for (const type of ["fertile"]) {
    if (!state.board.includes(type)) seedCluster(state, type);
    const unchanged =
      before.some((terrain) => terrain === type) &&
      before.every(
        (terrain, cell) =>
          (terrain === type) === (state.board[cell] === type),
      );
    if (!unchanged) continue;
    const options = [];
    for (const cell of allCells().filter(
      (candidate) => state.board[candidate] === type,
    ))
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const r = Math.floor(cell / 8) + dr,
            c = (cell % 8) + dc;
          if (
            (dr || dc) &&
            inside(r, c) &&
            state.board[square(r, c)] === "neutral" &&
            !at(state, r, c) &&
            !barrierAt(state, r, c)
          )
            options.push([cell, square(r, c)]);
        }
    const move = pick(state, options);
    if (move) {
      state.board[move[0]] = "neutral";
      state.board[move[1]] = type;
    }
  }

  flowHostileTerrainWithinProfile(state, habitatProfile(state));

  for (const site of legacyDeathSites) {
    if (site.base !== "fertile") site.base = state.board[site.cell];
    if (!event?.hazards.includes(site.cell))
      state.board[site.cell] = site.base === "fertile" ? "fertile" : "hostile";
  }
  if (event)
    for (const key of Object.keys(event.snapshots)) {
      const cell = Number(key);
      event.snapshots[cell] = state.board[cell];
      state.board[cell] = "hostile";
    }

  const doomed = state.pieces
    .filter((piece) => {
      const cell = square(piece.r, piece.c);
      return (
        state.board[cell] === "hostile" &&
        !has(piece, "Voo") &&
        !event?.hazards.includes(cell)
      );
    })
    .map((piece) => piece.id);
  for (const id of doomed) ctx.kill(id, "mudança orgânica do habitat");
}

export function advanceConway(ctx, options = {}) {
  if (!conwayUnlocked(ctx.state)) return;
  if (options.blocked) return advanceBlockedConway(ctx);
  const state = ctx.state;
  if (currentGeologicalStage(state).chronology?.eon === "Proterozoico")
    return advancePrimordialConway(ctx);
  return advancePatternedHabitat(ctx);
}
function markHazard(state, event, indices) {
  for (const i of indices) {
    if (!Object.hasOwn(event.snapshots, i)) event.snapshots[i] = state.board[i];
    if (!event.hazards.includes(i)) event.hazards.push(i);
    state.board[i] = "hostile";
  }
}
function markLethalHazard(ctx, event, indices) {
  const state = ctx.state,
    lethal = [...new Set(indices)];
  event.lethalHazards ??= [];
  for (const cell of lethal) {
    if (!event.hazards.includes(cell)) markHazard(state, event, [cell]);
    if (!event.lethalHazards.includes(cell)) event.lethalHazards.push(cell);
  }
  const lethalSet = new Set(lethal);
  state.deathSites = state.deathSites.filter((site) => !lethalSet.has(site.cell));
  state.fertileTraces = state.fertileTraces.filter(
    (trace) => !lethalSet.has(trace.cell),
  );
  state.carcasses = state.carcasses.filter(
    (entry) => !lethalSet.has(entry.cell),
  );
  state.captureDisturbances = (state.captureDisturbances ?? []).filter(
    (entry) => !lethalSet.has(entry.cell),
  );
  for (const piece of [...state.pieces])
    if (lethalSet.has(square(piece.r, piece.c)))
      ctx.kill(piece.id, "ambiente letal", null, true);
  state.eggs = state.eggs.filter(
    (egg) => !lethalSet.has(square(egg.r, egg.c)),
  );
  state.plantSeeds = state.plantSeeds.filter(
    (seed) => !lethalSet.has(square(seed.r, seed.c)),
  );
  state.fragments = state.fragments.filter(
    (fragment) => !lethalSet.has(square(fragment.r, fragment.c)),
  );
}
function quadrant(q) {
  return allCells().filter(
    (i) => (Math.floor(i / 8) < 4 ? 0 : 2) + (i % 8 < 4 ? 0 : 1) === q,
  );
}
function severeCells(state, preferred = []) {
  const chosen = [...new Set(preferred)].slice(0, SEVERE_HAZARD_COUNT);
  if (chosen.length < SEVERE_HAZARD_COUNT) {
    const selected = new Set(chosen),
      rest = shuffle(
        state,
        allCells().filter((cell) => !selected.has(cell)),
      );
    chosen.push(...rest.slice(0, SEVERE_HAZARD_COUNT - chosen.length));
  }
  return chosen;
}
function cornerOrderedCells(event) {
  return allCells().sort((a, b) => {
    const ar = event.bottom ? 7 - Math.floor(a / 8) : Math.floor(a / 8),
      ac = event.right ? 7 - (a % 8) : a % 8,
      br = event.bottom ? 7 - Math.floor(b / 8) : Math.floor(b / 8),
      bc = event.right ? 7 - (b % 8) : b % 8;
    return ar + ac - (br + bc) || Math.max(ar, ac) - Math.max(br, bc);
  });
}
function trim(state, count) {
  const fertileCells = fertile(state),
    protectedCells = new Set(
      state.pieces
        .filter(
          (piece) =>
            has(piece, "Estômatos") &&
            stomataOpen(state, piece) === false &&
            state.board[square(piece.r, piece.c)] === "fertile",
        )
        .map((piece) => square(piece.r, piece.c)),
    ),
    target = Math.max(1, count, protectedCells.size),
    removeCount = Math.max(0, fertileCells.length - target),
    removable = shuffle(
      state,
      fertileCells.filter((cell) => !protectedCells.has(cell)),
    ).slice(0, removeCount);

  for (const cell of removable) {
    const occupant = state.pieces.find(
      (piece) => square(piece.r, piece.c) === cell,
    );
    state.board[cell] = "neutral";
    if (occupant && state.event?.id && ["drought", "desert"].includes(state.event.id)) {
      if (has(occupant, "Xerofitismo") && !occupant.xerophyteWaterReserve) {
        occupant.xerophyteWaterReserve = 1;
        emitPassiveEffect(
          state,
          "Xerofitismo",
          "💦 Xerofitismo armazenou água durante a perda de fertilidade.",
          { pieceId: occupant.id, outcome: "stored-water-reserve", value: 1 },
        );
      }
      if (has(occupant, "Rim Concentrador") && !occupant.renalWaterReserve) {
        occupant.renalWaterReserve = 1;
        emitPassiveEffect(
          state,
          "Rim Concentrador",
          "🫘 Rim Concentrador preservou uma reserva hídrica durante a seca.",
          { pieceId: occupant.id, outcome: "stored-water-reserve", value: 1 },
        );
      }
    }
  }

  if (fertileCells.length > count && protectedCells.size)
    for (const piece of state.pieces) {
      const cell = square(piece.r, piece.c);
      if (
        protectedCells.has(cell) &&
        piece.stomataPreservedRound !== round(state)
      ) {
        piece.stomataPreservedRound = round(state);
        emitPassiveEffect(
          state,
          "Estômatos",
          "🌬️💧 Estômatos fechados preservaram a casa fértil durante a perda de água.",
          {
            pieceId: piece.id,
            outcome: "closed-stomata-preserved-fertility",
          },
        );
      }
    }

  if (!fertile(state).length) addFertile(state, 1);
}
function addFertile(state, count) {
  if (fertilityPaused(state)) return 0;
  let added = 0;
  for (let n = 0; n < count; n++) {
    const empty = allCells().filter(
      (i) =>
        state.board[i] === "neutral" &&
        !at(state, Math.floor(i / 8), i % 8) &&
        !barrierAt(state, Math.floor(i / 8), i % 8),
    );
    if (!empty.length) break;
    const adjacent = empty.filter((i) =>
      fertile(state).some(
        (j) =>
          distance(
            { r: Math.floor(i / 8), c: i % 8 },
            { r: Math.floor(j / 8), c: j % 8 },
          ) === 1,
      ),
    );
    state.board[pick(state, adjacent.length ? adjacent : empty)] = "fertile";
    added++;
  }
  return added;
}
function iceCells(event) {
  return allCells().filter((i) => {
    const r = event.bottom ? 7 - Math.floor(i / 8) : Math.floor(i / 8),
      c = event.right ? 7 - (i % 8) : i % 8;
    return r < event.rows && c < event.cols;
  });
}
function barrierHabitableBy(state, piece, r, c) {
  if (builtBarrierAt(state, r, c)) return has(piece, "Trepadeira");
  if (naturalBarrierAt(state, r, c))
    return has(piece, "Escalador") || has(piece, "Trepadeira");
  return true;
}

function earthquake(ctx) {
  const state = ctx.state,
    original = new Map(state.pieces.map((p) => [p.id, { r: p.r, c: p.c }])),
    assigned = new Map();
  const candidates = new Map(
    state.pieces.map((p) => [
      p.id,
      shuffle(
        state,
        allCells().filter(
          (i) =>
            distance(p, { r: Math.floor(i / 8), c: i % 8 }) === 1 &&
            !eggAt(state, Math.floor(i / 8), i % 8) &&
            barrierHabitableBy(
              state,
              p,
              Math.floor(i / 8),
              i % 8,
            ),
        ),
      ),
    ]),
  );
  function assign(p, seen) {
    for (const i of candidates.get(p.id)) {
      if (seen.has(i)) continue;
      seen.add(i);
      const prior = assigned.get(i);
      if (!prior || assign(prior, seen)) {
        assigned.set(i, p);
        return true;
      }
    }
    return false;
  }
  // Include the original position only when an adjacent-only assignment fails.
  let success = true;
  for (const p of shuffle(state, state.pieces))
    if (!assign(p, new Set())) {
      success = false;
      break;
    }
  if (!success) {
    assigned.clear();
    for (const p of state.pieces)
      if (!eggAt(state, p.r, p.c))
        candidates.get(p.id).push(square(p.r, p.c));
    for (const p of state.pieces) assign(p, new Set());
  }
  if (assigned.size !== state.pieces.length)
    throw Error("Distribuição do terremoto inválida.");
  for (const [i, p] of assigned) {
    p.r = Math.floor(i / 8);
    p.c = i % 8;
  }
  for (const p of [...state.pieces]) {
    if (lethalHazardAt(state, p.r, p.c)) {
      ctx.kill(p.id, "Terremoto em ambiente letal", null, true);
      continue;
    }
    if (state.board[square(p.r, p.c)] === "hostile")
      ctx.kill(p.id, "Terremoto");
  }
  return original.size;
}
function endEvent(state) {
  if (!state.event) return;
  if (["drought", "desert"].includes(state.event.id))
    for (const piece of state.pieces) {
      delete piece.xerophyteWaterReserve;
      delete piece.renalWaterReserve;
    }
  for (const [i, t] of Object.entries(state.event.snapshots))
    state.board[Number(i)] = t;
  const lethal = new Set(state.event.lethalHazards ?? []);
  for (const cell of lethal) state.board[cell] = "neutral";
  state.previousEvent = state.event.id;
  state.event = null;
}
export function startEvent(
  ctx,
  id = null,
  { allowSevere = true, allowPathogen = true, source = "eco" } = {},
) {
  const state = ctx.state;
  const def = id
    ? EVENTS.find((e) => e.id === id)
    : (() => {
        const weights = eventWeights(state),
          candidates = EVENTS.filter(
            (event) =>
              (immediateEventRepeatAllowed(state) ||
                event.id !== state.previousEvent) &&
              (weights[event.id] ?? 0) > 0 &&
              (allowSevere || !SEVERE_EVENT_IDS.has(event.id)) &&
              (event.id !== "pathogen" ||
                (allowPathogen && pathogenUnlocked(state))),
          );
        return weightedEvent(state, candidates, weights);
      })();
  if (!def) {
    if (id) throw Error("Evento inválido.");
    return null;
  }
  if (def.id === "pathogen") {
    const disease = startDisease(state, "eco");
    if (disease) state.previousEvent = "pathogen";
    return disease;
  }
  if (state.event) endEvent(state);
  const event = {
    ...def,
    source,
    startRound: round(state),
    startTurn: state.turn,
    hazards: [],
    lethalHazards: [],
    snapshots: {},
  };
  state.event = event;
  recordDiscovery(state, "events", event.id);
  switch (event.id) {
    case "volcano": {
      const r = Math.floor(random(state) * 6),
        c = Math.floor(random(state) * 6),
        core = allCells().filter(
          (i) =>
            Math.floor(i / 8) >= r &&
            Math.floor(i / 8) < r + 3 &&
            i % 8 >= c &&
            i % 8 < c + 3,
        );
      markHazard(state, event, severeCells(state, core));
      const center = square(r + 1, c + 1),
        orthogonalCore = [
          square(r, c + 1),
          square(r + 1, c),
          square(r + 1, c + 2),
          square(r + 2, c + 1),
        ],
        lethalCore = [
          center,
          ...shuffle(state, orthogonalCore).slice(0, 3),
        ];
      markLethalHazard(ctx, event, lethalCore);
      const removed = removeNaturalBarriers(state, event.hazards),
        created = addNaturalBarriers(state, 2, event.hazards);
      recordBarrierChange(event, created, removed);
      break;
    }
    case "ice":
      Object.assign(event, {
        bottom: random(state) < 0.5,
        right: random(state) < 0.5,
      });
      markHazard(
        state,
        event,
        cornerOrderedCells(event).slice(0, SEVERE_HAZARD_COUNT),
      );
      recordBarrierChange(
        event,
        [],
        removeNaturalBarriers(state, event.hazards),
      );
      break;
    case "drought":
      event.cap = Math.max(1, Math.ceil(fertile(state).length / 2));
      trim(state, event.cap);
      event.cellular = {
        type: "fertile",
        rule: "CORROSION",
        intervalRounds: 3,
        changeLimit: 2,
        ticks: 0,
      };
      break;
    case "sea":
      markHazard(
        state,
        event,
        allCells().filter(
          (i) => i < 8 || i >= 56 || i % 8 === 0 || i % 8 === 7,
        ),
      );
      recordBarrierChange(
        event,
        [],
        removeNaturalBarriers(state, event.hazards, 2),
      );
      break;
    case "meteor": {
      const impact = quadrant(Math.floor(random(state) * 4)),
        blast = severeCells(state, impact),
        impactCell = pick(state, impact);
      markHazard(state, event, blast);
      if (impactCell !== null) markLethalHazard(ctx, event, [impactCell]);
      const removed = removeNaturalBarriers(state, blast),
        created = addNaturalBarriers(state, 1, blast);
      recordBarrierChange(event, created, removed);
      break;
    }
    case "grb":
      markHazard(state, event, severeCells(state));
      break;
    case "warming":
      markHazard(state, event, severeCells(state));
      event.cellular = {
        type: "hostile",
        rule: "SEEDS",
        intervalRounds: 1,
        changeLimit: 2,
        maxTicks: 2,
        ticks: 0,
      };
      recordBarrierChange(
        event,
        [],
        removeNaturalBarriers(state, event.hazards),
      );
      break;
    case "desert":
      event.initial = Math.max(1, fertile(state).length);
      trim(state, event.initial);
      event.cellular = {
        type: "fertile",
        rule: "CORROSION",
        intervalRounds: 2,
        changeLimit: 3,
        ticks: 0,
      };
      break;
    case "blockade": {
      const anti = random(state) < 0.5;
      markHazard(
        state,
        event,
        allCells().filter(
          (i) => i % 8 === (anti ? 7 - Math.floor(i / 8) : Math.floor(i / 8)),
        ),
      );
      break;
    }
    case "abundance":
      addFertile(state, Math.max(1, fertile(state).length));
      event.cellular = {
        type: "fertile",
        rule: "MAZECTRIC",
        intervalRounds: 3,
        changeLimit: 3,
        ticks: 0,
      };
      break;
    case "fertilized":
      addFertile(state, 1);
      break;
    case "earthquake": {
      earthquake(ctx);
      const removed = removeNaturalBarriers(state, null, 1),
        created = addNaturalBarriers(state, 1, removed);
      recordBarrierChange(event, created, removed);
      break;
    }
    case "abundant-rains": {
      const wet = quadrant(Math.floor(random(state) * 4)),
        removed = removeNaturalBarriers(state, wet, 1);
      recordBarrierChange(event, [], removed);
      if (!fertilityPaused(state))
        for (const i of wet)
          if (!state.naturalBarriers.includes(i)) state.board[i] = "fertile";
      event.cellular = {
        type: "fertile",
        rule: "MAZECTRIC",
        intervalRounds: 3,
        changeLimit: 3,
        preferredCells: wet,
        ticks: 0,
      };
      break;
    }
    case "eutrophication": {
      const r = 1 + Math.floor(random(state) * 6),
        c = 1 + Math.floor(random(state) * 6);
      markHazard(
        state,
        event,
        allCells().filter((i) => Math.floor(i / 8) === r || i % 8 === c),
      );
      recordBarrierChange(
        event,
        [],
        removeNaturalBarriers(state, event.hazards, 2),
      );
      for (const p of [...state.pieces])
        if (event.hazards.includes(square(p.r, p.c)))
          ctx.kill(p.id, "Eutrofização");
      break;
    }
    case "insularization": {
      const diagonals = [
          Array.from({ length: 8 }, (_, index) => square(index, index)),
          Array.from({ length: 8 }, (_, index) => square(index, 7 - index)),
        ],
        permanentBarrier = (cell) =>
          state.barriers.includes(cell) || state.naturalBarriers.includes(cell),
        freeCount = (diagonal) =>
          diagonal.filter((cell) => !permanentBarrier(cell)).length,
        bestFree = Math.max(...diagonals.map(freeCount)),
        diagonal =
          pick(
            state,
            diagonals.filter((candidate) => freeCount(candidate) === bestFree),
          ) ?? diagonals[0],
        freeOpenings = shuffle(
          state,
          diagonal.filter((cell) => !permanentBarrier(cell)),
        ),
        openings = freeOpenings.slice(0, 2);
      if (openings.length < 2)
        openings.push(
          ...shuffle(
            state,
            diagonal.filter((cell) => !openings.includes(cell)),
          ).slice(0, 2 - openings.length),
        );
      event.openings = openings;
      event.barriers = diagonal.filter((cell) => !openings.includes(cell));
      break;
    }
    case "alluvial-river": {
      const anti = random(state) < 0.5,
        river = allCells().filter(
          (i) =>
            Math.abs(
              (i % 8) - (anti ? 7 - Math.floor(i / 8) : Math.floor(i / 8)),
            ) <= 1,
        ),
        removed = removeNaturalBarriers(state, river, 2);
      recordBarrierChange(event, [], removed);
      if (!fertilityPaused(state))
        for (const i of river)
          if (!state.naturalBarriers.includes(i)) state.board[i] = "fertile";
      event.cellular = {
        type: "fertile",
        rule: "MAZECTRIC",
        intervalRounds: 3,
        changeLimit: 3,
        preferredCells: river,
        ticks: 0,
      };
      break;
    }
  }
  notice(state, `${event.icon} ${event.name}`, [
    "Evento ecológico",
    event.description,
  ]);
  log(state, `🌿 Evento ecológico: ${event.name} — ${event.description}`);
  if (event.barrierChanges?.created || event.barrierChanges?.removed)
    log(
      state,
      `🟫 Relevo alterado: +${event.barrierChanges.created} / -${event.barrierChanges.removed} barreira(s) natural(is).`,
    );
}
export function startSevereEvent(ctx, source = "eco") {
  const event = severeEventForStage(ctx.state);
  if (!event) throw Error("Nenhum evento de impacto extremo disponível neste período.");
  startEvent(ctx, event.id, { source });
  return event;
}

export function checkPopulationClimate(ctx) {
  const state = ctx.state,
    population = activePopulation(state),
    now = round(state),
    stalledRounds = Math.max(
      0,
      now - (state.lastSuccessfulCaptureRound ?? 0),
    ),
    level =
      population >= 36 || (population >= 28 && stalledRounds >= 18)
        ? 2
        : population >= 32
          ? 1
          : 0;

  if (population <= 24) {
    state.severePopulationLatched = false;
    state.populationTerrainPressure = null;
    return false;
  }
  if (!level || severeEventActive(state)) return false;

  let pressureStarted = false;
  if (
    !state.populationTerrainPressure ||
    state.populationTerrainPressure.level !== level
  ) {
    state.populationTerrainPressure = {
      level,
      startedRound: now,
      lastAppliedRound: now,
    };
    pressureStarted = true;
  }

  let acted = false;
  if (
    pressureStarted ||
    now - state.populationTerrainPressure.lastAppliedRound >= 3
  ) {
    applyPopulationTerrainPressure(ctx, level);
    state.populationTerrainPressure.lastAppliedRound = now;
    log(
      state,
      level >= 2
        ? `🌡️ Pressão populacional intensa remodelou a hostilidade ao redor das maiores aglomerações.`
        : `🌡️ Pressão populacional local deslocou a hostilidade para regiões congestionadas.`,
    );
    acted = true;
  }

  const severeTrigger =
    population >= 40 ||
    (level >= 2 &&
      now - state.populationTerrainPressure.startedRound >= 6);
  if (
    severeTrigger &&
    !state.severePopulationLatched &&
    !severeEventActive(state)
  ) {
    state.severePopulationLatched = true;
    startSevereEvent(ctx, stalledRounds >= 18 ? "stagnation" : "population");
    log(
      state,
      stalledRounds >= 18
        ? `🌡️ Estagnação ecológica persistente: ${stalledRounds} rodadas sem captura com ${population} organismos ativos superaram a resposta celular e desencadearam um evento de impacto extremo.`
        : `🌡️ Pressão populacional extrema: ${population} organismos ativos superaram a resposta celular e desencadearam um evento de impacto extremo.`,
    );
    return true;
  }
  return acted;
}

function conwayPath(state, start, goal) {
  const startCell = square(start.r, start.c),
    goalCell = square(goal.r, goal.c),
    occupied = new Set(
      state.pieces
        .filter((piece) => piece.id !== start.id && piece.id !== goal.id)
        .map((piece) => square(piece.r, piece.c)),
    ),
    score = Array(64).fill(Infinity),
    previous = Array(64).fill(null),
    pending = new Set(allCells());
  score[startCell] = 0;

  while (pending.size) {
    let current = null;
    for (const cell of pending)
      if (
        current === null ||
        score[cell] < score[current] ||
        (score[cell] === score[current] && cell < current)
      )
        current = cell;
    if (current === null || !Number.isFinite(score[current])) break;
    pending.delete(current);
    if (current === goalCell) break;

    const r = Math.floor(current / 8),
      c = current % 8;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr,
          cc = c + dc;
        if (!inside(rr, cc)) continue;
        const next = square(rr, cc);
        if (
          next !== goalCell &&
          (occupied.has(next) || builtBarrierAt(state, rr, cc))
        )
          continue;
        const edits =
            (state.board[next] === "hostile" ? 1 : 0) +
            (naturalBarrierAt(state, rr, cc) ? 1 : 0),
          candidate = score[current] + 100 + edits;
        if (
          candidate < score[next] ||
          (candidate === score[next] &&
            (previous[next] === null || current < previous[next]))
        ) {
          score[next] = candidate;
          previous[next] = current;
        }
      }
  }

  if (!Number.isFinite(score[goalCell])) return null;
  const path = [];
  for (let cell = goalCell; cell !== null; cell = previous[cell]) {
    path.push(cell);
    if (cell === startCell) break;
  }
  return path.at(-1) === startCell ? path.reverse() : null;
}

function pathEditCount(state, path) {
  return path.slice(1, -1).reduce((count, cell) => {
    const r = Math.floor(cell / 8),
      c = cell % 8;
    return (
      count +
      (state.board[cell] === "hostile" ? 1 : 0) +
      (naturalBarrierAt(state, r, c) ? 1 : 0)
    );
  }, 0);
}

function nearestPopulationCorridor(state, { requireEdit = false } = {}) {
  const pairs = [];
  for (const blue of state.pieces.filter((piece) => piece.owner === "blue"))
    for (const amber of state.pieces.filter((piece) => piece.owner === "amber"))
      pairs.push({
        a: blue,
        b: amber,
        distance: distance(blue, amber),
      });
  pairs.sort(
    (a, b) =>
      a.distance - b.distance ||
      a.a.id - b.a.id ||
      a.b.id - b.b.id,
  );
  for (const pair of pairs) {
    const path = conwayPath(state, pair.a, pair.b);
    if (!path) continue;
    const edits = pathEditCount(state, path);
    if (!requireEdit || edits > 0) return { ...pair, path, edits };
  }
  return null;
}

export function offensiveActionCount(state) {
  let count = 0;
  for (const piece of state.pieces)
    for (const target of movesFor(state, piece, { ignoreChain: true })) {
      if (!target.capture) continue;
      const victim = at(state, target.r, target.c);
      if (victim && victim.owner !== piece.owner) count++;
    }
  return count;
}

export function openOffensiveHabitatCorridor(state, pressure = 0) {
  if (pressure < 2) return 0;
  const stalledRounds = Math.max(
    0,
    round(state) - (state.lastSuccessfulCaptureRound ?? 0),
  );
  if (stalledRounds < 16) return 0;

  const corridor = nearestPopulationCorridor(state, { requireEdit: true });
  if (!corridor) return 0;

  const protectedCells = new Set([
      ...state.barriers,
      ...state.deathSites.map((site) => site.cell),
      ...state.fertileTraces.map((trace) => trace.cell),
      ...state.carcasses.map((entry) => entry.cell),
      ...(state.event?.hazards ?? []),
    ]),
    limit = pressure >= 3 ? 2 : 1;
  let opened = 0;

  for (const cell of corridor.path.slice(1, -1)) {
    if (opened >= limit || protectedCells.has(cell)) continue;
    if (state.board[cell] === "hostile") {
      state.board[cell] = "neutral";
      opened++;
      continue;
    }
    if (state.naturalBarriers.includes(cell)) {
      state.naturalBarriers = state.naturalBarriers.filter(
        (barrier) => barrier !== cell,
      );
      opened++;
    }
  }
  return opened;
}

function offensiveTerrainRepair(state) {
  const baseline = offensiveActionCount(state),
    candidates = allCells().filter((cell) => {
      const r = Math.floor(cell / 8),
        c = cell % 8;
      return (
        !builtBarrierAt(state, r, c) &&
        (state.board[cell] === "hostile" || naturalBarrierAt(state, r, c))
      );
    });
  let best = null;
  for (const cell of candidates) {
    const r = Math.floor(cell / 8),
      c = cell % 8,
      beforeTerrain = state.board[cell],
      beforeNatural = state.naturalBarriers.includes(cell);
    if (beforeTerrain === "hostile") state.board[cell] = "neutral";
    if (beforeNatural)
      state.naturalBarriers = state.naturalBarriers.filter(
        (barrier) => barrier !== cell,
      );
    const options = offensiveActionCount(state);
    state.board[cell] = beforeTerrain;
    if (beforeNatural)
      state.naturalBarriers = [...state.naturalBarriers, cell].sort(
        (a, b) => a - b,
      );
    if (
      options > baseline &&
      (!best || options > best.options || (options === best.options && cell < best.cell))
    )
      best = { cell, options, beforeTerrain, beforeNatural };
  }
  if (!best) return null;
  if (best.beforeTerrain === "hostile") state.board[best.cell] = "neutral";
  if (best.beforeNatural)
    state.naturalBarriers = state.naturalBarriers.filter(
      (barrier) => barrier !== best.cell,
    );
  return {
    cell: best.cell,
    hostile: best.beforeTerrain === "hostile" ? 1 : 0,
    barrier: best.beforeNatural ? 1 : 0,
    options: best.options,
  };
}

function offensiveRelocation(state) {
  const baseline = offensiveActionCount(state);
  let best = null;
  for (const piece of state.pieces) {
    const origin = { r: piece.r, c: piece.c };
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const r = origin.r + dr,
          c = origin.c + dc;
        if (
          !inside(r, c) ||
          at(state, r, c) ||
          eggAt(state, r, c) ||
          plantSeedAt(state, r, c) ||
          barrierAt(state, r, c) ||
          state.board[square(r, c)] === "hostile"
        )
          continue;
        piece.r = r;
        piece.c = c;
        const options = offensiveActionCount(state);
        piece.r = origin.r;
        piece.c = origin.c;
        if (
          options > baseline &&
          (!best ||
            options > best.options ||
            (options === best.options &&
              (piece.id < best.piece.id ||
                (piece.id === best.piece.id && square(r, c) < best.cell))))
        )
          best = { piece, r, c, cell: square(r, c), options };
      }
  }
  if (!best) return null;
  best.piece.r = best.r;
  best.piece.c = best.c;
  return best;
}

export function tickEnvironment(ctx) {
  const state = ctx.state,
    now = round(state);

  tickSevereEventTurn(state);
  tickOrganicResidue(state);
  tickCarcasses(state);
  depletePausedFertility(state);

  state.nextHabitatRound ??= 5;
  while (
    cellularTerrainUnlocked(state) &&
    !severeEventActive(state) &&
    now >= state.nextHabitatRound
  ) {
    const pressure = habitatPressureLevel(state);
    advanceBasalCellularHabitat(ctx, pressure);
    const opened = openOffensiveHabitatCorridor(state, pressure);
    if (opened > 0)
      log(
        state,
        `Corredor ecológico abriu ${opened} passagem(ns) sob pressão ofensiva prolongada.`,
      );
    state.nextHabitatRound += habitatIntervalRounds(pressure);
  }

  while (state.maxGenerationReached >= state.nextEventGeneration) {
    state.pendingEcologicalEvents++;
    state.nextEventGeneration += 6;
  }

  if (
    state.event &&
    !SEVERE_EVENT_IDS.has(state.event.id) &&
    now - state.event.startRound >= 10
  )
    endEvent(state);

  const event = state.event;
  if (event) {
    const age = now - event.startRound;
    if (event.id === "drought") trim(state, event.cap);
    else if (event.id === "desert")
      trim(state, Math.max(1, Math.ceil((event.initial * (10 - age)) / 10)));
    else if (event.id === "fertilized") addFertile(state, 1);
    tickEventCellular(ctx, now);
    for (const i of event.hazards) state.board[i] = "hostile";
  } else if (state.pendingEcologicalEvents > 0) {
    state.pendingEcologicalEvents--;
    startEvent(ctx, null, { allowSevere: false, allowPathogen: true });
  }
}


export function tickSevereEventTurn(state) {
  if (
    severeEventActive(state) &&
    state.turn - (state.event.startTurn ?? state.turn) >= 5
  )
    endEvent(state);
}
