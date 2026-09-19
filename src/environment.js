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
  activePopulation,
  fertilityPaused,
} from "./state.js";
import { eventWeights, habitatProfile } from "./geology.js";
import { recordDiscovery } from "./discoveries.js";
import { startDisease } from "./disease.js";
const allCells = () => Array.from({ length: 64 }, (_, i) => i);
export const SEVERE_EVENT_IDS = new Set(["ice", "volcano", "meteor", "grb", "warming"]);
const SEVERE_HAZARD_COUNT = Math.ceil(64 * 0.9);
export const severeEventActive = (state) =>
  !!state.event && SEVERE_EVENT_IDS.has(state.event.id);

export function fertilityDepletionRate(population) {
  if (population < 24) return 0;
  return Math.min(0.3, 0.05 + (population - 24) * 0.0125);
}

export function populationAttritionChance(population) {
  if (population < 32) return 0;
  return Math.min(0.45, 0.1 + (population - 32) * 0.05);
}

function depletePausedFertility(state) {
  const population = activePopulation(state),
    rate = fertilityDepletionRate(population);
  if (!rate) return 0;

  const occupied = new Set([
      ...state.pieces.map((piece) => square(piece.r, piece.c)),
      ...state.eggs.map((egg) => square(egg.r, egg.c)),
      ...state.plantSeeds.map((seed) => square(seed.r, seed.c)),
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

export function applyPopulationAttrition(ctx) {
  const state = ctx.state,
    population = activePopulation(state),
    chance = populationAttritionChance(population);
  if (!chance || severeEventActive(state) || random(state) >= chance)
    return false;

  const density = (piece) =>
      state.pieces.filter(
        (other) => other.id !== piece.id && distance(piece, other) === 1,
      ).length,
    highest = Math.max(...state.pieces.map(density)),
    candidates = state.pieces.filter((piece) => density(piece) === highest),
    victim = pick(state, candidates);
  if (!victim) return false;
  return ctx.kill(victim.id, "atrito populacional");
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
    fresh = severe.filter((event) => event.id !== state.previousEvent);
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
        ...state.plantSeeds.map((seed) => square(seed.r, seed.c)),
        ...state.pieces.map((piece) => square(piece.r, piece.c)),
        ...(state.origin ? [square(state.origin.r, state.origin.c)] : []),
        ...state.deathSites.map((site) => site.cell),
        ...state.fertileTraces.map((trace) => trace.cell),
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
export function hasDecomposition(state, cell) {
  return !!deathSiteAt(state, cell) || !!fertileTraceAt(state, cell);
}
export function consumeDecomposition(state, cell) {
  const site = deathSiteAt(state, cell),
    trace = fertileTraceAt(state, cell),
    base = site?.base ?? trace?.base;
  if (!site && !trace) return false;
  state.deathSites = state.deathSites.filter((d) => d.cell !== cell);
  state.fertileTraces = state.fertileTraces.filter((t) => t.cell !== cell);
  if (state.event?.hazards.includes(cell))
    state.event.snapshots[cell] = base ?? "neutral";
  else state.board[cell] = base ?? "neutral";
  return true;
}
export function markDecomposition(state, cell) {
  const existing = deathSiteAt(state, cell),
    trace = fertileTraceAt(state, cell),
    eventHazard = state.event?.hazards.includes(cell),
    visibleTerrain = state.board[cell],
    base =
      !eventHazard && visibleTerrain === "fertile"
        ? "fertile"
        : existing?.base ?? trace?.base ?? visibleTerrain;
  const dueRound = round(state) + 3;
  state.fertileTraces = state.fertileTraces.filter((t) => t.cell !== cell);
  if (existing) {
    existing.dueRound = dueRound;
    existing.base = base;
  } else {
    state.deathSites.push({ cell, dueRound, base });
  }
  if (eventHazard) {
    if (!Object.hasOwn(state.event.snapshots, cell))
      state.event.snapshots[cell] = base;
  } else {
    state.board[cell] = base === "fertile" ? "fertile" : "hostile";
  }
}
function tickDecomposition(state) {
  const now = round(state);
  for (const site of [...state.deathSites]) {
    const eventHazard = state.event?.hazards.includes(site.cell),
      preservedFertility = site.base === "fertile";
    if (now < site.dueRound) {
      if (!eventHazard)
        state.board[site.cell] = preservedFertility ? "fertile" : "hostile";
      continue;
    }
    if (eventHazard) state.event.snapshots[site.cell] = preservedFertility ? "fertile" : "neutral";
    else state.board[site.cell] = preservedFertility ? "fertile" : "neutral";
    state.fertileTraces = state.fertileTraces.filter((t) => t.cell !== site.cell);
    state.deathSites = state.deathSites.filter((d) => d.cell !== site.cell);
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
export function advanceConway(ctx) {
  const state = ctx.state,
    event = state.event;
  // Evolve the underlying habitat, then reapply the temporary event overlay.
  if (event)
    for (const [i, base] of Object.entries(event.snapshots))
      state.board[Number(i)] = base;
  const deathBases = new Map();
  for (const site of state.deathSites) {
    deathBases.set(site.cell, state.board[site.cell]);
    state.board[site.cell] = site.base;
  }
  const before = [...state.board];
  const alive = (i, type) => {
    const r = Math.floor(i / 8),
      c = i % 8;
    let n = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        if (
          (dr || dc) &&
          inside(r + dr, c + dc) &&
          before[square(r + dr, c + dc)] === type
        )
          n++;
    return n === 3 || (before[i] === type && n === 2);
  };
  state.board = before.map((_, i) =>
    alive(i, "fertile")
      ? "fertile"
      : alive(i, "hostile")
        ? "hostile"
        : "neutral",
  );
  for (const cell of state.naturalBarriers)
    state.board[cell] = before[cell] === "fertile" ? "fertile" : "neutral";
  for (const type of ["fertile", "hostile"]) {
    if (!state.board.includes(type)) seedCluster(state, type);
    const unchanged =
      before.some((t) => t === type) &&
      before.every((t, i) => (t === type) === (state.board[i] === type));
    if (unchanged) {
      const options = [];
      for (const i of allCells().filter((i) => state.board[i] === type))
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const r = Math.floor(i / 8) + dr,
              c = (i % 8) + dc;
            if (
              (dr || dc) &&
              inside(r, c) &&
              state.board[square(r, c)] === "neutral" &&
              !at(state, r, c) &&
              !barrierAt(state, r, c)
            )
              options.push([i, square(r, c)]);
          }
      const move = pick(state, options);
      if (move) {
        state.board[move[0]] = "neutral";
        state.board[move[1]] = type;
      }
    }
  }
  for (const site of state.deathSites) {
    if (site.base !== "fertile") site.base = state.board[site.cell];
    if (!event?.hazards.includes(site.cell))
      state.board[site.cell] = site.base === "fertile" ? "fertile" : "hostile";
  }
  if (event)
    for (const key of Object.keys(event.snapshots)) {
      const i = Number(key);
      event.snapshots[i] = state.board[i];
      state.board[i] = "hostile";
    }
  // Retain legacy Conway mortality; other hostile risk is resolved once per round.
  const doomed = state.pieces
    .filter((p) => {
      const cell = square(p.r, p.c);
      return (
        state.board[cell] === "hostile" &&
        !hasDecomposition(state, cell) &&
        !has(p, "Voo") &&
        !event?.hazards.includes(cell)
      );
    })
    .map((p) => p.id);
  for (const id of doomed) ctx.kill(id, "mudança do habitat por Conway");
}
function markHazard(state, event, indices) {
  for (const i of indices) {
    if (!Object.hasOwn(event.snapshots, i)) event.snapshots[i] = state.board[i];
    if (!event.hazards.includes(i)) event.hazards.push(i);
    state.board[i] = "hostile";
  }
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
  for (const i of shuffle(state, fertile(state)).slice(Math.max(1, count)))
    state.board[i] = "neutral";
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
  for (const p of [...state.pieces])
    if (state.board[square(p.r, p.c)] === "hostile")
      ctx.kill(p.id, "Terremoto");
  return original.size;
}
function endEvent(state) {
  if (!state.event) return;
  for (const [i, t] of Object.entries(state.event.snapshots))
    state.board[Number(i)] = t;
  state.previousEvent = state.event.id;
  state.event = null;
  for (const site of state.deathSites)
    state.board[site.cell] = site.base === "fertile" ? "fertile" : "hostile";
}
export function startEvent(ctx, id = null, { allowSevere = true, allowPathogen = true } = {}) {
  const state = ctx.state;
  if (state.event) endEvent(state);
  const def = id
    ? EVENTS.find((e) => e.id === id)
    : (() => {
        const weights = eventWeights(state),
          candidates = EVENTS.filter(
            (event) =>
              event.id !== state.previousEvent &&
              (weights[event.id] ?? 0) > 0 &&
              (allowSevere || !SEVERE_EVENT_IDS.has(event.id)) &&
              (allowPathogen || event.id !== "pathogen"),
          );
        return weightedEvent(state, candidates, weights);
      })();
  if (!def) throw Error("Evento inválido.");
  const event = {
    ...def,
    startRound: round(state),
    startTurn: state.turn,
    hazards: [],
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
    case "pathogen":
      startDisease(state);
      break;
    case "drought":
      event.cap = Math.max(1, Math.ceil(fertile(state).length / 2));
      trim(state, event.cap);
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
        blast = severeCells(state, impact);
      markHazard(state, event, blast);
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
      recordBarrierChange(
        event,
        [],
        removeNaturalBarriers(state, event.hazards),
      );
      break;
    case "desert":
      event.initial = Math.max(1, fertile(state).length);
      trim(state, event.initial);
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
      break;
    }
    case "insularization": {
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
          ctx.kill(p.id, "Insularização");
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
export function startSevereEvent(ctx) {
  const event = severeEventForStage(ctx.state);
  if (!event) throw Error("Nenhum evento severo disponível neste período.");
  startEvent(ctx, event.id);
  return event;
}

export function checkPopulationClimate(ctx) {
  const state = ctx.state,
    population = activePopulation(state);
  if (population <= 32) state.severePopulationLatched = false;
  if (population < 40 || state.severePopulationLatched || severeEventActive(state))
    return false;
  state.severePopulationLatched = true;
  startSevereEvent(ctx);
  log(
    state,
    `🌡️ Pressão populacional: ${population} organismos ativos desencadearam um evento severo.`,
  );
  return true;
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

function nearestPopulationCorridor(state) {
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
    if (path) return { ...pair, path };
  }
  return null;
}

export function repairConwayStagnation(ctx, level) {
  const state = ctx.state;
  if (level === 1) {
    const removed = removeNaturalBarriers(state, null, 1).length;
    log(
      state,
      removed
        ? "🌀 Conway: a estagnação removeu uma barreira natural local."
        : "🌀 Conway: a estagnação confirmou que não havia barreira natural local para remover.",
    );
    return;
  }
  if (level === 2) {
    const axis = Math.floor(random(state) * 8),
      horizontal = random(state) < 0.5,
      cells = allCells().filter((cell) =>
        horizontal ? Math.floor(cell / 8) === axis : cell % 8 === axis,
      );
    let changed = 0;
    for (const cell of shuffle(state, cells)) {
      if (changed >= 3) break;
      if (state.board[cell] !== "hostile") continue;
      state.board[cell] = "neutral";
      changed++;
    }
    log(
      state,
      `🌀 Conway: abriu um corredor local com ${changed} casa(s) neutra(s).`,
    );
    return;
  }

  const corridor = nearestPopulationCorridor(state);
  if (!corridor) {
    log(
      state,
      "🌀 Conway: o reparo final encontrou populações sem rota disponível.",
    );
    return;
  }

  let changed = 0,
    barriers = 0;
  for (const cell of corridor.path.slice(1, -1)) {
    if (state.board[cell] === "hostile") {
      state.board[cell] = "neutral";
      changed++;
    }
    if (state.naturalBarriers.includes(cell)) {
      state.naturalBarriers = state.naturalBarriers.filter(
        (barrier) => barrier !== cell,
      );
      barriers++;
    }
  }
  log(
    state,
    `🌀 Conway: abriu caminho entre organismos adversários próximos, alterando ${changed + barriers} casa(s) (${changed} hostil(is), ${barriers} barreira(s) natural(is)).`,
  );
}

export function tickEnvironment(ctx) {
  const state = ctx.state,
    now = round(state);

  tickSevereEventTurn(state);
  tickDecomposition(state);
  depletePausedFertility(state);

  while (
    !severeEventActive(state) &&
    state.maxGenerationReached >= state.nextHabitatGeneration
  ) {
    advanceConway(ctx);
    state.nextHabitatGeneration += 2;
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
    for (const i of event.hazards) state.board[i] = "hostile";
  } else if (state.pendingEcologicalEvents > 0) {
    state.pendingEcologicalEvents--;
    startEvent(ctx, null, { allowSevere: false, allowPathogen: false });
  }
}


export function tickSevereEventTurn(state) {
  if (
    severeEventActive(state) &&
    state.turn - (state.event.startTurn ?? state.turn) >= 5
  )
    endEvent(state);
}
